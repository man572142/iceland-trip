#!/usr/bin/env node
/* 行程資料的固定檢查：套用變更後、Claude Code 補完文字後都跑一次，不過就不推。
   node tools/check_itinerary.mjs [--stale-ok]
   --stale-ok：候選池結論過期只警告（地圖送來的變更用，見 poolStale）；行程規則照擋。 */
import fs from 'node:fs';
import {fold, load, nameParts, POOL, poolStale, prop, spotOfCandidate} from './itinerary.mjs';

const {days, types} = load();
const errs = [], warns = [];
const where = (d, s) => `Day ${d.n}${s ? ` ${s.v.name ?? '?'}` : ''}`;
const inIceland = v => v.lat > 62.5 && v.lat < 67.5 && v.lng > -25 && v.lng < -13;
const isText = x => typeof x === 'string' && x !== '';
const MAX_EXTRAS = 3;   // highlights、nearby 的上限：內容要克制，多了就該挑

if(days.length !== 16) errs.push(`DAYS 應有 16 天，現在 ${days.length}`);
days.forEach((d, i) => {
  if(d.n !== i + 1) errs.push(`${where(d)}：n 應為 ${i + 1}`);
  if(!d.spots.length) errs.push(`${where(d)}：沒有任何景點`);
  for(const k of ['title', 'date', 'note']) if(typeof prop(d.node, k)?.value.value !== 'string') errs.push(`${where(d)}：缺 ${k}`);
  // 住宿由使用者自己找，行程不預設過夜地點
  for(const k of ['title', 'note']) if(/過夜|當晚|晚上住|住在|為基地/.test(prop(d.node, k)?.value.value ?? '')) errs.push(`${where(d)}：${k} 預設了過夜地點`);
  d.spots.forEach(s => {
    const v = s.v;
    for(const k of ['name', 'zh', 'q', 'desc']) if(typeof v[k] !== 'string') errs.push(`${where(d, s)}：缺 ${k}`);
    for(const k of ['lat', 'lng', 'z', 'dwell']) if(typeof v[k] !== 'number') errs.push(`${where(d, s)}：缺 ${k}`);
    if(!inIceland(v)) errs.push(`${where(d, s)}：座標不在冰島`);
    if(!types.includes(v.type)) errs.push(`${where(d, s)}：type「${v.type}」不在 TYPES 裡`);
    if(v.desc === '') warns.push(`${where(d, s)}：desc 待補`);
    if(v.highlights !== undefined){
      if(!Array.isArray(v.highlights) || v.highlights.length > MAX_EXTRAS) errs.push(`${where(d, s)}：highlights 要是陣列，最多 ${MAX_EXTRAS} 項`);
      else v.highlights.forEach((h, i) => {
        if(!isText(h?.t) || !isText(h?.d)) errs.push(`${where(d, s)}：highlights[${i}] 缺 t 或 d`);
        if(h?.min !== undefined && typeof h.min !== 'number') errs.push(`${where(d, s)}：highlights[${i}].min 要是數字`);
      });
    }
  });
});

// nearby 列的是刻意沒排的地點，跟行程重複就是寫錯
const planned = days.flatMap(d => d.spots.map(s => s.v));
const inPlan = n => planned.find(s => s.wd === n.wd ||
  (isText(s.name) && nameParts(s.name).some(p => nameParts(n.name).includes(p))) ||
  (Math.abs(s.lat - n.lat) < .0006 && Math.abs(s.lng - n.lng) < .0012));   // 約 60 m

const nearbySeen = new Map();
days.forEach(d => {
  if(!d.nearbyProp) return;
  if(!Array.isArray(d.nearby) || d.nearby.length > MAX_EXTRAS) return errs.push(`${where(d)}：nearby 要是陣列，最多 ${MAX_EXTRAS} 項`);
  d.nearby.forEach((n, i) => {
    const at = `${where(d)} nearby ${n?.name ?? `[${i}]`}`;
    for(const k of ['name', 'zh', 'why']) if(!isText(n?.[k])) errs.push(`${at}：缺 ${k}`);
    if(!/^Q\d+$/.test(n?.wd)) errs.push(`${at}：wd「${n?.wd}」不是 Q 號`);
    if(!inIceland(n ?? {})) errs.push(`${at}：座標不在冰島`);
    if(!types.includes(n?.type)) errs.push(`${at}：type「${n?.type}」不在 TYPES 裡`);
    if(!isText(n?.name)) return;
    const hit = inPlan(n);
    if(hit) errs.push(`${at}：已經排在行程裡（${hit.name}），不該列在 nearby`);
    // 一個地點只有一個 why：網頁的面板用 Q 號查它
    if(nearbySeen.has(n.wd)) errs.push(`${at}：${n.wd} 已列在 Day ${nearbySeen.get(n.wd)} 的 nearby`);
    nearbySeen.set(n.wd, d.n);
  });
});

