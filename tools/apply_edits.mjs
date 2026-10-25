#!/usr/bin/env node
/* 「更新行程」Issue 的變更清單 → public/index.html，固定規則、不經 AI。
   node tools/apply_edits.mjs <GitHub event JSON 或 Issue 內文> --out <目錄>

   - 受影響那幾天的 DAYS_CCW spots 照 Issue JSON 的順序重排；順時針靠 rev() 自動跟著變
   - 新景點用 Issue 帶來的座標與類型建一個最小景點物件：desc 留空（網頁改顯示維基百科摘要）、dwell 依類型預設
   - km／drive：原數字加上 OSRM 的路線差（當天路線全額 + 前後兩段夜間移動各一半，住處假設在中點）
   - 寫不出來的（介紹、中文名、提到舊景點的 note）列成待補，交給後面的 Claude Code 步驟
   輸出：<out>/report.md（Issue 留言）、<out>/commit.txt、<out>/polish（"true"／"false"） */
import fs from 'node:fs';
import path from 'node:path';
import {HTML, load, prop, mirror, cwFrom, splice} from './itinerary.mjs';

const [input, , outDir] = process.argv.slice(2);
if(!input || process.argv[3] !== '--out' || !outDir) throw new Error('用法：apply_edits.mjs <event.json|issue.md> --out <dir>');

const raw = fs.readFileSync(input, 'utf8');
let body = raw;
try{ body = JSON.parse(raw).issue?.body ?? raw; }catch(e){ /* 直接就是 Issue 內文 */ }
const m = body.match(/```json\s*([\s\S]*?)```/);
if(!m) fail('Issue 內文找不到 ```json 區塊');
const req = JSON.parse(m[1]);
if(req.v !== 1 || !req.days) fail('JSON 格式不對（需要 v:1 與 days）');

const doc = load();
const {js, ccw} = doc;
const BY_KEY = new Map(ccw.flatMap(d => d.spots.map(sp => [sp.key, sp])));
ccw.forEach(d => d.spots.forEach(sp => { if(sp.v.wd) BY_KEY.set(sp.v.wd, sp); }));   // 已上線的新景點用 Q 號也找得到
const add = req.add || {};

/* ---------- 重排受影響的天 ---------- */
const finalKeys = ccw.map(d => d.spots.map(sp => sp.key));
const touched = Object.keys(req.days).map(Number).sort((a, b) => a - b);
for(const n of touched){
  if(!(n >= 1 && n <= 16)) fail(`天數 ${n} 不在 1–16`);
  const keys = req.days[n];
  if(!Array.isArray(keys) || !keys.length) fail(`逆時針 Day ${n} 的清單是空的（一天至少一站）`);
  keys.forEach(k => { if(!BY_KEY.has(k) && !add[k]) fail(`「${k}」在目前的行程裡找不到，Issue 可能是舊行程開的`); });
  finalKeys[n - 1] = keys.map(k => BY_KEY.get(k)?.key ?? k);
}
const flat = finalKeys.flat();
const dup = flat.find((k, i) => flat.indexOf(k) !== i);
if(dup) fail(`「${dup}」同時出現在兩天（它原本那天沒有一起列進清單，Issue 可能是舊行程開的）`);

const DWELL = {waterfall:30, glacier:60, geothermal:45, bath:120, coast:45, canyon:60, volcanic:45,
  geology:30, wildlife:60, hike:120, view:30, culture:45, town:40, food:60, transit:30};
const newSpot = (k, p) => ({key:k, v:{name:p.name, zh:p.zh || p.name, lat:+p.lat.toFixed(4), lng:+p.lng.toFixed(4),
  type:p.type, dwell:DWELL[p.type] || 45, wd:k}});
const J = JSON.stringify;
const newSrc = ({v}) => `{name:${J(v.name)}, zh:${J(v.zh)}, wd:${J(v.wd)}, lat:${v.lat}, lng:${v.lng}, z:15,
       q:${J(`${v.name} Iceland`)}, type:${J(v.type)},
       desc:"",
       dwell:${v.dwell}}`;
for(const [k, p] of Object.entries(add)){
  if(!flat.includes(k)) continue;
  if(!/^Q\d+$/.test(k) || typeof p.name !== 'string' || !(p.lat > 62.5 && p.lat < 67.5) ||
     !(p.lng > -25 && p.lng < -13) || !doc.types.includes(p.type)) fail(`新景點 ${k} 的資料不完整`);
}
const spotOf = k => BY_KEY.get(k) || newSpot(k, add[k]);
const finalSpots = finalKeys.map(keys => keys.map(spotOf));

