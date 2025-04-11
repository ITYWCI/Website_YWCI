module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'google',
  ],
  rules: {
    'quotes': ['error', 'single'],
    'linebreak-style': 0,
    'indent': ['error', 2],
    'object-curly-spacing': ['error', 'never'],
    'max-len': ['error', {code: 120}],
    'require-jsdoc': 0,
  },
  parserOptions: {
    ecmaVersion: 2020,
  },
};
