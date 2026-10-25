// Configurações → WhatsApp → Feriados e datas especiais.
// Cada escola cadastra os dias em que o atendimento muda e escolhe o que o
// cliente recebe (antes do robô, no lugar dele, ou depois dele).
import { useEffect, useRef, useState } from 'react'
import { CalendarDays, Check, Loader2, Pencil, Plus, Smartphone, Trash2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { BRAND } from '../../../lib/brand'
import { Card, Title, Switch, SaveButton, GhostButton, WarnNote, input, label, hint } from './ui'

export type SpecialDateRow = {
  id: string; institution_id: string; name: string; date_start: string; date_end: string | null; repeat_yearly: boolean
  day_type: 'closed' | 'reduced'; reduced_end: string | null; mode: 'before_robot' | 'only_message' | 'after_robot'; message: string; active: boolean
}
type Form = Omit<SpecialDateRow, 'id' | 'institution_id' | 'active'> & { id?: string; active: boolean }

const MODES: { id: SpecialDateRow['mode']; label: string; short: string }[] = [
  { id: 'before_robot', label: 'Avisar e deixar o robô atender', short: 'Antes do robô' },
  { id: 'only_message', label: 'Só a mensagem (robô não atende)', short: 'Só a mensagem' },
  { id: 'after_robot', label: 'Avisar depois do robô', short: 'Depois do robô' },
]

const NATIONAL: { name: string; md: string }[] = [
  { name: 'Confraternização Universal', md: '01-01' }, { name: 'Tiradentes', md: '04-21' }, { name: 'Dia do Trabalho', md: '05-01' },
  { name: 'Independência do Brasil', md: '09-07' }, { name: 'Nossa Senhora Aparecida', md: '10-12' }, { name: 'Finados', md: '11-02' },
  { name: 'Proclamação da República', md: '11-15' }, { name: 'Dia da Consciência Negra', md: '11-20' }, { name: 'Natal', md: '12-25' },
]

const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const whenTxt = (r: { date_start: string; date_end: string | null; repeat_yearly: boolean }) =>
  r.date_end && r.date_end !== r.date_start ? `${fmt(r.date_start)} a ${fmt(r.date_end)}` : fmt(r.date_start)

const blank = (): Form => ({
  name: '', date_start: new Date().toISOString().slice(0, 10), date_end: null, repeat_yearly: true, day_type: 'closed', reduced_end: '12:00',
  mode: 'only_message', message: 'Hoje nossa escola não terá atendimento. Nosso atendimento volta no próximo dia útil: {horario}. Deixe sua mensagem que respondemos assim que abrirmos.', active: true,
})

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      style={{ padding: '8px 13px', borderRadius: 12, border: `1px solid ${active ? BRAND.primary : BRAND.line}`, background: active ? BRAND.soft : '#fff', color: active ? BRAND.primaryDark : BRAND.ink, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>{children}</button>
  )
}

export default function SpecialDatesSettings({ institutionId, horarioTxt, onChanged }: { institutionId: string; horarioTxt: string; onChanged?: (n: number) => void }) {
  const [rows, setRows] = useState<SpecialDateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)
  // Celular: ao abrir o formulário, leva a tela até ele (a lista fica acima).
  const formOpen = !!form, formId = form?.id
  useEffect(() => { if (formOpen && window.innerWidth < 768) setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60) }, [formOpen, formId])

  const load = async () => {
    setLoading(true)
    const { data, error: e } = await supabase.from('whatsapp_special_dates').select('*').eq('institution_id', institutionId).order('date_start', { ascending: true })
    if (e) setError(e.message); else { setError(null); const list = (data || []) as SpecialDateRow[]; setRows(list); onChanged?.(list.filter(r => r.active).length) }
    setLoading(false)
  }
  useEffect(() => { load() }, [institutionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!form) return
    if (!form.name.trim()) { alert('Dê um nome para a data.'); return }
    if (!form.message.trim()) { alert('Escreva a mensagem que o cliente vai receber.'); return }
    if (form.date_end && form.date_end < form.date_start) { alert('A data final não pode ser antes da inicial.'); return }
    setSaving(true)
    const payload = {
      institution_id: institutionId, name: form.name.trim(), date_start: form.date_start, date_end: form.date_end || null,
      repeat_yearly: form.repeat_yearly, day_type: form.day_type, reduced_end: form.day_type === 'reduced' ? (form.reduced_end || '12:00') : null,
      mode: form.mode, message: form.message.trim(), active: form.active, updated_at: new Date().toISOString(),
    }
    const { error: e } = form.id ? await supabase.from('whatsapp_special_dates').update(payload).eq('id', form.id) : await supabase.from('whatsapp_special_dates').insert(payload)
    setSaving(false)
    if (e) { alert('Erro ao salvar: ' + e.message); return }
    setForm(null); load()
  }

  const toggle = async (r: SpecialDateRow, v: boolean) => {
    setRows(prev => prev.map(x => (x.id === r.id ? { ...x, active: v } : x)))
    const { error: e } = await supabase.from('whatsapp_special_dates').update({ active: v, updated_at: new Date().toISOString() }).eq('id', r.id)
    if (e) { alert('Erro ao salvar: ' + e.message); load() } else onChanged?.(rows.filter(x => (x.id === r.id ? v : x.active)).length)
  }

  const remove = async (id: string) => {
    if (!confirm('Excluir esta data?')) return
    const { error: e } = await supabase.from('whatsapp_special_dates').delete().eq('id', id)
    if (e) { alert('Erro ao excluir: ' + e.message); return }
    setForm(null); load()
  }

  const addNational = async () => {
    setBusy(true)
    const year = new Date().getFullYear()
    const have = new Set(rows.map(r => r.date_start.slice(5, 10)))
    const toAdd = NATIONAL.filter(n => !have.has(n.md)).map(n => ({
      institution_id: institutionId, name: n.name, date_start: `${year}-${n.md}`, date_end: null, repeat_yearly: true, day_type: 'closed', reduced_end: null,
      mode: 'only_message', message: `Hoje é feriado (${n.name}). Nosso atendimento volta no próximo dia útil: {horario}. Deixe sua mensagem que respondemos assim que abrirmos.`, active: true,
    }))
    if (!toAdd.length) { alert('Os feriados nacionais já estão na lista.'); setBusy(false); return }
    const { error: e } = await supabase.from('whatsapp_special_dates').insert(toAdd)
    setBusy(false)
    if (e) { alert('Erro ao adicionar: ' + e.message); return }
    load()
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => (f ? { ...f, [k]: v } : f))
  const prevMsg = (form?.message || '').replace(/\{horario\}/g, horarioTxt)
  const bub = (me: boolean): React.CSSProperties => ({ maxWidth: '88%', borderRadius: 10, padding: '7px 10px', fontSize: 13, color: '#111B21', marginBottom: 8, whiteSpace: 'pre-wrap', boxShadow: '0 1px 1px rgba(0,0,0,.08)', background: me ? '#D9FDD3' : '#fff', marginLeft: me ? 'auto' : 0 })

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Loader2 size={24} color={BRAND.primary} className="animate-spin" /></div>

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div style={{ flex: '1 1 540px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && <WarnNote>Não foi possível carregar as datas ({error}).</WarnNote>}
        <div style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: `1px solid ${BRAND.line}`, flexWrap: 'wrap' }}>
            <CalendarDays size={16} color={BRAND.primary} />
            <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.ink, flex: '1 1 140px' }}>Datas cadastradas</div>
            <GhostButton onClick={addNational} disabled={busy}>{busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Adicionar feriados nacionais</GhostButton>
            <SaveButton text="Nova data" onClick={() => setForm(blank())} />
          </div>
          {rows.length === 0
            ? <div style={{ padding: '22px 18px', fontSize: 13, color: BRAND.muted, lineHeight: 1.5 }}>Nenhuma data cadastrada. Use “Adicionar feriados nacionais” para começar e depois inclua os feriados da sua cidade e os recessos da escola.</div>
            : rows.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderTop: '1px solid #F1F4F8', flexWrap: 'wrap' }}>
                <div style={{ width: 92, fontSize: 13.5, fontWeight: 800, color: BRAND.ink }}>{whenTxt(r)}</div>
                <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, color: BRAND.ink }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: BRAND.muted }}>{r.day_type === 'reduced' ? `Atende até ${String(r.reduced_end || '').slice(0, 5)}` : 'Escola fechada'}{r.repeat_yearly ? ' · todo ano' : ' · só neste ano'}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: BRAND.primaryDark, background: BRAND.soft, borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap' }}>{MODES.find(m => m.id === r.mode)?.short}</span>
                <Switch on={r.active} onChange={v => toggle(r, v)} labelText={`Ativar ${r.name}`} />
                <button type="button" onClick={() => setForm({ ...r, reduced_end: r.reduced_end ? String(r.reduced_end).slice(0, 5) : '12:00' })}
                  style={{ border: 'none', background: 'transparent', color: BRAND.primaryDark, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'inline-flex', gap: 5, alignItems: 'center', fontFamily: 'inherit' }}><Pencil size={13} /> Editar</button>
              </div>
            ))}
        </div>

        {form && (
          <div ref={formRef} style={{ display: 'flex', flexDirection: 'column', gap: 16, scrollMarginTop: 70 }}>
            <Card>
              <Title Icon={Pencil} title={form.id ? `Editando: ${form.name || 'data'}` : 'Nova data'} help="Escolha o dia, como o sistema se comporta e o que o cliente recebe." />
              <label style={label}>Nome</label>
              <input style={input} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex.: Dia do Professor" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 12 }}>
                <div><label style={label}>{form.date_end !== null ? 'De' : 'Data'}</label><input type="date" style={input} value={form.date_start} onChange={e => set('date_start', e.target.value)} /></div>
                {form.date_end !== null && <div><label style={label}>Até</label><input type="date" style={input} value={form.date_end || ''} onChange={e => set('date_end', e.target.value || null)} /></div>}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                <Chip active={form.date_end === null} onClick={() => set('date_end', null)}>Um dia só</Chip>
                <Chip active={form.date_end !== null} onClick={() => set('date_end', form.date_end ?? form.date_start)}>Período (vários dias)</Chip>
                <Chip active={form.repeat_yearly} onClick={() => set('repeat_yearly', true)}>Repete todo ano</Chip>
                <Chip active={!form.repeat_yearly} onClick={() => set('repeat_yearly', false)}>Só neste ano</Chip>
              </div>
              <label style={{ ...label, marginTop: 14 }}>Como a escola fica nesse dia</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <Chip active={form.day_type === 'closed'} onClick={() => set('day_type', 'closed')}>Escola fechada</Chip>
                <Chip active={form.day_type === 'reduced'} onClick={() => set('day_type', 'reduced')}>Horário reduzido</Chip>
                {form.day_type === 'reduced' && <><span style={{ fontSize: 13, color: BRAND.muted }}>atende até</span><input type="time" style={{ ...input, width: 120 }} value={form.reduced_end || '12:00'} onChange={e => set('reduced_end', e.target.value)} /></>}
              </div>
              <label style={{ ...label, marginTop: 14 }}>Como o sistema se comporta</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {MODES.map(m => <Chip key={m.id} active={form.mode === m.id} onClick={() => set('mode', m.id)}>{m.label}</Chip>)}
              </div>
              <label style={{ ...label, marginTop: 14 }}>Mensagem</label>
              <textarea style={{ ...input, minHeight: 84, resize: 'vertical' }} value={form.message} onChange={e => set('message', e.target.value)} />
              <p style={hint}>{'{horario}'} vira o horário de atendimento da escola automaticamente.</p>
            </Card>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <SaveButton text="Salvar data" saving={saving} onClick={save} />
              <GhostButton onClick={() => setForm(null)}>Cancelar</GhostButton>
              {form.id && <GhostButton danger onClick={() => remove(form.id!)}><Trash2 size={13} /> Excluir</GhostButton>}
            </div>
          </div>
        )}
      </div>

      <aside style={{ flex: '0 1 340px', minWidth: 250, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {form && (
          <div style={{ background: '#E7F0E8', borderRadius: 18, padding: 16, border: `1px solid ${BRAND.line}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: '#3F5F46', marginBottom: 10 }}><Smartphone size={14} /> Como o cliente vê</div>
            <div style={bub(false)}>Oi, queria saber sobre matrícula</div>
            <div style={bub(true)}>{prevMsg}</div>
          </div>
        )}
        <div style={{ background: BRAND.softer, border: `1px solid ${BRAND.softLine}`, borderRadius: 14, padding: '12px 14px', fontSize: 13, color: '#334155', lineHeight: 1.55 }}>
          <b>Qual escolher?</b><br />
          • <b>Avisar e deixar o robô atender:</b> manda o aviso e o robô segue normal. Se o robô passar para a equipe, a conversa vai para a fila do próximo dia útil.<br />
          • <b>Só a mensagem:</b> manda o aviso e a conversa fica na fila para o próximo dia útil. O robô não atende.<br />
          • <b>Avisar depois do robô:</b> o robô atende e o aviso vai no lugar da mensagem de “fora do horário”, quando ele passa para a equipe.<br />
          O aviso sai uma vez por dia por cliente. A conversa vai para o mesmo destino de “fora do horário”.
        </div>
      </aside>
    </div>
  )
}
