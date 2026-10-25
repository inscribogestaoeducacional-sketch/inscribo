import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { DEFAULT_OFF_MODULES } from '../../../contexts/PermissionsContext'
import { useBroadcastEnabled } from '../../../lib/broadcasts'
import { cardBtn } from '../../mobile/StatStrip'
import {
  X, Eye, EyeOff, Mail, CheckCircle, Key, AlertTriangle, Loader2, RotateCcw, ChevronDown, ChevronUp,
  UserPlus, UserCog, Shield, UserCheck, Users, Lock, UserX, MessageCircle, History, Check,
} from 'lucide-react'

// ─── Tipos e constantes compartilhados ───────────────────────────────────────
export const PERM_MODULES = [
  { id: 'inicio',         label: 'Início',         icon: '🏠', desc: 'Painel com resumo e indicadores gerais' },
  { id: 'leads',          label: 'Leads',          icon: '👥', desc: 'Gestão do funil de captação de alunos' },
  { id: 'contatos',       label: 'Contatos',       icon: '📋', desc: 'Base de contatos e histórico' },
  { id: 'visitas',        label: 'Visitas',        icon: '📅', desc: 'Agendamento e controle de visitas' },
  { id: 'whatsapp',       label: 'WhatsApp',       icon: '💬', desc: 'Hub de atendimento e fluxos' },
  { id: 'captacao',       label: 'Captação',       icon: '📣', desc: 'Gatilhos de campanha e dashboard de origem (desligado por padrão)' },
  { id: 'vitrine',        label: 'Vitrine',        icon: '🏫', desc: 'Página pública da escola com links, WhatsApp e matrícula (desligado por padrão)' },
  { id: 'transmissoes',   label: 'Transmissões',   icon: '📨', desc: 'Campanhas de disparo em massa com template aprovado (desligado por padrão)' },
  { id: 'base_alunos',    label: 'Base de alunos', icon: '🎓', desc: 'Painel de rematrícula e lista de quem falta rematricular (desligado por padrão)' },
  { id: 'relatorios',     label: 'Relatórios',     icon: '📊', desc: 'Métricas e relatórios de desempenho' },
  { id: 'transferencias', label: 'Transferências', icon: '↔️', desc: 'Transferência de leads entre atendentes' },
  { id: 'pesquisas',      label: 'Pesquisas',      icon: '⭐', desc: 'Pesquisas de satisfação e resultados' },
  { id: 'usuarios',       label: 'Usuários',       icon: '👤', desc: 'Gestão de usuários e permissões' },
  { id: 'configuracoes',  label: 'Configurações',  icon: '⚙️', desc: 'Configurações gerais do sistema' },
]

export interface AppUser {
  id: string
  full_name: string
  email: string
  role: 'admin' | 'manager' | 'user'
  institution_id: string
  active: boolean
  created_at: string
  institutions?: { name: string }
  can_see_all_conversations?: boolean
  can_see_full_history?: boolean
}

export const roleLabel = (r: string) => r === 'admin' ? 'Administrador' : r === 'manager' ? 'Gestor' : 'Consultor'
export const roleBg = (r: string) => r === 'admin' ? '#FEE2E2' : r === 'manager' ? '#EDE9FE' : '#E6F7F5'
export const roleColor = (r: string) => r === 'admin' ? '#DC2626' : r === 'manager' ? '#7C3AED' : '#00695F'

