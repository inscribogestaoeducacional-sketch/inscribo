import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings, Search, X, MessageCircle, GraduationCap, Users, Filter, ShieldOff, Info } from 'lucide-react'
import PageHeader from '../../ui/PageHeader'
import { BRAND } from '../../../lib/brand'
import {
  SETTINGS_GROUPS, searchSettings, visibleGroupItems,
  type MapItem, type SettingsCtx, type SettingsGroup, type SettingsGroupId,
} from '../../../lib/settingsMap'
import { useSettingsFacts, type Fact } from './useSettingsFacts'

// ETAPA 3B-2 — casca das Configurações no desenho do AION Business
// (SystemSettings.tsx de lá): PageHeader, abas por assunto (lista no celular),
// cartões com ícone, título e uma linha de explicação, e o "← Voltar" de cada
// tela. Aqui só navegação; as telas gravam pelos mesmos caminhos de antes.

const ICONS = { MessageCircle, GraduationCap, Users, Filter, ShieldOff }

function useIsMobile() {
  const [m, setM] = useState(window.innerWidth < 768)
  useEffect(() => {
    const h = () => setM(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return m
}

const PAGE_CSS = `
  .animate-spin{animation:spin 1s linear infinite}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
  @keyframes aionPop{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
  .aion-pop{animation:aionPop .32s cubic-bezier(.2,.8,.2,1) both}
  .aion-tile{transition:transform .15s ease, box-shadow .15s ease, border-color .15s ease}
  .aion-tile:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(11,27,52,.08);border-color:#C3D5F2}
`

/** Cabeçalho, busca e abas; com algo na busca, mostra os resultados no lugar do conteúdo. */
export function SettingsShell({ ctx, groups, active, children }: { ctx: SettingsCtx; groups: SettingsGroup[]; active: SettingsGroupId | null; children: ReactNode }) {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [q, setQ] = useState('')
  const results = q.trim() ? searchSettings(q, ctx) : null
  const go = (id: string) => { setQ(''); navigate(`/settings/${id}`) }

  return (
    <div style={{ padding: isMobile ? '16px 14px 96px' : '20px 20px 32px', maxWidth: 1200, margin: '0 auto', boxSizing: 'border-box', minHeight: '100%', width: '100%' }}>
      <style>{PAGE_CSS}</style>
      <PageHeader icon={Settings} title="Configurações" subtitle="O que vale para a escola toda. Escolha um assunto ou procure pelo nome da opção." />

      <div style={{ position: 'relative', marginBottom: 14, maxWidth: isMobile ? '100%' : 520 }}>
        <Search size={16} color={BRAND.faint} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Procurar uma opção (ex.: horário, séries, bloqueio)" aria-label="Procurar uma opção"
          style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: '11px 36px', fontSize: 15, fontFamily: 'inherit', color: BRAND.ink, background: '#fff', outline: 'none' }} />
        {q && (
          <button type="button" onClick={() => setQ('')} aria-label="Limpar busca"
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
            <X size={16} color={BRAND.faint} />
          </button>
        )}
      </div>

      {isMobile ? (
        <select aria-label="Assunto das configurações" value={active ?? ''} onChange={e => go(e.target.value)}
          style={{ width: '100%', marginBottom: 16, border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: '11px 12px', fontSize: 15, fontWeight: 700, color: BRAND.ink, background: '#fff', fontFamily: 'inherit' }}>
          {!active && <option value="">Escolha um assunto</option>}
          {groups.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
        </select>
      ) : (
        <div role="tablist" style={{ display: 'inline-flex', gap: 2, background: '#F1F5F9', borderRadius: 14, padding: 4, marginBottom: 18, flexWrap: 'wrap' }}>
          {groups.map(g => {
            const Icon = ICONS[g.icon]
            const on = active === g.id && !results
            return (
              <button key={g.id} role="tab" aria-selected={on} onClick={() => go(g.id)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 10, border: 'none', fontFamily: 'inherit', fontSize: 13.5, fontWeight: on ? 800 : 600, color: on ? BRAND.primary : BRAND.muted, background: on ? '#fff' : 'transparent', boxShadow: on ? '0 1px 3px rgba(11,27,52,.1)' : 'none', cursor: 'pointer' }}>
                <Icon size={15} />{g.title}
              </button>
            )
          })}
        </div>
      )}

      {results ? <SearchResults results={results} /> : <div>{children}</div>}
    </div>
  )
}

function SearchResults({ results }: { results: MapItem[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#5B6B86', letterSpacing: '.06em', textTransform: 'uppercase' }}>
        {results.length ? `${results.length} ${results.length === 1 ? 'opção encontrada' : 'opções encontradas'}` : 'Nada encontrado com esse nome'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {results.map((it, i) => <ItemTile key={it.id} it={it} i={i} showGroup />)}
      </div>
    </div>
  )
}

/** Cartão de uma opção (mesmo desenho dos cartões do Início do WhatsApp no Business). */
function ItemTile({ it, i, fact, showGroup }: { it: MapItem; i: number; fact?: Fact; showGroup?: boolean }) {
  const navigate = useNavigate()
  const g = SETTINGS_GROUPS.find(x => x.id === it.group)
  const Icon = g ? ICONS[g.icon] : Settings
  return (
    <button type="button" className="aion-pop aion-tile" onClick={() => it.href && navigate(it.href, { state: { from: it.group } })}
      style={{ animationDelay: `${i * 35}ms`, textAlign: 'left', background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 16, cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start', fontFamily: 'inherit' }}>
      <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: BRAND.soft, color: BRAND.primary }}><Icon size={19} /></span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        {showGroup && g && <span style={{ fontSize: 11, fontWeight: 800, color: BRAND.faint, letterSpacing: '.04em', textTransform: 'uppercase' }}>{g.title}</span>}
        <span style={{ fontSize: 14, fontWeight: 700, color: BRAND.ink }}>{it.label}</span>
        <span style={{ fontSize: 12.5, color: BRAND.muted, lineHeight: 1.45 }}>{it.help}</span>
        {fact && (
          <span style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12, lineHeight: 1.4, borderRadius: 10, padding: '6px 9px',
            color: fact.tone === 'warn' ? '#92400E' : fact.tone === 'off' ? '#991B1B' : '#1E3A8A',
            background: fact.tone === 'warn' ? '#FFFBEB' : fact.tone === 'off' ? '#FEF2F2' : BRAND.soft }}>
            <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} /><span><strong>Valendo agora:</strong> {fact.text}</span>
          </span>
        )}
      </span>
    </button>
  )
}

