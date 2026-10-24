import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Network, ChevronDown, MessageSquare } from 'lucide-react'
import NotificationBell from './NotificationBell'
import ConversationNotifier from './ConversationNotifier'
import UserMenu from './UserMenu'
import InstallAppCard from './InstallAppCard'
import { syncPushOwner, touchSeen } from '../../lib/push'

// Seletor de instituição — troca a instituição ativa (ver
// AuthContext.switchInstitution) sem precisar logout/login. Aparece pra
// qualquer usuário com 2+ vínculos em user_institutions (Fase 2 de "usuário
// em múltiplas instituições"), com fallback pra group_institutions (gestor
// de rede legado, sem vínculo em user_institutions ainda). Quem tem só 1
// instituição não vê nada, igual sempre foi.
function InstitutionSwitcher() {
  const { user, switchInstitution } = useAuth()
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)

  if (!user) return null
  const institutions = user.available_institutions?.length ? user.available_institutions : user.group_institutions

  if (!institutions || institutions.length < 2) return null

  const handleSwitch = async (id: string) => {
    if (id === user.institution_id) { setOpen(false); return }
    setSwitching(true)
    try { await switchInstitution(id) } catch { /* erro já logado no context */ }
    setSwitching(false)
    setOpen(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        disabled={switching}
        style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 10, background: '#F0FDFB', border: '0.5px solid #D1FAE5', cursor: 'pointer', color: '#1A2B4A' }}>
        <Network size={14} color="#05907B" />
        <span style={{ fontSize: 12.5, fontWeight: 600, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.institution_name || 'Selecionar unidade'}
        </span>
        <ChevronDown size={12} color="#94A3B8" />
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', left: 0, top: 'calc(100% + 8px)', background: '#fff', borderRadius: 12, border: '0.5px solid #D1FAE5', boxShadow: '0 8px 32px rgba(0,168,150,0.12)', zIndex: 50, minWidth: 220, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '0.5px solid #E2E8F0', background: '#F0FDFB', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.3 }}>
              Suas instituições
            </div>
            {institutions.map(inst => (
              <button key={inst.id} onClick={() => handleSwitch(inst.id)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', fontSize: 13, border: 'none', background: inst.id === user.institution_id ? '#F0FDFB' : 'transparent', color: inst.id === user.institution_id ? '#05907B' : '#1A2B4A', fontWeight: inst.id === user.institution_id ? 700 : 500, cursor: 'pointer' }}
                onMouseEnter={e => { if (inst.id !== user.institution_id) (e.currentTarget as HTMLElement).style.background = '#F8FAFC' }}
                onMouseLeave={e => { if (inst.id !== user.institution_id) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                {inst.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function TopBar() {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const goSearch = () => { const q = search.trim(); if (q) { navigate(`/contacts?search=${encodeURIComponent(q)}`); setSearch('') } }
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  const [teamUnread, setTeamUnread] = useState(0)
  useEffect(() => {
    const h = (e: Event) => setTeamUnread((e as CustomEvent<number>).detail || 0)
    window.addEventListener('aion:team-unread', h)
    return () => window.removeEventListener('aion:team-unread', h)
  }, [])

  // Marca que a pessoa abriu a Áion (lembrete diário) e garante o aparelho dela nos avisos
  useEffect(() => {
    if (!user?.id) return
    syncPushOwner(); touchSeen()
    const vis = () => { if (document.visibilityState === 'visible') touchSeen() }
    document.addEventListener('visibilitychange', vis)
    return () => document.removeEventListener('visibilitychange', vis)
  }, [user?.id])

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])


  return (
    <header className="aion-topbar" style={{
      height: 58, background: '#FFFFFF',
      borderBottom: '0.5px solid #D1FAE5',
      display: 'flex', alignItems: 'center',
      padding: '0 16px', gap: 12, flexShrink: 0,
    }}>
      {/* Search */}
      <div style={{ flex: 1, maxWidth: isMobile ? 'none' : 440, position: 'relative' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') goSearch() }}
          placeholder={isMobile ? 'Buscar contato' : 'Buscar contato por nome ou telefone...'}
          style={{
            width: '100%', height: 38, paddingLeft: 38, paddingRight: 14,
            background: '#F0FDFB', border: '1.5px solid #D1FAE5',
            borderRadius: 9999, fontSize: 13, color: '#1A2B4A',
            outline: 'none', transition: 'all 0.18s ease',
          }}
          onFocus={e => { e.target.style.background = '#fff'; e.target.style.borderColor = '#05907B'; e.target.style.boxShadow = '0 0 0 3px rgba(0,168,150,0.10)' }}
          onBlur={e => { e.target.style.background = '#F0FDFB'; e.target.style.borderColor = '#D1FAE5'; e.target.style.boxShadow = 'none' }}
        />
        <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#94A3B8', pointerEvents: 'none' }}
          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Seletor de unidade — só aparece pro gestor de rede */}
        {!isMobile && <InstitutionSwitcher />}

        {/* Celular: chat da equipe (no computador é a bolinha do canto) */}
        {isMobile && user?.institution_id && (
          <button type="button" aria-label="Chat da equipe" className="aion-tap" onClick={() => window.dispatchEvent(new Event('aion:open-team-chat'))}
            style={{ position: 'relative', width: 38, height: 38, borderRadius: 12, border: '1px solid #D1FAE5', background: '#F0FDFB', color: '#05907B', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <MessageSquare size={18} />
            {teamUnread > 0 && <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 99, background: '#F43F5E', color: '#fff', fontSize: 10.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>{teamUnread > 9 ? '9+' : teamUnread}</span>}
          </button>
        )}

        {/* Bell */}
        <NotificationBell institutionId={user?.institution_id || null} isSuperAdmin={user?.user_type === 'admin_geral'} />
        {/* Avisos de conversa do WhatsApp por pessoa (transferência, assumida) */}
        <ConversationNotifier userId={user?.id || null} />

        {/* Menu do usuário: status Disponível / Ocupado / Ausente, perfil, configurações, sair */}
        <UserMenu isMobile={isMobile} />
        {user && <InstallAppCard />}
      </div>
    </header>
  )
}
