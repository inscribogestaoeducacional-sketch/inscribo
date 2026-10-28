// Nova proposta (Super Admin · CRM). Tudo é preenchido por proposta: não há preço escondido.
// Gera o PDF no navegador, guarda no storage, registra no lead e, se tiver e-mail, envia com o PDF.
import { useMemo, useState } from 'react'
import { X, FileText, Mail, AlertCircle, CheckCircle2, Minus, Plus, Gift } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useIsMobile } from '../mobile/MobileShell'
import { BRAND } from '../../lib/brand'
import type { Lead } from '../shared/LeadModal'

const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', height: 44, padding: '0 12px', border: `1.5px solid ${BRAND.line}`, borderRadius: 12, fontSize: 16, color: BRAND.ink, background: '#fff', outline: 'none', fontFamily: 'inherit' }
const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: BRAND.muted, marginBottom: 5 }
const hint: React.CSSProperties = { margin: '4px 0 0', fontSize: 12, color: BRAND.muted }
const section: React.CSSProperties = { border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 14, background: '#fff', display: 'flex', flexDirection: 'column', gap: 12 }
const sectionTitle: React.CSSProperties = { margin: 0, fontSize: 14, fontWeight: 800, color: BRAND.ink }

const num = (v: string) => { const n = parseFloat(String(v).replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : NaN }
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const today = () => new Date().toISOString().slice(0, 10)
const addDays = (d: string, n: number) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10) }
const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim())

function Money({ value, onChange, placeholder, disabled }: { value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean }) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 12, top: 0, height: 44, display: 'flex', alignItems: 'center', color: BRAND.muted, fontSize: 14, fontWeight: 700 }}>R$</span>
      <input style={{ ...input, paddingLeft: 38, background: disabled ? '#F8FAFC' : '#fff' }} inputMode="decimal" value={value} disabled={disabled} placeholder={placeholder}
        onChange={e => onChange(e.target.value.replace(/[^\d.,]/g, ''))} />
    </div>
  )
}

