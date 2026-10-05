import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function pruneHeavyModulepreloadPlugin() {
  return {
    name: 'prune-heavy-modulepreload',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html.replace(
          /<link rel="modulepreload"[^>]*href="[^"]*(vendor-calendar|vendor-markdown|vendor-firebase)[^"]*"[^>]*>\s*/g,
          ''
        )
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), pruneHeavyModulepreloadPlugin()],
  build: {
    modulePreload: {
      resolveDependencies(filename, deps) {
        return deps.filter(
          (dep) =>
            !dep.includes('vendor-calendar') &&
            !dep.includes('vendor-markdown') &&
            !dep.includes('vendor-firebase')
        )
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('pdfjs-dist')) return 'vendor-pdfjs'
          if (id.includes('jspdf')) return 'vendor-jspdf'
          if (id.includes('react-markdown') || id.includes('remark-') || id.includes('micromark') || id.includes('mdast') || id.includes('unist')) return 'vendor-markdown'
          if (id.includes('papaparse')) return 'vendor-csv'
          if (id.includes('@capacitor') || id.includes('@aparajita')) return 'vendor-capacitor'
          if (id.includes('react-big-calendar')) return 'vendor-calendar'
          if (id.includes('recharts')) return 'vendor-recharts'
          if (id.includes('firebase')) return 'vendor-firebase'
          if (id.includes('dexie')) return 'vendor-dexie'
          if (id.includes('lucide-react')) return 'vendor-icons'
          if (id.includes('date-fns')) return 'vendor-date'
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) return 'vendor-react'
          return 'vendor-misc'
        },
      },
    },
  },
  server: {
    host: true,
    // Batasi akses host ke localhost dan domain tunnel development yang umum
    allowedHosts: ['.ngrok-free.app', '.ngrok.io', '.loca.lt', 'localhost', '127.0.0.1'],
  },
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'android/**',
        'tests/**',
        'scripts/**',
        '**/*.config.js',
        '**/*.config.mjs',
      ],
    },
  },
})
