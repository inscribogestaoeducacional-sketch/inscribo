#!/usr/bin/env node
/**
 * Calcula a média do ENEM por escola a partir dos microdados (participantes com CO_ESCOLA informado)
 * e grava em enem_escola.
 *
 * Uso:  node scripts/import-enem-escola.mjs <microdados_enem_AAAA.zip> <ano> [--dry] [--min 10]
 * Fonte: https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/enem
 * Só entram escolas com pelo menos --min participantes (padrão 10) que fizeram todas as provas.
 * Participantes sem escola informada não entram (o relatório diz a cobertura).
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
const args = process.argv.slice(2)
const [zipPath, anoArg] = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--min')
const dry = args.includes('--dry')
const min = args.includes('--min') ? parseInt(args[args.indexOf('--min') + 1], 10) : 10
const ano = parseInt(anoArg, 10)
if (!zipPath || !ano) { console.error('Uso: node scripts/import-enem-escola.mjs <arquivo.zip> <ano> [--dry] [--min 10]'); process.exit(1) }
const sb = dry ? null : createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

function split(line, sep) { const r = []; let c = '', q = false; for (const ch of line) { if (ch === '"') q = !q; else if (ch === sep && !q) { r.push(c); c = '' } else c += ch } r.push(c); return r }
const num = (v) => { if (v == null || v === '') return null; const x = Number(String(v).replace(',', '.')); return Number.isFinite(x) ? x : null }

const lerCsv = async (entry, onHeader, onRow) => {
  const rl = createInterface({ input: entry, crlfDelay: Infinity })
  let idx = null, sep = ';'
  for await (const line of rl) {
    if (!line.trim()) continue
    if (!idx) {
      sep = line.includes(';') ? ';' : ','
      const h = split(line, sep).map((x) => x.trim().toUpperCase())
      idx = Object.fromEntries(h.map((x, i) => [x, i]))
      onHeader(idx, h); continue
    }
    onRow(split(line, sep), idx)
  }
}

const quem = new Map() // inscrição -> [co_escola, co_municipio_esc]
let total = 0, comEscola = 0, validos = 0, viuPart = false, viuRes = false
const acc = new Map()
const zip = createReadStream(resolve(zipPath)).pipe(unzipper.Parse({ forceStream: true }))
for await (const entry of zip) {
  const nome = entry.path
  if (/PARTICIPANTES_\d{4}\.csv$/i.test(nome)) {
    viuPart = true
    await lerCsv(entry, (idx, h) => {
      const need = ['NU_INSCRICAO', 'CO_ESCOLA']
      const miss = need.filter((c) => !(c in idx))
      if (miss.length) { console.error('PARTICIPANTES sem as colunas:', miss.join(', '), '\nColunas existentes:', h.join(', ')); process.exit(1) }
    }, (c, idx) => {
      total++
      const esc = c[idx.CO_ESCOLA]?.trim()
      if (!esc) return
      if (idx.IN_TREINEIRO !== undefined && c[idx.IN_TREINEIRO]?.trim() === '1') return
      comEscola++
      quem.set(Number(c[idx.NU_INSCRICAO]), [esc, idx.CO_MUNICIPIO_ESC !== undefined ? c[idx.CO_MUNICIPIO_ESC]?.trim() || null : null])
    })
    console.log(`  participantes: ${total} inscritos, ${comEscola} com escola informada`)
  } else if (/RESULTADOS_\d{4}\.csv$/i.test(nome)) {
    if (!viuPart) { console.error('RESULTADOS veio antes de PARTICIPANTES no zip; me avise.'); process.exit(1) }
    viuRes = true
    await lerCsv(entry, (idx, h) => {
      const need = ['NU_INSCRICAO', 'NU_NOTA_CN', 'NU_NOTA_CH', 'NU_NOTA_LC', 'NU_NOTA_MT', 'NU_NOTA_REDACAO']
      const miss = need.filter((c) => !(c in idx))
      if (miss.length) { console.error('RESULTADOS sem as colunas:', miss.join(', '), '\nColunas existentes:', h.join(', ')); process.exit(1) }
    }, (c, idx) => {
      const q = quem.get(Number(c[idx.NU_INSCRICAO])); if (!q) return
      const cn = num(c[idx.NU_NOTA_CN]), ch = num(c[idx.NU_NOTA_CH]), lc = num(c[idx.NU_NOTA_LC]), mt = num(c[idx.NU_NOTA_MT]), red = num(c[idx.NU_NOTA_REDACAO])
      if ([cn, ch, lc, mt, red].some((x) => x == null)) return
      validos++
      let a = acc.get(q[0]); if (!a) { a = { n: 0, cn: 0, ch: 0, lc: 0, mt: 0, red: 0, mun: q[1] }; acc.set(q[0], a) }
      a.n++; a.cn += cn; a.ch += ch; a.lc += lc; a.mt += mt; a.red += red
    })
  } else entry.autodrain()
}
if (!viuPart || !viuRes) { console.error('Não encontrei PARTICIPANTES e RESULTADOS dentro do zip.'); process.exit(1) }
const r1 = (x) => Math.round(x * 10) / 10
const rows = [...acc.entries()].filter(([, a]) => a.n >= min).map(([co, a]) => {
  const m = { cn: a.cn / a.n, ch: a.ch / a.n, lc: a.lc / a.n, mt: a.mt / a.n, red: a.red / a.n }
  return { co_entidade: co, ano, n_part: a.n, media_cn: r1(m.cn), media_ch: r1(m.ch), media_lc: r1(m.lc), media_mt: r1(m.mt), media_red: r1(m.red), media_geral: r1((m.cn + m.ch + m.lc + m.mt + m.red) / 5), co_municipio: a.mun }
})
if (!dry) {
  for (let i = 0; i < rows.length; i += 1000) {
    const { error } = await sb.from('enem_escola').upsert(rows.slice(i, i + 1000), { onConflict: 'co_entidade,ano' })
    if (error) { console.error('Erro:', error.message); process.exit(1) }
  }
  await sb.from('fonte_dados').upsert({ chave: `enem_escola_${ano}`, fonte: 'INEP — Microdados do ENEM (médias por escola calculadas)', ano, linhas: rows.length, observacao: `mín. ${min} participantes; ${comEscola} de ${total} inscritos tinham escola informada`, importado_em: new Date().toISOString() }, { onConflict: 'chave' })
}
console.log(`\nENEM ${ano}: ${total} inscritos, ${comEscola} com escola informada, ${validos} com as 5 notas. ${rows.length} escolas com ${min}+ participantes${dry ? ' (simulação)' : ' gravadas'}.`)
