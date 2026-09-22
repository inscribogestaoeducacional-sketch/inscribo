import React, { useState } from 'react'
import { Building2, ArrowRight, LogOut, Loader2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

// Tela de seleção de instituição pós-login — só aparece quando o usuário tem
// 2+ vínculos em user_institutions e nenhum deles é a instituição ativa
// atual (ver needsInstitutionSelection em AuthContext.loadUserProfile).
// Depois de escolher, o próximo login já entra direto nesta mesma unidade
// (active_institution_id fica salvo) — só reabre se o usuário trocar depois
// pelo seletor do TopBar.
export default function InstitutionSelectionScreen() {
  const { user, switchInstitution, signOut } = useAuth()
  const [selectingId, setSelectingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const institutions = user?.available_institutions || []

  const handleSelect = async (id: string) => {
    setError('')
    setSelectingId(id)
    try {
      await switchInstitution(id)
    } catch (e: any) {
      setError(e?.message || 'Erro ao selecionar instituição. Tente novamente.')
      setSelectingId(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 560 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/aion-logo-full.png" alt="Aion Edu" style={{ height: 36, objectFit: 'contain', marginBottom: 24 }} />
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A2B4A', margin: '0 0 8px' }}>Qual instituição você quer acessar?</h1>
          <p style={{ fontSize: 14, color: '#64748B', margin: 0 }}>
            {user?.full_name ? `Olá, ${user.full_name}! Você` : 'Você'} tem acesso a mais de uma instituição.
          </p>
        </div>

        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#DC2626', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {institutions.map(inst => {
            const loading = selectingId === inst.id
            return (
              <button
                key={inst.id}
                onClick={() => handleSelect(inst.id)}
                disabled={!!selectingId}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left',
                  padding: '18px 20px', borderRadius: 16, border: '1px solid #E5E7EB', background: '#fff',
                  cursor: selectingId ? 'default' : 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                  opacity: selectingId && !loading ? 0.5 : 1, transition: 'opacity 0.15s',
                }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#F0FDFB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                  {inst.logo_url
                    ? <img src={inst.logo_url} alt={inst.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <Building2 size={20} color="#00A896" />}
                </div>
                <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#1A2B4A' }}>{inst.name}</span>
                {loading
                  ? <Loader2 size={18} color="#00A896" className="animate-spin" />
                  : <ArrowRight size={18} color="#94A3B8" />}
              </button>
            )
          })}
        </div>

        <button
          onClick={signOut}
          style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '32px auto 0', background: 'none', border: 'none', color: '#94A3B8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          <LogOut size={14} /> Sair
        </button>
      </div>
    </div>
  )
}
