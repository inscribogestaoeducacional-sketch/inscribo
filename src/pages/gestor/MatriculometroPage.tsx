// Matriculômetro em tela própria (só visualização), para quem não acessa a Campanha de Matrículas inteira.
import { useEffect, useState } from 'react'
import { Flag } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Matriculometro from '../../components/campanha/Matriculometro'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'

export default function MatriculometroPage() {
  const { user } = useAuth()
  const instId = user?.institution_id || ''
  const [year, setYear] = useState<number | null | undefined>(undefined)
  const [err, setErr] = useState('')
  useEffect(() => {
    if (!instId) return
    supabase.rpc('matriculometro_year', { p_inst: instId }).then(({ data, error }) => {
      if (error) { setErr(error.message); setYear(null) } else setYear((data as number | null) ?? null)
    })
  }, [instId])
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1100, margin: '0 auto' }}>
      <PageHeader icon={Flag as any} title="Matriculômetro" subtitle="Acompanhamento de rematrículas por turma · somente visualização" />
      {year === undefined && <div style={{ color: BRAND.muted, fontSize: 14 }}>Carregando…</div>}
      {year === null && <div style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 16, color: BRAND.muted, fontSize: 14 }}>{err ? `Não foi possível abrir o Matriculômetro: ${err}` : 'A escola ainda não tem uma campanha de matrículas ativa.'}</div>}
      {year != null && instId && <Matriculometro institutionId={instId} year={year} />}
    </div>
  )
}
