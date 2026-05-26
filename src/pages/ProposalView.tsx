import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Download, ThumbsUp, Clock, Loader2, AlertCircle, MessageCircle } from 'lucide-react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

const fmtBRL = (v: number) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const MODULE_LIST = [
  { icon: '🏠', name: 'Início / Dashboard' },
  { icon: '👥', name: 'Leads' },
  { icon: '📋', name: 'Contatos' },
  { icon: '🗓',  name: 'Visitas' },
  { icon: '📱', name: 'WhatsApp' },
  { icon: '📊', name: 'Relatórios' },
  { icon: '🔄', name: 'Transferências' },
  { icon: '😊', name: 'Pesquisas' },
  { icon: '👤', name: 'Usuários' },
  { icon: '⚙️', name: 'Configurações' },
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

export default function ProposalView() {
  const { token } = useParams<{ token: string }>()
  const [proposal, setProposal]     = useState<any>(null)
  const [loading, setLoading]       = useState(true)
  const [notFound, setNotFound]     = useState(false)
  const [feedback, setFeedback]     = useState<'accepted' | 'thinking' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return }
    loadProposal()
  }, [token])

  const loadProposal = async () => {
    const { data, error } = await supabase
      .from('proposals')
      .select('*')
      .eq('view_token', token)
      .single()

    if (error || !data) { setNotFound(true); setLoading(false); return }
    setProposal(data)
    setLoading(false)

    await supabase.from('proposals').update({
      view_count:      (data.view_count || 0) + 1,
      first_viewed_at: data.first_viewed_at || new Date().toISOString(),
      last_viewed_at:  new Date().toISOString(),
      status: ['sent', 'delivered'].includes(data.status) ? 'opened' : data.status,
    }).eq('view_token', token)
  }

  const handleFeedback = async (type: 'accepted' | 'thinking') => {
    if (!proposal || submitting) return
    setSubmitting(true)
    const newStatus = type === 'accepted' ? 'accepted' : 'rejected'
    await supabase.from('proposals').update({ status: newStatus }).eq('id', proposal.id)
    setFeedback(type)
    setSubmitting(false)
  }

  const handleDownloadPdf = async () => {
    if (proposal?.pdf_url) { window.open(proposal.pdf_url, '_blank'); return }
    if (!previewRef.current) return
    setGeneratingPdf(true)
    try {
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
      pdf.save(`Proposta_${proposal.school_name?.replace(/\s+/g, '_') || 'Aion'}.pdf`)
    } finally { setGeneratingPdf(false) }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F8FAFC' }}>
      <div className="text-center">
        <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" style={{ color: VM }} />
        <p className="text-sm" style={{ color: '#64748B' }}>Carregando proposta...</p>
      </div>
    </div>
  )

  if (notFound) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F8FAFC' }}>
      <div className="text-center max-w-sm px-6">
        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Proposta não encontrada</h1>
        <p className="text-sm text-gray-500">O link pode ter expirado ou estar incorreto.</p>
        <a href="https://aionedu.com.br" className="mt-6 inline-block text-sm font-semibold hover:underline" style={{ color: VM }}>aionedu.com.br</a>
      </div>
    </div>
  )

  const p = proposal
  const deadline = p.special_deadline
    ? new Date(p.special_deadline + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null
  const proposalDate = p.created_at
    ? new Date(p.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null

  return (
    <div className="min-h-screen" style={{ background: '#F0F4F8' }}>
      {/* Sticky action bar */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div style={{ width: 30, height: 30, background: `linear-gradient(135deg, ${VD}, ${VM})`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 900, fontFamily: "'Bricolage Grotesque', sans-serif" }}>A</span>
            </div>
            <div>
              <span className="text-sm font-bold text-gray-900">Proposta Comercial</span>
              <span className="text-sm text-gray-400 ml-2">— {p.school_name}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleDownloadPdf} disabled={generatingPdf}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60">
              {generatingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Baixar PDF
            </button>
            {p.consultant_phone && (
              <a href={`https://wa.me/${p.consultant_phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 bg-[#25D366] text-white rounded-lg text-xs font-semibold hover:bg-[#1ebe59]">
                <MessageCircle className="w-3.5 h-3.5" /> Falar com consultor
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Proposal content */}
      <div className="max-w-3xl mx-auto py-6 px-4">
        <div ref={previewRef} className="rounded-xl overflow-hidden shadow-xl" style={{ fontFamily: "'Plus Jakarta Sans', 'Helvetica Neue', sans-serif" }}>
          <style dangerouslySetInnerHTML={{ __html: FONT_IMPORT }} />

          {/* ── 1. CAPA ── */}
          <div style={{ background: 'linear-gradient(135deg, #00523C 0%, #006B50 45%, #00A896 100%)', padding: '52px 48px 44px', color: '#fff', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -80, right: -80, width: 320, height: 320, borderRadius: '50%', background: 'rgba(13,211,191,0.10)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -50, left: -50, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 52, position: 'relative', zIndex: 1 }}>
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
              <h1 style={{ fontSize: 38, fontWeight: 900, margin: '0 0 12px', lineHeight: 1.1, fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.5px' }}>{p.school_name}</h1>
              <div style={{ fontSize: 16, opacity: 0.85, fontWeight: 500 }}>Atenção: {p.client_name}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, position: 'relative', zIndex: 1, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
              {[
                { label: 'Data',      value: proposalDate || '—' },
                { label: 'Validade',  value: `${p.validity_days} dias` },
                { label: 'Consultor', value: p.consultant_name || '—' },
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

            {deadline && (
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
                  <div style={{ fontSize: 18, color: '#94A3B8', textDecoration: 'line-through', marginBottom: 16 }}>{fmtBRL(p.implementation_normal)}</div>
                  {Number(p.implementation_special) === 0 ? (
                    <>
                      <div style={{ fontSize: 11, color: '#16A34A', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 8 }}>🎁 Implantação gratuita</div>
                      <div style={{ fontSize: 44, fontWeight: 900, color: VD, lineHeight: 1, letterSpacing: '-1px', fontFamily: "'Bricolage Grotesque', sans-serif" }}>GRÁTIS</div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 11, color: '#16A34A', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 8 }}>🎁 Condição especial</div>
                      <div style={{ fontSize: 36, fontWeight: 900, color: VD, lineHeight: 1, fontFamily: "'Bricolage Grotesque', sans-serif" }}>{fmtBRL(p.implementation_special)}</div>
                      <div style={{ fontSize: 12, color: VM, fontWeight: 600, marginTop: 8 }}>Economia de {fmtBRL(p.implementation_normal - p.implementation_special)}</div>
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
                  <div style={{ fontSize: 18, color: '#94A3B8', textDecoration: 'line-through', marginBottom: 16 }}>{fmtBRL(p.monthly_normal)}</div>
                  <div style={{ fontSize: 11, color: '#16A34A', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 8 }}>🎁 Condição especial</div>
                  <div style={{ fontSize: 36, fontWeight: 900, color: VD, lineHeight: 1, fontFamily: "'Bricolage Grotesque', sans-serif" }}>{fmtBRL(p.monthly_special)}</div>
                  <div style={{ fontSize: 12, color: VM, fontWeight: 600, marginTop: 8 }}>Economia de {fmtBRL(p.monthly_normal - p.monthly_special)}/mês</div>
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
                <div style={{ fontSize: 16, fontWeight: 800, color: '#92400E', marginBottom: 8, fontFamily: "'Bricolage Grotesque', sans-serif" }}>Proposta válida por {p.validity_days} dias</div>
                <div style={{ fontSize: 13, color: '#78350F', lineHeight: 1.75 }}>
                  {deadline
                    ? `Os valores especiais estão disponíveis até ${deadline}. Após essa data, os preços retornarão ao normal. Formalize agora para garantir as condições apresentadas.`
                    : `Esta proposta é válida por ${p.validity_days} dias a partir da data de emissão. Entre em contato com seu consultor para formalizar.`}
                </div>
              </div>
            </div>
          </div>

          {/* ── 7. RODAPÉ ── */}
          <div style={{ background: VD, padding: '48px 48px', color: '#fff' }}>
            <div style={{ fontSize: 26, fontWeight: 900, fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.4px', marginBottom: 6 }}>Áion Edu</div>
            <div style={{ fontSize: 13, opacity: 0.55, marginBottom: 36 }}>Plataforma completa de gestão educacional</div>

            {p.consultant_name && (
              <div style={{ background: 'rgba(255,255,255,0.09)', borderRadius: 14, padding: '20px 26px', display: 'inline-block', marginBottom: 32, border: '1px solid rgba(255,255,255,0.12)' }}>
                <div style={{ fontSize: 10, opacity: 0.6, textTransform: 'uppercase' as const, letterSpacing: 1.5, fontWeight: 600, marginBottom: 10 }}>Seu consultor</div>
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6, fontFamily: "'Bricolage Grotesque', sans-serif" }}>{p.consultant_name}</div>
                {p.consultant_phone && <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 3 }}>{p.consultant_phone}</div>}
                {p.consultant_email && <div style={{ fontSize: 13, opacity: 0.65 }}>{p.consultant_email}</div>}
              </div>
            )}

            <div style={{ fontSize: 12, opacity: 0.4, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 20 }}>
              {p.consultant_site || 'aionedu.com.br'}
            </div>
          </div>
        </div>

        {/* CTA de feedback */}
        {feedback ? (
          <div className="mt-8 bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
            {feedback === 'accepted' ? (
              <>
                <div className="text-5xl mb-4">🎉</div>
                <h3 className="text-xl font-bold mb-2" style={{ color: VM }}>Ótima decisão!</h3>
                <p className="text-gray-500 text-sm mb-4">Seu consultor entrará em contato em breve para dar continuidade ao processo.</p>
                {p.consultant_phone && (
                  <a href={`https://wa.me/${p.consultant_phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
                    style={{ background: '#25D366' }}>
                    <MessageCircle className="w-4 h-4" /> Falar agora no WhatsApp
                  </a>
                )}
              </>
            ) : (
              <>
                <div className="text-5xl mb-4">💭</div>
                <h3 className="text-xl font-bold text-gray-700 mb-2">Tudo bem, sem pressa!</h3>
                <p className="text-gray-500 text-sm">Quando estiver pronto, fale com seu consultor. Estamos aqui para tirar todas as dúvidas.</p>
              </>
            )}
          </div>
        ) : (
          <div className="mt-8 bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">O que você achou da proposta?</h3>
            <p className="text-sm text-gray-400 text-center mb-6">Sua resposta ajuda nosso time a te atender melhor</p>
            <div className="flex gap-4">
              <button onClick={() => handleFeedback('accepted')} disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm border-2 transition-all disabled:opacity-60"
                style={{ background: '#F0FDF8', borderColor: `${VC}88`, color: VD }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#DCFDF5' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#F0FDF8' }}>
                <ThumbsUp className="w-5 h-5" /> Tenho interesse!
              </button>
              <button onClick={() => handleFeedback('thinking')} disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl text-gray-600 font-semibold text-sm hover:bg-gray-100 hover:border-gray-300 transition-all disabled:opacity-60">
                <Clock className="w-5 h-5" /> Preciso de mais tempo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
