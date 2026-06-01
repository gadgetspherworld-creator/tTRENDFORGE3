import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['apps/**/src/__tests__/**/*.test.ts', 'packages/**/src/__tests__/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['apps/**/src/**/*.ts', 'packages/**/src/**/*.ts'],
      exclude: ['**/__tests__/**', '**/dist/**', '**/node_modules/**'],
      thresholds: {
        global: {
          branches: 60,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@trendforge/types': resolve(__dirname, 'packages/types/src/index.ts'),
      '@trendforge/database': resolve(__dirname, 'packages/database/src/index.ts'),
      '@trendforge/logger': resolve(__dirname, 'packages/logger/src/index.ts'),
    },
  },
});
