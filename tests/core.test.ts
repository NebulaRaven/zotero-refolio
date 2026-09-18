import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';
import { spTagWithin, spRenamePlan, spRenameTags, spRemoveTags } from '../src/core/tags.ts';
import { spExtraValue, spGraphLabel, spNormalizeDOI, spCitationGraph, SPCitationClient } from '../src/core/graph.ts';
import { spMergeRanks, spPublicationNames, spRedactURL } from '../src/core/journals.ts';
import { spDisplayDate } from '../src/core/dates.ts';

test('nested tag rename treats regexp characters and replacement dollars literally', () => {
  for (const name of ['#qubit^','#A+B','#tag(','#x[1]','#a.b','#a$']) {
    assert.deepEqual(spRenamePlan([name,name+'/child',name+'more'],name,'#new$&'),[
      {from:name,to:'#new$&'}, {from:name+'/child',to:'#new$&/child'}
    ]);
  }
  assert.equal(spTagWithin('#ABC','#A'),false);
});
test('rename rejects empty names and accidental tag merges before writing', () => {
  assert.throws(()=>spRenamePlan(['#A'],'#A','  '),/empty/);
  assert.throws(()=>spRenamePlan(['#A','#B'],'#A','#B'),{message:'ui-error-tag-exists'});
  assert.deepEqual(spRenamePlan(['#A'],'#A','#A'),[]);
});
test('rename awaits Zotero tag transactions, uses selected library, and rolls back a failed batch', async () => {
  const calls=[];let active=0;
  const z={Libraries:{get:id=>({editable:id===42})},Tags:{getAll:async()=>[{tag:'#A'},{tag:'#A/x'},{tag:'#AB'}],rename:async(lib,from,to)=>{
    assert.equal(active,0);active++;await new Promise(r=>setTimeout(r,2));active--;
    calls.push([lib,from,to]); if(from==='#A/x') throw new Error('database failure');
  }}, DB:{executeTransaction:()=>{throw new Error('must not nest Zotero tag transactions');}}};
  await assert.rejects(spRenameTags(z,42,'#A','#B'),/database failure/);
  assert.deepEqual(calls,[[42,'#A','#B'],[42,'#A/x','#B/x'],[42,'#B','#A']]);
  await assert.rejects(spRenameTags(z,1,'#A','#B'),/read-only/);
});
test('remove limits tags to the selected library and hierarchy', async () => {
  let removed;
  const z={Libraries:{get:()=>({editable:true})},Tags:{getAll:async()=>[{tag:'#A'},{tag:'#A/x'},{tag:'#AB'}],getID:name=>({'#A':2,'#A/x':3,'#AB':4}[name]),removeFromLibrary:async(...args)=>{removed=args;}}};
  await spRemoveTags(z,42,'#A');assert.deepEqual(removed,[42,[2,3]]);
});
const item=(id,fields,authors=[])=>({id,key:'KEY'+id,getField:key=>fields[key]||'',getCreators:()=>authors});
test('graph labels select short titles or named Extra fields, with readable fallbacks', () => {
  const paper=item(1,{title:'Full paper',shortTitle:'Theory',extra:'Graph Label: Dual continuum\nOther: Test',year:'2024'},[{lastName:'Li'}]);
  assert.equal(spGraphLabel(paper,'shortTitle'),'Theory');
  assert.equal(spGraphLabel(paper,'extra'),'Dual continuum');
  assert.equal(spGraphLabel(paper,'authorYear'),'Li, 2024');
  assert.equal(spGraphLabel(paper,'extra','Missing'),'Theory');
  assert.equal(spGraphLabel(item(2,{title:'No authors'})),'No authors');
  assert.equal(spExtraValue('A+B: literal','a+b'),'literal');
});
test('citation graph matches DOI variants, preserves direction and excludes self-links', () => {
  const papers=[item(1,{DOI:'https://doi.org/10.1234/A'}),item(2,{DOI:'10.1234/b'}),item(3,{})];
  const graph=spCitationGraph(papers,new Map([['10.1234/a',['10.1234/B','10.1234/a','10.1234/B','10.1234/absent']]]));
  assert.deepEqual(graph.citationEdges,[{source:1,target:2}]);
  assert.deepEqual(graph.nodes[2].links,{});
  assert.equal(spNormalizeDOI('not a doi'),'');
});
test('Crossref client deduplicates concurrent DOI requests and spaces request starts', async () => {
  let time=0;const starts=[];
  const client=new SPCitationClient(async()=>{starts.push(time);return {status:'ok',message:{reference:[{DOI:'10.1234/B'}]}};},async ms=>{time+=ms;},()=>time);
  const [a,b]=await Promise.all([client.get('10.1234/a'),client.get('https://doi.org/10.1234/A')]);
  assert.deepEqual(a,b);assert.equal(starts.length,1);
  await client.get('10.1234/c');assert.equal(starts[1]-starts[0],1000);
  await client.get('10.1234/a');assert.equal(starts.length,2);
});
test('missing reference metadata and network failures never become cached empty successes', async () => {
  let calls=0;
  const client=new SPCitationClient(async()=>{calls++;return {status:'ok',message:{}};},async()=>{});
  await assert.rejects(client.get('10.1234/a'),{message:'ui-error-no-crossref-references'});
  await assert.rejects(client.get('10.1234/a'));assert.equal(calls,2);
  const abort=new AbortController();abort.abort();
  await assert.rejects(client.get('10.1234/b',abort.signal),/cancelled/);
});
test('journal aliases work in either language without changing the stored journal name', () => {
  const aliases={'Acta Psychologica Sinica':['心理学报','Acta Psychologica Sinica']};
  assert.deepEqual(spPublicationNames('Acta Psychologica Sinica',aliases),['Acta Psychologica Sinica','心理学报']);
  assert.deepEqual(spPublicationNames('心理学报',aliases),['心理学报','Acta Psychologica Sinica']);
  assert.throws(()=>spPublicationNames('Test','{'),SyntaxError);
  assert.throws(()=>spPublicationNames('Test',{'Test':'alias'}),/array/);
});
test('journal rank merge fills missing fields, keeps primary values and tolerates absent custom data', () => {
  const responses=[{data:{officialRank:{all:{sciif:2.5,sci:'Q2'}}}},{data:{officialRank:{all:{sciif:1.8,pku:'北大中文核心'}},customRank:{rank:['id&&&1'],rankInfo:[{uuid:'id',abbName:'CSSCI',oneRankText:'扩展'}]}}}];
  const merged = spMergeRanks(responses.map((response, i) => ({name: String(i), response})));
  assert.deepEqual(merged.rank,{sciif:'2.5',sci:'Q2',pku:'北大中文核心',CSSCI:'扩展[rank=1]'});
  assert.equal(merged.conflicts[0].field, 'sciif');
  assert.deepEqual(spMergeRanks([null,{}, {data:{customRank:{rank:['missing&&&1']}}}].map(response => ({name:'Missing',response}))),{rank:{},conflicts:[]});
});
test('API credentials are redacted in diagnostic URLs', () => {
  const value=spRedactURL('https://example.org/?secretKey=PRIVATE&publicationName=Sleep&token=OTHER');
  assert.ok(!value.includes('PRIVATE'));assert.ok(!value.includes('OTHER'));assert.ok(value.includes('Sleep'));
});

