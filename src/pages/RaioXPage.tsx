import { useState, useEffect, useRef, FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { SHARED_CSS } from '../styles/sharedCSS'
import AION_LOGO_B64 from '../lib/aionLogo'

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

// ─── design tokens — paleta oficial da Áion Edu (ver src/styles/sharedCSS.ts) ─
const VD     = '#00523C' // verde escuro — cor primária da marca
const VMID   = '#006B50' // verde médio — hover
const VM     = '#00A896' // teal — acento/CTA secundário
const VC     = '#0DD3BF' // mint — destaque
const TEXT   = '#111827'
const MUTED  = '#6b7280'
const BORDER = '#E5E7EB'
const SOFT   = '#E6F7F5' // fundo mint claro (mesmo de .tag-g)

const HERO_GRADIENT = `linear-gradient(135deg, ${VD} 0%, ${VMID} 50%, ${VM} 100%)`

const UFS = [
  { uf: 'AC', name: 'Acre' }, { uf: 'AL', name: 'Alagoas' }, { uf: 'AP', name: 'Amapá' },
  { uf: 'AM', name: 'Amazonas' }, { uf: 'BA', name: 'Bahia' }, { uf: 'CE', name: 'Ceará' },
  { uf: 'DF', name: 'Distrito Federal' }, { uf: 'ES', name: 'Espírito Santo' }, { uf: 'GO', name: 'Goiás' },
  { uf: 'MA', name: 'Maranhão' }, { uf: 'MT', name: 'Mato Grosso' }, { uf: 'MS', name: 'Mato Grosso do Sul' },
  { uf: 'MG', name: 'Minas Gerais' }, { uf: 'PA', name: 'Pará' }, { uf: 'PB', name: 'Paraíba' },
  { uf: 'PR', name: 'Paraná' }, { uf: 'PE', name: 'Pernambuco' }, { uf: 'PI', name: 'Piauí' },
  { uf: 'RJ', name: 'Rio de Janeiro' }, { uf: 'RN', name: 'Rio Grande do Norte' }, { uf: 'RS', name: 'Rio Grande do Sul' },
  { uf: 'RO', name: 'Rondônia' }, { uf: 'RR', name: 'Roraima' }, { uf: 'SC', name: 'Santa Catarina' },
  { uf: 'SP', name: 'São Paulo' }, { uf: 'SE', name: 'Sergipe' }, { uf: 'TO', name: 'Tocantins' },
]

const STEP_LABELS = ['Buscar escola', 'Confirmar', 'Seus dados']
const STEP_INDEX: Record<Step, number> = { search: 0, confirm: 1, form: 2, success: 3 }

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#374151',
  marginBottom: 6, marginTop: 16,
}

