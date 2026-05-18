import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Download, ThumbsUp, Clock, Loader2, AlertCircle, MessageCircle } from 'lucide-react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

const fmtBRL = (v: number) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const MODULE_LIST = [
  'CRM de Matrículas',
  'WhatsApp Business API',
  'Comunicados e Campanhas',
  'Portal do Responsável',
  'Relatórios e Analytics',
  'Pesquisas de Satisfação',
  'Controle de Rematrículas',
  'Editor de Fluxo de Atendimento',
]

const HOW_IT_WORKS = [
  { icon: '🔍', title: 'Diagnóstico', desc: 'Mapeamos os processos da escola e identificamos oportunidades.' },
  { icon: '⚙️', title: 'Implantação', desc: 'Configuramos e personalizamos conforme a realidade da escola.' },
  { icon: '🎓', title: 'Treinamento', desc: 'Capacitamos toda a equipe para extrair o máximo da plataforma.' },
  { icon: '🤝', title: 'Suporte', desc: 'Acompanhamento contínuo com suporte dedicado via WhatsApp.' },
]

const WHY_AION = [
  { icon: '⚡', title: 'Implementação rápida', desc: 'Sua escola operando em menos de 7 dias.' },
  { icon: '📱', title: 'WhatsApp integrado', desc: 'API oficial Meta, sem risco de bloqueio.' },
  { icon: '🤖', title: 'Automação inteligente', desc: 'Bot personalizado para cada etapa da jornada.' },
  { icon: '📊', title: 'Dados em tempo real', desc: 'Dashboards para decisões mais rápidas.' },
  { icon: '🔒', title: 'Segurança total', desc: 'Dados protegidos com criptografia de ponta.' },
  { icon: '💬', title: 'Suporte humanizado', desc: 'Equipe dedicada para atender sua escola.' },
]

