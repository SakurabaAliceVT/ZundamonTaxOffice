const calc = require('./index.js');

describe('gift tax driver', () => {
    test.each([
        [0, 0],
        [-1, 0],
        [NaN, 0],
        [Infinity, 0],
        [1100000, 0],
        [1100001, 0],
        [3100000, 200000],
        [4100000, 350000],
        [5100000, 550000],
        [7100000, 1150000],
        [11100000, 2750000],
        [16100000, 5000000],
        [31100000, 12500000],
        [36100000, 15250000],
    ])('calculates gift value %i as %i yen tax', (income, expectedTax) => {
        expect(calc(income)).toBe(expectedTax);
    });

    test('returns positive zero when a small positive tax rounds down to zero', () => {
        const tax = calc(1100001);

        expect(tax).toBe(0);
        expect(Object.is(tax, -0)).toBe(false);
    });
});
