// Importação de contatos por planilha — compartilhada pelo módulo de Contatos
// e pelo import da campanha (Transmissões). Lê CSV ou XLSX, reconhece as
// colunas pelo cabeçalho (o usuário pode trocar) e chama contacts_import no
// banco, que faz a prévia e a gravação com as mesmas regras (upsert por
// phone_key — ver supabase/migrations/20260929000000_contacts_import_upsert.sql).
import * as XLSX from 'xlsx'
import { supabase } from './supabase'

export type ContactField = 'phone' | 'name' | 'email' | 'address' | 'student' | 'grade' | 'relationship' | 'tags'
export type UpdatableField = Exclude<ContactField, 'phone' | 'tags'>
export type ColumnMode = 'skip' | 'fill' | 'overwrite'
export type TagsMode = 'skip' | 'add' | 'replace'

export const FIELD_LABEL: Record<ContactField, string> = {
  phone: 'Telefone', name: 'Nome', email: 'E-mail', address: 'Endereço',
  student: 'Aluno', grade: 'Turma / série', relationship: 'Parentesco', tags: 'Etiquetas',
}
export const UPDATABLE_FIELDS: UpdatableField[] = ['name', 'email', 'address', 'student', 'grade', 'relationship']

// Cabeçalhos reconhecidos (sem acento, minúsculo). O primeiro que casar leva.
const ALIASES: [ContactField, RegExp][] = [
  ['phone',        /^(telefone|celular|whats\s*app|whatsapp|fone|phone|numero|tel)\b/],
  ['email',        /^(e-?mail|email)\b/],
  ['address',      /^(endereco|address|rua|logradouro)\b/],
  ['student',      /^(aluno|aluna|estudante|filho|filha|nome do aluno|crianca)\b/],
  ['grade',        /^(turma|serie|ano|grade|classe|segmento)\b/],
  ['relationship', /^(parentesco|relacao|vinculo|grau)\b/],
  ['tags',         /^(tags?|etiquetas?|marcadores?)\b/],
  ['name',         /^(nome|name|responsavel|contato nome)\b/],
]

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export interface Sheet { fileName: string; headers: string[]; rows: string[][] }

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = []
  let cur = '', quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++ } else quoted = !quoted
    } else if (ch === sep && !quoted) { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out.map(s => s.trim())
}

// CSV (vírgula ou ponto e vírgula, com aspas) ou XLSX/XLS (primeira aba).
export async function readSpreadsheet(file: File): Promise<Sheet> {
  let matrix: string[][]
  if (/\.(xlsx|xls)$/i.test(file.name)) {
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    if (!ws) throw new Error('A planilha está vazia')
    matrix = (XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }) as unknown[][])
      .map(r => r.map(c => String(c ?? '').trim()))
  } else {
    const text = (await file.text()).replace(/^﻿/, '')
    const lines = text.split(/\r?\n/).filter(l => l.trim())
    if (!lines.length) throw new Error('O arquivo está vazio')
    const sep = (lines[0].match(/;/g)?.length || 0) > (lines[0].match(/,/g)?.length || 0) ? ';' : ','
    matrix = lines.map(l => splitCsvLine(l, sep))
  }
  matrix = matrix.filter(r => r.some(c => c))
  if (matrix.length < 2) throw new Error('A planilha precisa ter um cabeçalho e pelo menos uma linha')
  const headers = matrix[0].map((h, i) => h || `Coluna ${i + 1}`)
  return { fileName: file.name, headers, rows: matrix.slice(1) }
}

// Coluna → campo (ou null = ignorar). Um campo só vai pra uma coluna.
export function detectMapping(headers: string[]): (ContactField | null)[] {
  const used = new Set<ContactField>()
  return headers.map(h => {
    const f = fold(h)
    const hit = ALIASES.find(([field, re]) => !used.has(field) && re.test(f))
    if (!hit) return null
    used.add(hit[0])
    return hit[0]
  })
}

