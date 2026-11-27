// Escaneamento ao vivo: abre a câmera, reconhece a folha (cartão-resposta ou redação) pelos 4 quadrados e pelo QR code,
// confirma com duas leituras iguais seguidas, salva sozinho e já espera a próxima folha.
import { useEffect, useRef, useState } from 'react'
import { X, Loader2, Check, AlertTriangle, PenLine, XCircle, ScanLine } from 'lucide-react'

export type Parsed = { kind: 'fail'; msg: string } | { kind: 'card' | 'essay'; number: number; name: string; sig: string; payload: any }
export type Outcome = { kind: 'ok' | 'review' | 'essay' | 'fail'; msg?: string; flags?: number; hits?: number; total?: number }

type Item = { key: number; name: string; text: string; tone: 'ok' | 'warn' | 'bad' }
type Card = { key: number; tone: 'ok' | 'warn' | 'bad'; icon: 'ok' | 'review' | 'essay' | 'fail'; title: string; name: string; sub: string }
const MAX_SIDE = 2560

function beep(ok: boolean) {
  try {
    const A = window.AudioContext || (window as any).webkitAudioContext; const ac = new A(); const o = ac.createOscillator(); const g = ac.createGain()
    o.frequency.value = ok ? 880 : 300; g.gain.value = 0.15; o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + (ok ? 0.12 : 0.25)); setTimeout(() => ac.close(), 400)
  } catch { /* sem som: tudo bem */ }
  try { navigator.vibrate?.(ok ? 60 : [80, 60, 80]) } catch { /* idem */ }
}

