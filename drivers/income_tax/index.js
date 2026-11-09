const path = require('node:path');
const fs = require('node:fs');

/**
 *
 * @param {number} income
 * @returns {number}
 */
module.exports = function (income) {
    /**
     * @type {{name: string, function: string, minus: { max: number, minus: number }[], rates: { max?: number, minus: number, rate: number }[]}}
     */
    const taxRateInfo = JSON.parse(fs.readFileSync(path.join(__dirname, 'rate.json'), 'utf8'));
    const taxReturnForm25Data = taxRateInfo.minus
        .filter(item => income <= item.max * 10000)
        .sort((a, b) => a.max - b.max)[0];
    const taxReturnForm31 = Math.floor((income - taxReturnForm25Data.minus * 10000) / 1000) * 1000;
    const taxRate = taxRateInfo.rates
        .filter(item => taxReturnForm31 <= (item.max == null ? Infinity : item.max * 1000))
        .sort((a, b) => (a.max ?? Infinity) - (b.max ?? Infinity))[0];
    const taxReturnForm32 = taxReturnForm31 * taxRate.rate - taxRate.minus * 1000;
    const taxReturnForm45 = taxReturnForm32 * 0.021;
    const taxReturnForm46 = taxReturnForm32 + taxReturnForm45;
    return Math.floor(taxReturnForm46 / 100) * 100;
};
