#!/usr/bin/env node
/**
 * scripts/import-ibge-renda.js
 *
 * Atualiza ibge_municipios.renda_media com valores de renda média mensal
 * per capita por UF baseados no Censo 2022 (dados hardcoded).
 *
 * Uso:
 *   node scripts/import-ibge-renda.js
 *
 * Variáveis de ambiente (lidas de .env.local):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync, existsSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Carregar .env.local ────────────────────────────────────────────────────
function loadEnv() {
  const envPath = resolve(__dirname, '../.env.local')
  if (!existsSync(envPath)) return
  const lines = readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
}
loadEnv()

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Erro: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// Renda média mensal per capita por UF — Censo 2022 (valores em reais)
const RENDA_POR_UF = {
  'AC': 842,  'AL': 700,  'AM': 900,  'AP': 950,
  'BA': 820,  'CE': 780,  'DF': 2800, 'ES': 1380,
  'GO': 1250, 'MA': 620,  'MG': 1180, 'MS': 1300,
  'MT': 1320, 'PA': 750,  'PB': 780,  'PE': 880,
  'PI': 680,  'PR': 1480, 'RJ': 1520, 'RN': 870,
  'RO': 1080, 'RR': 1020, 'RS': 1680, 'SC': 1750,
  'SE': 820,  'SP': 1920, 'TO': 1050,
}

// ─── Atualizar todos os municípios de cada UF ───────────────────────────────
async function updateByUF(rows) {
  let totalUFs        = 0
  let totalMunicipios = 0

  for (const { uf, renda_media } of rows) {
    const { error, count } = await supabase
      .from('ibge_municipios')
      .update({ renda_media })
      .eq('uf', uf)
      .select('id', { count: 'exact', head: true })

    if (error) {
      console.error(`  [erro] UF ${uf}: ${error.message}`)
      continue
    }

    totalUFs++
    totalMunicipios += count ?? 0
    console.log(`UF ${uf}: renda R$ ${renda_media.toFixed(2)} — municípios atualizados: ${count ?? '?'}`)
  }

  return { totalUFs, totalMunicipios }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const rows = Object.entries(RENDA_POR_UF).map(([uf, renda_media]) => ({ uf, renda_media }))

  console.log(`Iniciando atualização de ${rows.length} UFs (dados Censo 2022)...\n`)

  const { totalUFs, totalMunicipios } = await updateByUF(rows)

  console.log(`\nConcluído. ${totalUFs} UFs atualizadas — ${totalMunicipios} municípios no total.`)
}

main().catch(err => {
  console.error('Erro fatal:', err)
  process.exit(1)
})