/** Grupo (Escola, Equipe, Funil, Bloqueios): cartões por assunto que abrem as telas de hoje. */
export function GroupHub({ group, ctx, institutionId }: { group: SettingsGroupId; ctx: SettingsCtx; institutionId: string }) {
  const g = SETTINGS_GROUPS.find(x => x.id === group)!
  const items = visibleGroupItems(group, ctx)
  const facts = useSettingsFacts(institutionId, group)
  let n = 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <p style={{ margin: 0, fontSize: 13.5, color: BRAND.muted, lineHeight: 1.5 }}>{g.description}</p>
      {g.topics.map(topic => {
        const list = items.filter(it => it.topic === topic)
        if (!list.length) return null
        return (
          <div key={topic} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#5B6B86', letterSpacing: '.06em', textTransform: 'uppercase' }}>{topic}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              {list.map(it => <ItemTile key={it.id} it={it} i={n++} fact={facts[it.id]} />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** "← Grupo" + título + explicação, como as seções do WhatsApp no Business. */
export function SectionHeader({ backLabel, onBack, title, desc }: { backLabel: string; onBack: () => void; title: string; desc?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button onClick={onBack} aria-label={`Voltar para ${backLabel}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: BRAND.primary, background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: '9px 14px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'inherit' }}>
        ← {backLabel}
      </button>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: BRAND.ink }}>{title}</div>
        {desc && <div style={{ fontSize: 12.5, color: BRAND.muted }}>{desc}</div>}
      </div>
    </div>
  )
}

