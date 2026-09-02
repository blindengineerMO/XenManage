const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    ignores: ['client/dist/**', 'node_modules/**', 'data/**', 'coverage/**'],
  },
  {
    files: ['server/**/*.js', 'scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: globals.node,
    },
    rules: {
      'no-undef': 'error',
      'no-unreachable': 'error',
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      'no-undef': 'error',
      'no-unreachable': 'error',
    },
  },
  {
    files: ['tests/e2e/**/*.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest, ...globals.browser },
    },
  },
];
