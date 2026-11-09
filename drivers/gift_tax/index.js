const path = require('node:path');
const fs = require('node:fs');

/**
 * Estimate calendar-year gift tax using the general rate table. Input is the
 * total value of gifts received by one person during the calendar year.
 * @param {number} income Total gift value in yen.
 * @returns {number} Estimated tax rounded down to the nearest 100 yen.
 */
module.exports = function (income) {
    if (!Number.isFinite(income) || income <= 0) return 0;

    const taxRateInfo = JSON.parse(fs.readFileSync(path.join(__dirname, 'rate.json'), 'utf8'));
    const taxableAmount = Math.max(0, income - taxRateInfo.annualBasicDeduction);
    if (taxableAmount === 0) return 0;

    const taxRate = taxRateInfo.rates.find(item => taxableAmount <= (item.max ?? Infinity));
    return Math.floor(Math.max(0, taxableAmount * taxRate.rate - taxRate.minus) / 100) * 100;
};
