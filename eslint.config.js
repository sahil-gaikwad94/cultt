import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/**', 'src/legacy.ts', 'supabase/functions/**', 'node_modules/**'],
  },
  {
    // Node tooling lives in scripts/ and runs outside the browser bundle.
    files: ['scripts/**'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly', URL: 'readonly' } },
  },
);
