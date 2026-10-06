import {test, expect} from '@playwright/test';

test.use({serviceWorkers: 'allow'});
test('saved application works after the network is lost', async ({page, context}) => {
    await page.route('https://tile.openstreetmap.org/**', route => route.abort());
    await page.goto('/');
    await expect(page.locator('#loading')).toBeHidden();
    await page.getByRole('button',{name:'Dismiss introduction',exact:true}).click();
    await expect(page.locator('#snapshot-status')).toContainText('Local snapshot ready', {timeout: 20000});
    await page.reload();
    await expect(page.locator('#loading')).toBeHidden();
    await page.getByRole('button',{name:'Dismiss introduction',exact:true}).click();
    const initial = await page.locator('#stat-obs').textContent();
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('#loading')).toBeHidden();
    await page.getByRole('button',{name:'Dismiss introduction',exact:true}).click();
    await expect(page.locator('#stat-obs')).toHaveText(initial);
    await expect(page.locator('#snapshot-status')).toContainText('Offline');
    await expect(page.locator('.turbine-marker')).toHaveCount(62);
    await expect(page.locator('.leaflet-overlay-pane path.leaflet-interactive').first()).toBeAttached();
    await page.selectOption('#species-filter', 'red-list');
    await expect(page.locator('#stat-obs')).not.toHaveText(initial);
    await page.evaluate(() => document.querySelector('.turbine-marker').click());
    await page.getByRole('button', {name: 'Explore flight overlap'}).click();
    await expect(page.locator('#park-diagram svg')).toBeVisible();
    const cachedExternal = await page.evaluate(async () => {
        const keys = await caches.keys();
        const urls = (await Promise.all(keys.map(async key => (await (await caches.open(key)).keys()).map(r => r.url)))).flat();
        return urls.filter(url => !url.startsWith(location.origin));
    });
    expect(cachedExternal).toEqual([]);
});
