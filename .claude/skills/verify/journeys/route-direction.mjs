import {listNames, mapReady, infoTitle, openSpot, readDays, pickSpot} from './lib.mjs';

const OSRM = 'router.project-osrm.org';
const btn = (page, d) => page.locator(`.dir-switch button[data-dir="${d}"]`);

export default async function(t){
  const page = await t.newPage({block:[OSRM]});
  await t.open('/');
  await mapReady(page);
  const cw = await listNames(page);

  await t.step('fresh visitor gets clockwise', async () => {
    t.eq(await btn(page, 'cw').getAttribute('aria-pressed'), 'true', '順時針 pressed');
    t.check((await page.locator('#region').innerText()).startsWith('西部半島'), 'region text', await page.locator('#region').innerText());
    const last = cw[1].at(-1);
    await page.locator(`.leaflet-marker-icon[title="DAY 2 ${last}"]`).waitFor({state:'attached'});
    t.check(true, 'Day 2 pin at the clockwise end of that day');
  });

  await t.step('select a spot, then switch to counter-clockwise', async () => {
    const spot = pickSpot(await readDays(page));
    await openSpot(page, spot.name);
    t.eq(await infoTitle(page).innerText(), spot.name, 'spot panel open');
    await btn(page, 'ccw').click();
    t.eq(await btn(page, 'ccw').getAttribute('aria-pressed'), 'true', '逆時針 pressed');
    t.check((await page.locator('#region').innerText()).startsWith('南岸'), 'region text changes');
    t.eq(await infoTitle(page).innerText(), '全程路線', 'right panel back to overview');
    t.check((await page.locator('#info .i-zh').first().innerText()).includes('逆時針'), 'overview names the direction');
    t.eq(await page.evaluate(() => localStorage.getItem(DIR_KEY)), 'ccw', 'direction stored');
  });

  const ccw = await listNames(page);
  await t.step('counter-clockwise mirrors clockwise', async () => {
    const n = cw.length;
    t.eq(ccw.length, n, 'same day count');
    const shared = i => i === 0 || i >= n - 2;
    cw.forEach((names, i) => {
      if(shared(i)) t.eq(ccw[i], names, `Day ${i + 1} shared`);
      else t.eq([...ccw[n - 2 - i]].reverse(), names, `cw Day ${i + 1} == reversed ccw Day ${n - 1 - i}`);
    });
    const last = ccw[1].at(-1);
    await page.locator(`.leaflet-marker-icon[title="DAY 2 ${last}"]`).waitFor({state:'attached'});
    t.check(true, 'map pins redrawn for the new order');
    t.eq(await page.locator('.day-pin').count(), n, 'one pin per day');
  });

  await t.step('direction survives a reload', async () => {
    await page.reload();
    await mapReady(page);
    t.eq(await btn(page, 'ccw').getAttribute('aria-pressed'), 'true', '逆時針 still pressed');
    t.eq(await listNames(page), ccw, 'list still counter-clockwise');
  });

  await t.step('switch back to clockwise', async () => {
    await btn(page, 'cw').click();
    t.eq(await listNames(page), cw, 'list identical to the first load');
    t.eq(await page.evaluate(() => localStorage.getItem(DIR_KEY)), 'cw', 'direction stored');
  });
}
