import { test, expect } from '@playwright/test';

// batterydischarge1 has 2 inverter files. Expected values reflect multi-inverter combinators:
//   inverter_0: Discharge=4017W, Grid=5742W(export), PV=9W, Load=0W, SOC=74
//   inverter_1: Discharge=4017W, Grid=5789W(export), PV=0W, Load=0W, SOC=70
// Battery_Power → Addition: 4017+4017 = 8034W → "8.03"
// Grid_Power    → Any (inv0): 5742W → "5.74"
// PV_Power      → Addition: 9+0 = 9W → clamped → "0.00"
// Load_Power    → derived: (9+8034) - 5742 = 2301W → "2.30"
// Battery SOC   → Average: (74+70)/2 = 72%
// Load_Energy   → Average: (47.2+40.8)/2 = 44.0 kWh
// PV_Energy     → Addition: 17.6+9.1 = 26.7 kWh
// Export_Energy → Average: (12.1+11.8)/2 = 12.0 kWh (11.95 rounds up)
test.describe('batterydischarge1 — battery discharging to grid', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/?SampleData=batterydischarge1&ShowAdvancedInfo=false');
        await expect(page.locator('#battery_state_text')).toHaveText('Discharging', { timeout: 10000 });
    });

    test('power circles show correct kW values', async ({ page }) => {
        await expect(page.locator('#power_solar_text')).toHaveText('0.00');
        await expect(page.locator('#power_battery_text')).toHaveText('8.03');
        await expect(page.locator('#power_grid_text')).toHaveText('5.74');
        await expect(page.locator('#power_home_text')).toHaveText('2.30');
    });

    test('battery state and charge level are correct', async ({ page }) => {
        await expect(page.locator('#battery_percentage_text')).toHaveText('72%');
        await expect(page.locator('#battery_state_text')).toHaveText('Discharging');
    });

    test('energy today values are correct', async ({ page }) => {
        await expect(page.locator('#energy_home_text')).toHaveText('44.0 kWh');
        await expect(page.locator('#energy_solar_text')).toHaveText('26.7 kWh');
        await expect(page.locator('#energy_imported_peak_text')).toHaveText('0.1');
        await expect(page.locator('#energy_imported_offpeak_text')).toHaveText('0.0');
        await expect(page.locator('#energy_exported_text')).toHaveText('11.9'); // (12.1+11.8)/2 → 11.95 rounds down in V8
    });

    test('flow lines reflect battery discharging to grid', async ({ page }) => {
        await expect(page.locator('#battery_with_grid')).toHaveClass(/active/);
        // App forces battery_to_home=10W when multi-inverter battery exports to grid
        await expect(page.locator('#battery_to_home')).toHaveClass(/active/);
        await expect(page.locator('#grid_to_home')).toHaveClass(/idle/);
        await expect(page.locator('#solar_to_home')).toHaveClass(/idle/);
        await expect(page.locator('#solar_to_grid')).toHaveClass(/idle/); // PV=9W clamped
    });
});
