import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { GraduationCap, Search, PlayCircle, CheckCircle2, Circle, Sparkles, Loader2 } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import HeaderAction from '../components/mobile/HeaderAction'
import StatStrip from '../components/mobile/StatStrip'
import { PillTabs } from '../components/mobile/PillTabs'
import TrailCard from '../components/academy/TrailCard'
import LessonSheet from '../components/academy/LessonSheet'
import { useAcademyAccess } from '../lib/academy/useAcademyAccess'
import { useAcademyProgress } from '../lib/academy/progress'
import { FIRST_STEPS, ROLE_LABEL, countDone, nextLesson, trailLessons, HELP_OPEN_EVENT, LESSON_OPEN_EVENT, TOUR_START_EVENT, type Lesson, type RoleKey } from '../lib/academy/academy'
import { LESSON_BY_KEY } from '../lib/academy/academyContent'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { BRAND } from '../lib/brand'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function Academia() {
  const { visible, trails, role: autoRole, manager } = useAcademyAccess()
  const { done, mark, unmark } = useAcademyProgress()
  const [sp, setSp] = useSearchParams()
  const [tab, setTab] = useState<'aulas' | 'equipe'>('aulas')
  const [role, setRole] = useState<RoleKey>(autoRole)
  const [q, setQ] = useState('')
  const [mobile, setMobile] = useState(window.innerWidth < 768)
  useEffect(() => { const h = () => setMobile(window.innerWidth < 768); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h) }, [])
  const [openKey, setOpenKey] = useState<string | null>(null)
  useEffect(() => { setRole(autoRole) }, [autoRole])

  // /academia?aula=chave abre a aula (vem do botão "Abrir a aula na Academia" do "?")
  useEffect(() => {
    const k = sp.get('aula')
    if (k && LESSON_BY_KEY[k]) setOpenKey(k)
  }, [sp])
  // /academia?duvidas=1 (aviso da resposta da equipe) abre o painel de dúvidas
  useEffect(() => {
    if (sp.get('duvidas')) { window.dispatchEvent(new CustomEvent(HELP_OPEN_EVENT, { detail: { tab: 'ask' } })); const n = new URLSearchParams(sp); n.delete('duvidas'); setSp(n, { replace: true }) }
  }, [sp, setSp])
  useEffect(() => {
    const h = (e: Event) => { const k = (e as CustomEvent<{ key: string }>).detail?.key; if (k && LESSON_BY_KEY[k]) setOpenKey(k) }
    window.addEventListener(LESSON_OPEN_EVENT, h)
    return () => window.removeEventListener(LESSON_OPEN_EVENT, h)
  }, [])
  const close = useCallback(() => { setOpenKey(null); if (sp.get('aula')) { const n = new URLSearchParams(sp); n.delete('aula'); setSp(n, { replace: true }) } }, [sp, setSp])

  const opened = openKey ? LESSON_BY_KEY[openKey] : null
  const total = visible.length
  const nDone = countDone(visible, done)
  const left = visible.filter(l => !done.has(l.key)).reduce((a, l) => a + l.minutes, 0)
  const next = nextLesson(visible, done)

  const firstSteps = FIRST_STEPS[role]
  const fsLessons = useMemo(() => trailLessons({ module: '', title: '', desc: '', lessons: firstSteps.lessons }, visible), [firstSteps, visible])
  const fsNext = nextLesson(fsLessons, done)
  const fsDone = countDone(fsLessons, done)

  const query = norm(q.trim())
  const found: Lesson[] = query ? visible.filter(l => norm(`${l.title} ${l.summary} ${l.steps.join(' ')}`).includes(query)) : []

  const open = (l: Lesson) => setOpenKey(l.key)
  const tabs: [string, string][] = manager ? [['aulas', 'Aulas'], ['equipe', 'Equipe']] : []

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 24px)', maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader icon={GraduationCap} title="Academia Áion Edu" subtitle="Aulas curtas de cada tela. Toque em “Fazer comigo” e a Áion mostra o caminho."
        actions={<HeaderAction primary icon={Sparkles} label="Tire suas dúvidas" onClick={() => window.dispatchEvent(new CustomEvent(HELP_OPEN_EVENT, { detail: { tab: 'ask' } }))} />} />

      {tabs.length > 0 && (mobile
        ? <PillTabs tabs={tabs} value={tab} onChange={id => setTab(id as 'aulas' | 'equipe')} />
        : (
          <div role="tablist" style={{ display: 'inline-flex', gap: 2, background: '#EEF3F2', borderRadius: 14, padding: 4, alignSelf: 'flex-start' }}>
            {tabs.map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id as 'aulas' | 'equipe')}
                style={{ border: 'none', borderRadius: 10, padding: '9px 18px', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', background: tab === id ? '#fff' : 'transparent', color: tab === id ? BRAND.primaryDark : BRAND.muted, boxShadow: tab === id ? '0 1px 3px rgba(26,43,74,.12)' : 'none' }}>{label}</button>
            ))}
          </div>
        ))}

      {tab === 'aulas' && (
        <>
          <StatStrip items={[
            { label: 'Aulas concluídas', value: `${nDone} de ${total}`, sub: total ? `${Math.round((nDone / total) * 100)}% do caminho` : 'Nenhuma aula liberada', color: BRAND.primary, icon: CheckCircle2 },
            { label: 'Tempo que falta', value: left < 60 ? `${left} min` : `${Math.floor(left / 60)} h ${left % 60} min`, sub: 'Somando as aulas que ainda não fez', color: '#6366F1', icon: PlayCircle },
            { label: 'Próxima aula', value: next ? `${next.minutes} min` : 'Tudo feito', sub: next ? next.title : 'Você concluiu todas as aulas', color: '#D97706', icon: Sparkles },
          ]} />

          {/* Comece por aqui */}
          <section data-tour="academia-comece" style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 18, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: BRAND.primary, textTransform: 'uppercase', letterSpacing: .4 }}>Comece por aqui</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: BRAND.ink }}>{firstSteps.title}</div>
                <div style={{ fontSize: 13, color: BRAND.muted }}>{firstSteps.subtitle}</div>
              </div>
              <div role="tablist" aria-label="Seu papel" style={{ display: 'flex', gap: 4, background: '#EEF3F2', borderRadius: 12, padding: 3, flexWrap: 'wrap' }}>
                {(Object.keys(FIRST_STEPS) as RoleKey[]).map(r => (
                  <button key={r} type="button" role="tab" aria-selected={role === r} onClick={() => setRole(r)}
                    style={{ border: 'none', borderRadius: 9, padding: '7px 12px', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', background: role === r ? '#fff' : 'transparent', color: role === r ? BRAND.primaryDark : BRAND.muted, boxShadow: role === r ? '0 1px 3px rgba(26,43,74,.12)' : 'none' }}>
                    {ROLE_LABEL[r]}
                  </button>
                ))}
              </div>
            </div>
            <div className="aion-hscroll" style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
              {fsLessons.map((l, i) => {
                const d = done.has(l.key), isNext = fsNext?.key === l.key
                return (
                  <button key={l.key} type="button" onClick={() => open(l)} className="aion-tap"
                    style={{ flex: '0 0 190px', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', padding: 12, borderRadius: 16, background: isNext ? BRAND.softer : '#fff', border: `1.5px solid ${isNext ? BRAND.primary : d ? BRAND.softLine : BRAND.line}`, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 104 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 24, height: 24, borderRadius: 99, background: d ? BRAND.success : isNext ? BRAND.primary : '#E3E8F0', color: d || isNext ? '#fff' : BRAND.muted, fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d ? '✓' : i + 1}</span>
                      <span style={{ fontSize: 11.5, color: BRAND.muted, fontWeight: 700 }}>{l.minutes} min</span>
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: BRAND.ink, lineHeight: 1.3 }}>{l.title}</span>
                  </button>
                )
              })}
              {fsLessons.length === 0 && <div style={{ fontSize: 13.5, color: BRAND.muted, padding: 8 }}>Nenhuma destas aulas está liberada para você ainda.</div>}
            </div>
            {fsLessons.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ flex: 1, minWidth: 120, height: 7, borderRadius: 99, background: '#EEF3F2', overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${(fsDone / fsLessons.length) * 100}%`, background: 'var(--aion-grad)', borderRadius: 99, transition: 'width .5s' }} />
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: BRAND.muted }}>{fsDone} de {fsLessons.length}</span>
                {fsNext && <button type="button" onClick={() => open(fsNext)} style={{ height: 40, padding: '0 16px', borderRadius: 12, border: 'none', background: 'var(--aion-grad)', color: '#fff', fontFamily: 'inherit', fontWeight: 800, fontSize: 13.5, cursor: 'pointer' }}>{fsDone ? 'Continuar' : 'Começar'}</button>}
              </div>
            )}
          </section>

          {/* Busca */}
          <div style={{ position: 'relative' }}>
            <Search size={16} color={BRAND.faint} style={{ position: 'absolute', left: 14, top: 14 }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar uma aula (ex.: visita, template, senha)"
              style={{ width: '100%', height: 44, borderRadius: 14, border: `1.5px solid ${BRAND.line}`, padding: '0 14px 0 40px', fontSize: 16, color: BRAND.ink, background: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          </div>

          {query ? (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: BRAND.muted }}>{found.length} {found.length === 1 ? 'aula encontrada' : 'aulas encontradas'}</div>
              {found.map(l => (
                <button key={l.key} type="button" onClick={() => open(l)} className="aion-tap"
                  style={{ textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center', padding: '12px 14px', borderRadius: 16, background: '#fff', border: `1px solid ${BRAND.line}`, minHeight: 56 }}>
                  {done.has(l.key) ? <CheckCircle2 size={21} color={BRAND.success} /> : <Circle size={21} color="#CBD5E1" />}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800, color: BRAND.ink }}>{l.title}</span>
                    <span style={{ display: 'block', fontSize: 12.5, color: BRAND.muted, marginTop: 1 }}>{l.summary}</span>
                  </span>
                </button>
              ))}
              {found.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: BRAND.muted, fontSize: 14 }}>Nenhuma aula com essa palavra. Tente outra, ou toque em “Tire suas dúvidas”.</div>}
            </section>
          ) : (
            <section data-tour="academia-trilhas" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 420px), 1fr))', gap: 12, alignItems: 'start' }}>
              {trails.map(({ trail, lessons }) => <TrailCard key={trail.module} trail={trail} lessons={lessons} done={done} onOpen={open} />)}
            </section>
          )}
        </>
      )}

      {tab === 'equipe' && manager && <TeamProgress visible={visible} onOpen={open} />}

      {opened && <LessonSheet lesson={opened} done={done.has(opened.key)} onClose={close} onToggleDone={() => (done.has(opened.key) ? unmark(opened.key) : mark(opened.key))} />}
    </div>
  )
}

// ── Equipe: quanto cada pessoa já estudou (só gestor/administrador) ──
interface TeamRow { user_id: string; full_name: string; role: string; keys: string[] | null; last_at: string | null; perms: Record<string, boolean> | null }
const DEFAULT_OFF = ['captacao', 'transmissoes', 'vitrine', 'base_alunos']
const ROLE_PT: Record<string, string> = { admin: 'Administrador', manager: 'Gestor', user: 'Atendente' }

function TeamProgress({ visible, onOpen }: { visible: Lesson[]; onOpen: (l: Lesson) => void }) {
  const { user } = useAuth()
  const [rows, setRows] = useState<TeamRow[] | null>(null)
  const [err, setErr] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    supabase.rpc('academy_team').then(({ data, error }) => {
      if (!alive) return
      if (error) { setErr('Não foi possível carregar a equipe agora. Tente de novo em instantes.'); setRows([]); return }
      setRows((data ?? []) as TeamRow[])
    })
    return () => { alive = false }
  }, [user?.institution_id])
  if (rows === null) return <div style={{ display: 'flex', gap: 8, color: BRAND.muted, padding: 20 }}><Loader2 size={18} className="animate-spin" /> Carregando a equipe…</div>

  // aulas que cada pessoa pode ver: papel + módulos liberados para ela
  const forPerson = (r: TeamRow) => {
    const mgr = r.role === 'admin' || r.role === 'manager'
    const has = (m: string) => mgr || m === 'celular' || (r.perms && m in r.perms ? !!r.perms[m] : !DEFAULT_OFF.includes(m))
    return visible.filter(l => has(l.module) && (!l.managerOnly || mgr) && (!l.adminOnly || r.role === 'admin') && (!l.attendantOnly || !mgr))
  }
  const ago = (iso: string | null) => {
    if (!iso) return 'ainda não estudou'
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
    return d <= 0 ? 'estudou hoje' : d === 1 ? 'estudou ontem' : `estudou há ${d} dias`
  }
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13.5, color: BRAND.muted, lineHeight: 1.45 }}>Veja quem já fez as aulas. A conta de cada pessoa só considera as aulas que ela pode ver.</div>
      {err && <div style={{ padding: 14, borderRadius: 14, background: BRAND.dangerSoft, color: BRAND.danger, fontSize: 14 }}>{err}</div>}
      {rows.map(r => {
        const mine = forPerson(r)
        const keys = new Set(r.keys ?? [])
        const n = mine.filter(l => keys.has(l.key)).length
        const pct = mine.length ? Math.round((n / mine.length) * 100) : 0
        const isOpen = openId === r.user_id
        return (
          <div key={r.user_id} style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 18, overflow: 'hidden' }}>
            <button type="button" onClick={() => setOpenId(isOpen ? null : r.user_id)} className="aion-tap" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ width: 42, height: 42, borderRadius: 14, background: BRAND.soft, color: BRAND.primaryDark, fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{(r.full_name || '?').charAt(0).toUpperCase()}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: BRAND.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.full_name}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: BRAND.muted }}>{ROLE_PT[r.role] || r.role} · {ago(r.last_at)}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}>
                  <span style={{ flex: 1, height: 7, borderRadius: 99, background: '#EEF3F2', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${pct}%`, background: 'var(--aion-grad)', borderRadius: 99 }} /></span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: BRAND.muted, whiteSpace: 'nowrap' }}>{n} de {mine.length}</span>
                </span>
              </span>
            </button>
            {isOpen && (
              <div style={{ borderTop: `1px solid ${BRAND.line}`, padding: '8px 12px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {mine.length === 0 && <div style={{ fontSize: 13.5, color: BRAND.muted, padding: 8 }}>Nenhuma aula liberada para esta pessoa.</div>}
                {mine.map(l => (
                  <button key={l.key} type="button" onClick={() => onOpen(l)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 4px', background: 'none', border: 'none', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', fontSize: 13.5, color: keys.has(l.key) ? BRAND.success : BRAND.text }}>
                    {keys.has(l.key) ? <CheckCircle2 size={17} /> : <Circle size={17} color="#CBD5E1" />} {l.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
      {rows.length === 0 && !err && <div style={{ padding: 20, textAlign: 'center', color: BRAND.muted, fontSize: 14 }}>Ainda não há pessoas na equipe.</div>}
    </section>
  )
}
