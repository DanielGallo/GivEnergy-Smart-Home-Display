import { describe, it, expect } from 'vitest';
import { Helpers } from '../../js/helpers.js';

describe('Helpers.getPropertyValueFromMapping', () => {
    const obj = {
        Power: {
            Power: {
                PV_Power: 3668,
                SOC: 100,
            },
        },
        Last_Updated_Time: '2024-01-01T12:00:00',
    };

    it('traverses a dot-delimited path', () => {
        expect(Helpers.getPropertyValueFromMapping(obj, 'Power.Power.PV_Power')).toBe(3668);
    });

    it('returns a top-level value', () => {
        expect(Helpers.getPropertyValueFromMapping(obj, 'Last_Updated_Time')).toBe('2024-01-01T12:00:00');
    });

    it('returns undefined for a missing path', () => {
        expect(Helpers.getPropertyValueFromMapping(obj, 'Power.Power.Missing')).toBeUndefined();
        expect(Helpers.getPropertyValueFromMapping(obj, 'Missing.Key')).toBeUndefined();
    });

    it('accepts an array of mappings and returns the first match', () => {
        const mappings = ['Power.Power.Missing', 'Power.Power.SOC'];
        expect(Helpers.getPropertyValueFromMapping(obj, mappings)).toBe(100);
    });

    it('returns undefined when none of the array mappings match', () => {
        expect(Helpers.getPropertyValueFromMapping(obj, ['Missing.A', 'Missing.B'])).toBeUndefined();
    });
});

describe('Helpers.getBatteriesFromInverter', () => {
    const batteryA = { Battery_SOC: 90, Battery_Voltage: 52, Battery_Remaining_Capacity: 100 };
    const batteryB = { Battery_SOC: 80, Battery_Voltage: 52, Battery_Remaining_Capacity: 90 };

    it('returns an array of battery objects, filtering out non-object entries', () => {
        const batteries = {
            Module_1: batteryA,
            Module_2: batteryB,
            BMS_Temperature: '25',
            BMS_Voltage: '52.1',
        };
        const result = Helpers.getBatteriesFromInverter(batteries);
        expect(result).toHaveLength(2);
        expect(result).toContain(batteryA);
        expect(result).toContain(batteryB);
    });

    it('handles GivTCP v3 Battery_Stack_1 nesting', () => {
        const batteries = {
            Battery_Stack_1: {
                Module_1: batteryA,
                BMS_Temperature: '25',
            },
        };
        const result = Helpers.getBatteriesFromInverter(batteries);
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(batteryA);
    });

    it('excludes objects that lack Battery_SOC', () => {
        const batteries = {
            Module_1: batteryA,
            Module_2: { some_other_key: 'value' },
        };
        const result = Helpers.getBatteriesFromInverter(batteries);
        expect(result).toHaveLength(1);
    });
});

describe('Helpers.clampPower', () => {
    it('returns 0 for values below 10W (noise threshold)', () => {
        expect(Helpers.clampPower(9)).toBe(0);
        expect(Helpers.clampPower(0)).toBe(0);
        expect(Helpers.clampPower(-5)).toBe(0);
    });

    it('returns the value unchanged at or above 10W', () => {
        expect(Helpers.clampPower(10)).toBe(10);
        expect(Helpers.clampPower(3668)).toBe(3668);
    });
});

describe('Helpers.calculateThreePhaseFlows', () => {
    it('routes surplus solar to the grid when solar exceeds load', () => {
        const flows = Helpers.calculateThreePhaseFlows({
            PV_Power: 5000,
            Grid_Power: 3000,
            Load_Power: 2000,
            Charge_Power: 0,
            Discharge_Power: 0,
        });
        expect(flows.Solar_to_House).toBe(2000);
        expect(flows.Solar_to_Grid).toBe(3000);
        expect(flows.Grid_to_House).toBe(0);
        expect(flows.Battery_to_House).toBe(0);
        expect(flows.Battery_to_Grid).toBe(0);
    });

    it('routes all solar to house when solar exactly meets load', () => {
        const flows = Helpers.calculateThreePhaseFlows({
            PV_Power: 2000,
            Grid_Power: 0,
            Load_Power: 2000,
            Charge_Power: 0,
            Discharge_Power: 0,
        });
        expect(flows.Solar_to_House).toBe(2000);
        expect(flows.Solar_to_Grid).toBe(0);
        expect(flows.Solar_to_Battery).toBe(0);
    });

    it('routes solar to battery charging after meeting load', () => {
        const flows = Helpers.calculateThreePhaseFlows({
            PV_Power: 5000,
            Grid_Power: 0,
            Load_Power: 2000,
            Charge_Power: 1000,
            Discharge_Power: 0,
        });
        expect(flows.Solar_to_House).toBe(2000);
        expect(flows.Solar_to_Battery).toBe(1000);
        expect(flows.Solar_to_Grid).toBe(2000);
        expect(flows.Grid_to_Battery).toBe(0);
    });

    it('sources battery charging from grid when solar is insufficient', () => {
        const flows = Helpers.calculateThreePhaseFlows({
            PV_Power: 1000,
            Grid_Power: 0,
            Load_Power: 500,
            Charge_Power: 2000,
            Discharge_Power: 0,
        });
        expect(flows.Solar_to_House).toBe(500);
        expect(flows.Solar_to_Battery).toBe(500);
        expect(flows.Grid_to_Battery).toBe(1500);
    });

    it('discharges battery to house and grid', () => {
        const flows = Helpers.calculateThreePhaseFlows({
            PV_Power: 0,
            Grid_Power: 5000,
            Load_Power: 2000,
            Charge_Power: 0,
            Discharge_Power: 5000,
        });
        expect(flows.Battery_to_House).toBe(2000);
        expect(flows.Battery_to_Grid).toBe(3000);
        expect(flows.Solar_to_House).toBe(0);
        expect(flows.Grid_to_House).toBe(0);
    });
});

describe('Helpers.getGatewayMode', () => {
    it('finds Gateway_Mode via serial number in raw data', () => {
        const data = {
            raw: { invertor: { serial_number: 'GW1234' } },
            GW1234: { Gateway_Mode: 'Normal' },
        };
        expect(Helpers.getGatewayMode(data)).toBe('Normal');
    });

    it('falls back to scanning top-level keys when serial is absent', () => {
        const data = {
            SomeKey: { Gateway_Mode: 'Eco' },
        };
        expect(Helpers.getGatewayMode(data)).toBe('Eco');
    });

    it('returns null when Gateway_Mode is not found', () => {
        expect(Helpers.getGatewayMode({})).toBeNull();
    });
});

describe('Helpers.isThreePhaseInverter', () => {
    it('returns true when num_phases is 3', () => {
        const inverter = {
            data: { raw: { invertor: { num_phases: 3 } } },
            serialNumber: null,
        };
        expect(Helpers.isThreePhaseInverter(inverter)).toBe(true);
    });

    it('returns true when model string contains "3ph"', () => {
        const inverter = {
            data: { raw: { invertor: { num_phases: 0, model: 'GIV-HY-5.0-3ph' } } },
            serialNumber: null,
        };
        expect(Helpers.isThreePhaseInverter(inverter)).toBe(true);
    });

    it('returns false for a single-phase inverter', () => {
        const inverter = {
            data: { raw: { invertor: { num_phases: 1, model: 'GIV-HY-5.0' } } },
            serialNumber: null,
        };
        expect(Helpers.isThreePhaseInverter(inverter)).toBe(false);
    });
});
