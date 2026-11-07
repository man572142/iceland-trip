import {listNames, mapReady, placesReady, readDays, infoTitle, openSpot, pickSpot, pickCandidate, spotBtn} from './lib.mjs';

const OSRM = 'router.project-osrm.org';
const edits = page => page.evaluate(() => JSON.parse(localStorage.getItem(EDITS_KEY) || '[]'));

// 任何一個不被路線線條蓋住的灰點，回傳視窗座標：點的是 canvas，只能用像素
const openDot = page => page.evaluate(() => {
  const min = MIN_SL(rmap.getZoom()), box = rmap.getContainer().getBoundingClientRect(), view = rmap.getBounds();
  for(const [, e] of POOL){
    if(!e.place || (e.spot && PLANNED.has(e.spot)) || (e.place.sl ?? 0) < min) continue;
    const ll = [e.place.lat, e.place.lng];
    if(!view.contains(ll)) continue;
    const p = rmap.latLngToContainerPoint(ll), x = box.left + p.x, y = box.top + p.y;
    if(document.elementFromPoint(x, y)?.tagName === 'CANVAS') return {x, y};
  }
  return null;
});

export default async function(t){
  const page = await t.newPage({block:[OSRM]});
  await t.open('/');
  await mapReady(page);
  await placesReady(page);
  const base = await listNames(page);
  const days = await readDays(page);
  const removed = pickSpot(days, {minSpots:3});
  const moved = pickSpot(days, {minDay:removed.day + 1, minSpots:3});
  const movedTo = [1, 2, 3, 4].find(i => i !== removed.day && i !== moved.day);
  const cand = await pickCandidate(page);

  await t.step('no draft yet: 更新行程 disabled', async () => {
    t.check(await page.locator('#btnEdits').isDisabled(), 'button disabled');
    t.eq(await edits(page), [], 'nothing stored');
  });

  await t.step('click a grey dot on the map', async () => {
    await page.waitForTimeout(800);   // fitBounds 動畫結束、灰點重畫後座標才準
    const pt = await openDot(page);
    t.check(pt, 'an uncovered candidate dot exists at this zoom');
    await page.mouse.click(pt.x, pt.y);
    await page.locator('#info .badge', {hasText:'不在行程裡'}).waitFor();
    t.check(await page.locator('#planGo').isEnabled(), '加入這天 available');
  });

  await t.step(`remove ${removed.name}`, async () => {
    await openSpot(page, removed.name);
    await page.locator('#planRm').click();
    await page.locator('#info .badge', {hasText:'已從行程移除'}).waitFor();
    t.check(!(await listNames(page))[removed.day].includes(removed.name), 'gone from the list');
    t.eq(await page.locator('#editN').innerText(), '1', 'draft count');
    t.check(await page.locator('#dayList > li.day').nth(removed.day).locator('.chip.draft', {hasText:'已修改'}).isVisible(), '已修改 chip on that day');
    t.eq((await edits(page)).at(-1)[1], 0, 'stored as day 0');
  });

  await t.step(`move ${moved.name} to Day ${movedTo + 1}`, async () => {
    await openSpot(page, moved.name);
    t.check(await page.locator('#planGo').isDisabled(), '移到這天 waits for a different day');
    await page.locator('#planDay').selectOption(String(movedTo));
    await page.locator('#planGo').click();
    await page.locator('#editN', {hasText:'2'}).waitFor();
    const now = await listNames(page);
    t.check(now[movedTo].includes(moved.name), 'in the new day');
    t.check(!now[moved.day].includes(moved.name), 'out of the old day');
    t.check(await spotBtn(page, moved.name).locator('.badge.draft', {hasText:'移入'}).count() === 1, '移入 badge');
  });

  await t.step(`add candidate ${cand.name} via search`, async () => {
    await page.locator('#spotSearch').fill(cand.name);
    await page.locator(`#poolHits [data-k="${cand.k}"]`).click();
    await page.locator('#info .badge', {hasText:'不在行程裡'}).waitFor();
    const summary = page.locator('#sumDesc');
    await page.waitForFunction(() => !document.querySelector('#sumDesc.wait'), null, {timeout:15000});
    t.check((await summary.innerText()).length > 0, 'Wikipedia intro loaded');
    await page.locator('#planGo').click();
    await page.locator('#editN', {hasText:'3'}).waitFor();
    await page.locator('#spotSearchClear').click();
    t.check(await spotBtn(page, cand.name).locator('.badge.draft', {hasText:'新增'}).count() === 1, '新增 badge in the list');
  });

  const drafted = await listNames(page);
  await t.step('draft survives a reload', async () => {
    await page.reload();
    await mapReady(page);
    await placesReady(page);
    await page.locator('#editN', {hasText:'3'}).waitFor();
    t.eq(await listNames(page), drafted, 'same list after reload');
  });

  await t.step('更新行程 lists the changes; issue link matches the draft', async () => {
    await page.locator('#btnEdits').click();
    t.eq(await infoTitle(page).innerText(), '更新行程', 'panel');
    t.eq(await page.locator('.change').count(), 3, 'three rows');
    t.eq(await page.locator('.change .change-k').allInnerTexts(), ['移除', '換天', '新增'], 'kinds in order');
    // 只讀 href，絕不點 #sendIssue
    const href = await page.locator('#sendIssue').getAttribute('href');
    const u = new URL(href);
    t.eq(u.origin + u.pathname, 'https://github.com/man572142/iceland-trip/issues/new', 'issue endpoint');
    t.check(u.searchParams.get('title').startsWith('[行程更新]'), 'title prefix the workflow matches', u.searchParams.get('title'));
    const json = JSON.parse(u.searchParams.get('body').match(/```json\n(.*)\n```/s)[1]);
    t.eq(json.v, 1, 'payload version');
    t.check(json.add[cand.k]?.name === cand.name, 'candidate in add{}');
    const page_days = await page.evaluate(ns => ns.map(n => DAYS_CCW[n - 1].spots.map(keyOf)), Object.keys(json.days));
    t.eq(Object.values(json.days), page_days, 'days{} == the page\'s full order');
  });

  await t.step('復原 one change', async () => {
    await page.locator('[data-undo]').first().click();
    t.eq(await page.locator('.change').count(), 2, 'two rows');
    t.check((await listNames(page))[removed.day].includes(removed.name), 'removed spot back');
  });

  await t.step('全部捨棄 restores the deployed plan', async () => {
    page.once('dialog', d => d.accept());
    await page.locator('#dropEdits').click();
    await infoTitle(page).filter({hasText:'全程路線'}).waitFor();
    t.eq(await listNames(page), base, 'list == baseline');
    t.check(await page.locator('#btnEdits').isDisabled(), 'button disabled again');
    t.eq(await edits(page), [], 'storage emptied');
  });
}
