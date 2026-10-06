import { test, expect } from '@playwright/test';

test.describe('Coexisting with Birds', () => {
    test.beforeEach(async ({ page }) => {
        // Automated tests never fetch the community tile service.
        await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({
            contentType: 'image/png',
            body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=', 'base64')
        }));
        await page.route('**/_vercel/**', route => route.fulfill({contentType: 'text/javascript', body: ''}));
        await page.goto('/');
        // Wait for data to load (loading indicator disappears)
        await expect(page.locator('#loading')).toBeHidden({ timeout: 15000 });
        await page.getByRole('button',{name:'Dismiss introduction',exact:true}).click();
    });

    test('page loads with data', async ({ page }) => {
        // Stats show non-zero values
        const obsText = await page.locator('#stat-obs').textContent();
        expect(Number(obsText.replace(/,/g, ''))).toBeGreaterThan(0);

        const speciesText = await page.locator('#stat-species').textContent();
        expect(Number(speciesText)).toBeGreaterThan(0);
    });

    test('species filter reduces observations', async ({ page }) => {
        const initialObs = await page.locator('#stat-obs').textContent();
        const initial = Number(initialObs.replace(/,/g, ''));

        // Select red list filter
        await page.selectOption('#species-filter', 'red-list');
        const filteredObs = await page.locator('#stat-obs').textContent();
        const filtered = Number(filteredObs.replace(/,/g, ''));

        expect(filtered).toBeLessThan(initial);
        expect(filtered).toBeGreaterThan(0);
    });

    test('month slider filters by month', async ({ page }) => {
        const initialObs = await page.locator('#stat-obs').textContent();
        const initial = Number(initialObs.replace(/,/g, ''));

        // Set to January (value 1)
        await page.locator('#month-slider').fill('1');
        await page.locator('#month-slider').dispatchEvent('input');

        const monthLabel = await page.locator('#month-label').textContent();
        expect(monthLabel).toBe('January');

        const filteredObs = await page.locator('#stat-obs').textContent();
        const filtered = Number(filteredObs.replace(/,/g, ''));
        expect(filtered).toBeLessThan(initial);
    });

    test('view toggle switches between heatmap and points', async ({ page }) => {
        // Start in heatmap view
        await expect(page.locator('.view-btn[data-view="heatmap"]')).toHaveClass(/active/);

        // Switch to points
        await page.locator('.view-btn[data-view="points"]').click();
        await expect(page.locator('.view-btn[data-view="points"]')).toHaveClass(/active/);
        await expect(page.locator('.view-btn[data-view="heatmap"]')).not.toHaveClass(/active/);

        // Switch back to heatmap
        await page.locator('.view-btn[data-view="heatmap"]').click();
        await expect(page.locator('.view-btn[data-view="heatmap"]')).toHaveClass(/active/);
    });

    test('modal opens and closes', async ({ page }) => {
        // Open modal
        await page.locator('.info-btn').click();
        await expect(page.locator('#info-modal')).toHaveClass(/open/);

        // Close with Escape
        await page.keyboard.press('Escape');
        await expect(page.locator('#info-modal')).not.toHaveClass(/open/);

        // Open again and close with X button
        await page.locator('.info-btn').click();
        await expect(page.locator('#info-modal')).toHaveClass(/open/);
        await page.locator('#info-modal-close').click();
        await expect(page.locator('#info-modal')).not.toHaveClass(/open/);
    });

    test('hide UI toggles panel visibility', async ({ page }) => {
        // Panel visible initially
        await expect(page.locator('.panel')).toBeVisible();
        await expect(page.locator('.legend')).toBeVisible();

        // Click hide UI
        await page.locator('#hide-ui-btn').click();
        await expect(page.locator('.panel')).toBeHidden();
        await expect(page.locator('.legend')).toBeHidden();

        // Press H to show again
        await page.keyboard.press('h');
        await expect(page.locator('.panel')).toBeVisible();
        await expect(page.locator('.legend')).toBeVisible();
    });

    test('turbine toggle hides and shows turbines', async ({ page }) => {
        // Turbines visible initially (checked by default)
        await expect(page.locator('#turbine-toggle')).toBeChecked();

        // Uncheck to hide
        await page.locator('#turbine-toggle').uncheck();
        await expect(page.locator('#turbine-toggle')).not.toBeChecked();

        // Check to show again
        await page.locator('#turbine-toggle').check();
        await expect(page.locator('#turbine-toggle')).toBeChecked();
    });

    test('wind park popup shows on turbine click', async ({ page }) => {
        // Wait for turbine markers to exist
        await expect(page.locator('.turbine-marker').first()).toBeAttached({ timeout: 5000 });

        // Get a turbine marker's position and click it via JS (Leaflet markers are
        // positioned on a fixed map, so we fire the click event programmatically)
        await page.evaluate(() => {
            const marker = document.querySelector('.turbine-marker');
            if (marker) marker.click();
        });

        // Popup should appear with park info
        const popup = page.locator('.leaflet-popup-content');
        await expect(popup).toBeVisible({ timeout: 5000 });
        const text = await popup.textContent();
        expect(text).toMatch(/turbines/i);
        expect(text).toMatch(/MW/);
    });

    test('species list shows species', async ({ page }) => {
        const items = page.locator('.species-item');
        const count = await items.count();
        expect(count).toBeGreaterThan(0);
        expect(count).toBeLessThanOrEqual(20);
    });

    test('kommune modal opens on polygon click', async ({ page }) => {
        // Click a kommune polygon programmatically (Leaflet GeoJSON layers)
        // Click first kommun polygon via Leaflet's SVG interactive path
        await page.locator('.leaflet-overlay-pane path.leaflet-interactive').first().click({ force: true });

        await expect(page.locator('#kommune-modal')).toHaveClass(/open/, { timeout: 5000 });

        // Modal should show kommune name and stats
        const name = await page.locator('#kommune-name').textContent();
        expect(name.length).toBeGreaterThan(0);

        const stats = await page.locator('#kommune-stats').textContent();
        expect(stats).toMatch(/observations/);
        expect(stats).toMatch(/species/);

        // Turbine inputs should have default values
        const hubVal = await page.locator('#kommune-hub').inputValue();
        expect(hubVal).toBe('90');
        const rotorVal = await page.locator('#kommune-rotor').inputValue();
        expect(rotorVal).toBe('115');

        // Swept zone should be displayed
        const swept = await page.locator('#kommune-swept').textContent();
        expect(swept).toMatch(/Swept zone/);
    });

    test('kommune modal closes with Escape', async ({ page }) => {
        // Click first kommun polygon via Leaflet's SVG interactive path
        await page.locator('.leaflet-overlay-pane path.leaflet-interactive').first().click({ force: true });
        await expect(page.locator('#kommune-modal')).toHaveClass(/open/, { timeout: 5000 });

        await page.keyboard.press('Escape');
        await expect(page.locator('#kommune-modal')).not.toHaveClass(/open/);
    });

    test('kommune modal Escape works from input fields', async ({ page }) => {
        // Click first kommun polygon via Leaflet's SVG interactive path
        await page.locator('.leaflet-overlay-pane path.leaflet-interactive').first().click({ force: true });
        await expect(page.locator('#kommune-modal')).toHaveClass(/open/, { timeout: 5000 });

        // Focus on hub input and press Escape
        await page.locator('#kommune-hub').focus();
        await page.keyboard.press('Escape');
        await expect(page.locator('#kommune-modal')).not.toHaveClass(/open/);
    });

    test('kommune modal recalculates on input change', async ({ page }) => {
        // Click first kommun polygon via Leaflet's SVG interactive path
        await page.locator('.leaflet-overlay-pane path.leaflet-interactive').first().click({ force: true });
        await expect(page.locator('#kommune-modal')).toHaveClass(/open/, { timeout: 5000 });

        const initialSwept = await page.locator('#kommune-swept').textContent();

        // Change hub height
        await page.locator('#kommune-hub').fill('120');
        await page.locator('#kommune-hub').dispatchEvent('input');

        // Wait for debounce (200ms) + rendering
        await page.waitForTimeout(400);

        const newSwept = await page.locator('#kommune-swept').textContent();
        expect(newSwept).not.toBe(initialSwept);
        expect(newSwept).toMatch(/Swept zone/);
    });
});


