import {infoTitle, mapReady, openSpot, placesReady, spotBtn} from './lib.mjs';

const OSRM = 'router.project-osrm.org';
const PHONE = {width:375, height:812};

// 行程裡第一個帶 nearby 的天、第一個帶 highlights 的景點
const readTargets = page => page.evaluate(() => {
  const i = DAYS.findIndex(d => d.nearby?.length);
  const h = DAYS.flatMap(d => d.spots).find(s => s.highlights);
  return {dayIdx:i, n:DAYS[i].n, nearby:DAYS[i].nearby, spot:{name:h.name, highlights:h.highlights}};
});
const dayOf = (page, i) => page.locator('#dayList > li.day').nth(i);
const noSideScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
// canvas 上的點沒有 DOM：讀 placeLayer 當下畫了哪些
const dotDrawn = (page, {lat, lng}) => page.evaluate(([la, ln]) =>
  placeLayer.getLayers().some(l => { const p = l.getLatLng(); return p.lat === la && p.lng === ln; }), [lat, lng]);
// 點落在地圖露出來的部分，沒被面板蓋住
const dotUncovered = (page, {lat, lng}) => page.evaluate(([la, ln]) => {
  const map = rmap.getContainer(), box = map.getBoundingClientRect(), p = rmap.latLngToContainerPoint([la, ln]);
  return map.contains(document.elementFromPoint(box.left + p.x, box.top + p.y));
}, [lat, lng]);
const settled = page => page.waitForTimeout(600);   // 手風琴與地圖動畫跑完，截圖與座標才準
// 只調整截圖取景：手機底部的把手會蓋住貼底的元素，scrollIntoViewIfNeeded 不夠
const toMiddle = async (page, loc) => { await settled(page); await loc.evaluate(el => el.scrollIntoView({block:'center'})); await settled(page); };

async function openDay(page, i){
  const head = dayOf(page, i).locator('.day-head');
  if(await head.getAttribute('aria-expanded') !== 'true') await head.click();
}

