/* 讀 public/index.html 裡的行程資料（DAYS／TYPES），保留每個節點在原始碼裡的位置，
   讓 apply_edits.mjs 只替換需要改的那幾段文字，其餘排版一個字都不動。 */
import fs from 'node:fs';
import * as acorn from 'acorn';

export const HTML = new URL('../public/index.html', import.meta.url);
export const POOL = new URL('./candidates.json', import.meta.url);

export function load(html = fs.readFileSync(HTML, 'utf8')){
  const s0 = html.indexOf('<script>') + '<script>'.length;
  const js = html.slice(s0, html.indexOf('</script>', s0));
  const ast = acorn.parse(js, {ecmaVersion:'latest'});
  const decl = name => ast.body.flatMap(n => n.type === 'VariableDeclaration' ? n.declarations : [])
    .find(d => d.id.name === name)?.init;

  const daysNode = decl('DAYS'), typesNode = decl('TYPES');
  if(!daysNode || !typesNode) throw new Error('index.html 裡找不到 DAYS／TYPES');

  const days = daysNode.elements.map((d, i) => {
    const spotsNode = prop(d, 'spots').value;
    const nearbyProp = prop(d, 'nearby');
    return {node:d, i, n:value(prop(d, 'n').value), spotsNode, nearbyProp, nearby:nearbyProp ? value(nearbyProp.value) : [],
      spots:spotsNode.elements.map(sp => ({node:sp, src:js.slice(sp.start, sp.end), v:value(sp)}))};
  });
  // 鍵跟網頁的 keyOf 一樣：名稱，KEF 這種頭尾各一個的補上天數
  const all = days.flatMap(d => d.spots.map(sp => ({sp, n:d.n})));
  all.forEach(({sp, n}) => sp.key = all.filter(x => x.sp.v.name === sp.v.name).length > 1 ? `${sp.v.name}@${n}` : sp.v.name);

  return {html, js, s0, days, types:Object.keys(value(typesNode))};
}

export const prop = (obj, name) => obj.properties.find(p => (p.key.name ?? p.key.value) === name);

// 只吃純字面值（行程資料本來就只有這些）
export function value(n){
  switch(n.type){
    case 'Literal': return n.value;
    case 'UnaryExpression': if(n.operator === '-') return -value(n.argument); break;
    case 'ArrayExpression': return n.elements.map(value);
    case 'ObjectExpression': return Object.fromEntries(n.properties.map(p => [p.key.name ?? p.key.value, value(p.value)]));
  }
  throw new Error(`不是字面值：${n.type}`);
}

// 依位置由後往前替換，前面的位置才不會跑掉
export function splice(text, edits){
  return edits.sort((a, b) => b.start - a.start)
    .reduce((t, e) => t.slice(0, e.start) + e.text + t.slice(e.end), text);
}


// 名稱比對規則同網頁的 fold()／loadPlaces()
export const fold = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/ð/g, 'd').replace(/þ/g, 'th').replace(/æ/g, 'ae').replace(/ø/g, 'o');
export const nameParts = t => fold(t).split(/\s*[&/()]\s*/).filter(Boolean);

// 括號裡是補充說明，不算名稱
export const spotOfCandidate = (c, spots) => spots.find(s => (c.wd && s.wd === c.wd) ||
  (typeof s.name === 'string' && nameParts(s.name).includes(fold(c.name.replace(/\s*\(.*\)$/, '')))));

/* 候選池的結論跟行程對不對得上。過期只代表行程變了、結論還沒更新，行程本身沒有錯，
   所以地圖送來的變更不該被它擋下，由下一次手動編輯補上。 */
export function poolStale(days, pool = JSON.parse(fs.readFileSync(POOL, 'utf8'))){
  const spots = days.flatMap(d => d.spots.map(s => s.v));
  const names = new Set(spots.map(s => s.name));
  const out = [];
  for(const c of pool.candidates){
    const d = c.decision, hit = spotOfCandidate(c, spots);
    if(d?.kind === 'plan' && !names.has(d.spot)) out.push(`${c.name}：結論指向的景點「${d.spot}」已不在行程裡`);
    if(d?.kind === 'nearby' && !days[d.day - 1]?.nearby?.some(n => (c.wd && n.wd === c.wd) || fold(n.name) === fold(c.name)))
      out.push(`${c.name}：Day ${d.day} 的 nearby 已沒有這一列`);
    if((d?.kind === 'skip' || d?.kind === 'nearby') && hit) out.push(`${c.name}：結論是 ${d.kind}，但已排進行程（${hit.name}）`);
  }
  return out;
}
