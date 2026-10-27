// Ponte entre o nosso número de "novos" e o da Activesoft, que conta quem já foi da escola como veterano.
import { Info } from 'lucide-react'
import { BRAND } from '../../lib/brand'

export default function NovosBridge({ novos, returning, returningAsNew }: { novos: number; returning: number; returningAsNew: boolean }) {
  if (!returning) return null
  const s = returning === 1 ? '' : 's'
  return (
    <div role="note" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 14, background: BRAND.soft, border: `1px solid ${BRAND.line}`, fontSize: 13, color: BRAND.text, lineHeight: 1.5 }}>
      <Info size={16} style={{ flexShrink: 0, marginTop: 2, color: BRAND.primary }} />
      {returningAsNew ? (
        <span><b>Novos {novos}</b> = {novos - returning} novato{novos - returning === 1 ? '' : 's'} de verdade + {returning} que {returning === 1 ? 'já foi' : 'já foram'} da escola. A Activesoft conta {returning === 1 ? 'esse' : 'esses'} {returning} como veterano{s}, por isso o número dela é {returning} a menos.</span>
      ) : (
        <span>{returning} aluno{s} que {returning === 1 ? 'já foi' : 'já foram'} da escola {returning === 1 ? 'está contado' : 'estão contados'} como <b>rematrícula</b>, igual à Activesoft. Os novos são só novatos de verdade.</span>
      )}
    </div>
  )
}