function Stepper({ value, onChange, min = 1, max = 99 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  const b: React.CSSProperties = { width: 44, height: 44, borderRadius: 12, border: `1.5px solid ${BRAND.line}`, background: '#fff', color: BRAND.primaryDark, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button type="button" aria-label="Diminuir" style={b} onClick={() => onChange(Math.max(min, value - 1))}><Minus size={16} /></button>
      <div style={{ flex: 1, minWidth: 44, textAlign: 'center', fontSize: 20, fontWeight: 800, color: BRAND.ink }}>{value}</div>
      <button type="button" aria-label="Aumentar" style={b} onClick={() => onChange(Math.min(max, value + 1))}><Plus size={16} /></button>
    </div>
  )
}

export default function ProposalForm({ lead, onClose, onDone, onGenerated }: { lead: Lead; onClose: () => void; onDone: (msg?: string) => void; onGenerated?: (pdfUrl: string) => void }) {
  const mobile = useIsMobile()
  const { user } = useAuth()
  const [f, setF] = useState({
    client_name: lead.name || '', school_name: lead.school_name || '', client_email: lead.email || '',
    impl_normal: '', impl_special: '', impl_courtesy: false,
    month_normal: '', month_special: '',
    validity: 'days' as 'days' | 'date', validity_days: '7', deadline: '',
    units: 1, numbers: 1,
    xu_month: '', xu_impl: '', xn_month: '', xn_impl: '',
    payment_terms: '', notes: '',
    consultant_name: (user as any)?.full_name || '', consultant_phone: (user as any)?.phone || '', consultant_email: user?.email || '',
  })
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(p => ({ ...p, [k]: v }))
  const hasExtras = f.units > 1 || f.numbers > 1
  const canEmail = emailOk(f.client_email)

  const calc = useMemo(() => {
    const implN = num(f.impl_normal); const monN = num(f.month_normal)
    const implS = f.impl_courtesy ? 0 : (f.impl_special.trim() === '' ? implN : num(f.impl_special))
    const monS = f.month_special.trim() === '' ? monN : num(f.month_special)
    const xu = num(f.xu_month) || 0; const xn = num(f.xn_month) || 0
    const monthlyTotal = monS + (f.units - 1) * xu + (f.numbers - 1) * xn
    const xui = num(f.xu_impl) || 0; const xni = num(f.xn_impl) || 0
    const implTotal = implS + (f.units - 1) * xui + (f.numbers - 1) * xni
    return { implN, monN, implS, monS, monthlyTotal, implTotal }
  }, [f])

  const problem = (): string => {
    if (!f.client_name.trim()) return 'Escreva o nome de quem vai receber a proposta.'
    if (!f.school_name.trim()) return 'Escreva o nome da escola.'
    if (f.client_email.trim() && !canEmail) return 'O e-mail do cliente parece incompleto.'
    if (!(calc.implN >= 0)) return 'Informe a implantação de tabela (pode ser 0).'
    if (!(calc.monN > 0)) return 'Informe a mensalidade de tabela.'
    if (!(calc.implS >= 0)) return 'A implantação para este cliente está inválida.'
    if (!(calc.monS > 0)) return 'A mensalidade para este cliente está inválida.'
    if (f.validity === 'date' && (!f.deadline || f.deadline < today())) return 'Escolha uma data limite que ainda não passou.'
    if (f.validity === 'days' && !(parseInt(f.validity_days) > 0)) return 'Informe por quantos dias a proposta vale.'
    if (hasExtras) {
      if (f.units > 1 && (isNaN(num(f.xu_month)) || isNaN(num(f.xu_impl)))) return 'Informe o valor de cada unidade adicional (mensalidade e implantação; pode ser 0).'
      if (f.numbers > 1 && (isNaN(num(f.xn_month)) || isNaN(num(f.xn_impl)))) return 'Informe o valor de cada número de WhatsApp adicional (mensalidade e implantação; pode ser 0).'
    }
    return ''
  }

  const submit = async (send: boolean) => {
    const p = problem(); if (p) { setError(p); return }
    setError(''); setBusy('Salvando a proposta...')
    let id: string | null = null
    try {
      const row: Record<string, any> = {
        lead_id: lead.id, consultant_id: user?.id ?? null, status: 'draft',
        client_name: f.client_name.trim(), school_name: f.school_name.trim(), client_email: f.client_email.trim() || null, client_phone: lead.phone || null,
        implementation_normal: calc.implN, implementation_special: calc.implS, monthly_normal: calc.monN, monthly_special: calc.monS,
        special_deadline: f.validity === 'date' ? f.deadline : null,
        validity_days: f.validity === 'days' ? parseInt(f.validity_days) : Math.max(1, Math.round((new Date(f.deadline).getTime() - Date.now()) / 86400000)),
        proposal_date: today(), units: f.units, whatsapp_numbers: f.numbers,
        extra_unit_monthly: f.units > 1 ? num(f.xu_month) : null, extra_unit_impl: f.units > 1 ? num(f.xu_impl) : null,
        extra_number_monthly: f.numbers > 1 ? num(f.xn_month) : null, extra_number_impl: f.numbers > 1 ? num(f.xn_impl) : null,
        payment_terms: f.payment_terms.trim() || null, notes: f.notes.trim() || null,
        consultant_name: f.consultant_name.trim() || null, consultant_phone: f.consultant_phone.trim() || null, consultant_email: f.consultant_email.trim() || null,
      }
      const ins = await supabase.from('proposals').insert(row).select('id, created_at').single()
      if (ins.error || !ins.data) throw new Error(ins.error?.message || 'Não foi possível salvar')
      id = ins.data.id

      setBusy('Montando o PDF...')
      const [{ pdf }, { default: ProposalPdfV2 }, React] = await Promise.all([import('@react-pdf/renderer'), import('../../lib/proposalPdfV2'), import('react')])
      const blob = await pdf(React.createElement(ProposalPdfV2 as any, { data: { ...row, created_at: ins.data.created_at } }) as any).toBlob()

      setBusy('Guardando o PDF...')
      const safe = f.school_name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'escola'
      const path = `${id}/Proposta-Aion-Edu-${safe}.pdf`
      const up = await supabase.storage.from('proposals').upload(path, blob, { contentType: 'application/pdf', upsert: true })
      if (up.error) throw new Error(`O PDF foi gerado, mas não foi guardado: ${up.error.message}`)
      const pdf_url = supabase.storage.from('proposals').getPublicUrl(path).data.publicUrl
      await supabase.from('proposals').update({ pdf_url }).eq('id', id)
      await supabase.from('crm_leads').update({ has_proposal: true, last_proposal_id: id, monthly_value: calc.monthlyTotal, implementation_value: calc.implTotal }).eq('id', lead.id)

      let msg = 'Proposta criada. O PDF está na aba Propostas do lead.'
      if (send && canEmail) {
        setBusy('Enviando por e-mail...')
        const until = f.validity === 'date' ? fmtDate(f.deadline) : fmtDate(addDays(today(), parseInt(f.validity_days)))
        const r = await supabase.functions.invoke('send-email', {
          body: { type: 'proposal', to: f.client_email.trim(), data: { proposal_id: id, client_name: f.client_name.trim(), school_name: f.school_name.trim(), pdf_url, valid_until: until, consultant_name: f.consultant_name, consultant_phone: f.consultant_phone } },
        })
        if (r.error || (r.data as any)?.error) {
          const why = r.error?.message || (r.data as any)?.error
          await supabase.from('proposals').update({ email_error: String(why).slice(0, 300) }).eq('id', id)
          msg = `Proposta criada, mas o e-mail não saiu (${why}). Você pode abrir o PDF e mandar pelo WhatsApp.`
        } else {
          const now = new Date().toISOString()
          await supabase.from('proposals').update({ status: 'sent', sent_at: now, email_sent_at: now, email_error: null }).eq('id', id)
          msg = `Proposta enviada para ${f.client_email.trim()} com o PDF anexado.`
        }
      }
      setBusy(null)
      onDone(msg)
      onGenerated?.(pdf_url)
    } catch (e: any) {
      setBusy(null)
      setError(e?.message || 'Algo deu errado')
      if (id) { onDone(`A proposta foi salva, mas houve um erro: ${e?.message || ''}`) }
    }
  }

  const two = { display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 12 } as const

  return (
    <div onClick={busy ? undefined : onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 300, display: 'flex', alignItems: mobile ? 'stretch' : 'center', justifyContent: 'center', padding: mobile ? 0 : 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: mobile ? '100%' : 'min(680px,100%)', maxHeight: mobile ? '100dvh' : '94vh', height: mobile ? '100dvh' : 'auto', background: BRAND.bg, borderRadius: mobile ? 0 : 22, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 30px 60px -20px rgba(15,23,42,.5)' }}>
        <div style={{ background: 'var(--aion-grad)', color: '#fff', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileText size={20} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff' }}>Nova proposta</h3>
            <p style={{ margin: '2px 0 0', fontSize: 13, opacity: 0.9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.school_name}</p>
          </div>
          <button type="button" aria-label="Fechar" disabled={!!busy} onClick={onClose} style={{ width: 38, height: 38, borderRadius: 12, border: 'none', background: 'rgba(255,255,255,.18)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div role="alert" style={{ display: 'flex', gap: 8, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 12, padding: 12, fontSize: 13 }}><AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />{error}</div>}

          <div style={section}>
            <h4 style={sectionTitle}>Para quem é</h4>
            <div style={two}>
              <div><label style={label}>Nome do contato *</label><input style={input} value={f.client_name} onChange={e => set('client_name', e.target.value)} /></div>
              <div><label style={label}>Escola *</label><input style={input} value={f.school_name} onChange={e => set('school_name', e.target.value)} /></div>
            </div>
            <div>
              <label style={label}>E-mail do cliente</label>
              <input style={input} type="email" inputMode="email" value={f.client_email} onChange={e => set('client_email', e.target.value)} placeholder="diretor@escola.com.br" />
              <p style={hint}>{canEmail ? 'Com e-mail preenchido, o PDF pode ser enviado na hora.' : 'Sem e-mail, só o PDF é gerado e você manda como quiser.'}</p>
            </div>
          </div>

          <div style={section}>
            <h4 style={sectionTitle}>Implantação</h4>
            <div style={two}>
              <div><label style={label}>Valor de tabela *</label><Money value={f.impl_normal} onChange={v => set('impl_normal', v)} placeholder="0,00" /></div>
              <div><label style={label}>Valor para este cliente</label><Money value={f.impl_special} disabled={f.impl_courtesy} onChange={v => set('impl_special', v)} placeholder={f.impl_courtesy ? 'Cortesia' : 'igual à tabela'} /></div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, fontWeight: 700, color: BRAND.ink }}>
              <input type="checkbox" checked={f.impl_courtesy} onChange={e => set('impl_courtesy', e.target.checked)} style={{ width: 18, height: 18, accentColor: BRAND.primary }} />
              <Gift size={15} color={BRAND.primary} />Implantação como cortesia (sem cobrança)
            </label>
          </div>

          <div style={section}>
            <h4 style={sectionTitle}>Mensalidade</h4>
            <div style={two}>
              <div><label style={label}>Valor de tabela *</label><Money value={f.month_normal} onChange={v => set('month_normal', v)} placeholder="0,00" /></div>
              <div><label style={label}>Valor para este cliente</label><Money value={f.month_special} onChange={v => set('month_special', v)} placeholder="igual à tabela" /></div>
            </div>
            <p style={hint}>Se o valor para este cliente for menor, a proposta mostra o de tabela riscado.</p>
          </div>

          <div style={section}>
            <h4 style={sectionTitle}>Quanto tempo a proposta vale</h4>
            <div style={{ display: 'flex', gap: 8 }}>
              {([['days', 'Por alguns dias'], ['date', 'Até uma data']] as const).map(([v, l]) => (
                <button key={v} type="button" onClick={() => set('validity', v)} style={{ flex: 1, minHeight: 44, borderRadius: 12, fontFamily: 'inherit', fontSize: 13, fontWeight: 800, cursor: 'pointer', border: `2px solid ${f.validity === v ? BRAND.primary : BRAND.line}`, background: f.validity === v ? BRAND.softer : '#fff', color: f.validity === v ? BRAND.primaryDark : BRAND.muted }}>{l}</button>
              ))}
            </div>
            {f.validity === 'days'
              ? <div><label style={label}>Dias de validade, contados de hoje</label><input style={input} inputMode="numeric" value={f.validity_days} onChange={e => set('validity_days', e.target.value.replace(/\D/g, ''))} />
                {parseInt(f.validity_days) > 0 && <p style={hint}>Vale até {fmtDate(addDays(today(), parseInt(f.validity_days)))}.</p>}</div>
              : <div><label style={label}>Data limite</label><input style={input} type="date" min={today()} value={f.deadline} onChange={e => set('deadline', e.target.value)} /></div>}
          </div>

          <div style={section}>
            <h4 style={sectionTitle}>Unidades e números de WhatsApp</h4>
            <div style={two}>
              <div><label style={label}>Unidades da escola</label><Stepper value={f.units} onChange={n => set('units', n)} /></div>
              <div><label style={label}>Números de WhatsApp</label><Stepper value={f.numbers} onChange={n => set('numbers', n)} /></div>
            </div>
            {!hasExtras && <p style={hint}>Com mais de uma unidade ou de um número, aparecem aqui os valores adicionais.</p>}
            {f.units > 1 && (
              <div style={{ background: BRAND.softer, border: `1px solid ${BRAND.softLine}`, borderRadius: 14, padding: 12 }}>
                <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 800, color: BRAND.primaryDark }}>Cada unidade adicional ({f.units - 1}x)</p>
                <div style={two}>
                  <div><label style={label}>Mensalidade *</label><Money value={f.xu_month} onChange={v => set('xu_month', v)} placeholder="0,00" /></div>
                  <div><label style={label}>Implantação *</label><Money value={f.xu_impl} onChange={v => set('xu_impl', v)} placeholder="0,00" /></div>
                </div>
              </div>
            )}
            {f.numbers > 1 && (
              <div style={{ background: BRAND.softer, border: `1px solid ${BRAND.softLine}`, borderRadius: 14, padding: 12 }}>
                <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 800, color: BRAND.primaryDark }}>Cada número de WhatsApp adicional ({f.numbers - 1}x)</p>
                <div style={two}>
                  <div><label style={label}>Mensalidade *</label><Money value={f.xn_month} onChange={v => set('xn_month', v)} placeholder="0,00" /></div>
                  <div><label style={label}>Implantação *</label><Money value={f.xn_impl} onChange={v => set('xn_impl', v)} placeholder="0,00" /></div>
                </div>
              </div>
            )}
          </div>

          <div style={section}>
            <h4 style={sectionTitle}>Condições e recado (opcional)</h4>
            <div><label style={label}>Forma de pagamento</label><textarea rows={2} style={{ ...input, height: 'auto', padding: 10, resize: 'vertical' }} value={f.payment_terms} onChange={e => set('payment_terms', e.target.value)} placeholder="Só escreva se quiser que apareça na proposta" /></div>
            <div><label style={label}>Observação para o cliente</label><textarea rows={2} style={{ ...input, height: 'auto', padding: 10, resize: 'vertical' }} value={f.notes} onChange={e => set('notes', e.target.value)} /></div>
          </div>

          <div style={section}>
            <h4 style={sectionTitle}>Quem assina a proposta</h4>
            <div style={two}>
              <div><label style={label}>Nome</label><input style={input} value={f.consultant_name} onChange={e => set('consultant_name', e.target.value)} /></div>
              <div><label style={label}>WhatsApp</label><input style={input} inputMode="tel" value={f.consultant_phone} onChange={e => set('consultant_phone', e.target.value)} /></div>
            </div>
            <div><label style={label}>E-mail</label><input style={input} type="email" value={f.consultant_email} onChange={e => set('consultant_email', e.target.value)} /></div>
          </div>

          {Number.isFinite(calc.monS) && calc.monS > 0 && (
            <div style={{ background: '#fff', border: `2px solid ${BRAND.softLine}`, borderRadius: 16, padding: 14 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: BRAND.muted }}>Como vai aparecer no total</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
                <div><div style={{ fontSize: 12, color: BRAND.muted }}>Implantação (uma vez)</div><div style={{ fontSize: 20, fontWeight: 800, color: BRAND.ink }}>{Number.isFinite(calc.implTotal) ? (calc.implTotal === 0 ? 'Cortesia' : brl(calc.implTotal)) : '—'}</div></div>
                <div><div style={{ fontSize: 12, color: BRAND.muted }}>Mensalidade</div><div style={{ fontSize: 20, fontWeight: 800, color: BRAND.primaryDark }}>{Number.isFinite(calc.monthlyTotal) ? brl(calc.monthlyTotal) : '—'}</div></div>
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '12px 16px', borderTop: `1px solid ${BRAND.line}`, background: '#fff', flexShrink: 0, paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          {busy && <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: BRAND.primaryDark }}>{busy}</p>}
          <div style={{ display: 'flex', gap: 8, flexDirection: mobile ? 'column-reverse' : 'row' }}>
            <button type="button" onClick={onClose} disabled={!!busy} style={{ minHeight: 44, padding: '0 18px', borderRadius: 12, border: `1px solid ${BRAND.line}`, background: '#fff', color: BRAND.ink, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
            <button type="button" onClick={() => submit(false)} disabled={!!busy} style={{ minHeight: 44, padding: '0 18px', borderRadius: 12, border: `1.5px solid ${BRAND.primary}`, background: '#fff', color: BRAND.primaryDark, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: busy ? 0.6 : 1 }}><FileText size={16} />Só gerar o PDF</button>
            <button type="button" onClick={() => submit(true)} disabled={!!busy || !canEmail} style={{ flex: 1, minHeight: 44, borderRadius: 12, border: 'none', background: 'var(--aion-grad)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: canEmail ? 'pointer' : 'not-allowed', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: busy || !canEmail ? 0.5 : 1 }}>
              {canEmail ? <Mail size={16} /> : <CheckCircle2 size={16} />}{canEmail ? 'Gerar e enviar por e-mail' : 'Preencha o e-mail para enviar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