const edits = touched.map(n => {
  const node = ccw[n - 1].spotsNode;
  const items = finalSpots[n - 1].map(sp => sp.src ?? newSrc(sp));
  return {start:node.start, end:node.end, text:`[\n      ${items.join(',\n      ')}\n    ]`};
});

/* ---------- 變更清單（給人看） ---------- */
const baseDay = new Map(ccw.flatMap(d => d.spots.map(sp => [sp.key, d.n])));
const nowDay = new Map(finalKeys.flatMap((keys, i) => keys.map(k => [k, i + 1])));
const both = n => `逆時針 Day ${n}／順時針 Day ${mirror(n - 1) + 1}`;
const label = sp => sp.v.zh && sp.v.zh !== sp.v.name ? `${sp.v.name}（${sp.v.zh}）` : sp.v.name;
const changes = [
  ...[...nowDay].filter(([k]) => !baseDay.has(k)).map(([k, n]) => ({k, kind:'新增', text:`新增 ${label(spotOf(k))} → ${both(n)}`})),
  ...[...baseDay].filter(([k]) => !nowDay.has(k)).map(([k, n]) => ({k, kind:'移除', text:`移除 ${label(BY_KEY.get(k))}（原在${both(n)}）`})),
  ...[...baseDay].filter(([k, n]) => nowDay.has(k) && nowDay.get(k) !== n)
    .map(([k, n]) => ({k, kind:'換天', text:`換天 ${label(BY_KEY.get(k))}：${both(n)} → ${both(nowDay.get(k))}`})),
];
const same = n => finalKeys[n - 1].join('\n') === ccw[n - 1].spots.map(sp => sp.key).join('\n');
const reordered = touched.filter(n => !same(n) && !changes.some(c => baseDay.get(c.k) === n || nowDay.get(c.k) === n));
reordered.forEach(n => changes.push({kind:'順序', text:`${both(n)} 站序調整`}));
if(!changes.length) fail('清單跟目前的行程一樣，沒有要改的');

/* ---------- km／drive：OSRM 路線差 ---------- */
const OSRM = 'https://router.project-osrm.org/route/v1/driving/';
const cache = new Map();
async function route(pts){
  if(pts.length < 2) return {km:0, h:0};
  const q = pts.map(([la, ln]) => `${ln},${la}`).join(';');
  if(cache.has(q)) return cache.get(q);
  for(let t = 0; t < 4; t++){
    try{
      const r = await fetch(`${OSRM}${q}?overview=false`);
      const j = await r.json();
      if(j.code === 'Ok'){
        const v = {km:j.routes[0].distance / 1000, h:j.routes[0].duration / 3600};
        cache.set(q, v);
        await new Promise(ok => setTimeout(ok, 150));   // 公用 server，別連打
        return v;
      }
    }catch(e){ /* 重試 */ }
    await new Promise(ok => setTimeout(ok, 2000 * (t + 1)));
  }
  throw new Error('OSRM 連不上');
}
// 網頁的 segments() 同一套：via／viaR 插在該站之前
const dayPts = (sp, viaKey) => sp.flatMap(s => [...(s.v[viaKey] || []), [s.v.lat, s.v.lng]]);
const endPt = s => [s.v.lat, s.v.lng];
const sig = pts => pts.map(p => p.join(',')).join(';');

async function legDelta(oldDays, newDays, i, viaKey){
  const parts = d => ({
    day:dayPts(d[i], viaKey),
    before:i > 0 ? [endPt(d[i-1].at(-1)), endPt(d[i][0])] : [],   // 兩天之間的虛線段，網頁也不套 via
    after:d[i+1] ? [endPt(d[i].at(-1)), endPt(d[i+1][0])] : []
  });
  const a = parts(oldDays), b = parts(newDays);
  let km = 0, h = 0;
  for(const [k, w] of [['day', 1], ['before', .5], ['after', .5]]){
    if(sig(a[k]) === sig(b[k])) continue;
    const [x, y] = [await route(a[k]), await route(b[k])];
    km += w * (y.km - x.km);
    h += w * (y.h - x.h);
  }
  return {km, h};
}

