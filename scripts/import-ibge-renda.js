#!/usr/bin/env node
/**
 * scripts/import-ibge-renda.js
 *
 * Busca renda média domiciliar per capita por município (variável 9972,
 * agregado 9517, período 2022) via API IBGE SIDRA e atualiza a tabela
 * ibge_municipios com o campo renda_media.
 *
 * Uso:
 *   node scripts/import-ibge-renda.js
 *
 * Variáveis de ambiente (lidas de .env.local):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Fonte:
 *   https://servicodados.ibge.gov.br/api/v3/agregados/9517/periodos/2022/variaveis/9972/localidades/N6|all
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

const IBGE_API_URL =
  'https://servicodados.ibge.gov.br/api/v3/agregados/9517/periodos/2022/variaveis/9972/localidades/N6|all'

const BATCH_SIZE = 500

// ─── Buscar dados de renda da API IBGE ─────────────────────────────────────
async function fetchRenda() {
  console.log(`Buscando renda média municipal em:\n  ${IBGE_API_URL}\n`)
  const res = await fetch(IBGE_API_URL)
  if (!res.ok) throw new Error(`API IBGE retornou ${res.status}: ${res.statusText}`)
  const data = await res.json()

  // Navegar para o array de resultados da primeira variável
  const resultados = data?.[0]?.resultados
  if (!Array.isArray(resultados)) {
    throw new Error('Formato inesperado da resposta IBGE — campo "resultados" ausente.')
  }

  // Cada entry de resultados tem { localidades, series }
  const rows = []
  for (const entry of resultados) {
    // localidades pode ter chave N6 ou similar
    const localidades = entry.localidades ?? {}
    const localidadeKey = Object.keys(localidades)[0]
    if (!localidadeKey) continue

    const localidade = localidades[localidadeKey]
    const codigo = localidade?.codigo ? String(localidade.codigo) : null
    if (!codigo) continue

    const series = entry.series ?? []
    const valor  = series[0]?.valor ?? null
    const renda  = valor !== null && valor !== '-' ? parseFloat(String(valor).replace(',', '.')) : null
    if (codigo && renda !== null && !isNaN(renda)) {
      rows.push({ codigo_ibge: codigo, renda_media: renda })
    }
  }

  console.log(`API retornou ${resultados.length} entradas; ${rows.length} com renda válida.\n`)
  return rows
}

// ─── Atualizar em lotes ─────────────────────────────────────────────────────
async function updateBatches(rows) {
  let processed = 0
  let batchNum  = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    batchNum++
    const batch = rows.slice(i, i + BATCH_SIZE)

    // UPDATE paralelo dentro do batch
    const updates = await Promise.all(
      batch.map(({ codigo_ibge, renda_media }) =>
        supabase
          .from('ibge_municipios')
          .update({ renda_media })
          .eq('codigo_ibge', codigo_ibge)
      )
    )

    const erros = updates.filter(r => r.error)
    if (erros.length > 0) {
      erros.forEach(r => console.error(`  [erro] ${r.error.message}`))
    }

    processed += batch.length
    console.log(`Inserindo batch ${batchNum} — ${processed} municípios processados`)
  }

  return processed
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const rows = await fetchRenda()

  if (rows.length === 0) {
    console.warn('Nenhum dado de renda encontrado. Verifique a URL da API.')
    process.exit(0)
  }

  console.log(`Iniciando atualização de ${rows.length} municípios em lotes de ${BATCH_SIZE}...\n`)

  const total = await updateBatches(rows)

  console.log(`\nConcluído. Total de municípios atualizados: ${total}`)
}

main().catch(err => {
  console.error('Erro fatal:', err)
  process.exit(1)
})
