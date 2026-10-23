// Configurações > WhatsApp > Modelos da Meta.
// Lista os modelos de mensagem da própria escola (nunca de outra) e os modelos
// padrão que toda escola recebe. Usa os mesmos dados de Transmissões > Templates
// (loadTemplates), só com o visual das Configurações.
import { useEffect, useState } from 'react'
import { FileText, Plus, RefreshCw, Copy, Pencil, Send, Loader2, Lock, CalendarCheck, Check } from 'lucide-react'
import TemplatesPanel, { loadTemplates, type TemplateRow, type TemplateRequest } from '../../transmissoes/TemplatesPanel'
import { TEMPLATE_STATUS, CATEGORY_LABEL } from '../../../lib/broadcasts'
import { BRAND, GRAD } from '../../../lib/brand'
import { supabase } from '../../../lib/supabase'
import { Card, Title, GhostButton, NowNote, WarnNote, input } from './ui'
import { TEMPLATE_SLOTS, TEMPLATE_SLOT_KEYS, fitsSlot, type TemplateSlot } from '../../../lib/templateSlots'

const bubble = { background: '#D9FDD3', borderRadius: 10, padding: '8px 10px', fontSize: 12.5, color: '#111B21', whiteSpace: 'pre-wrap' as const, lineHeight: 1.45, boxShadow: '0 1px 1px rgba(0,0,0,.08)' }

function Tag({ padrao }: { padrao: boolean }) {
  return <span style={{ fontSize: 11, fontWeight: 800, borderRadius: 999, padding: '3px 10px', color: padrao ? BRAND.primaryDark : '#475569', background: padrao ? BRAND.soft : '#F1F5F9' }}>{padrao ? 'Padrão' : 'Da escola'}</span>
}

