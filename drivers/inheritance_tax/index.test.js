const calc = require('./index.js');

describe('inheritance tax driver', () => {
    test.each([
        [0, 0],
        [-1, 0],
        [NaN, 0],
        [Infinity, 0],
        [1, 0],
        [10000000, 1000000],
        [30000000, 4000000],
        [50000000, 8000000],
        [100000000, 23000000],
        [200000000, 63000000],
        [300000000, 108000000],
        [600000000, 258000000],
        [700000000, 313000000],
    ])('calculates taxable estate %i as %i yen tax', (income, expectedTax) => {
        expect(calc(income)).toBe(expectedTax);
    });

    test('returns positive zero when a small tax rounds down to zero', () => {
        const tax = calc(1);

        expect(tax).toBe(0);
        expect(Object.is(tax, -0)).toBe(false);
    });
});
