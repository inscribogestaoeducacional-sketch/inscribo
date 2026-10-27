#!/usr/bin/env node
/**
 * scripts/import-coordenadas-escolas.mjs
 *
 * Importa as coordenadas das escolas (Censo Escolar 2025) para inep_escolas.
 * Fonte: Ipea / geobr (geobr_prep_data v2.0.0, schools_2025.parquet), que junta
 *   - a coordenada informada ao INEP (lat_inep / lon_inep), e
 *   - uma geocodificação própria (geocodebr) com a precisão do resultado.
 * Para cada escola usamos a coordenada que o Ipea marcou em coords_source e guardamos
 * a fonte, a precisão e o desvio em metros, para o mapa só desenhar o que for confiável.
 *
 * Uso:
 *   node scripts/import-coordenadas-escolas.mjs --dry        (só lê e mostra a cobertura)
 *   node scripts/import-coordenadas-escolas.mjs              (grava no Supabase)
 *   node scripts/import-coordenadas-escolas.mjs ./schools_2025.parquet   (arquivo já baixado)
 *
 * Requer: npm i -D hyparquet   e SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY em .env.local
 */
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { asyncBufferFromFile, parquetReadObjects } from 'hyparquet'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const URL_PARQUET = 'https://github.com/ipea/geobr_prep_data/releases/download/v2.0.0/schools_2025.parquet'

function loadEnv() {
  const p = resolve(__dirname, '../.env.local')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf-8').split('\n')) {
    const t = line.trim(); if (!t || t.startsWith('#')) continue
    const i = t.indexOf('='); if (i < 0) continue
    const k = t.slice(0, i).trim(); const v = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[k]) process.env[k] = v
  }
}
loadEnv()

const args = process.argv.slice(2)
const dry = args.includes('--dry')
let file = args.find(a => !a.startsWith('--'))

async function baixar() {
  const dest = resolve(__dirname, '../schools_2025.parquet')
  if (existsSync(dest)) return dest
  console.log('Baixando', URL_PARQUET)
  const r = await fetch(URL_PARQUET)
  if (!r.ok) throw new Error('download falhou: ' + r.status)
  writeFileSync(dest, Buffer.from(await r.arrayBuffer()))
  return dest
}

async function main() {
  if (!file) file = await baixar()
  const buf = await asyncBufferFromFile(file)
  const rows = await parquetReadObjects({
    file: buf,
    columns: ['code_school', 'tp_dependencia', 'tp_situacao_funcionamento', 'lat_inep', 'lon_inep', 'lat_geocodebr', 'lon_geocodebr', 'precisao_geocodebr', 'desvio_metros_geocodebr', 'coords_source'],
  })
  console.log('Escolas no arquivo:', rows.length)

  const out = []
  const cont = {}
  for (const r of rows) {
    const src = r.coords_source
    let lat = null, lng = null
    if (src === 'inep') { lat = r.lat_inep; lng = r.lon_inep }
    else if (src === 'geocodebr') { lat = r.lat_geocodebr; lng = r.lon_geocodebr }
    if (lat == null || lng == null || !isFinite(lat) || !isFinite(lng)) continue
    if (lat < -34 || lat > 6 || lng < -75 || lng > -32) continue   // fora do Brasil
    const k = `${src}/${r.precisao_geocodebr}`
    cont[k] = (cont[k] || 0) + 1
    out.push({ c: String(Math.round(Number(r.code_school))), lat: +Number(lat).toFixed(6), lng: +Number(lng).toFixed(6), s: src, p: r.precisao_geocodebr ?? null, d: r.desvio_metros_geocodebr ?? null })
  }
  console.log('Com coordenada:', out.length, 'de', rows.length)
  console.table(cont)
  if (dry) { console.log('--dry: nada foi gravado.'); return }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) { console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local'); process.exit(1) }
  const sb = createClient(url, key)
  let gravadas = 0
  for (let i = 0; i < out.length; i += 2000) {
    const { data, error } = await sb.rpc('raiox_set_coords', { p: out.slice(i, i + 2000) })
    if (error) { console.error('erro no lote', i, error.message); process.exit(1) }
    gravadas += data
    process.stdout.write(`\r${gravadas} escolas atualizadas`)
  }
  console.log('\nConcluído.')
  await sb.from('fonte_dados').upsert({ chave: 'coord_escolas', fonte: 'Ipea/geobr v2.0.0 (coordenadas INEP + geocodebr)', ano: 2025, url: URL_PARQUET, observacao: 'Cada escola guarda fonte_coord, coord_precisao e coord_desvio_m', linhas: gravadas })
}
main().catch(e => { console.error(e); process.exit(1) })
