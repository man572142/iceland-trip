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
  const spots = days.reduce((n, d) => n + d.spots.length, 0);

  await t.step('overview is the default: pins, summary, nights', async () => {
    t.eq(await infoTitle(page).innerText(), '全程路線', 'overview panel');
    t.eq(await page.locator('#btnAll').getAttribute('aria-pressed'), 'true', '全覽 pressed');
    t.eq(await page.locator('.day-pin').count(), days.length, 'one numbered pin per day');
    const last = (await listNames(page))[1].at(-1);
    await page.locator(`.leaflet-marker-icon[title="DAY 2 ${last}"]`).waitFor({state:'attached'});
    t.check(true, 'Day 2 pin at that day\'s last listed stop');
    t.eq(await page.locator('.route-sum b').first().innerText(), String(spots), 'summary spot count');
    t.eq(await page.locator('.nights .night').count(), days.length - 1, 'one row per night');
  });

  await t.step('住宿 link carries dates, party size and price cap', async () => {
    const href = await page.locator('.night').first().locator('a', {hasText:'住宿'}).getAttribute('href');
    const u = new URL(href);
    t.eq(u.hostname, 'www.booking.com', 'goes to Booking');
    const [m, d] = days[0].date.match(/\d+/g).map(Number);
    t.check(new RegExp(`-0?${m}-0?${d}$`).test(u.searchParams.get('checkin')), 'checkin = that day', u.searchParams.get('checkin'));
    t.check(u.searchParams.get('checkout') > u.searchParams.get('checkin'), 'checkout after checkin', u.searchParams.get('checkout'));
    t.check(Number(u.searchParams.get('group_adults')) > 0, 'group_adults set');
    t.check(u.searchParams.get('nflt')?.startsWith('price=TWD-'), 'price filter', u.searchParams.get('nflt'));
    const at = await page.evaluate(() => DAYS.slice(0, -1).map(d => d.spots.at(-1)));
    for(const [i, s] of at.entries()){
      const stay = new URL(await page.locator('.night').nth(i).locator('a', {hasText:'住宿'}).getAttribute('href'));
      t.eq(stay.searchParams.get('ss'), `${s.name}, Iceland`, `night ${i+1} centres on ${s.name}`);
    }
    for(const label of ['加油', '超市']){
      const g = await page.locator('.night').first().locator('a', {hasText:label}).getAttribute('href');
      t.check(g.startsWith('https://www.google.com/maps/search/'), `${label} stays on Google`);
    }
  });

  await t.step('roads arrive from OSRM and replace the straight lines', async () => {
    await page.waitForFunction(() => document.querySelector('[data-gap="0"]')?.textContent.includes('車程'), null, {timeout:60000});
    t.check((await page.evaluate(() => LINES.gap0.getLatLngs().length)) > 2, 'gap line follows the road');
  });

  await t.step('road cache is written and the reload makes no OSRM query', async () => {
    await page.waitForFunction(() => Object.keys(JSON.parse(localStorage.getItem(ROADS_KEY) || '{}')).length > 0, null, {timeout:120000});
    const before = t.requests.length;
    await page.reload();
    await mapReady(page);
    await page.waitForFunction(() => document.querySelector('[data-gap="0"]')?.textContent.includes('車程'));
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
    await page.locator('#btnAll').click();
    await infoTitle(page).filter({hasText:'全程路線'}).waitFor();
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

  await t.step('dead routing server: straight lines stay, no warning, page usable', async () => {
    page = await t.newPage({block:[OSRM]});
    await t.open('/');
    await mapReady(page);
    await page.waitForTimeout(1500);   // 給第一輪查詢失敗的時間
    t.eq(await page.evaluate(() => LINES.gap0.getLatLngs().length), 2, 'gap line still straight');
    t.check((await page.locator('[data-gap="0"]').innerText()).startsWith('直線'), 'label says straight-line');
    t.check(await page.locator('#routeWarn').isHidden(), 'no road warning');
    t.check(await page.locator('.nights .night').first().isVisible(), 'overview still rendered');
  });

  await t.step('route on an F-road raises the traveller warning', async () => {
    page = await t.newPage({fulfill:{[OSRM]:froadRoute}});
    await t.open('/');
    const warn = page.locator('#routeWarn');
    await warn.waitFor({state:'visible'});
    const text = await warn.innerText();
    t.check(text.includes('高地山路'), 'warning names the problem', text.slice(0, 40));
    t.check(!/OSRM|F\d/.test(text), 'no server or road numbers in the text');
  });

  await t.step('dead Leaflet CDN: message instead of a map, list still works', async () => {
    page = await t.newPage({block:[CDN, OSRM]});
    await t.open('/');
    await page.locator('#info .lead', {hasText:'地圖載入失敗'}).waitFor();
    t.check((await page.locator('.map-ph span').innerText()).includes('連不上'), 'placeholder message');
    t.eq(await page.locator('#dayList > li.day').count(), days.length, 'day list rendered');
  });
}