export default async function(t){
  /* ---------- 桌面 ---------- */
  let page = await t.newPage({block:[OSRM]});
  await t.open('/');
  await mapReady(page);
  await placesReady(page);
  const {dayIdx, n, nearby, spot} = await readTargets(page);
  const near = nearby[0];
  const day = dayOf(page, dayIdx);
  const toggle = day.locator('.near-toggle');
  const item = day.locator(`.near-item[data-k="${near.wd}"]`);
  await page.waitForTimeout(800);   // 開場的 fitBounds 跑完

  await t.step('day collapsed row: one quiet line, nothing revealed', async () => {
    await openDay(page, dayIdx);
    await toMiddle(page, toggle);
    t.eq(await toggle.innerText(), `附近還有 ${nearby.length} 處`, 'row label');
    t.eq(await toggle.getAttribute('aria-expanded'), 'false', 'collapsed by default');
    t.check(!(await item.isVisible()), 'items hidden while collapsed');
    t.eq(await page.locator('#dayList .near-toggle').count(),
      await page.evaluate(() => DAYS.filter(d => d.nearby?.length).length), 'a row only on days with nearby');
    const look = await toggle.evaluate(el => {
      const s = getComputedStyle(el), r = el.getBoundingClientRect();
      return {font:s.fontSize, bg:s.backgroundColor, border:s.borderTopWidth, h:r.height};
    });
    t.eq(look.font, '11px', 'smallest type step');
    t.eq(look.bg, 'rgba(0, 0, 0, 0)', 'no fill');
    t.eq(look.border, '0px', 'no border');
    t.check(look.h <= 32, 'one line tall', look.h);
    const order = await day.evaluate(el => {
      const body = el.querySelector('.day-body-pad');
      return [...body.children].map(c => c.className);
    });
    t.eq(order.at(-1), 'nearby', 'after the spots, last in the day');
    t.check(!(await page.evaluate(([la, ln]) =>
      [...MARKERS.values()].some(m => { const p = m.getLatLng(); return p.lat === la && p.lng === ln; }), [near.lat, near.lng])),
      'no route marker for the nearby item');
  });

  await t.step('expand with the keyboard: name, zh and why, not clipped', async () => {
    await toggle.focus();
    await page.keyboard.press('Enter');
    t.eq(await toggle.getAttribute('aria-expanded'), 'true', 'aria-expanded');
    await item.waitFor({state:'visible'});
    const text = await item.innerText();
    for(const k of ['name', 'zh', 'why']) t.check(text.includes(near[k]), `shows ${k}`, near[k]);
    t.eq(await toggle.getAttribute('aria-controls'), await day.locator('.near-list').getAttribute('id'), 'controls its list');
    await settled(page);
    const clip = await item.evaluate(el => {
      const r = el.getBoundingClientRect(), box = el.closest('.day-body-inner').getBoundingClientRect();
      return r.bottom <= box.bottom + .5;
    });
    t.check(clip, 'nests in the day accordion: the day body grows to fit');
    t.eq(await day.locator('.day-head').getAttribute('aria-expanded'), 'true', 'day stays open');
    await page.keyboard.press('Enter');
    t.eq(await toggle.getAttribute('aria-expanded'), 'false', 'Enter collapses');
    await page.keyboard.press('Enter');
    await toMiddle(page, item);
  });

  await t.step('click the item: candidate panel with Wikipedia, why and day picker', async () => {
    const before = await page.evaluate(() => rmap.getCenter());
    await item.click();
    await infoTitle(page).filter({hasText:near.name}).waitFor();
    t.eq(await page.locator('#info .i-zh').first().innerText(), near.zh, 'zh matches the row');
    t.check(await page.locator('#info .badge', {hasText:'不在行程裡'}).isVisible(), 'candidate badge');
    t.check((await page.locator('#info .i-facts dd').innerText()).includes(near.why), 'why in the panel');
    await page.waitForFunction(() => !document.querySelector('#sumDesc.wait'), null, {timeout:15000});
    t.check(await page.locator('#sumDesc a.src').count() === 1, 'Wikipedia intro with source link');
    t.check(await page.locator('#planGo').isEnabled(), '加入這天 available');
    t.check((await page.locator('#planDay option').count()) > 0, 'day picker');
    await settled(page);
    const after = await page.evaluate(() => rmap.getCenter());
    t.check(after.lat !== before.lat || after.lng !== before.lng, 'map moved');
    t.check(await dotUncovered(page, near), 'marker not covered by the panel');
    t.eq(await page.locator('.pop-h').innerText(), near.name, 'popup names it');
    t.check(await dotDrawn(page, near), 'marker drawn while the panel is open');
  });

  await t.step('zoom out past MIN_SL thinning: marker stays while the panel is open', async () => {
    const sl = await page.evaluate(k => POOL.get(k).place.sl ?? -1, near.wd);
    while(await page.evaluate(s => MIN_SL(rmap.getZoom()) <= s, sl)){
      const z = await page.evaluate(() => rmap.getZoom());
      await page.locator('.leaflet-control-zoom-out').click();
      await page.waitForFunction(z0 => rmap.getZoom() < z0, z);
      await settled(page);
    }
    t.check(await dotDrawn(page, near), 'still drawn below its sitelink threshold');
    await page.evaluate(() => showHome());
    await settled(page);
    t.eq(await page.evaluate(k => MIN_SL(rmap.getZoom()) > (POOL.get(k).place.sl ?? -1), near.wd) && await dotDrawn(page, near), false,
      'leaving the panel returns it to normal thinning');
  });

  await t.step('add it to the draft: leaves 附近還有', async () => {
    await openDay(page, dayIdx);
    if(await item.isHidden()) await toggle.click();
    await item.click();
    await infoTitle(page).filter({hasText:near.name}).waitFor();
    await page.locator('#planDay').selectOption(String(dayIdx));
    await page.locator('#planGo').click();
    await page.locator('#editN', {hasText:'1'}).waitFor();
    t.check(await page.locator('#planRm').isVisible(), 'panel now treats it as a planned spot');
    t.eq(await page.evaluate(() => JSON.parse(localStorage.getItem(EDITS_KEY))), [[near.wd, n]], 'stored draft');
    const row = dayOf(page, dayIdx);
    t.eq(await row.locator(`.near-item[data-k="${near.wd}"]`).count(), 0, 'gone from 附近還有');
    if(nearby.length === 1) t.eq(await row.locator('.near-toggle').count(), 0, 'row gone with its last item');
    t.check(await spotBtn(page, near.name).locator('.badge.draft', {hasText:'新增'}).count() === 1, '新增 badge in that day');
  });

  await t.step('draft survives a reload and stays out of 附近還有', async () => {
    await page.reload();
    await mapReady(page);
    await placesReady(page);
    await page.locator('#editN', {hasText:'1'}).waitFor();
    t.eq(await dayOf(page, dayIdx).locator(`.near-item[data-k="${near.wd}"]`).count(), 0, 'still gone');
  });

  await t.step('issue link: add{} and the day order', async () => {
    await page.locator('#btnEdits').click();
    t.eq(await page.locator('.change-k').allInnerTexts(), ['新增'], 'one 新增 row');
    // 只讀 href，絕不點 #sendIssue
    const u = new URL(await page.locator('#sendIssue').getAttribute('href'));
    const json = JSON.parse(u.searchParams.get('body').match(/```json\n(.*)\n```/s)[1]);
    const a = json.add[near.wd];
    t.eq([a?.name, a?.zh, a?.lat, a?.lng, a?.type], [near.name, near.zh, near.lat, near.lng, near.type], 'add{Qid} carries the place');
    t.eq(Object.keys(json.days), [String(n)], 'only that day touched');
    t.eq(json.days[n], await page.evaluate(i => DAYS[i].spots.map(keyOf), dayIdx), 'days{} == the page order');
    t.check(json.days[n].includes(near.wd), 'keyed by Q-id');
  });

  await t.step('undo brings it back to 附近還有', async () => {
    await page.locator('[data-undo]').first().click();
    t.eq(await dayOf(page, dayIdx).locator('.near-toggle').innerText(), `附近還有 ${nearby.length} 處`, 'row back');
    t.eq(await page.evaluate(() => JSON.parse(localStorage.getItem(EDITS_KEY))), [], 'draft empty');
  });

  await t.step('filter and search hide the row', async () => {
    await page.locator('#spotSearch').fill(spot.name);
    t.check(!(await dayOf(page, dayIdx).locator('.near-toggle').isVisible()), 'hidden while searching');
    await page.locator('#spotSearchClear').click();
    await page.locator('#onlyTodo').click();
    t.check(!(await dayOf(page, dayIdx).locator('.near-toggle').isVisible()), 'hidden while filtering');
    await page.locator('#onlyTodo').click();
  });

  await t.step('highlights: on the spot panel, absent from the day list', async () => {
    const hl = spot.highlights;
    const listText = await page.locator('#dayList').evaluate(el => el.textContent);
    for(const h of hl) t.check(!listText.includes(h.t), 'not in the day list', h.t);
    const markers = await page.evaluate(() => MARKERS.size);
    await openSpot(page, spot.name);
    await infoTitle(page).filter({hasText:spot.name}).waitFor();
    const rows = page.locator('#info .i-highs li');
    t.eq(await rows.count(), hl.length, 'one row per highlight');
    for(const [i, h] of hl.entries()){
      const text = await rows.nth(i).innerText();
      t.check(text.includes(h.t) && text.includes(h.d), 'name and sentence', h.t);
      if(h.min) t.check(await rows.nth(i).locator('.min').count() === 1, 'minutes', h.min);
    }
    t.eq(await page.evaluate(() => MARKERS.size), markers, 'no extra map markers');
    t.check(await page.locator('#info .i-desc + .i-highs').count() === 1, 'directly under the description');
    await page.locator('#info .i-highs').scrollIntoViewIfNeeded();
    await settled(page);
  });

  /* ---------- 手機 ---------- */
  page = await t.newPage({viewport:PHONE, block:[OSRM]});
  await t.open('/');
  await mapReady(page);
  await placesReady(page);
  const pDay = dayOf(page, dayIdx);
  const pToggle = pDay.locator('.near-toggle');
  const pItem = pDay.locator(`.near-item[data-k="${near.wd}"]`);

  await t.step('phone: collapsed row', async () => {
    await page.locator('#collapseBtn').click();   // 底部面板收起來才看得到列表
    await openDay(page, dayIdx);
    await toMiddle(page, pToggle);
    t.eq(await pToggle.getAttribute('aria-expanded'), 'false', 'collapsed');
    t.check(await noSideScroll(page), 'no horizontal scroll');
  });

  await t.step('phone: expanded row', async () => {
    await pToggle.click();
    await pItem.waitFor({state:'visible'});
    await toMiddle(page, pItem);
    t.check(await noSideScroll(page), 'no horizontal scroll');
  });

  await t.step('phone: candidate panel, top', async () => {
    await pItem.click();
    await infoTitle(page).filter({hasText:near.name}).waitFor();
    await page.waitForFunction(() => !document.querySelector('#sumDesc.wait'), null, {timeout:15000});
    await settled(page);
    t.check(await page.evaluate(() => document.body.classList.contains('spot-on')), 'full-screen panel');
    t.check(await dotDrawn(page, near), 'marker drawn');
    t.check(await dotUncovered(page, near), 'marker not covered by the panel');
    t.check(await noSideScroll(page), 'no horizontal scroll');
  });

  await t.step('phone: candidate panel, why and day picker', async () => {
    t.check(await page.locator('#info .i-facts dd').isVisible(), 'why visible');
    t.check(await page.locator('#planDay').isVisible(), 'day picker visible');
    await page.locator('#info .i-facts').scrollIntoViewIfNeeded();
    await settled(page);
    t.check(await noSideScroll(page), 'no horizontal scroll');
    t.check(await page.evaluate(() => { const s = document.querySelector('.stage'); return s.scrollWidth <= s.clientWidth; }), 'panel does not scroll sideways');
  });

  await t.step('phone: highlights panel', async () => {
    await page.locator('#collapseBtn').click();
    await openSpot(page, spot.name);
    await infoTitle(page).filter({hasText:spot.name}).waitFor();
    await page.locator('#info .i-highs').scrollIntoViewIfNeeded();
    await settled(page);
    t.check(await page.locator('#info .i-highs').isVisible(), 'highlights visible');
    t.check(await noSideScroll(page), 'no horizontal scroll');
    t.check(await page.evaluate(() => { const s = document.querySelector('.stage'); return s.scrollWidth <= s.clientWidth; }), 'panel does not scroll sideways');
  });
}
