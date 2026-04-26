import { describe, it, expect } from 'vitest';
import { Formatters } from '../../js/formatters.js';
import { Converters } from '../../js/converters.js';

describe('Formatters.sensorValue', () => {
    it('returns raw value when no converter, formatter, prefix or suffix', () => {
        expect(Formatters.sensorValue(42, {})).toBe(42);
    });

    it('applies converter', () => {
        const sensor = { converter: Converters.wattsToKw };
        expect(Formatters.sensorValue(3000, sensor)).toBe('3.00');
    });

    it('applies formatter', () => {
        const sensor = { formatter: Formatters.roundToOneDecimalPlace };
        expect(Formatters.sensorValue(48.1, sensor)).toBe('48.1');
    });

    it('applies formatter after converter when both are plain number functions', () => {
        // Both operate on numbers: multiply by 10 then round to 1dp
        const sensor = {
            converter: (v) => v * 10,
            formatter: Formatters.roundToOneDecimalPlace,
        };
        // 1.23 → 12.3 → "12.3"
        expect(Formatters.sensorValue(1.23, sensor)).toBe('12.3');
    });

    it('prepends prefix', () => {
        const sensor = { prefix: '£' };
        expect(Formatters.sensorValue('5.00', sensor)).toBe('£5.00');
    });

    it('appends suffix', () => {
        const sensor = { suffix: ' kWh' };
        expect(Formatters.sensorValue('48.1', sensor)).toBe('48.1 kWh');
    });

    it('ignores prefix when ignorePrefix is true', () => {
        const sensor = { prefix: '£', suffix: ' kW' };
        expect(Formatters.sensorValue('3.00', sensor, true)).toBe('3.00 kW');
    });

    it('ignores suffix when ignoreSuffix is true', () => {
        const sensor = { prefix: '£', suffix: ' kW' };
        expect(Formatters.sensorValue('3.00', sensor, false, true)).toBe('£3.00');
    });
});

describe('Formatters.roundToOneDecimalPlace', () => {
    it('rounds to one decimal place', () => {
        expect(Formatters.roundToOneDecimalPlace(48.16)).toBe('48.2');
        expect(Formatters.roundToOneDecimalPlace(12.399999)).toBe('12.4');
        expect(Formatters.roundToOneDecimalPlace(0.0)).toBe('0.0');
    });

    it('treats NaN as 0', () => {
        expect(Formatters.roundToOneDecimalPlace(NaN)).toBe('0.0');
    });
});

describe('Formatters.roundToWholeNumber', () => {
    it('rounds to a whole number', () => {
        expect(Formatters.roundToWholeNumber(74)).toBe('74');
        expect(Formatters.roundToWholeNumber(99.6)).toBe('100');
        expect(Formatters.roundToWholeNumber(0)).toBe('0');
    });

    it('treats NaN as 0', () => {
        expect(Formatters.roundToWholeNumber(NaN)).toBe('0');
    });
});

describe('Formatters.renderLargeNumber', () => {
    it('adds thousands separators', () => {
        expect(Formatters.renderLargeNumber(1000)).toBe('1,000');
        expect(Formatters.renderLargeNumber(1234567)).toBe('1,234,567');
    });

    it('leaves numbers below 1000 unchanged', () => {
        expect(Formatters.renderLargeNumber(999)).toBe('999');
        expect(Formatters.renderLargeNumber(0)).toBe('0');
    });
});
