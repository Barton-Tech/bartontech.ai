// The widely adopted baseline: eslint:recommended, applied to everything the
// pipeline executes. Style is not linted (the code has a house style already);
// this catches real defects: unused bindings, unsafe equality, unreachable
// code, accidental globals.
import js from '@eslint/js';

export default [
  { ignores: ['dist/**', 'data/**', 'node_modules/**', 'assets/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { console: 'readonly', process: 'readonly', URL: 'readonly', fetch: 'readonly', structuredClone: 'readonly', Buffer: 'readonly' },
    },
    rules: {
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-console': 'off',
    },
  },
];
