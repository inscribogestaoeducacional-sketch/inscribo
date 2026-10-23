// Configurações > Escola: início com cartões e uma tela por assunto
// (mesmo molde do WhatsApp). Os editores de cada assunto são os que já existiam.
import { useState } from 'react'
import { GraduationCap, Layers, MapPin, Bell } from 'lucide-react'
import { canSeeSettingsItem, type SettingsRole } from '../../../lib/settingsAccess'
import { BRAND } from '../../../lib/brand'
import { Card, BackHeader, Tile, GhostButton } from './ui'
import GradeLevelsEditor from '../GradeLevelsEditor'
import LeadUnitFieldEditor from '../LeadUnitFieldEditor'
import LeadReminderSettingsEditor from '../LeadReminderSettingsEditor'

const INFO: Record<string, { label: string; desc: string; item: string; Icon: any }> = {
  campanha: { label: 'Dados da campanha', desc: 'As informações que o assistente usa para falar da escola: séries oferecidas, mensalidade média e dados da campanha.', item: 'escola.dados', Icon: GraduationCap },
  series:   { label: 'Séries', desc: 'As séries e etapas de ensino da escola, na ordem em que aparecem em todo o sistema.', item: 'escola.series', Icon: Layers },
  unidade:  { label: 'Campo de unidade do lead', desc: 'Para escolas com mais de uma unidade: liga o campo e cadastra as opções (Unidade, Campus, Polo…).', item: 'escola.unidade', Icon: MapPin },
  lembrete: { label: 'Lead sem contato', desc: 'Depois de quantos dias sem conversa o lead aparece como "Sem contato".', item: 'escola.lembrete', Icon: Bell },
}

export default function EscolaSettings({ institutionId, role, isMobile, section, onSectionChange, onToast, onEditSchool }: {
  institutionId: string; role?: string; isMobile?: boolean; section?: string | null
  onSectionChange?: (s: string) => void; onToast: (msg: string, ok?: boolean) => void; onEditSchool: () => void
}) {
  const allowed = Object.keys(INFO).filter(k => canSeeSettingsItem(INFO[k].item as any, role as SettingsRole | undefined))
  const [view, setView] = useState<string>(() => (section && allowed.includes(section) ? section : 'inicio'))
  const go = (v: string) => { setView(v); onSectionChange?.(v) }
  const goHome = () => { setView('inicio'); onSectionChange?.('') }

  if (view === 'inicio' || !INFO[view] || !allowed.includes(view)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: BRAND.muted, letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 10 }}>Sobre a escola</div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {allowed.map(k => <Tile key={k} Icon={INFO[k].Icon} title={INFO[k].label} desc={INFO[k].desc} onClick={() => go(k)} />)}
          </div>
        </div>
      </div>
    )
  }

  const info = INFO[view]
  return (
    <div key={view} className="aion-slide" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <BackHeader backLabel="Escola" onBack={goHome} title={info.label} help={info.desc} />
      {view === 'campanha' && (
        <Card style={{ maxWidth: 560 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink }}>Dados da campanha</div>
          <div style={{ fontSize: 12.5, color: BRAND.muted, margin: '4px 0 14px', lineHeight: 1.5 }}>Abre o passo a passo com as informações da escola, as séries oferecidas e a mensalidade média.</div>
          <GhostButton onClick={onEditSchool}><GraduationCap size={15} /> Editar dados da campanha</GhostButton>
        </Card>
      )}
      {view === 'series' && <GradeLevelsEditor institutionId={institutionId} onToast={onToast} />}
      {view === 'unidade' && <LeadUnitFieldEditor institutionId={institutionId} onToast={onToast} />}
      {view === 'lembrete' && <LeadReminderSettingsEditor institutionId={institutionId} onToast={onToast} />}
    </div>
  )
}
