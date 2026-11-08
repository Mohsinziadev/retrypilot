import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage', 'demo', 'site-dist', 'scripts/build-site.mjs'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    // The portable entry points must stay free of Node-only APIs.
    files: ['src/**/*.ts'],
    ignores: ['src/node.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['node:*'] }],
      'no-restricted-globals': ['error', 'process', 'Buffer', 'require', '__dirname'],
    },
  },
  { files: ['**/*.{js,mjs}'], ...tseslint.configs.disableTypeChecked },
);
