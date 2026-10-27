// Aviso no Início do gestor: enquanto o roteiro da campanha tem etapas por fazer, mostra o progresso e a próxima etapa.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ListChecks, X } from 'lucide-react'
import { BRAND } from '../../lib/brand'
import { useAuth } from '../../contexts/AuthContext'
import { ROADMAP_STEPS, stepStatus, useRoadmap } from '../../lib/roadmap'

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Fortaleza' })
const read = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }

export default function RoteiroAviso() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { state } = useRoadmap(user?.institution_id)
  const key = `roteiro-aviso-${user?.id}-${state?.year}`
  const [hidden, setHidden] = useState(() => read(key) === today())
  if (!state?.released || hidden) return null
  const rows = ROADMAP_STEPS.map(s => ({ s, st: stepStatus(s, state) }))
  const pending = rows.filter(r => r.st === 'todo')
  if (!pending.length) return null
  const pct = Math.round((rows.length - pending.length) / rows.length * 100)
  const hide = () => { try { localStorage.setItem(key, today()) } catch { /* sem armazenamento */ } setHidden(true) }
  return (
    <div role="status" style={{ position: 'relative', background: '#fff', border: `1.5px solid ${BRAND.primary}`, borderRadius: 18, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 10px 24px -18px rgba(0,122,110,.7)' }}>
      <button type="button" onClick={hide} aria-label="Lembrar amanhã" title="Lembrar amanhã" className="aion-tap" style={{ position: 'absolute', top: 6, right: 6, width: 36, height: 36, border: 'none', background: 'none', color: BRAND.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingRight: 28 }}>
        <span style={{ width: 40, height: 40, borderRadius: 13, background: BRAND.soft, color: BRAND.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><ListChecks size={20} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, lineHeight: 1.25 }}>Sua campanha {state.year} está {pct}% pronta</div>
          <div style={{ fontSize: 12.5, color: BRAND.muted, marginTop: 2 }}>Faltam {pending.length} etapa{pending.length === 1 ? '' : 's'}. Próxima: <b style={{ color: BRAND.ink }}>{pending[0].s.title}</b></div>
        </div>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: '#EDF1F0', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: 'var(--aion-grad)', borderRadius: 99 }} /></div>
      <button type="button" onClick={() => navigate('/roteiro')} className="aion-tap" style={{ minHeight: 46, border: 'none', borderRadius: 12, background: 'var(--aion-grad)', color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>Continuar o passo a passo <ArrowRight size={16} /></button>
    </div>
  )
}
