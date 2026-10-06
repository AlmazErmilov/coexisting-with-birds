import {test, expect} from '@playwright/test';

test.beforeEach(async ({page}) => {
    await page.route('https://tile.openstreetmap.org/**', route => route.abort());
    await page.goto('/');
    await expect(page.locator('#loading')).toBeHidden();
    await page.getByRole('button',{name:'Dismiss introduction',exact:true}).click();
});
for (const width of [390, 1145]) {
    test(`complete altitude drawing fits at ${width}px`, async ({page}) => {
        await page.setViewportSize({width, height:900});
        if (width === 390) await page.locator('#panel-toggle').click();
        await page.locator('.leaflet-overlay-pane path.leaflet-interactive').first().click({force:true});
        await expect(page.locator('#kommune-diagram svg')).toBeVisible();
        const drawing = await page.locator('#kommune-diagram .flight-diagram__scroll').evaluate(element => ({width:element.clientWidth, content:element.scrollWidth}));
        expect(drawing.content).toBeLessThanOrEqual(drawing.width + 1);
        const svg = await page.locator('#kommune-diagram svg').boundingBox();
        const modal = await page.locator('.kommune-modal').boundingBox();
        expect(svg.x).toBeGreaterThanOrEqual(modal.x);
        expect(svg.x + svg.width).toBeLessThanOrEqual(modal.x + modal.width);
    });
}

test('city names appear above heat and point layers', async ({page}) => {
    await expect(page.locator('.city-label').first()).toBeVisible();
    const pane = await page.locator('.leaflet-cityLabels-pane').evaluate(element => Number(getComputedStyle(element).zIndex));
    expect(pane).toBeGreaterThan(600);
    await page.getByRole('button',{name:'Points',exact:true}).click();
    await expect(page.locator('.city-label').first()).toBeVisible();
});

test('bird information is one click away and can filter the map', async ({page}) => {
    const first = page.locator('.species-row [data-bird-details]').first();
    const species = await first.getAttribute('data-bird-details');
    await first.click();
    await expect(page.locator('#bird-modal')).toHaveClass(/open/);
    await expect(page.locator('#bird-card .bird-thumbnail')).toBeVisible();
    await expect(page.locator('#bird-card')).toContainText('records in sample');
    await expect(page.locator('.bird-months')).toHaveAttribute('aria-label',/January/);
    await page.getByRole('button',{name:'Show this bird on the map'}).click();
    await expect(page.locator('#species-filter')).toHaveValue(species);
    await expect(page.locator('.modal-overlay.open')).toHaveCount(0);
});

test('search metadata, source page and social preview are available', async ({page,request}) => {
    await expect(page).toHaveTitle(/Norway bird map/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','https://coexisting-with-birds.no/');
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content',/og-image.jpg$/);
    const schema = await page.locator('script[type="application/ld+json"]').textContent();
    expect(JSON.parse(schema).dateModified).toBe('2026-10-06');
    for (const path of ['/about.html','/assets/og-image.jpg','/robots.txt','/sitemap.xml']) {
        const response = await request.get(path);
        expect(response.ok(),path).toBe(true);
    }
    await page.goto('/about.html');
    await expect(page.getByRole('heading',{level:1})).toHaveText('About the Norway bird map');
    await expect(page.getByRole('link',{name:'← Explore the map'})).toBeVisible();
});

for (const width of [390, 1145]) {
    test(`flight intro fills the viewport and stays open on replay at ${width}px`, async ({page}) => {
        await page.setViewportSize({width,height:844});
        await page.getByRole('button',{name:'Replay flight introduction'}).click();
        const card = page.locator('.flight-intro__card');
        await expect(card).toBeVisible();
        const box = await card.boundingBox();
        expect(box.x).toBe(0); expect(box.y).toBe(0);
        expect(box.width).toBe(width); expect(box.height).toBe(844);
        await expect(page.locator('#map')).toHaveAttribute('inert','');
        await page.getByRole('button',{name:'Explore the map ↗'}).press('Tab');
        await expect(page.getByRole('button',{name:'Dismiss introduction'})).toBeFocused();
        // The opening sequence is automatic; an explicit replay has no timeout.
        await page.waitForTimeout(8500);
        await expect(card).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(card).toBeHidden();
        await expect(page.locator('#map')).not.toHaveAttribute('inert','');
    });
}
