/* journeys 共用的讀取與操作。行程內容常變：一律從頁面讀當下的資料，不寫死景點名或數量。 */

// 左側列表目前的樣子：每天一個景點名陣列
export const listNames = page => page.$$eval('#dayList > li.day', els =>
  els.map(el => [...el.querySelectorAll('.spot-name')].map(n => n.firstChild.textContent.trim())));

// 目前方向的 DAYS，唯讀
export const readDays = page => page.evaluate(() => DAYS.map(d => ({
  n:d.n, km:d.km, drive:d.drive, date:d.date,
  spots:d.spots.map(s => ({name:s.name, zh:s.zh, type:s.type, kind:s.kind || null, todo:isTodo(s)}))
})));

export const mapReady = page => page.locator('.day-pin').first().waitFor({state:'attached'});
export const placesReady = page => page.waitForFunction(() => placesReady && rmap);

export const infoTitle = page => page.locator('#info h2').first();

export const spotBtn = (page, name) => page.locator('#dayList .spot')
  .filter({has:page.locator('.spot-name', {hasText:name})}).first();

// 像使用者一樣：那天收合就先展開，再點景點
export async function openSpot(page, name){
  const day = page.locator('#dayList > li.day').filter({has:page.locator('.spot-name', {hasText:name})}).first();
  const head = day.locator('.day-head');
  if(await head.getAttribute('aria-expanded') !== 'true') await head.click();
  await spotBtn(page, name).click();
}

// 第一個名稱不會撞到其他景點的一般景點；minDay 起算（0 起），略過 Day 1 的機場
export function pickSpot(days, {minDay = 1, minSpots = 2, except = []} = {}){
  const all = days.flatMap(d => d.spots.map(s => s.name));
  for(let i = minDay; i < days.length - 2; i++){
    if(days[i].spots.length < minSpots) continue;
    const s = days[i].spots.find(x => x.type !== 'transit' && !except.includes(x.name) &&
      all.filter(n => n.includes(x.name)).length === 1);
    if(s) return {...s, day:i};
  }
  throw new Error('no suitable spot in the itinerary');
}

// 還沒排入行程、維基語言版最多的候選地點
export const pickCandidate = page => page.evaluate(() => {
  const [k, e] = [...POOL].filter(([, e]) => e.place && !(e.spot && PLANNED.has(e.spot)))
    .sort((a, b) => (b[1].place.sl || 0) - (a[1].place.sl || 0))
    .find(([, e], _, all) => all.filter(([, x]) => x.place.name.includes(e.place.name)).length === 1);
  return {k, name:e.place.name, zh:e.place.zh || ''};
});
