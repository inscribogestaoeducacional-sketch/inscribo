import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    // Build otimizado para Vercel
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false,
    
    rollupOptions: {
      output: {
        // CRÍTICO: Sem chunks dinâmicos
        manualChunks: undefined,
        
        // Nomes estáveis (sem hash aleatório)
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    },
    
    // Evita problemas com chunks grandes
    chunkSizeWarningLimit: 10000,
  },
  
  server: {
    port: 3000,
    host: true,
    cors: true
  },
  
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom']
  }
})
