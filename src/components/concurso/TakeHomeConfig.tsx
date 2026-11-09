// Folha avulsa que o aluno leva para casa: mensagem da escola, QR extra e imagem opcionais.
import { useState } from 'react'
import { BRAND } from '../../lib/brand'
import { db, type Contest } from '../../lib/concurso'
import { ContestImg, uploadContestImage } from './media'

const input: React.CSSProperties = { border: `1px solid ${BRAND.line}`, borderRadius: 10, padding: '9px 11px', fontSize: 14, fontFamily: 'inherit', color: BRAND.ink, background: '#fff', boxSizing: 'border-box', width: '100%' }
const lab: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: BRAND.muted, display: 'block', marginBottom: 4 }
const btn = (primary = false): React.CSSProperties => ({ display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'center', padding: '9px 14px', borderRadius: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, border: primary ? 0 : `1px solid ${BRAND.line}`, background: primary ? `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryDark})` : '#fff', color: primary ? '#fff' : BRAND.ink })

export default function TakeHomeConfig({ contest, onChanged }: { contest: Contest; onChanged: () => void }) {
  const [t, setT] = useState(contest.take_home ?? {})
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }
  const save = async (next = t) => {
    setBusy(true)
    const { error } = await db.from('contests').update({ take_home: next }).eq('id', contest.id)
    setBusy(false)
    flash(error ? 'Não foi possível salvar: ' + error.message : 'Folha do aluno salva.'); if (!error) onChanged()
  }
  const pick = async (f?: File) => {
    if (!f) return
    try { const path = await uploadContestImage(f, contest.institution_id, contest.id); const next = { ...t, image: path }; setT(next); await save(next) } catch (e: any) { flash(e?.message || 'Não foi possível enviar a imagem') }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontWeight: 800, color: BRAND.ink }}>Folha do aluno (comprovante para levar para casa)</div>
      <div style={{ fontSize: 12.5, color: BRAND.muted }}>Sai uma folha por inscrito, com nome, número, versão da prova e o QR code para ver o resultado. Abaixo, o que a escola quiser acrescentar (tudo opcional).</div>
      <div><label style={lab}>Mensagem da escola</label>
        <textarea style={{ ...input, minHeight: 90, resize: 'vertical' }} value={t.message ?? ''} onChange={e => setT({ ...t, message: e.target.value })} placeholder="Ex.: Obrigado por participar! Matrículas abertas, procure a secretaria." /></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
        <div><label style={lab}>QR code extra: link</label><input style={input} value={t.qr_url ?? ''} onChange={e => setT({ ...t, qr_url: e.target.value })} placeholder="https://… (matrícula, Instagram…)" /></div>
        <div><label style={lab}>QR code extra: legenda</label><input style={input} value={t.qr_label ?? ''} onChange={e => setT({ ...t, qr_label: e.target.value })} placeholder="Ex.: Faça já a matrícula" /></div>
      </div>
      <div><label style={lab}>Imagem (propaganda de matrículas, por exemplo)</label>
        {t.image && <div style={{ marginBottom: 8 }}><ContestImg path={t.image} style={{ maxHeight: 140 }} /></div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ ...btn(), cursor: 'pointer' }}>{t.image ? 'Trocar imagem' : 'Enviar imagem'}<input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => pick(e.target.files?.[0])} /></label>
          {t.image && <button style={btn()} onClick={() => { const n = { ...t, image: null }; setT(n); save(n) }}>Remover imagem</button>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button style={btn(true)} disabled={busy} onClick={() => save()}>{busy ? 'Salvando…' : 'Salvar folha do aluno'}</button>
        {msg && <span role="status" style={{ fontSize: 13.5, fontWeight: 700, color: msg.startsWith('Não') ? '#B91C1C' : BRAND.primaryDark }}>{msg}</span>}
      </div>
    </div>
  )
}
