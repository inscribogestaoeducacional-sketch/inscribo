// Aba "Resultados" da Caixa Áion: o que cada campanha rendeu (transmissões em massa e keywords/QR codes).
// Fonte: RPC aion_campaign_results (resposta = 1ª mensagem do contato em até 7 dias após o envio).
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Radio, QrCode, Send, MessageCircle, UserPlus } from 'lucide-react'

type Row = { kind: 'broadcast' | 'keyword'; id: string; name: string; at: string; status: string; total: number; sent: number; failed: number; delivered: number; read: number; replied: number; leads: number }

const STATUS: Record<string, string> = { completed: 'Concluída', sending: 'Enviando', scheduled: 'Agendada', paused: 'Pausada', draft: 'Rascunho', active: 'Ativa', inactive: 'Inativa', failed: 'Falhou', cancelled: 'Cancelada' }
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 1000) / 10}%`.replace('.', ',') : '—')
const fmtDate = (s: string) => new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

export default function AionCampaignResults() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    supabase.rpc('aion_campaign_results').then(({ data, error }) => {
      if (error) setErr('Não foi possível carregar os resultados. Se aparecer "function does not exist", falta rodar o SQL de campanhas.')
      else setRows((data as Row[]) ?? [])
    })
  }, [])

  const bc = useMemo(() => (rows ?? []).filter(r => r.kind === 'broadcast'), [rows])
  const kw = useMemo(() => (rows ?? []).filter(r => r.kind === 'keyword'), [rows])
  const tot = useMemo(() => ({
    sent: bc.reduce((a, r) => a + r.sent, 0), replied: bc.reduce((a, r) => a + r.replied, 0),
    failed: bc.reduce((a, r) => a + r.failed, 0),
    hits: kw.reduce((a, r) => a + r.replied, 0), leads: kw.reduce((a, r) => a + r.leads, 0),
  }), [bc, kw])

  const card = (Icon: React.ElementType, label: string, value: string, sub: string, color: string) => (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: '#5B6B86' }}>
        <span style={{ width: 28, height: 28, borderRadius: 9, background: color + '1A', color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={15} /></span>{label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#1A2B4A', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#64748B' }}>{sub}</div>
    </div>
  )
  const th: React.CSSProperties = { textAlign: 'right', fontSize: 11.5, fontWeight: 700, color: '#64748B', padding: '8px 10px', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { textAlign: 'right', fontSize: 13, color: '#1A2B4A', padding: '10px', whiteSpace: 'nowrap', borderTop: '1px solid #EEF2F6' }
  const nameTd: React.CSSProperties = { ...td, textAlign: 'left', whiteSpace: 'normal', minWidth: 160 }

  if (err) return <div style={{ padding: 24, color: '#B91C1C', fontSize: 14 }}>{err}</div>
  if (!rows) return <div style={{ padding: 24, color: '#64748B', fontSize: 14 }}>Carregando resultados…</div>

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1100 }}>
      <div>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#1A2B4A' }}>Resultados das campanhas</div>
        <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>Resposta = o contato escreveu em até 7 dias depois do envio.</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {card(Send, 'Mensagens enviadas', tot.sent.toLocaleString('pt-BR'), `${bc.length} transmiss${bc.length === 1 ? 'ão' : 'ões'}`, '#2a78d6')}
        {card(MessageCircle, 'Responderam', tot.replied.toLocaleString('pt-BR'), `${pct(tot.replied, tot.sent)} de quem recebeu`, '#1baf7a')}
        {card(QrCode, 'Entradas por keyword', tot.hits.toLocaleString('pt-BR'), `${kw.length} keyword${kw.length === 1 ? '' : 's'} cadastrada${kw.length === 1 ? '' : 's'}`, '#6250d6')}
        {card(UserPlus, 'Conversas de keyword', tot.leads.toLocaleString('pt-BR'), 'origem registrada na conversa', '#eb6834')}
      </div>

      <section style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', fontSize: 14, fontWeight: 700, color: '#1A2B4A' }}><Radio size={16} color="#05907B" />Transmissões</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={{ ...th, textAlign: 'left' }}>Campanha</th><th style={th}>Data</th><th style={th}>Situação</th><th style={th}>Destinatários</th><th style={th}>Enviadas</th><th style={th}>Falhas</th><th style={th}>Responderam</th><th style={th}>Taxa de resposta</th></tr></thead>
            <tbody>
              {bc.length === 0 && <tr><td style={{ ...nameTd, color: '#64748B' }} colSpan={8}>Nenhuma transmissão ainda. Crie na aba Transmissão.</td></tr>}
              {bc.map(r => (
                <tr key={r.id}>
                  <td style={{ ...nameTd, fontWeight: 600 }}>{r.name}</td><td style={td}>{fmtDate(r.at)}</td><td style={td}>{STATUS[r.status] ?? r.status}</td>
                  <td style={td}>{r.total}</td><td style={td}>{r.sent}</td><td style={{ ...td, color: r.failed ? '#B91C1C' : undefined }}>{r.failed}</td>
                  <td style={td}>{r.replied}</td><td style={{ ...td, fontWeight: 700, color: '#047857' }}>{pct(r.replied, r.sent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', fontSize: 14, fontWeight: 700, color: '#1A2B4A' }}><QrCode size={16} color="#05907B" />Keywords e QR codes</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={{ ...th, textAlign: 'left' }}>Campanha</th><th style={th}>Criada em</th><th style={th}>Situação</th><th style={th}>Entradas</th><th style={th}>Conversas</th></tr></thead>
            <tbody>
              {kw.length === 0 && <tr><td style={{ ...nameTd, color: '#64748B' }} colSpan={5}>Nenhuma keyword cadastrada.</td></tr>}
              {kw.map(r => (
                <tr key={r.id}><td style={{ ...nameTd, fontWeight: 600 }}>{r.name}</td><td style={td}>{fmtDate(r.at)}</td><td style={td}>{STATUS[r.status] ?? r.status}</td><td style={td}>{r.replied}</td><td style={td}>{r.leads}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div style={{ fontSize: 12, color: '#94A3B8' }}>A Meta ainda não devolve "entregue" e "lida" para as transmissões da Áion; por isso essas colunas não aparecem.</div>
    </div>
  )
}
