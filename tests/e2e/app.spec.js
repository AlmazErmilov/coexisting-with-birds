import { test, expect } from '@playwright/test';

test.describe('Coexisting with Birds', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Wait for data to load (loading indicator disappears)
        await expect(page.locator('#loading')).toBeHidden({ timeout: 15000 });
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
