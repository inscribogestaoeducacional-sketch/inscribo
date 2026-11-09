// Início da coordenação: atalhos só para o que a escola liberou para esta pessoa.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import MeuSegmento from '../../components/coordenacao/MeuSegmento'
import { Trophy, Flag, MessageCircle, BarChart3, GraduationCap, Home } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import { useAuth } from '../../contexts/AuthContext'
import { usePermissions } from '../../contexts/PermissionsContext'
import { useConcursoModuleEnabled } from '../../lib/concurso'
import { BRAND } from '../../lib/brand'

export default function CoordenacaoHome() {
  const { user } = useAuth()
  const { isModuleEnabled } = usePermissions()
  const concursoOn = useConcursoModuleEnabled(user?.institution_id)
  const navigate = useNavigate()
  const [year, setYear] = useState<number | null>(null)
  const instId = user?.institution_id || ''
  const matOn = isModuleEnabled('matriculometro')
  useEffect(() => {
    if (!instId || !matOn) return
    supabase.rpc('matriculometro_year', { p_inst: instId }).then(({ data }) => setYear((data as number | null) ?? null))
  }, [instId, matOn])
  const first = (user as any)?.full_name?.split(' ')[0] || ''
  const items = [
    { on: isModuleEnabled('concurso') && concursoOn === true, path: '/concurso', Icon: Trophy, title: 'Concurso de Bolsas', text: 'Questões, inscritos, salas, correção e resultados.' },
    { on: isModuleEnabled('matriculometro'), path: '/matriculometro', Icon: Flag, title: 'Matriculômetro', text: 'Como estão as rematrículas por série e turma (só visualização).' },
    { on: isModuleEnabled('relatorios'), path: '/reports', Icon: BarChart3, title: 'Relatórios', text: 'Números e relatórios da escola.' },
    { on: isModuleEnabled('base_alunos'), path: '/base-alunos', Icon: GraduationCap, title: 'Base de alunos', text: 'Painel de rematrícula e lista de quem falta.' },
    { on: isModuleEnabled('whatsapp'), path: '/whatsapp', Icon: MessageCircle, title: 'WhatsApp', text: 'Atendimento e conversas.' },
  ].filter(i => i.on)
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 900, margin: '0 auto' }}>
      <PageHeader icon={Home as any} title={first ? `Olá, ${first}` : 'Coordenação'} subtitle="Aqui estão as áreas liberadas para você" />
      {matOn && year != null && instId && <MeuSegmento institutionId={instId} year={year} />}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
        {items.map(({ Icon, ...i }) => (
          <button key={i.path} onClick={() => navigate(i.path)} style={{ textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 18, padding: 18, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <span style={{ width: 44, height: 44, borderRadius: 14, background: BRAND.soft, color: BRAND.primaryDark, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={22} /></span>
            <span><span style={{ display: 'block', fontWeight: 800, fontSize: 16, color: BRAND.ink }}>{i.title}</span><span style={{ display: 'block', fontSize: 13.5, color: BRAND.muted, marginTop: 3 }}>{i.text}</span></span>
          </button>
        ))}
        {items.length === 0 && <div style={{ color: BRAND.muted, fontSize: 14 }}>Nenhuma área foi liberada para você ainda. Fale com o administrador da escola.</div>}
      </div>
    </div>
  )
}
