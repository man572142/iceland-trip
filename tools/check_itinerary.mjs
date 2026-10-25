#!/usr/bin/env node
/* 行程資料的固定檢查：套用變更後、Claude Code 補完文字後都跑一次，不過就不推。
   node tools/check_itinerary.mjs */
import {load, prop} from './itinerary.mjs';

const {ccw, cwNode, types} = load();
const errs = [], warns = [];
const where = (d, s) => `逆時針 Day ${d.n}${s ? ` ${s.v.name ?? '?'}` : ''}`;

if(ccw.length !== 16) errs.push(`DAYS_CCW 應有 16 天，現在 ${ccw.length}`);
ccw.forEach((d, i) => {
  if(d.n !== i + 1) errs.push(`${where(d)}：n 應為 ${i + 1}`);
  if(!d.spots.length) errs.push(`${where(d)}：沒有任何景點`);
  for(const k of ['title', 'date', 'note']) if(typeof prop(d.node, k)?.value.value !== 'string') errs.push(`${where(d)}：缺 ${k}`);
  d.spots.forEach(s => {
    const v = s.v;
    for(const k of ['name', 'zh', 'q', 'desc']) if(typeof v[k] !== 'string') errs.push(`${where(d, s)}：缺 ${k}`);
    for(const k of ['lat', 'lng', 'z', 'dwell']) if(typeof v[k] !== 'number') errs.push(`${where(d, s)}：缺 ${k}`);
    if(!(v.lat > 62.5 && v.lat < 67.5 && v.lng > -25 && v.lng < -13)) errs.push(`${where(d, s)}：座標不在冰島`);
    if(!types.includes(v.type)) errs.push(`${where(d, s)}：type「${v.type}」不在 TYPES 裡`);
    if(v.desc === '') warns.push(`${where(d, s)}：desc 待補`);
  });
});

const names = ccw.flatMap(d => d.spots.map(s => s.v.name));
[...new Set(names.filter((n, i) => names.indexOf(n) !== i))]
  .filter(n => !/\(KEF\)/.test(n)).forEach(n => errs.push(`景點重複：${n}`));

// 順時針必須是 Day 1／15／16 共用、其餘 spots:rev(15-i)
const cw = cwNode.elements;
if(cw.length !== 16) errs.push(`DAYS_CW 應有 16 天，現在 ${cw.length}`);
cw.forEach((d, i) => {
  if(i === 0 || i >= 14){
    if(!(d.type === 'MemberExpression' && d.object.name === 'DAYS_CCW' && d.property.value === i))
      errs.push(`DAYS_CW[${i}] 應為 DAYS_CCW[${i}]`);
    return;
  }
  const sp = d.type === 'ObjectExpression' && prop(d, 'spots')?.value;
  if(!(sp?.type === 'CallExpression' && sp.callee.name === 'rev' && sp.arguments[0]?.value === 15 - i))
    errs.push(`順時針 Day ${i + 1}：spots 應為 rev(${15 - i})`);
});

warns.forEach(w => console.log('⚠', w));
errs.forEach(e => console.log('✗', e));
console.log(errs.length ? `檢查失敗：${errs.length} 項` : `檢查通過（${names.length} 個景點）`);
process.exit(errs.length ? 1 : 0);
