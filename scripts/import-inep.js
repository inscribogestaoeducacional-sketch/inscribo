#!/usr/bin/env node
/**
 * scripts/import-inep.js
 *
 * Importa microdados do Censo Escolar INEP para a tabela inep_escolas.
 * Processa o CSV em streaming (suporta arquivos de centenas de MB).
 *
 * Uso:
 *   node scripts/import-inep.js <arquivo.csv> <ano>
 *
 * Exemplo:
 *   node scripts/import-inep.js ./microdados_ed_basica_2023.csv 2023
 *
 * Variáveis de ambiente (lidas de .env.local):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Fonte dos microdados:
 *   https://dados.gov.br/dados/conjuntos-dados/microdados-do-censo-escolar-da-educacao-basica
 */

import { createReadStream, readFileSync, existsSync } from 'fs'
import { createInterface } from 'readline'
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

// ─── Mapeamento de colunas CSV → coluna na tabela ───────────────────────────
const INEP_COL_MAP = {
  CO_ENTIDADE:               'co_entidade',
  NO_ENTIDADE:               'no_entidade',
  CO_MUNICIPIO:              'co_municipio',
  NO_MUNICIPIO:              'no_municipio',
  SG_UF:                     'sg_uf',
  TP_DEPENDENCIA:            'tp_dependencia',
  TP_SITUACAO_FUNCIONAMENTO: 'tp_situacao_funcionamento',
  QT_MAT_TOTAL:              'qt_mat_total',
  QT_MAT_BAS:               'qt_mat_total',  // Tabela_Matricula: total geral
  QT_MAT_FUND:               'qt_mat_fund',
  QT_MAT_MED:                'qt_mat_med',
  QT_MAT_INF:                'qt_mat_inf',
  LAT:                       'lat',
  LNG:                       'lng',
  NU_LATITUDE:               'lat',   // nome alternativo em algumas versões
  NU_LONGITUDE:              'lng',
}

// ─── Parser de linha CSV (suporta campos entre aspas) ───────────────────────
function parseCSVLine(line, sep) {
  const result = []
  let current = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuote = !inQuote
    } else if (ch === sep && !inQuote) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

