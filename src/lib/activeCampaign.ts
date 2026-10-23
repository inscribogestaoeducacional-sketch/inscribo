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

export interface ActiveCampaign { year: number; label: string; start: string; end: string }

/** Campanha ativa com datas (para os módulos oferecerem o período "Campanha"). */
export function useActiveCampaign(institutionId: string | null | undefined): ActiveCampaign | null {
  const [c, setC] = useState<ActiveCampaign | null>(null)
  useEffect(() => {
    if (!institutionId) { setC(null); return }
    let alive = true
    supabase.from('campaign_cycles').select('target_school_year, year, label, start_date, end_date')
      .eq('institution_id', institutionId).eq('status', 'active').not('start_date', 'is', null).not('end_date', 'is', null)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => {
        if (!alive) return
        const r = data as { target_school_year: number | null; year: number; label: string | null; start_date: string; end_date: string } | null
        setC(r ? { year: r.target_school_year ?? r.year, label: r.label || `Campanha ${r.target_school_year ?? r.year}`, start: r.start_date, end: r.end_date } : null)
      })
    return () => { alive = false }
  }, [institutionId])
  return c
}