export interface ImportRowPayload {
  phone: string; name?: string; email?: string; address?: string
  student?: string; grade?: string; relationship?: string; tags?: string[]
}

// Linhas no formato da função. Etiquetas separadas por | (o mesmo do export) ou vírgula.
export function buildRows(sheet: Sheet, mapping: (ContactField | null)[]): ImportRowPayload[] {
  return sheet.rows.map(cells => {
    const row: ImportRowPayload = { phone: '' }
    mapping.forEach((field, i) => {
      const v = (cells[i] || '').trim()
      if (!field || !v) return
      if (field === 'tags') row.tags = v.split(/[|,]/).map(t => t.trim()).filter(Boolean)
      else (row as any)[field] = v
    })
    return row
  })
}

// Colunas que não viram campo do contato (na campanha servem de variável).
export function extraColumns(sheet: Sheet, mapping: (ContactField | null)[]): { index: number; header: string }[] {
  return sheet.headers.map((header, index) => ({ header, index })).filter(c => !mapping[c.index])
}

// Linhas pra audiência da campanha (Transmissões): telefone, nome e TODAS as
// outras colunas como variáveis da mensagem — inclusive as reconhecidas como
// campo (ex.: "Série"), pra dar pra usar {{2}} = turma da planilha. Chave da
// variável = cabeçalho em minúsculas (mesma convenção do import antigo).
export function toCampaignRows(sheet: Sheet, mapping: (ContactField | null)[]): {
  rows: { phone: string; name?: string; variables: Record<string, string> }[]
  columns: string[]
} {
  const phoneIdx = mapping.indexOf('phone')
  const nameIdx = mapping.indexOf('name')
  const varCols = sheet.headers
    .map((h, i) => ({ key: h.toLowerCase().trim(), i }))
    .filter(c => c.i !== phoneIdx && c.i !== nameIdx && c.key)
  const rows = sheet.rows
    .filter(cells => (cells[phoneIdx] || '').replace(/\D/g, ''))
    .map(cells => {
      const variables: Record<string, string> = {}
      for (const c of varCols) if (cells[c.i]?.trim()) variables[c.key] = cells[c.i].trim()
      return { phone: cells[phoneIdx], name: nameIdx >= 0 ? cells[nameIdx]?.trim() || undefined : undefined, variables }
    })
  return { rows, columns: varCols.map(c => c.key) }
}

export interface ImportOptions {
  columns: Partial<Record<UpdatableField, ColumnMode>>
  tags: TagsMode
  source?: 'contacts' | 'broadcast'
  file_name?: string
}

export interface ImportResult {
  rows: number; invalid: number; invalid_samples: { line: number; phone: string }[]
  numbers: number; merged_lines: number
  existing_numbers: number; existing_contacts: number; duplicated_in_base: number
  new_contacts: number; contacts_to_update: number
  columns: Record<UpdatableField, { fill: number; overwrite: number; present: number }>
  tags: { present: number; add: number; replace: number; new_in_catalog: string[] }
  applied: boolean
  batch_id?: string; created?: number; updated_contacts?: number; tags_created?: number
}

export async function contactsImport(institutionId: string, rows: ImportRowPayload[], options: ImportOptions, apply: boolean): Promise<ImportResult> {
  const { data, error } = await supabase.rpc('contacts_import', {
    p_institution_id: institutionId, p_rows: rows, p_options: options, p_apply: apply,
  })
  if (error) throw new Error(error.message.includes('statement timeout')
    ? 'A planilha é grande demais para processar de uma vez — divida em arquivos menores.'
    : error.message)
  return data as ImportResult
}

export function downloadContactsTemplate() {
  const csv = '﻿' + 'nome,telefone,email,endereco,aluno,turma,parentesco,tags\n'
    + 'Maria Silva,83999998888,maria@email.com,"Rua X, 123",João Silva,6º Ano B,Mãe,Visitante|Cliente\n'
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a'); a.href = url; a.download = 'template-contatos.csv'; a.click()
  URL.revokeObjectURL(url)
}
