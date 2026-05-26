import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
  X, Save, Download, Send, MessageCircle, Eye,
  CheckCircle2, AlertCircle, Loader2, ExternalLink, Copy
} from 'lucide-react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export interface ProposalGeneratorProps {
  lead: {
    id: string
    name: string
    school_name?: string
    school?: string
    email?: string
    phone?: string
    city?: string
    state?: string
  }
  consultant?: {
    name: string
    email: string
    phone?: string
    full_name?: string
  }
  onClose: () => void
  onSave?: (proposal: any) => void
}

interface ProposalForm {
  client_name: string
  school_name: string
  client_email: string
  client_phone: string
  proposal_date: string
  implementation_normal: number
  implementation_special: number
  monthly_normal: number
  monthly_special: number
  special_deadline: string
  validity_days: number
  consultant_name: string
  consultant_phone: string
  consultant_email: string
  consultant_site: string
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const MODULE_LIST = [
  { icon: '🏠', name: 'Início / Dashboard', desc: 'Visão geral da campanha, metas e indicadores em tempo real.' },
  { icon: '👥', name: 'Leads',              desc: 'Pipeline completo do lead até a matrícula, com histórico.' },
  { icon: '📋', name: 'Contatos',           desc: 'Cadastro centralizado de famílias e responsáveis.' },
  { icon: '🗓',  name: 'Visitas',           desc: 'Agendamento, confirmação e taxa de comparecimento.' },
  { icon: '📱', name: 'WhatsApp',           desc: 'Equipe toda atendendo no número oficial Meta da escola.' },
  { icon: '📊', name: 'Relatórios',         desc: 'Conversão, CPA, desempenho por consultor e rematrícula.' },
  { icon: '🔄', name: 'Transferências',     desc: 'Rastreia motivo real da saída e oportunidades de retenção.' },
  { icon: '😊', name: 'Pesquisas',          desc: 'NPS e satisfação das famílias organizados por IA.' },
  { icon: '👤', name: 'Usuários',           desc: 'Gestão de equipe com permissões e produtividade.' },
  { icon: '⚙️', name: 'Configurações',      desc: 'Personalização completa dos fluxos da escola.' },
]

const HOW_IT_WORKS = [
  { icon: '🔍', title: 'Diagnóstico',  desc: 'Mapeamos os processos da escola e identificamos oportunidades de melhoria.' },
  { icon: '⚙️', title: 'Implantação', desc: 'Configuramos o sistema e personalizamos conforme a realidade da escola.' },
  { icon: '🎓', title: 'Treinamento', desc: 'Capacitamos toda a equipe para extrair o máximo da plataforma.' },
  { icon: '🤝', title: 'Suporte',     desc: 'Acompanhamento contínuo com suporte dedicado via WhatsApp e reuniões.' },
]

const INCLUDES = [
  'Configuração completa da conta',
  'Integração com ERP da escola',
  'Homologação WhatsApp Oficial',
  'Personalização dos fluxos',
  'Definição das metas iniciais',
  'Treinamento da equipe',
]

const VD = '#00523C'
const VM = '#00A896'
const VC = '#0DD3BF'

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800;12..96,900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');`

function SectionTitle({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
      <div style={{ width: 4, minWidth: 4, height: 34, background: `linear-gradient(to bottom, ${VM}, ${VC})`, borderRadius: 2 }} />
      <h2 style={{ fontSize: 22, fontWeight: 800, color: VD, margin: 0, fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.3px' }}>{text}</h2>
    </div>
  )
}

// ── Preview ───────────────────────────────────────────────────────────────────
function ProposalPreview({ form, previewRef }: { form: ProposalForm; previewRef: React.RefObject<HTMLDivElement> }) {
  const deadline = form.special_deadline
    ? new Date(form.special_deadline + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—'
  const proposalDate = form.proposal_date
    ? new Date(form.proposal_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—'

  return (
    <div ref={previewRef} style={{ fontFamily: "'Plus Jakarta Sans', 'Helvetica Neue', sans-serif", background: '#F8FAFC', minHeight: '100%' }}>
      <style dangerouslySetInnerHTML={{ __html: FONT_IMPORT }} />

      {/* ── 1. CAPA ── */}
      <div style={{ background: 'linear-gradient(135deg, #00523C 0%, #006B50 45%, #00A896 100%)', padding: '52px 48px 44px', color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -80, right: -80, width: 320, height: 320, borderRadius: '50%', background: 'rgba(13,211,191,0.10)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -50, left: -50, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 52, position: 'relative', zIndex: 1 }}>
          {/* Logo pill */}
          <div style={{ background: '#fff', borderRadius: 100, padding: '9px 22px', display: 'inline-flex', alignItems: 'center', gap: 10, boxShadow: '0 2px 16px rgba(0,0,0,0.16)' }}>
            <div style={{ width: 26, height: 26, background: `linear-gradient(135deg, ${VD}, ${VM})`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 900, fontFamily: "'Bricolage Grotesque', sans-serif" }}>A</span>
            </div>
            <span style={{ fontSize: 16, fontWeight: 900, color: VD, fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.3px' }}>Áion Edu</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.14)', borderRadius: 12, padding: '9px 18px', fontSize: 12, fontWeight: 600, border: '1px solid rgba(255,255,255,0.2)' }}>
            Proposta Comercial
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 1, marginBottom: 48 }}>
          <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 2, fontWeight: 600 }}>Proposta exclusiva para</div>
          <h1 style={{ fontSize: 38, fontWeight: 900, margin: '0 0 12px', lineHeight: 1.1, fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.5px' }}>
            {form.school_name || 'Nome da Escola'}
          </h1>
          <div style={{ fontSize: 16, opacity: 0.85, fontWeight: 500 }}>Atenção: {form.client_name || 'Gestor'}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, position: 'relative', zIndex: 1, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
          {[
            { label: 'Data',      value: proposalDate },
            { label: 'Validade',  value: `${form.validity_days} dias` },
            { label: 'Consultor', value: form.consultant_name || '—' },
          ].map(c => (
            <div key={c.label} style={{ background: 'rgba(255,255,255,0.11)', borderRadius: 14, padding: '16px 18px', border: '1px solid rgba(255,255,255,0.14)' }}>
              <div style={{ fontSize: 10, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 8 }}>{c.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{c.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 2. SOBRE A ÁION EDU ── */}
      <div style={{ background: '#fff', padding: '48px 48px' }}>
        <SectionTitle text="Sobre a Áion Edu" />
        <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.85, marginBottom: 28 }}>
          A <strong style={{ color: VD }}>Áion Edu</strong> é uma plataforma completa de gestão educacional desenvolvida especialmente para escolas que desejam modernizar seus processos, aumentar matrículas e melhorar a experiência das famílias — tudo isso de forma simples, integrada e eficiente.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {MODULE_LIST.map(mod => (
            <div key={mod.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', background: '#F0FDF8', borderRadius: 10, border: `1px solid ${VC}55` }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{mod.icon}</span>
              <span style={{ fontSize: 13, color: VD, fontWeight: 600 }}>{mod.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. COMO FUNCIONA ── */}
      <div style={{ background: '#F8FAFC', padding: '48px 48px' }}>
        <SectionTitle text="Como funciona" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {HOW_IT_WORKS.map((step, i) => (
            <div key={step.title} style={{ background: '#fff', borderRadius: 14, padding: '24px 18px 22px', border: '1px solid #E2E8F0', textAlign: 'center', position: 'relative', boxShadow: '0 2px 8px rgba(0,82,60,0.05)' }}>
              <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', width: 28, height: 28, background: `linear-gradient(135deg, ${VD}, ${VM})`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 800, boxShadow: '0 2px 8px rgba(0,82,60,0.28)' }}>{i + 1}</div>
              <div style={{ fontSize: 30, marginBottom: 12, marginTop: 12 }}>{step.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', marginBottom: 8, fontFamily: "'Bricolage Grotesque', sans-serif" }}>{step.title}</div>
              <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.65 }}>{step.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 4. INVESTIMENTO ── */}
      <div style={{ background: '#fff', padding: '48px 48px' }}>
        <SectionTitle text="Investimento" />

        {form.special_deadline && (
          <div style={{ background: `linear-gradient(135deg, ${VD}, ${VM})`, borderRadius: 14, padding: '16px 22px', color: '#fff', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 4px 18px rgba(0,82,60,0.22)' }}>
            <span style={{ fontSize: 24 }}>⏰</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, fontFamily: "'Bricolage Grotesque', sans-serif" }}>Condição especial válida até {deadline}</div>
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>Garanta o desconto agora — após essa data, os valores retornam ao normal.</div>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Implantação */}
          <div style={{ borderRadius: 16, overflow: 'hidden', border: `2px solid ${VC}`, boxShadow: '0 4px 18px rgba(13,211,191,0.12)' }}>
            <div style={{ background: `linear-gradient(135deg, ${VD}, ${VM})`, padding: '18px 24px', color: '#fff' }}>
              <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: 1, fontWeight: 600 }}>Taxa de Implantação</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Pagamento único</div>
            </div>
            <div style={{ padding: '24px', background: '#F0FDF8' }}>
              <div style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>Valor normal</div>
              <div style={{ fontSize: 18, color: '#94A3B8', textDecoration: 'line-through', marginBottom: 16 }}>{fmtBRL(form.implementation_normal)}</div>
              {form.implementation_special === 0 ? (
                <>
                  <div style={{ fontSize: 11, color: '#16A34A', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 8 }}>🎁 Implantação gratuita</div>
                  <div style={{ fontSize: 44, fontWeight: 900, color: VD, lineHeight: 1, letterSpacing: '-1px', fontFamily: "'Bricolage Grotesque', sans-serif" }}>GRÁTIS</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 11, color: '#16A34A', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 8 }}>🎁 Condição especial</div>
                  <div style={{ fontSize: 36, fontWeight: 900, color: VD, lineHeight: 1, fontFamily: "'Bricolage Grotesque', sans-serif" }}>{fmtBRL(form.implementation_special)}</div>
                  <div style={{ fontSize: 12, color: VM, fontWeight: 600, marginTop: 8 }}>Economia de {fmtBRL(form.implementation_normal - form.implementation_special)}</div>
                </>
              )}
            </div>
          </div>

          {/* Mensalidade */}
          <div style={{ borderRadius: 16, overflow: 'hidden', border: `2px solid ${VC}`, boxShadow: '0 4px 18px rgba(13,211,191,0.12)' }}>
            <div style={{ background: `linear-gradient(135deg, ${VD}, ${VM})`, padding: '18px 24px', color: '#fff' }}>
              <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: 1, fontWeight: 600 }}>Mensalidade</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Acesso completo</div>
            </div>
            <div style={{ padding: '24px', background: '#F0FDF8' }}>
              <div style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>Valor normal</div>
              <div style={{ fontSize: 18, color: '#94A3B8', textDecoration: 'line-through', marginBottom: 16 }}>{fmtBRL(form.monthly_normal)}</div>
              <div style={{ fontSize: 11, color: '#16A34A', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 8 }}>🎁 Condição especial</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: VD, lineHeight: 1, fontFamily: "'Bricolage Grotesque', sans-serif" }}>{fmtBRL(form.monthly_special)}</div>
              <div style={{ fontSize: 12, color: VM, fontWeight: 600, marginTop: 8 }}>Economia de {fmtBRL(form.monthly_normal - form.monthly_special)}/mês</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 5. O QUE ESTÁ INCLUSO ── */}
      <div style={{ background: '#F8FAFC', padding: '48px 48px' }}>
        <SectionTitle text="O que está incluso" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {INCLUDES.map(item => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,82,60,0.04)' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: `linear-gradient(135deg, ${VM}, ${VC})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: '#fff', fontSize: 11, fontWeight: 900 }}>✓</span>
              </div>
              <span style={{ fontSize: 12, color: '#1A2B4A', fontWeight: 500, lineHeight: 1.4 }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 6. VALIDADE ── */}
      <div style={{ background: '#fff', padding: '40px 48px' }}>
        <div style={{ background: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)', border: '2px solid #FDE68A', borderRadius: 16, padding: '26px 32px', display: 'flex', gap: 22, alignItems: 'center' }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#92400E', marginBottom: 8, fontFamily: "'Bricolage Grotesque', sans-serif" }}>Proposta válida por {form.validity_days} dias</div>
            <div style={{ fontSize: 13, color: '#78350F', lineHeight: 1.75 }}>
              {form.special_deadline
                ? `Os valores especiais estão disponíveis até ${deadline}. Após essa data, os preços retornarão ao normal. Formalize agora para garantir as condições apresentadas.`
                : `Esta proposta é válida por ${form.validity_days} dias a partir da data de emissão. Entre em contato com seu consultor para formalizar.`}
            </div>
          </div>
        </div>
      </div>

      {/* ── 7. RODAPÉ ── */}
      <div style={{ background: VD, padding: '48px 48px', color: '#fff' }}>
        <div style={{ fontSize: 26, fontWeight: 900, fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.4px', marginBottom: 6 }}>Áion Edu</div>
        <div style={{ fontSize: 13, opacity: 0.55, marginBottom: 36 }}>Plataforma completa de gestão educacional</div>

        {form.consultant_name && (
          <div style={{ background: 'rgba(255,255,255,0.09)', borderRadius: 14, padding: '20px 26px', display: 'inline-block', marginBottom: 32, border: '1px solid rgba(255,255,255,0.12)' }}>
            <div style={{ fontSize: 10, opacity: 0.6, textTransform: 'uppercase' as const, letterSpacing: 1.5, fontWeight: 600, marginBottom: 10 }}>Seu consultor</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6, fontFamily: "'Bricolage Grotesque', sans-serif" }}>{form.consultant_name}</div>
            {form.consultant_phone && <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 3 }}>{form.consultant_phone}</div>}
            {form.consultant_email && <div style={{ fontSize: 13, opacity: 0.65 }}>{form.consultant_email}</div>}
          </div>
        )}

        <div style={{ fontSize: 12, opacity: 0.4, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 20 }}>
          {form.consultant_site || 'aionedu.com.br'}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
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
  const [activeSection, setActiveSection] = useState<'client' | 'values' | 'consultant'>('client')

  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 4500); return () => clearTimeout(t) }
  }, [toast])

  const set = (k: keyof ProposalForm, v: any) => setForm(f => ({ ...f, [k]: v }))
  const showToast = (msg: string, ok = true) => setToast({ msg, ok })

  const saveProposal = async (): Promise<string | null> => {
    if (savedId) {
      await supabase.from('proposals').update({
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
        updated_at:             new Date().toISOString(),
      }).eq('id', savedId)
      return savedId
    }

    const { data, error } = await supabase.from('proposals').insert({
      lead_id:                lead.id,
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
      status:                 'draft',
    }).select('id, view_token').single()

    if (error) throw error
    setSavedId(data.id)
    setViewToken(data.view_token)
    await supabase.from('crm_leads').update({ has_proposal: true, last_proposal_id: data.id }).eq('id', lead.id)
    return data.id
  }

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
    if (!previewRef.current) return
    setGeneratingPdf(true)
    try {
      const id = await saveProposal()
      if (!id) throw new Error('Falha ao salvar proposta')

      const canvas  = await html2canvas(previewRef.current, { scale: 1.5, useCORS: true, backgroundColor: '#F8FAFC' })
      const imgData = canvas.toDataURL('image/jpeg', 0.92)
      const pdf     = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' })
      const pageW   = pdf.internal.pageSize.getWidth()
      const pageH   = pdf.internal.pageSize.getHeight()
      const imgH    = (canvas.height * pageW) / canvas.width
      let yPos = 0
      while (yPos < imgH) {
        if (yPos > 0) pdf.addPage()
        pdf.addImage(imgData, 'JPEG', 0, -yPos, pageW, imgH)
        yPos += pageH
      }

      const pdfBlob   = pdf.output('blob')
      const safeName  = form.school_name.replace(/[^a-zA-Z0-9À-ÿ\s]/g, '').replace(/\s+/g, '_') || id
      const storagePath = `${id}/${safeName}.pdf`
      const { error: upErr } = await supabase.storage.from('proposals').upload(storagePath, pdfBlob, { contentType: 'application/pdf', upsert: true })
      if (upErr) throw new Error(`Upload falhou: ${upErr.message}`)

      const { data: { publicUrl } } = supabase.storage.from('proposals').getPublicUrl(storagePath)
      setPdfUrl(publicUrl)
      await supabase.from('proposals').update({ pdf_url: publicUrl }).eq('id', id)
      pdf.save(`Proposta_${form.school_name.replace(/\s+/g, '_')}.pdf`)
      showToast('PDF gerado e salvo!')
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
      if (!id) throw new Error('Falha ao salvar proposta')

      const token = viewToken || (await supabase.from('proposals').select('view_token').eq('id', id).single()).data?.view_token
      const proposalUrl = `${window.location.origin}/proposta/${token}`

      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'proposal',
          to:   form.client_email,
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
      try { await saveProposal() } catch {}
      const { data } = await supabase.from('proposals').select('view_token').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
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
    }
  }

  const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none'
  const lbl = 'block text-xs font-semibold text-gray-600 mb-1.5'

  const tabs = [
    { id: 'client'     as const, label: 'Cliente' },
    { id: 'values'     as const, label: 'Investimento' },
    { id: 'consultant' as const, label: 'Consultor' },
  ]

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
      {toast && (
        <div className={`fixed top-5 right-5 z-[200] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold
          ${toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <div className="bg-white rounded-2xl w-full max-w-[1300px] h-[93vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Gerador de Proposta</h2>
            <p className="text-xs text-gray-400 mt-0.5">{form.school_name || 'Nova proposta'}</p>
          </div>
          <div className="flex items-center gap-2">
            {savedId && (
              <button onClick={copyProposalLink} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50">
                <Copy className="w-3.5 h-3.5" /> Copiar link
              </button>
            )}
            {pdfUrl && (
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50">
                <ExternalLink className="w-3.5 h-3.5" /> Ver PDF
              </a>
            )}
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg ml-2">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Left — Form */}
          <div className="w-80 flex-shrink-0 flex flex-col border-r border-gray-100">
            <div className="flex border-b border-gray-100">
              {tabs.map(s => (
                <button key={s.id} onClick={() => setActiveSection(s.id)}
                  className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${activeSection === s.id ? 'text-emerald-600 border-b-2 border-emerald-500' : 'text-gray-400 hover:text-gray-600'}`}>
                  {s.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {activeSection === 'client' && (
                <>
                  <div><label className={lbl}>Nome do gestor / responsável</label><input className={inp} value={form.client_name} onChange={e => set('client_name', e.target.value)} /></div>
                  <div><label className={lbl}>Nome da escola</label><input className={inp} value={form.school_name} onChange={e => set('school_name', e.target.value)} /></div>
                  <div><label className={lbl}>Telefone</label><input className={inp} value={form.client_phone} onChange={e => set('client_phone', e.target.value)} /></div>
                  <div><label className={lbl}>Email</label><input type="email" className={inp} value={form.client_email} onChange={e => set('client_email', e.target.value)} /></div>
                  <div><label className={lbl}>Data da proposta</label><input type="date" className={inp} value={form.proposal_date} onChange={e => set('proposal_date', e.target.value)} /></div>
                </>
              )}

              {activeSection === 'values' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={lbl}>Implantação normal (R$)</label><input type="number" className={inp} value={form.implementation_normal} onChange={e => set('implementation_normal', +e.target.value)} /></div>
                    <div>
                      <label className={lbl}>Implantação especial (R$)</label>
                      <input type="number" className={inp} value={form.implementation_special} onChange={e => set('implementation_special', +e.target.value)} />
                      {form.implementation_special === 0 && (
                        <p className="text-xs text-emerald-600 font-semibold mt-1">🎁 Implantação gratuita</p>
                      )}
                    </div>
                    <div><label className={lbl}>Mensalidade normal (R$)</label><input type="number" className={inp} value={form.monthly_normal} onChange={e => set('monthly_normal', +e.target.value)} /></div>
                    <div><label className={lbl}>Mensalidade especial (R$)</label><input type="number" className={inp} value={form.monthly_special} onChange={e => set('monthly_special', +e.target.value)} /></div>
                  </div>
                  <div><label className={lbl}>Prazo condição especial</label><input type="date" className={inp} value={form.special_deadline} onChange={e => set('special_deadline', e.target.value)} /></div>
                  <div><label className={lbl}>Validade da proposta (dias)</label><input type="number" className={inp} min={1} max={60} value={form.validity_days} onChange={e => set('validity_days', +e.target.value)} /></div>
                </>
              )}

              {activeSection === 'consultant' && (
                <>
                  <div><label className={lbl}>Nome</label><input className={inp} value={form.consultant_name} onChange={e => set('consultant_name', e.target.value)} /></div>
                  <div><label className={lbl}>Telefone</label><input className={inp} value={form.consultant_phone} onChange={e => set('consultant_phone', e.target.value)} /></div>
                  <div><label className={lbl}>Email</label><input type="email" className={inp} value={form.consultant_email} onChange={e => set('consultant_email', e.target.value)} /></div>
                  <div><label className={lbl}>Site</label><input className={inp} value={form.consultant_site} onChange={e => set('consultant_site', e.target.value)} /></div>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-gray-100 space-y-2.5">
              <button onClick={handleSaveDraft} disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Salvando...' : 'Salvar rascunho'}
              </button>
              <button onClick={handleGeneratePdf} disabled={generatingPdf}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-emerald-200 text-emerald-700 bg-emerald-50 rounded-xl text-sm font-semibold hover:bg-emerald-100 disabled:opacity-60">
                {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {generatingPdf ? 'Gerando PDF...' : 'Gerar PDF'}
              </button>
              <button onClick={handleSendEmail} disabled={sendingEmail || !form.client_email}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-semibold hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60">
                {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sendingEmail ? 'Enviando...' : 'Enviar por Email'}
              </button>
              <button onClick={handleWhatsApp}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#25D366] text-white rounded-xl text-sm font-semibold hover:bg-[#1ebe59]">
                <MessageCircle className="w-4 h-4" /> Enviar por WhatsApp
              </button>
            </div>
          </div>

          {/* Right — Preview */}
          <div className="flex-1 overflow-y-auto bg-gray-100">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-200 border-b border-gray-300">
              <Eye className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs font-semibold text-gray-500">Preview ao vivo</span>
            </div>
            <div className="p-4">
              <div className="max-w-2xl mx-auto shadow-xl rounded-xl overflow-hidden">
                <ProposalPreview form={form} previewRef={previewRef} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