export default function CorrecaoCamera({ read, commit, onClose }: { read: (img: ImageData) => Promise<Parsed>; commit: (p: Parsed) => Promise<Outcome>; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const readRef = useRef(read); readRef.current = read
  const commitRef = useRef(commit); commitRef.current = commit
  const [status, setStatus] = useState('Abrindo a câmera…')
  const [tone, setTone] = useState<'idle' | 'ok' | 'warn' | 'bad'>('idle')
  const [err, setErr] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [card, setCard] = useState<Card | null>(null)
  const [count, setCount] = useState({ ok: 0, review: 0, essay: 0, fail: 0 })
  const [seen, setSeen] = useState<string | null>(null)   // chave da folha já lida que está na frente da câmera
  const rereadRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    let alive = true; let stream: MediaStream | null = null; let timer: any; let wake: any = null
    const done = new Map<string, string>() // "C12" -> assinatura já salva
    let last = ''; let misses = 0; let n = 0
    const canvas = document.createElement('canvas')
    const say = (t: string, k: 'idle' | 'ok' | 'warn' | 'bad' = 'idle') => { setStatus(t); setTone(k) }
    let cardTimer: any
    const push = (name: string, text: string, k: Item['tone']) => setItems(l => [{ key: ++n, name, text, tone: k }, ...l].slice(0, 5))
    const show = (c: Omit<Card, 'key'>) => { setCard({ ...c, key: ++n }); clearTimeout(cardTimer); cardTimer = setTimeout(() => alive && setCard(null), 3500) }

    let seenKey: string | null = null
    rereadRef.current = () => { if (seenKey) done.delete(seenKey); seenKey = null; last = ''; setSeen(null); say('Segure a folha firme para ler de novo.') }
    const tick = async () => {
      if (!alive) return
      const v = videoRef.current
      if (v && v.readyState >= 2 && v.videoWidth) {
        const sc = Math.min(1, MAX_SIDE / Math.max(v.videoWidth, v.videoHeight))
        canvas.width = Math.round(v.videoWidth * sc); canvas.height = Math.round(v.videoHeight * sc)
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
        try {
          const p = await readRef.current(ctx.getImageData(0, 0, canvas.width, canvas.height))
          if (!alive) return
          if (p.kind === 'fail') {
            misses++; if (misses >= 3) { last = ''; seenKey = null; setSeen(null) }
            say(/QR/.test(p.msg) ? 'Achei a folha, mas não li o QR code. Aproxime um pouco e deixe sem sombra.' : /outro concurso|não existe|não foi fechada/.test(p.msg) ? p.msg.charAt(0).toUpperCase() + p.msg.slice(1) : 'Mostre a folha inteira, com os 4 quadrados pretos dos cantos.', /outro concurso|não existe|não foi fechada/.test(p.msg) ? 'bad' : 'idle')
          } else {
            misses = 0
            if (seenKey && `${p.kind}${p.number}` !== seenKey) { seenKey = null; setSeen(null) }
            const key = `${p.kind}${p.number}`
            if (done.get(key) === p.sig || (done.has(key) && last === p.sig)) {
              say(`✓ ${p.name} já foi lido. Pode passar a próxima folha.`, 'ok'); seenKey = key; setSeen(p.name)
            } else if (last === p.sig) {
              const out = await commitRef.current(p)
              if (!alive) return
              if (out.kind === 'fail') { say(`Não salvou: ${out.msg}`, 'bad'); push(p.name, out.msg ?? 'não salvou', 'bad'); show({ tone: 'bad', icon: 'fail', title: 'Não foi salvo', name: p.name, sub: out.msg ?? 'Tente de novo.' }); setCount(c => ({ ...c, fail: c.fail + 1 })); beep(false); last = '' }
              else {
                done.set(key, p.sig)
                const label = out.kind === 'essay' ? 'redação recebida' : out.kind === 'review' ? `lido, ${out.flags} questão(ões) para conferir` : 'lido'
                say(`✓ ${p.name}: ${label}`, out.kind === 'review' ? 'warn' : 'ok'); push(p.name, out.kind === 'essay' ? 'redação recebida' : out.hits != null ? `${out.hits}/${out.total} acertos` : label, out.kind === 'review' ? 'warn' : 'ok')
                const acertos = out.hits != null ? ` · ${out.hits} de ${out.total} acertos` : ''
                show(out.kind === 'essay' ? { tone: 'ok', icon: 'essay', title: 'Redação recebida', name: p.name, sub: `Inscrição nº ${p.number}` }
                  : out.kind === 'review' ? { tone: 'warn', icon: 'review', title: 'Salvo, conferir depois', name: p.name, sub: `Inscrição nº ${p.number}${acertos} · ${out.flags} questão(ões) para conferir` }
                  : { tone: 'ok', icon: 'ok', title: 'Salvo', name: p.name, sub: `Inscrição nº ${p.number}${acertos}` })
                setCount(c => ({ ...c, [out.kind]: (c as any)[out.kind] + 1 })); beep(true)
              }
            } else { last = p.sig; say(`Lendo ${p.name}… segure firme`, 'idle') }
          }
        } catch (e: any) { say('Erro na leitura: ' + (e?.message || 'tente de novo'), 'bad') }
      }
      timer = setTimeout(tick, 150)
    }

    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1440 } }, audio: false })
        if (!alive) { stream.getTracks().forEach(t => t.stop()); return }
        const v = videoRef.current!; v.srcObject = stream; await v.play()
        try { wake = await (navigator as any).wakeLock?.request('screen') } catch { /* sem wake lock */ }
        say('Mostre a folha inteira, com os 4 quadrados pretos dos cantos.'); tick()
      } catch (e: any) {
        setErr(e?.name === 'NotAllowedError' ? 'Permita o uso da câmera no navegador para escanear.' : 'Não consegui abrir a câmera neste aparelho.')
      }
    })()
    return () => { alive = false; clearTimeout(timer); clearTimeout(cardTimer); stream?.getTracks().forEach(t => t.stop()); try { wake?.release() } catch { /* ok */ } }
  }, [])

  const accent = err ? '#EF4444' : tone === 'ok' ? '#34D399' : tone === 'warn' ? '#FBBF24' : tone === 'bad' ? '#F87171' : '#FFFFFF'
  const glass: React.CSSProperties = { background: 'rgba(15,23,42,.62)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,.14)' }
  const chip = (icon: React.ReactNode, n: number, label: string, color: string) => (
    <span title={label} style={{ ...glass, display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 99, padding: '6px 11px', fontSize: 13, fontWeight: 800, color: n > 0 ? color : 'rgba(255,255,255,.55)' }}>{icon}{n}<span style={{ fontWeight: 600, fontSize: 12, color: 'rgba(255,255,255,.7)' }}>{label}</span></span>
  )
  const corner = (pos: React.CSSProperties): React.CSSProperties => ({ position: 'absolute', width: 34, height: 34, borderColor: accent, borderStyle: 'solid', borderWidth: 0, transition: 'border-color .25s', ...pos })
  const cardStyle = card ? (card.tone === 'ok' ? { bg: '#ECFDF5', fg: '#047857', ring: '#34D399' } : card.tone === 'warn' ? { bg: '#FFFBEB', fg: '#B45309', ring: '#FBBF24' } : { bg: '#FEF2F2', fg: '#B91C1C', ring: '#F87171' }) : null
  return (
    <div role="dialog" aria-label="Escanear com a câmera" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#000', display: 'flex', flexDirection: 'column', fontFamily: 'inherit' }}>
      <style>{`@keyframes camscan{0%{top:6%}50%{top:92%}100%{top:6%}}@keyframes camup{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}@media (prefers-reduced-motion:reduce){.camscan,.camup{animation:none!important}}`}</style>
      <video ref={videoRef} playsInline muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, padding: 'max(12px, env(safe-area-inset-top)) 12px 10px', background: 'linear-gradient(rgba(0,0,0,.65), rgba(0,0,0,0))' }}>
        <div style={{ flex: 1, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {chip(<Check size={14} />, count.ok, 'lidos', '#6EE7B7')}
          {count.review > 0 && chip(<AlertTriangle size={14} />, count.review, 'conferir', '#FCD34D')}
          {count.essay > 0 && chip(<PenLine size={14} />, count.essay, 'redações', '#A7F3D0')}
          {count.fail > 0 && chip(<XCircle size={14} />, count.fail, 'erros', '#FCA5A5')}
        </div>
        <button onClick={onClose} aria-label="Fechar câmera" style={{ ...glass, display: 'inline-flex', alignItems: 'center', gap: 6, color: '#fff', borderRadius: 99, padding: '8px 14px', fontWeight: 800, fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer' }}><X size={16} /> Fechar</button>
      </div>
      {!err && (
        <div aria-hidden style={{ position: 'relative', margin: 'auto', width: 'min(78vw, 56vh)', aspectRatio: '0.707', borderRadius: 18, boxShadow: '0 0 0 100vmax rgba(0,0,0,.42)' }}>
          <span style={corner({ top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 18 })} />
          <span style={corner({ top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 18 })} />
          <span style={corner({ bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 18 })} />
          <span style={corner({ bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 18 })} />
          {tone === 'idle' && <span className="camscan" style={{ position: 'absolute', left: 10, right: 10, height: 2, borderRadius: 2, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.9), transparent)', animation: 'camscan 2.6s ease-in-out infinite' }} />}
        </div>
      )}
      <div style={{ position: 'relative', marginTop: 'auto', padding: '0 12px max(14px, env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {card && cardStyle && (
          <div key={card.key} className="camup" role="status" style={{ animation: 'camup .28s ease-out', background: '#fff', borderRadius: 20, padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'center', boxShadow: '0 18px 44px -12px rgba(0,0,0,.6)', border: `2px solid ${cardStyle.ring}` }}>
            <span style={{ flex: 'none', width: 52, height: 52, borderRadius: 99, background: cardStyle.bg, color: cardStyle.fg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              {card.icon === 'ok' ? <Check size={30} strokeWidth={3} /> : card.icon === 'review' ? <AlertTriangle size={28} /> : card.icon === 'essay' ? <PenLine size={26} /> : <XCircle size={28} />}
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 12.5, fontWeight: 800, letterSpacing: .2, color: cardStyle.fg }}>{card.title}</span>
              <span style={{ display: 'block', fontSize: 20, fontWeight: 800, color: '#1A2B4A', lineHeight: 1.2, overflowWrap: 'anywhere' }}>{card.name}</span>
              <span style={{ display: 'block', fontSize: 13.5, color: '#475569', marginTop: 2 }}>{card.sub}</span>
            </span>
          </div>
        )}
        {!card && (
          <div role="status" aria-live="polite" style={{ ...glass, borderRadius: 16, padding: '13px 16px', color: '#fff', fontSize: 15, fontWeight: 700, textAlign: 'center', display: 'flex', gap: 9, justifyContent: 'center', alignItems: 'center', borderColor: err || tone === 'bad' ? '#F87171' : tone === 'warn' ? '#FBBF24' : tone === 'ok' ? '#34D399' : 'rgba(255,255,255,.14)' }}>
            {!err && tone === 'idle' && (status.startsWith('Lendo') ? <Loader2 size={18} className="animate-spin" /> : <ScanLine size={18} />)}
            {err || status}
          </div>
        )}
        {!card && seen && (
          <button onClick={() => rereadRef.current?.()} style={{ ...glass, borderRadius: 14, padding: '12px 16px', color: '#fff', fontSize: 15, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
            <ScanLine size={18} /> Ler de novo o gabarito de {seen}
          </button>
        )}
        {items.length > 0 && (
          <div style={{ ...glass, borderRadius: 14, padding: '8px 12px', display: 'grid', gap: 4 }}>
            {items.slice(card ? 1 : 0, (card ? 1 : 0) + 3).map(i => (
              <div key={i.key} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#fff' }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, flex: 'none', background: i.tone === 'bad' ? '#F87171' : i.tone === 'warn' ? '#FBBF24' : '#34D399' }} />
                <span style={{ fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.name}</span>
                <span style={{ color: 'rgba(255,255,255,.7)', whiteSpace: 'nowrap' }}>{i.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
