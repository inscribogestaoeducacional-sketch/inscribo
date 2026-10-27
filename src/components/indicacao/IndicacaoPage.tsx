// Tela "Indique e ganhe" dentro da Áion Edu (usuários das escolas).
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import IndicacaoView from './IndicacaoView'
import type { Indicacao } from './types'

export default function IndicacaoPage() {
  const [premio, setPremio] = useState(500)
  const [lista, setLista] = useState<Indicacao[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)

  const load = useCallback(async () => {
    const [p, l] = await Promise.all([
      supabase.rpc('referral_prize_value'),
      supabase.from('referrals').select('id,created_at,gestor_nome:gestor_name,gestor_whatsapp,gestor_email,escola_nome:school_name,status,premio:prize').order('created_at', { ascending: false }),
    ])
    if (typeof p.data === 'number' || typeof p.data === 'string') setPremio(Number(p.data))
    setLista(((l.data as any[]) ?? []).map(r => ({ ...r, premio: Number(r.premio) })) as Indicacao[])
  }, [])
  useEffect(() => { load() }, [load])

  const enviar = async (v: { gestor_nome: string; gestor_whatsapp: string; escola_nome: string; gestor_email: string }) => {
    const { data, error } = await supabase.rpc('create_referral', { p_gestor_name: v.gestor_nome, p_gestor_whatsapp: v.gestor_whatsapp, p_school_name: v.escola_nome, p_gestor_email: v.gestor_email || null })
    if (error) { setMsg('Não foi possível enviar: ' + error.message); return }
    setMsg((data as any)?.status === 'ja_no_crm' ? 'Esse gestor já estava em contato com a Áion, então a indicação não vale.' : 'Indicação enviada! Nossa equipe vai falar com o gestor.')
    setFormKey(k => k + 1)
    load()
    setTimeout(() => setMsg(null), 6000)
  }

  return (
    <div style={{ padding: '12px', maxWidth: 1100, margin: '0 auto' }}>
      {msg && <div role="status" style={{ marginBottom: 12, background: '#E6F7F5', border: '1.5px solid #BDEBE4', color: '#1A2B4A', borderRadius: 14, padding: '12px 14px', fontWeight: 700, fontSize: 14 }}>{msg}</div>}
      <IndicacaoView key={formKey} premio={premio} lista={lista} onSend={enviar} />
    </div>
  )
}
