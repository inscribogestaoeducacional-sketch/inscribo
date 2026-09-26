// =============================================================================
// src/pages/gestor/Transmissoes.tsx
//
// Módulo "Transmissões": campanhas de disparo em massa pelo WhatsApp com
// template aprovado pela Meta. Três abas: Campanhas (lista + detalhe +
// assistente de criação), Templates (da escola + padrão da Áion) e "Não
// recebem" (lista de supressão). Toda escrita de campanha passa pela Edge
// Function broadcast-campaigns; aqui só se lê (RLS) e se chama o backend.
// Visual segue CaptacaoInteligente.tsx.
// =============================================================================
import React, { useEffect, useState } from 'react'
import { Send, Plus, Wallet, Radio, AlertTriangle, RefreshCw } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { CAMPAIGN_STATUS, brl, type Campaign } from '../../lib/broadcasts'
import { Badge, Btn, Empty, KpiCard, cardStyle } from '../../components/transmissoes/ui'
import TemplatesPanel from '../../components/transmissoes/TemplatesPanel'
import SuppressionPanel from '../../components/transmissoes/SuppressionPanel'
import CampaignWizard from '../../components/transmissoes/CampaignWizard'
import CampaignDetail from '../../components/transmissoes/CampaignDetail'

type Tab = 'campaigns' | 'templates' | 'suppressions'

