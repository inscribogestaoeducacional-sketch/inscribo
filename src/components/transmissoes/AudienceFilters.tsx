// Filtros do público das Transmissões: lista pesquisável com marcação múltipla
// (MultiSelect), bloco de Leads (etapa do funil, concurso, origem, série,
// responsável + "Mais filtros") e segmentos salvos (valem pra escola toda).
import { useMemo, useState } from 'react'
import { Search, X, ChevronDown, Bookmark, Trash2, Plus } from 'lucide-react'
import { Btn, hintStyle, inputStyle, labelStyle, toggleIn } from './ui'
import { STAGE_KEYS, stageLabel, getCustomStages } from '../../lib/stageLabels'

export interface Opt { id: string; label: string; count?: number; hint?: string }

export interface LeadFilters {
  statuses: string[]; custom_stage_ids: string[]; contests: string[]; sources: string[]; grades: string[]
  assigned: string[]; shifts: string[]; years: string[]; origin_schools: string[]; referrals: string[]
  created_from: string; created_to: string
}
export const EMPTY_LEADS: LeadFilters = {
  statuses: [], custom_stage_ids: [], contests: [], sources: [], grades: [], assigned: [],
  shifts: [], years: [], origin_schools: [], referrals: [], created_from: '', created_to: '',
}
export interface LeadOptions {
  total: number
  statuses: Record<string, number>; custom: Record<string, number>
  contests: { value: string; label: string; count: number }[]; sources: { value: string; label: string; count: number }[]
  grades: { value: string; label: string; count: number }[]; assigned: { value: string; label: string; count: number }[]
  shifts: { value: string; label: string; count: number }[]; years: { value: string; label: string; count: number }[]
  origin_schools: { value: string; label: string; count: number }[]; referrals: { value: string; label: string; count: number }[]
}
export interface Segment { id: string; name: string; filter: Record<string, any>; created_at: string }

const LIST_KEYS = ['statuses', 'custom_stage_ids', 'contests', 'sources', 'grades', 'assigned', 'shifts', 'years', 'origin_schools', 'referrals'] as const

/** Só o que está preenchido — é o que vai no filtro e no segmento salvo. */
export function leadsToFilter(l: LeadFilters): Record<string, unknown> | null {
  const out: Record<string, unknown> = {}
  for (const k of LIST_KEYS) if (l[k].length) out[k] = l[k]
  if (l.created_from) out.created_from = l.created_from
  if (l.created_to) out.created_to = l.created_to
  return Object.keys(out).length ? out : null
}
export function leadsFromFilter(raw: any): LeadFilters {
  const r = raw && typeof raw === 'object' ? raw : {}
  const out: LeadFilters = { ...EMPTY_LEADS }
  for (const k of LIST_KEYS) out[k] = Array.isArray(r[k]) ? r[k].map(String) : []
  out.created_from = typeof r.created_from === 'string' ? r.created_from : ''
  out.created_to = typeof r.created_to === 'string' ? r.created_to : ''
  return out
}
export const leadsCount = (l: LeadFilters) => LIST_KEYS.reduce((n, k) => n + l[k].length, 0) + (l.created_from || l.created_to ? 1 : 0)

