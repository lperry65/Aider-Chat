// ESLint v9 configuration for TypeScript VS Code extension
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        project: './tsconfig.json'
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin
    },
    rules: {
      // Use the plugin's recommended rules as base
      ...tsPlugin.configs.recommended.rules,
      
      // Our custom overrides
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn', // Warn instead of error for VS Code extension
      
      // JavaScript rules
      'prefer-const': 'error',
      'no-var': 'error',
      'no-console': 'off', // Allow console in VS Code extension
      'eqeqeq': 'error',
      'curly': 'error',
      'quotes': ['error', 'single'],
      'semi': ['error', 'always']
    }
  },
  {
    ignores: [
      'out/**',
      'dist/**', 
      'node_modules/**',
      '*.d.ts',
      '*.js'
    ]
  }
];
