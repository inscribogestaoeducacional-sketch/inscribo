import { useState, useEffect, useRef, FormEvent } from 'react'
import { supabase } from '../lib/supabase'

// ─── tipos ──────────────────────────────────────────────────────────────────
interface SchoolResult {
  co_entidade: string
  no_entidade: string
  no_municipio: string | null
  sg_uf: string | null
  qt_mat_total: number | null
  ano_censo: number
}

type Step = 'search' | 'confirm' | 'form' | 'success'

// ─── design tokens (azul → roxo, identidade AION EDU) ──────────────────────
const BLUE   = '#1e3a8a'
const INDIGO = '#4338ca'
const PURPLE = '#7c3aed'
const TEXT   = '#111827'
const MUTED  = '#6b7280'
const BORDER = '#e5e7eb'
const SOFT   = '#f5f3ff'

const HERO_GRADIENT   = `linear-gradient(135deg, ${BLUE} 0%, ${INDIGO} 55%, ${PURPLE} 100%)`
const BUTTON_GRADIENT = `linear-gradient(135deg, ${INDIGO}, ${PURPLE})`

const STEP_LABELS = ['Buscar escola', 'Confirmar', 'Seus dados']
const STEP_INDEX: Record<Step, number> = { search: 0, confirm: 1, form: 2, success: 3 }

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#374151',
  marginBottom: 6, marginTop: 16,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 10,
  border: `1.5px solid ${BORDER}`, fontSize: 14, outline: 'none',
  background: '#fafafa', boxSizing: 'border-box',
}

