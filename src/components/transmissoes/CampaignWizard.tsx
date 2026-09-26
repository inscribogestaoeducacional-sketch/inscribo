// Assistente de nova campanha (Transmissões): Template → Público → Mensagem e
// respostas → Revisão. A prévia (audiência, amostra, custo) vem do backend
// (broadcast-campaigns/preview, mesma função de audiência da criação). Na
// confirmação: create → price (congela preço e usa crédito) → cobrança no
// Asaas se sobrar valor. O navegador nunca manda valor — só escolhas.
import React, { useEffect, useMemo, useState } from 'react'
import { Users, Upload, Bot, Tag, CheckCircle2, ExternalLink, AlertTriangle, CalendarClock, Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import {
  broadcastAction, chargeCampaign, parseImportCsv, brl, EXCLUDED_REASON, CATEGORY_LABEL, type ImportRow,
} from '../../lib/broadcasts'
import { loadTemplates, type TemplateRow } from './TemplatesPanel'
import { Badge, Btn, ErrorBox, Modal, hintStyle, inputStyle, labelStyle, toggleIn } from './ui'

type VarSource = { source: 'contact.first_name' | 'contact.name' | 'fixed' | 'import'; value?: string; key?: string; fallback?: string }
interface ActionForm { tag: string; skipBot: boolean; userIds: string[]; groupIds: string[] }
const EMPTY_ACTION: ActionForm = { tag: '', skipBot: false, userIds: [], groupIds: [] }

interface Lookups {
  tags: string[]
  grades: string[]
  triggers: { id: string; name: string }[]
  campaigns: { id: string; name: string }[]
  users: { id: string; full_name: string }[]
  groups: { id: string; name: string; emoji: string | null }[]
}

const STEPS = ['Template', 'Público', 'Mensagem e respostas', 'Revisão'] as const

export default function CampaignWizard({ institutionId, onClose, onCreated }: {
  institutionId: string; onClose: () => void; onCreated: (campaignId: string) => void
}) {
  const [step, setStep] = useState(0)
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [lk, setLk] = useState<Lookups>({ tags: [], grades: [], triggers: [], campaigns: [], users: [], groups: [] })
  const [loading, setLoading] = useState(true)

  // escolhas
  const [templateId, setTemplateId] = useState<string>('')
  const [allContacts, setAllContacts] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [types, setTypes] = useState<string[]>([])
  const [grades, setGrades] = useState<string[]>([])
  const [triggerIds, setTriggerIds] = useState<string[]>([])
  const [prevCampaign, setPrevCampaign] = useState<{ id: string; only: 'sent' | 'replied' | 'clicked' } | null>(null)
  const [importRows, setImportRows] = useState<ImportRow[]>([])
  const [importCols, setImportCols] = useState<string[]>([])
  const [importName, setImportName] = useState('')
  const [optIn, setOptIn] = useState(false)
  const [mapping, setMapping] = useState<Record<string, VarSource>>({})
  const [actions, setActions] = useState<Record<string, ActionForm>>({ any: { ...EMPTY_ACTION } })
  const [name, setName] = useState('')
  const [sendMode, setSendMode] = useState<'now' | 'scheduled'>('now')
  const [scheduledAt, setScheduledAt] = useState('')

  // prévia / envio
  const [preview, setPreview] = useState<any>(null)
  const [previewing, setPreviewing] = useState(false)
  const [error, setError] = useState<{ message: string; details?: string[] } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ campaignId: string; status: string; total: number; paymentLink?: string; chargeError?: string } | null>(null)

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const [tpls, tagRes, gradeRes, trgRes, campRes, linkRes, grpRes] = await Promise.all([
          loadTemplates(institutionId),
          supabase.from('whatsapp_tags').select('name').eq('institution_id', institutionId).order('name'),
          supabase.from('whatsapp_contacts').select('student_grade').eq('institution_id', institutionId).not('student_grade', 'is', null).limit(5000),
          supabase.from('capture_triggers').select('id, name').eq('institution_id', institutionId).order('created_at', { ascending: false }),
          supabase.from('broadcast_campaigns').select('id, name').eq('institution_id', institutionId).in('status', ['sending', 'completed', 'paused']).order('created_at', { ascending: false }).limit(50),
          supabase.from('user_institutions').select('user_id, users(full_name)').eq('institution_id', institutionId).eq('active', true),
          supabase.from('whatsapp_groups').select('id, name, emoji').eq('institution_id', institutionId).order('name'),
        ])
        setTemplates(tpls.filter(t => t.status === 'approved'))
        setLk({
          tags:      ((tagRes.data || []) as any[]).map(t => t.name),
          grades:    [...new Set(((gradeRes.data || []) as any[]).map(g => String(g.student_grade).trim()).filter(Boolean))].sort(),
          triggers:  (trgRes.data || []) as any[],
          campaigns: (campRes.data || []) as any[],
          users:     ((linkRes.data || []) as any[]).map(r => ({ id: r.user_id, full_name: (Array.isArray(r.users) ? r.users[0] : r.users)?.full_name || 'Usuário' })).sort((a, b) => a.full_name.localeCompare(b.full_name)),
          groups:    (grpRes.data || []) as any[],
        })
      } catch (e) { console.error('[Transmissoes] wizard lookups:', e) }
      setLoading(false)
    })()
  }, [institutionId])

  const tpl = templates.find(t => t.id === templateId) || null
  const bodyVars = useMemo(() => tpl ? [...new Set([...tpl.body_text.matchAll(/\{\{(\d+)\}\}/g)].map(m => m[1]))].sort((a, b) => Number(a) - Number(b)) : [], [tpl])
  const headerVar = !!tpl && /\{\{1\}\}/.test(tpl.header_config?.text || '')
  const urlButtons = tpl ? tpl.buttons.map((b, i) => ((b.type || '').toUpperCase() === 'URL' ? i : -1)).filter(i => i >= 0) : []
  const quickReplies = tpl ? tpl.buttons.map((b, i) => ((b.type || '').toUpperCase() === 'QUICK_REPLY' ? i : -1)).filter(i => i >= 0) : []

  // Ao trocar de template: mapeamento padrão ({{1}} = primeiro nome; resto fixo).
  useEffect(() => {
    if (!tpl) return
    const m: Record<string, VarSource> = {}
    bodyVars.forEach(n => {
      const label = (tpl.variable_labels?.[n] || '').toLowerCase()
      m[n] = n === '1' || /nome/.test(label) ? { source: 'contact.first_name', fallback: 'família' } : { source: 'fixed', value: '' }
    })
    if (headerVar) m.header_1 = { source: 'fixed', value: '' }
    urlButtons.forEach(i => { m[`button_${i}`] = { source: 'fixed', value: '' } })
    setMapping(m)
    const a: Record<string, ActionForm> = { any: { ...EMPTY_ACTION } }
    quickReplies.forEach(i => { a[String(i)] = { ...EMPTY_ACTION } })
    setActions(a)
    setPreview(null)
  }, [templateId]) // eslint-disable-line react-hooks/exhaustive-deps

  const filter = useMemo(() => {
    const f: Record<string, unknown> = {}
    if (allContacts) f.all = true
    if (tags.length) f.tags = tags
    if (types.length) f.contact_types = types
    if (grades.length) f.grades = grades
    if (triggerIds.length) f.capture_trigger_ids = triggerIds
    if (prevCampaign) f.previous_campaign = prevCampaign
    return f
  }, [allContacts, tags, types, grades, triggerIds, prevCampaign])

  const hasAudience = Object.keys(filter).length > 0 || importRows.length > 0

  async function runPreview(withMapping: boolean) {
    if (!templateId) return
    setPreviewing(true); setError(null)
    try {
      setPreview(await broadcastAction('preview', {
        institution_id: institutionId, template_definition_id: templateId, filter,
        import_rows: importRows, ...(withMapping ? { variable_mapping: mapping } : {}),
      }))
    } catch (e: any) { setError({ message: e.message, details: e.details }) }
    setPreviewing(false)
  }

  function onFile(file: File | undefined) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const parsed = parseImportCsv(String(reader.result || ''))
      if (parsed.error) { setError({ message: parsed.error }); return }
      setImportRows(parsed.rows); setImportCols(parsed.columns); setImportName(file.name); setError(null); setPreview(null)
    }
    reader.readAsText(file, 'utf-8')
  }

  function buildActions() {
    return Object.entries(actions)
      .filter(([, a]) => a.tag.trim() || a.skipBot)
      .map(([k, a]) => ({
        match_kind: k === 'any' ? 'any_reply' : 'button',
        ...(k === 'any' ? {} : { button_index: Number(k) }),
        tag_name: a.tag.trim() || null,
        skip_bot: a.skipBot,
        assignees: a.skipBot ? [...a.userIds.map(user_id => ({ user_id })), ...a.groupIds.map(group_id => ({ group_id }))] : [],
      }))
  }

  async function confirm() {
    setSubmitting(true); setError(null)
    let campaignId = ''
    try {
      const created = await broadcastAction<{ campaign_id: string }>('create', {
        institution_id: institutionId, name: name.trim(), template_definition_id: templateId,
        variable_mapping: mapping, filter, import_rows: importRows, opt_in_confirmed: optIn,
        reply_actions: buildActions(), send_mode: sendMode,
        ...(sendMode === 'scheduled' ? { scheduled_at: new Date(scheduledAt).toISOString() } : {}),
      })
      campaignId = created.campaign_id
      const priced = await broadcastAction<{ status: string; total_brl: number; needs_charge: boolean }>('price', { campaign_id: campaignId })
      let paymentLink: string | undefined, chargeError: string | undefined
      if (priced.needs_charge) {
        try { paymentLink = (await chargeCampaign(campaignId)).paymentLink } catch (e: any) { chargeError = e.message }
      }
      setResult({ campaignId, status: priced.status, total: Number(priced.total_brl) || 0, paymentLink, chargeError })
    } catch (e: any) {
      // Criada mas não precificada: fica em rascunho, dá pra precificar pelo detalhe.
      setError({ message: campaignId ? `Campanha criada, mas não foi possível concluir: ${e.message}` : e.message, details: e.details })
      if (campaignId) onCreated(campaignId)
    }
    setSubmitting(false)
  }

  // ── validação por passo ──
  const stepProblem = (() => {
    if (step === 0) return !templateId ? 'Escolha um template aprovado' : null
    if (step === 1) {
      if (!hasAudience) return 'Escolha pelo menos um filtro ou importe uma lista'
      if (importRows.length && !optIn) return 'Confirme a autorização dos contatos da lista importada'
      return null
    }
    if (step === 2) {
      for (const [k, m] of Object.entries(mapping)) {
        if (m.source === 'fixed' && !m.value?.trim()) return `Preencha o valor de ${k.startsWith('button') ? 'botão de link' : k === 'header_1' ? 'cabeçalho' : `{{${k}}}`}`
        if (m.source !== 'fixed' && !m.fallback?.trim()) return `Preencha o valor padrão de {{${k}}}`
        if (m.source === 'import' && !m.key) return `Escolha a coluna da lista pra {{${k}}}`
      }
      return null
    }
    if (step === 3) {
      if (!name.trim()) return 'Dê um nome à campanha'
      if (sendMode === 'scheduled' && !(Date.parse(scheduledAt) > Date.now() + 5 * 60_000)) return 'Agende com pelo menos 5 minutos de antecedência'
      if (!preview?.audience?.eligible) return 'Nenhum destinatário elegível'
      if (preview?.mapping_errors?.length) return 'Revise as variáveis'
      if (preview?.estimate && !preview.estimate.available) return preview.estimate.reason
      return null
    }
    return null
  })()

  useEffect(() => { if (step === 3) runPreview(true) }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── resultado ──
  if (result) {
    return (
      <Modal title="Campanha criada" onClose={() => onCreated(result.campaignId)}
        footer={<Btn onClick={() => onCreated(result.campaignId)}>Ver campanha</Btn>}>
        <div style={{ display: 'grid', gap: 14, textAlign: 'center' }}>
          <CheckCircle2 size={40} color="#00A896" style={{ margin: '0 auto' }} />
          {result.total > 0 ? (
            result.paymentLink ? <>
              <p style={{ margin: 0, fontSize: 14, color: '#1e293b' }}>Falta só o pagamento de <strong>{brl(result.total)}</strong>. A campanha sai automaticamente assim que o pagamento for confirmado.</p>
              <a href={result.paymentLink} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center', padding: '10px 18px', borderRadius: 10, background: '#00A896', color: '#fff', fontWeight: 600, fontSize: 13, textDecoration: 'none', margin: '0 auto' }}>
                <ExternalLink size={14} /> Pagar agora (Pix, boleto ou cartão)
              </a>
            </> : <ErrorBox message={`Campanha pronta, mas a cobrança não foi gerada: ${result.chargeError}`} details={['Você pode gerar a cobrança depois, no detalhe da campanha.']} />
          ) : (
            <p style={{ margin: 0, fontSize: 14, color: '#1e293b' }}>
              {result.status === 'scheduled' ? 'Coberta pelo seu crédito e agendada.' : 'Coberta pelo seu crédito — o envio começa em até 1 minuto.'}
            </p>
          )}
        </div>
      </Modal>
    )
  }

  return (
    <Modal wide title="Nova campanha" onClose={onClose}
      footer={<>
        {step > 0 && <Btn variant="ghost" onClick={() => setStep(s => s - 1)}>Voltar</Btn>}
        {step < 3
          ? <Btn disabled={!!stepProblem} onClick={() => { setError(null); setStep(s => s + 1) }}>Continuar</Btn>
          : <Btn disabled={!!stepProblem || previewing} loading={submitting} onClick={confirm}><Send size={14} /> Confirmar campanha</Btn>}
      </>}>
      <div style={{ display: 'grid', gap: 18 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STEPS.map((s, i) => (
            <span key={s} style={{ padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
              background: i === step ? '#1e2d6b' : i < step ? '#E0E7FF' : '#F1F5F9', color: i === step ? '#fff' : i < step ? '#1e2d6b' : '#94a3b8' }}>
              {i + 1}. {s}
            </span>
          ))}
        </div>
        <ErrorBox message={error?.message || null} details={error?.details} />
        {stepProblem && step < 3 && <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>{stepProblem}</p>}

        {loading ? <div style={{ height: 120, borderRadius: 12, background: '#f8fafc' }} className="animate-pulse" /> : <>

        {/* ── 1. Template ── */}
        {step === 0 && (templates.length === 0 ? (
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Nenhum template aprovado ainda. Crie um na aba <strong>Templates</strong> e aguarde a aprovação da Meta.</p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {templates.map(t => {
              const sel = t.id === templateId
              const cat = t.approved_category || t.category
              return (
                <button key={t.id} type="button" onClick={() => setTemplateId(t.id)}
                  style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 12, cursor: 'pointer', border: sel ? '2px solid #00A896' : '1.5px solid #E2E8F0', background: sel ? '#F0FDFA' : '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <strong style={{ fontSize: 13, color: '#1e293b' }}>{t.display_name || t.name}</strong>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Badge label={CATEGORY_LABEL[cat] || cat} color="#475569" bg="#F1F5F9" />
                      {t.institution_id === null && <Badge label="Áion" color="#1D4ED8" bg="#DBEAFE" />}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 6, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{t.body_text}</div>
                  {t.buttons.length > 0 && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>Botões: {t.buttons.map(b => b.text).join(' · ')}</div>}
                </button>
              )
            })}
          </div>
        ))}

        {/* ── 2. Público ── */}
        {step === 1 && (
          <div style={{ display: 'grid', gap: 16 }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#1e293b', cursor: 'pointer' }}>
              <input type="checkbox" checked={allContacts} onChange={e => { setAllContacts(e.target.checked); setPreview(null) }} />
              <strong>Todos os contatos da escola</strong> <span style={{ color: '#94a3b8' }}>(os filtros abaixo restringem)</span>
            </label>
            <Chips label="Etiquetas (tem alguma)" options={lk.tags.map(t => ({ id: t, label: t }))} value={tags} onChange={v => { setTags(v); setPreview(null) }} />
            <Chips label="Tipo de contato" options={[{ id: 'client', label: 'Cliente (família)' }, { id: 'lead', label: 'Lead' }, { id: 'other', label: 'Outro' }, { id: 'unknown', label: 'Sem classificação' }]} value={types} onChange={v => { setTypes(v); setPreview(null) }} />
            {lk.grades.length > 0 && <Chips label="Turma" options={lk.grades.map(g => ({ id: g, label: g }))} value={grades} onChange={v => { setGrades(v); setPreview(null) }} />}
            {lk.triggers.length > 0 && <Chips label="Veio da Captação (gatilho)" options={lk.triggers.map(t => ({ id: t.id, label: t.name }))} value={triggerIds} onChange={v => { setTriggerIds(v); setPreview(null) }} />}
            {lk.campaigns.length > 0 && (
              <div>
                <label style={labelStyle}>Campanha anterior</label>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
                  <select style={inputStyle} value={prevCampaign?.id || ''} onChange={e => { setPrevCampaign(e.target.value ? { id: e.target.value, only: prevCampaign?.only || 'replied' } : null); setPreview(null) }}>
                    <option value="">—</option>
                    {lk.campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select style={inputStyle} disabled={!prevCampaign} value={prevCampaign?.only || 'replied'} onChange={e => { setPrevCampaign(p => p && { ...p, only: e.target.value as any }); setPreview(null) }}>
                    <option value="sent">Receberam</option><option value="replied">Responderam</option><option value="clicked">Clicaram em botão</option>
                  </select>
                </div>
              </div>
            )}
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
              <label style={labelStyle}>Ou importe uma lista (CSV)</label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, border: '1.5px dashed #CBD5E1', cursor: 'pointer', fontSize: 13, color: '#1e2d6b' }}>
                <Upload size={14} /> {importName || 'Escolher arquivo'}
                <input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={e => onFile(e.target.files?.[0])} />
              </label>
              <p style={hintStyle}>Colunas: telefone (obrigatória), nome e outras que quiser usar na mensagem (ex.: turma).</p>
              {importRows.length > 0 && <>
                <p style={{ fontSize: 12, color: '#475569', margin: '6px 0' }}>{importRows.length} linha(s){importCols.length ? ` · colunas: ${importCols.join(', ')}` : ''} <button type="button" onClick={() => { setImportRows([]); setImportCols([]); setImportName(''); setOptIn(false); setPreview(null) }} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 12 }}>remover</button></p>
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: '#1e293b', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: 10 }}>
                  <input type="checkbox" checked={optIn} onChange={e => setOptIn(e.target.checked)} style={{ marginTop: 2 }} />
                  Confirmo que as pessoas desta lista autorizaram receber mensagens da escola pelo WhatsApp (exigência da Meta pra campanhas).
                </label>
              </>}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <Btn variant="secondary" disabled={!hasAudience} loading={previewing} onClick={() => runPreview(false)}><Users size={14} /> Calcular público</Btn>
              {preview && <AudienceSummary preview={preview} />}
            </div>
          </div>
        )}

        {/* ── 3. Mensagem e respostas ── */}
        {step === 2 && tpl && (
          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 12, fontSize: 12, color: '#475569', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {tpl.header_config?.text && <strong style={{ display: 'block', marginBottom: 6 }}>{tpl.header_config.text}</strong>}
              {tpl.body_text}
            </div>
            {Object.keys(mapping).length > 0 && (
              <div style={{ display: 'grid', gap: 10 }}>
                <label style={labelStyle}>Preenchimento das variáveis</label>
                {Object.entries(mapping).map(([k, m]) => {
                  const title = k === 'header_1' ? 'Cabeçalho {{1}}' : k.startsWith('button_') ? `Final do link "${tpl.buttons[Number(k.slice(7))]?.text}"` : `{{${k}}}${tpl.variable_labels?.[k] ? ` — ${tpl.variable_labels[k]}` : ''}`
                  const fixedOnly = k.startsWith('button_')
                  return (
                    <div key={k} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1e2d6b' }}>{title}</span>
                      <select style={inputStyle} value={m.source} disabled={fixedOnly}
                        onChange={e => setMapping(s => ({ ...s, [k]: { source: e.target.value as any, fallback: m.fallback || (e.target.value === 'fixed' ? undefined : 'família'), value: m.value, key: importCols[0] } }))}>
                        <option value="contact.first_name">Primeiro nome do contato</option>
                        <option value="contact.name">Nome completo do contato</option>
                        <option value="fixed">Texto fixo</option>
                        {importCols.length > 0 && <option value="import">Coluna da lista importada</option>}
                      </select>
                      {m.source === 'fixed' ? (
                        <input style={inputStyle} placeholder="Texto" value={m.value || ''} onChange={e => setMapping(s => ({ ...s, [k]: { ...m, value: e.target.value } }))} />
                      ) : (
                        <div style={{ display: 'grid', gap: 6 }}>
                          {m.source === 'import' && (
                            <select style={inputStyle} value={m.key || ''} onChange={e => setMapping(s => ({ ...s, [k]: { ...m, key: e.target.value } }))}>
                              {importCols.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          )}
                          <input style={inputStyle} placeholder="Se não tiver o dado, usar…" value={m.fallback || ''} onChange={e => setMapping(s => ({ ...s, [k]: { ...m, fallback: e.target.value } }))} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            <div style={{ display: 'grid', gap: 10 }}>
              <label style={labelStyle}>Quando o contato responder</label>
              {[['any', 'Qualquer resposta (sem clicar em botão)'] as const, ...quickReplies.map(i => [String(i), `Clicou em "${tpl.buttons[i]?.text}"`] as const)].map(([k, title]) => {
                const a = actions[k] || EMPTY_ACTION
                const set = (patch: Partial<ActionForm>) => setActions(s => ({ ...s, [k]: { ...a, ...patch } }))
                return (
                  <div key={k} style={{ border: '1.5px solid #E2E8F0', borderRadius: 12, padding: 12, display: 'grid', gap: 10 }}>
                    <strong style={{ fontSize: 13, color: '#1e293b' }}>{title}</strong>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, alignItems: 'center' }}>
                      <div style={{ position: 'relative' }}>
                        <Tag size={13} style={{ position: 'absolute', left: 10, top: 12, color: '#94a3b8' }} />
                        <input style={{ ...inputStyle, paddingLeft: 30 }} placeholder="Etiqueta (opcional)" value={a.tag} maxLength={50} onChange={e => set({ tag: e.target.value })} />
                      </div>
                      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#1e293b', cursor: 'pointer' }}>
                        <input type="checkbox" checked={a.skipBot} onChange={e => set({ skipBot: e.target.checked, ...(e.target.checked ? {} : { userIds: [], groupIds: [] }) })} />
                        <Bot size={14} color="#B45309" /> Pular o robô e mandar pra atendente
                      </label>
                    </div>
                    {a.skipBot && (lk.users.length > 0 || lk.groups.length > 0) && (
                      <div style={{ display: 'grid', gap: 6 }}>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>Distribuir entre (sem ninguém marcado, vai pra fila geral):</span>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {lk.groups.map(g => <Pill key={g.id} on={a.groupIds.includes(g.id)} onClick={() => set({ groupIds: toggleIn(a.groupIds, g.id) })}>{g.emoji || '👥'} {g.name}</Pill>)}
                          {lk.users.map(u => <Pill key={u.id} on={a.userIds.includes(u.id)} onClick={() => set({ userIds: toggleIn(a.userIds, u.id) })}>{u.full_name}</Pill>)}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              <p style={hintStyle}>Sem "pular o robô", a resposta segue pro robô da escola como um atendimento novo.</p>
            </div>
          </div>
        )}

        {/* ── 4. Revisão ── */}
        {step === 3 && tpl && (
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div>
                <label style={labelStyle}>Nome da campanha</label>
                <input style={inputStyle} value={name} maxLength={120} placeholder="Ex.: Rematrícula 2027 — famílias" onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Quando enviar</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select style={inputStyle} value={sendMode} onChange={e => setSendMode(e.target.value as any)}>
                    <option value="now">Assim que for liberada</option>
                    <option value="scheduled">Agendar</option>
                  </select>
                  {sendMode === 'scheduled' && <input type="datetime-local" style={inputStyle} value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />}
                </div>
              </div>
            </div>
            {previewing ? <div style={{ height: 120, borderRadius: 12, background: '#f8fafc' }} className="animate-pulse" /> : preview && <>
              <AudienceSummary preview={preview} />
              {preview.sample?.[0]?.preview && (
                <div>
                  <label style={labelStyle}>Como a mensagem chega (exemplo: {preview.sample[0].name || preview.sample[0].phone})</label>
                  <div style={{ background: '#DCF8C6', borderRadius: 12, padding: 12, fontSize: 13, color: '#1e293b', whiteSpace: 'pre-wrap', lineHeight: 1.5, maxWidth: 460 }}>{preview.sample[0].preview}</div>
                </div>
              )}
              {preview.estimate && <CostBox est={preview.estimate} />}
              {sendMode === 'scheduled' && <p style={{ ...hintStyle, display: 'flex', gap: 6, alignItems: 'center' }}><CalendarClock size={13} /> O envio respeita o limite por hora da escola — campanhas grandes levam algumas horas.</p>}
            </>}
            {stepProblem && <p style={{ margin: 0, fontSize: 12, color: '#B45309', display: 'flex', gap: 6, alignItems: 'center' }}><AlertTriangle size={13} /> {stepProblem}</p>}
          </div>
        )}
        </>}
      </div>
    </Modal>
  )
}

function AudienceSummary({ preview }: { preview: any }) {
  const a = preview.audience
  const excluded = Object.entries(a.excluded || {}) as [string, number][]
  return (
    <div style={{ fontSize: 13, color: '#1e293b' }}>
      <strong style={{ fontSize: 15 }}>{a.eligible.toLocaleString('pt-BR')}</strong> destinatário(s)
      {excluded.length > 0 && <span style={{ color: '#94a3b8' }}> · fora: {excluded.map(([k, v]) => `${v} ${(EXCLUDED_REASON[k] || k).toLowerCase()}`).join(', ')}</span>}
      {a.over_limit && <div style={{ color: '#DC2626', fontSize: 12 }}>Acima do limite de {a.max.toLocaleString('pt-BR')} por campanha — refine os filtros.</div>}
    </div>
  )
}

function CostBox({ est }: { est: any }) {
  if (!est.available) return <ErrorBox message={est.reason} />
  const line = (l: string, v: string, strong?: boolean) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: strong ? '#1e2d6b' : '#475569', fontWeight: strong ? 700 : 400 }}><span>{l}</span><span>{v}</span></div>
  )
  return (
    <div style={{ border: '1.5px solid #E2E8F0', borderRadius: 12, padding: 14, display: 'grid', gap: 6, maxWidth: 420 }}>
      {line(`${CATEGORY_LABEL[est.category] || est.category} · ${brl(est.unit_brl)} por mensagem${est.own_account ? ' (conta própria na Meta: só a taxa)' : ''}`, brl(est.subtotal_brl))}
      {est.credit_applied_brl > 0 && line(`Crédito usado (saldo ${brl(est.credit_balance_brl)})`, `− ${brl(est.credit_applied_brl)}`)}
      <div style={{ borderTop: '1px solid #f1f5f9', margin: '4px 0' }} />
      {line('A pagar', brl(est.total_brl), true)}
      {est.minimum_applied && <p style={{ ...hintStyle, margin: 0 }}>Valor mínimo de cobrança aplicado.</p>}
      {est.total_brl === 0 && <p style={{ ...hintStyle, margin: 0 }}>Coberto pelo seu crédito — não gera cobrança.</p>}
    </div>
  )
}

function Chips({ label, options, value, onChange }: { label: string; options: { id: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  if (!options.length) return null
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxHeight: 120, overflowY: 'auto' }}>
        {options.map(o => <Pill key={o.id} on={value.includes(o.id)} onClick={() => onChange(toggleIn(value, o.id))}>{o.label}</Pill>)}
      </div>
    </div>
  )
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{ padding: '5px 11px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
      border: on ? '1.5px solid #00A896' : '1.5px solid #E2E8F0', background: on ? '#F0FDFA' : '#fff', color: on ? '#047857' : '#475569' }}>
      {children}
    </button>
  )
}
