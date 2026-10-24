// Menu do usuário no topo: foto/iniciais com a bolinha do status, "Meu status"
// (Disponível / Ocupado / Ausente), Meu perfil, Configurações e Sair.
// O status só decide se a pessoa entra no revezamento de conversas NOVAS do
// WhatsApp (captação, grupos e robô). Conversas que já são dela continuam com ela.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, LogOut, Settings, UserCog, Check, ChevronDown, Loader2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'

export type Presence = 'disponivel' | 'ocupado' | 'ausente'
export const PRESENCE: Record<Presence, { label: string; color: string; desc: string }> = {
  disponivel: { label: 'Disponível', color: '#16A34A', desc: 'Recebe conversas novas do WhatsApp normalmente' },
  ocupado: { label: 'Ocupado', color: '#DC2626', desc: 'Não recebe conversas novas automáticas — está atendendo' },
  ausente: { label: 'Ausente', color: '#F59E0B', desc: 'Não recebe conversas novas — almoço, reunião ou fora' },
}
const GRAD = 'var(--aion-grad)'
const title: React.CSSProperties = { fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.06em', padding: '6px 8px 4px' }
const rowCss: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '9px 8px', border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', background: 'transparent', textDecoration: 'none', fontSize: 13.5, fontWeight: 600, color: BRAND.ink }

function Avatar({ name, size, color }: { name: string; size: number; color?: string }) {
  const ini = (name || 'U').split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join('').toUpperCase()
  return (
    <span style={{ position: 'relative', width: size, height: size, flexShrink: 0, display: 'inline-block' }}>
      <span style={{ width: size, height: size, borderRadius: '50%', background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.38), fontWeight: 800, color: '#fff' }}>{ini}</span>
      {color && <span style={{ position: 'absolute', right: -1, bottom: -1, width: Math.max(10, size * 0.3), height: Math.max(10, size * 0.3), borderRadius: '50%', background: color, border: '2px solid #fff', transition: 'background .2s' }} />}
    </span>
  )
}

