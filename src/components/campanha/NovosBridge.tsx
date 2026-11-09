// Aviso: quem já foi da escola e voltou é contado à parte ("Voltaram"), nem em rematrículas nem em novos.
import { Info } from 'lucide-react'
import { BRAND } from '../../lib/brand'

export default function NovosBridge({ returning }: { novos?: number; returning: number; returningAsNew?: boolean }) {
  if (!returning) return null
  return (
    <div role="note" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 14, background: BRAND.soft, border: `1px solid ${BRAND.line}`, fontSize: 13, color: BRAND.text, lineHeight: 1.5 }}>
      <Info size={16} style={{ flexShrink: 0, marginTop: 2, color: BRAND.primary }} />
      <span><b>{returning} {returning === 1 ? 'aluno voltou' : 'alunos voltaram'}</b> à escola depois de um tempo fora. {returning === 1 ? 'Ele é contado' : 'Eles são contados'} à parte: não entram em rematrículas nem em novos, mas entram no total de matriculados.</span>
    </div>
  )
}
