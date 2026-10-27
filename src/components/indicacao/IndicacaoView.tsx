// Painel de indicação dentro da Áion Edu (todo usuário vê): vantagens, formulário e acompanhamento.
import { useState } from 'react'
import { Gift, Users, CheckCircle2, Wallet, Clock, Plus, Send, X, Sparkles } from 'lucide-react'
import PageHeader from '../ui/PageHeader'
import StatStrip from '../mobile/StatStrip'
import { BRAND, SHADOW } from '../../lib/brand'
import { type Indicacao, STATUS_INFO, brl, dataCurta } from './types'

export const Pill = ({ s }: { s: keyof typeof STATUS_INFO }) => {
  const i = STATUS_INFO[s]
  return <span style={{ fontSize: 11.5, fontWeight: 800, color: i.cor, background: i.fundo, borderRadius: 999, padding: '4px 10px', whiteSpace: 'nowrap' }}>{i.label}</span>
}

const inp: React.CSSProperties = { width: '100%', minHeight: 46, padding: '10px 14px', borderRadius: 12, border: `1.5px solid ${BRAND.line}`, fontFamily: 'inherit', fontSize: 15, color: BRAND.ink, background: '#fff', boxSizing: 'border-box' }
const lab: React.CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 800, color: BRAND.ink, margin: '0 0 6px' }

export function IndicarForm({ premio, onClose, onSend }: { premio: number; onClose: () => void; onSend?: (v: { gestor_nome: string; gestor_whatsapp: string; escola_nome: string; gestor_email: string }) => void }) {
  const [v, setV] = useState({ gestor_nome: '', gestor_whatsapp: '', escola_nome: '', gestor_email: '' })
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value })
  const ok = v.gestor_nome.trim() && v.escola_nome.trim() && v.gestor_whatsapp.replace(/\D/g, '').length >= 10
  return (
    <div style={{ background: '#fff', borderRadius: 20, border: `1.5px solid ${BRAND.line}`, boxShadow: SHADOW, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: BRAND.ink }}>Indicar uma escola</div>
          <div style={{ fontSize: 13, color: BRAND.muted, marginTop: 2 }}>Prêmio de {brl(premio)} quando a escola pagar a implantação.</div>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar" style={{ width: 38, height: 38, borderRadius: 12, border: `1px solid ${BRAND.line}`, background: '#fff', color: BRAND.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={18} /></button>
      </div>
      <div><label style={lab}>Nome do gestor</label><input style={inp} value={v.gestor_nome} onChange={set('gestor_nome')} placeholder="Ex.: Ana Souza" /></div>
      <div><label style={lab}>WhatsApp do gestor</label><input style={inp} inputMode="tel" value={v.gestor_whatsapp} onChange={set('gestor_whatsapp')} placeholder="(83) 99999-9999" /></div>
      <div><label style={lab}>Nome da escola</label><input style={inp} value={v.escola_nome} onChange={set('escola_nome')} placeholder="Ex.: Colégio Novo Horizonte" /></div>
      <div><label style={lab}>E-mail do gestor <span style={{ fontWeight: 600, color: BRAND.faint }}>(se tiver)</span></label><input style={inp} inputMode="email" value={v.gestor_email} onChange={set('gestor_email')} placeholder="gestor@escola.com.br" /></div>
      <button type="button" disabled={!ok} onClick={() => onSend?.(v)} style={{ minHeight: 48, borderRadius: 14, border: 'none', background: ok ? 'var(--aion-grad)' : '#CBD5E1', color: '#fff', fontWeight: 800, fontSize: 15, fontFamily: 'inherit', cursor: ok ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: ok ? '0 8px 18px -12px rgba(0,122,110,.8)' : 'none' }}><Send size={16} />Enviar indicação</button>
      <div style={{ fontSize: 12, color: BRAND.muted, lineHeight: 1.45 }}>Nossa equipe fala com o gestor e conta que foi você quem indicou. Se ele já estava em contato com a Áion, a indicação não vale.</div>
    </div>
  )
}