const names = days.flatMap(d => d.spots.map(s => s.v.name));
[...new Set(names.filter((n, i) => names.indexOf(n) !== i))]
  .filter(n => !/\(KEF\)/.test(n)).forEach(n => errs.push(`景點重複：${n}`));

/* ---------- 候選池與選點規則（docs/edit-pipeline.md 的 The candidate pool） ---------- */
const pool = JSON.parse(fs.readFileSync(POOL, 'utf8'));
const ONLY_BATH = 'Mývatn Nature Baths';
const WILDLIFE_MIN = .1;
const NOT_SIGHTSEEING = new Set(['transit', 'bath', 'food']);   // 比例的分母只算景點
const GROUP = t => t === 'wildlife' ? '動物' : t === 'culture' || t === 'town' ? '人文' : '風景';
const REQUIRED_FAUNA = ['horse', 'seal', 'bird'];
const SAME_TYPE_WARN = 3;
const DECISIONS = ['plan', 'nearby', 'skip', 'excluded'];

const plannedName = new Set(planned.map(s => s.name));
for(const c of pool.candidates){
  if(!c.excluded && (c.sources?.length ?? 0) >= 2 && !c.decision) errs.push(`候選 ${c.name}：${c.sources.length} 個來源卻沒有結論`);
  if(c.decision && !DECISIONS.includes(c.decision.kind)) errs.push(`候選 ${c.name}：decision.kind「${c.decision.kind}」不對`);
  if(c.decision?.kind === 'skip' && !isText(c.decision.why)) errs.push(`候選 ${c.name}：skip 要寫 why`);
  if(c.excluded && spotOfCandidate(c, planned)) errs.push(`候選 ${c.name} 已排除（${c.excluded}），不該排進行程`);
}
planned.filter(s => s.type === 'bath' && s.name !== ONLY_BATH)
  .forEach(s => errs.push(`${s.name}：type bath 只留給 ${ONLY_BATH}`));

const sights = planned.filter(s => !NOT_SIGHTSEEING.has(s.type));
const share = g => sights.filter(s => GROUP(s.type) === g).length / sights.length;
if(share('動物') < WILDLIFE_MIN) errs.push(`動物比例 ${(share('動物') * 100).toFixed(1)}%，低於 ${WILDLIFE_MIN * 100}%`);
for(const f of REQUIRED_FAUNA)
  if(!pool.candidates.some(c => c.fauna === f && c.decision?.kind === 'plan' && plannedName.has(c.decision.spot)))
    errs.push(`${f} 沒有任何排進行程的候選`);

days.forEach(d => {
  const count = {};
  d.spots.forEach(s => count[s.v.type] = (count[s.v.type] || 0) + 1);
  Object.entries(count).filter(([, n]) => n >= SAME_TYPE_WARN).forEach(([t, n]) => warns.push(`${where(d)}：同類型 ${t} 有 ${n} 個`));
});

const stale = poolStale(days, pool);
(process.argv.includes('--stale-ok') ? warns : errs).push(...stale.map(s => `候選池結論過期：${s}`));

warns.forEach(w => console.log('⚠', w));
errs.forEach(e => console.log('✗', e));
console.log(`比例：風景 ${(share('風景') * 100).toFixed(1)}%、動物 ${(share('動物') * 100).toFixed(1)}%、人文 ${(share('人文') * 100).toFixed(1)}%（${sights.length} 個景點，不含 ${[...NOT_SIGHTSEEING].join('、')}）`);
console.log(errs.length ? `檢查失敗：${errs.length} 項` : `檢查通過（${names.length} 個景點）`);
process.exit(errs.length ? 1 : 0);
