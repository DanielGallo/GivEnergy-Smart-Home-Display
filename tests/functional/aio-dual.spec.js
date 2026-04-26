import { test, expect } from '@playwright/test';

// aio-dual: Gateway (aggregating) + 2 AIO inverters
//   Gateway data drives the main display (Power.Flows exists → gatewayAggregatesInverters=true)
//   Gateway: PV=114W, Battery=472W(discharge), Grid=-59W(import), Load=534W, SOC=77
//   Energy: Load=10.5kWh, PV=2.2kWh, Export=1.7kWh from gateway
//   Rates (copied from AIO[0]): Peak=0.2kWh, OffPeak=39.3kWh
//   Flows: S2H=114, B2H=472, G2H=59
//   Note: Gateway doesn't expose Discharge_Power so Battery_State shows "Idle"
test.describe('aio-dual — Gateway aggregating two AIO inverters', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/?SampleData=aio-dual&ShowAdvancedInfo=false');
        // Battery SOC changes from default "0%" once data loads
        await expect(page.locator('#battery_percentage_text')).toHaveText('77%', { timeout: 10000 });
    });

    test('power circles show correct kW values', async ({ page }) => {
        await expect(page.locator('#power_solar_text')).toHaveText('0.11');   // 114W
        await expect(page.locator('#power_battery_text')).toHaveText('0.47'); // 472W
        await expect(page.locator('#power_grid_text')).toHaveText('0.06');    // 59W import
        await expect(page.locator('#power_home_text')).toHaveText('0.53');    // 534W
    });

    test('battery state and charge level are correct', async ({ page }) => {
        await expect(page.locator('#battery_percentage_text')).toHaveText('77%');
        // Gateway does not expose Charge/Discharge_Power, so Battery_State defaults to Idle
        await expect(page.locator('#battery_state_text')).toHaveText('Idle');
    });

    test('no EVC circle is shown', async ({ page }) => {
        await expect(page.locator('#power_evc')).toBeHidden();
        await expect(page.locator('#home_to_evc')).toBeHidden();
    });

    test('energy today values are correct', async ({ page }) => {
        await expect(page.locator('#energy_home_text')).toHaveText('10.5 kWh');
        await expect(page.locator('#energy_solar_text')).toHaveText('2.2 kWh');
        await expect(page.locator('#energy_exported_text')).toHaveText('1.7');
        // Rates are copied from AIO[0] since the gateway lacks Energy.Rates
        await expect(page.locator('#energy_imported_peak_text')).toHaveText('0.2');
        await expect(page.locator('#energy_imported_offpeak_text')).toHaveText('39.3');
    });

    test('flow lines reflect gateway aggregate data', async ({ page }) => {
        await expect(page.locator('#solar_to_home')).toHaveClass(/active/);    // S2H=114W
        await expect(page.locator('#battery_to_home')).toHaveClass(/active/);  // B2H=472W
        await expect(page.locator('#grid_to_home')).toHaveClass(/active/);     // G2H=59W
        await expect(page.locator('#solar_to_grid')).toHaveClass(/idle/);
        await expect(page.locator('#battery_with_grid')).toHaveClass(/idle/);
        await expect(page.locator('#solar_to_battery')).toHaveClass(/idle/);
    });
});
