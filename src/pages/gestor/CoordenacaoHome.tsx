// Início da coordenação: painel do segmento + atalhos (botões no banner) só para o que a escola liberou.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Home, Trophy, BarChart3, MessageCircle } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import HeaderAction from '../../components/mobile/HeaderAction'
import MeuSegmento from '../../components/coordenacao/MeuSegmento'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { usePermissions } from '../../contexts/PermissionsContext'
import { useConcursoModuleEnabled } from '../../lib/concurso'
import { BRAND } from '../../lib/brand'

export default function CoordenacaoHome() {
  const { user } = useAuth()
  const { isModuleEnabled } = usePermissions()
  const concursoOn = useConcursoModuleEnabled(user?.institution_id)
  const navigate = useNavigate()
  const [year, setYear] = useState<number | null | undefined>(undefined)
  const [seg, setSeg] = useState('')
  const instId = user?.institution_id || ''
  const matOn = isModuleEnabled('matriculometro')
  const first = (user as any)?.full_name?.split(' ')[0] || ''
  useEffect(() => {
    if (!instId || !matOn) return
    supabase.rpc('matriculometro_year', { p_inst: instId }).then(({ data }) => setYear((data as number | null) ?? null))
  }, [instId, matOn])
  const actions = (
    <>
      {isModuleEnabled('concurso') && concursoOn === true && <HeaderAction primary icon={Trophy} label="Concurso de Bolsas" onClick={() => navigate('/concurso')} />}
      {isModuleEnabled('relatorios') && <HeaderAction icon={BarChart3} label="Relatórios" onClick={() => navigate('/reports')} />}
      {isModuleEnabled('whatsapp') && <HeaderAction icon={MessageCircle} label="WhatsApp" onClick={() => navigate('/whatsapp')} />}
    </>
  )
  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1100, margin: '0 auto' }}>
      <PageHeader icon={Home as any} title={first ? `Olá, ${first}` : 'Coordenação'} subtitle={matOn && seg ? `${seg} · acompanhamento em tempo real` : 'Aqui estão as áreas liberadas para você'} actions={actions} />
      {matOn && year === undefined && <div style={{ color: BRAND.muted, fontSize: 14 }}>Carregando…</div>}
      {matOn && year === null && <div style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 16, color: BRAND.muted, fontSize: 14 }}>A escola ainda não tem uma campanha de matrículas ativa.</div>}
      {matOn && year != null && instId && <MeuSegmento institutionId={instId} year={year} onTitle={setSeg} />}
      {!matOn && !(isModuleEnabled('concurso') && concursoOn === true) && <div style={{ color: BRAND.muted, fontSize: 14 }}>Nenhuma área foi liberada para você ainda. Fale com o administrador da escola.</div>}
    </div>
  )
}
