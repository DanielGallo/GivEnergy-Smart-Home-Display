import { describe, it, expect } from 'vitest';
import { Converters } from '../../js/converters.js';

describe('Converters.wattsToKw', () => {
    it('converts whole watts to kW with 2 decimal places', () => {
        expect(Converters.wattsToKw(1000)).toBe('1.00');
        expect(Converters.wattsToKw(3668)).toBe('3.67');
        expect(Converters.wattsToKw(500)).toBe('0.50');
    });

    it('converts 0 watts', () => {
        expect(Converters.wattsToKw(0)).toBe('0.00');
    });

    it('converts fractional watts', () => {
        expect(Converters.wattsToKw(1500)).toBe('1.50');
        expect(Converters.wattsToKw(4017)).toBe('4.02');
    });

    it('accepts a numeric string', () => {
        expect(Converters.wattsToKw('2000')).toBe('2.00');
    });
});

describe('Converters.numberToCurrency', () => {
    it('formats a number to 2 decimal places', () => {
        expect(Converters.numberToCurrency(1.5)).toBe('1.50');
        expect(Converters.numberToCurrency(3.794)).toBe('3.79');
        expect(Converters.numberToCurrency(0.061)).toBe('0.06');
    });

    it('formats zero', () => {
        expect(Converters.numberToCurrency(0)).toBe('0.00');
    });

    it('accepts a numeric string', () => {
        expect(Converters.numberToCurrency('3.79')).toBe('3.79');
    });

    it('treats NaN as 0', () => {
        expect(Converters.numberToCurrency('not-a-number')).toBe('0.00');
        expect(Converters.numberToCurrency(NaN)).toBe('0.00');
    });
});
