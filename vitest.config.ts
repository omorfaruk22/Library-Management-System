import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Mirrors the Vite flag so screen tests see the sample-data UI.
  define: { __SAMPLE_DATA__: 'true' },
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/dist-server/**', '**/.{git,idea,cache}/**'],
  },
})
