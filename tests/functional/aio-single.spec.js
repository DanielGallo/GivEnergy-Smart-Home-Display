import { test, expect } from '@playwright/test';

// aio-single: single AIO inverter, no gateway
//   AIO treated as a regular inverter (no gateway → gatewayAggregatesInverters=false)
//   PV=113W, Battery discharging at 355W, Grid=-53W(import), Load=572W, SOC=78
//   Flows: S2H=113, B2H=355, G2H=53
test.describe('aio-single — single AIO inverter without gateway', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/?SampleData=aio-single&ShowAdvancedInfo=false');
        await expect(page.locator('#battery_state_text')).toHaveText('Discharging', { timeout: 10000 });
    });

    test('power circles show correct kW values', async ({ page }) => {
        await expect(page.locator('#power_solar_text')).toHaveText('0.11');   // 113W
        await expect(page.locator('#power_battery_text')).toHaveText('0.35'); // 355W → 0.355 rounds to 0.35
        await expect(page.locator('#power_grid_text')).toHaveText('0.05');    // 53W import
        await expect(page.locator('#power_home_text')).toHaveText('0.57');    // 572W
    });

    test('battery state and charge level are correct', async ({ page }) => {
        await expect(page.locator('#battery_percentage_text')).toHaveText('78%');
        await expect(page.locator('#battery_state_text')).toHaveText('Discharging');
    });

    test('no EVC circle is shown', async ({ page }) => {
        await expect(page.locator('#power_evc')).toBeHidden();
        await expect(page.locator('#home_to_evc')).toBeHidden();
    });

    test('energy today values are correct', async ({ page }) => {
        await expect(page.locator('#energy_home_text')).toHaveText('35.4 kWh');
        await expect(page.locator('#energy_solar_text')).toHaveText('2.1 kWh');
        await expect(page.locator('#energy_exported_text')).toHaveText('1.7');
        await expect(page.locator('#energy_imported_peak_text')).toHaveText('0.2');
        await expect(page.locator('#energy_imported_offpeak_text')).toHaveText('39.3');
    });

    test('flow lines are correct', async ({ page }) => {
        await expect(page.locator('#solar_to_home')).toHaveClass(/active/);   // S2H=113W
        await expect(page.locator('#battery_to_home')).toHaveClass(/active/); // B2H=355W
        await expect(page.locator('#grid_to_home')).toHaveClass(/active/);    // G2H=53W
        await expect(page.locator('#solar_to_grid')).toHaveClass(/idle/);
        await expect(page.locator('#battery_with_grid')).toHaveClass(/idle/);
        await expect(page.locator('#solar_to_battery')).toHaveClass(/idle/);
    });
});