// ── Lista pesquisável com marcação múltipla ─────────────────────────────────
export function MultiSelect({ label, options, value, onChange, placeholder = 'Qualquer', searchable }: {
  label: string; options: Opt[]; value: string[]; onChange: (v: string[]) => void; placeholder?: string; searchable?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  if (!options.length && !value.length) return null
  const byId = new Map(options.map(o => [o.id, o]))
  const showSearch = searchable ?? options.length > 6
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const shown = q.trim() ? options.filter(o => norm(o.label).includes(norm(q.trim()))) : options
  const summary = value.length ? `${value.length} selecionado${value.length > 1 ? 's' : ''}` : placeholder
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{ ...inputStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', textAlign: 'left',
          color: value.length ? '#1A2B4A' : '#94a3b8', fontWeight: value.length ? 600 : 400, background: '#fff' }}>
        <span>{summary}</span>
        <ChevronDown size={15} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>
      {value.length > 0 && !open && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
          {value.map(v => (
            <span key={v} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 6px 3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: '#F0FDFA', border: '1.5px solid #05907B', color: '#047857' }}>
              {byId.get(v)?.label || v}
              <button type="button" aria-label={`Tirar ${byId.get(v)?.label || v}`} onClick={() => onChange(value.filter(x => x !== v))}
                style={{ display: 'inline-flex', background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: '#047857' }}><X size={12} /></button>
            </span>
          ))}
        </div>
      )}
      {open && (
        <div style={{ marginTop: 6, border: '1.5px solid #E2E8F0', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
          {showSearch && (
            <div style={{ position: 'relative', padding: 8, borderBottom: '1px solid #f1f5f9' }}>
              <Search size={13} style={{ position: 'absolute', left: 18, top: 19, color: '#94a3b8' }} />
              <input autoFocus style={{ ...inputStyle, paddingLeft: 28 }} placeholder="Buscar na lista" value={q} onChange={e => setQ(e.target.value)} />
            </div>
          )}
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {shown.length === 0 && <p style={{ margin: 0, padding: 12, fontSize: 13, color: '#94a3b8' }}>Nada encontrado.</p>}
            {shown.map(o => (
              <label key={o.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 12px', fontSize: 13, color: '#1e293b', cursor: 'pointer', borderTop: '1px solid #f8fafc' }}>
                <input type="checkbox" checked={value.includes(o.id)} onChange={() => onChange(toggleIn(value, o.id))} />
                <span style={{ flex: 1, minWidth: 0 }}>{o.label}{o.hint && <span style={{ color: '#94a3b8', fontSize: 11, marginLeft: 6 }}>{o.hint}</span>}</span>
                {o.count !== undefined && <span style={{ color: '#94a3b8', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{o.count.toLocaleString('pt-BR')}</span>}
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderTop: '1px solid #f1f5f9', fontSize: 12 }}>
            <button type="button" disabled={!value.length} onClick={() => onChange([])}
              style={{ background: 'none', border: 'none', padding: 0, color: value.length ? '#DC2626' : '#cbd5e1', cursor: value.length ? 'pointer' : 'default', fontSize: 12 }}>Limpar</button>
            <button type="button" onClick={() => { setOpen(false); setQ('') }}
              style={{ background: 'none', border: 'none', padding: 0, color: '#1A2B4A', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>Pronto</button>
          </div>
        </div>
      )}
    </div>
  )
}

const fromOpts = (xs: { value: string; label: string; count: number }[] | undefined): Opt[] =>
  (xs || []).map(x => ({ id: x.value, label: x.label, count: x.count }))

// ── Bloco de Leads ──────────────────────────────────────────────────────────
export function LeadFiltersBlock({ value, onChange, options }: { value: LeadFilters; onChange: (v: LeadFilters) => void; options: LeadOptions | null }) {
  const [more, setMore] = useState(false)
  const set = (patch: Partial<LeadFilters>) => onChange({ ...value, ...patch })

  // Etapas na ordem do funil; as extras da escola vêm logo depois da etapa a que pertencem.
  const stageOpts = useMemo<Opt[]>(() => {
    if (!options) return []
    const customs = getCustomStages()
    const out: Opt[] = []
    for (const k of STAGE_KEYS) {
      out.push({ id: k, label: stageLabel(k), count: options.statuses[k] || 0 })
      for (const c of customs.filter(c => c.after_stage === k)) out.push({ id: `x:${c.id}`, label: c.label, hint: 'sua etapa', count: options.custom[c.id] || 0 })
    }
    return out
  }, [options])

  // Etapa extra e etapa original ficam no mesmo seletor; no filtro vão separadas.
  const stageValue = [...value.statuses, ...value.custom_stage_ids.map(id => `x:${id}`)]
  const onStage = (v: string[]) => set({ statuses: v.filter(x => !x.startsWith('x:')), custom_stage_ids: v.filter(x => x.startsWith('x:')).map(x => x.slice(2)) })

  if (!options) return <p style={hintStyle}>Carregando opções de lead…</p>
  if (!options.total) return <p style={hintStyle}>Esta escola ainda não tem leads cadastrados.</p>
  const moreCount = value.shifts.length + value.years.length + value.origin_schools.length + value.referrals.length + (value.created_from || value.created_to ? 1 : 0)
  return (
    <div style={{ border: '1.5px solid #E2E8F0', borderRadius: 14, padding: 14, display: 'grid', gap: 12, background: '#FCFCFD' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 13, color: '#1A2B4A' }}>Leads <span style={{ color: '#94a3b8', fontWeight: 500 }}>({options.total.toLocaleString('pt-BR')} na escola)</span></strong>
        {leadsCount(value) > 0 && <button type="button" onClick={() => onChange({ ...EMPTY_LEADS })} style={{ background: 'none', border: 'none', padding: 0, color: '#DC2626', fontSize: 12, cursor: 'pointer' }}>limpar leads</button>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        <MultiSelect label="Etapa do funil" options={stageOpts} value={stageValue} onChange={onStage} placeholder="Qualquer etapa" />
        <MultiSelect label="Concurso / bolsa" options={fromOpts(options.contests)} value={value.contests} onChange={v => set({ contests: v })} />
        <MultiSelect label="Origem" options={fromOpts(options.sources)} value={value.sources} onChange={v => set({ sources: v })} />
        <MultiSelect label="Série de interesse" options={fromOpts(options.grades)} value={value.grades} onChange={v => set({ grades: v })} searchable />
        <MultiSelect label="Responsável" options={fromOpts(options.assigned)} value={value.assigned} onChange={v => set({ assigned: v })} />
      </div>
      <div>
        <button type="button" onClick={() => setMore(m => !m)} aria-expanded={more}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, fontSize: 13, fontWeight: 600, color: '#1A2B4A', cursor: 'pointer' }}>
          <ChevronDown size={14} style={{ transform: more ? 'rotate(180deg)' : 'none' }} /> Mais filtros{moreCount > 0 && <span style={{ color: '#047857' }}> ({moreCount})</span>}
        </button>
        {more && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginTop: 10 }}>
            <MultiSelect label="Turno" options={fromOpts(options.shifts)} value={value.shifts} onChange={v => set({ shifts: v })} />
            <MultiSelect label="Ano de interesse" options={fromOpts(options.years)} value={value.years} onChange={v => set({ years: v })} />
            <MultiSelect label="Escola de origem" options={fromOpts(options.origin_schools)} value={value.origin_schools} onChange={v => set({ origin_schools: v })} searchable />
            <MultiSelect label="Indicado por" options={fromOpts(options.referrals)} value={value.referrals} onChange={v => set({ referrals: v })} searchable />
            <div>
              <label style={labelStyle}>Entrou entre</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input type="date" aria-label="Entrou a partir de" style={inputStyle} value={value.created_from} max={value.created_to || undefined} onChange={e => set({ created_from: e.target.value })} />
                <input type="date" aria-label="Entrou até" style={inputStyle} value={value.created_to} min={value.created_from || undefined} onChange={e => set({ created_to: e.target.value })} />
              </div>
            </div>
          </div>
        )}
      </div>
      <p style={{ ...hintStyle, margin: 0 }}>Só entram leads que já têm um contato de WhatsApp com opt-in. Dentro de cada campo vale "ou"; entre campos vale "e".</p>
    </div>
  )
}

// ── Segmentos salvos ────────────────────────────────────────────────────────
export function SegmentsBar({ segments, onApply, onSave, onDelete, canSave, error }: {
  segments: Segment[]; onApply: (s: Segment) => void; onSave: (name: string) => Promise<void>; onDelete: (s: Segment) => Promise<void>
  canSave: boolean; error: string | null
}) {
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState('')
  async function save() {
    if (!name.trim()) return
    setBusy(true)
    try { await onSave(name.trim()); setNaming(false); setName('') } catch { /* a mensagem vem em `error` */ }
    setBusy(false)
  }
  const sel = segments.find(s => s.id === selected)
  return (
    <div style={{ border: '1.5px dashed #CBD5E1', borderRadius: 14, padding: 12, display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#1A2B4A' }}><Bookmark size={14} /> Segmentos salvos <span style={{ color: '#94a3b8', fontWeight: 500, fontSize: 12 }}>(a escola toda usa)</span></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {segments.length > 0 && <>
          <select aria-label="Segmento salvo" style={{ ...inputStyle, flex: '1 1 200px', width: 'auto' }} value={selected} onChange={e => { setSelected(e.target.value); const s = segments.find(x => x.id === e.target.value); if (s) onApply(s) }}>
            <option value="">Aplicar um segmento…</option>
            {segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {sel && <button type="button" onClick={async () => { if (window.confirm(`Apagar o segmento "${sel.name}"? As campanhas já criadas não mudam.`)) { await onDelete(sel); setSelected('') } }}
            aria-label={`Apagar segmento ${sel.name}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 12 }}><Trash2 size={13} /> apagar</button>}
        </>}
        {!naming && <Btn variant="secondary" disabled={!canSave} onClick={() => setNaming(true)}><Plus size={14} /> Salvar esta seleção</Btn>}
      </div>
      {naming && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input autoFocus style={{ ...inputStyle, flex: '1 1 200px', width: 'auto' }} maxLength={80} placeholder="Nome do segmento (ex.: Leads de 2027 sem responsável)" value={name}
            onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') save() }} />
          <Btn loading={busy} disabled={!name.trim()} onClick={save}>Salvar</Btn>
          <Btn variant="ghost" onClick={() => { setNaming(false); setName('') }}>Cancelar</Btn>
        </div>
      )}
      {error && <p style={{ margin: 0, fontSize: 12, color: '#DC2626' }}>{error}</p>}
      {!segments.length && !naming && <p style={{ ...hintStyle, margin: 0 }}>Monte os filtros abaixo e salve pra usar de novo em outras campanhas.</p>}
    </div>
  )
}
