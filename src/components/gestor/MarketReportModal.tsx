import { useEffect, useRef, useState } from 'react'
import { X, Trophy, Users, TrendingUp, MapPin, Award, Target, ArrowUpRight, ArrowDownRight, Building2 } from 'lucide-react'
import { calculateRaioXMetrics, buildInterpretation, type RaioXMetrics } from '../../lib/raioXMetrics'

// ─── carrossel de "gerando relatório" — mesma estrutura visual/tempo de
// src/pages/RaioXPage.tsx (rotação de cards + dots + barra de progresso em
// ~12s), mas com conteúdo adaptado: aqui não é um pitch de vendas (o gestor
// já é cliente), é um teaser das etapas do cálculo que está rodando. ──
type StepIconName = 'trophy' | 'users' | 'trend' | 'map' | 'award'

const REPORT_STEPS: { icon: StepIconName; title: string; desc: string }[] = [
  { icon: 'map',    title: 'Mapeando concorrentes',        desc: 'Cruzando os dados do Censo Escolar (INEP) com as escolas privadas da sua cidade.' },
  { icon: 'trophy', title: 'Calculando seu ranking',       desc: 'Comparando o total de matrículas da sua escola com todas as concorrentes do município.' },
  { icon: 'users',  title: 'Medindo participação de mercado', desc: 'Sua fatia do total de alunos matriculados na rede privada local.' },
  { icon: 'trend',  title: 'Analisando por etapa de ensino', desc: 'Infantil, Fundamental e Médio separados — onde você é mais forte e onde há espaço.' },
  { icon: 'award',  title: 'Montando recomendações',        desc: 'Interpretação automática dos números pra apoiar sua decisão.' },
]

const STEP_MS = 2400
const TOTAL_MS = STEP_MS * REPORT_STEPS.length

function StepIcon({ name, size = 24, color = '#00523C' }: { name: StepIconName; size?: number; color?: string }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (name) {
    case 'trophy': return <svg {...common}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>
    case 'users':  return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
    case 'trend':  return <svg {...common}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
    case 'map':    return <svg {...common}><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" /></svg>
    case 'award':  return <svg {...common}><circle cx="12" cy="8" r="6" /><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" /></svg>
  }
}

function fmt(n: number) { return new Intl.NumberFormat('pt-BR').format(Math.round(n)) }

const scoreColor = (score: number) => score >= 70 ? '#059669' : score >= 40 ? '#D97706' : '#DC2626'
const scoreBg    = (score: number) => score >= 70 ? '#F0FDF4' : score >= 40 ? '#FFFBEB' : '#FEF2F2'

