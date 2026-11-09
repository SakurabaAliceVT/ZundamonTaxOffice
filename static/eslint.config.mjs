import globals from 'globals';
import pluginJs from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jestPlugin from 'eslint-plugin-jest';

export default [
    {
        ignores: [
            '**/node_modules/**',
            '**/dist/**',
            '**/public/**',
            '*.mjs',
            '*.cjs',
            'jest.config.js',
            'eslint.config.mjs',
        ],
    },
    {
        files: ['**/*.{js,mjs,cjs,ts}'],
        languageOptions: { globals: globals.browser },
        plugins: {
            jest: jestPlugin,
        },
        rules: {
            'no-await-in-loop': 'error',
            'no-useless-escape': 'error',
            'no-constant-condition': ['error', { checkLoops: false }],
            eqeqeq: ['error', 'always', { null: 'ignore' }],
            'default-case': 'error',
            'array-callback-return': 'error',
            'require-atomic-updates': 'error',
            'no-var': 'error',
            'prefer-const': 'error',
            'no-unused-vars': 'off',
        },
    },
    pluginJs.configs.recommended,
    prettier,
    {
        files: ['**/*.{js,cjs}'],
        languageOptions: { globals: { ...globals.browser, ...globals.node } },
    },
];
