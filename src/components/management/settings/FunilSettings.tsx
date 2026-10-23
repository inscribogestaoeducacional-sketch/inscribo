// Configurações > Funil e leads: início com cartões e uma tela por assunto.
import { useState } from 'react'
import { Tag } from 'lucide-react'
import { canSeeSettingsItem, type SettingsRole } from '../../../lib/settingsAccess'
import { BRAND } from '../../../lib/brand'
import { BackHeader, Tile } from './ui'
import LeadSourcesEditor from '../LeadSourcesEditor'

const INFO: Record<string, { label: string; desc: string; item: string; Icon: any }> = {
  origens: { label: 'Origens do lead', desc: 'De onde os contatos chegam: escolha as que a escola usa e acrescente as suas.', item: 'funil.origens', Icon: Tag },
}

export default function FunilSettings({ institutionId, role, isMobile, section, onSectionChange, onToast }: {
  institutionId: string; role?: string; isMobile?: boolean; section?: string | null
  onSectionChange?: (s: string) => void; onToast: (msg: string, ok?: boolean) => void
}) {
  const allowed = Object.keys(INFO).filter(k => canSeeSettingsItem(INFO[k].item as any, role as SettingsRole | undefined))
  const [view, setView] = useState<string>(() => (section && allowed.includes(section) ? section : 'inicio'))
  const go = (v: string) => { setView(v); onSectionChange?.(v) }
  const goHome = () => { setView('inicio'); onSectionChange?.('') }

  // Com um assunto só, a aba abre direto nele (sem cartão no meio).
  if (allowed.length === 1) {
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{allowed[0] === 'origens' && <LeadSourcesEditor institutionId={institutionId} onToast={onToast} />}</div>
  }

  if (view === 'inicio' || !INFO[view] || !allowed.includes(view)) {
    return (
      <div>
        <div style={{ fontSize: 12, fontWeight: 800, color: BRAND.muted, letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 10 }}>Funil e leads</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {allowed.map(k => <Tile key={k} Icon={INFO[k].Icon} title={INFO[k].label} desc={INFO[k].desc} onClick={() => go(k)} />)}
        </div>
      </div>
    )
  }
  const info = INFO[view]
  return (
    <div key={view} className="aion-slide" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <BackHeader backLabel="Funil e leads" onBack={goHome} title={info.label} help={info.desc} />
      {view === 'origens' && <LeadSourcesEditor institutionId={institutionId} onToast={onToast} />}
    </div>
  )
}
