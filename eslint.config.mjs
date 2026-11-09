import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import jestPlugin from 'eslint-plugin-jest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const tsconfigRootDir = path.dirname(fileURLToPath(import.meta.url));

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
        languageOptions: {
            globals: globals.browser,
            parserOptions: { tsconfigRootDir },
        },
        plugins: {
            jest: jestPlugin,
        },
        rules: {
            'no-await-in-loop': 'error',
            'no-useless-escape': 'error',
            'no-constant-condition': ['error', { checkLoops: false }],
            'no-alert': 'error',
            eqeqeq: ['error', 'always', { null: 'ignore' }],
            'default-case': 'error',
            'array-callback-return': 'error',
            'require-atomic-updates': 'error',
            'no-var': 'error',
            'prefer-const': 'error',
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': 'error',
            '@typescript-eslint/no-namespace': 'off',
        },
    },
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    prettier,
    {
        files: ['**/*.{js,cjs}'],
        languageOptions: {
            globals: { ...globals.node },
            parserOptions: { tsconfigRootDir },
        },
        rules: { '@typescript-eslint/no-require-imports': 'off' },
    },
    {
        files: ['**/*.test.{js,ts}'],
        languageOptions: { globals: { ...globals.jest } },
    },
];
