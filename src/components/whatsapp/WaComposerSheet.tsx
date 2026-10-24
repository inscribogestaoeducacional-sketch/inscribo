// Celular: botão "+" do campo de mensagem — junta anexar, respostas rápidas, emojis e IA numa folha só.
import { useState } from 'react'
import { Loader2, Paperclip, Smile, Sparkles, Zap, Check, Wand2 } from 'lucide-react'
import { BottomSheet } from '../mobile/MobileShell'
import { improveText, type ImproveMode } from '../../lib/waAi'

const MODES: { mode: ImproveMode; label: string; hint: string }[] = [
  { mode: 'fix', label: 'Corrigir', hint: 'ortografia e pontuação' },
  { mode: 'warm', label: 'Mais cordial', hint: 'tom acolhedor' },
  { mode: 'short', label: 'Mais curta', hint: 'direto ao ponto' },
  { mode: 'persuade', label: 'Mais envolvente', hint: 'convida para a visita' },
]

export default function WaComposerSheet({ open, onClose, text, institutionId, onApply, onError, onAttach, onQuick, onEmoji }: {
  open: boolean; onClose: () => void; text: string; institutionId?: string | null
  onApply: (t: string) => void; onError: (m: string) => void
  onAttach: () => void; onQuick: () => void; onEmoji: () => void
}) {
  const [ai, setAi] = useState(false)
  const [busy, setBusy] = useState(false)
  const [custom, setCustom] = useState('')
  const has = text.trim().length >= 3
  const run = async (mode: ImproveMode, instruction?: string) => {
    if (busy || !has) return
    setBusy(true)
    try { onApply(await improveText(text, mode, instruction, institutionId ?? undefined)); setAi(false); setCustom(''); onClose() }
    catch (e: any) { onError(e?.message || 'A IA não respondeu agora.') }
    finally { setBusy(false) }
  }
  const tile = (Icon: any, label: string, onPress: () => void, color: string, bg: string, disabled?: boolean, sub?: string) => (
    <button type="button" disabled={disabled} onClick={onPress} className="aion-tap"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: 'none', background: 'none', fontFamily: 'inherit', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? .45 : 1, padding: 0 }}>
      <span style={{ width: 56, height: 56, borderRadius: 18, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={24} color={color} /></span>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1A2B4A' }}>{label}</span>
      {sub && <span style={{ fontSize: 10.5, color: '#94A3B8', marginTop: -4 }}>{sub}</span>}
    </button>
  )
  return (
    <BottomSheet open={open} onClose={() => { setAi(false); onClose() }} label="Mais opções da mensagem">
      <div style={{ padding: '4px 20px calc(22px + env(safe-area-inset-bottom))', overflowY: 'auto' }}>
        {!ai ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, padding: '10px 0 4px' }}>
            {tile(Paperclip, 'Anexar', () => { onClose(); onAttach() }, '#05907B', '#E6F7F5')}
            {tile(Zap, 'Respostas', () => { onClose(); onQuick() }, '#B45309', '#FEF3C7')}
            {tile(Smile, 'Emojis', () => { onClose(); onEmoji() }, '#B45309', '#FFF7ED')}
            {tile(Sparkles, 'Melhorar', () => setAi(true), '#00695F', '#E6F7F5', !has, !has ? 'escreva antes' : 'com IA')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 6 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#1A2B4A', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}><Sparkles size={16} color="#05907B" />Melhorar com IA</div>
            {MODES.map(m => (
              <button key={m.mode} type="button" disabled={busy} onClick={() => run(m.mode)} className="aion-tap"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #E3E8F0', background: '#fff', borderRadius: 14, padding: '12px 14px', fontFamily: 'inherit', cursor: 'pointer' }}>
                <span style={{ fontSize: 14.5, fontWeight: 700, color: '#1A2B4A' }}>{m.label}</span>
                <span style={{ fontSize: 12, color: '#94A3B8' }}>{m.hint}</span>
              </button>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <input value={custom} onChange={e => setCustom(e.target.value)} maxLength={160} placeholder="Pedir algo: mais acolhedor…"
                style={{ flex: 1, minWidth: 0, border: '1px solid #E3E8F0', borderRadius: 12, padding: '11px 12px', fontSize: 16, outline: 'none', fontFamily: 'inherit' }} />
              <button type="button" disabled={busy || !custom.trim()} onClick={() => run('custom', custom.trim())} aria-label="Aplicar pedido"
                style={{ width: 46, border: 'none', borderRadius: 12, background: custom.trim() ? '#05907B' : '#E3E8F0', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: '#94A3B8', display: 'flex', gap: 5, alignItems: 'center', marginTop: 2 }}><Check size={12} />Você revisa antes de enviar.</div>
            <button type="button" onClick={() => setAi(false)} style={{ border: 'none', background: 'none', color: '#05907B', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', marginTop: 4 }}>← Voltar</button>
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
