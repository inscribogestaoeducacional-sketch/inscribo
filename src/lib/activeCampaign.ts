// A campanha ativa da escola é a "chave mestra" do ano: os módulos abrem no ano letivo dela
// (target_school_year) sem precisar escolher de novo. Sem campanha ativa, cada módulo usa o seu padrão.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export function useActiveCampaignYear(institutionId: string | null | undefined): number | null {
  const [year, setYear] = useState<number | null>(null)
  useEffect(() => {
    if (!institutionId) { setYear(null); return }
    let alive = true
    supabase.from('campaign_cycles').select('target_school_year, year, status, created_at')
      .eq('institution_id', institutionId).in('status', ['active', 'released'])
      .order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => {
        if (!alive) return
        const rows = (data ?? []) as { target_school_year: number | null; year: number; status: string }[]
        const r = rows.find(x => x.status === 'active') ?? null
        setYear(r ? (r.target_school_year ?? r.year) : null)
      })
    return () => { alive = false }
  }, [institutionId])
  return year
}