// ─── componente ───────────────────────────────────────────────────────────
export default function RaioXPage() {
  // injeta a folha de estilos oficial do site (fontes, .inp, .btn-g, .tag-g etc.)
  useEffect(() => {
    const el = document.createElement('style')
    el.id = 'aion-css'
    el.textContent = SHARED_CSS
    if (!document.getElementById('aion-css')) document.head.appendChild(el)
    return () => { document.getElementById('aion-css')?.remove() }
  }, [])

  const [step, setStep] = useState<Step>('search')

  // busca de escola
  const [query, setQuery] = useState('')
  const [ufFilter, setUfFilter] = useState('')
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

  // ── busca com debounce (nome, cidade ou UF simultaneamente + filtro de UF) ─
  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) { setResults([]); setSearchError(null); return }
    const timer = setTimeout(() => runSearch(term), 350)
    return () => clearTimeout(timer)
  }, [query, ufFilter])

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

    // sanitiza caracteres que quebrariam a sintaxe do filtro .or() do PostgREST
    const safeTerm = term.replace(/[,()%*]/g, ' ').trim()
    if (!safeTerm) { setSearching(false); setResults([]); return }

    let q = supabase
      .from('inep_escolas')
      .select('co_entidade, no_entidade, no_municipio, sg_uf, qt_mat_total, ano_censo')
      .or(`no_entidade.ilike.%${safeTerm}%,no_municipio.ilike.%${safeTerm}%,sg_uf.ilike.%${safeTerm}%`)
      .order('ano_censo', { ascending: false })
      .limit(300)

    if (ufFilter) q = q.eq('sg_uf', ufFilter)

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

  const disabledBtnStyle: React.CSSProperties = {
    background: '#E5E7EB', color: '#9CA3AF', boxShadow: 'none', cursor: 'not-allowed', pointerEvents: 'none',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div style={{ background: HERO_GRADIENT, padding: '48px 20px 130px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', bottom: -100, left: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ maxWidth: 620, margin: '0 auto', position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={{ background: 'rgba(255,255,255,0.96)', borderRadius: 16, padding: '10px 18px', display: 'inline-flex', alignItems: 'center', marginBottom: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
            <img src={AION_LOGO_B64} alt="Áion Edu" style={{ height: 30, objectFit: 'contain' }} />
          </div>
          <div className="tag-d" style={{ marginBottom: 16 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: VC, display: 'inline-block' }} />
            AION EDU
          </div>
          <h1 className="s-title" style={{ margin: 0, fontSize: 30, color: '#fff' }}>
            Raio-X Estratégico da Escola
          </h1>
          <p style={{ margin: '12px 0 0', fontSize: 15, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
            Descubra gratuitamente como sua escola está posicionada frente à concorrência da sua região — com dados oficiais do Censo Escolar INEP.
          </p>
        </div>
      </div>

      {/* ── Card ─────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 560, margin: '-90px auto 60px', padding: '0 20px', position: 'relative', zIndex: 2 }}>
        <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 20px 50px rgba(0,82,60,0.18)', border: `1px solid ${BORDER}`, padding: 32 }}>

          {step !== 'success' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
              {STEP_LABELS.map((label, i) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    background: i <= STEP_INDEX[step] ? `linear-gradient(135deg, ${VD}, ${VM})` : '#f1f5f9',
                    color: i <= STEP_INDEX[step] ? '#fff' : '#94a3b8',
                  }}>
                    {i + 1}
                  </div>
                  {i < STEP_LABELS.length - 1 && (
                    <div style={{ width: 24, height: 2, background: i < STEP_INDEX[step] ? VM : '#e5e7eb' }} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Passo 1: busca ─────────────────────────────────────── */}
          {step === 'search' && (
            <div>
              <h2 className="s-title" style={{ margin: '0 0 4px', fontSize: 18, color: TEXT }}>Qual é a sua escola?</h2>
              <p style={{ margin: '0 0 18px', fontSize: 13, color: MUTED }}>Busque pelo nome, cidade ou estado cadastrado no Censo Escolar do INEP.</p>

              <div style={{ display: 'flex', gap: 10 }}>
                <div ref={searchBoxRef} style={{ position: 'relative', flex: 1 }}>
                  <input
                    className="inp"
                    value={query}
                    onChange={e => { setQuery(e.target.value); setShowDropdown(true) }}
                    onFocus={() => results.length > 0 && setShowDropdown(true)}
                    placeholder="Nome da escola, cidade ou estado"
                  />
                  {showDropdown && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.12)', maxHeight: 320, overflowY: 'auto', zIndex: 10 }}>
                      {searching && (
                        <div style={{ padding: 16, fontSize: 13, color: MUTED, textAlign: 'center' }}>Buscando...</div>
                      )}
                      {!searching && results.length === 0 && query.trim().length >= 2 && (
                        <div style={{ padding: 16, fontSize: 13, color: MUTED, textAlign: 'center' }}>Nenhuma escola encontrada. Tente outro termo.</div>
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

                <select
                  className="inp"
                  value={ufFilter}
                  onChange={e => setUfFilter(e.target.value)}
                  style={{ width: 100, flexShrink: 0, cursor: 'pointer' }}
                  title="Refinar por estado"
                >
                  <option value="">UF</option>
                  {UFS.map(u => <option key={u.uf} value={u.uf}>{u.uf}</option>)}
                </select>
              </div>

              {ufFilter && (
                <div style={{ marginTop: 10 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: SOFT, color: VD, fontSize: 12, fontWeight: 700, border: '1px solid #A7F3D0' }}>
                    Filtrando por {UFS.find(u => u.uf === ufFilter)?.name ?? ufFilter}
                    <button
                      type="button"
                      onClick={() => setUfFilter('')}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: VD, fontWeight: 900, fontSize: 14, lineHeight: 1, padding: 0 }}
                      aria-label="Remover filtro de UF"
                    >
                      ×
                    </button>
                  </span>
                </div>
              )}

              {searchError && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{searchError}</p>}
              <p style={{ fontSize: 12, color: MUTED, marginTop: 10 }}>
                Dica: a busca encontra escolas pelo nome, pela cidade ou pelo estado — útil quando há escolas com nomes parecidos em cidades diferentes. Use o seletor de UF para refinar ainda mais.
              </p>
            </div>
          )}

          {/* ── Passo 2: confirmação ───────────────────────────────── */}
          {step === 'confirm' && selectedSchool && (
            <div>
              <h2 className="s-title" style={{ margin: '0 0 4px', fontSize: 18, color: TEXT }}>É esta a sua escola?</h2>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: MUTED }}>Confirme os dados antes de continuar.</p>

              <div style={{ border: `1.5px solid ${BORDER}`, borderRadius: 14, padding: 20, background: SOFT }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
                    <i className="ti ti-school" style={{ fontSize: 20, color: VD }} />
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
                <button type="button" className="btn-outline-green" onClick={backToSearch} style={{ flex: '0 0 auto', padding: '11px 18px', fontSize: 13 }}>
                  ← Buscar outra
                </button>
                <button type="button" className="btn-g" onClick={() => setStep('form')} style={{ flex: 1, justifyContent: 'center', fontSize: 13, padding: '12px 18px' }}>
                  Confirmar e continuar
                </button>
              </div>
            </div>
          )}

          {/* ── Passo 3: formulário ────────────────────────────────── */}
          {step === 'form' && selectedSchool && (
            <form onSubmit={handleSubmit}>
              <h2 className="s-title" style={{ margin: '0 0 4px', fontSize: 18, color: TEXT }}>Seus dados de contato</h2>
              <p style={{ margin: '0 0 4px', fontSize: 13, color: MUTED }}>Enviaremos o Raio-X Estratégico assim que estiver pronto.</p>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: SOFT, marginTop: 14 }}>
                <i className="ti ti-school" style={{ fontSize: 14, color: VD }} />
                <span style={{ fontSize: 12.5, color: TEXT, fontWeight: 600 }}>{selectedSchool.no_entidade}</span>
              </div>

              <label style={labelStyle}>Nome do diretor(a) *</label>
              <input className="inp" value={directorName} onChange={e => setDirectorName(e.target.value)} required placeholder="Seu nome completo" />

              <label style={labelStyle}>Cargo *</label>
              <input className="inp" value={role} onChange={e => setRole(e.target.value)} required placeholder="Ex: Diretor(a), Coordenador(a) Pedagógico(a)" />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>WhatsApp *</label>
                  <input className="inp" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} required placeholder="(00) 00000-0000" />
                </div>
                <div>
                  <label style={labelStyle}>Cidade *</label>
                  <input className="inp" value={city} onChange={e => setCity(e.target.value)} required placeholder="Sua cidade" />
                </div>
              </div>

              <label style={labelStyle}>E-mail *</label>
              <input className="inp" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" />

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 18, cursor: 'pointer' }}>
                <input type="checkbox" checked={lgpdAccepted} onChange={e => setLgpdAccepted(e.target.checked)} style={{ marginTop: 2, width: 16, height: 16, accentColor: VM }} />
                <span style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>
                  Autorizo o uso dos meus dados para receber o Raio-X Estratégico da minha escola, conforme a{' '}
                  <a href="/privacidade" target="_blank" rel="noreferrer" style={{ color: VD, fontWeight: 600 }}>Política de Privacidade</a> e a LGPD. *
                </span>
              </label>

              {submitError && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 12 }}>{submitError}</p>}

              <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
                <button type="button" className="btn-outline-green" onClick={() => setStep('confirm')} style={{ flex: '0 0 auto', padding: '11px 18px', fontSize: 13 }}>
                  ← Voltar
                </button>
                <button
                  type="submit"
                  className="btn-g"
                  disabled={!canSubmit || submitting}
                  style={{ flex: 1, justifyContent: 'center', fontSize: 14, padding: '13px 18px', ...(!canSubmit || submitting ? disabledBtnStyle : {}) }}
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
                <div style={{ width: 28, height: 28, border: `3px solid ${VM}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'raiox-spin 0.8s linear infinite' }} />
              </div>
              <h2 className="s-title" style={{ margin: 0, fontSize: 19, color: TEXT }}>Gerando seu relatório...</h2>
              <p style={{ margin: '10px 0 0', fontSize: 13.5, color: MUTED, lineHeight: 1.6, maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
                Recebemos seus dados para <strong>{selectedSchool?.no_entidade}</strong>. Em breve você receberá o Raio-X Estratégico da sua escola por e-mail e WhatsApp.
              </p>
              <style>{`@keyframes raiox-spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
