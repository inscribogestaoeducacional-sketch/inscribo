// src/lib/rosterImport.ts
//
// Leitura do relatório de alunos da escola (Configurações → Integrações →
// "Enviar relatório de alunos"). Mesmo leitor para toda escola, sem código
// por escola. Aceita:
//   * relatório em blocos: uma linha "Segmento / Série / Ano / Turma" (ou só os
//     valores, ex. "Ensino Fundamental I / 1º Ano / 2025 / A") seguida do
//     cabeçalho Nº | Matrícula | Nome do aluno | Situação e das linhas de alunos;
//   * planilha "plana", com Série/Turma/Ano em colunas;
//   * .csv, .xlsx/.xls (todas as abas) e texto colado (tab, ; ou espaços).
// Nada é gravado aqui: o resultado vai para base_import_roster (prévia primeiro).
// LGPD: sem `includeNames`, nome do aluno, responsável e CPF NÃO saem do navegador.
import * as XLSX from 'xlsx'

export type RosterRow = {
  linha: number
  matricula: string
  nome?: string
  responsavel?: string
  cpf_responsavel?: string
  segmento?: string
  serie: string
  ano?: string
  turma?: string
  situacao: string
}

export type RosterParse = {
  rows: RosterRow[]
  skipped: { linha: number; motivo: string }[]
  years: string[]
  hasNames: boolean
}

type Field = 'n' | 'matricula' | 'nome' | 'responsavel' | 'cpf_responsavel' | 'segmento' | 'serie' | 'ano' | 'turma' | 'situacao'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

const SITUACOES = ['cursando', 'pre-matricula', 'pre matricula', 'prematricula', 'aprovado', 'aprovada', 'reprovado', 'reprovada',
  'transferencia', 'transferido', 'transferida', 'cancelada', 'cancelado', 'desistente', 'concluido', 'concluida', 'matriculado', 'matriculada']

function fieldOf(header: string): Field | null {
  const h = norm(header)
  if (!h) return null
  if (/^(n|no|n°|nº|num|numero|#)$/.test(h.replace(/[º°.]/g, '').trim()) || h === 'nº' || h === 'n°') return 'n'
  if (/cpf/.test(h)) return 'cpf_responsavel'
  if (/respons|^mae$|^pai$/.test(h)) return 'responsavel'
  if (/matric/.test(h) && !/situa|status|data/.test(h)) return 'matricula'
  if (/situa|status/.test(h)) return 'situacao'
  if (/nome|aluno|estudante/.test(h)) return 'nome'
  if (/segmento|nivel|ensino/.test(h)) return 'segmento'
  if (/serie|ano escolar|curso|etapa/.test(h)) return 'serie'
  if (/^turma/.test(h)) return 'turma'
  if (/^ano( letivo)?$|periodo letivo/.test(h)) return 'ano'
  return null
}

// Linha de cabeçalho de tabela: tem Matrícula e Situação.
function headerMap(cells: string[]): (Field | null)[] | null {
  const filled = cells.filter(Boolean)
  // cabeçalho colado numa célula só (texto copiado de PDF): "Nº Matrícula Nome do aluno Situação"
  if (filled.length === 1) {
    const h = norm(filled[0])
    if (!/matric/.test(h) || !/situa/.test(h) || h.length > 80) return null
    const m: Field[] = []
    if (/^(n|no|num|numero)[º°.]?\s/.test(h)) m.push('n')
    m.push('matricula')
    if (/nome|aluno/.test(h)) m.push('nome')
    m.push('situacao')
    return m
  }
  const m = cells.map(fieldOf)
  return m.includes('matricula') && m.includes('situacao') ? m : null
}

// Linha de contexto do bloco: "Segmento / Série / Ano / Turma[: valores]" ou os
// próprios valores separados por " / " (um deles é o ano).
const LABEL_RE = /segmento\s*\/\s*s[eé]rie\s*\/\s*ano\s*\/\s*turma\s*:?/i
function blockContext(text: string): { segmento?: string; serie?: string; ano?: string; turma?: string } | null | 'label' {
  let t = text.trim()
  if (LABEL_RE.test(t)) {
    t = t.replace(LABEL_RE, '').trim()
    if (!t) return 'label'
  }
  const parts = t.split(/\s*\/\s*/).map(s => s.trim()).filter(Boolean)
  if (parts.length < 2 || parts.length > 5) return null
  const yi = parts.findIndex(p => /^(19|20)\d{2}(\/\d)?$/.test(p))
  if (yi < 0) return null
  const before = parts.slice(0, yi)
  const after = parts.slice(yi + 1)
  return {
    segmento: before.length > 1 ? before.slice(0, -1).join(' / ') : undefined,
    serie: before[before.length - 1],
    ano: parts[yi].slice(0, 4),
    turma: after.join(' / ') || undefined,
  }
}

// Linha colada de PDF, sem separador: "12 2025001 NOME DO ALUNO Cursando".
function looseRow(text: string): string[] | null {
  const t = text.trim()
  const n = norm(t)
  const sit = SITUACOES.find(s => n.endsWith(' ' + s))
  if (!sit) return null
  const m = t.match(/^(\d{1,4})\s+(\S+)\s+(.*)$/)
  if (!m) return null
  const rest = m[3]
  const words = rest.split(/\s+/)
  const sitWords = sit.split(' ').length
  return [m[1], m[2], words.slice(0, -sitWords).join(' '), words.slice(-sitWords).join(' ')]
}

function splitText(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map(s => s.trim())
  const sc = (line.match(/;/g) || []).length
  const cm = (line.match(/,/g) || []).length
  if (sc >= 2 && sc >= cm) return line.split(';').map(s => s.trim().replace(/^"|"$/g, ''))
  if (cm >= 2) return line.split(',').map(s => s.trim().replace(/^"|"$/g, ''))
  if (/\S\s{2,}\S/.test(line)) return line.split(/\s{2,}/).map(s => s.trim())
  return [line.trim()]
}

export function textToMatrix(text: string): string[][] {
  return text.replace(/^﻿/, '').split(/\r?\n/).map(splitText)
}

export async function fileToMatrix(file: File): Promise<string[][]> {
  if (/\.(xlsx|xls|ods)$/i.test(file.name)) {
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    const out: string[][] = []
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name]
      if (!ws) continue
      const m = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }) as unknown[][]
      out.push(...m.map(r => r.map(c => String(c ?? '').trim())), [])
    }
    return out
  }
  if (/\.pdf$/i.test(file.name)) throw new Error('PDF ainda não é aceito: exporte em Excel/CSV ou copie e cole o texto do relatório.')
  return textToMatrix(await file.text())
}

