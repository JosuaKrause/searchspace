import google from 'eslint-config-google';
import prettier from 'eslint-config-prettier/flat';
import html from 'eslint-plugin-html';
import globals from 'globals';

// eslint-config-google predates ESLint 9, which removed these rules.
const REMOVED_RULES = ['valid-jsdoc', 'require-jsdoc'];
const googleRules = Object.fromEntries(
  Object.entries(google.rules).filter(
    ([name]) => !REMOVED_RULES.includes(name),
  ),
);

export default [
  { ignores: ['lib/', '.claude/'] },
  {
    files: ['**/*.js', '**/*.html'],
    plugins: { html },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      ...googleRules,
      'no-implicit-globals': 'error',
      'no-undef': 'error',
    },
  },
  prettier,
];
