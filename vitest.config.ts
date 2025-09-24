import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: [
      'src/**/*.test.{js,ts}',
      'tests/**/*.{test,spec}.{js,ts}',
      'src/**/*.spec.{js,ts}'
    ],
    exclude: [
      'node_modules',
      'build',
      '.svelte-kit'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        'build/',
        '.svelte-kit/',
        'vite.config.ts',
        'vitest.config.ts'
      ]
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    threads: false, // Disable threading for better debugging
    isolate: false
  },
  resolve: {
    alias: {
      '$lib': '/src/lib',
      '$app': '/node_modules/@sveltejs/kit/src/runtime/app'
    }
  }
});