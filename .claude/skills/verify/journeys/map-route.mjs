import {listNames, mapReady, readDays, infoTitle, openSpot, pickSpot} from './lib.mjs';

const OSRM = 'router.project-osrm.org';
const CDN = 'cdnjs.cloudflare.com';

// 假的 OSRM 回應：每段都標成 F 路，用來驗警告有接上（真實路線走不走 F 路要看當下的座標）
function froadRoute(url){
  const coords = new URL(url).pathname.split('/').pop().split(';').map(c => c.split(',').map(Number));
  const legs = coords.slice(1).map(() => ({distance:10000, duration:600, steps:[{ref:'F208'}]}));
  return {json:{code:'Ok', routes:[{geometry:{coordinates:coords}, distance:10000 * legs.length, duration:600 * legs.length, legs}]}};
}

export default async function(t){
  let page = t.page;
  await t.open('/');
  await mapReady(page);
  const days = await readDays(page);

  await t.step('default view: empty prompt, one pin per day', async () => {
    t.check(await page.locator('#info .lead', {hasText:'從左側點選任一景點'}).isVisible(), 'empty prompt');
    t.eq(await page.locator('.day-pin').count(), days.length, 'one numbered pin per day');
    const last = (await listNames(page))[1].at(-1);
    await page.locator(`.leaflet-marker-icon[title="DAY 2 ${last}"]`).waitFor({state:'attached'});
    t.check(true, 'Day 2 pin at that day\'s last listed stop');
  });

  await t.step('住宿 link carries dates, party size and price cap', async () => {
    const stayHref = async i => {
      await page.evaluate(i => PINS[i].openPopup(), i);
      return page.locator('.leaflet-popup-content .pop-links a', {hasText:'住宿'}).last().getAttribute('href');
    };
    const u = new URL(await stayHref(0));
    t.eq(u.hostname, 'www.booking.com', 'goes to Booking');
    const [m, d] = days[0].date.match(/\d+/g).map(Number);
    t.check(new RegExp(`-0?${m}-0?${d}$`).test(u.searchParams.get('checkin')), 'checkin = that day', u.searchParams.get('checkin'));
    t.check(u.searchParams.get('checkout') > u.searchParams.get('checkin'), 'checkout after checkin', u.searchParams.get('checkout'));
    t.check(Number(u.searchParams.get('group_adults')) > 0, 'group_adults set');
    t.check(u.searchParams.get('nflt')?.startsWith('price=TWD-'), 'price filter', u.searchParams.get('nflt'));
    const at = await page.evaluate(() => DAYS.slice(0, -1).map(d => d.spots.at(-1)));
    for(const [i, s] of at.entries()){
      const stay = new URL(await stayHref(i));
      t.eq(stay.searchParams.get('ss'), `${s.name}, Iceland`, `night ${i+1} centres on ${s.name}`);
    }
    for(const label of ['加油', '超市']){
      await page.evaluate(() => PINS[0].openPopup());
      const g = await page.locator('.leaflet-popup-content .pop-links a', {hasText:label}).last().getAttribute('href');
      t.check(g.startsWith('https://www.google.com/maps/search/'), `${label} stays on Google`);
    }
  });

  await t.step('roads arrive from OSRM and replace the straight lines', async () => {
    await page.waitForFunction(() => LINES.gap0.getLatLngs().length > 2, null, {timeout:60000});
    t.check((await page.evaluate(() => LINES.gap0.getLatLngs().length)) > 2, 'gap line follows the road');
  });

  await t.step('road cache is written and the reload makes no OSRM query', async () => {
    await page.waitForFunction(() => Object.keys(JSON.parse(localStorage.getItem(ROADS_KEY) || '{}')).length > 0, null, {timeout:120000});
    const before = t.requests.length;
    await page.reload();
    await mapReady(page);
    await page.waitForFunction(() => LINES.gap0.getLatLngs().length > 2);
    t.eq(t.requests.slice(before).filter(u => u.includes(OSRM)).length, 0, 'no OSRM requests after reload');
  });

  await t.step('spot popup shows the fuel line once roads are known', async () => {
    const spot = pickSpot(days, {minDay:2});
    await page.waitForFunction(n => [...LEG_KM.keys()].some(s => s.name === n), spot.name, {timeout:30000})
      .catch(() => t.check(false, 'leg for chosen spot known', spot.name));
    await openSpot(page, spot.name);
    const pop = page.locator('.leaflet-popup-content');
    await pop.waitFor({state:'visible'});
    t.eq(await pop.locator('.pop-h').innerText(), spot.name, 'popup names the spot');
    t.check(/距上一站 .* 油費\$/.test(await pop.locator('.pop-fuel').innerText()), 'fuel line', await pop.locator('.pop-fuel').innerText());
  });

  await t.step('路線 hides the lines, keeps the pins', async () => {
    const lines = () => page.locator('.leaflet-overlay-pane path[stroke-dasharray]').count();
    t.check(await lines() > 0, 'dashed lines on');
    await page.locator('#btnRoute').click();
    t.eq(await page.locator('#btnRoute').getAttribute('aria-pressed'), 'false', 'unpressed');
    t.eq(await lines(), 0, 'lines gone');
    t.eq(await page.locator('.day-pin').count(), days.length, 'pins stay');
    await page.locator('#btnRoute').click();
    t.check(await lines() > 0, 'lines back');
  });

  await t.step('tile buttons swap the base map', async () => {
    const tile = host => page.locator(`#route img.leaflet-tile[src*="${host}"]`).first().waitFor({state:'attached'});
    await page.locator('button[data-t="k"]').click();
    await tile('arcgisonline');
    t.eq(await page.locator('button[data-t="k"]').getAttribute('aria-pressed'), 'true', '衛星 pressed');
    t.eq(await page.locator('#route').evaluate(e => e.classList.contains('dim')), false, 'dark filter off for imagery');
    await page.locator('button[data-t="p"]').click();
    await tile('opentopomap');
    t.eq(await page.locator('#route').evaluate(e => e.classList.contains('dim')), true, 'dark filter on for terrain');
    await page.locator('button[data-t="m"]').click();
    await tile('tile.openstreetmap.org');
    t.check(true, 'OSM tiles back');
  });

  await t.step('dead routing server: straight lines stay, page usable', async () => {
    page = await t.newPage({block:[OSRM]});
    await t.open('/');
    await mapReady(page);
    await page.waitForTimeout(1500);   // 給第一輪查詢失敗的時間
    t.eq(await page.evaluate(() => LINES.gap0.getLatLngs().length), 2, 'gap line still straight');
    t.eq(await page.locator('.day-pin').count(), days.length, 'pins still drawn');
  });

  await t.step('leg on an F-road is flagged in the popup', async () => {
    page = await t.newPage({fulfill:{[OSRM]:froadRoute}});
    await t.open('/');
    await mapReady(page);
    const spot = pickSpot(days, {minDay:2});
    await page.waitForFunction(n => [...LEG_KM.keys()].some(s => s.name === n), spot.name, {timeout:30000});
    await openSpot(page, spot.name);
    const text = await page.locator('.leaflet-popup-content .pop-fuel').innerText();
    t.check(text.includes('路線僅供參考'), 'popup flags the leg', text);
    t.check(!/OSRM|F\d/.test(text), 'no server or road numbers in the text');
  });

  await t.step('dead Leaflet CDN: message instead of a map, list still works', async () => {
    page = await t.newPage({block:[CDN, OSRM]});
    await t.open('/');
    t.check((await page.locator('.map-ph span').innerText()).includes('連不上'), 'placeholder message');
    t.eq(await page.locator('#dayList > li.day').count(), days.length, 'day list rendered');
  });
}
