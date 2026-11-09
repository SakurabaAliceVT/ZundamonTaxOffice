/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

module.exports = {
    clearMocks: true,
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageProvider: 'v8',
    extensionsToTreatAsEsm: ['.ts'],
    transform: {
        '^.+\\.tsx?$': ['ts-jest', { useESM: true, tsconfig: 'tsconfig.json' }],
    },
    moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
    testRegex: String.raw`src[\\/].*\.test\.ts$`,
    moduleFileExtensions: ['ts', 'js', 'json', 'node'],
    collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts'],
};
