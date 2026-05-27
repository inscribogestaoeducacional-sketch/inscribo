import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
  X, Save, Download, Send, MessageCircle,
  CheckCircle2, AlertCircle, Loader2, ExternalLink, Copy,
} from 'lucide-react'
import { pdf } from '@react-pdf/renderer'
import ProposalContent, { ProposalData, PW } from './ProposalContent'
import ProposalPdfDocument from '../../lib/proposalPdf'

export interface ProposalGeneratorProps {
  lead: {
    id: string
    name: string
    school_name?: string
    school?: string
    email?: string
    phone?: string
  }
  consultant?: {
    name?: string
    full_name?: string
    email?: string
    phone?: string
  }
  onClose: () => void
  onSave?: (proposal: any) => void
}

interface ProposalForm extends ProposalData {
  client_email: string
  client_phone: string
}

const fmtBRL = (v: number) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ─── Dark panel styles ────────────────────────────────────────────────────────
const DARK = '#001a12'
const DARK_BORDER = '#0a3d28'
const DARK_TEXT = '#d0ede5'
const DARK_MUTED = 'rgba(208,237,229,0.5)'
const DARK_INPUT = '#002918'

const darkInp: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  fontSize: 13,
  background: DARK_INPUT,
  border: `1px solid ${DARK_BORDER}`,
  borderRadius: 8,
  color: DARK_TEXT,
  outline: 'none',
  boxSizing: 'border-box',
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ProposalGenerator({ lead, consultant, onClose, onSave }: ProposalGeneratorProps) {
  const { user } = useAuth()
  const today = new Date().toISOString().slice(0, 10)
  const defaultDeadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [form, setForm] = useState<ProposalForm>({
    client_name:             lead.name || '',
    school_name:             lead.school_name || lead.school || '',
    client_email:            lead.email || '',
    client_phone:            lead.phone || '',
    proposal_date:           today,
    implementation_normal:   1000,
    implementation_special:  0,
    monthly_normal:          828,
    monthly_special:         690,
    special_deadline:        defaultDeadline,
    validity_days:           7,
    consultant_name:         consultant?.full_name || consultant?.name || (user as any)?.full_name || '',
    consultant_phone:        consultant?.phone || '',
    consultant_email:        consultant?.email || user?.email || '',
    consultant_site:         'aionedu.com.br',
  })

  const [savedId, setSavedId]             = useState<string | null>(null)
  const [viewToken, setViewToken]         = useState<string | null>(null)
  const [saving, setSaving]               = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [sendingEmail, setSendingEmail]   = useState(false)
  const [toast, setToast]                 = useState<{ msg: string; ok: boolean } | null>(null)
  const [pdfUrl, setPdfUrl]               = useState<string | null>(null)
  const [activeTab, setActiveTab]         = useState<'client' | 'values' | 'consultant'>('client')

  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(t)
  }, [toast])

  const set = (k: keyof ProposalForm, v: any) => setForm(f => ({ ...f, [k]: v }))
  const showToast = (msg: string, ok = true) => setToast({ msg, ok })

  // ── Supabase save ──────────────────────────────────────────────────────────
  const saveProposal = async (): Promise<string | null> => {
    const payload = {
      client_name:            form.client_name,
      school_name:            form.school_name,
      client_email:           form.client_email,
      client_phone:           form.client_phone,
      implementation_normal:  form.implementation_normal,
      implementation_special: form.implementation_special,
      monthly_normal:         form.monthly_normal,
      monthly_special:        form.monthly_special,
      special_deadline:       form.special_deadline || null,
      validity_days:          form.validity_days,
      consultant_name:        form.consultant_name,
      consultant_phone:       form.consultant_phone,
      consultant_email:       form.consultant_email,
    }

    if (savedId) {
      await supabase.from('proposals').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', savedId)
      return savedId
    }

    const { data, error } = await supabase
      .from('proposals')
      .insert({ ...payload, lead_id: lead.id, status: 'draft' })
      .select('id, view_token')
      .single()

    if (error) throw error
    setSavedId(data.id)
    setViewToken(data.view_token)
    await supabase.from('crm_leads').update({ has_proposal: true, last_proposal_id: data.id }).eq('id', lead.id)
    return data.id
  }

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    setSaving(true)
    try {
      await saveProposal()
      showToast('Rascunho salvo!')
      onSave?.(form)
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar.', false)
    } finally { setSaving(false) }
  }

  const handleGeneratePdf = async () => {
    setGeneratingPdf(true)
    try {
      const id = await saveProposal()
      if (!id) throw new Error('Falha ao salvar proposta')

      const blob = await pdf(<ProposalPdfDocument data={form} />).toBlob()

      const safeName = form.school_name.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || id
      const dateStr  = new Date().toISOString().slice(0, 10)
      const fileName = `${id}/${safeName}_${dateStr}.pdf`

      const { data: buckets } = await supabase.storage.listBuckets()
      const bucketExists = buckets?.some(b => b.name === 'proposals')
      if (!bucketExists) {
        await supabase.storage.createBucket('proposals', { public: true })
      }

      const { error: upErr } = await supabase.storage
        .from('proposals')
        .upload(fileName, blob, { contentType: 'application/pdf', upsert: true })

      if (upErr) {
        console.warn('Storage upload falhou:', upErr.message)
      } else {
        const { data: { publicUrl } } = supabase.storage.from('proposals').getPublicUrl(fileName)
        setPdfUrl(publicUrl)
        await supabase.from('proposals').update({ pdf_url: publicUrl }).eq('id', id)
      }

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `proposta-${safeName}-${dateStr}.pdf`
      a.click()
      URL.revokeObjectURL(url)

      showToast('PDF gerado com sucesso!')
    } catch (e: any) {
      showToast(e?.message || 'Erro ao gerar PDF.', false)
    } finally { setGeneratingPdf(false) }
  }

  const handleSendEmail = async () => {
    if (!form.client_email) { showToast('Email do cliente é obrigatório.', false); return }
    setSendingEmail(true)
    try {
      let id = savedId
      if (!id) id = await saveProposal()
      if (!id) throw new Error('Falha ao salvar')

      const tkn = viewToken
        || (await supabase.from('proposals').select('view_token').eq('id', id).single()).data?.view_token
      const proposalUrl = `${window.location.origin}/proposta/${tkn}`

      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'proposal',
          to: form.client_email,
          data: {
            client_name:            form.client_name,
            school_name:            form.school_name,
            consultant_name:        form.consultant_name,
            implementation_special: form.implementation_special === 0 ? 'GRÁTIS' : fmtBRL(form.implementation_special),
            monthly_special:        fmtBRL(form.monthly_special),
            validity_days:          form.validity_days,
            special_deadline:       form.special_deadline
              ? new Date(form.special_deadline + 'T12:00:00').toLocaleDateString('pt-BR')
              : null,
            proposal_url: proposalUrl,
            pdf_url:      pdfUrl,
            proposal_id:  id,
          },
        },
      })
      if (error) throw error

      await supabase.from('proposals').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', id)
      showToast(`Proposta enviada para ${form.client_email}!`)
    } catch (e: any) {
      showToast(e?.message || 'Erro ao enviar email.', false)
    } finally { setSendingEmail(false) }
  }

  const handleWhatsApp = async () => {
    let token = viewToken
    if (!token && savedId) {
      const { data } = await supabase.from('proposals').select('view_token').eq('id', savedId).single()
      token = data?.view_token
    }
    if (!token) {
      try { await saveProposal() } catch { /* ignore */ }
      const { data } = await supabase
        .from('proposals')
        .select('view_token')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      token = data?.view_token
    }
    const proposalUrl = token ? `${window.location.origin}/proposta/${token}` : window.location.origin
    const phone = form.client_phone.replace(/\D/g, '')
    const msg = encodeURIComponent(
      `Olá ${form.client_name}! 👋\n\nSegue a proposta comercial da Áion Edu para ${form.school_name}.\n\n📄 Ver proposta: ${proposalUrl}\n\nQualquer dúvida estou à disposição!\n\n${form.consultant_name}`
    )
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
  }

  const copyProposalLink = async () => {
    let token = viewToken
    if (!token && savedId) {
      const { data } = await supabase.from('proposals').select('view_token').eq('id', savedId).single()
      token = data?.view_token
    }
    if (token) {
      await navigator.clipboard.writeText(`${window.location.origin}/proposta/${token}`)
      showToast('Link copiado!')
    } else {
      showToast('Salve o rascunho primeiro.', false)
    }
  }

  const tabs = [
    { id: 'client' as const,     label: 'Cliente' },
    { id: 'values' as const,     label: 'Investimento' },
    { id: 'consultant' as const, label: 'Consultor' },
  ]

  // ── Dark input helper ──────────────────────────────────────────────────────
  const DInput = ({
    label, type = 'text', value, onChange, hint,
  }: {
    label: string
    type?: string
    value: string | number
    onChange: (v: string) => void
    hint?: string
  }) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: DARK_MUTED, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={darkInp}
        onFocus={e => { e.currentTarget.style.borderColor = '#00A896' }}
        onBlur={e => { e.currentTarget.style.borderColor = DARK_BORDER }}
      />
      {hint && <p style={{ fontSize: 11, color: '#00A896', margin: '4px 0 0' }}>{hint}</p>}
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-3">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[200] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold
          ${toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <div
        style={{ background: DARK, border: `1px solid ${DARK_BORDER}`, borderRadius: 20, overflow: 'hidden' }}
        className="w-full max-w-[1380px] h-[94vh] flex flex-col shadow-2xl"
      >
        {/* ── Header ── */}
        <div style={{ background: DARK, borderBottom: `1px solid ${DARK_BORDER}`, padding: '14px 20px' }} className="flex items-center justify-between flex-shrink-0">
          <div>
            <h2 style={{ color: DARK_TEXT, fontSize: 16, fontWeight: 700, margin: 0 }}>Gerador de Proposta</h2>
            <p style={{ color: DARK_MUTED, fontSize: 12, margin: '2px 0 0' }}>{form.school_name || 'Nova proposta'}</p>
          </div>
          <div className="flex items-center gap-2">
            {savedId && (
              <button onClick={copyProposalLink}
                style={{ background: 'transparent', border: `1px solid ${DARK_BORDER}`, color: DARK_MUTED, borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Copy className="w-3.5 h-3.5" /> Copiar link
              </button>
            )}
            {pdfUrl && (
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
                style={{ background: 'transparent', border: `1px solid ${DARK_BORDER}`, color: DARK_MUTED, borderRadius: 8, padding: '6px 12px', fontSize: 12, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ExternalLink className="w-3.5 h-3.5" /> Ver PDF
              </a>
            )}
            <button onClick={onClose}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: DARK_MUTED }}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-1 min-h-0">
          {/* Left — Editor */}
          <div style={{ width: 300, flexShrink: 0, background: DARK, borderRight: `1px solid ${DARK_BORDER}`, display: 'flex', flexDirection: 'column' }}>
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${DARK_BORDER}` }}>
              {tabs.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  style={{
                    flex: 1, padding: '10px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: 'transparent', border: 'none',
                    borderBottom: activeTab === t.id ? '2px solid #00A896' : '2px solid transparent',
                    color: activeTab === t.id ? '#00A896' : DARK_MUTED,
                    transition: 'color 0.15s',
                  }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Fields */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 16px' }}>
              {activeTab === 'client' && (
                <>
                  <DInput label="Nome do gestor / responsável" value={form.client_name}  onChange={v => set('client_name', v)} />
                  <DInput label="Nome da escola"               value={form.school_name}  onChange={v => set('school_name', v)} />
                  <DInput label="Telefone"                     value={form.client_phone} onChange={v => set('client_phone', v)} />
                  <DInput label="Email"               type="email" value={form.client_email} onChange={v => set('client_email', v)} />
                  <DInput label="Data da proposta"    type="date"  value={form.proposal_date || ''} onChange={v => set('proposal_date', v)} />
                </>
              )}

              {activeTab === 'values' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 0 }}>
                    <DInput label="Implantação normal (R$)"   type="number" value={form.implementation_normal}   onChange={v => set('implementation_normal', +v)} />
                    <DInput
                      label="Implantação especial (R$)"
                      type="number"
                      value={form.implementation_special}
                      onChange={v => set('implementation_special', +v)}
                      hint={form.implementation_special === 0 ? '🎁 Exibirá GRÁTIS' : undefined}
                    />
                    <DInput label="Mensalidade normal (R$)"   type="number" value={form.monthly_normal}   onChange={v => set('monthly_normal', +v)} />
                    <DInput label="Mensalidade especial (R$)" type="number" value={form.monthly_special}  onChange={v => set('monthly_special', +v)} />
                  </div>
                  <DInput label="Prazo condição especial" type="date"   value={form.special_deadline || ''} onChange={v => set('special_deadline', v)} />
                  <DInput label="Validade (dias)"         type="number" value={form.validity_days}        onChange={v => set('validity_days', +v)} />
                </>
              )}

              {activeTab === 'consultant' && (
                <>
                  <DInput label="Nome"              value={form.consultant_name || ''}  onChange={v => set('consultant_name', v)} />
                  <DInput label="Telefone"          value={form.consultant_phone || ''} onChange={v => set('consultant_phone', v)} />
                  <DInput label="Email"  type="email" value={form.consultant_email || ''} onChange={v => set('consultant_email', v)} />
                  <DInput label="Site"              value={form.consultant_site || ''}  onChange={v => set('consultant_site', v)} />
                </>
              )}
            </div>

            {/* Actions */}
            <div style={{ padding: '14px 16px', borderTop: `1px solid ${DARK_BORDER}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={handleSaveDraft} disabled={saving}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 0', background: 'transparent', border: `1px solid ${DARK_BORDER}`, borderRadius: 10, color: DARK_TEXT, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Salvando…' : 'Salvar rascunho'}
              </button>

              <button onClick={handleGeneratePdf} disabled={generatingPdf}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 0', background: '#0a3d28', border: `1px solid ${DARK_BORDER}`, borderRadius: 10, color: '#00A896', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: generatingPdf ? 0.6 : 1 }}>
                {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {generatingPdf ? 'Gerando PDF…' : 'Gerar PDF'}
              </button>

              <button onClick={handleSendEmail} disabled={sendingEmail || !form.client_email}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 0', background: 'linear-gradient(135deg,#00523C,#00A896)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (sendingEmail || !form.client_email) ? 0.6 : 1 }}>
                {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sendingEmail ? 'Enviando…' : 'Enviar por Email'}
              </button>

              <button onClick={handleWhatsApp}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 0', background: '#25D366', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </button>
            </div>
          </div>

          {/* Right — Preview */}
          <div style={{ flex: 1, overflowY: 'auto', background: '#0a1f16' }}>
            {/* Preview bar */}
            <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#0a3d28', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${DARK_BORDER}` }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00A896' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(208,237,229,0.7)' }}>Preview ao vivo — A4 landscape (7 páginas)</span>
            </div>

            {/* Pages */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div
                ref={previewRef}
                style={{
                  width: PW,
                  boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
                  borderRadius: 4,
                  overflow: 'hidden',
                }}
              >
                <ProposalContent data={form} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