export default function UserMenu({ isMobile }: { isMobile?: boolean }) {
  const { user, signOut, switchInstitution } = useAuth()
  const [switching, setSwitching] = useState(false)
  const [open, setOpen] = useState(false)
  const [presence, setPresence] = useState<Presence>(user?.is_available === false ? 'ausente' : 'disponivel')
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    let alive = true
    supabase.from('users').select('presence, is_available').eq('id', user.id).maybeSingle().then(({ data }) => {
      const d = data as { presence?: Presence; is_available?: boolean } | null
      if (alive && d) setPresence(d.is_available === false && d.presence === 'disponivel' ? 'ausente' : (d.presence || 'disponivel'))
    })
    return () => { alive = false }
  }, [user?.id, user?.institution_id])

  if (!user) return null
  const roleLabel = user.role === 'admin' ? 'Administrador' : user.role === 'manager' ? 'Gestor' : 'Consultor'
  const canSettings = user.role === 'admin' || user.role === 'manager'
  const cur = PRESENCE[presence]
  const institutions = user.available_institutions?.length ? user.available_institutions : user.group_institutions
  const showInst = !!isMobile && !!institutions && institutions.length >= 2
  const pickInst = async (id: string) => {
    if (id === user.institution_id || switching) return
    setSwitching(true)
    try { await switchInstitution(id) } catch { /* erro já logado no context */ }
    setSwitching(false); setOpen(false)
  }

  const change = async (p: Presence) => {
    if (saving || p === presence) return
    const prev = presence
    setPresence(p); setSaving(true); setFailed(false)
    const { error } = await supabase.rpc('set_my_presence', { p_presence: p })
    setSaving(false)
    if (error) { setPresence(prev); setFailed(true) }
  }

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={() => setOpen(v => !v)} aria-haspopup="menu" aria-expanded={open} aria-label={`Menu de ${user.full_name} — ${cur.label}`}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: isMobile ? 3 : '4px 10px 4px 4px', borderRadius: 999, background: BRAND.softer, border: `1px solid ${BRAND.softLine}`, cursor: 'pointer', fontFamily: 'inherit' }}>
        <Avatar name={user.full_name || ''} size={34} color={cur.color} />
        {!isMobile && (
          <span style={{ lineHeight: 1.2, textAlign: 'left' }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: BRAND.ink, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.full_name}</span>
            <span style={{ display: 'block', fontSize: 11, color: cur.color, fontWeight: 700 }}>{cur.label}</span>
          </span>
        )}
        {!isMobile && <ChevronDown size={13} color="#94A3B8" style={{ transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }} />}
      </button>

      {open && <>
        <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
        <div role="menu" className="ld-in" style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 310, maxWidth: 'calc(100vw - 24px)', background: '#fff', borderRadius: 18, border: `1px solid ${BRAND.line}`, boxShadow: '0 18px 44px -16px rgba(26,43,74,.38)', zIndex: 50, overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '16px', background: GRAD, color: '#fff' }}>
            <Avatar name={user.full_name || ''} size={46} color={cur.color} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.full_name}</div>
              <div style={{ fontSize: 12, opacity: .88, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
              <div style={{ fontSize: 11.5, opacity: .88 }}>{roleLabel}{user.institution_name ? ` · ${user.institution_name}` : ''}</div>
            </div>
          </div>

          <div style={{ padding: '8px 8px 4px' }}>
            <div style={title}>Meu status {saving && <Loader2 size={11} className="animate-spin" style={{ verticalAlign: -1, marginLeft: 4 }} />}</div>
            {(Object.keys(PRESENCE) as Presence[]).map(p => (
              <button key={p} role="menuitemradio" aria-checked={presence === p} onClick={() => change(p)}
                style={{ ...rowCss, alignItems: 'flex-start', background: presence === p ? BRAND.softer : 'transparent', transition: 'background .15s' }}
                onMouseEnter={e => { if (presence !== p) e.currentTarget.style.background = '#F8FAFC' }}
                onMouseLeave={e => { if (presence !== p) e.currentTarget.style.background = 'transparent' }}>
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: PRESENCE[p].color, flexShrink: 0, marginTop: 4, boxShadow: presence === p ? `0 0 0 4px ${PRESENCE[p].color}26` : 'none', transition: 'box-shadow .2s' }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 800, color: BRAND.ink }}>{PRESENCE[p].label}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: BRAND.muted, lineHeight: 1.35, fontWeight: 500 }}>{PRESENCE[p].desc}</span>
                </span>
                {presence === p && <Check size={15} color={BRAND.primaryDark} style={{ marginTop: 3 }} />}
              </button>
            ))}
            <div style={{ fontSize: 11.5, color: BRAND.muted, padding: '2px 8px 8px', lineHeight: 1.4 }}>Conversas que já são suas continuam com você. Vale para a escola em que você está agora.</div>
            {failed && <div style={{ margin: '0 8px 8px', fontSize: 12, color: '#B91C1C', fontWeight: 700 }}>Não consegui salvar. Tente de novo.</div>}
          </div>

          {showInst && (
            <div style={{ padding: '6px 8px 6px', borderTop: `1px solid ${BRAND.line}`, maxHeight: 200, overflowY: 'auto' }}>
              <div style={title}>Minhas instituições {switching && <Loader2 size={11} className="animate-spin" style={{ verticalAlign: -1, marginLeft: 4 }} />}</div>
              {institutions!.map(inst => (
                <button key={inst.id} onClick={() => pickInst(inst.id)} style={{ ...rowCss, background: inst.id === user.institution_id ? BRAND.softer : 'transparent', color: inst.id === user.institution_id ? BRAND.primaryDark : BRAND.ink, fontWeight: inst.id === user.institution_id ? 800 : 600 }}>
                  <Building2 size={16} color={inst.id === user.institution_id ? BRAND.primaryDark : BRAND.muted} />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inst.name}</span>
                  {inst.id === user.institution_id && <Check size={15} color={BRAND.primaryDark} />}
                </button>
              ))}
            </div>
          )}

          <div style={{ padding: '4px 8px 8px', borderTop: `1px solid ${BRAND.line}` }}>
            <Link to="/profile" onClick={() => setOpen(false)} style={rowCss}><UserCog size={16} color={BRAND.muted} />Editar meu perfil</Link>
            {canSettings && <Link to="/settings" onClick={() => setOpen(false)} style={rowCss}><Settings size={16} color={BRAND.muted} />Configurações</Link>}
            <button onClick={async () => { try { await signOut() } catch { /* */ } }} style={{ ...rowCss, color: '#E11D48' }}><LogOut size={16} />Sair</button>
          </div>
        </div>
      </>}
    </div>
  )
}
