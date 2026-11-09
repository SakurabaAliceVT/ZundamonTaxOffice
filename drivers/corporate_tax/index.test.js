const calc = require('./index.js');

describe('corporate tax driver', () => {
    test.each([
        [0, 0],
        [-1, 0],
        [NaN, 0],
        [Infinity, 0],
        [1, 0],
        [1000000, 165400],
        [8000000, 1323600],
        [8000001, 1323600],
        [35000000, 8331300],
    ])('calculates taxable income %i as %i yen combined tax', (income, expectedTax) => {
        expect(calc(income)).toBe(expectedTax);
    });

    test('returns positive zero when the calculated tax rounds down to zero', () => {
        const tax = calc(1);

        expect(tax).toBe(0);
        expect(Object.is(tax, -0)).toBe(false);
    });
});
