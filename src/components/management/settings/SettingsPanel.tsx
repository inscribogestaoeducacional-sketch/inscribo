import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Settings, Search, ChevronRight, ArrowLeft, MessageCircle, Bot, GraduationCap, Users, Filter, ShieldOff, CreditCard, Sparkles, Lock, X,
} from 'lucide-react'
import {
  SETTINGS_GROUPS, isSoon, searchSettings, visibleGroupItems, visibleGroups,
  type MapItem, type SettingsCtx, type SettingsGroup, type SettingsGroupId,
} from '../../../lib/settingsMap'
import { useSettingsFacts, type Fact } from './useSettingsFacts'

// ETAPA 3B — Início das Configurações (9 cartões + busca) e tela de cada
// grupo. Só navegação: cada opção abre a tela que já existe hoje.

const ICONS = { MessageCircle, Bot, GraduationCap, Users, Filter, ShieldOff, CreditCard, Sparkles, Lock }
const INK = '#1A2B4A'
const MUTED = '#64748B'
const LINE = '#E2E8F0'
const BRAND = '#00A896'

function useIsMobile() {
  const [m, setM] = useState(window.innerWidth < 768)
  useEffect(() => {
    const h = () => setM(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return m
}

const groupOf = (id: SettingsGroupId | null) => SETTINGS_GROUPS.find(g => g.id === id)

function GroupIcon({ g, size = 20 }: { g: SettingsGroup; size?: number }) {
  const I = ICONS[g.icon]
  return (
    <span style={{ width: size * 2, height: size * 2, borderRadius: 12, background: '#E6F7F5', color: BRAND, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <I size={size} />
    </span>
  )
}

function SoonBadge() {
  return <span style={{ fontSize: 11, fontWeight: 700, color: '#92400E', background: '#FEF3C7', borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap' }}>Em breve</span>
}

/** Uma opção: nome, ajuda, "Valendo agora" e o botão para a tela atual. */
function ItemRow({ it, fact, from, showGroup, first }: { it: MapItem; fact?: Fact; from?: SettingsGroupId; showGroup?: boolean; first?: boolean }) {
  const navigate = useNavigate()
  const soon = isSoon(it)
  const open = () => { if (!soon && it.href) navigate(it.href, { state: { from: from ?? it.group } }) }
  const tone = fact?.tone === 'ok' ? { bg: '#ECFDF5', fg: '#065F46', dot: '#10B981' }
    : fact?.tone === 'warn' ? { bg: '#FFFBEB', fg: '#92400E', dot: '#F59E0B' }
    : fact?.tone === 'off' ? { bg: '#FEF2F2', fg: '#991B1B', dot: '#EF4444' }
    : { bg: '#EFF6FF', fg: '#1E3A8A', dot: '#3B82F6' }
  return (
    <button type="button" onClick={open} disabled={soon} aria-disabled={soon}
      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', background: '#fff', border: 'none', borderTop: first ? 'none' : `1px solid ${LINE}`, padding: '14px 16px', cursor: soon ? 'default' : 'pointer', fontFamily: 'inherit', opacity: soon ? 0.6 : 1 }}>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {showGroup && <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.04em' }}>{groupOf(it.group)?.title}</span>}
        <span style={{ fontSize: 14, fontWeight: 700, color: INK }}>{it.label}</span>
        {it.help && <span style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.45 }}>{it.help}</span>}
        {fact && (
          <span style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 2, fontSize: 12, color: tone.fg, background: tone.bg, borderRadius: 8, padding: '4px 9px', lineHeight: 1.4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: tone.dot, flexShrink: 0 }} />
            <span><strong>Valendo agora:</strong> {fact.text}</span>
          </span>
        )}
      </span>
      {soon ? <SoonBadge /> : <ChevronRight size={18} color="#94A3B8" style={{ flexShrink: 0 }} />}
    </button>
  )
}

function Header({ title, subtitle, onBack, backLabel }: { title: string; subtitle: string; onBack?: () => void; backLabel?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {onBack && (
        <button type="button" onClick={onBack}
          style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: BRAND, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
          <ArrowLeft size={15} />{backLabel}
        </button>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: '#E6F7F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Settings size={18} color={BRAND} />
        </div>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: INK, margin: 0 }}>{title}</h1>
          <p style={{ fontSize: 12.5, color: MUTED, margin: '2px 0 0' }}>{subtitle}</p>
        </div>
      </div>
    </div>
  )
}

const page = (mobile: boolean) => ({ padding: mobile ? '16px 16px 96px' : 24, display: 'flex', flexDirection: 'column' as const, gap: 18, minHeight: '100%', background: '#f8f9fb', maxWidth: 1100, boxSizing: 'border-box' as const, width: '100%' })

export function SettingsHome({ ctx }: { ctx: SettingsCtx }) {
  const navigate = useNavigate()
  const mobile = useIsMobile()
  const [q, setQ] = useState('')
  const groups = visibleGroups(ctx)
  const results = q.trim() ? searchSettings(q, ctx) : null

  return (
    <div style={page(mobile)}>
      <Header title="Configurações" subtitle="Tudo o que vale para a escola, organizado por assunto." />

      <div style={{ position: 'relative' }}>
        <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Procurar uma opção (ex.: horário, séries, bloqueio)" aria-label="Procurar uma opção"
          style={{ width: '100%', boxSizing: 'border-box', height: 46, padding: '0 40px 0 40px', fontSize: 14, border: `1.5px solid ${LINE}`, borderRadius: 12, background: '#fff', outline: 'none', fontFamily: 'inherit', color: INK }} />
        {q && (
          <button type="button" onClick={() => setQ('')} aria-label="Limpar busca"
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
            <X size={16} color="#94A3B8" />
          </button>
        )}
      </div>

      {results ? (
        <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', fontSize: 12.5, color: MUTED }}>
            {results.length ? `${results.length} ${results.length === 1 ? 'opção encontrada' : 'opções encontradas'}` : 'Nada encontrado com esse nome.'}
          </div>
          {results.map(it => <ItemRow key={it.id} it={it} showGroup />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'minmax(0, 1fr)' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {groups.map(g => {
            const items = visibleGroupItems(g.id, ctx)
            const ready = items.filter(it => !isSoon(it)).length
            const soonOnly = ready === 0
            return (
              <button key={g.id} type="button" onClick={() => navigate(`/settings/${g.id}`)}
                style={{ display: 'flex', gap: 14, alignItems: 'flex-start', textAlign: 'left', background: '#fff', border: `1px solid ${LINE}`, borderRadius: 16, padding: 16, cursor: 'pointer', fontFamily: 'inherit', minHeight: 96 }}>
                <GroupIcon g={g} />
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: INK }}>{g.title}</span>
                  <span style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.45 }}>{g.description}</span>
                  <span style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    {soonOnly ? <SoonBadge /> : <span style={{ fontSize: 11.5, color: '#94A3B8' }}>{ready} {ready === 1 ? 'opção' : 'opções'}{items.length > ready ? ` · ${items.length - ready} em breve` : ''}</span>}
                  </span>
                </span>
                <ChevronRight size={18} color="#CBD5E1" style={{ flexShrink: 0, marginTop: 10 }} />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function SettingsGroupPage({ group, ctx, institutionId }: { group: SettingsGroupId; ctx: SettingsCtx; institutionId: string }) {
  const navigate = useNavigate()
  const mobile = useIsMobile()
  const g = groupOf(group)!
  const items = visibleGroupItems(group, ctx)
  const facts = useSettingsFacts(institutionId, group)
  const conn = group === 'whatsapp' ? facts['wa-conexao'] : undefined

  return (
    <div style={page(mobile)}>
      <Header title={g.title} subtitle={g.description} onBack={() => navigate('/settings')} backLabel="Configurações" />

      {group === 'whatsapp' && conn && (
        <div style={{ borderRadius: 16, padding: '14px 16px', color: '#fff', display: 'flex', alignItems: 'center', gap: 12,
          background: conn.tone === 'off' ? 'linear-gradient(130deg,#B91C1C,#DC2626)' : 'linear-gradient(135deg,#047857,#00A896)' }}>
          <MessageCircle size={22} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, opacity: .85, textTransform: 'uppercase', letterSpacing: '.05em' }}>Valendo agora</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{conn.text}</div>
          </div>
        </div>
      )}

      {g.topics.map(topic => {
        const list = items.filter(it => it.topic === topic)
        if (!list.length) return null
        return (
          <section key={topic} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#5B6B86', textTransform: 'uppercase', letterSpacing: '.06em' }}>{topic}</h2>
            <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 16, overflow: 'hidden' }}>
              {list.map((it, i) => <ItemRow key={it.id} it={it} fact={facts[it.id]} from={group} first={i === 0} />)}
            </div>
          </section>
        )
      })}
    </div>
  )
}

/** Cabeçalho das telas atuais (links antigos ?tab=&sec=), no lugar das abas. */
export function LegacyScreenHeader({ group, title }: { group: SettingsGroupId | null; title: string }) {
  const navigate = useNavigate()
  const g = groupOf(group)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => navigate('/settings')} style={{ background: 'none', border: 'none', padding: 0, color: BRAND, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>Configurações</button>
        {g && <>
          <ChevronRight size={13} color="#94A3B8" />
          <button type="button" onClick={() => navigate(`/settings/${g.id}`)} style={{ background: 'none', border: 'none', padding: 0, color: BRAND, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>{g.title}</button>
        </>}
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: INK, margin: 0 }}>{title}</h1>
    </div>
  )
}
