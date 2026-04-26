import { test, expect } from '@playwright/test';

// evc-charging: single inverter with an active EV charger
//   PV=2331W, Battery charging at 3432W, Grid importing 11284W, Load=9945W, SOC=56
//   EVC: Active_Power=7600W, Charging_State="Charging", Charge_Limit=32A, Session=0.2kWh
//   Flows: S2H=2331, G2H=7852, G2B=3432 (grid charging the battery)
test.describe('evc-charging — EV charger actively charging', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/?SampleData=evc-charging&ShowAdvancedInfo=false');
        await expect(page.locator('#battery_state_text')).toHaveText('Charging', { timeout: 10000 });
    });

    test('power circles show correct kW values', async ({ page }) => {
        await expect(page.locator('#power_solar_text')).toHaveText('2.33');  // 2331W
        await expect(page.locator('#power_battery_text')).toHaveText('3.43'); // 3432W charge
        await expect(page.locator('#power_grid_text')).toHaveText('11.28');  // 11284W import
        await expect(page.locator('#power_home_text')).toHaveText('9.95');   // 9945W load
    });

    test('EVC circle is visible and active with correct power', async ({ page }) => {
        await expect(page.locator('#power_evc')).toBeVisible();
        await expect(page.locator('#power_evc')).toHaveClass(/active/);
        await expect(page.locator('#power_evc_text')).toHaveText('7.60'); // 7600W
    });

    test('battery state and charge level are correct', async ({ page }) => {
        await expect(page.locator('#battery_percentage_text')).toHaveText('56%');
        await expect(page.locator('#battery_state_text')).toHaveText('Charging');
    });

    test('energy today values are correct', async ({ page }) => {
        await expect(page.locator('#energy_home_text')).toHaveText('7.5 kWh');
        await expect(page.locator('#energy_solar_text')).toHaveText('6.6 kWh');
        await expect(page.locator('#energy_imported_peak_text')).toHaveText('0.8');
        await expect(page.locator('#energy_imported_offpeak_text')).toHaveText('3.0');
        await expect(page.locator('#energy_exported_text')).toHaveText('0.0');
    });

    test('flow lines are correct', async ({ page }) => {
        await expect(page.locator('#solar_to_home')).toHaveClass(/active/);    // S2H=2331W
        await expect(page.locator('#grid_to_home')).toHaveClass(/active/);     // G2H=7852W
        await expect(page.locator('#battery_with_grid')).toHaveClass(/active/); // G2B=3432W
        await expect(page.locator('#home_to_evc')).toHaveClass(/active/);      // EVC charging
        await expect(page.locator('#solar_to_battery')).toHaveClass(/idle/);
        await expect(page.locator('#battery_to_home')).toHaveClass(/idle/);
        await expect(page.locator('#solar_to_grid')).toHaveClass(/idle/);
    });
});
