// Tela da equipe Áion: acompanhar indicações, abordar pelo WhatsApp, marcar fechou/pago e editar a campanha.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import IndicacoesAdminView from './IndicacoesAdminView'
import { MSG_PADRAO, type Indicacao, type IndStatus } from './types'

export default function AdminIndicacoes() {
  const [premio, setPremio] = useState(500)
  const [msg, setMsg] = useState(MSG_PADRAO)
  const [lista, setLista] = useState<Indicacao[]>([])
  const [aviso, setAviso] = useState<string | null>(null)
  const [pronto, setPronto] = useState(false)

  const load = useCallback(async () => {
    const [cfg, l] = await Promise.all([
      supabase.from('platform_settings').select('key,value').in('key', ['referral_prize', 'referral_message']),
      supabase.from('referrals').select('id,created_at,gestor_nome:gestor_name,gestor_whatsapp,gestor_email,escola_nome:school_name,status,premio:prize,indicador_nome:referrer_name,indicador_escola:referrer_school').order('created_at', { ascending: false }),
    ])
    for (const r of (cfg.data as any[]) ?? []) { if (r.key === 'referral_prize') setPremio(Number(r.value) || 500); if (r.key === 'referral_message' && r.value) setMsg(r.value) }
    setLista(((l.data as any[]) ?? []).map(r => ({ ...r, premio: Number(r.premio) })) as Indicacao[])
    setPronto(true)
  }, [])
  useEffect(() => { load() }, [load])

  const status = async (id: string, s: IndStatus) => {
    const { error } = await supabase.from('referrals').update({ status: s }).eq('id', id)
    if (error) setAviso('Não foi possível atualizar: ' + error.message); else { setAviso(null); load() }
  }
  const salvar = async (p: number, m: string) => {
    const { error } = await supabase.from('platform_settings').upsert([{ key: 'referral_prize', value: String(p) }, { key: 'referral_message', value: m }], { onConflict: 'key' })
    setAviso(error ? 'Não foi possível salvar: ' + error.message : 'Campanha salva.')
    if (!error) { setPremio(p); setMsg(m) }
    setTimeout(() => setAviso(null), 4000)
  }

  if (!pronto) return null
  return (
    <div style={{ padding: '12px', maxWidth: 1100, margin: '0 auto' }}>
      {aviso && <div role="status" style={{ marginBottom: 12, background: '#E6F7F5', border: '1.5px solid #BDEBE4', color: '#1A2B4A', borderRadius: 14, padding: '12px 14px', fontWeight: 700, fontSize: 14 }}>{aviso}</div>}
      <IndicacoesAdminView premio={premio} msg={msg} lista={lista} onStatus={status} onSave={salvar} />
    </div>
  )
}
