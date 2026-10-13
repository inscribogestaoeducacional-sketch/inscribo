// src/components/management/LgpdAddendumBlock.tsx
//
// Configurações → Integrações: "Aditivo de proteção de dados (LGPD)".
// Enquanto a escola não aceitou: resumo de 5 linhas, link para o texto
// completo e "Li e aceito" (só admin da escola; o banco confere de novo).
// O aceite registra escola, usuário, data/hora, versão, hash do texto, IP e
// navegador, e liga a chave "Aditivo LGPD assinado" — a mesma que o Super
// Admin liga à mão. Nomes NÃO voltam sozinhos: só no próximo envio/carga com
// "Guardar nomes" marcada.
import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck, Loader2, ExternalLink, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { LGPD_SUMMARY, fetchLgpdText } from '../../lib/lgpdAddendum'

type Status = {
  names_allowed: boolean; current_version: string | null; current_sha256: string | null; can_accept: boolean
  last: { action: string; user_name: string | null; created_at: string; text_version: string | null } | null
}

export default function LgpdAddendumBlock({ institutionId, onAccepted }: { institutionId: string; onAccepted: () => void }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('base_lgpd_status', { p_institution_id: institutionId })
    setStatus((data as Status) ?? null)
  }, [institutionId])
  useEffect(() => { load() }, [load])

  if (!status) return null

  if (status.names_allowed) {
    const l = status.last
    return (
      <p style={{ fontSize: 12, color: '#047857', margin: 0, display: 'flex', gap: 6, alignItems: 'center' }}>
        <ShieldCheck size={14} /> Aditivo de proteção de dados (LGPD) aceito
        {l && <> · {l.action === 'aceite' ? `por ${l.user_name ?? 'administrador'}` : 'registrado pela Áion'} em {new Date(l.created_at).toLocaleString('pt-BR')}{l.text_version ? ` (${l.text_version})` : ''}</>}
      </p>
    )
  }

  const version = status.current_version
  const accept = async () => {
    if (!version) return
    if (!window.confirm('Confirmar o aceite do Aditivo de Proteção de Dados (LGPD) em nome da escola? O aceite fica registrado com seu usuário, data, hora e IP.')) return
    setBusy(true); setError('')
    try {
      const t = await fetchLgpdText(version)
      if (!t) throw new Error('Não foi possível abrir o texto do aditivo. Tente de novo.')
      if (status.current_sha256 && t.sha256 !== status.current_sha256) throw new Error('O texto aberto não é o mesmo da versão publicada. Recarregue a página.')
      const { error: e } = await supabase.rpc('base_accept_lgpd', { p_institution_id: institutionId, p_version: version, p_text_sha256: t.sha256 })
      if (e) throw new Error(e.message)
      await load()
      onAccepted()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #FDE68A', padding: 20 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <ShieldCheck size={16} color="#B45309" /> Aditivo de proteção de dados (LGPD)
      </h3>
      <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 10px', lineHeight: 1.6 }}>
        Para guardar nomes de alunos e responsáveis, a escola precisa aceitar o aditivo. Até lá, o sistema guarda só matrícula, série e situação.
      </p>
      <ol style={{ fontSize: 13, color: '#334155', margin: '0 0 12px', paddingLeft: 20, lineHeight: 1.6 }}>
        {LGPD_SUMMARY.map(l => <li key={l}>{l}</li>)}
      </ol>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <a href={`/aditivo-lgpd${version ? `?v=${version}` : ''}`} target="_blank" rel="noreferrer"
          style={{ fontSize: 13, fontWeight: 600, color: '#00A896', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
          Ler o texto completo{version ? ` (${version})` : ''} <ExternalLink size={13} />
        </a>
        {status.can_accept && (
          <button onClick={accept} disabled={!version || busy}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, border: 'none',
              background: '#00A896', color: '#fff', fontSize: 13, fontWeight: 700, cursor: !version || busy ? 'not-allowed' : 'pointer', opacity: !version || busy ? 0.55 : 1 }}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} Li e aceito
          </button>
        )}
        {!status.can_accept && <span style={{ fontSize: 12, color: '#94A3B8' }}>Só o administrador da escola pode aceitar.</span>}
      </div>
      {!version && <p style={{ fontSize: 12, color: '#B45309', margin: '10px 0 0' }}>O texto final do aditivo ainda não foi publicado pela Áion; o aceite fica disponível em seguida.</p>}
      {error && <p style={{ fontSize: 12, color: '#B91C1C', margin: '10px 0 0' }}><AlertTriangle size={13} style={{ verticalAlign: -2 }} /> {error}</p>}
    </div>
  )
}
