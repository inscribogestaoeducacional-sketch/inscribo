// Central de Relatórios: menu horizontal de módulos; cada um com resumo, tabela, CSV e análise da IA.
import PageHeader from '../ui/PageHeader'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BarChart3, Users, MessageCircle, Headset, SmilePlus, GraduationCap, UserCog, Contact, RefreshCw } from 'lucide-react'
import { BRAND } from '../../lib/brand'
import LeadsReport from './LeadsReport'
import WhatsappReport from './WhatsappReport'
import AtendimentoReport from './AtendimentoReport'
import SatisfacaoReport from './SatisfacaoReport'
import MatriculasReport from './MatriculasReport'
import UsuariosReport from './UsuariosReport'
import ContatosReport from './ContatosReport'
import RematriculasReport from './RematriculasReport'

type Mod = 'leads' | 'whatsapp' | 'atendimento' | 'satisfacao' | 'matriculas' | 'usuarios' | 'contatos' | 'rematriculas'
const MODS: { id: Mod; label: string; Icon: typeof Users }[] = [
  { id: 'leads', label: 'Leads', Icon: Users },
  { id: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle },
  { id: 'atendimento', label: 'Atendimento', Icon: Headset },
  { id: 'satisfacao', label: 'Satisfação', Icon: SmilePlus },
  { id: 'matriculas', label: 'Matrículas', Icon: GraduationCap },
  { id: 'rematriculas', label: 'Rematrículas', Icon: RefreshCw },
  { id: 'contatos', label: 'Contatos', Icon: Contact },
  { id: 'usuarios', label: 'Usuários', Icon: UserCog },
]

export default function CentralRelatorios({ institutionId, institutionName }: { institutionId: string; institutionName: string }) {
  const [sp] = useSearchParams()
  const MOD_IDS: Mod[] = ['leads', 'whatsapp', 'atendimento', 'satisfacao', 'matriculas', 'usuarios', 'contatos', 'rematriculas']
  const tabQ = sp.get('tab') as Mod | null
  const [mod, setMod] = useState<Mod>(tabQ && MOD_IDS.includes(tabQ) ? tabQ : 'leads')
  return (
    <div style={{ padding: 24, maxWidth: 1240, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="no-print"><PageHeader icon={BarChart3} title="Relatórios" subtitle="Tudo que o sistema registra, por período, com exportação em CSV e análise da IA" /></div>
      <div className="no-print" style={{ display: 'flex', gap: 4, background: '#EEF3F2', borderRadius: 14, padding: 5, overflowX: 'auto' }}>
        {MODS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setMod(id)} style={{ flex: '1 1 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 700, background: mod === id ? '#fff' : 'transparent', color: mod === id ? BRAND.primaryDark : BRAND.muted, boxShadow: mod === id ? '0 1px 3px rgba(26,43,74,.1)' : 'none' }}><Icon size={15} />{label}</button>
        ))}
      </div>
      {mod === 'leads' && <LeadsReport key={institutionId} institutionId={institutionId} institutionName={institutionName} />}
      {mod === 'whatsapp' && <WhatsappReport key={institutionId} institutionId={institutionId} institutionName={institutionName} />}
      {mod === 'atendimento' && <AtendimentoReport key={institutionId} institutionId={institutionId} institutionName={institutionName} />}
      {mod === 'satisfacao' && <SatisfacaoReport key={institutionId} institutionId={institutionId} institutionName={institutionName} />}
      {mod === 'rematriculas' && <RematriculasReport key={institutionId} institutionId={institutionId} institutionName={institutionName} />}
      {mod === 'contatos' && <ContatosReport key={institutionId} institutionId={institutionId} institutionName={institutionName} />}
      {mod === 'usuarios' && <UsuariosReport key={institutionId} institutionId={institutionId} institutionName={institutionName} />}
      {mod === 'matriculas' && <MatriculasReport key={institutionId} institutionId={institutionId} institutionName={institutionName} />}
    </div>
  )
}