test('wind park drawing and keyboard dismissal', async ({page}) => {
    await page.route('https://tile.openstreetmap.org/**', route => route.abort());
    await page.goto('/');
    await expect(page.locator('#loading')).toBeHidden();
    await page.getByRole('button',{name:'Dismiss introduction',exact:true}).click();
    await page.getByRole('button', {name: 'Smøla', exact: true}).click();
    await page.getByRole('button', {name: 'Explore flight overlap'}).click();
    await expect(page.locator('#park-modal')).toHaveClass(/open/);
    await expect(page.locator('#park-diagram svg')).toBeVisible();
    await expect(page.locator('#park-summary')).toContainText('current filters');
    await expect(page.locator('#park-modal')).toContainText('not mapped habitat');
    await page.locator('#park-modal summary').last().focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', {name: 'Close wind park details'})).toBeFocused();
    await page.screenshot({path: 'test-results/flight-overlap-desktop.png'});
    await page.keyboard.press('Escape');
    await expect(page.locator('#park-modal')).not.toHaveClass(/open/);
});

test('empty filtered park is unknown rather than low conflict', async ({page}) => {
    await page.route('https://tile.openstreetmap.org/**', route => route.abort());
    await page.goto('/');
    await expect(page.locator('#loading')).toBeHidden();
    await page.getByRole('button',{name:'Dismiss introduction',exact:true}).click();
    await page.selectOption('#species-filter', 'Alcedo atthis');
    await page.locator('#month-slider').fill('1');
    await page.evaluate(() => document.querySelector('.turbine-marker').click());
    await expect(page.locator('.leaflet-popup-content')).toContainText('No nearby records');
    await page.getByRole('button', {name: 'Explore flight overlap'}).click();
    await expect(page.locator('#park-summary')).toContainText('cannot be assessed');
});

