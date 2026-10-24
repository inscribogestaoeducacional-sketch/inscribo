// Configurações > WhatsApp > Sequência para lead sem resposta.
// A escola liga, escolhe até 5 passos (dias depois do passo anterior + modelo aprovado) e o horário.
// Quem entra na sequência é colocado pelo atendente/gestor na conversa; o envio roda no servidor (lead-sequence, a cada 15 min).
import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Clock, Repeat, ListChecks } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { BRAND } from '../../../lib/brand'
import { loadTemplates, type TemplateRow } from '../../transmissoes/TemplatesPanel'
import { TEMPLATE_SLOT_KEYS } from '../../../lib/templateSlots'
import { SEQ_DEFAULT_STEPS, SEQ_MAX_STEPS, seqVarKind, type SeqStep } from '../../../lib/leadSequence'
import { Card, Title, Switch, SaveButton, GhostButton, NowNote, WarnNote, input, label, hint } from './ui'

const DAYS = [['Dom', 0], ['Seg', 1], ['Ter', 2], ['Qua', 3], ['Qui', 4], ['Sex', 5], ['Sáb', 6]] as const
type Cfg = { enabled: boolean; steps: SeqStep[]; send_from: number; send_to: number; weekdays: number[]; daily_cap: number }
const DEFAULTS: Cfg = { enabled: false, steps: SEQ_DEFAULT_STEPS, send_from: 8, send_to: 19, weekdays: [1, 2, 3, 4, 5, 6], daily_cap: 100 }
const bubble = { background: '#D9FDD3', borderRadius: 10, padding: '8px 10px', fontSize: 12.5, color: '#111B21', whiteSpace: 'pre-wrap' as const, lineHeight: 1.45, boxShadow: '0 1px 1px rgba(0,0,0,.08)' }

