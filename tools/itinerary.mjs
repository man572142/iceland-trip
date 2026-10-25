/* 讀 public/index.html 裡的行程資料（DAYS_CCW／DAYS_CW／TYPES），保留每個節點在原始碼裡的位置，
   讓 apply_edits.mjs 只替換需要改的那幾段文字，其餘排版一個字都不動。 */
import fs from 'node:fs';
import * as acorn from 'acorn';

export const HTML = new URL('../public/index.html', import.meta.url);

export function load(html = fs.readFileSync(HTML, 'utf8')){
  const s0 = html.indexOf('<script>') + '<script>'.length;
  const js = html.slice(s0, html.indexOf('</script>', s0));
  const ast = acorn.parse(js, {ecmaVersion:'latest'});
  const decl = name => ast.body.flatMap(n => n.type === 'VariableDeclaration' ? n.declarations : [])
    .find(d => d.id.name === name)?.init;

  const ccwNode = decl('DAYS_CCW'), cwNode = decl('DAYS_CW'), typesNode = decl('TYPES');
  if(!ccwNode || !cwNode || !typesNode) throw new Error('index.html 裡找不到 DAYS_CCW／DAYS_CW／TYPES');

  const ccw = ccwNode.elements.map((d, i) => {
    const spotsNode = prop(d, 'spots').value;
    return {node:d, i, n:value(prop(d, 'n').value), spotsNode,
      spots:spotsNode.elements.map(sp => ({node:sp, src:js.slice(sp.start, sp.end), v:value(sp)}))};
  });
  // 鍵跟網頁的 keyOf 一樣：名稱，KEF 這種頭尾各一個的補上天數
  const all = ccw.flatMap(d => d.spots.map(sp => ({sp, n:d.n})));
  all.forEach(({sp, n}) => sp.key = all.filter(x => x.sp.v.name === sp.v.name).length > 1 ? `${sp.v.name}@${n}` : sp.v.name);

  return {html, js, s0, ccw, cwNode, types:Object.keys(value(typesNode))};
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

// 順時針第 i 天 = 逆時針第 14-i 天倒過來（0 起算），Day 1／15／16 共用
export const mirror = i => i === 0 || i >= 14 ? i : 14 - i;
export const cwFrom = ccw => ccw.map((_, i) => i === 0 || i >= 14 ? ccw[i] : ccw[14 - i].slice().reverse());

// 依位置由後往前替換，前面的位置才不會跑掉
export function splice(text, edits){
  return edits.sort((a, b) => b.start - a.start)
    .reduce((t, e) => t.slice(0, e.start) + e.text + t.slice(e.end), text);
}
