#!/usr/bin/env node
/**
 * Calcula a média do ENEM por escola e grava em enem_escola.
 * Fonte: Microdados do ENEM (INEP), arquivo DADOS/RESULTADOS_AAAA.csv, que traz CO_ESCOLA,
 * TP_DEPENDENCIA_ADM_ESC, CO_MUNICIPIO_ESC e as notas de cada participante.
 *
 * Uso:  node scripts/import-enem-escola.mjs <RESULTADOS_AAAA.csv> <ano> [--dry] [--min 10]
 * (extraia o zip antes — o arquivo usa compressão que o Node não lê; use o Explorador de Arquivos)
 *
 * Regras: só entram participantes com escola informada e as 5 notas (CN, CH, LC, MT, redação).
 * Só ficam escolas com pelo menos --min participantes (padrão 10).
 * Requer .env.local com SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
 */
import { readFileSync, existsSync, createReadStream } from 'fs'
import { createInterface } from 'readline'
import { createClient } from '@supabase/supabase-js'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')
if (existsSync(envPath)) for (const l of readFileSync(envPath, 'utf-8').split('\n')) {
  const t = l.trim(); if (!t || t.startsWith('#')) continue
  const i = t.indexOf('='); if (i > 0 && !process.env[t.slice(0, i).trim()]) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
}
const args = process.argv.slice(2)
const [csvPath, anoArg] = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--min')
const dry = args.includes('--dry')
const min = args.includes('--min') ? parseInt(args[args.indexOf('--min') + 1], 10) : 10
const ano = parseInt(anoArg, 10)
if (!csvPath || !ano) { console.error('Uso: node scripts/import-enem-escola.mjs <RESULTADOS_AAAA.csv> <ano> [--dry] [--min 10]'); process.exit(1) }
if (!existsSync(csvPath)) { console.error('Arquivo não encontrado:', csvPath); process.exit(1) }
const sb = dry ? null : createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const num = (v) => { if (v == null || v === '') return null; const x = Number(v.replace(',', '.')); return Number.isFinite(x) ? x : null }
const rl = createInterface({ input: createReadStream(resolve(csvPath), { encoding: 'utf-8' }), crlfDelay: Infinity })
let idx = null, total = 0, comEscola = 0, validos = 0
const acc = new Map()
const NEED = ['CO_ESCOLA', 'CO_MUNICIPIO_ESC', 'SG_UF_ESC', 'TP_DEPENDENCIA_ADM_ESC', 'NU_NOTA_CN', 'NU_NOTA_CH', 'NU_NOTA_LC', 'NU_NOTA_MT', 'NU_NOTA_REDACAO']
const COMPS = ['NU_NOTA_COMP1', 'NU_NOTA_COMP2', 'NU_NOTA_COMP3', 'NU_NOTA_COMP4', 'NU_NOTA_COMP5']
for await (const line of rl) {
  if (!line) continue
  const c = line.split(';')
  if (!idx) {
    idx = Object.fromEntries(c.map((x, i) => [x.replace(/"/g, '').trim().toUpperCase(), i]))
    const miss = NEED.filter((k) => !(k in idx))
    if (miss.length) { console.error('Colunas ausentes:', miss.join(', '), '\nColunas existentes:', Object.keys(idx).join(', ')); process.exit(1) }
    continue
  }
  total++
  if (total % 250000 === 0) process.stdout.write(`\r  linhas ${total}`)
  const esc = c[idx.CO_ESCOLA]
  if (!esc) continue
  comEscola++
  const cn = num(c[idx.NU_NOTA_CN]), ch = num(c[idx.NU_NOTA_CH]), lc = num(c[idx.NU_NOTA_LC]), mt = num(c[idx.NU_NOTA_MT]), red = num(c[idx.NU_NOTA_REDACAO])
  if ([cn, ch, lc, mt, red].some((x) => x == null)) continue
  validos++
  let a = acc.get(esc)
  if (!a) { a = { n: 0, cn: 0, ch: 0, lc: 0, mt: 0, red: 0, cp: [0, 0, 0, 0, 0], np: 0, mun: c[idx.CO_MUNICIPIO_ESC] || null, uf: c[idx.SG_UF_ESC] || null, dep: num(c[idx.TP_DEPENDENCIA_ADM_ESC]) }; acc.set(esc, a) }
  a.n++; a.cn += cn; a.ch += ch; a.lc += lc; a.mt += mt; a.red += red
  const cp = COMPS.map((k) => (k in idx ? num(c[idx[k]]) : null))
  if (cp.every((x) => x != null)) { a.np++; for (let i = 0; i < 5; i++) a.cp[i] += cp[i] }
}
const r1 = (x) => Math.round(x * 10) / 10
const rows = [...acc.entries()].filter(([, a]) => a.n >= min).map(([co, a]) => {
  const m = { cn: a.cn / a.n, ch: a.ch / a.n, lc: a.lc / a.n, mt: a.mt / a.n, red: a.red / a.n }
  return {
    co_entidade: co, ano, n_part: a.n, media_cn: r1(m.cn), media_ch: r1(m.ch), media_lc: r1(m.lc), media_mt: r1(m.mt), media_red: r1(m.red),
    media_geral: r1((m.cn + m.ch + m.lc + m.mt + m.red) / 5), co_municipio: a.mun, sg_uf: a.uf, tp_dependencia: a.dep,
    media_comp: a.np ? { n: a.np, c: a.cp.map((x) => r1(x / a.np)) } : null,
  }
})
const priv = rows.filter((r) => r.tp_dependencia === 4).length
if (!dry) {
  for (let i = 0; i < rows.length; i += 300) {
    let error
    for (let t = 1; t <= 4; t++) {
      ;({ error } = await sb.from('enem_escola').upsert(rows.slice(i, i + 300), { onConflict: 'co_entidade,ano' }))
      if (!error) break
      await new Promise((r) => setTimeout(r, 2000 * t))
    }
    if (error) { console.error('\nErro:', error.message); process.exit(1) }
  }
  await sb.from('fonte_dados').upsert({ chave: `enem_escola_${ano}`, fonte: 'INEP — Microdados do ENEM (RESULTADOS), médias por escola calculadas pela Áion', ano, linhas: rows.length, observacao: `mín. ${min} participantes com as 5 notas; ${comEscola} de ${total} linhas tinham escola`, importado_em: new Date().toISOString() }, { onConflict: 'chave' })
}
console.log(`\n\nENEM ${ano}: ${total} linhas, ${comEscola} com escola informada, ${validos} com as 5 notas.`)
console.log(`${rows.length} escolas com ${min}+ participantes (${priv} particulares)${dry ? ' — simulação, nada gravado' : ' gravadas'}.`)
