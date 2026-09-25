import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

// Páginas públicas com prévia própria ao compartilhar o link. WhatsApp/Facebook
// não executam JS — leem só as meta tags do HTML servido, que no SPA seriam as
// genéricas do index.html. Gera uma cópia do index.html buildado (mesmo bundle)
// com título/descrição/imagem trocados; o vercel.json reescreve a rota pra ela.
const SITE_URL = 'https://aionedu.com.br'
const SHARE_PAGES = [
  {
    path: '/novidades/captacao-inteligente',
    file: 'novidades/captacao-inteligente.html',
    title: 'Novidade: Captação Inteligente — Áion Edu',
    description: 'Saiba de qual anúncio veio cada matrícula. Cada conversa do WhatsApp chega marcada com a campanha de origem e vai direto pra pessoa certa.',
    image: '/novidades/img/captacao-og.jpg',
  },
]

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

function sharePreviewPages(): Plugin {
  let outDir = 'dist'
  return {
    name: 'share-preview-pages',
    apply: 'build',
    configResolved(cfg) { outDir = resolve(cfg.root, cfg.build.outDir) },
    closeBundle() {
      const base = readFileSync(resolve(outDir, 'index.html'), 'utf8')
      for (const p of SHARE_PAGES) {
        const url = `${SITE_URL}${p.path}`
        const meta = [
          `<title>${escapeAttr(p.title)}</title>`,
          `<meta name="description" content="${escapeAttr(p.description)}" />`,
          `<link rel="canonical" href="${url}" />`,
          `<meta property="og:type" content="article" />`,
          `<meta property="og:site_name" content="Áion Edu" />`,
          `<meta property="og:locale" content="pt_BR" />`,
          `<meta property="og:url" content="${url}" />`,
          `<meta property="og:title" content="${escapeAttr(p.title)}" />`,
          `<meta property="og:description" content="${escapeAttr(p.description)}" />`,
          `<meta property="og:image" content="${SITE_URL}${p.image}" />`,
          `<meta property="og:image:width" content="1200" />`,
          `<meta property="og:image:height" content="630" />`,
          `<meta name="twitter:card" content="summary_large_image" />`,
          `<meta name="twitter:title" content="${escapeAttr(p.title)}" />`,
          `<meta name="twitter:description" content="${escapeAttr(p.description)}" />`,
          `<meta name="twitter:image" content="${SITE_URL}${p.image}" />`,
        ].join('\n    ')
        const html = base
          .replace(/<html lang="[^"]*">/, '<html lang="pt-BR">')
          .replace(/\s*<meta property="og:image"[^>]*>/, '')
          .replace(/\s*<meta name="description"[^>]*>/, '')
          .replace(/<title>[\s\S]*?<\/title>/, meta)
        if (!html.includes('og:title')) throw new Error(`[share-preview-pages] <title> não encontrado no index.html (${p.file})`)
        const dest = resolve(outDir, p.file)
        mkdirSync(dirname(dest), { recursive: true })
        writeFileSync(dest, html)
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), sharePreviewPages()],
  base: '/',

  define: {
    global: 'globalThis',
  },

  resolve: {
    alias: {
      buffer: 'buffer/',
    },
  },

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
    include: ['react', 'react-dom', 'react-router-dom', '@react-pdf/renderer', 'buffer'],
  },
})
