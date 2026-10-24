// Botão ✨ "Melhorar com IA" do campo de mensagem. Só aparece com texto digitado.
// O resultado entra no lugar do texto, com "Desfazer". Nada é enviado sozinho.
import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, Sparkles, Undo2, Wand2 } from 'lucide-react'
import { improveText, type ImproveMode } from '../../lib/waAi'

const MODES: { mode: ImproveMode; label: string; hint: string }[] = [
  { mode: 'fix', label: 'Corrigir', hint: 'ortografia e pontuação' },
  { mode: 'warm', label: 'Mais cordial', hint: 'tom acolhedor' },
  { mode: 'short', label: 'Mais curta', hint: 'direto ao ponto' },
  { mode: 'persuade', label: 'Mais envolvente', hint: 'convida para a visita' },
]

export default function WaImproveButton({ text, institutionId, onApply, onError, compact }: {
  text: string; institutionId?: string | null
  onApply: (next: string) => void; onError: (msg: string) => void; compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [custom, setCustom] = useState('')
  const [undo, setUndo] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  useEffect(() => { if (!text) setUndo(null) }, [text])

  const run = async (mode: ImproveMode, instruction?: string) => {
    if (busy || text.trim().length < 3) return
    setBusy(true)
    const before = text
    try {
      const next = await improveText(before, mode, instruction, institutionId ?? undefined)
      setUndo(before); onApply(next); setOpen(false); setCustom('')
    } catch (e: any) { onError(e?.message || 'A IA não respondeu agora.') }
    finally { setBusy(false) }
  }

  const has = text.trim().length >= 3
  const size = compact ? 40 : 36
  return (
    <div ref={box} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4 }}>
      {undo !== null && !busy && (
        <button type="button" onClick={() => { onApply(undo); setUndo(null) }} title="Voltar ao texto anterior"
          style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid #E3E8F0', background: '#fff', borderRadius: 99, padding: '4px 10px', fontSize: 12, color: '#5B6B86', cursor: 'pointer', height: 30 }}>
          <Undo2 size={13} />Desfazer
        </button>
      )}
      <button type="button" aria-label="Melhorar com IA" title={has ? 'Melhorar com IA' : 'Escreva a mensagem para melhorar com IA'} onClick={() => has && setOpen(o => !o)}
        style={{ width: size, height: size, borderRadius: 12, border: `1px solid ${open ? '#05907B' : '#E3E8F0'}`, background: open ? '#F0FDFB' : '#fff', color: has ? '#00695F' : '#CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: has ? 'pointer' : 'default', transition: 'all .15s' }}>
        {busy ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
      </button>
      {open && (
        <div role="menu" style={{ position: 'absolute', bottom: size + 8, right: 0, width: 250, background: '#fff', border: '1px solid #E3E8F0', borderRadius: 14, padding: 6, boxShadow: '0 14px 32px -12px rgba(26,43,74,.35)', zIndex: 30 }}>
          <div style={{ padding: '6px 10px 4px', fontSize: 12, color: '#5B6B86', display: 'flex', alignItems: 'center', gap: 6 }}><Sparkles size={13} color="#05907B" />Melhorar com IA</div>
          {MODES.map(m => (
            <button key={m.mode} type="button" role="menuitem" disabled={busy} onClick={() => run(m.mode)}
              style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none', borderRadius: 9, padding: '8px 10px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F0FDFB')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A' }}>{m.label}</span>
              <span style={{ fontSize: 11, color: '#94A3B8' }}>{m.hint}</span>
            </button>
          ))}
          <div style={{ borderTop: '1px solid #EEF2F1', margin: '4px 0', padding: '6px 4px 2px', display: 'flex', gap: 6 }}>
            <input value={custom} onChange={e => setCustom(e.target.value)} maxLength={160} placeholder="Pedir algo: mais acolhedor…"
              onKeyDown={e => { if (e.key === 'Enter' && custom.trim()) run('custom', custom.trim()) }}
              style={{ flex: 1, minWidth: 0, border: '1px solid #E3E8F0', borderRadius: 9, padding: '6px 9px', fontSize: 16, outline: 'none' }} />
            <button type="button" disabled={busy || !custom.trim()} onClick={() => run('custom', custom.trim())} aria-label="Aplicar pedido"
              style={{ width: 34, border: 'none', borderRadius: 9, background: custom.trim() ? '#05907B' : '#E3E8F0', color: '#fff', cursor: custom.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
            </button>
          </div>
          <div style={{ padding: '2px 10px 6px', fontSize: 11, color: '#94A3B8', display: 'flex', gap: 5, alignItems: 'center' }}><Check size={11} />Você revisa antes de enviar.</div>
        </div>
      )}
    </div>
  )
}
