// Faixa vermelha no topo do WhatsApp quando o número da escola perdeu a conexão com a Meta.
// Lê whatsapp_connection_state (qualquer usuário da escola) e confere de novo a cada 2 minutos.
import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function WaDownBanner({ institutionId }: { institutionId?: string | null }) {
  const [st, setSt] = useState<{ down: boolean; since?: string | null } | null>(null)
  useEffect(() => {
    if (!institutionId) return
    let alive = true
    const load = () => supabase.rpc('whatsapp_connection_state', { p_inst: institutionId }).then(({ data }) => { if (alive) setSt((data as { down: boolean; since?: string | null }) ?? null) })
    load()
    const t = setInterval(load, 120000)
    return () => { alive = false; clearInterval(t) }
  }, [institutionId])
  if (!st?.down) return null
  const since = st.since ? new Date(st.since).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null
  return (
    <div role="alert" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#FEF2F2', borderBottom: '1px solid #FECACA', color: '#991B1B', fontSize: 13.5, lineHeight: 1.4 }}>
      <WifiOff size={18} style={{ flexShrink: 0 }} />
      <div><b>WhatsApp desconectado{since ? ` desde ${since}` : ''}.</b> As mensagens não saem nem chegam. Avise o gestor ou a equipe Áion para reconectar.</div>
    </div>
  )
}
