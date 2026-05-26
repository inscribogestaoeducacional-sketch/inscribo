#!/usr/bin/env node
/**
 * scripts/import-ibge-municipios.js
 *
 * Importa todos os municípios do Brasil via API IBGE e insere
 * na tabela ibge_municipios do Supabase.
 *
 * Uso:
 *   node scripts/import-ibge-municipios.js
 *
 * Variáveis de ambiente (lidas de .env.local):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Fonte:
 *   https://servicodados.ibge.gov.br/api/v1/localidades/municipios
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

const IBGE_API_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades/municipios'
const BATCH_SIZE   = 500

// ─── Garantir que a tabela existe ───────────────────────────────────────────
async function ensureTable() {
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS ibge_municipios (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        codigo_ibge TEXT NOT NULL UNIQUE,
        nome TEXT NOT NULL,
        uf TEXT NOT NULL,
        nome_estado TEXT,
        lat DECIMAL(10,7),
        lng DECIMAL(10,7),
        populacao INT,
        renda_media DECIMAL(10,2),
        ano_referencia INT DEFAULT 2022,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      ALTER TABLE ibge_municipios DISABLE ROW LEVEL SECURITY;
    `
  })
  if (error) {
    // exec_sql pode não existir — tentar via raw query direto
    console.warn('[setup] exec_sql não disponível, tentando upsert direto. Certifique-se de criar a tabela via migration antes.')
    console.warn('[setup] detalhe:', error.message)
  } else {
    console.log('[setup] Tabela ibge_municipios verificada/criada.')
  }
}

// ─── Buscar municípios da API IBGE ──────────────────────────────────────────
async function fetchMunicipios() {
  console.log(`Buscando municípios em ${IBGE_API_URL} ...`)
  const res = await fetch(IBGE_API_URL)
  if (!res.ok) throw new Error(`API IBGE retornou ${res.status}: ${res.statusText}`)
  const data = await res.json()
  console.log(`API IBGE retornou ${data.length} municípios.`)
  return data
}

// ─── Transformar registro IBGE → linha da tabela ────────────────────────────
function transform(m) {
  const uf     = m.microrregiao?.mesorregiao?.UF?.sigla ?? ''
  const estado = m.microrregiao?.mesorregiao?.UF?.nome  ?? ''
  return {
    codigo_ibge:   String(m.id),
    nome:          m.nome,
    uf,
    nome_estado:   estado || null,
    lat:           null,
    lng:           null,
    populacao:     null,
    renda_media:   null,
    ano_referencia: 2022,
  }
}

// ─── Inserir em lotes com upsert ─────────────────────────────────────────────
async function insertBatches(rows) {
  let processed = 0
  let batchNum  = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    batchNum++
    const batch = rows.slice(i, i + BATCH_SIZE)

    const { error } = await supabase
      .from('ibge_municipios')
      .upsert(batch, { onConflict: 'codigo_ibge', ignoreDuplicates: false })

    if (error) {
      console.error(`[batch ${batchNum}] Erro:`, error.message)
    } else {
      processed += batch.length
      console.log(`Inserindo batch ${batchNum} — ${processed} municípios processados`)
    }
  }

  return processed
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  await ensureTable()

  const raw  = await fetchMunicipios()
  const rows = raw.map(transform)

  console.log(`\nIniciando inserção de ${rows.length} municípios em lotes de ${BATCH_SIZE}...\n`)

  const total = await insertBatches(rows)

  console.log(`\nConcluído. Total de municípios inseridos/atualizados: ${total}`)
}

main().catch(err => {
  console.error('Erro fatal:', err)
  process.exit(1)
})