export default function ProposalView() {
  const { token } = useParams<{ token: string }>()
  const [proposal, setProposal]   = useState<any>(null)
  const [loading, setLoading]     = useState(true)
  const [notFound, setNotFound]   = useState(false)
  const [feedback, setFeedback]   = useState<'accepted' | 'thinking' | null>(null)
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

    // Register view
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
      const canvas  = await html2canvas(previewRef.current, { scale: 1.5, useCORS: true, backgroundColor: '#F0F4F8' })
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Carregando proposta...</p>
      </div>
    </div>
  )

  if (notFound) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-sm px-6">
        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Proposta não encontrada</h1>
        <p className="text-gray-500 text-sm">O link pode ter expirado ou estar incorreto.</p>
        <a href="https://aionedu.com.br" className="mt-6 inline-block text-sm text-emerald-600 font-semibold hover:underline">aionedu.com.br</a>
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
    <div className="min-h-screen bg-gray-100">
      {/* Sticky action bar */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <span className="text-sm font-bold text-gray-900">Proposta Comercial</span>
            <span className="text-sm text-gray-400 ml-2">— {p.school_name}</span>
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
        <div ref={previewRef} className="rounded-xl overflow-hidden shadow-xl" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>

          {/* Cover */}
          <div style={{ background: 'linear-gradient(135deg, #00523C 0%, #00A896 60%, #0DD3BF 100%)', padding: '52px 48px 44px', color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.5px' }}>Áion Edu</div>
                <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2, letterSpacing: 1 }}>SISTEMA DE GESTÃO EDUCACIONAL</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '8px 16px', fontSize: 12 }}>Proposta Comercial</div>
            </div>
            <div>
              <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Proposta para</div>
              <h1 style={{ fontSize: 34, fontWeight: 900, margin: '0 0 8px', lineHeight: 1.15 }}>{p.school_name}</h1>
              <div style={{ fontSize: 15, opacity: 0.85 }}>{p.client_name}</div>
            </div>
            <div style={{ display: 'flex', gap: 32, marginTop: 36, paddingTop: 28, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
              {proposalDate && <div><div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>DATA</div><div style={{ fontSize: 14, fontWeight: 600 }}>{proposalDate}</div></div>}
              <div><div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>VALIDADE</div><div style={{ fontSize: 14, fontWeight: 600 }}>{p.validity_days} dias</div></div>
              {p.consultant_name && <div><div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>CONSULTOR</div><div style={{ fontSize: 14, fontWeight: 600 }}>{p.consultant_name}</div></div>}
            </div>
          </div>

          {/* Sobre */}
          <div style={{ background: '#fff', padding: '40px 48px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 4, height: 28, background: 'linear-gradient(to bottom, #00A896, #0DD3BF)', borderRadius: 2 }} />
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#00523C', margin: 0 }}>Sobre a Áion Edu</h2>
            </div>
            <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.75, marginBottom: 24 }}>
              A <strong>Áion Edu</strong> é uma plataforma completa de gestão educacional desenvolvida especialmente para escolas que desejam modernizar seus processos, aumentar matrículas e melhorar a experiência das famílias — tudo isso de forma simples e integrada.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px' }}>
              {MODULE_LIST.map(mod => (
                <div key={mod} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#F0FDF4', borderRadius: 8, border: '1px solid #BBF7D0' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#00A896', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#00523C', fontWeight: 600 }}>{mod}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Como funciona */}
          <div style={{ background: '#F8FAFC', padding: '40px 48px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ width: 4, height: 28, background: 'linear-gradient(to bottom, #00A896, #0DD3BF)', borderRadius: 2 }} />
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#00523C', margin: 0 }}>Como funciona</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {HOW_IT_WORKS.map((step, i) => (
                <div key={step.title} style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #E2E8F0', textAlign: 'center', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', width: 24, height: 24, background: '#00A896', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 800 }}>{i + 1}</div>
                  <div style={{ fontSize: 28, marginBottom: 10, marginTop: 8 }}>{step.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', marginBottom: 6 }}>{step.title}</div>
                  <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5 }}>{step.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Investimento */}
          <div style={{ background: '#fff', padding: '40px 48px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
              <div style={{ width: 4, height: 28, background: 'linear-gradient(to bottom, #00A896, #0DD3BF)', borderRadius: 2 }} />
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#00523C', margin: 0 }}>Investimento</h2>
            </div>
            {deadline && (
              <div style={{ background: 'linear-gradient(135deg, #00523C, #00A896)', borderRadius: 12, padding: '14px 20px', color: '#fff', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20 }}>⏰</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Condição especial válida até {deadline}</div>
                  <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>Garanta o desconto agora — após essa data, os valores retornam ao normal.</div>
                </div>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {[
                { label: 'Taxa de Implantação', sub: 'Pagamento único', normal: p.implementation_normal, special: p.implementation_special },
                { label: 'Mensalidade', sub: 'Acesso completo', normal: p.monthly_normal, special: p.monthly_special },
              ].map(item => (
                <div key={item.label} style={{ border: '2px solid #0DD3BF', borderRadius: 16, overflow: 'hidden' }}>
                  <div style={{ background: 'linear-gradient(135deg, #00523C, #00A896)', padding: '16px 24px', color: '#fff' }}>
                    <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4, textTransform: 'uppercase' as const }}>{item.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{item.sub}</div>
                  </div>
                  <div style={{ padding: '20px 24px', background: '#F0FDF4' }}>
                    <div style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>Valor normal</div>
                    <div style={{ fontSize: 18, color: '#94A3B8', textDecoration: 'line-through', marginBottom: 12 }}>{fmtBRL(item.normal)}</div>
                    <div style={{ fontSize: 11, color: '#16A34A', fontWeight: 700, textTransform: 'uppercase' as const, marginBottom: 6 }}>🎁 Condição especial</div>
                    <div style={{ fontSize: 36, fontWeight: 900, color: '#00523C', lineHeight: 1 }}>{fmtBRL(item.special)}</div>
                    <div style={{ fontSize: 12, color: '#00A896', fontWeight: 600, marginTop: 6 }}>Economia de {fmtBRL(item.normal - item.special)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Por que */}
          <div style={{ background: '#F8FAFC', padding: '40px 48px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ width: 4, height: 28, background: 'linear-gradient(to bottom, #00A896, #0DD3BF)', borderRadius: 2 }} />
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#00523C', margin: 0 }}>Por que a Áion?</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {WHY_AION.map(item => (
                <div key={item.title} style={{ background: '#fff', borderRadius: 12, padding: '20px 18px', border: '1px solid #E2E8F0', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 24, flexShrink: 0 }}>{item.icon}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', marginBottom: 4 }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Validade */}
          <div style={{ background: '#fff', padding: '32px 48px' }}>
            <div style={{ background: '#FFFBEB', border: '2px solid #FDE68A', borderRadius: 16, padding: '24px 28px', display: 'flex', gap: 20, alignItems: 'center' }}>
              <div style={{ fontSize: 36 }}>⚠️</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#92400E', marginBottom: 6 }}>Proposta válida por {p.validity_days} dias</div>
                <div style={{ fontSize: 13, color: '#78350F', lineHeight: 1.6 }}>
                  {deadline
                    ? `Os valores especiais estão disponíveis até ${deadline}. Após essa data, os preços retornarão ao normal.`
                    : `Esta proposta é válida por ${p.validity_days} dias a partir da data de emissão.`}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ background: '#00523C', padding: '36px 48px', color: '#fff', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>Áion Edu</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 20 }}>Sistema de Gestão Educacional</div>
            {p.consultant_name && (
              <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '16px 24px', display: 'inline-block', marginBottom: 20 }}>
                <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 4 }}>Seu consultor</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{p.consultant_name}</div>
                {p.consultant_phone && <div style={{ fontSize: 13, opacity: 0.85 }}>{p.consultant_phone}</div>}
                {p.consultant_email && <div style={{ fontSize: 13, opacity: 0.75 }}>{p.consultant_email}</div>}
              </div>
            )}
            <div style={{ fontSize: 12, opacity: 0.5, marginTop: 8 }}>aionedu.com.br · contato@aionedu.com.br</div>
          </div>
        </div>

        {/* CTA section */}
        {feedback ? (
          <div className="mt-8 bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
            {feedback === 'accepted' ? (
              <>
                <div className="text-5xl mb-4">🎉</div>
                <h3 className="text-xl font-bold text-emerald-700 mb-2">Ótima decisão!</h3>
                <p className="text-gray-500 text-sm mb-4">Seu consultor entrará em contato em breve para dar continuidade ao processo.</p>
                {p.consultant_phone && (
                  <a href={`https://wa.me/${p.consultant_phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#25D366] text-white rounded-xl font-semibold text-sm hover:bg-[#1ebe59]">
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
                className="flex-1 flex items-center justify-center gap-2 py-4 bg-emerald-50 border-2 border-emerald-200 rounded-2xl text-emerald-700 font-bold text-sm hover:bg-emerald-100 hover:border-emerald-400 transition-all disabled:opacity-60">
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
