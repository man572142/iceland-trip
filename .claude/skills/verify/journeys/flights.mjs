const OSRM = 'router.project-osrm.org';
const groups = label => Number(label.match(/（(\d+) 組）/)[1]);

export default async function(t){
  const page = await t.newPage({block:[OSRM]});
  await t.open('/');

  await t.step('機票方案 link from the itinerary', async () => {
    await page.locator('a.intro').click();
    await page.locator('h1', {hasText:'冰島機票方案'}).waitFor();
    t.check(new URL(page.url()).pathname.startsWith('/flights'), 'on the flights page', page.url());
    t.check(await page.locator('.confirmed .cf-legs').isVisible(), 'confirmed itinerary visible');
    t.check(await page.locator('.archive #cards').isHidden(), 'price archive starts closed');
  });

  await t.step('open the archive: default plan group', async () => {
    await page.locator('details.archive > summary').click();
    const btn = page.locator('#btnNew');
    t.eq(await btn.getAttribute('aria-pressed'), 'true', 'first group pressed');
    t.eq(await page.locator('#cards > li').count(), groups(await btn.innerText()), 'cards == count in the label');
  });

  await t.step('switch plan group', async () => {
    const btn = page.locator('#btnOld');
    await btn.click();
    t.eq(await btn.getAttribute('aria-pressed'), 'true', 'second group pressed');
    t.eq(await page.locator('#btnNew').getAttribute('aria-pressed'), 'false', 'first group released');
    t.eq(await page.locator('#cards > li').count(), groups(await btn.innerText()), 'cards == count in the label');
    const href = await page.locator('#cards .book-btn.primary').first().getAttribute('href');
    t.check(/google\.[^/]+\/travel\/flights/.test(href), 'Google Flights link', href);
  });

  await t.step('回行程地圖 returns to the map', async () => {
    await page.locator('a.nav-link').click();
    await page.locator('#dayList > li.day').first().waitFor();
    t.eq(new URL(page.url()).pathname, '/', 'on the itinerary');
  });
}
