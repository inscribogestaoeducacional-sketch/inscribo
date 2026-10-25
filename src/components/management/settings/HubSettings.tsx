// Molde único das abas de Configurações com cartões: início com cartões e uma
// tela por assunto. Com um assunto só liberado para o perfil, abre direto nele.
import { useEffect, useState, type ReactNode } from 'react'
import { canSeeSettingsItem, type SettingsItemId, type SettingsRole } from '../../../lib/settingsAccess'
import { BRAND } from '../../../lib/brand'
import { BackHeader, Tile, useSubHeader } from './ui'

export interface HubItem {
  key: string
  label: string
  desc: string
  item: SettingsItemId
  Icon: any
  render: () => ReactNode
  /** esconde o cartão por regra do módulo (ex.: Transmissões desligada) */
  hidden?: boolean
}
export interface HubGroup { title: string; items: HubItem[] }

export default function HubSettings({ rootLabel, groups, role, isMobile, section, onSectionChange, header }: {
  rootLabel: string; groups: HubGroup[]; role?: string; isMobile?: boolean; section?: string | null
  onSectionChange?: (s: string) => void; header?: ReactNode
}) {
  const visible = groups
    .map(g => ({ ...g, items: g.items.filter(i => !i.hidden && canSeeSettingsItem(i.item, role as SettingsRole | undefined)) }))
    .filter(g => g.items.length)
  const all = visible.flatMap(g => g.items)
  const [view, setView] = useState<string>(() => (section && all.some(i => i.key === section) ? section : 'inicio'))
  const go = (v: string) => { setView(v); onSectionChange?.(v) }
  const goHome = () => { setView('inicio'); onSectionChange?.('') }

  // O link (?sec=) manda: voltar/abrir por fora da tela também troca o assunto.
  useEffect(() => {
    const want = section && all.some(i => i.key === section) ? section : 'inicio'
    setView(v => (v === want ? v : want))
  }, [section, all.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const cur = all.length === 1 ? undefined : all.find(i => i.key === view)
  useSubHeader(isMobile && cur ? { title: cur.label, onBack: goHome } : null)

  if (all.length === 1) return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{all[0].render()}</div>

  const current = all.find(i => i.key === view)
  if (!current) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {header}
        {visible.map(g => (
          <div key={g.title}>
            <div style={{ fontSize: 12, fontWeight: 800, color: BRAND.muted, letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 10 }}>{g.title}</div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {g.items.map(i => <Tile key={i.key} Icon={i.Icon} title={i.label} desc={i.desc} onClick={() => go(i.key)} />)}
            </div>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div key={view} className="aion-slide" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {isMobile ? <p style={{ margin: 0, fontSize: 13, color: BRAND.muted, lineHeight: 1.5 }}>{current.desc}</p> : <BackHeader backLabel={rootLabel} onBack={goHome} title={current.label} help={current.desc} />}
      {current.render()}
    </div>
  )
}