// ─── Barra de progresso simples ─────────────────────────────────────────────
function progress(processed, inserted, errors) {
  process.stdout.write(
    `\r  Lidos: ${processed.toLocaleString('pt-BR').padStart(10)}` +
    `  |  Inseridos: ${inserted.toLocaleString('pt-BR').padStart(10)}` +
    `  |  Erros: ${errors}   `
  )
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2)
  const fileIndex = args.indexOf('--file')
  const tipoIndex = args.indexOf('--tipo')
  const anoIndex  = args.indexOf('--ano')

  const filePath = fileIndex !== -1 ? args[fileIndex + 1] : null
  const tipo     = tipoIndex !== -1 ? args[tipoIndex + 1] : null
  const ano      = anoIndex  !== -1 ? parseInt(args[anoIndex + 1]) : null

  if (!filePath || !tipo || !ano) {
    console.error('Uso: node import-inep.js --file "caminho.csv" --tipo escola --ano 2025')
    process.exit(1)
  }

  const csvPath = resolve(filePath)
  const anoCenso = ano

  if (!existsSync(csvPath)) {
    console.error(`Arquivo não encontrado: ${csvPath}`)
    process.exit(1)
  }
  if (isNaN(anoCenso) || anoCenso < 2010 || anoCenso > 2030) {
    console.error(`Ano inválido: ${ano}  (esperado entre 2010 e 2030)`)
    process.exit(1)
  }

  console.log('\n━━━  Importação INEP — Censo Escolar  ━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  Arquivo : ${csvPath}`)
  console.log(`  Ano     : ${anoCenso}`)
  console.log(`  Destino : ${SUPABASE_URL}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // Registrar início no log
  const { data: logData } = await supabase
    .from('inep_import_logs')
    .insert({ tipo: 'censo_escolar', ano_censo: anoCenso, status: 'processing', total_registros: 0 })
    .select('id')
    .single()
  const logId = logData?.id ?? null

  // Estado do parser
  let header = null
  let colIdx = {}
  let sep = ';'
  let firstLine = true

  // Estado do lote
  const BATCH_SIZE = 500
  let batch = []
  let totalProcessed = 0
  let totalInserted = 0
  let totalErrors = 0

  const flush = async () => {
    if (batch.length === 0) return
    let error
    if (tipo === 'matricula') {
      const { error: rpcError } = await supabase.rpc('update_matriculas_batch', {
        records: batch.map(r => ({
          co_entidade:  r.co_entidade,
          qt_mat_total: r.qt_mat_total,
          qt_mat_inf:   r.qt_mat_inf,
          qt_mat_fund:  r.qt_mat_fund,
          qt_mat_med:   r.qt_mat_med,
        })),
        p_ano: anoCenso,
      })
      error = rpcError
    } else {
      const { error: upsertError } = await supabase
        .from('inep_escolas')
        .upsert(batch, { onConflict: 'co_entidade,ano_censo', ignoreDuplicates: false })
      error = upsertError
    }
    if (error) {
      console.error(`\n  Erro no lote: ${error.message}`)
      totalErrors++
    } else {
      totalInserted += batch.length
    }
    batch = []
  }

  // Stream linha a linha — suporta arquivos grandes sem carregar na memória
  const stream = createReadStream(csvPath, { encoding: 'latin1' })
  const rl = createInterface({ input: stream, crlfDelay: Infinity })

  for await (const line of rl) {
    if (!line.trim()) continue

    // ── Linha de cabeçalho ──────────────────────────────────────────────────
    if (firstLine) {
      sep = line.includes(';') ? ';' : ','
      const headerRaw = parseCSVLine(line, sep)
      header = headerRaw.map(h => h.replace(/^"|"$/g, '').trim().toUpperCase())

      header.forEach((h, i) => {
        const mapped = INEP_COL_MAP[h]
        if (mapped && !(mapped in colIdx)) colIdx[mapped] = i
      })

      if (!('co_entidade' in colIdx)) {
        const sample = header.slice(0, 12).join(', ')
        console.error(`Coluna CO_ENTIDADE não encontrada.\nPrimeiras colunas: ${sample} ...`)
        if (logId) {
          await supabase.from('inep_import_logs')
            .update({ status: 'error', erro: 'CO_ENTIDADE não encontrada no CSV' })
            .eq('id', logId)
        }
        process.exit(1)
      }

      console.log(`Separador    : "${sep}"`)
      console.log(`Colunas lidas: ${Object.keys(colIdx).join(', ')}\n`)
      firstLine = false
      continue
    }

    // ── Linha de dados ──────────────────────────────────────────────────────
    const cols = parseCSVLine(line, sep)

    const g = (key) => {
      const idx = colIdx[key]
      if (idx === undefined) return null
      const v = cols[idx]?.replace(/^"|"$/g, '').trim()
      return v || null
    }
    const toInt = (key) => {
      const v = g(key) ?? ''
      const n = parseInt(v, 10)
      return isNaN(n) ? 0 : n
    }
    const toFloat = (key) => {
      const v = g(key)
      if (!v) return null
      const n = parseFloat(v.replace(',', '.'))
      return isNaN(n) ? null : n
    }

    const coEntidade = g('co_entidade')
    if (!coEntidade) continue

    const qt_mat_total = toInt('qt_mat_total')
    const qt_mat_inf   = toInt('qt_mat_inf')
    const qt_mat_fund  = toInt('qt_mat_fund')
    const qt_mat_med   = toInt('qt_mat_med')

    if (totalProcessed === 0) {
      console.log('[DEBUG] primeira linha:', { co_entidade: coEntidade, qt_mat_total, qt_mat_inf, qt_mat_fund, qt_mat_med })
    }

    batch.push({
      co_entidade:               coEntidade,
      no_entidade:               g('no_entidade'),
      co_municipio:              g('co_municipio'),
      no_municipio:              g('no_municipio'),
      sg_uf:                     g('sg_uf'),
      tp_dependencia:            toInt('tp_dependencia'),
      tp_situacao_funcionamento: toInt('tp_situacao_funcionamento'),
      qt_mat_total,
      qt_mat_fund,
      qt_mat_med,
      qt_mat_inf,
      lat:                       toFloat('lat'),
      lng:                       toFloat('lng'),
      ano_censo:                 anoCenso,
    })

    totalProcessed++

    if (batch.length >= BATCH_SIZE) {
      await flush()
      progress(totalProcessed, totalInserted, totalErrors)
    }
  }

  // Flush do último lote parcial
  await flush()
  progress(totalProcessed, totalInserted, totalErrors)

  // Atualizar log com resultado final
  if (logId) {
    await supabase.from('inep_import_logs')
      .update({
        status: totalErrors > 0 ? 'error' : 'completed',
        total_registros: totalInserted,
        erro: totalErrors > 0 ? `${totalErrors} lotes com erro` : null,
      })
      .eq('id', logId)
  }

  console.log('\n\n━━━  Resultado  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  Linhas lidas    : ${totalProcessed.toLocaleString('pt-BR')}`)
  console.log(`  Registros no DB : ${totalInserted.toLocaleString('pt-BR')}`)
  console.log(`  Lotes com erro  : ${totalErrors}`)
  console.log(`  Status          : ${totalErrors > 0 ? 'PARCIAL (ver logs)' : 'OK'}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  process.exit(totalErrors > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('\nErro fatal:', err.message)
  process.exit(1)
})