export default function Transmissoes() {
  const { user } = useAuth()
  const institutionId = user?.institution_id || ''

  const [tab, setTab] = useState<Tab>('campaigns')
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [limits, setLimits] = useState<{ hourly: number; daily: number } | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [credit, setCredit] = useState(0)
  const [loading, setLoading] = useState(true)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  async function load() {
    if (!institutionId) return
    const [setRes, campRes, ledRes] = await Promise.all([
      supabase.from('broadcast_settings').select('enabled, hourly_limit, daily_limit').eq('institution_id', institutionId).maybeSingle(),
      supabase.from('broadcast_campaigns').select('*').eq('institution_id', institutionId).order('created_at', { ascending: false }).limit(200),
      supabase.from('broadcast_credit_ledger').select('amount_brl').eq('institution_id', institutionId),
    ])
    const s = setRes.data as any
    setEnabled(!!s?.enabled)
    setLimits(s ? { hourly: s.hourly_limit, daily: s.daily_limit } : null)
    setCampaigns((campRes.data || []) as Campaign[])
    setCredit(((ledRes.data || []) as any[]).reduce((acc, r) => acc + Number(r.amount_brl), 0))
    setLoading(false)
  }

  useEffect(() => { load() }, [institutionId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Enquanto houver campanha andando, atualiza a lista sozinha.
  const active = campaigns.some(c => ['sending', 'scheduled', 'pending_payment'].includes(c.status))
  useEffect(() => {
    if (!active) return
    const t = setInterval(load, 20_000)
    return () => clearInterval(t)
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

  const sendingNow = campaigns.filter(c => c.status === 'sending').length

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24, minHeight: '100%', background: '#f8f9fb' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Send size={18} color="#0284C7" />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Transmissões</h1>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b', paddingLeft: 46 }}>
            Campanhas pelo WhatsApp pra sua base, com template aprovado pela Meta
          </p>
        </div>
        {enabled && tab === 'campaigns' && <Btn onClick={() => setWizardOpen(true)}><Plus size={15} /> Nova campanha</Btn>}
      </div>

      {/* Sem o módulo liberado: só o aviso (quem digitar a URL não chega às
          abas nem cria template — o menu já nem aparece, ver Sidebar). */}
      {enabled === false && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 14, padding: '14px 18px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <AlertTriangle size={18} color="#B45309" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, color: '#78350F', lineHeight: 1.6 }}>
            <strong>Transmissões ainda não está liberado pra sua escola.</strong><br />
            Fale com a equipe da Áion pra saber quando estará disponível.
          </div>
        </div>
      )}

      {enabled && <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <KpiCard label="Crédito disponível" value={brl(credit)} hint="Mensagens pagas que não saíram" icon={<Wallet size={16} color="#047857" />} bg="#D1FAE5" />
        <KpiCard label="Enviando agora" value={String(sendingNow)} hint={limits ? `Limite: ${limits.hourly}/hora · ${limits.daily}/dia` : undefined} icon={<Radio size={16} color="#0284C7" />} bg="#E0F2FE" />
        <KpiCard label="Campanhas" value={String(campaigns.length)} icon={<Send size={16} color="#1e2d6b" />} bg="#E0E7FF" />
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 10, padding: 4, width: 'fit-content', flexWrap: 'wrap' }}>
        {([
          { key: 'campaigns' as const,    label: 'Campanhas' },
          { key: 'templates' as const,    label: 'Templates' },
          { key: 'suppressions' as const, label: 'Não recebem' },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '6px 18px', borderRadius: 7, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: tab === t.key ? '#fff' : 'transparent', color: tab === t.key ? '#1e2d6b' : '#64748b',
            boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'campaigns' && (
        <div style={cardStyle}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Campanhas</h3>
            <Btn variant="ghost" onClick={load}><RefreshCw size={14} /> Atualizar</Btn>
          </div>
          {loading ? (
            <div style={{ padding: 20 }}>{[...Array(3)].map((_, i) => <div key={i} style={{ height: 52, borderRadius: 10, background: '#f8fafc', marginBottom: 10 }} className="animate-pulse" />)}</div>
          ) : campaigns.length === 0 ? (
            <Empty icon={<Send size={24} color="#0284C7" />} title="Nenhuma campanha ainda"
              text="Escolha um template aprovado, filtre o público (etiqueta, turma, campanha anterior ou lista importada), veja o custo e envie."
              action={enabled ? <Btn onClick={() => setWizardOpen(true)}><Plus size={14} /> Criar primeira campanha</Btn> : undefined} />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: '#f8fafc' }}>
                  {['Campanha', 'Status', 'Progresso', 'Respostas', 'Custo', 'Criada'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#94a3b8', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {campaigns.map((c, idx) => {
                    const st = CAMPAIGN_STATUS[c.status]
                    const done = c.sent_count + c.failed_count
                    const progress = c.total_recipients ? Math.round((done / c.total_recipients) * 100) : 0
                    return (
                      <tr key={c.id} onClick={() => setDetailId(c.id)} style={{ borderTop: '1px solid #f1f5f9', background: idx % 2 ? '#fafafa' : '#fff', cursor: 'pointer' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{c.template_name}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}><Badge label={st.label} color={st.color} bg={st.bg} /></td>
                        <td style={{ padding: '12px 16px', minWidth: 140 }}>
                          <div style={{ height: 6, borderRadius: 999, background: '#f1f5f9', overflow: 'hidden' }}>
                            <div style={{ width: `${progress}%`, height: '100%', background: '#00A896' }} />
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{c.sent_count.toLocaleString('pt-BR')} de {c.total_recipients.toLocaleString('pt-BR')} enviadas</div>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: '#1e293b' }}>{c.replied_count.toLocaleString('pt-BR')}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: '#1e293b', whiteSpace: 'nowrap' }}>
                          {c.priced_at ? (Number(c.total_charged_brl) > 0 ? brl(c.total_charged_brl) : 'Crédito') : '—'}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'templates' && institutionId && <TemplatesPanel institutionId={institutionId} />}
      {tab === 'suppressions' && institutionId && user && <SuppressionPanel institutionId={institutionId} userId={user.id} />}

      {wizardOpen && (
        <CampaignWizard institutionId={institutionId} onClose={() => setWizardOpen(false)}
          onCreated={id => { setWizardOpen(false); load(); setDetailId(id) }} />
      )}
      {detailId && <CampaignDetail campaignId={detailId} onClose={() => setDetailId(null)} onChanged={load} />}
      </>}
    </div>
  )
}
