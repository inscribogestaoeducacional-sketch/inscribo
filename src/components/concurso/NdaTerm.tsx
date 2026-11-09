// Tela de aceite do termo de confidencialidade (primeiro acesso do professor).
import { useState } from 'react'
import { BRAND } from '../../lib/brand'
import { db, NDA_PARAGRAPHS, NDA_TITLE, NDA_VERSION } from '../../lib/concurso'

export default function NdaTerm({ name, onAccepted }: { name: string; onAccepted: () => void }) {
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const accept = async () => {
    setBusy(true); setErr('')
    const { error } = await db.rpc('contest_teacher_accept_nda', { p_version: NDA_VERSION })
    setBusy(false)
    if (error) return setErr('Não foi possível registrar o aceite: ' + error.message)
    onAccepted()
  }
  return (
    <div style={{ minHeight: '100vh', background: BRAND.bg, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 18, padding: 20, maxWidth: 560, width: '100%' }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.muted }}>Concurso de Bolsas</div>
        <h1 style={{ margin: '2px 0 4px', fontSize: 21, color: BRAND.ink }}>{NDA_TITLE}</h1>
        <div style={{ fontSize: 14, color: BRAND.muted, marginBottom: 12 }}>Olá, {name.split(' ')[0]}. Antes de começar, leia e aceite o termo abaixo.</div>
        <div style={{ maxHeight: '48vh', overflowY: 'auto', border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: '12px 14px', fontSize: 14, lineHeight: 1.55, color: BRAND.ink }}>
          {NDA_PARAGRAPHS.map((p, i) => <p key={i} style={{ margin: i ? '10px 0 0' : 0 }}>{p}</p>)}
        </div>
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', margin: '14px 0', fontSize: 14, fontWeight: 700, color: BRAND.ink, cursor: 'pointer' }}>
          <input type="checkbox" checked={ok} onChange={e => setOk(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18 }} /> Li o termo e concordo com tudo.
        </label>
        {err && <div style={{ color: '#B91C1C', fontSize: 13.5, marginBottom: 8 }}>{err}</div>}
        <button disabled={!ok || busy} onClick={accept} style={{ width: '100%', border: 0, borderRadius: 12, padding: '13px', fontSize: 15, fontWeight: 800, fontFamily: 'inherit', cursor: ok && !busy ? 'pointer' : 'not-allowed', opacity: ok ? 1 : .5, color: '#fff', background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryDark})` }}>{busy ? 'Registrando…' : 'Aceitar e continuar'}</button>
      </div>
    </div>
  )
}
