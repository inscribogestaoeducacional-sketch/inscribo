// Escaneamento ao vivo: abre a câmera, reconhece a folha (cartão-resposta ou redação) pelos 4 quadrados e pelo QR code,
// confirma com duas leituras iguais seguidas, salva sozinho e já espera a próxima folha.
import { useEffect, useRef, useState } from 'react'
import { X, Loader2 } from 'lucide-react'

export type Parsed = { kind: 'fail'; msg: string } | { kind: 'card' | 'essay'; number: number; name: string; sig: string; payload: any }
export type Outcome = { kind: 'ok' | 'review' | 'essay' | 'fail'; msg?: string; flags?: number }

type Item = { key: number; text: string; tone: 'ok' | 'warn' | 'bad' }
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
  const [count, setCount] = useState({ ok: 0, review: 0, essay: 0, fail: 0 })

  useEffect(() => {
    let alive = true; let stream: MediaStream | null = null; let timer: any; let wake: any = null
    const done = new Map<string, string>() // "C12" -> assinatura já salva
    let last = ''; let misses = 0; let n = 0
    const canvas = document.createElement('canvas')
    const say = (t: string, k: 'idle' | 'ok' | 'warn' | 'bad' = 'idle') => { setStatus(t); setTone(k) }
    const push = (text: string, k: Item['tone']) => setItems(l => [{ key: ++n, text, tone: k }, ...l].slice(0, 6))

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
            misses++; if (misses >= 3) last = ''
            say(/QR/.test(p.msg) ? 'Achei a folha, mas não li o QR code. Aproxime um pouco e deixe sem sombra.' : /outro concurso|não existe|não foi fechada/.test(p.msg) ? p.msg.charAt(0).toUpperCase() + p.msg.slice(1) : 'Mostre a folha inteira, com os 4 quadrados pretos dos cantos.', /outro concurso|não existe|não foi fechada/.test(p.msg) ? 'bad' : 'idle')
          } else {
            misses = 0
            const key = `${p.kind}${p.number}`
            if (done.get(key) === p.sig || (done.has(key) && last === p.sig)) {
              say(`✓ ${p.name} já foi lido. Pode passar a próxima folha.`, 'ok')
            } else if (last === p.sig) {
              const out = await commitRef.current(p)
              if (!alive) return
              if (out.kind === 'fail') { say(`Não salvou: ${out.msg}`, 'bad'); push(`${p.name}: ${out.msg}`, 'bad'); setCount(c => ({ ...c, fail: c.fail + 1 })); beep(false); last = '' }
              else {
                done.set(key, p.sig)
                const label = out.kind === 'essay' ? 'redação recebida' : out.kind === 'review' ? `lido, ${out.flags} questão(ões) para conferir` : 'lido'
                say(`✓ ${p.name}: ${label}`, out.kind === 'review' ? 'warn' : 'ok'); push(`${p.name}: ${label}`, out.kind === 'review' ? 'warn' : 'ok')
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
    return () => { alive = false; clearTimeout(timer); stream?.getTracks().forEach(t => t.stop()); try { wake?.release() } catch { /* ok */ } }
  }, [])

  const bg = tone === 'ok' ? '#047857' : tone === 'warn' ? '#B45309' : tone === 'bad' ? '#B91C1C' : 'rgba(0,0,0,.72)'
  return (
    <div role="dialog" aria-label="Escanear com a câmera" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#000', display: 'flex', flexDirection: 'column' }}>
      <video ref={videoRef} playsInline muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 13.5, fontWeight: 700 }}>
        <span style={{ flex: 1 }}>Lidos {count.ok} · Conferir {count.review} · Redações {count.essay} · Erros {count.fail}</span>
        <button onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 0, borderRadius: 10, padding: '8px 12px', fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }}><X size={16} /> Fechar</button>
      </div>
      {!err && <div aria-hidden style={{ position: 'relative', margin: 'auto', width: 'min(78vw, 56vh)', aspectRatio: '0.707', border: '3px dashed rgba(255,255,255,.7)', borderRadius: 12 }} />}
      <div style={{ position: 'relative', marginTop: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12.5, color: '#fff', textShadow: '0 1px 2px #000' }}>
          {items.map(i => <div key={i.key} style={{ color: i.tone === 'bad' ? '#FCA5A5' : i.tone === 'warn' ? '#FCD34D' : '#A7F3D0' }}>{i.tone === 'ok' ? '✓' : i.tone === 'warn' ? '!' : '✗'} {i.text}</div>)}
        </div>}
        <div role="status" aria-live="polite" style={{ background: err ? '#B91C1C' : bg, color: '#fff', borderRadius: 14, padding: '14px 16px', fontSize: 16, fontWeight: 800, textAlign: 'center', display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
          {!err && tone === 'idle' && <Loader2 size={18} className="animate-spin" />}{err || status}
        </div>
      </div>
    </div>
  )
}
