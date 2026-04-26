import { test, expect } from '@playwright/test';

// solar1 has 2 inverter files. Expected values reflect multi-inverter combinators:
//   inverter_0: PV=3668W, Grid=3315W(export), Load=311W, Battery=0W, SOC=100
//   inverter_1: PV=1250W, Grid=3294W(export), Load=0W, Battery=0W, SOC=100
// PV_Power   → Addition: 3668+1250 = 4918W → "4.92"
// Grid_Power → Any (inv0): 3315W → "3.32"
// Load_Power → derived: 4918 - 3315 = 1603W → "1.60"
// Load_Energy → Average: (48.1+34.9)/2 = 41.5 kWh
// PV_Energy  → Addition: 12.4+5.1 = 17.5 kWh
// Export_Energy → Average: (1.9+1.7)/2 = 1.8 kWh
test.describe('solar1 — solar generation exporting to grid', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/?SampleData=solar1&ShowAdvancedInfo=false');
        await expect(page.locator('#power_solar_text')).toHaveText('4.92', { timeout: 10000 });
    });

    test('power circles show correct kW values', async ({ page }) => {
        await expect(page.locator('#power_solar_text')).toHaveText('4.92');
        await expect(page.locator('#power_home_text')).toHaveText('1.60');
        await expect(page.locator('#power_grid_text')).toHaveText('3.31'); // 3315/1000 rounds to 3.31 in V8
        await expect(page.locator('#power_battery_text')).toHaveText('0.00');
    });

    test('battery state and charge level are correct', async ({ page }) => {
        await expect(page.locator('#battery_percentage_text')).toHaveText('100%');
        await expect(page.locator('#battery_state_text')).toHaveText('Idle');
    });

    test('energy today values are correct', async ({ page }) => {
        await expect(page.locator('#energy_home_text')).toHaveText('41.5 kWh');
        await expect(page.locator('#energy_solar_text')).toHaveText('17.5 kWh');
        await expect(page.locator('#energy_imported_peak_text')).toHaveText('0.2');
        await expect(page.locator('#energy_imported_offpeak_text')).toHaveText('45.4');
        await expect(page.locator('#energy_exported_text')).toHaveText('1.8');
    });

    test('solar and grid flow lines are active', async ({ page }) => {
        await expect(page.locator('#solar_to_grid')).toHaveClass(/active/);
        await expect(page.locator('#solar_to_home')).toHaveClass(/active/);
        await expect(page.locator('#solar_to_battery')).toHaveClass(/idle/); // Battery_Power=0 → nonZeroCheck fails
        await expect(page.locator('#grid_to_home')).toHaveClass(/idle/);
        await expect(page.locator('#battery_to_home')).toHaveClass(/idle/);
    });
});
