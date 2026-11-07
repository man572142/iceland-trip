import {mapReady, readDays, infoTitle, openSpot, pickSpot, spotBtn} from './lib.mjs';

const OSRM = 'router.project-osrm.org';

export default async function(t){
  let page = await t.newPage({block:[OSRM]});
  await t.open('/');
  await mapReady(page);
  const days = await readDays(page);
  const spot = pickSpot(days);

  await t.step(`click ${spot.name} in the list`, async () => {
    await openSpot(page, spot.name);
    t.eq(await infoTitle(page).innerText(), spot.name, 'panel title');
    t.eq(await page.locator('#info .i-zh').first().innerText(), spot.zh, 'chinese name');
    t.eq(await page.locator('#stageCur').innerText(), spot.name, 'stage handle');
    t.check(await spotBtn(page, spot.name).evaluate(b => b.classList.contains('active')), 'list row active');
    t.check(/全程第 \d+／\d+/.test(await page.locator('#info .badge.seq').innerText()), 'homogeneity counter');
    t.check(await page.locator('#info .i-desc').isVisible(), 'description visible');
    const pop = page.locator('.leaflet-popup-content .pop-h');
    await pop.waitFor({state:'visible'});
    t.eq(await pop.innerText(), spot.name, 'map popup opens on the same spot');
    const gmap = await page.locator('#info .i-gmap').getAttribute('href');
    t.check(gmap.startsWith('https://www.google.com/maps/search/'), 'Google Maps link', gmap);
  });

  let shots = 0;
  await t.step('photos load live from Wikimedia', async () => {
    // 不是每個景點都找得到照片（那是 .gal-msg 的正常狀態）：往下點到第一個有照片的
    const names = days.flatMap(d => d.spots).filter(s => s.type !== 'transit').map(s => s.name);
    for(const name of names.slice(0, 15)){
      await openSpot(page, name);
      await page.waitForFunction(() => !document.querySelector('#gal .skel'), null, {timeout:30000});
      shots = await page.locator('#gal .shot').count();
      if(shots) break;
    }
    t.check(shots > 0, 'a spot among the first 15 shows photos');
    await page.waitForFunction(() => [...document.querySelectorAll('#gal .shot img')].some(i => i.complete && i.naturalWidth > 0), null, {timeout:30000});
    const src = await page.locator('#gal .shot img').first().getAttribute('src');
    t.check(/wikimedia\.org|wikipedia\.org/.test(src), 'image comes from Wikimedia', src);
  });

  await t.step('lightbox opens, steps, closes with Escape', async () => {
    const opener = page.locator('#gal .shot').first();
    await opener.click();
    t.check(await page.locator('#lb').evaluate(e => e.classList.contains('on')), 'lightbox open');
    if(shots > 1){
      const cap = await page.locator('#lbCap').innerText();
      await page.locator('#lbNext').click();
      t.check(await page.locator('#lbCap').innerText() !== cap, 'next changes the caption');
    }
    await page.keyboard.press('Escape');
    t.check(await page.locator('#lb').evaluate(e => !e.classList.contains('on')), 'lightbox closed');
    t.check(await opener.evaluate(e => e === document.activeElement), 'focus back on the photo');
  });

  await t.step('click a day pin on the map', async () => {
    await page.locator('#btnAll').click();
    await infoTitle(page).filter({hasText:'全程路線'}).waitFor();
    await page.waitForTimeout(600);   // fitBounds 動畫結束前圖釘還在移動
    const i = Math.floor(days.length / 2);
    const end = days[i].spots.at(-1).name;
    await page.locator(`.leaflet-marker-icon[title="DAY ${days[i].n} ${end}"]`).click();
    t.eq(await infoTitle(page).innerText(), end, 'panel shows that day\'s last stop');
    t.check(await page.locator('body').evaluate(b => b.classList.contains('spot-on')), 'spot view');
  });

  await t.step('全覽 returns to the overview', async () => {
    await page.locator('#btnAll').click();
    await infoTitle(page).filter({hasText:'全程路線'}).waitFor();
    t.eq(await page.locator('.spot.active').count(), 0, 'no active row');
  });

  await t.step('Wikimedia unreachable: failure message with an image-search link', async () => {
    page = await t.newPage({block:[OSRM, 'en.wikipedia.org', 'commons.wikimedia.org']});
    await t.open('/');
    await mapReady(page);
    await openSpot(page, spot.name);
    const msg = page.locator('#gal .gal-msg');
    await msg.waitFor({state:'visible', timeout:30000});
    t.eq(await msg.locator('b').innerText(), '照片載入失敗', 'failure text');
    t.check((await msg.locator('a').getAttribute('href')).startsWith('https://www.google.com/search?tbm=isch'), 'Google Images link');
  });

  await t.step('phone width: bottom sheet collapses and expands', async () => {
    page = await t.newPage({viewport:{width:390, height:844}, block:[OSRM]});
    await t.open('/');
    await mapReady(page);
    await openSpot(page, spot.name);
    t.eq(await page.locator('#stageCur').innerText(), spot.name, 'handle names the spot');
    await page.locator('#collapseBtn').click();
    t.check(await page.locator('body').evaluate(b => b.classList.contains('stage-collapsed')), 'collapsed');
    t.eq(await page.locator('#collapseLabel').innerText(), '展開', 'label');
    await page.locator('#collapseBtn').click();
    t.eq(await page.locator('#collapseLabel').innerText(), '收合', 'label back');
    t.eq(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal page scroll');
  });
}
