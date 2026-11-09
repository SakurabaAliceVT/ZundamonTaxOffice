const path = require('node:path');
const fs = require('node:fs');

/**
 * Estimate inheritance tax for a sole heir. The input is the taxable estate
 * after the basic exemption, treated as one heir's statutory-share amount.
 * @param {number} income Taxable estate amount in yen.
 * @returns {number} Estimated tax rounded down to the nearest 100 yen.
 */
module.exports = function (income) {
    if (!Number.isFinite(income) || income <= 0) return 0;

    const taxRateInfo = JSON.parse(fs.readFileSync(path.join(__dirname, 'rate.json'), 'utf8'));
    const taxRate = taxRateInfo.rates.find(item => income <= (item.max ?? Infinity));
    const roundedTax = Math.floor(Math.max(0, income * taxRate.rate - taxRate.minus) / 100) * 100;
    return roundedTax === 0 ? 0 : roundedTax;
};
