import { test, expect } from '@playwright/test';

// evc-notcharging: single inverter, EV charger connected but idle
//   PV=1904W, Battery charging at 997W, Grid=8W (export, clamped to 0), Load=734W, SOC=86
//   EVC: Active_Power=0W, Charging_State="Idle", Session=3.6kWh
//   Flows: S2H=734, S2B=1162
test.describe('evc-notcharging — EV charger connected but idle', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/?SampleData=evc-notcharging&ShowAdvancedInfo=false');
        await expect(page.locator('#battery_state_text')).toHaveText('Charging', { timeout: 10000 });
    });

    test('power circles show correct kW values', async ({ page }) => {
        await expect(page.locator('#power_solar_text')).toHaveText('1.90');  // 1904W
        await expect(page.locator('#power_battery_text')).toHaveText('1.00'); // 997W → 0.997 rounds to 1.00
        await expect(page.locator('#power_grid_text')).toHaveText('0.00');   // 8W → clamped below 10W threshold
        await expect(page.locator('#power_home_text')).toHaveText('0.73');   // 734W
    });

    test('EVC circle is visible but idle', async ({ page }) => {
        await expect(page.locator('#power_evc')).toBeVisible();
        await expect(page.locator('#power_evc')).toHaveClass(/idle/);
        await expect(page.locator('#power_evc_text')).toHaveText('0.00'); // Active_Power=0
    });

    test('battery state and charge level are correct', async ({ page }) => {
        await expect(page.locator('#battery_percentage_text')).toHaveText('86%');
        await expect(page.locator('#battery_state_text')).toHaveText('Charging');
    });

    test('energy today values are correct', async ({ page }) => {
        await expect(page.locator('#energy_home_text')).toHaveText('28.5 kWh');
        await expect(page.locator('#energy_solar_text')).toHaveText('12.0 kWh');
        await expect(page.locator('#energy_imported_peak_text')).toHaveText('22.1');
        await expect(page.locator('#energy_imported_offpeak_text')).toHaveText('3.0');
        await expect(page.locator('#energy_exported_text')).toHaveText('0.0');
    });

    test('flow lines are correct', async ({ page }) => {
        await expect(page.locator('#solar_to_home')).toHaveClass(/active/);    // S2H=734W
        await expect(page.locator('#solar_to_battery')).toHaveClass(/active/); // S2B=1162W, Battery_Power≠0
        await expect(page.locator('#home_to_evc')).toHaveClass(/idle/);        // EVC not charging
        await expect(page.locator('#solar_to_grid')).toHaveClass(/idle/);      // S2G=8W → clamped
        await expect(page.locator('#grid_to_home')).toHaveClass(/idle/);
        await expect(page.locator('#battery_to_home')).toHaveClass(/idle/);
        await expect(page.locator('#battery_with_grid')).toHaveClass(/idle/);
    });
});