// Exercise the exact bundled Day.js implementation with real DST boundaries.
const { require_dayjs_min, require_utc } = await import('../src/vendor/index.js');
const dayjs = require_dayjs_min(); dayjs.extend(require_utc());

test('date formatting follows system DST, preserves UTC zero and supports fractional offsets', () => {
  const before=process.env.TZ;process.env.TZ='Australia/Sydney';
  try {
    assert.equal(spDisplayDate<{format(pattern: string): string}>(dayjs,'2026-01-15 00:00:00','system').format('HH:mm'),'11:00');
    assert.equal(spDisplayDate<{format(pattern: string): string}>(dayjs,'2026-07-15 00:00:00','system').format('HH:mm'),'10:00');
    assert.equal(spDisplayDate<{format(pattern: string): string}>(dayjs,'2026-07-15 00:00:00',0).format('HH:mm'),'00:00');
    assert.equal(spDisplayDate<{format(pattern: string): string}>(dayjs,'2026-07-15 00:00:00','5.75').format('HH:mm'),'05:45');
    assert.throws(()=>spDisplayDate<{format(pattern: string): string}>(dayjs,'2026-01-01','bad'),{message:'ui-error-invalid-utc-offset'});
  } finally { if(before===undefined)delete process.env.TZ;else process.env.TZ=before; }
});
