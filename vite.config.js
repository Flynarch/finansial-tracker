import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
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
    // ijinkan akses via tunnel (ngrok, dll.); tanpa ini Vite menolak Host header selain localhost
    allowedHosts: true,
  },
})