export default function MarketReportModal({
  coEntidade, city, state, onClose,
}: {
  coEntidade: string
  city: string
  state: string
  onClose: () => void
}) {
  const [metrics, setMetrics] = useState<RaioXMetrics | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [carouselDone, setCarouselDone] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Calcula os dados reais (mesmo motor da página pública do Raio-X) em
  // paralelo com a animação — sem etapa de busca, a escola já é conhecida.
  useEffect(() => {
    let cancelled = false
    // sg_uf em inep_escolas é sempre maiúsculo — mesma normalização já feita
    // nas queries de GestorHome.tsx antes de filtrar por estado.
    calculateRaioXMetrics(coEntidade, city, state.toUpperCase())
      .then(m => { if (!cancelled) setMetrics(m) })
      .catch(() => { if (!cancelled) setLoadError(true) })
    return () => { cancelled = true }
  }, [coEntidade, city, state])

  useEffect(() => {
    const startedAt = Date.now()
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAt
      setStepIndex(Math.min(REPORT_STEPS.length - 1, Math.floor(elapsed / STEP_MS)))
      setProgress(Math.min(100, (elapsed / TOTAL_MS) * 100))
      if (elapsed >= TOTAL_MS) {
        setCarouselDone(true)
        if (timerRef.current) clearInterval(timerRef.current)
      }
    }, 80)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const showCarousel = !carouselDone || !metrics
  const showReport = carouselDone && metrics && !loadError

  const interpretation = metrics ? buildInterpretation(metrics) : []

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
      onClick={carouselDone ? onClose : undefined}>
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 820, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={16} color="#00A896" />
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Relatório de Mercado Completo</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 6, borderRadius: 8 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '24px' }}>
          {loadError && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
              <p style={{ margin: 0, fontSize: 13 }}>Não foi possível calcular o relatório agora. Tente novamente mais tarde.</p>
            </div>
          )}

          {showCarousel && !loadError && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 18 }}>
                <div style={{ width: 16, height: 16, border: '2.5px solid #00A896', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                <h2 style={{ margin: 0, fontSize: 16, color: '#1e2d6b', fontWeight: 700 }}>Gerando seu relatório...</h2>
              </div>

              <div style={{ background: '#F0FDFA', border: '1px solid #A7F3D0', borderRadius: 16, padding: '26px 24px', minHeight: 176, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, boxShadow: '0 4px 14px rgba(0,82,60,0.14)', flexShrink: 0 }}>
                  <StepIcon name={REPORT_STEPS[stepIndex].icon} size={24} color="#00523C" />
                </div>
                <p style={{ margin: 0, fontSize: 15, color: '#1e2d6b', fontWeight: 700, textAlign: 'center' }}>{REPORT_STEPS[stepIndex].title}</p>
                <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#64748b', textAlign: 'center', lineHeight: 1.6, maxWidth: 340 }}>{REPORT_STEPS[stepIndex].desc}</p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16 }}>
                {REPORT_STEPS.map((s, i) => (
                  <div key={s.title} style={{ width: i === stepIndex ? 18 : 6, height: 6, borderRadius: 3, background: i === stepIndex ? '#00523C' : '#D1D5DB', transition: 'width 0.3s ease, background 0.3s ease' }} />
                ))}
              </div>

              <div style={{ height: 5, borderRadius: 3, background: '#E5E7EB', marginTop: 12, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, borderRadius: 3, background: 'linear-gradient(90deg, #00523C, #00A896)', transition: 'width 0.1s linear' }} />
              </div>
            </div>
          )}

          {showReport && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Cabeçalho com score */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ width: 72, height: 72, borderRadius: 16, background: scoreBg(metrics.marketScore), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: scoreColor(metrics.marketScore), lineHeight: 1 }}>{metrics.marketScore}</span>
                  <span style={{ fontSize: 9, color: scoreColor(metrics.marketScore), fontWeight: 700 }}>SCORE</span>
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1e2d6b' }}>{metrics.schoolName}</h2>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>{metrics.city}/{metrics.state} · Censo Escolar {metrics.anoCenso}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: scoreBg(metrics.marketScore), color: scoreColor(metrics.marketScore) }}>
                      {metrics.scoreLabel}
                    </span>
                    {metrics.yearOverYear && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
                        background: (metrics.yearOverYear.growthPct ?? 0) >= 0 ? '#F0FDF4' : '#FEF2F2',
                        color: (metrics.yearOverYear.growthPct ?? 0) >= 0 ? '#16A34A' : '#DC2626',
                      }}>
                        {(metrics.yearOverYear.growthPct ?? 0) >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                        {metrics.yearOverYear.growthPct !== null ? `${metrics.yearOverYear.growthPct}%` : '—'} vs. Censo {metrics.yearOverYear.previousYear}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Cards de ranking/market share */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                <div style={{ background: '#F5F3FF', borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
                  <Trophy size={18} color="#7C3AED" style={{ marginBottom: 6 }} />
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#7C3AED' }}>{metrics.ranking}º</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>de {metrics.rankingTotal} escolas privadas</div>
                </div>
                <div style={{ background: '#F0FDFA', borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
                  <Users size={18} color="#00A896" style={{ marginBottom: 6 }} />
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#00A896' }}>{metrics.marketSharePct.toFixed(1)}%</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>participação de mercado</div>
                </div>
                <div style={{ background: '#FFFBEB', borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
                  <Target size={18} color="#D97706" style={{ marginBottom: 6 }} />
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#D97706' }}>{fmt(metrics.qtMatTotal)}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>alunos matriculados</div>
                </div>
              </div>

              {metrics.ranking > 5 && metrics.distanceToTop5 > 0 && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#991B1B' }}>
                  Faltam <strong>{fmt(metrics.distanceToTop5)}</strong> matrículas pra alcançar o 5º colocado do município.
                </div>
              )}

              {/* Principais concorrentes */}
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#1e2d6b', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Award size={14} color="#6366f1" /> Principais concorrentes
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {metrics.topCompetitors.slice(0, 8).map(c => (
                    <div key={c.co_entidade} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: c.isSelected ? '#F0FDFA' : '#f8fafc', border: c.isSelected ? '1px solid #A7F3D0' : '1px solid transparent' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', minWidth: 18 }}>{c.rank}</span>
                      <span style={{ flex: 1, fontSize: 12, fontWeight: c.isSelected ? 700 : 500, color: c.isSelected ? '#00523C' : '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.no_entidade}{c.isSelected ? ' (você)' : ''}
                      </span>
                      <div style={{ width: 80, height: 5, background: '#e5e7eb', borderRadius: 9999, flexShrink: 0 }}>
                        <div style={{ width: `${Math.min(100, c.marketSharePct)}%`, height: 5, borderRadius: 9999, background: c.isSelected ? '#00A896' : '#94a3b8' }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', minWidth: 60, textAlign: 'right' }}>{fmt(c.qt_mat_total)} ({c.marketSharePct.toFixed(1)}%)</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Por etapa de ensino */}
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#1e2d6b', margin: '0 0 10px' }}>Por etapa de ensino</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                  {metrics.segments.map(seg => (
                    <div key={seg.key} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6 }}>{seg.label}</div>
                      {seg.active ? (
                        <>
                          <div style={{ fontSize: 16, fontWeight: 800, color: '#1e2d6b' }}>{fmt(seg.schoolValue)} <span style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8' }}>alunos</span></div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{seg.ranking}º de {seg.totalActive} · {seg.marketSharePct?.toFixed(1)}% de share</div>
                          {seg.topCompetitors.length > 0 && (
                            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
                              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 4 }}>
                                Concorrentes nessa etapa
                              </div>
                              {seg.topCompetitors.map((c, i) => (
                                <div key={c.co_entidade} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', minWidth: 12 }}>{i + 1}</span>
                                  <span style={{ flex: 1, fontSize: 10.5, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {c.no_entidade}
                                  </span>
                                  <span style={{ fontSize: 10, fontWeight: 600, color: '#64748b', flexShrink: 0 }}>
                                    {fmt(c.value)} ({c.marketSharePct.toFixed(0)}%)
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>Sem atuação nessa etapa</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Distribuição por rede de ensino (privada vs pública) */}
              {metrics.dependencyBreakdown.length > 0 && (() => {
                const totalStudentsAllNetworks = metrics.dependencyBreakdown.reduce((s, d) => s + d.totalStudents, 0)
                const depColor: Record<string, string> = { Privada: '#00A896', Federal: '#6366F1', Estadual: '#F59E0B', Municipal: '#94A3B8' }
                return (
                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 700, color: '#1e2d6b', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Building2 size={14} color="#6366f1" /> Distribuição por rede de ensino
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {metrics.dependencyBreakdown.map(d => {
                        const pct = totalStudentsAllNetworks > 0 ? (d.totalStudents / totalStudentsAllNetworks) * 100 : 0
                        return (
                          <div key={d.tp_dependencia} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 66, flexShrink: 0, fontSize: 12, fontWeight: 600, color: '#374151' }}>{d.label}</span>
                            <div style={{ flex: 1, height: 8, background: '#e5e7eb', borderRadius: 9999, overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: depColor[d.label] ?? '#94A3B8' }} />
                            </div>
                            <span style={{ fontSize: 11, color: '#64748b', flexShrink: 0, minWidth: 150, textAlign: 'right' }}>
                              {fmt(d.schoolCount)} {d.schoolCount === 1 ? 'escola' : 'escolas'} · {fmt(d.totalStudents)} alunos ({pct.toFixed(0)}%)
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {/* Interpretação */}
              {interpretation.length > 0 && (
                <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 12, padding: '14px 16px' }}>
                  <h4 style={{ fontSize: 12, fontWeight: 700, color: '#4338CA', margin: '0 0 8px' }}>O que os números mostram</h4>
                  {interpretation.map((p, i) => (
                    <p key={i} style={{ margin: i === 0 ? 0 : '8px 0 0', fontSize: 12.5, color: '#374151', lineHeight: 1.6 }}>{p}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