export function useIsMobile() {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    const h = () => setM(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return m
}

const defaultMap = () => {
  const map: Record<string, boolean> = {}
  PERM_MODULES.forEach(m => { map[m.id] = !DEFAULT_OFF_MODULES.includes(m.id) })
  return map
}

// ─── Peças visuais ───────────────────────────────────────────────────────────
const CSS = `
.animate-spin{animation:spin 1s linear infinite}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.um-in{width:100%;box-sizing:border-box;height:46px;padding:0 14px;border:1.5px solid #E3E8F0;border-radius:12px;font-size:14px;font-family:inherit;color:#1A2B4A;background:#fff;outline:none;transition:border-color .15s, box-shadow .15s}
.um-in:focus{border-color:#05907B;box-shadow:0 0 0 3px rgba(5,144,123,.15)}
.um-in:disabled{background:#F5F7FA;color:#94A3B8}
.um-in::placeholder{color:#94A3B8}
.um-sk{animation:umPulse 1.4s ease-in-out infinite}@keyframes umPulse{0%,100%{opacity:1}50%{opacity:.55}}
`
export const UserCss = () => <style>{CSS}</style>

export function Switch({ on }: { on: boolean }) {
  return (
    <span aria-hidden style={{ width: 44, height: 26, borderRadius: 999, background: on ? '#05907B' : '#CBD5E1', flexShrink: 0, position: 'relative', transition: 'background .2s', display: 'inline-block' }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, background: '#fff', borderRadius: '50%', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
    </span>
  )
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <div aria-hidden style={{ width: size, height: size, borderRadius: size * 0.34, background: 'var(--aion-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  )
}

export function RoleBadge({ role }: { role: string }) {
  return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: roleBg(role), color: roleColor(role), whiteSpace: 'nowrap' }}>{roleLabel(role)}</span>
}

const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#1A2B4A', display: 'block', marginBottom: 6 }
const hint: React.CSSProperties = { fontSize: 11.5, color: '#5B6B86', margin: '5px 0 0', lineHeight: 1.4 }

// Janela no padrão do sistema: tela cheia no celular (classe m-sheet), cartão centralizado no computador.
export function ModalShell({ title, subtitle, icon: Icon, iconColor = '#05907B', iconBg = '#E6F7F5', onClose, children, footer, maxWidth = 560 }: {
  title: string; subtitle?: string; icon: React.ElementType; iconColor?: string; iconBg?: string
  onClose: () => void; children: React.ReactNode; footer: React.ReactNode; maxWidth?: number
}) {
  return (
    <div className="m-sheet" role="dialog" aria-modal="true" aria-label={title}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <UserCss />
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.25)', border: '1px solid #E3E8F0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'max(14px, env(safe-area-inset-top)) 14px 14px 18px', borderBottom: '1px solid #EEF2F7', flexShrink: 0 }}>
          <span style={{ width: 40, height: 40, borderRadius: 13, background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={20} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: '#1A2B4A', margin: 0, lineHeight: 1.25 }}>{title}</h2>
            {subtitle && <p style={{ fontSize: 12.5, color: '#5B6B86', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="aion-tap"
            style={{ width: 44, height: 44, borderRadius: 12, border: 'none', background: '#F1F5F9', color: '#5B6B86', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '18px 18px 20px' }}>{children}</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end', padding: '12px 18px max(12px, env(safe-area-inset-bottom))', borderTop: '1px solid #EEF2F7', background: '#fff', flexShrink: 0 }}>
          {footer}
        </div>
      </div>
    </div>
  )
}

const Err = ({ children }: { children: React.ReactNode }) => (
  <div role="alert" style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#DC2626', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
    <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} /><span>{children}</span>
  </div>
)

const footBtn = (kind: 'primary' | 'ghost' | 'danger', mobile: boolean, extra: React.CSSProperties = {}) =>
  cardBtn(kind, mobile ? { flex: '1 1 0', ...extra } : { flex: '0 0 auto', padding: '10px 22px', ...extra })

function ToggleRow({ on, onChange, title, desc, icon: Icon }: { on: boolean; onChange: () => void; title: string; desc?: string; icon?: React.ElementType }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onChange} className="aion-tap"
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: on ? '#F0FDFB' : '#fff', borderRadius: 14, border: `1.5px solid ${on ? '#BDEBE4' : '#E3E8F0'}`, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
      {Icon && <span style={{ width: 36, height: 36, borderRadius: 11, background: on ? '#E6F7F5' : '#F1F5F9', color: on ? '#05907B' : '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={17} /></span>}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: '#1A2B4A' }}>{title}</span>
        {desc && <span style={{ display: 'block', fontSize: 12, color: '#5B6B86', marginTop: 2, lineHeight: 1.4 }}>{desc}</span>}
      </span>
      <Switch on={on} />
    </button>
  )
}

const ROLE_OPTIONS: { id: 'user' | 'manager' | 'admin'; label: string; desc: string; icon: React.ElementType }[] = [
  { id: 'user', label: 'Consultor', desc: 'Leads, visitas e matrículas', icon: Users },
  { id: 'manager', label: 'Gestor', desc: 'Marketing, funil e relatórios', icon: UserCheck },
  { id: 'admin', label: 'Administrador', desc: 'Acesso completo', icon: Shield },
]

// ─── Modal Novo/Editar Usuário ────────────────────────────────────────────────
export function UserModal({ isOpen, onClose, onSave, editingUser, institutionId }: {
  isOpen: boolean; onClose: () => void; onSave: (data: any) => Promise<void>; editingUser?: AppUser | null; institutionId?: string
}) {
  const mobile = useIsMobile()
  const [formData, setFormData] = useState({ full_name: '', email: '', role: 'user' as any, password: '', confirmPassword: '', active: true, can_see_all_conversations: false, can_see_full_history: false })
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [permMap, setPermMap] = useState<Record<string, boolean>>({})
  // Fase 6.1: Transmissões também depende da liberação da escola (Super Admin,
  // broadcast_settings). Mostra quando o módulo não está liberado, pra a
  // permissão do usuário não parecer suficiente sozinha.
  const broadcastEnabled = useBroadcastEnabled(institutionId)
  const schoolBlocked = (moduleId: string) => moduleId === 'transmissoes' && broadcastEnabled === false
  const [loadingPerms, setLoadingPerms] = useState(false)

  const isConsultor = (role: string) => role !== 'admin' && role !== 'manager'

  useEffect(() => {
    if (editingUser) {
      setFormData({ full_name: editingUser.full_name, email: editingUser.email, role: editingUser.role, password: '', confirmPassword: '', active: editingUser.active, can_see_all_conversations: editingUser.can_see_all_conversations ?? false, can_see_full_history: editingUser.can_see_full_history ?? false })
      if (isConsultor(editingUser.role)) {
        setLoadingPerms(true)
        // Escopado pela instituição ATIVA do admin que está editando — sem
        // isso, um usuário com vínculo em 2+ escolas mostraria os módulos
        // configurados pra outra escola (ou nenhum, se a linha pertencer a
        // ela). Ver migration 20260922010000_user_permissions_institution_scope.
        supabase.from('user_permissions').select('module, enabled').eq('user_id', editingUser.id).eq('institution_id', institutionId ?? '')
          .then(({ data }) => {
            const map = defaultMap()
            if (data) for (const row of data) map[row.module] = row.enabled
            setPermMap(map)
            setLoadingPerms(false)
          }, () => setLoadingPerms(false))
      } else {
        setPermMap({})
      }
    } else {
      setFormData({ full_name: '', email: '', role: 'user', password: '', confirmPassword: '', active: true, can_see_all_conversations: false, can_see_full_history: false })
      setPermMap(defaultMap())
    }
    setShowPwd(false)
    setError('')
  }, [editingUser, isOpen, institutionId])

  useEffect(() => {
    if (!editingUser && isConsultor(formData.role)) setPermMap(defaultMap())
    else if (!isConsultor(formData.role)) setPermMap({})
  }, [formData.role])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!editingUser) {
      if (formData.password !== formData.confirmPassword) return setError('As senhas não coincidem')
      if (formData.password.length < 6) return setError('Senha mínima: 6 caracteres')
    }
    setLoading(true)
    try {
      const payload = isConsultor(formData.role) ? { ...formData, permissions: permMap } : formData
      await onSave(payload)
      onClose()
    }
    catch (err: any) { setError(err.message || 'Erro ao salvar') }
    finally { setLoading(false) }
  }

  if (!isOpen) return null

  const showPerms = isConsultor(formData.role)
  const set = (patch: Partial<typeof formData>) => setFormData(f => ({ ...f, ...patch }))
  const isOn = (id: string) => permMap[id] ?? !DEFAULT_OFF_MODULES.includes(id)
  const enabledCount = PERM_MODULES.filter(m => isOn(m.id)).length

  return (
    <ModalShell
      onClose={onClose} maxWidth={620}
      icon={editingUser ? UserCog : UserPlus}
      title={editingUser ? 'Editar usuário' : 'Novo usuário'}
      subtitle={editingUser ? editingUser.email : 'Crie o acesso de uma pessoa da equipe'}
      footer={<>
        <button type="button" onClick={onClose} className="aion-tap" style={footBtn('ghost', mobile)}>Cancelar</button>
        <button type="submit" form="user-form" disabled={loading} className="aion-tap" style={footBtn('primary', mobile, { opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 })}>
          {loading ? <><Loader2 size={14} className="animate-spin" />{editingUser ? 'Salvando...' : 'Criando...'}</> : editingUser ? 'Salvar alterações' : 'Criar usuário'}
        </button>
      </>}>
      {error && <Err>{error}</Err>}

      <form id="user-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={label} htmlFor="um-name">Nome completo *</label>
            <input id="um-name" required className="um-in" placeholder="Nome do usuário" autoComplete="off" value={formData.full_name} onChange={e => set({ full_name: e.target.value })} />
          </div>
          <div>
            <label style={label} htmlFor="um-email">E-mail *</label>
            <input id="um-email" required type="email" inputMode="email" autoCapitalize="none" className="um-in" placeholder="email@escola.com" value={formData.email} disabled={!!editingUser} onChange={e => set({ email: e.target.value })} />
            {editingUser && <p style={hint}>O e-mail não pode ser alterado.</p>}
          </div>
        </div>

        <div>
          <span style={label}>Perfil de acesso *</span>
          <div role="radiogroup" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {ROLE_OPTIONS.map(o => {
              const on = formData.role === o.id
              const Icon = o.icon
              return (
                <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => set({ role: o.id })} className="aion-tap"
                  style={{ display: 'flex', flexDirection: mobile ? 'row' : 'column', alignItems: mobile ? 'center' : 'flex-start', gap: mobile ? 12 : 6, padding: '12px 12px', borderRadius: 14, border: `1.5px solid ${on ? '#05907B' : '#E3E8F0'}`, background: on ? '#F0FDFB' : '#fff', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', position: 'relative' }}>
                  <span style={{ width: 32, height: 32, borderRadius: 10, background: on ? '#E6F7F5' : '#F1F5F9', color: on ? '#05907B' : '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={16} /></span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0, paddingRight: mobile ? 24 : 0 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: '#1A2B4A' }}>{o.label}</span>
                    <span style={{ fontSize: 12, color: '#5B6B86', lineHeight: 1.35 }}>{o.desc}</span>
                  </span>
                  {on && <span style={{ position: 'absolute', top: mobile ? 'calc(50% - 10px)' : 10, right: 10, width: 20, height: 20, borderRadius: 99, background: '#05907B', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={12} strokeWidth={3} /></span>}
                </button>
              )
            })}
          </div>
        </div>

        {!editingUser && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={label} htmlFor="um-pwd">Senha *</label>
              <div style={{ position: 'relative' }}>
                <input id="um-pwd" required type={showPwd ? 'text' : 'password'} autoComplete="new-password" className="um-in" placeholder="Mínimo 6 caracteres" minLength={6} value={formData.password} onChange={e => set({ password: e.target.value })} style={{ paddingRight: 48 }} />
                <button type="button" onClick={() => setShowPwd(!showPwd)} aria-label={showPwd ? 'Esconder senha' : 'Mostrar senha'}
                  style={{ position: 'absolute', right: 2, top: 1, width: 44, height: 44, background: 'none', border: 'none', cursor: 'pointer', color: '#5B6B86', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{showPwd ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </div>
            </div>
            <div>
              <label style={label} htmlFor="um-pwd2">Confirmar senha *</label>
              <input id="um-pwd2" required type={showPwd ? 'text' : 'password'} autoComplete="new-password" className="um-in" placeholder="Repita a senha" value={formData.confirmPassword} onChange={e => set({ confirmPassword: e.target.value })} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ToggleRow on={formData.active} onChange={() => set({ active: !formData.active })} icon={CheckCircle}
            title="Usuário ativo no sistema" desc={formData.active ? 'Pode entrar e usar o sistema.' : 'Não consegue entrar enquanto estiver desativado.'} />
          {showPerms && (
            <ToggleRow on={formData.can_see_all_conversations} onChange={() => set({ can_see_all_conversations: !formData.can_see_all_conversations })} icon={MessageCircle}
              title="Pode ver todas as conversas do WhatsApp"
              desc="Quando ativado, este usuário enxerga todas as conversas da instituição, incluindo as atribuídas a outros atendentes." />
          )}
          {showPerms && (
            <ToggleRow on={formData.can_see_full_history} onChange={() => set({ can_see_full_history: !formData.can_see_full_history })} icon={History}
              title="Ver histórico completo ao receber transferência"
              desc="Quando ativado, ao receber uma conversa transferida este usuário vê todo o histórico anterior. Quando desativado, vê apenas as mensagens a partir do momento que assumiu." />
          )}
        </div>

        {showPerms ? (
          <div style={{ border: '1px solid #E3E8F0', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: '#F8FAFC', borderBottom: '1px solid #E3E8F0', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 32, height: 32, borderRadius: 10, background: '#E6F7F5', color: '#05907B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Lock size={16} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13.5, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>Acesso aos módulos</p>
                <p style={{ fontSize: 12, color: '#5B6B86', margin: '2px 0 0' }}>Administradores e gestores têm acesso total.</p>
              </div>
              {!loadingPerms && <span style={{ fontSize: 12, fontWeight: 800, color: '#00695F', background: '#E6F7F5', borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>{enabledCount} de {PERM_MODULES.length}</span>}
            </div>
            {loadingPerms ? (
              <div style={{ textAlign: 'center', padding: 28 }}><Loader2 size={20} color="#05907B" className="animate-spin" style={{ margin: '0 auto' }} /></div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#E3E8F0' }}>
                {PERM_MODULES.map(m => {
                  const enabled = isOn(m.id)
                  return (
                    <button key={m.id} type="button" role="switch" aria-checked={enabled} onClick={() => setPermMap(p => ({ ...p, [m.id]: !(p[m.id] ?? !DEFAULT_OFF_MODULES.includes(m.id)) }))}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', minHeight: 56, background: '#fff', cursor: 'pointer', border: 'none', textAlign: 'left', fontFamily: 'inherit', width: '100%' }}>
                      <span style={{ width: 34, height: 34, borderRadius: 10, background: enabled ? '#E6F7F5' : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, filter: enabled ? 'none' : 'grayscale(1)', opacity: enabled ? 1 : .7 }}>{m.icon}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: enabled ? '#1A2B4A' : '#94A3B8' }}>{m.label}</span>
                          {schoolBlocked(m.id) && (
                            <span title="A Áion ainda não liberou este módulo para a escola. Mesmo ligado aqui, o usuário não vai vê-lo."
                              style={{ fontSize: 10, fontWeight: 700, color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 999, padding: '1px 7px', whiteSpace: 'nowrap' }}>
                              não liberado p/ a escola
                            </span>
                          )}
                        </span>
                        <span style={{ display: 'block', fontSize: 11.5, color: '#5B6B86', marginTop: 2, lineHeight: 1.35 }}>{m.desc}</span>
                      </span>
                      <Switch on={enabled} />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: '#F0FDFB', border: '1px solid #BDEBE4', borderRadius: 14, padding: '12px 14px', fontSize: 13, color: '#00695F', display: 'flex', gap: 10, alignItems: 'flex-start', lineHeight: 1.45 }}>
            <Shield size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{formData.role === 'admin' ? 'Administradores' : 'Gestores'} têm acesso total a todos os módulos, sem precisar liberar um a um.</span>
          </div>
        )}

        {!editingUser && (
          <div style={{ background: '#EFF6FF', border: '1px solid #DBEAFE', borderRadius: 14, padding: '12px 14px', fontSize: 13, color: '#1D4ED8', display: 'flex', gap: 10, alignItems: 'flex-start', lineHeight: 1.45 }}>
            <Key size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>Um e-mail de boas-vindas com os dados de acesso será enviado automaticamente para o usuário.</span>
          </div>
        )}
      </form>
    </ModalShell>
  )
}

// ─── Modal Alterar Senha ──────────────────────────────────────────────────────
export function PasswordModal({ isOpen, onClose, targetUser }: { isOpen: boolean; onClose: () => void; targetUser: AppUser | null }) {
  const mobile = useIsMobile()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => { setError(''); setSuccess(false) }, [isOpen])

  const handleSubmit = async () => {
    setLoading(true); setError('')
    try {
      // Usa edge function ou admin API — aqui usamos reset por email como fallback seguro
      const { error } = await supabase.auth.resetPasswordForEmail(targetUser!.email, {
        redirectTo: `${window.location.origin}/reset-password`
      })
      if (error) throw error
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar email de redefinição')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !targetUser) return null

  return (
    <ModalShell onClose={onClose} maxWidth={440} icon={Key} iconColor="#7C3AED" iconBg="#EDE9FE"
      title="Redefinir senha" subtitle={targetUser.full_name}
      footer={success ? (
        <button type="button" onClick={onClose} className="aion-tap" style={footBtn('primary', mobile)}>Fechar</button>
      ) : (<>
        <button type="button" onClick={onClose} className="aion-tap" style={footBtn('ghost', mobile)}>Cancelar</button>
        <button type="button" onClick={handleSubmit} disabled={loading} className="aion-tap" style={footBtn('primary', mobile, { opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 })}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
          Enviar e-mail
        </button>
      </>)}>
      <div style={{ background: '#F8FAFC', border: '1px solid #E3E8F0', borderRadius: 14, padding: '12px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar name={targetUser.full_name} size={40} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', overflow: 'hidden', textOverflow: 'ellipsis' }}>{targetUser.full_name}</div>
          <div style={{ fontSize: 12.5, color: '#5B6B86', overflowWrap: 'anywhere' }}>{targetUser.email}</div>
        </div>
      </div>

      {success ? (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 14, padding: 20, textAlign: 'center' }}>
          <CheckCircle size={34} color="#16a34a" style={{ margin: '0 auto 10px', display: 'block' }} />
          <p style={{ fontSize: 14, color: '#166534', fontWeight: 700, margin: 0 }}>E-mail de redefinição enviado!</p>
          <p style={{ fontSize: 13, color: '#16a34a', margin: '4px 0 0' }}>O usuário receberá as instruções por e-mail.</p>
        </div>
      ) : (<>
        {error && <Err>{error}</Err>}
        <p style={{ fontSize: 13.5, color: '#475569', margin: 0, lineHeight: 1.55 }}>Vamos enviar um e-mail para o usuário criar uma nova senha. Toque em “Enviar e-mail” para continuar.</p>
      </>)}
    </ModalShell>
  )
}

// ─── Modal: confirmar remoção da escola ───────────────────────────────────────
export function ConfirmRemoveModal({ user, loading, onClose, onConfirm }: { user: AppUser | null; loading: boolean; onClose: () => void; onConfirm: () => void }) {
  const mobile = useIsMobile()
  if (!user) return null
  return (
    <ModalShell onClose={onClose} maxWidth={440} icon={UserX} iconColor="#DC2626" iconBg="#FEE2E2"
      title="Remover desta escola?" subtitle={user.full_name}
      footer={<>
        <button type="button" onClick={onClose} className="aion-tap" style={footBtn('ghost', mobile)}>Cancelar</button>
        <button type="button" onClick={onConfirm} disabled={loading} className="aion-tap" style={footBtn('primary', mobile, { background: '#DC2626', boxShadow: 'none', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 })}>
          {loading && <Loader2 size={14} className="animate-spin" />}Remover
        </button>
      </>}>
      <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, margin: 0 }}>
        Deseja remover <strong>{user.full_name}</strong> desta escola?
      </p>
      <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6, margin: '12px 0 0' }}>
        O acesso a esta instituição é desativado (reversível a qualquer momento). A conta e o acesso a outras escolas, se houver, não são afetados.
      </p>
    </ModalShell>
  )
}

// ─── Modal: remoção bloqueada por lead/conversa em aberto ─────────────────────
export function BlockedRemovalModal({ info, onClose, onGoToLeads, onGoToWhatsApp }: {
  info: { user: AppUser; pendingLeads: number; pendingConversations: number } | null
  onClose: () => void
  onGoToLeads: () => void
  onGoToWhatsApp: () => void
}) {
  const mobile = useIsMobile()
  if (!info) return null
  const parts: string[] = []
  if (info.pendingLeads > 0) parts.push(`${info.pendingLeads} lead${info.pendingLeads > 1 ? 's' : ''} em aberto`)
  if (info.pendingConversations > 0) parts.push(`${info.pendingConversations} conversa${info.pendingConversations > 1 ? 's' : ''} de WhatsApp em andamento`)

  return (
    <ModalShell onClose={onClose} maxWidth={460} icon={AlertTriangle} iconColor="#DC2626" iconBg="#FEE2E2"
      title="Não é possível remover" subtitle={info.user.full_name}
      footer={<>
        <button type="button" onClick={onClose} className="aion-tap" style={footBtn('ghost', mobile)}>Fechar</button>
        {info.pendingConversations > 0 && <button type="button" onClick={onGoToWhatsApp} className="aion-tap" style={footBtn(info.pendingLeads > 0 ? 'ghost' : 'primary', mobile)}>Abrir WhatsApp</button>}
        {info.pendingLeads > 0 && <button type="button" onClick={onGoToLeads} className="aion-tap" style={footBtn('primary', mobile)}>Ver leads deste usuário</button>}
      </>}>
      <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, margin: 0 }}>
        <strong>{info.user.full_name}</strong> tem {parts.join(' e ')} atribuído{(info.pendingLeads + info.pendingConversations) > 1 ? 's' : ''} a ele nesta escola. Transfira para outro atendente antes de remover, para não deixar ninguém sem responsável.
      </p>
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {info.pendingLeads > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 14, fontSize: 13.5, color: '#991B1B', fontWeight: 700 }}>
            <Users size={16} />{info.pendingLeads} lead{info.pendingLeads > 1 ? 's' : ''} em aberto
          </div>
        )}
        {info.pendingConversations > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 14, fontSize: 13.5, color: '#991B1B', fontWeight: 700 }}>
            <MessageCircle size={16} />{info.pendingConversations} conversa{info.pendingConversations > 1 ? 's' : ''} em andamento
          </div>
        )}
      </div>
    </ModalShell>
  )
}

// ─── Seção: usuários removidos (vínculo desativado) ──────────────────────────
export function RemovedUsersSection({ removedLinks, show, onToggle, onReactivate }: {
  removedLinks: { user_id: string; full_name: string; email: string }[]
  show: boolean
  onToggle: () => void
  onReactivate: (userId: string) => void
}) {
  const mobile = useIsMobile()
  if (removedLinks.length === 0) return null
  return (
    <div style={{ background: '#fff', borderRadius: mobile ? 18 : 16, border: '1px solid #E3E8F0', overflow: 'hidden', boxShadow: '0 1px 2px rgba(26,43,74,.04)' }}>
      <button type="button" onClick={onToggle} aria-expanded={show} className="aion-tap"
        style={{ width: '100%', minHeight: 56, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
        <span style={{ width: 34, height: 34, borderRadius: 11, background: '#F1F5F9', color: '#5B6B86', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><UserX size={17} /></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: '#1A2B4A' }}>Removidos desta escola ({removedLinks.length})</span>
          <span style={{ display: 'block', fontSize: 12, color: '#5B6B86', marginTop: 1 }}>Toque para ver e reativar quem já saiu da equipe</span>
        </span>
        {show ? <ChevronUp size={18} color="#94A3B8" /> : <ChevronDown size={18} color="#94A3B8" />}
      </button>
      {show && (
        <div style={{ borderTop: '1px solid #EEF2F7' }}>
          {removedLinks.map(r => (
            <div key={r.user_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #F1F5F9', flexWrap: 'wrap' }}>
              <Avatar name={r.full_name} size={38} />
              <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', overflowWrap: 'anywhere' }}>{r.full_name}</div>
                <div style={{ fontSize: 12, color: '#5B6B86', overflowWrap: 'anywhere' }}>{r.email}</div>
              </div>
              <button type="button" onClick={() => onReactivate(r.user_id)} className="aion-tap"
                style={cardBtn('ghost', { flex: mobile ? '1 1 100%' : '0 0 auto', minHeight: mobile ? 44 : 36, padding: '8px 14px', color: '#16a34a', borderColor: '#BBF7D0', background: '#F0FDF4', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 })}>
                <RotateCcw size={14} /> Reativar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
