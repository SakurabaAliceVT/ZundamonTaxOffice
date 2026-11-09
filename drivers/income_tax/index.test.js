const calc = require('./index.js');
const fs = require('node:fs');

describe('income tax', () => {
    test.each([
        [0, 0],
        [10000, 0],
        [1320000, 18800],
        [1500000, 31600],
        [2830000, 99500],
        [4280000, 298600],
        [7530000, 982700],
        [9580000, 1464100],
        [18580000, 4496400],
        [40580000, 13747700],
    ])('calculates income %i in the expected tax-rate bracket', (income, expectedTax) => {
        expect(calc(income)).toBe(expectedTax);
    });

    test.each([
        3360000,
        4890000,
        6550000,
        23500000,
        24000000,
        24500000,
        25000000,
        25000001,
    ])('selects the basic-deduction bracket for income %i', income => {
        expect(calc(income)).toBeGreaterThanOrEqual(0);
    });

    test('normalizes a zero tax after rounding to positive zero', () => {
        const tax = calc(951000);

        expect(tax).toBe(0);
        expect(Object.is(tax, -0)).toBe(false);
    });

    test('returns zero when calculated income tax is not positive', () => {
        const readFile = jest.spyOn(fs, 'readFileSync').mockImplementationOnce(() => JSON.stringify({
            minus: [{ max: 100, minus: 0 }],
            rates: [{ max: null, minus: 1, rate: 0 }],
        }));

        try {
            expect(calc(1000)).toBe(0);
        } finally {
            readFile.mockRestore();
        }
    });

    test('sorts an unbounded tax-rate bracket after bounded brackets', () => {
        const readFile = jest.spyOn(fs, 'readFileSync').mockImplementationOnce(() => JSON.stringify({
            minus: [{ max: 100, minus: 0 }],
            rates: [
                { max: null, minus: 0, rate: 0.45 },
                { max: 1949, minus: 0, rate: 0.05 },
            ],
        }));

        try {
            expect(calc(1000000)).toBe(51000);
        } finally {
            readFile.mockRestore();
        }
    });
});