const oldCcw = ccw.map(d => d.spots), newCcw = finalSpots;
const kmRows = [];
const dayNodes = [
  ...ccw.map((d, i) => ({node:d.node, i, viaKey:'via', days:[oldCcw, newCcw], name:`逆時針 Day ${i + 1}`})),
  ...doc.cwNode.elements.map((node, i) => node.type === 'ObjectExpression' &&
    {node, i, viaKey:'viaR', days:[cwFrom(oldCcw), cwFrom(newCcw)], name:`順時針 Day ${i + 1}`}).filter(Boolean),
];
try{
  for(const r of dayNodes){
    const {km, h} = await legDelta(r.days[0], r.days[1], r.i, r.viaKey);
    const kmP = prop(r.node, 'km'), drP = prop(r.node, 'drive');
    const km0 = kmP.value.value, dr0 = drP.value.value;
    const km1 = Math.max(0, Math.round(km0 + km));
    const dr1 = dr0 == null ? null : Math.max(0, Math.round((dr0 + h) * 10) / 10);
    if(km1 === km0 && dr1 === dr0) continue;
    edits.push({start:kmP.value.start, end:kmP.value.end, text:String(km1)});
    if(dr1 !== dr0) edits.push({start:drP.value.start, end:drP.value.end, text:dr1.toFixed(1)});
    kmRows.push(`- ${r.name}：${km0} km／${dr0 ?? '—'} h → **${km1} km／${dr1 ?? '—'} h**`);
  }
}catch(e){
  kmRows.length = 0;
  kmRows.push(`- OSRM 連不上，km／drive 沒有重算（${e.message}）`);
}

/* ---------- 待補：只有人或 AI 寫得出來的 ---------- */
const pending = [];
changes.filter(c => c.kind === '新增').forEach(c => {
  const sp = spotOf(c.k);
  pending.push(`${sp.v.name}（${c.k}）：desc 留空、dwell 用預設 ${sp.v.dwell} 分${sp.v.zh === sp.v.name ? '、zh 只是原文名' : ''}；walk／fee／may 未填`);
});
const gone = changes.filter(c => c.kind !== '新增' && c.k).map(c => BY_KEY.get(c.k));
const words = sp => [...sp.v.name.split(/\s*[&/()]\s*/), sp.v.zh].map(w => (w || '').trim()).filter(w => w.length >= 4);
const allDays = [...ccw.map(d => ({node:d.node, name:`逆時針 Day ${d.n}`})),
  ...doc.cwNode.elements.map((node, i) => node.type === 'ObjectExpression' && {node, name:`順時針 Day ${i + 1}`}).filter(Boolean)];
for(const sp of gone){
  const hits = allDays.filter(d => ['title', 'note'].some(k => words(sp).some(w => prop(d.node, k).value.value.includes(w))));
  if(hits.length) pending.push(`${hits.map(d => d.name).join('、')} 的 title／note 提到 ${sp.v.name}，要依新排法改寫`);
  if(nowDay.has(sp.key) && (sp.v.via || sp.v.viaR)) pending.push(`${sp.v.name} 帶著 via／viaR，換天後要確認路線點是否還適用`);
}
if(touched.length) pending.push(`受影響的天（逆時針 Day ${touched.join('、')}）：note 的行程敘述、review.html 里程表、iceland_trip_itinerary.md 要同步`);

/* ---------- 寫檔 ---------- */
const out = splice(js, edits);
fs.writeFileSync(HTML, doc.html.slice(0, doc.s0) + out + doc.html.slice(doc.s0 + js.length));
fs.mkdirSync(outDir, {recursive:true});
const short = changes.filter(c => c.kind !== '順序').map(c => `${c.kind} ${c.k ? (spotOf(c.k).v.name) : ''}`.trim());
fs.writeFileSync(path.join(outDir, 'commit.txt'), `行程更新：${short.join('、') || '站序調整'}\n`);
fs.writeFileSync(path.join(outDir, 'polish'), pending.some(p => !p.startsWith('受影響')) ? 'true' : 'false');
fs.writeFileSync(path.join(outDir, 'report.md'), `已照清單改好 \`public/index.html\`（固定規則，未經 AI）。

**變更**
${changes.map(c => `- ${c.text}`).join('\n')}

**車程與里程**（原數字加上 OSRM 算出的路線差；前後兩段夜間移動各算一半）
${kmRows.join('\n') || '- 沒有變動'}

**待補**
${pending.map(p => `- ${p}`).join('\n')}
`);
console.log(fs.readFileSync(path.join(outDir, 'report.md'), 'utf8'));

function fail(msg){
  console.error(`無法套用：${msg}`);
  if(outDir){
    fs.mkdirSync(outDir, {recursive:true});
    fs.writeFileSync(path.join(outDir, 'error.md'), `沒有套用：${msg}\n\n請在網站上確認草稿後重新送出。`);
  }
  process.exit(1);
}