test('mobile panel can reveal the map and species support keyboard', async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.route('https://tile.openstreetmap.org/**', route => route.abort());
    await page.goto('/');
    await expect(page.locator('#loading')).toBeHidden();
    await page.getByRole('button',{name:'Dismiss introduction',exact:true}).click();
    await page.locator('#panel-toggle').click();
    await expect(page.locator('.panel')).toBeHidden();
    await expect(page.locator('.leaflet-control-attribution')).toBeVisible();
    await page.locator('#panel-toggle').click();
    const first = page.locator('.species-item').first();
    const species = await first.getAttribute('data-species');
    await first.press('Enter');
    await expect(page.locator('#species-filter')).toHaveValue(species);
    await page.screenshot({path: 'test-results/birds-mobile.png'});
});

test('bird data failure provides a recovery action', async ({page}) => {
    await page.route('**/data/birds_norway.json', route => route.fulfill({status: 503, body: 'unavailable'}));
    await page.route('https://tile.openstreetmap.org/**', route => route.abort());
    await page.goto('/');
    await page.getByRole('button',{name:'Dismiss introduction',exact:true}).click();
    await expect(page.locator('#loading')).toContainText('could not load');
    await expect(page.getByRole('button', {name: 'Reload', exact: true})).toBeVisible();
});

 test('intro respects reduced motion and has replay and dismiss controls', async ({page}) => {
    await page.emulateMedia({reducedMotion: 'reduce'});
    await page.route('https://tile.openstreetmap.org/**', route => route.abort());
    await page.goto('/');
    await expect(page.locator('#loading')).toBeHidden();
    await page.getByRole('button',{name:'Dismiss introduction',exact:true}).click();
    await page.getByRole('button', {name: 'Replay flight introduction'}).click();
    await expect(page.locator('.flight-intro__card')).toBeVisible();
    const animations = await page.locator('.flight-intro .flight-rotor').evaluateAll(elements => elements.map(el => getComputedStyle(el).animationName));
    expect(animations).toEqual(['none', 'none']);
    await page.getByRole('button', {name: 'Dismiss introduction'}).click();
    await expect(page.locator('.flight-intro__card')).toBeHidden();
});