export default function IndicacaoView({ premio, lista, abrirForm = false, onNova, onSend }: { premio: number; lista: Indicacao[]; abrirForm?: boolean; onNova?: () => void; onSend?: (v: any) => void }) {
  const [form, setForm] = useState(abrirForm)
  const validas = lista.filter(i => i.status !== 'ja_no_crm' && i.status !== 'nao_fechou')
  const fecharam = lista.filter(i => i.status === 'fechou' || i.status === 'pago').length
  const aReceber = lista.filter(i => i.status === 'fechou').reduce((s, i) => s + i.premio, 0)
  const recebido = lista.filter(i => i.status === 'pago').reduce((s, i) => s + i.premio, 0)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 0 24px' }}>
      <PageHeader icon={Gift} title="Indique e ganhe" subtitle={`${brl(premio)} para cada escola que contratar a Áion Edu`}
        actions={<button type="button" onClick={() => { setForm(true); onNova?.() }} style={{ minHeight: 42, padding: '0 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,.4)', background: 'rgba(255,255,255,.18)', color: '#fff', fontWeight: 800, fontSize: 14, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><Plus size={17} />Nova indicação</button>} />
      <StatStrip items={[
        { label: 'Indicações', value: validas.length, sub: 'em andamento ou fechadas', color: '#05907B', icon: Users },
        { label: 'Escolas que fecharam', value: fecharam, sub: 'contrataram a Áion Edu', color: '#2563EB', icon: CheckCircle2 },
        { label: 'A receber', value: brl(aReceber), sub: 'liberado após a implantação', color: '#B45309', icon: Clock },
        { label: 'Já recebido', value: brl(recebido), sub: 'pago por Pix', color: '#15803D', icon: Wallet },
      ]} />
      {form && <IndicarForm premio={premio} onClose={() => setForm(false)} onSend={onSend} />}
      <div style={{ background: BRAND.softer, border: `1.5px solid ${BRAND.softLine}`, borderRadius: 20, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800, color: BRAND.ink, marginBottom: 12 }}><Sparkles size={18} color={BRAND.primary} />Como funciona</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>
          {[['Você indica', 'Informe o nome e o WhatsApp do gestor de uma escola que ainda não usa a Áion Edu.'], ['Nós falamos com ele', 'Nossa equipe faz o contato e conta que foi você quem indicou.'], ['Você ganha', `Quando a escola pagar a implantação, você recebe ${brl(premio)} por Pix.`]].map(([t, d], i) => (
            <div key={t} style={{ display: 'flex', gap: 12 }}>
              <span style={{ width: 30, height: 30, borderRadius: 10, background: 'var(--aion-grad)', color: '#fff', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
              <div><div style={{ fontWeight: 800, fontSize: 14, color: BRAND.ink }}>{t}</div><div style={{ fontSize: 13, color: BRAND.muted, lineHeight: 1.45, marginTop: 2 }}>{d}</div></div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: BRAND.ink, marginTop: 4 }}>Suas indicações</div>
      {lista.length === 0 ? (
        <div style={{ background: '#fff', border: `1.5px dashed ${BRAND.line}`, borderRadius: 18, padding: 24, textAlign: 'center', color: BRAND.muted, fontSize: 14 }}>Você ainda não indicou nenhuma escola. Toque em Nova indicação para começar.</div>
      ) : lista.map(i => (
        <div key={i.id} style={{ background: '#fff', border: `1.5px solid ${BRAND.line}`, borderRadius: 18, padding: '14px 16px', boxShadow: SHADOW, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15.5, color: BRAND.ink }}>{i.escola_nome}</div>
              <div style={{ fontSize: 13, color: BRAND.muted, marginTop: 2 }}>Gestor: {i.gestor_nome} · indicada em {dataCurta(i.created_at)}</div>
            </div>
            <Pill s={i.status} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, color: BRAND.muted }}>{STATUS_INFO[i.status].dica}</span>
            {i.status !== 'ja_no_crm' && i.status !== 'nao_fechou' && <span style={{ fontWeight: 800, color: i.status === 'pago' ? '#15803D' : BRAND.ink, fontSize: 15 }}>{brl(i.premio)}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
