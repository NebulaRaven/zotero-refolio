import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import database from '../data/journals.json' with {type:'json'};
import {spBuiltInJournalNames,spCreateJournalIndex,spNormalizeJournalName,spPublicationNames} from '../src/core/journals.ts';
import {assemble, assembleModule} from '../scripts/build.mts';

test('directory accounts for every row of the three source lists, including both CSCD collections',()=>{
  const {journals,coverage}=database;
  assert.equal(new Set(journals.map(j=>j.id)).size,journals.length);
  for(const [name,count] of Object.entries({pku:1987,cssci:674,cscd:1504})) {
    const memberships=journals.flatMap(j=>j.indexes).filter(i=>i.name===name);
    assert.equal(memberships.length,count);
    assert.equal(coverage.scopes[name],count);
    assert.deepEqual(memberships.map(i=>i.row).sort((a,b)=>a-b),Array.from({length:count},(_,i)=>i+1));
    assert.ok(memberships.every(i=>database.sources[i.source] && i.title && i.page>0));
  }
  assert.deepEqual(coverage.cscd,{core:1120,extended:384});
  for(const collection of ['core','extended']) assert.equal(
    journals.flatMap(j=>j.indexes).filter(i=>i.name==='cscd'&&i.collection===collection).length,
    coverage.cscd[collection]);
  assert.equal(coverage.bilingual,journals.filter(j=>j.zh&&j.en).length);
  assert.equal(coverage.chineseOnly,journals.filter(j=>j.zh&&!j.en).length);
  assert.equal(coverage.englishOnly,journals.filter(j=>j.en&&!j.zh).length);
  assert.equal(coverage.journals,coverage.bilingual+coverage.chineseOnly+coverage.englishOnly);
});

test('journal names have traceable metadata and only valid ISSNs',()=>{
  for(const journal of database.journals) {
    assert.ok(journal.zh||journal.en,journal.id);
    assert.ok(!journal.en||!/\p{Script=Han}|\p{Script=Hangul}/u.test(journal.en),journal.id);
    if(journal.zh&&journal.en) assert.ok(journal.nameSources.length,journal.id);
    for(const issn of journal.issn) {
      assert.match(issn,/^\d{4}-\d{3}[\dX]$/);
      assert.equal([...issn.replace('-','')].reduce((sum,c,i)=>sum+(c==='X'?10:Number(c))*(8-i),0)%11,0,issn);
    }
  }
});

test('PKU, CSSCI and CSCD bilingual names expand without manual preferences',()=>{
  for(const [en,zh] of [
    ['Acta Psychologica Sinica','心理学报'],
    ['Economic Research Journal','经济研究'],
    ['Acta Metrologica Sinica','计量学报']
  ]) {
    assert.deepEqual(spPublicationNames(en),[en,zh]);
    assert.deepEqual(spPublicationNames(zh),[zh,en]);
  }
  const original='  ACTA PSYCHOLOGICA SINICA  ';
  assert.deepEqual(spPublicationNames(original),[original,'心理学报']);
});

test('ambiguous bilingual titles do not join separate journal editions',()=>{
  const index=spCreateJournalIndex([
    {zh:'期刊甲',en:'Shared Title',aliases:['Unique A']},
    {zh:'期刊乙',en:'Shared Title',aliases:['Unique B']}
  ]);
  assert.deepEqual(spBuiltInJournalNames('Shared Title',index),[]);
  assert.deepEqual(spBuiltInJournalNames('期刊甲',index),['期刊甲','Unique A']);
  assert.deepEqual(spBuiltInJournalNames('Unique B',index),['期刊乙','Unique B']);
  assert.ok(!spPublicationNames('Chinese Journal of Management').includes('Journal of Management and Business Research'));
  assert.ok(!spPublicationNames('Journal of Management and Business Research').includes('管理学报'));
  assert.ok(!spPublicationNames('Acta Oceanologica Sinica').includes('海洋学报'));
  assert.ok(spPublicationNames('Haiyang Xuebao').includes('海洋学报'));
});

test('custom aliases override the directory, and missing or renamed titles are not guessed',()=>{
  assert.deepEqual(spPublicationNames('Acta Psychologica Sinica',{'Acta Psychologica Sinica':['My alias']}),['Acta Psychologica Sinica','My alias']);
  assert.deepEqual(spPublicationNames('Unlisted Journal'),['Unlisted Journal']);
  assert.deepEqual(spPublicationNames('Journal of Abnormal Psychology'),['Journal of Abnormal Psychology']);
  const missing=database.journals.find(j=>j.zh&&!j.en);
  assert.ok(missing);
  assert.ok(spPublicationNames(missing.zh).every(name=>/[\u4e00-\u9fff]/.test(name)));
  assert.equal(spNormalizeJournalName('Test（ Part A ）'),spNormalizeJournalName('TEST(Part A)'));
});

test('the module build embeds and executes journal names without a runtime JSON loader',async()=>{
  const source=await assemble();
  assert.ok(!source.includes('import spJournalDatabase'));
  assert.ok(!source.includes('nameSources'));
  const sandbox: { JournalTest?: { spPublicationNames(name: string): string[] } }={};
  vm.runInNewContext(await assembleModule('src/core/journals.ts', 'JournalTest'),sandbox);
  assert.deepEqual(Array.from(sandbox.JournalTest!.spPublicationNames('Acta Metrologica Sinica')),['Acta Metrologica Sinica','计量学报']);
});
