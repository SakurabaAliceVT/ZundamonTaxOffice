/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

module.exports = {
    clearMocks: true,
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageProvider: 'v8',
    moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
    testRegex: String.raw`drivers[\\/].*\.test\.js$`,
    moduleFileExtensions: ['js'],
    collectCoverageFrom: ['drivers/**/*.js', '!drivers/**/*.test.js'],
};
