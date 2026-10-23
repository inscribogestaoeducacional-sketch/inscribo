// Central de Relatórios: menu horizontal de módulos; cada um com resumo, tabela, CSV e análise da IA.
import { useState } from 'react'
import { BarChart3, Flag, Users, MessageCircle } from 'lucide-react'
import { BRAND } from '../../lib/brand'
import GestorReports from '../reports/GestorReports'
import LeadsReport from './LeadsReport'
import WhatsappReport from './WhatsappReport'

type Mod = 'leads' | 'whatsapp' | 'campanha'
const MODS: { id: Mod; label: string; Icon: typeof Users }[] = [
  { id: 'leads', label: 'Leads', Icon: Users },
  { id: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle },
  { id: 'campanha', label: 'Campanha', Icon: Flag },
]

export default function CentralRelatorios({ institutionId, institutionName }: { institutionId: string; institutionName: string }) {
  const [mod, setMod] = useState<Mod>('leads')
  return (
    <div style={{ padding: 24, maxWidth: 1240, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BarChart3 size={22} color={BRAND.primaryDark} /></div>
        <div><h1 style={{ fontSize: 22, fontWeight: 800, color: BRAND.ink, margin: 0 }}>Relatórios</h1><p style={{ fontSize: 13, color: BRAND.muted, margin: 0 }}>Tudo que o sistema registra, por período, com exportação em CSV e análise da IA</p></div>
      </div>
      <div className="no-print" style={{ display: 'flex', gap: 4, background: '#EEF3F2', borderRadius: 14, padding: 5, overflowX: 'auto' }}>
        {MODS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setMod(id)} style={{ flex: '1 1 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 700, background: mod === id ? '#fff' : 'transparent', color: mod === id ? BRAND.primaryDark : BRAND.muted, boxShadow: mod === id ? '0 1px 3px rgba(26,43,74,.1)' : 'none' }}><Icon size={15} />{label}</button>
        ))}
      </div>
      {mod === 'leads' && <LeadsReport key={institutionId} institutionId={institutionId} institutionName={institutionName} />}
      {mod === 'whatsapp' && <WhatsappReport key={institutionId} institutionId={institutionId} institutionName={institutionName} />}
      {mod === 'campanha' && <div style={{ margin: '-24px' }}><GestorReports institutionId={institutionId} institutionName={institutionName} /></div>}
    </div>
  )
}