// ─── componente ───────────────────────────────────────────────────────────
export default function RaioXPage() {
  const [step, setStep] = useState<Step>('search')

  // busca de escola
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SchoolResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedSchool, setSelectedSchool] = useState<SchoolResult | null>(null)
  const searchBoxRef = useRef<HTMLDivElement>(null)

  // formulário de captura
  const [directorName, setDirectorName] = useState('')
  const [role, setRole] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [city, setCity] = useState('')
  const [lgpdAccepted, setLgpdAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ── busca com debounce ────────────────────────────────────────────────
  useEffect(() => {
    const term = query.trim()
    if (term.length < 3) { setResults([]); setSearchError(null); return }
    const timer = setTimeout(() => runSearch(term), 350)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  async function runSearch(term: string) {
    setSearching(true)
    setSearchError(null)

    // "Nome da escola, Cidade" -> filtro adicional por município
    const [namePart, cityPart] = term.split(',').map(s => s.trim())

    let q = supabase
      .from('inep_escolas')
      .select('co_entidade, no_entidade, no_municipio, sg_uf, qt_mat_total, ano_censo')
      .ilike('no_entidade', `%${namePart}%`)
      .order('ano_censo', { ascending: false })
      .limit(300)

    if (cityPart) q = q.ilike('no_municipio', `%${cityPart}%`)

    const { data, error } = await q
    setSearching(false)

    if (error) {
      setSearchError('Não foi possível buscar agora. Tente novamente.')
      setResults([])
      return
    }

    // a mesma escola aparece uma vez por ano do censo — mantém só o ano mais recente
    const seen = new Set<string>()
    const deduped: SchoolResult[] = []
    for (const row of (data ?? []) as SchoolResult[]) {
      if (seen.has(row.co_entidade)) continue
      seen.add(row.co_entidade)
      deduped.push(row)
      if (deduped.length >= 8) break
    }
    setResults(deduped)
    setShowDropdown(true)
  }

  function selectSchool(school: SchoolResult) {
    setSelectedSchool(school)
    setShowDropdown(false)
    setCity(school.no_municipio ?? '')
    setStep('confirm')
  }

  function backToSearch() {
    setSelectedSchool(null)
    setStep('search')
  }

  const digits = whatsapp.replace(/\D/g, '')
  const canSubmit =
    directorName.trim().length > 1 &&
    role.trim().length > 1 &&
    digits.length >= 10 &&
    /^\S+@\S+\.\S+$/.test(email.trim()) &&
    city.trim().length > 1 &&
    lgpdAccepted

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit || !selectedSchool || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/raio-x-lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          director_name: directorName.trim(),
          role: role.trim(),
          phone: whatsapp.trim(),
          email: email.trim(),
          city: city.trim(),
          state: selectedSchool.sg_uf,
          school_name: selectedSchool.no_entidade,
          co_entidade: selectedSchool.co_entidade,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Erro ao enviar. Tente novamente.')
      setStep('success')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erro ao enviar. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div style={{ background: HERO_GRADIENT, padding: '48px 20px 130px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', bottom: -100, left: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ maxWidth: 620, margin: '0 auto', position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(255,255,255,0.95)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
            <img src="/aion-logo-icon.png" alt="AION EDU" style={{ height: 30, objectFit: 'contain' }} />
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 999, background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa' }} />
            AION EDU
          </div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.25 }}>
            Raio-X Estratégico da Escola
          </h1>
          <p style={{ margin: '12px 0 0', fontSize: 15, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
            Descubra gratuitamente como sua escola está posicionada frente à concorrência da sua região — com dados oficiais do Censo Escolar INEP.
          </p>
        </div>
      </div>

      {/* ── Card ─────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 560, margin: '-90px auto 60px', padding: '0 20px', position: 'relative', zIndex: 2 }}>
        <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 20px 50px rgba(30,27,75,0.15)', border: `1px solid ${BORDER}`, padding: 32 }}>

          {step !== 'success' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
              {STEP_LABELS.map((label, i) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    background: i <= STEP_INDEX[step] ? BUTTON_GRADIENT : '#f1f5f9',
                    color: i <= STEP_INDEX[step] ? '#fff' : '#94a3b8',
                  }}>
                    {i + 1}
                  </div>
                  {i < STEP_LABELS.length - 1 && (
                    <div style={{ width: 24, height: 2, background: i < STEP_INDEX[step] ? INDIGO : '#e5e7eb' }} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Passo 1: busca ─────────────────────────────────────── */}
          {step === 'search' && (
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: TEXT }}>Qual é a sua escola?</h2>
              <p style={{ margin: '0 0 18px', fontSize: 13, color: MUTED }}>Busque pelo nome cadastrado no Censo Escolar do INEP.</p>

              <div ref={searchBoxRef} style={{ position: 'relative' }}>
                <input
                  value={query}
                  onChange={e => { setQuery(e.target.value); setShowDropdown(true) }}
                  onFocus={() => results.length > 0 && setShowDropdown(true)}
                  placeholder="Nome da escola (ex: Escola ABC, Manaus)"
                  style={inputStyle}
                />
                {showDropdown && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.12)', maxHeight: 320, overflowY: 'auto', zIndex: 10 }}>
                    {searching && (
                      <div style={{ padding: 16, fontSize: 13, color: MUTED, textAlign: 'center' }}>Buscando...</div>
                    )}
                    {!searching && results.length === 0 && query.trim().length >= 3 && (
                      <div style={{ padding: 16, fontSize: 13, color: MUTED, textAlign: 'center' }}>Nenhuma escola encontrada. Tente outro nome.</div>
                    )}
                    {!searching && results.map(r => (
                      <button
                        key={r.co_entidade}
                        type="button"
                        onClick={() => selectSchool(r)}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 16px', border: 'none', borderBottom: '1px solid #f3f4f6', background: '#fff', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.background = SOFT)}
                        onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                      >
                        <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{r.no_entidade}</div>
                        <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                          {r.no_municipio ?? '—'}{r.sg_uf ? `/${r.sg_uf}` : ''} · Censo {r.ano_censo}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {searchError && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{searchError}</p>}
              <p style={{ fontSize: 12, color: MUTED, marginTop: 10 }}>
                Dica: digite o nome da escola e, se quiser, a cidade separados por vírgula — útil quando há escolas com nomes parecidos em cidades diferentes.
              </p>
            </div>
          )}

          {/* ── Passo 2: confirmação ───────────────────────────────── */}
          {step === 'confirm' && selectedSchool && (
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: TEXT }}>É esta a sua escola?</h2>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: MUTED }}>Confirme os dados antes de continuar.</p>

              <div style={{ border: `1.5px solid ${BORDER}`, borderRadius: 14, padding: 20, background: SOFT }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
                    <i className="ti ti-school" style={{ fontSize: 20, color: INDIGO }} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: TEXT }}>{selectedSchool.no_entidade}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 13, color: MUTED }}>
                      {selectedSchool.no_municipio ?? '—'}{selectedSchool.sg_uf ? `/${selectedSchool.sg_uf}` : ''}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingTop: 14, borderTop: `1px solid ${BORDER}` }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Matrículas totais</p>
                    <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700, color: TEXT }}>
                      {selectedSchool.qt_mat_total != null ? selectedSchool.qt_mat_total.toLocaleString('pt-BR') : '—'}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Censo Escolar</p>
                    <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700, color: TEXT }}>{selectedSchool.ano_censo}</p>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button type="button" onClick={backToSearch} style={{ flex: '0 0 auto', padding: '12px 18px', borderRadius: 10, border: `1.5px solid ${BORDER}`, background: '#fff', color: MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  ← Buscar outra
                </button>
                <button type="button" onClick={() => setStep('form')} style={{ flex: 1, padding: '12px 18px', borderRadius: 10, border: 'none', background: BUTTON_GRADIENT, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  Confirmar e continuar
                </button>
              </div>
            </div>
          )}

          {/* ── Passo 3: formulário ────────────────────────────────── */}
          {step === 'form' && selectedSchool && (
            <form onSubmit={handleSubmit}>
              <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: TEXT }}>Seus dados de contato</h2>
              <p style={{ margin: '0 0 4px', fontSize: 13, color: MUTED }}>Enviaremos o Raio-X Estratégico assim que estiver pronto.</p>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: SOFT, marginTop: 14 }}>
                <i className="ti ti-school" style={{ fontSize: 14, color: INDIGO }} />
                <span style={{ fontSize: 12.5, color: TEXT, fontWeight: 600 }}>{selectedSchool.no_entidade}</span>
              </div>

              <label style={labelStyle}>Nome do diretor(a) *</label>
              <input value={directorName} onChange={e => setDirectorName(e.target.value)} required style={inputStyle} placeholder="Seu nome completo" />

              <label style={labelStyle}>Cargo *</label>
              <input value={role} onChange={e => setRole(e.target.value)} required style={inputStyle} placeholder="Ex: Diretor(a), Coordenador(a) Pedagógico(a)" />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>WhatsApp *</label>
                  <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} required style={inputStyle} placeholder="(00) 00000-0000" />
                </div>
                <div>
                  <label style={labelStyle}>Cidade *</label>
                  <input value={city} onChange={e => setCity(e.target.value)} required style={inputStyle} placeholder="Sua cidade" />
                </div>
              </div>

              <label style={labelStyle}>E-mail *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} placeholder="seu@email.com" />

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 18, cursor: 'pointer' }}>
                <input type="checkbox" checked={lgpdAccepted} onChange={e => setLgpdAccepted(e.target.checked)} style={{ marginTop: 2, width: 16, height: 16, accentColor: INDIGO }} />
                <span style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>
                  Autorizo o uso dos meus dados para receber o Raio-X Estratégico da minha escola, conforme a{' '}
                  <a href="/privacidade" target="_blank" rel="noreferrer" style={{ color: INDIGO, fontWeight: 600 }}>Política de Privacidade</a> e a LGPD. *
                </span>
              </label>

              {submitError && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 12 }}>{submitError}</p>}

              <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
                <button type="button" onClick={() => setStep('confirm')} style={{ flex: '0 0 auto', padding: '13px 18px', borderRadius: 10, border: `1.5px solid ${BORDER}`, background: '#fff', color: MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  ← Voltar
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit || submitting}
                  style={{
                    flex: 1, padding: '13px 18px', borderRadius: 10, border: 'none',
                    background: canSubmit && !submitting ? BUTTON_GRADIENT : '#e5e7eb',
                    color: canSubmit && !submitting ? '#fff' : '#9ca3af',
                    fontSize: 14, fontWeight: 700,
                    cursor: canSubmit && !submitting ? 'pointer' : 'not-allowed',
                  }}
                >
                  {submitting ? 'Enviando...' : 'Gerar meu Raio-X gratuito'}
                </button>
              </div>
            </form>
          )}

          {/* ── Passo 4: sucesso (Fase A — geração real vem na Fase C) ── */}
          {step === 'success' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: SOFT, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              </div>
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: TEXT }}>Gerando seu relatório...</h2>
              <p style={{ margin: '10px 0 0', fontSize: 13.5, color: MUTED, lineHeight: 1.6, maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
                Recebemos seus dados para <strong>{selectedSchool?.no_entidade}</strong>. Em breve você receberá o Raio-X Estratégico da sua escola por e-mail e WhatsApp.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
