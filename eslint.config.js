const globals = require('globals');

const sharedRules = {
  semi: ['error', 'always'],
  quotes: ['error', 'single'],
  indent: ['error', 2, { SwitchCase: 1 }],
  'comma-dangle': ['error', 'never'],
  'no-var': 'off',
  'no-eval': 'error',
  'no-new-func': 'error',
  'no-global-assign': 'error',
  'no-unused-vars': ['warn', { args: 'none' }],
  'no-undef': 'error',
  'no-trailing-spaces': 'error',
  'eol-last': ['error', 'always']
};

const sharedLanguageOptions = {
  ecmaVersion: 2019,
  sourceType: 'script'
};

module.exports = [
  {
    files: ['src/client/*.js'],
    languageOptions: {
      ...sharedLanguageOptions,
      globals: {
        ...globals.browser
      }
    },
    rules: { ...sharedRules }
  },
  {
    files: ['src/server/**/*.js', 'src/cli/**/*.js'],
    languageOptions: {
      ...sharedLanguageOptions,
      globals: {
        ...globals.node
      }
    },
    rules: { ...sharedRules }
  },
  {
    files: ['examples/*.js'],
    languageOptions: {
      ...sharedLanguageOptions,
      globals: {
        ...globals.node,
        ...globals.browser
      }
    },
    rules: { ...sharedRules }
  }
];
