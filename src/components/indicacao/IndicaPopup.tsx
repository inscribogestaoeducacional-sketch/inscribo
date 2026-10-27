// Card de divulgação "Indique e ganhe": aparece ao abrir o sistema e volta a cada 15 dias.
import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Gift, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'
import { brl } from './types'

const KEY = 'aion:indique-popup'
const DIAS = 15
const ok = () => { try { const t = Number(localStorage.getItem(KEY) || 0); return !t || Date.now() - t > DIAS * 86400000 } catch { return true } }
const marca = () => { try { localStorage.setItem(KEY, String(Date.now())) } catch { /* sem armazenamento */ } }

export default function IndicaPopup() {
  const nav = useNavigate()
  const loc = useLocation()
  const [open, setOpen] = useState(false)
  const [premio, setPremio] = useState(500)
  useEffect(() => {
    if (!ok()) return
    let vivo = true
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('referral_prize_value')
      if (!vivo) return
      if (data != null) setPremio(Number(data))
      setOpen(true)
    }, 2500)
    return () => { vivo = false; clearTimeout(t) }
  }, [])
  if (!open || loc.pathname.startsWith('/indicacoes')) return null
  const fechar = () => { marca(); setOpen(false) }
  return (
    <div role="dialog" aria-label="Indique e ganhe" style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(15,30,50,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={fechar}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 400, background: '#fff', borderRadius: 24, overflow: 'hidden', boxShadow: '0 30px 60px -20px rgba(0,0,0,.45)' }}>
        <div style={{ position: 'relative', background: 'var(--aion-grad)', color: '#fff', padding: '26px 22px 22px' }}>
          <button type="button" onClick={fechar} aria-label="Fechar" style={{ position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: 12, border: '1px solid rgba(255,255,255,.35)', background: 'rgba(255,255,255,.15)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={18} /></button>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(255,255,255,.18)', border: '1px solid rgba(255,255,255,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}><Gift size={26} /></div>
          <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.15 }}>Indique e ganhe {brl(premio)}</div>
          <div style={{ fontSize: 14.5, opacity: .92, marginTop: 8, lineHeight: 1.45 }}>Conhece o gestor de uma escola que ainda não usa a Áion Edu? Indique e receba por Pix quando ela contratar.</div>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button type="button" onClick={() => { marca(); setOpen(false); nav('/indicacoes') }} style={{ minHeight: 48, borderRadius: 14, border: 'none', background: 'var(--aion-grad)', color: '#fff', fontWeight: 800, fontSize: 15, fontFamily: 'inherit', cursor: 'pointer' }}>Quero indicar</button>
          <button type="button" onClick={fechar} style={{ minHeight: 44, borderRadius: 14, border: `1px solid ${BRAND.line}`, background: '#fff', color: BRAND.muted, fontWeight: 700, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}>Agora não</button>
        </div>
      </div>
    </div>
  )
}