export default function LeadSequenceSettings({ institutionId }: { institutionId: string }) {
  const [cfg, setCfg] = useState<Cfg>(DEFAULTS)
  const [ready, setReady] = useState<boolean | null>(null)
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [stats, setStats] = useState<{ sent: number; failed: number; leads: number } | null>(null)

  useEffect(() => {
    ;(async () => {
      const { data, error } = await supabase.from('lead_sequence_config').select('*').eq('institution_id', institutionId).maybeSingle()
      if (error) { setReady(false); return }
      setReady(true)
      if (data) setCfg({ enabled: !!data.enabled, steps: Array.isArray(data.steps) && data.steps.length ? data.steps : SEQ_DEFAULT_STEPS, send_from: data.send_from, send_to: data.send_to, weekdays: data.weekdays || [], daily_cap: data.daily_cap })
      try { setTemplates(await loadTemplates(institutionId, { all: true })) } catch { /* lista fica vazia */ }
      const since = new Date(Date.now() - 30 * 86400000).toISOString()
      const { data: logs } = await supabase.from('lead_sequence_log').select('lead_id, status').eq('institution_id', institutionId).gte('sent_at', since)
      const rows = (logs || []) as { lead_id: string; status: string }[]
      setStats({ sent: rows.filter(r => r.status === 'sent').length, failed: rows.filter(r => r.status === 'failed').length, leads: new Set(rows.filter(r => r.status === 'sent').map(r => r.lead_id)).size })
    })()
  }, [institutionId])

  // Só serve modelo aprovado e que o sistema sabe preencher sozinho (nome, escola, aluno).
  const options = useMemo(() => templates.filter(t => {
    if (t.status !== 'approved' || (TEMPLATE_SLOT_KEYS as string[]).includes(t.name) || t.name === 'pesquisa_saida') return false
    if ((t.buttons || []).length > 0 || JSON.stringify(t.header_config || '').includes('{{')) return false
    const nums = [...new Set([...(t.body_text || '').matchAll(/\{\{(\d+)\}\}/g)].map(m => m[1]))]
    return nums.every(n => seqVarKind((t.variable_labels || {})[n]))
  }), [templates])
  const byName = (n: string) => options.find(o => o.name === n)

  const setStep = (i: number, patch: Partial<SeqStep>) => setCfg(c => ({ ...c, steps: c.steps.map((s, j) => j === i ? { ...s, ...patch } : s) }))
  const valid = cfg.steps.length > 0 && cfg.steps.every(s => s.days >= 1 && s.template) && cfg.send_to > cfg.send_from && cfg.weekdays.length > 0

  const save = async () => {
    setSaving(true); setSaved(false)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('lead_sequence_config').upsert({ institution_id: institutionId, enabled: cfg.enabled, steps: cfg.steps, send_from: cfg.send_from, send_to: cfg.send_to, weekdays: cfg.weekdays, daily_cap: cfg.daily_cap, updated_at: new Date().toISOString(), updated_by: user?.id || null }, { onConflict: 'institution_id' })
    setSaving(false)
    if (error) { alert('Não foi possível salvar: ' + error.message); return }
    setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  if (ready === false) return <WarnNote>Esta função está sendo ativada pela Áion. Volte em alguns minutos.</WarnNote>
  if (ready === null) return null

  const prev = (n: string) => (byName(n)?.body_text || '').replace(/\{\{1\}\}/g, 'Maria').replace(/\{\{2\}\}/g, 'nossa escola').replace(/\{\{3\}\}/g, 'Pedro')

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div style={{ flex: '1 1 460px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink }}>Sequência para lead sem resposta</div>
              <div style={{ fontSize: 12.5, color: BRAND.muted, marginTop: 2 }}>Você ou o atendente coloca o lead na sequência dentro da conversa do WhatsApp. O sistema manda até {SEQ_MAX_STEPS} mensagens, uma de cada vez, com o modelo que você escolher.</div>
            </div>
            <Switch on={cfg.enabled} onChange={v => setCfg({ ...cfg, enabled: v })} labelText="Ligar a sequência" />
          </div>
        </Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: cfg.enabled ? 1 : 0.6 }}>
          <Card>
            <Title Icon={Repeat} title="Os passos" help="O 1º passo conta os dias desde que o lead foi colocado na sequência. Os demais contam os dias depois do passo anterior." />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {cfg.steps.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: '#F8FAFC', border: `1px solid ${BRAND.line}`, borderRadius: 14, padding: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: BRAND.primary, minWidth: 54 }}>Passo {i + 1}</span>
                  <span style={{ fontSize: 13, color: BRAND.muted }}>depois de</span>
                  <input type="number" min={1} max={90} value={s.days} onChange={e => setStep(i, { days: Math.max(1, parseInt(e.target.value) || 1) })} style={{ ...input, width: 70 }} aria-label={`Dias do passo ${i + 1}`} />
                  <span style={{ fontSize: 13, color: BRAND.muted }}>dias, enviar</span>
                  <select value={s.template} onChange={e => setStep(i, { template: e.target.value })} style={{ ...input, flex: '1 1 180px', width: 'auto' }} aria-label={`Modelo do passo ${i + 1}`}>
                    {!byName(s.template) && <option value={s.template}>{s.template} (indisponível)</option>}
                    {options.map(o => <option key={o.name} value={o.name}>{o.display_name || o.name}</option>)}
                  </select>
                  <button type="button" aria-label="Remover passo" onClick={() => setCfg(c => ({ ...c, steps: c.steps.filter((_, j) => j !== i) }))} disabled={cfg.steps.length <= 1}
                    style={{ border: 'none', background: 'none', color: '#DC2626', cursor: cfg.steps.length <= 1 ? 'default' : 'pointer', opacity: cfg.steps.length <= 1 ? .3 : 1, padding: 6 }}><Trash2 size={16} /></button>
                  {byName(s.template) && <div style={{ ...bubble, flexBasis: '100%' }}>{prev(s.template)}</div>}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <GhostButton disabled={cfg.steps.length >= SEQ_MAX_STEPS} onClick={() => setCfg(c => ({ ...c, steps: [...c.steps, { days: (c.steps[c.steps.length - 1]?.days || 0) + 7, template: options[0]?.name || '' }] }))}><Plus size={14} /> Adicionar passo ({cfg.steps.length}/{SEQ_MAX_STEPS})</GhostButton>
            </div>
            {options.length === 0 && <div style={{ marginTop: 10 }}><WarnNote>Nenhum modelo aprovado e compatível ainda. Os modelos precisam estar aprovados na Meta e usar só nome do responsável, escola ou aluno.</WarnNote></div>}
          </Card>
          <Card>
            <Title Icon={Clock} title="Quando enviar" help="Fora do horário ou fora dos dias marcados, o sistema espera." />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={{ ...label, margin: 0 }}>Das</label>
              <select style={{ ...input, width: 90 }} value={cfg.send_from} onChange={e => setCfg({ ...cfg, send_from: parseInt(e.target.value) })}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h}h</option>)}</select>
              <label style={{ ...label, margin: 0 }}>às</label>
              <select style={{ ...input, width: 90 }} value={cfg.send_to} onChange={e => setCfg({ ...cfg, send_to: parseInt(e.target.value) })}>{Array.from({ length: 24 }, (_, h) => h + 1).map(h => <option key={h} value={h}>{h}h</option>)}</select>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
              {DAYS.map(([n, v]) => { const on = cfg.weekdays.includes(v); return (
                <button key={v} type="button" onClick={() => setCfg(c => ({ ...c, weekdays: on ? c.weekdays.filter(x => x !== v) : [...c.weekdays, v].sort() }))}
                  style={{ padding: '7px 12px', borderRadius: 999, border: `1px solid ${on ? BRAND.primary : BRAND.line}`, background: on ? BRAND.soft : '#fff', color: on ? BRAND.primaryDark : BRAND.muted, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{n}</button>) })}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 14 }}>
              <label style={{ ...label, margin: 0 }}>No máximo por dia</label>
              <select style={{ ...input, width: 110 }} value={cfg.daily_cap} onChange={e => setCfg({ ...cfg, daily_cap: parseInt(e.target.value) })}>{[25, 50, 100, 200, 300].map(n => <option key={n} value={n}>{n} envios</option>)}</select>
            </div>
          </Card>
          <Card>
            <Title Icon={ListChecks} title="Regras" />
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: BRAND.muted, lineHeight: 1.7 }}>
              <li>No máximo {SEQ_MAX_STEPS} mensagens por lead, nunca mais de uma por dia.</li>
              <li>Para assim que o lead responde. A conversa volta para a equipe.</li>
              <li>Matriculados, perdidos e números bloqueados ou descadastrados saem da sequência sozinhos.</li>
              <li>Se a equipe falou com o lead nas últimas 24 horas, o sistema espera.</li>
              <li>Cada mensagem enviada aparece na conversa do lead.</li>
            </ul>
          </Card>
        </div>
        {stats && <NowNote>Últimos 30 dias: {stats.sent} {stats.sent === 1 ? 'mensagem enviada' : 'mensagens enviadas'} para {stats.leads} {stats.leads === 1 ? 'lead' : 'leads'}{stats.failed ? `, ${stats.failed} com falha` : ''}.</NowNote>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <SaveButton text="Salvar sequência" saving={saving} saved={saved} disabled={!valid} onClick={save} />
          <GhostButton onClick={() => setCfg({ ...DEFAULTS, enabled: cfg.enabled })}>Voltar ao padrão</GhostButton>
        </div>
        {!valid && <p style={hint}>Confira os passos: cada um precisa de um modelo e de pelo menos 1 dia, e marque pelo menos um dia de envio.</p>}
      </div>
    </div>
  )
}