export default function TemplatesSettings({ institutionId }: { institutionId: string }) {
  const [request, setRequest] = useState<TemplateRequest>({ n: 0 })
  const [enabled, setEnabled] = useState<boolean | null>(null)
  useEffect(() => {
    supabase.from('broadcast_settings').select('enabled').eq('institution_id', institutionId).maybeSingle()
      .then(({ data }: any) => setEnabled(data ? data.enabled === true : false))
  }, [institutionId])
  const onNew = () => setRequest(r => ({ n: r.n + 1 }))
  const onEdit = (t: TemplateRow, duplicate: boolean) => setRequest(r => ({ n: r.n + 1, template: t, duplicate }))
  const [rows, setRows] = useState<TemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const reload = async () => { setLoading(true); try { setRows(await loadTemplates(institutionId)) } catch (e) { console.error('[Modelos]', e) } setLoading(false) }
  useEffect(() => { reload() }, [institutionId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Mensagens de visita que o sistema envia sozinho: o modelo padrão de cada uma e a escolha da escola.
  const [slotDefs, setSlotDefs] = useState<Partial<Record<TemplateSlot, TemplateRow>>>({})
  const [choice, setChoice] = useState<Partial<Record<TemplateSlot, string | null>>>({})
  const [pick, setPick] = useState<Partial<Record<TemplateSlot, string>>>({})
  const [savingSlot, setSavingSlot] = useState<TemplateSlot | null>(null)
  const [slotMsg, setSlotMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const loadSlots = async () => {
    const [{ data: defs }, { data: ch }] = await Promise.all([
      supabase.from('template_definitions').select('id, name, display_name, category, language, body_text, header_config, buttons, variable_examples, variable_labels, institution_id, available_contexts').in('name', TEMPLATE_SLOT_KEYS).is('institution_id', null),
      supabase.from('template_slot_choice').select('slot, template_definition_id').eq('institution_id', institutionId),
    ])
    const d: Partial<Record<TemplateSlot, TemplateRow>> = {}
    ;((defs || []) as any[]).forEach(x => { d[x.name as TemplateSlot] = { ...x, buttons: Array.isArray(x.buttons) ? x.buttons : [], status: 'approved', approved_category: null, error_message: null, visible: true } as TemplateRow })
    setSlotDefs(d)
    const c: Partial<Record<TemplateSlot, string | null>> = {}
    ;((ch || []) as any[]).forEach(x => { c[x.slot as TemplateSlot] = x.template_definition_id })
    setChoice(c)
  }
  useEffect(() => { loadSlots() }, [institutionId]) // eslint-disable-line react-hooks/exhaustive-deps
  const setSlot = async (slot: TemplateSlot, defId: string | null) => {
    setSavingSlot(slot); setSlotMsg(null)
    const { error } = await supabase.from('template_slot_choice').upsert({ institution_id: institutionId, slot, template_definition_id: defId, updated_at: new Date().toISOString() }, { onConflict: 'institution_id,slot' })
    setSavingSlot(null)
    if (error) { setSlotMsg({ ok: false, text: 'Não foi possível salvar: ' + error.message }); return }
    setSlotMsg({ ok: true, text: defId ? 'Pronto: o sistema passa a usar o modelo da escola.' : 'Pronto: voltou para o modelo padrão.' })
    loadSlots()
  }

  const visible = rows.filter(t => t.institution_id === null || (t.available_contexts || []).length > 0 || t.status !== 'not_submitted')
  const sorted = visible
  const padrao = sorted.filter(t => t.institution_id === null)
  const own = sorted.filter(t => t.institution_id !== null)

  const item = (t: TemplateRow) => {
    const st = TEMPLATE_STATUS[t.status] || TEMPLATE_STATUS.not_submitted
    const isOwn = t.institution_id !== null
    return (
      <div key={t.id} style={{ border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 16, background: '#fff', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px', minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14.5, fontWeight: 800, color: BRAND.ink }}>{t.display_name || t.name}</span>
            <Tag padrao={!isOwn} />
            <span style={{ fontSize: 11.5, fontWeight: 700, color: st.color, background: st.bg, borderRadius: 999, padding: '3px 10px' }}>{st.label}</span>
          </div>
          <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 4 }}>{CATEGORY_LABEL[t.approved_category || t.category] || t.category} · {t.language === 'pt_BR' ? 'Português' : t.language}</div>
          {t.status === 'rejected' && t.error_message && <div style={{ fontSize: 12, color: '#991B1B', marginTop: 6 }}>Motivo da Meta: {t.error_message}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {isOwn && t.status === 'not_submitted' && <GhostButton onClick={() => onEdit?.(t, false)}><Pencil size={14} /> Editar rascunho</GhostButton>}
            {isOwn && t.status === 'rejected' && <GhostButton onClick={() => onEdit?.(t, true)}><Copy size={14} /> Duplicar para corrigir</GhostButton>}
            {isOwn && !['not_submitted', 'rejected'].includes(t.status) && <span style={{ fontSize: 12, color: BRAND.muted, display: 'inline-flex', gap: 5, alignItems: 'center' }}><Lock size={13} /> Já enviado: o texto não muda</span>}
            {!isOwn && <GhostButton disabled={enabled === false} onClick={() => onEdit(t, true)}><Copy size={14} /> Criar a minha versão</GhostButton>}
            {!isOwn && <span style={{ fontSize: 12, color: BRAND.muted, display: 'inline-flex', gap: 5, alignItems: 'center' }}><Lock size={13} /> O padrão não muda; a sua versão fica ao lado</span>}
          </div>
        </div>
        <div style={{ flex: '0 1 280px', minWidth: 220, background: '#E7F0E8', borderRadius: 14, padding: 10 }}>
          <div style={bubble}>{t.body_text}</div>
          {t.buttons.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>{t.buttons.map((b, i) => <div key={i} style={{ background: '#fff', borderRadius: 8, textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#0B6E99', padding: '6px 0' }}>{b.text}</div>)}</div>}
        </div>
      </div>
    )
  }

  const slotCard = (slot: TemplateSlot) => {
    const meta = TEMPLATE_SLOTS[slot]
    const std = slotDefs[slot]
    const chosenId = choice[slot] || null
    const chosen = chosenId ? rows.find(r => r.id === chosenId) : undefined
    const inUse = chosen && chosen.status === 'approved' && fitsSlot(slot, chosen) ? chosen : null
    const options = own.filter(t => t.status === 'approved' && fitsSlot(slot, t))
    const text = (inUse || std)?.body_text
    return (
      <div key={slot} style={{ border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 16, background: '#fff', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px', minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14.5, fontWeight: 800, color: BRAND.ink }}>{meta.label}</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#047857', background: '#D1FAE5', borderRadius: 999, padding: '3px 10px' }}>{inUse ? 'Em uso: o da escola' : 'Em uso: o padrão'}</span>
          </div>
          <div style={{ fontSize: 12.5, color: BRAND.muted, marginTop: 4 }}>{meta.desc}</div>
          {chosenId && !inUse && <WarnNote>O modelo escolhido não está mais valendo (não aprovado ou mudou). O sistema está usando o padrão.</WarnNote>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {std && <GhostButton disabled={enabled === false} onClick={() => onEdit(std, true)}><Copy size={14} /> Criar a minha versão</GhostButton>}
            {inUse && <GhostButton disabled={savingSlot === slot} onClick={() => setSlot(slot, null)}>Voltar ao padrão</GhostButton>}
          </div>
          {options.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <select aria-label={`Modelo da escola para ${meta.label}`} value={pick[slot] || ''} onChange={e => setPick(p => ({ ...p, [slot]: e.target.value }))} style={{ ...input, width: 'auto', minWidth: 200, padding: '8px 10px', fontSize: 13 }}>
                <option value="">Usar um modelo da escola…</option>
                {options.map(o => <option key={o.id} value={o.id}>{o.display_name || o.name}</option>)}
              </select>
              <GhostButton disabled={!pick[slot] || savingSlot === slot} onClick={() => setSlot(slot, pick[slot]!)}><Check size={14} /> Usar este</GhostButton>
            </div>
          )}
          <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 10, lineHeight: 1.5 }}>A versão da escola precisa ser aprovada pela Meta e manter as mesmas variáveis: {meta.varsHelp}.</div>
        </div>
        <div style={{ flex: '0 1 280px', minWidth: 220, background: '#E7F0E8', borderRadius: 14, padding: 10 }}>
          <div style={bubble}>{text || '…'}</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 280px' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink }}>Modelos de mensagem da sua escola</div>
            <div style={{ fontSize: 12.5, color: BRAND.muted, marginTop: 2 }}>A Meta exige um modelo aprovado para a escola puxar conversa com o cliente. A aprovação leva de minutos a 24 horas.</div>
          </div>
          <GhostButton onClick={reload}><RefreshCw size={14} /> Atualizar</GhostButton>
          <button type="button" onClick={onNew} disabled={enabled === false} style={{ opacity: enabled === false ? 0.5 : 1, cursor: enabled === false ? 'default' : 'pointer',  display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 18px', borderRadius: 14, border: 'none', background: GRAD, color: '#fff', fontWeight: 800, fontSize: 14, fontFamily: 'inherit' }}><Plus size={16} /> Novo modelo</button>
        </div>
      </Card>
      {enabled === false && <WarnNote>Os modelos próprios ainda não estão liberados para esta escola. Fale com a Áion para liberar. Você já pode ver a lista abaixo.</WarnNote>}
      <TemplatesPanel institutionId={institutionId} hideLists request={request} onChanged={reload} />
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Loader2 size={24} color={BRAND.primary} className="animate-spin" /></div>
      ) : (
        <>
          <Card>
            <Title Icon={CalendarCheck} title="Mensagens de visita" help="O sistema envia sozinho quando uma visita é agendada. Você pode trocar o padrão pelo modelo da escola." />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{TEMPLATE_SLOT_KEYS.map(slotCard)}</div>
            {slotMsg && <div style={{ marginTop: 10 }}>{slotMsg.ok ? <NowNote>{slotMsg.text}</NowNote> : <WarnNote>{slotMsg.text}</WarnNote>}</div>}
          </Card>
          <Card>
            <Title Icon={FileText} title="Modelos da escola" help="Criados por vocês. Só esta escola enxerga." />
            {own.length === 0
              ? <NowNote>Nenhum modelo próprio ainda. Toque em “Novo modelo” para criar o primeiro.</NowNote>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{own.map(item)}</div>}
          </Card>
          <Card>
            <Title Icon={Lock} title="Modelos padrão" help="Já vêm prontos e aprovados para toda escola. Para mudar o texto, crie a sua versão e espere a Meta aprovar." />
            {padrao.length === 0
              ? <NowNote>Nenhum modelo padrão liberado para esta escola ainda.</NowNote>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{padrao.map(item)}</div>}
          </Card>
        </>
      )}
    </div>
  )
}
