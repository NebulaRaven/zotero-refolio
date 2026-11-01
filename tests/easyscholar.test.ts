import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { script } from './source.mts';

async function ranks() {
  const ctx: vm.Context = {};
  vm.runInNewContext(await script(new URL('../src/upstream/utils/easyscholar.ts', import.meta.url)), ctx);
  return ctx.easyscholar_default;
}
const info = (rank, key, value) => ({ rank, key, value });

test('impact factors rank by thresholds and keep the provider value', async () => {
  const r = await ranks();
  assert.deepEqual({ ...r.sciif('12.5') }, info(1, 'SCIIF', '12.5'));
  assert.deepEqual({ ...r.sciif('4') }, info(2, 'SCIIF', '4'));
  assert.deepEqual({ ...r.sciif('0.3') }, info(5, 'SCIIF', '0.3'));
  assert.deepEqual({ ...r.sciif('') }, info(5, 'SCIIF', ''));
  assert.deepEqual({ ...r.sciif('n/a') }, info(undefined, 'SCIIF', 'n/a'));
  assert.deepEqual({ ...r.sciif5('3.9 (2023)') }, info(3, 'SCIIF(5)', '3.9 (2023)'));
  assert.deepEqual({ ...r.sciif5('') }, info(undefined, 'SCIIF(5)', ''));
  assert.deepEqual({ ...r.jci('0.5') }, info(3, 'JCI', '0.5'));
  assert.deepEqual({ ...r.jci('-1') }, info(undefined, 'JCI', '-1'));
});

test('labelled ranks match exact labels, suffixes, prefixes and aliases', async () => {
  const r = await ranks();
  assert.deepEqual({ ...r.sci('Q2') }, info(2, 'SCI', 'Q2'));
  assert.deepEqual({ ...r.ssci('SSCI') }, info(5, 'SSCI', 'SSCI'));
  assert.deepEqual({ ...r.sciBase('医学1区') }, info(1, 'SCI基础版', '医学1区'));
  assert.deepEqual({ ...r.sciUp('工程技术3区') }, info(3, 'SCI升级版', '工程技术3区'));
  assert.deepEqual({ ...r.cug('地学T4') }, info(4, 'CUG', '地学T4'));
  assert.deepEqual({ ...r.cju('T2类') }, info(2, 'YangtzeU', 'T2类'));
  assert.deepEqual({ ...r.scu('A-') }, info(2, 'SCU', 'A-'));
  assert.deepEqual({ ...r.scu('E') }, info(5, 'SCU', 'E'));
  assert.deepEqual({ ...r.hhu('A+类') }, info(1, 'HHU', 'A+类'));
  assert.deepEqual({ ...r.hhu('A类') }, info(2, 'HHU', 'A类'));
  assert.deepEqual({ ...r.ccf('T3') }, info(3, 'CCF', 'T3'));
  assert.deepEqual({ ...r.cqu('权威期刊') }, info(2, 'CQU', '权威期刊'));
  assert.deepEqual({ ...r.ajg('4*') }, info(1, 'AJG', '4*'));
  assert.deepEqual({ ...r.swjtu('C') }, info(5, 'SWJTU', 'C'));
  assert.deepEqual({ ...r.zju('国内一级学术期刊') }, info(1, 'ZJU', '国内一级'));
  assert.deepEqual({ ...r.cssci('CSSCI扩展版') }, info(2, 'CSSCI扩展版', ''));
  assert.deepEqual({ ...r.nju('学科群一流期刊') }, info(1, 'NJU', '学科群一流期刊'));
  assert.deepEqual({ ...r.CPU('学科重要') }, info(5, 'CPU', '学科重要'));
  assert.deepEqual({ ...r.ruc('Z') }, info(undefined, 'RUC', 'Z'));
});

test('indexes without levels show a fixed label', async () => {
  const r = await ranks();
  assert.deepEqual({ ...r.pku('北大核心') }, info(1, '北大中文核心', ''));
  assert.deepEqual({ ...r.eii('EI') }, info(2, 'EI检索', ''));
  assert.deepEqual({ ...r.ahci('AHCI') }, info(2, 'A&HCI 检索', ''));
  assert.deepEqual({ ...r.sciwarn('预警') }, info(1, 'SCIWARN', '预警'));
});

test('single-label lists show their label and ignore anything else', async () => {
  const r = await ranks();
  assert.deepEqual({ ...r.utd24('UTD24') }, info(1, 'UTD24', ''));
  assert.deepEqual({ ...r.ft50('FT50') }, info(1, 'FT50', ''));
  assert.deepEqual({ ...r.xmu('XMU一类') }, info(2, 'XMU一类', ''));
  assert.deepEqual({ ...r.zhongguokejihexin('中国科技核心期刊') }, info(1, '中国科技核心期刊', ''));
  assert.deepEqual({ ...r.utd24('other') }, info(undefined, undefined, undefined));
});

test('custom ranks read letters, explicit rank markers and digits', async () => {
  const r = await ranks();
  assert.deepEqual({ ...r.custom('school', 'B类') }, info(2, 'school', 'B'));
  assert.deepEqual({ ...r.custom('school', 'Top[rank=3]') }, info(3, 'school', 'Top'));
  assert.deepEqual({ ...r.custom('school', '第4档') }, info(4, 'school', '第4档'));
  assert.deepEqual({ ...r.custom('school', 'Core') }, info(1, 'school', 'Core'));
});
