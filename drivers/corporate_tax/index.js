const path = require('node:path');
const fs = require('node:fs');

/**
 * Calculate national corporation tax and local corporation tax for a small
 * domestic corporation using taxable income as the input.
 * @param {number} income Taxable income in yen.
 * @returns {number} Combined tax, rounded down to the nearest 100 yen.
 */
module.exports = function (income) {
    if (!Number.isFinite(income) || income <= 0) return 0;

    const taxRateInfo = JSON.parse(fs.readFileSync(path.join(__dirname, 'rate.json'), 'utf8'));
    const reducedIncome = Math.min(income, taxRateInfo.smallBusinessThreshold);
    const excessIncome = Math.max(0, income - taxRateInfo.smallBusinessThreshold);
    const corporationTax = reducedIncome * taxRateInfo.smallBusinessRate + excessIncome * taxRateInfo.standardRate;
    const localCorporateTax = corporationTax * taxRateInfo.localCorporateTaxRate;
    // Applies to tax years beginning on or after 2026-04-01.
    const defenseCorporateTax =
        Math.max(0, corporationTax - taxRateInfo.defenseTaxDeduction) * taxRateInfo.defenseTaxRate;

    return Math.floor((corporationTax + localCorporateTax + defenseCorporateTax) / 100) * 100;
};