// Matriz (linhas × células) → linhas de aluno.
export function parseRoster(matrix: string[][], opts: { includeNames: boolean }): RosterParse {
  const rows: RosterRow[] = []
  const skipped: RosterParse['skipped'] = []
  const years = new Set<string>()
  let map: (Field | null)[] | null = null
  let ctx: { segmento?: string; serie?: string; ano?: string; turma?: string } = {}
  let expectCtx = false
  let hasNames = false

  matrix.forEach((raw, idx) => {
    const linha = idx + 1
    const cells = raw.map(c => (c ?? '').toString().trim())
    const filled = cells.filter(Boolean)
    if (!filled.length) return
    const joined = filled.join(' ')

    // contexto do bloco (sempre reavaliado: um relatório tem vários blocos)
    const hm = headerMap(cells)
    if (!hm) {
      const bc = blockContext(filled.length === 1 ? filled[0] : filled.join(' / '))
      if (bc === 'label') { expectCtx = true; return }
      // só vira contexto depois do rótulo ou quando o texto já tinha "/" (senão
      // uma linha de aluno de planilha plana seria confundida com bloco)
      if (bc && (expectCtx || filled.some(f => f.includes('/'))) && !/^\d+$/.test(filled[0])) {
        ctx = bc; expectCtx = false; return
      }
    }
    if (hm) { map = hm; expectCtx = false; return }
    if (!map) return

    let c = cells
    const need = map.filter(Boolean).length
    if (filled.length < need) {
      const loose = looseRow(joined)
      if (loose) {
        const order: Field[] = ['n', 'matricula', 'nome', 'situacao']
        c = map.map(f => (f && order.includes(f) ? loose[order.indexOf(f)] : ''))
      }
    }
    const get = (f: Field) => { const i = map!.indexOf(f); return i >= 0 ? (c[i] || '').trim() : '' }
    const matricula = get('matricula')
    const situacao = get('situacao')
    if (!matricula && !situacao) return                       // rodapé, total, linha solta
    if (/^total|^quantidade/i.test(joined)) return
    const serie = get('serie') || ctx.serie || ''
    const ano = (get('ano').match(/(19|20)\d{2}/)?.[0]) || ctx.ano || ''
    if (!matricula || !situacao || !serie) {
      skipped.push({ linha, motivo: !matricula ? 'sem matrícula' : !situacao ? 'sem situação' : 'sem série' })
      return
    }
    if (ano) years.add(ano)
    const nome = get('nome')
    if (nome) hasNames = true
    const row: RosterRow = {
      linha, matricula, situacao, serie, ano: ano || undefined,
      segmento: get('segmento') || ctx.segmento || undefined,
      turma: get('turma') || ctx.turma || undefined,
    }
    if (opts.includeNames) {
      if (nome) row.nome = nome
      const resp = get('responsavel'); if (resp) row.responsavel = resp
      const cpf = get('cpf_responsavel'); if (cpf) row.cpf_responsavel = cpf
    }
    rows.push(row)
  })

  return { rows, skipped, years: [...years].sort(), hasNames }
}
