import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { demoApiPlugin } from './demo-server/helpers'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // The preview API is only mounted for `vite` (dev/preview) when the real
  // Express + MongoDB backend is not configured. Set DEMO_API=off to disable.
  const demoApi = env.VITE_DEMO_API !== 'off'

  return {
    plugins: [react(), tailwindcss(), demoApiPlugin({ enabled: demoApi })],
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: false,
      // Allow the Arena live-preview host and any tunnel domain.
      allowedHosts: true,
      // Falling back to the local Express API keeps `npm run dev` working for
      // developers who run the real server alongside Vite.
      proxy: demoApi ? undefined : { '/api': 'http://localhost:4000' },
    },
    preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
    build: {
      target: 'es2020',
      cssCodeSplit: true,
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            charts: ['recharts'],
            query: ['@tanstack/react-query'],
          },
        },
      },
    },
  }
})
