// Tela da equipe Áion: todas as indicações, mensagem de WhatsApp pronta, fechou/pago e valor do prêmio.
import { useState } from 'react'
import { Gift, Users, CheckCircle2, Wallet, Clock } from 'lucide-react'
import PageHeader from '../ui/PageHeader'
import StatStrip from '../mobile/StatStrip'
import { PillTabs } from '../mobile/PillTabs'
import { BRAND, SHADOW } from '../../lib/brand'
import { type Indicacao, type IndStatus, brl, dataCurta, MSG_PADRAO } from './types'
import { Pill } from './IndicacaoView'

export const zapLink = (i: Indicacao, msg: string) => {
  const t = msg.replace(/{gestor}/g, i.gestor_nome.split(' ')[0]).replace(/{indicador}/g, i.indicador_nome || '').replace(/{escola_indicador}/g, i.indicador_escola || '')
  const n = i.gestor_whatsapp.replace(/\D/g, '')
  return `https://wa.me/${n.startsWith('55') ? n : '55' + n}?text=${encodeURIComponent(t)}`
}
const btn = (kind: 'zap' | 'ok' | 'ghost'): React.CSSProperties => ({ minHeight: 40, padding: '0 14px', borderRadius: 12, fontFamily: 'inherit', fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, textDecoration: 'none',
  border: kind === 'ghost' ? `1px solid ${BRAND.line}` : 'none', background: kind === 'zap' ? '#16A34A' : kind === 'ok' ? 'var(--aion-grad)' : '#fff', color: kind === 'ghost' ? BRAND.ink : '#fff' })

export default function IndicacoesAdminView({ premio, msg, lista, onStatus, onSave }: { premio: number; msg: string; lista: Indicacao[]; onStatus?: (id: string, s: IndStatus) => void; onSave?: (premio: number, msg: string) => void }) {
  const [aba, setAba] = useState('todas')
  const [valor, setValor] = useState(String(premio))
  const [texto, setTexto] = useState(msg)
  const vis = lista.filter(i => aba === 'todas' || (aba === 'novas' ? i.status === 'indicado' : aba === 'andamento' ? i.status === 'em_contato' : aba === 'pagar' ? i.status === 'fechou' : i.status === 'pago'))
  const aPagar = lista.filter(i => i.status === 'fechou').reduce((s, i) => s + i.premio, 0)
  const pago = lista.filter(i => i.status === 'pago').reduce((s, i) => s + i.premio, 0)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 0 24px' }}>
      <PageHeader icon={Gift} title="Indicações" subtitle="Quem indicou, quem fechou e quanto falta pagar" />
      <StatStrip items={[
        { label: 'Novas', value: lista.filter(i => i.status === 'indicado').length, sub: 'ainda sem contato', color: '#2563EB', icon: Users, alert: lista.some(i => i.status === 'indicado') },
        { label: 'Em contato', value: lista.filter(i => i.status === 'em_contato').length, sub: 'em conversa', color: '#B45309', icon: Clock },
        { label: 'A pagar', value: brl(aPagar), sub: 'escolas que fecharam', color: '#05907B', icon: CheckCircle2 },
        { label: 'Já pago', value: brl(pago), sub: 'prêmios por Pix', color: '#15803D', icon: Wallet },
      ]} />
      <div style={{ background: '#fff', border: `1.5px solid ${BRAND.line}`, borderRadius: 20, padding: 18, boxShadow: SHADOW, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: BRAND.ink }}>Campanha</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '0 0 170px' }}>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Prêmio por escola (R$)</label>
            <input value={valor} onChange={e => setValor(e.target.value)} inputMode="numeric" style={{ width: '100%', minHeight: 46, padding: '10px 14px', borderRadius: 12, border: `1.5px solid ${BRAND.line}`, fontFamily: 'inherit', fontSize: 16, fontWeight: 800, color: BRAND.ink, boxSizing: 'border-box' }} />
          </div>
          <div style={{ fontSize: 12.5, color: BRAND.muted, flex: '1 1 220px', lineHeight: 1.45 }}>O mesmo valor para todos. Mudar aqui vale só para as próximas indicações; as que já foram feitas mantêm o valor prometido.</div>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Mensagem de WhatsApp para o gestor</label>
          <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={4} style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: `1.5px solid ${BRAND.line}`, fontFamily: 'inherit', fontSize: 14, color: BRAND.ink, lineHeight: 1.5, boxSizing: 'border-box', resize: 'vertical' }} />
          <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 6 }}>Use {'{gestor}'}, {'{indicador}'} e {'{escola_indicador}'}: o sistema troca pelos nomes de cada indicação.</div>
        </div>
        <div><button type="button" style={btn('ok')} onClick={() => onSave?.(Number(String(valor).replace(/\D/g, '')) || 0, texto)}>Salvar campanha</button></div>
      </div>
      <PillTabs tabs={[['todas', `Todas (${lista.length})`], ['novas', 'Novas'], ['andamento', 'Em contato'], ['pagar', 'A pagar'], ['pagas', 'Pagas']]} value={aba} onChange={setAba} />
      {vis.map(i => (
        <div key={i.id} style={{ background: '#fff', border: `1.5px solid ${BRAND.line}`, borderRadius: 18, padding: '14px 16px', boxShadow: SHADOW, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15.5, color: BRAND.ink }}>{i.escola_nome}</div>
              <div style={{ fontSize: 13, color: BRAND.muted, marginTop: 2 }}>Gestor: {i.gestor_nome} · {i.gestor_whatsapp}{i.gestor_email ? ` · ${i.gestor_email}` : ''}</div>
              <div style={{ fontSize: 13, color: BRAND.ink, marginTop: 4 }}>Indicado por <b>{i.indicador_nome}</b> ({i.indicador_escola}) em {dataCurta(i.created_at)} · prêmio {brl(i.premio)}</div>
            </div>
            <Pill s={i.status} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href={zapLink(i, texto)} target="_blank" rel="noreferrer" style={btn('zap')}>Enviar no WhatsApp</a>
            {i.status === 'indicado' && <button type="button" style={btn('ghost')} onClick={() => onStatus?.(i.id, 'em_contato')}>Marcar em contato</button>}
            {i.status === 'em_contato' && <button type="button" style={btn('ok')} onClick={() => onStatus?.(i.id, 'fechou')}>Marcar fechou</button>}
            {i.status === 'fechou' && <button type="button" style={btn('ok')} onClick={() => onStatus?.(i.id, 'pago')}>Marcar prêmio pago</button>}
            {(i.status === 'indicado' || i.status === 'em_contato') && <button type="button" style={btn('ghost')} onClick={() => onStatus?.(i.id, 'nao_fechou')}>Não fechou</button>}
          </div>
        </div>
      ))}
    </div>
  )
}
