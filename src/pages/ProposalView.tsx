import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Download, ThumbsUp, Clock, Loader2, AlertCircle, MessageCircle, Copy } from 'lucide-react'
import { pdf } from '@react-pdf/renderer'
import ProposalContent, { PW } from '../components/superadmin/ProposalContent'
import ProposalPdfDocument from '../lib/proposalPdf'

const VM = '#00A896'

export default function ProposalView() {
  const { token } = useParams<{ token: string }>()
  const [proposal, setProposal]     = useState<any>(null)
  const [loading, setLoading]       = useState(true)
  const [notFound, setNotFound]     = useState(false)
  const [feedback, setFeedback]     = useState<'accepted' | 'thinking' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [copied, setCopied]         = useState(false)
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
    await supabase
      .from('proposals')
      .update({ status: type === 'accepted' ? 'accepted' : 'rejected' })
      .eq('id', proposal.id)
    setFeedback(type)
    setSubmitting(false)
  }

  const handleDownloadPdf = async () => {
    if (proposal?.pdf_url) { window.open(proposal.pdf_url, '_blank'); return }
    setGeneratingPdf(true)
    try {
      const blob = await pdf(
        <ProposalPdfDocument data={{
          client_name:            proposal.client_name,
          school_name:            proposal.school_name,
          created_at:             proposal.created_at,
          implementation_normal:  proposal.implementation_normal,
          implementation_special: proposal.implementation_special,
          monthly_normal:         proposal.monthly_normal,
          monthly_special:        proposal.monthly_special,
          special_deadline:       proposal.special_deadline,
          validity_days:          proposal.validity_days,
          consultant_name:        proposal.consultant_name,
          consultant_phone:       proposal.consultant_phone,
          consultant_email:       proposal.consultant_email,
          consultant_site:        proposal.consultant_site,
        }} />
      ).toBlob()

      const safeName = proposal.school_name?.replace(/\s+/g, '_') || 'Aion'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `proposta-${safeName}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally { setGeneratingPdf(false) }
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F0F4F8' }}>
      <div className="text-center">
        <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" style={{ color: VM }} />
        <p className="text-sm text-gray-500">Carregando proposta…</p>
      </div>
    </div>
  )

  if (notFound) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F0F4F8' }}>
      <div className="text-center max-w-sm px-6">
        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Proposta não encontrada</h1>
        <p className="text-sm text-gray-500">O link pode ter expirado ou estar incorreto.</p>
        <a href="https://aionedu.com.br" className="mt-6 inline-block text-sm font-semibold hover:underline" style={{ color: VM }}>
          aionedu.com.br
        </a>
      </div>
    </div>
  )

  const p = proposal

  return (
    <div style={{ minHeight: '100vh', background: '#0a1f16' }}>
      {/* ── Action bar ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#001a12', borderBottom: '1px solid #0a3d28' }}>
        <div style={{ maxWidth: PW + 48, margin: '0 auto', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: 'rgba(255,255,255,0.95)', borderRadius: 10, padding: '5px 14px', display: 'inline-flex', alignItems: 'center' }}>
              <img src="/aion-logo-full.png" alt="ÁION EDU" style={{ height: 26, display: 'block' }} />
            </div>
            <div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#d0ede5' }}>Proposta Comercial</span>
              <span style={{ fontSize: 13, color: 'rgba(208,237,229,0.5)', marginLeft: 8 }}>— {p.school_name}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={copyLink}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'transparent', border: '1px solid #0a3d28', borderRadius: 8, color: 'rgba(208,237,229,0.7)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <Copy className="w-3.5 h-3.5" />
              {copied ? 'Copiado!' : 'Copiar link'}
            </button>

            {p.consultant_phone && (
              <a href={`https://wa.me/${p.consultant_phone.replace(/\D/g, '')}`}
                target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#25D366', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                <MessageCircle className="w-3.5 h-3.5" /> Falar com consultor
              </a>
            )}

            <button onClick={handleDownloadPdf} disabled={generatingPdf}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'linear-gradient(135deg,#00523C,#00A896)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: generatingPdf ? 0.7 : 1 }}>
              {generatingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {generatingPdf ? 'Gerando…' : 'Baixar PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Proposal pages ── */}
      <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div
          ref={previewRef}
          style={{ width: PW, boxShadow: '0 16px 64px rgba(0,0,0,0.6)', borderRadius: 4, overflow: 'hidden' }}
        >
          <ProposalContent data={{
            client_name:            p.client_name,
            school_name:            p.school_name,
            created_at:             p.created_at,
            implementation_normal:  p.implementation_normal,
            implementation_special: p.implementation_special,
            monthly_normal:         p.monthly_normal,
            monthly_special:        p.monthly_special,
            special_deadline:       p.special_deadline,
            validity_days:          p.validity_days,
            consultant_name:        p.consultant_name,
            consultant_phone:       p.consultant_phone,
            consultant_email:       p.consultant_email,
            consultant_site:        p.consultant_site,
          }} />
        </div>

        {/* ── Feedback ── */}
        <div style={{ width: PW, marginTop: 16 }}>
          {feedback ? (
            <div style={{ background: '#001a12', border: '1px solid #0a3d28', borderRadius: 20, padding: '36px 24px', textAlign: 'center' }}>
              {feedback === 'accepted' ? (
                <>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: '#00A896', marginBottom: 8 }}>Ótima decisão!</h3>
                  <p style={{ fontSize: 14, color: 'rgba(208,237,229,0.6)', marginBottom: 20 }}>
                    Seu consultor entrará em contato em breve para dar continuidade ao processo.
                  </p>
                  {p.consultant_phone && (
                    <a href={`https://wa.me/${p.consultant_phone.replace(/\D/g, '')}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: '#25D366', borderRadius: 12, color: '#fff', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
                      <MessageCircle className="w-4 h-4" /> Falar agora no WhatsApp
                    </a>
                  )}
                </>
              ) : (
                <>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>💭</div>
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: '#d0ede5', marginBottom: 8 }}>Tudo bem, sem pressa!</h3>
                  <p style={{ fontSize: 14, color: 'rgba(208,237,229,0.55)' }}>
                    Quando estiver pronto, fale com seu consultor. Estamos aqui para tirar todas as dúvidas.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div style={{ background: '#001a12', border: '1px solid #0a3d28', borderRadius: 20, padding: '32px 24px' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#d0ede5', textAlign: 'center', marginBottom: 8 }}>
                O que você achou da proposta?
              </h3>
              <p style={{ fontSize: 13, color: 'rgba(208,237,229,0.5)', textAlign: 'center', marginBottom: 24 }}>
                Sua resposta ajuda nosso time a te atender melhor
              </p>
              <div style={{ display: 'flex', gap: 14 }}>
                <button onClick={() => handleFeedback('accepted')} disabled={submitting}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '16px', background: '#002918', border: '2px solid #00A896', borderRadius: 14, color: '#00A896', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}>
                  <ThumbsUp className="w-5 h-5" /> Tenho interesse!
                </button>
                <button onClick={() => handleFeedback('thinking')} disabled={submitting}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '16px', background: 'transparent', border: '2px solid #0a3d28', borderRadius: 14, color: 'rgba(208,237,229,0.6)', fontWeight: 600, fontSize: 14, cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}>
                  <Clock className="w-5 h-5" /> Preciso de mais tempo
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
