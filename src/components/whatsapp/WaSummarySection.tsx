// Seção "Resumo da conversa" da ficha do contato: a IA só é chamada quando a
// pessoa clica, e o resumo fica guardado até chegar mensagem nova.
import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Copy, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { summarizeConversation } from '../../lib/waAi'

export default function WaSummarySection({ conversationId, institutionId, initial, onError }: {
  conversationId: string; institutionId?: string | null; initial?: string | null; onError: (m: string) => void
}) {
  const [open, setOpen] = useState(true)
  const [text, setText] = useState<string | null>(initial ?? null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  useEffect(() => { setText(initial ?? null); setCopied(false) }, [conversationId, initial])

  const run = async () => {
    if (busy) return
    setBusy(true)
    try { setText(await summarizeConversation(conversationId, institutionId ?? undefined)) }
    catch (e: any) { onError(e?.message || 'A IA não respondeu agora.') }
    finally { setBusy(false) }
  }
  const copy = async () => {
    if (!text) return
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { onError('Não consegui copiar o texto.') }
  }

  return (
    <div style={{ borderBottom: '1px solid #e2f5f3' }}>
      <button onClick={() => setOpen(v => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fefd', border: 'none', cursor: 'pointer' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}><Sparkles size={12} />Resumo da conversa</span>
        {open ? <ChevronDown size={14} color="#0d9488" /> : <ChevronRight size={14} color="#0d9488" />}
      </button>
      {open && (
        <div style={{ padding: '0 12px 12px' }}>
          {text ? (
            <div style={{ background: 'linear-gradient(135deg,#F0FDFB,#EEF2FF)', border: '1px solid #CCFBF1', borderRadius: 12, padding: '10px 11px', fontSize: 12.5, lineHeight: 1.55, color: '#1A2B4A' }}>
              {text}
              <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                <button onClick={run} disabled={busy} style={{ border: '1px solid #E3E8F0', background: '#fff', borderRadius: 8, padding: '3px 9px', fontSize: 11.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: '#5B6B86' }}>
                  {busy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}Atualizar
                </button>
                <button onClick={copy} style={{ border: '1px solid #E3E8F0', background: '#fff', borderRadius: 8, padding: '3px 9px', fontSize: 11.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: '#5B6B86' }}>
                  <Copy size={12} />{copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={run} disabled={busy} style={{ width: '100%', border: '1px dashed #99F6E4', background: '#F0FDFB', color: '#007A6E', borderRadius: 10, padding: '9px 0', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}{busy ? 'Resumindo...' : 'Resumir com IA'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
