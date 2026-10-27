#!/usr/bin/env node
/**
 * Importa o Censo Escolar (INEP) de um ano para inep_escolas, com os campos extras
 * do Raio-X (professores, tempo integral, estrutura, matrículas por etapa).
 *
 * Uso:  node scripts/import-inep-historico.mjs <microdados_censo_escolar_AAAA.zip> <ano> [--dry]
 * Baixe o zip em: https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-escolar
 * Requer .env.local com SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
 * Colunas que não existirem naquele ano são listadas no fim (nada é inventado).
 */
import { readFileSync, existsSync, createReadStream } from 'fs'
import { createInterface } from 'readline'
import { createClient } from '@supabase/supabase-js'
import unzipper from 'unzipper'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')
if (existsSync(envPath)) for (const l of readFileSync(envPath, 'utf-8').split('\n')) {
  const t = l.trim(); if (!t || t.startsWith('#')) continue
  const i = t.indexOf('='); if (i > 0 && !process.env[t.slice(0, i).trim()]) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
}
const [zipPath, anoArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const dry = process.argv.includes('--dry')
const ano = parseInt(anoArg, 10)
if (!zipPath || !ano) { console.error('Uso: node scripts/import-inep-historico.mjs <arquivo.zip> <ano> [--dry]'); process.exit(1) }
const sb = dry ? null : createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const BASE = ['CO_ENTIDADE', 'NO_ENTIDADE', 'CO_MUNICIPIO', 'NO_MUNICIPIO', 'SG_UF', 'TP_DEPENDENCIA', 'TP_SITUACAO_FUNCIONAMENTO']
const MAT = { QT_MAT_BAS: 'qt_mat_total', QT_MAT_FUND: 'qt_mat_fund', QT_MAT_MED: 'qt_mat_med', QT_MAT_INF: 'qt_mat_inf' }
// vão para a coluna jsonb "dados"
const EXTRA = [
  'QT_MAT_INF_CRE', 'QT_MAT_INF_PRE', 'QT_MAT_FUND_AI', 'QT_MAT_FUND_AF',
  'QT_MAT_INF_INT', 'QT_MAT_FUND_INT', 'QT_MAT_MED_INT', 'QT_MAT_BAS_INT',
  'QT_DOC_BAS', 'QT_DOC_INF', 'QT_DOC_FUND', 'QT_DOC_MED', 'QT_TUR_BAS',
  'IN_BIBLIOTECA', 'IN_LABORATORIO_CIENCIAS', 'IN_LABORATORIO_INFORMATICA', 'IN_QUADRA_ESPORTES',
  'IN_PARQUE_INFANTIL', 'IN_BANDA_LARGA', 'IN_ALIMENTACAO', 'IN_AREA_VERDE', 'IN_PISCINA',
  'IN_ACESSIBILIDADE_RAMPAS', 'IN_INTERNET', 'QT_SALAS_UTILIZADAS', 'QT_PROF_PSICOLOGO',
]

function split(line, sep) {
  const r = []; let c = '', q = false
  for (const ch of line) { if (ch === '"') q = !q; else if (ch === sep && !q) { r.push(c); c = '' } else c += ch }
  r.push(c); return r
}

const entry = await new Promise((ok, no) => {
  createReadStream(resolve(zipPath)).pipe(unzipper.Parse()).on('entry', (e) => {
    if (/microdados_ed_basica_\d{4}\.csv$/i.test(e.path) && !/dicion/i.test(e.path)) ok(e); else e.autodrain()
  }).on('close', () => no(new Error('CSV microdados_ed_basica_AAAA.csv não encontrado no zip'))).on('error', no)
})

const rl = createInterface({ input: entry, crlfDelay: Infinity })
let idx = null, sep = ';', first = true, batch = [], lidas = 0, gravadas = 0, falta = new Set()
const flush = async () => {
  if (!batch.length || dry) { batch = []; return }
  let error
  for (let t = 1; t <= 4; t++) {
    ;({ error } = await sb.from('inep_escolas').upsert(batch, { onConflict: 'co_entidade,ano_censo' }))
    if (!error) break
    await new Promise((r) => setTimeout(r, 2000 * t))
  }
  if (error) { console.error('\nErro no lote:', error.message); process.exit(1) }
  gravadas += batch.length; batch = []
}
const n = (v) => { if (v == null || v === '') return null; const x = Number(String(v).replace(',', '.')); return Number.isFinite(x) ? x : null }
for await (const raw of rl) {
  const line = raw
  if (!line.trim()) continue
  if (first) {
    sep = line.includes(';') ? ';' : ','
    const h = split(line, sep).map((x) => x.trim().toUpperCase())
    idx = Object.fromEntries(h.map((x, i) => [x, i]))
    for (const c of [...BASE, ...Object.keys(MAT), ...EXTRA]) if (!(c in idx)) falta.add(c)
    if (!('CO_ENTIDADE' in idx)) { console.error('CO_ENTIDADE não encontrada'); process.exit(1) }
    first = false; continue
  }
  const c = split(line, sep)
  const g = (k) => (k in idx ? c[idx[k]]?.trim() : undefined)
  const dados = {}
  for (const k of EXTRA) if (k in idx) dados[k.toLowerCase()] = n(g(k))
  batch.push({
    co_entidade: g('CO_ENTIDADE'), no_entidade: g('NO_ENTIDADE'), co_municipio: g('CO_MUNICIPIO'), no_municipio: g('NO_MUNICIPIO'),
    sg_uf: g('SG_UF'), tp_dependencia: n(g('TP_DEPENDENCIA')), tp_situacao_funcionamento: n(g('TP_SITUACAO_FUNCIONAMENTO')),
    qt_mat_total: n(g('QT_MAT_BAS')) ?? 0, qt_mat_fund: n(g('QT_MAT_FUND')) ?? 0, qt_mat_med: n(g('QT_MAT_MED')) ?? 0, qt_mat_inf: n(g('QT_MAT_INF')) ?? 0,
    ano_censo: ano, dados,
  })
  lidas++
  if (batch.length >= 200) { await flush(); process.stdout.write(`\r  lidas ${lidas}  gravadas ${gravadas}`) }
}
await flush()
if (!dry) await sb.from('fonte_dados').upsert({ chave: `inep_censo_${ano}`, fonte: 'INEP — Microdados do Censo Escolar', ano, linhas: gravadas, importado_em: new Date().toISOString() }, { onConflict: 'chave' })
console.log(`\n\nAno ${ano}: ${lidas} escolas lidas${dry ? ' (simulação, nada gravado)' : `, ${gravadas} gravadas`}.`)
console.log(falta.size ? `Colunas que NÃO existem neste ano (ficam vazias): ${[...falta].join(', ')}` : 'Todas as colunas esperadas existem.')
