import {listNames, readDays, spotBtn, placesReady, pickSpot, pickCandidate, infoTitle} from './lib.mjs';

const OSRM = 'router.project-osrm.org';

export default async function(t){
  const page = await t.newPage({block:[OSRM]});
  await t.open('/');
  const days = await readDays(page);
  const total = days.reduce((n, d) => n + d.spots.length, 0);
  const heads = page.locator('#dayList .day-head');

  await t.step('list renders every day and spot; only Day 1 open', async () => {
    const names = await listNames(page);
    t.eq(names, days.map(d => d.spots.map(s => s.name)), 'list matches DAYS');
    t.eq(await page.locator('#dayCount').innerText(), `${days.length} 天 · ${total} 個地點`, 'header count');
    t.eq(await heads.evaluateAll(hs => hs.map(h => h.getAttribute('aria-expanded') === 'true').map((o, i) => o === (i === 0)).every(Boolean)), true, 'only Day 1 expanded');
  });

  await t.step('expand a day: note and budget row visible', async () => {
    await heads.nth(1).click();
    t.eq(await heads.nth(1).getAttribute('aria-expanded'), 'true', 'aria-expanded');
    const body = page.locator('#dayList > li.day').nth(1);
    await body.locator('.day-note').waitFor({state:'visible'});
    t.check(await body.locator('.budget').isVisible(), 'budget row visible');
  });

  await t.step('全部展開 then 全部收合', async () => {
    await page.locator('#toggleAll').click();
    t.eq(await page.locator('#toggleAllLabel').innerText(), '全部收合', 'label flips');
    t.eq(await page.locator('#dayList > li.day.open').count(), days.length, 'all open');
    await page.locator('#toggleAll').click();
    t.eq(await page.locator('#toggleAllLabel').innerText(), '全部展開', 'label flips back');
    t.eq(await page.locator('#dayList > li.day.open').count(), 0, 'all closed');
  });

  await t.step('只看待決定 shows exactly the undecided spots', async () => {
    const todo = days.flatMap(d => d.spots.filter(s => s.todo).map(s => s.name));
    await page.locator('#onlyTodo').click();
    t.eq(await page.locator('#onlyTodo').getAttribute('aria-pressed'), 'true', 'pressed');
    t.check((await page.locator('#dayCount').innerText()).startsWith(`${todo.length} 個待決定`), 'count text', await page.locator('#dayCount').innerText());
    const shown = await page.locator('#dayList .spot-name:visible').evaluateAll(ns => ns.map(n => n.firstChild.textContent.trim()));
    t.eq(shown, todo, 'visible spots == opt/book minus fixed');
    await page.locator('#onlyTodo').click();
  });

  const target = pickSpot(days);
  await t.step(`search hits a planned spot (${target.zh})`, async () => {
    await page.locator('#spotSearch').fill(target.zh);
    t.check(await spotBtn(page, target.name).isVisible(), 'matching spot visible');
    t.check((await page.locator('#dayCount').innerText()).startsWith('找到'), 'count reports matches');
    t.check(await page.locator('#spotSearchClear').isVisible(), 'clear button visible');
  });

  await t.step('search miss shows the empty state', async () => {
    await page.locator('#spotSearch').fill('zzzqqq');
    await page.locator('#noResults').waitFor({state:'visible'});
    t.eq(await page.locator('#noResults').innerText(), '沒有符合的景點', 'empty text');
  });

  await placesReady(page);
  const cand = await pickCandidate(page);
  await t.step(`search finds an unplanned candidate (${cand.name}) and opens it`, async () => {
    await page.locator('#spotSearch').fill(cand.name);
    const hit = page.locator(`#poolHits [data-k="${cand.k}"]`);
    await hit.waitFor({state:'visible'});
    await hit.click();
    t.eq(await infoTitle(page).innerText(), cand.name, 'panel shows candidate');
    t.check(await page.locator('#info .badge', {hasText:'不在行程裡'}).isVisible(), '不在行程裡 badge');
  });

  await t.step('clear restores the full list', async () => {
    await page.locator('#spotSearchClear').click();
    t.eq(await page.locator('#spotSearch').inputValue(), '', 'input empty');
    t.eq(await page.locator('#dayCount').innerText(), `${days.length} 天 · ${total} 個地點`, 'full count back');
    t.check(await page.locator('#poolHits').isHidden(), 'pool hits hidden');
  });
}
