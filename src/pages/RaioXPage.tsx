import { useState, useEffect, FormEvent } from 'react'
import { pdf } from '@react-pdf/renderer'
import { supabase } from '../lib/supabase'
import { SHARED_CSS } from '../styles/sharedCSS'
import AION_LOGO_B64 from '../lib/aionLogo'
import { calculateRaioXMetrics } from '../lib/raioXMetrics'
import RaioXPdfDocument from '../lib/raioXPdf'

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
type SearchStage = 'uf' | 'city' | 'school'

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

// CSS responsivo específico da página — breakpoints mobile, tap targets maiores
const RAIOX_CSS = `
.rx-hero { padding: 48px 20px 130px; }
.rx-card-wrap { margin: -90px auto 60px; padding: 0 20px; }
.rx-card { padding: 32px; transition: padding .2s ease; }
.rx-uf-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(58px, 1fr)); gap: 8px; }
.rx-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.rx-actions { display: flex; gap: 10px; }
.rx-list-item { display: block; width: 100%; text-align: left; padding: 14px 16px; border-radius: 10px; border: 1.5px solid ${BORDER}; background: #fff; cursor: pointer; min-height: 48px; transition: background .15s, border-color .15s; }
.rx-list-item:hover { background: ${SOFT}; border-color: ${VM}; }
.rx-uf-btn { padding: 13px 4px; border-radius: 10px; border: 1.5px solid ${BORDER}; background: #fff; color: ${TEXT}; font-size: 14px; font-weight: 700; cursor: pointer; min-height: 48px; transition: background .15s, border-color .15s; font-family: 'Plus Jakarta Sans', sans-serif; }
.rx-uf-btn:hover { background: ${SOFT}; border-color: ${VM}; color: ${VD}; }
@media (max-width: 480px) {
  .rx-hero { padding: 32px 16px 104px !important; }
  .rx-card-wrap { margin: -72px auto 36px !important; padding: 0 14px !important; }
  .rx-card { padding: 22px 18px !important; border-radius: 16px !important; }
  .rx-grid2 { grid-template-columns: 1fr !important; }
  .rx-actions { flex-direction: column !important; }
  .rx-actions > button, .rx-actions > a { width: 100% !important; }
  .rx-uf-grid { grid-template-columns: repeat(auto-fill, minmax(50px, 1fr)) !important; gap: 6px !important; }
}
`

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
const ufName = (uf: string) => UFS.find(u => u.uf === uf)?.name ?? uf

const STEP_LABELS = ['Buscar escola', 'Confirmar', 'Seus dados']
const STEP_INDEX: Record<Step, number> = { search: 0, confirm: 1, form: 2, success: 3 }

// mensagens rotativas exibidas enquanto o relatório é calculado/gerado
const LOADING_MESSAGES = [
  'Analisando os dados do Censo Escolar...',
  'Comparando com as escolas da sua região...',
  'Calculando ranking e participação de mercado...',
  'Montando os gráficos do seu relatório...',
  'A Áion Edu já ajuda escolas a organizar toda a captação de alunos...',
  'Preparando seu Raio-X Estratégico...',
]

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#374151',
  marginBottom: 6, marginTop: 16,
}
const headingStyle: React.CSSProperties = { margin: '0 0 4px', fontSize: 18, color: TEXT }
const subtextStyle: React.CSSProperties = { margin: '0 0 16px', fontSize: 13, color: MUTED }
const hintStyle: React.CSSProperties = { fontSize: 12.5, color: MUTED, marginTop: 12, textAlign: 'center' }
const errStyle: React.CSSProperties = { color: '#dc2626', fontSize: 12, marginTop: 8 }
const backLinkStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'none',
  color: VM, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: 0, marginBottom: 14,
}

// ─── componente ───────────────────────────────────────────────────────────
export default function RaioXPage() {
  // injeta a folha de estilos oficial do site (fontes, .inp, .btn-g, .tag-g etc.) + CSS responsivo da página
  useEffect(() => {
    const shared = document.createElement('style')
    shared.id = 'aion-css'
    shared.textContent = SHARED_CSS
    if (!document.getElementById('aion-css')) document.head.appendChild(shared)

    const own = document.createElement('style')
    own.id = 'raiox-css'
    own.textContent = RAIOX_CSS
    document.head.appendChild(own)

    return () => {
      document.getElementById('aion-css')?.remove()
      document.getElementById('raiox-css')?.remove()
    }
  }, [])

  const [step, setStep] = useState<Step>('search')
  const [searchStage, setSearchStage] = useState<SearchStage>('uf')

  // funil — passo 1: UF
  const [selectedUf, setSelectedUf] = useState('')

  // funil — passo 2: cidade (autocomplete filtrado pela UF)
  const [cityQuery, setCityQuery] = useState('')
  const [cityResults, setCityResults] = useState<string[]>([])
  const [citySearching, setCitySearching] = useState(false)
  const [cityError, setCityError] = useState<string | null>(null)
  const [selectedCity, setSelectedCity] = useState('')

  // funil — passo 3: escola (universo pré-carregado por UF+cidade, filtro local)
  const [schoolQuery, setSchoolQuery] = useState('')
  const [allSchools, setAllSchools] = useState<SchoolResult[]>([])
  const [loadingSchools, setLoadingSchools] = useState(false)
  const [schoolsError, setSchoolsError] = useState<string | null>(null)
  const [selectedSchool, setSelectedSchool] = useState<SchoolResult | null>(null)

  // formulário de captura
  const [directorName, setDirectorName] = useState('')
  const [role, setRole] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [city, setCity] = useState('')
  const [lgpdAccepted, setLgpdAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // geração do relatório em PDF (Fase C)
  const [pdfState, setPdfState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

  useEffect(() => {
    return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl) }
  }, [pdfUrl])

  // mensagens rotativas com fade durante a geração do relatório
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0)
  const [loadingMsgVisible, setLoadingMsgVisible] = useState(true)

  useEffect(() => {
    if (pdfState !== 'loading') { setLoadingMsgIndex(0); setLoadingMsgVisible(true); return }
    const interval = setInterval(() => {
      setLoadingMsgVisible(false)
      setTimeout(() => {
        setLoadingMsgIndex(i => (i + 1) % LOADING_MESSAGES.length)
        setLoadingMsgVisible(true)
      }, 300)
    }, 2500)
    return () => clearInterval(interval)
  }, [pdfState])

  // ── passo 2: busca de cidades com debounce, escopada pela UF escolhida ────
  useEffect(() => {
    if (searchStage !== 'city' || !selectedUf) return
    const term = cityQuery.trim()
    if (term.length < 1) { setCityResults([]); setCityError(null); return }
    const timer = setTimeout(() => runCitySearch(term), 300)
    return () => clearTimeout(timer)
  }, [cityQuery, searchStage, selectedUf])

  async function runCitySearch(term: string) {
    setCitySearching(true)
    setCityError(null)
    const safeTerm = term.replace(/[,()%*]/g, ' ').trim()
    if (!safeTerm) { setCitySearching(false); setCityResults([]); return }

    const { data, error } = await supabase
      .from('inep_escolas')
      .select('no_municipio')
      .eq('sg_uf', selectedUf)
      .ilike('no_municipio', `%${safeTerm}%`)
      .limit(500)
    setCitySearching(false)

    if (error) {
      setCityError('Não foi possível buscar agora. Tente novamente.')
      setCityResults([])
      return
    }

    const uniq = Array.from(new Set((data ?? []).map(r => r.no_municipio).filter((v): v is string => !!v)))
    uniq.sort((a, b) => a.localeCompare(b, 'pt-BR'))
    setCityResults(uniq.slice(0, 10))
  }

  // ── passo 3: pré-carrega todas as escolas da cidade escolhida (universo já pequeno) ─
  useEffect(() => {
    if (searchStage === 'school' && selectedUf && selectedCity) loadSchools()
  }, [searchStage, selectedUf, selectedCity]) // eslint-disable-line

  async function loadSchools() {
    setLoadingSchools(true)
    setSchoolsError(null)
    const { data, error } = await supabase
      .from('inep_escolas')
      .select('co_entidade, no_entidade, no_municipio, sg_uf, qt_mat_total, ano_censo')
      .eq('sg_uf', selectedUf)
      .eq('no_municipio', selectedCity)
      .order('ano_censo', { ascending: false })
    setLoadingSchools(false)

    if (error) {
      setSchoolsError('Não foi possível carregar as escolas agora. Tente novamente.')
      setAllSchools([])
      return
    }

    // a mesma escola aparece uma vez por ano do censo — mantém só o ano mais recente
    const seen = new Set<string>()
    const deduped: SchoolResult[] = []
    for (const row of (data ?? []) as SchoolResult[]) {
      if (seen.has(row.co_entidade)) continue
      seen.add(row.co_entidade)
      deduped.push(row)
    }
    deduped.sort((a, b) => a.no_entidade.localeCompare(b.no_entidade, 'pt-BR'))
    setAllSchools(deduped)
  }

  const schoolResults = schoolQuery.trim()
    ? allSchools.filter(s => s.no_entidade.toLowerCase().includes(schoolQuery.trim().toLowerCase()))
    : allSchools

  function pickUf(uf: string) {
    setSelectedUf(uf)
    setSearchStage('city')
    setCityQuery('')
    setCityResults([])
    setSelectedCity('')
  }

  function backToUf() {
    setSearchStage('uf')
    setSelectedCity('')
    setCityQuery('')
    setCityResults([])
  }

  function pickCity(cityName: string) {
    setSelectedCity(cityName)
    setSearchStage('school')
    setSchoolQuery('')
  }

  function backToCity() {
    setSearchStage('city')
    setAllSchools([])
    setSchoolQuery('')
  }

  function selectSchool(school: SchoolResult) {
    setSelectedSchool(school)
    setCity(school.no_municipio ?? '')
    setStep('confirm')
  }

  function backToSearch() {
    setSelectedSchool(null)
    setStep('search')
    setSearchStage('school')
  }

  async function generateReport(school: SchoolResult, director: string) {
    setPdfState('loading')
    try {
      const metrics = await calculateRaioXMetrics(school.co_entidade, school.no_municipio ?? '', school.sg_uf ?? '')
      if (!metrics) throw new Error('Sem dados suficientes')

      const generatedDate = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
      const blob = await pdf(
        <RaioXPdfDocument data={{ metrics, directorName: director, generatedDate }} />
      ).toBlob()

      setPdfUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob) })
      setPdfState('ready')
    } catch {
      setPdfState('error')
    }
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
      void generateReport(selectedSchool, directorName.trim())
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
      <div className="rx-hero" style={{ background: HERO_GRADIENT, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', bottom: -100, left: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ maxWidth: 620, margin: '0 auto', position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={{ background: 'rgba(255,255,255,0.96)', borderRadius: 16, padding: '10px 18px', display: 'inline-flex', alignItems: 'center', marginBottom: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
            <img src={AION_LOGO_B64} alt="Áion Edu" style={{ height: 30, objectFit: 'contain' }} />
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
      <div className="rx-card-wrap" style={{ maxWidth: 560, position: 'relative', zIndex: 2 }}>
        <div className="rx-card" style={{ background: '#fff', borderRadius: 20, boxShadow: '0 20px 50px rgba(0,82,60,0.18)', border: `1px solid ${BORDER}` }}>

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

          {/* ── Passo 1: busca em funil (UF → Cidade → Escola) ──────── */}
          {step === 'search' && (
            <div>
              {searchStage === 'uf' && (
                <div>
                  <h2 className="s-title" style={headingStyle}>Em qual estado sua escola está?</h2>
                  <p style={subtextStyle}>Selecione o estado (UF) para começar a busca.</p>
                  <div className="rx-uf-grid">
                    {UFS.map(u => (
                      <button key={u.uf} type="button" className="rx-uf-btn" onClick={() => pickUf(u.uf)}>
                        {u.uf}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {searchStage === 'city' && (
                <div>
                  <button type="button" style={backLinkStyle} onClick={backToUf}>← {ufName(selectedUf)}</button>
                  <h2 className="s-title" style={headingStyle}>Qual é a cidade?</h2>
                  <p style={subtextStyle}>Digite o nome da cidade em {ufName(selectedUf)}.</p>
                  <input
                    className="inp"
                    value={cityQuery}
                    onChange={e => setCityQuery(e.target.value)}
                    placeholder="Nome da cidade"
                    autoFocus
                  />
                  {cityError && <p style={errStyle}>{cityError}</p>}
                  {citySearching && <p style={hintStyle}>Buscando...</p>}
                  {!citySearching && !cityError && cityQuery.trim().length >= 1 && cityResults.length === 0 && (
                    <p style={hintStyle}>Nenhuma cidade encontrada.</p>
                  )}
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                    {cityResults.map(c => (
                      <button key={c} type="button" className="rx-list-item" onClick={() => pickCity(c)}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{c}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {searchStage === 'school' && (
                <div>
                  <button type="button" style={backLinkStyle} onClick={backToCity}>← {selectedCity}/{selectedUf}</button>
                  <h2 className="s-title" style={headingStyle}>Qual é a sua escola?</h2>
                  <p style={subtextStyle}>
                    {loadingSchools ? 'Carregando escolas...' : `${allSchools.length} escola(s) encontrada(s) em ${selectedCity}/${selectedUf}.`}
                  </p>
                  <input
                    className="inp"
                    value={schoolQuery}
                    onChange={e => setSchoolQuery(e.target.value)}
                    placeholder="Filtrar pelo nome da escola"
                  />
                  {schoolsError && <p style={errStyle}>{schoolsError}</p>}

                  {loadingSchools ? (
                    <div style={{ textAlign: 'center', padding: '28px 0' }}>
                      <div style={{ width: 26, height: 26, margin: '0 auto', border: `3px solid ${VM}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'raiox-spin 0.8s linear infinite' }} />
                    </div>
                  ) : (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
                      {schoolResults.length === 0 && <p style={hintStyle}>Nenhuma escola encontrada com esse filtro.</p>}
                      {schoolResults.map(r => (
                        <button key={r.co_entidade} type="button" className="rx-list-item" onClick={() => selectSchool(r)}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{r.no_entidade}</div>
                          <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                            {r.qt_mat_total != null ? `${r.qt_mat_total.toLocaleString('pt-BR')} matrículas` : 'Matrículas não informadas'} · Censo {r.ano_censo}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Passo 2: confirmação ───────────────────────────────── */}
          {step === 'confirm' && selectedSchool && (
            <div>
              <h2 className="s-title" style={headingStyle}>É esta a sua escola?</h2>
              <p style={subtextStyle}>Confirme os dados antes de continuar.</p>

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

              <div className="rx-actions" style={{ marginTop: 20 }}>
                <button type="button" className="btn-outline-green" onClick={backToSearch} style={{ flex: '0 0 auto', padding: '12px 18px', fontSize: 13 }}>
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
              <h2 className="s-title" style={headingStyle}>Seus dados de contato</h2>
              <p style={{ margin: '0 0 4px', fontSize: 13, color: MUTED }}>Enviaremos o Raio-X Estratégico assim que estiver pronto.</p>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: SOFT, marginTop: 14 }}>
                <i className="ti ti-school" style={{ fontSize: 14, color: VD }} />
                <span style={{ fontSize: 12.5, color: TEXT, fontWeight: 600 }}>{selectedSchool.no_entidade}</span>
              </div>

              <label style={labelStyle}>Nome do diretor(a) *</label>
              <input className="inp" value={directorName} onChange={e => setDirectorName(e.target.value)} required placeholder="Seu nome completo" />

              <label style={labelStyle}>Cargo *</label>
              <input className="inp" value={role} onChange={e => setRole(e.target.value)} required placeholder="Ex: Diretor(a), Coordenador(a) Pedagógico(a)" />

              <div className="rx-grid2">
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
                <input type="checkbox" checked={lgpdAccepted} onChange={e => setLgpdAccepted(e.target.checked)} style={{ marginTop: 2, width: 18, height: 18, flexShrink: 0, accentColor: VM }} />
                <span style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>
                  Autorizo o uso dos meus dados para receber o Raio-X Estratégico da minha escola, conforme a{' '}
                  <a href="/privacidade" target="_blank" rel="noreferrer" style={{ color: VD, fontWeight: 600 }}>Política de Privacidade</a> e a LGPD. *
                </span>
              </label>

              {submitError && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 12 }}>{submitError}</p>}

              <div className="rx-actions" style={{ marginTop: 22 }}>
                <button type="button" className="btn-outline-green" onClick={() => setStep('confirm')} style={{ flex: '0 0 auto', padding: '12px 18px', fontSize: 13 }}>
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

          {/* ── Passo 4: relatório (Fase C — geração real do PDF) ──── */}
          {step === 'success' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              {pdfState !== 'ready' && pdfState !== 'error' && (
                <>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: SOFT, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <div style={{ width: 28, height: 28, border: `3px solid ${VM}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'raiox-spin 0.8s linear infinite' }} />
                  </div>
                  <h2 className="s-title" style={{ margin: 0, fontSize: 19, color: TEXT }}>Gerando seu relatório...</h2>
                  <p
                    style={{
                      margin: '10px 0 0', fontSize: 13.5, color: MUTED, lineHeight: 1.6, minHeight: 42,
                      maxWidth: 360, marginLeft: 'auto', marginRight: 'auto',
                      opacity: loadingMsgVisible ? 1 : 0, transition: 'opacity 0.3s ease',
                    }}
                  >
                    {LOADING_MESSAGES[loadingMsgIndex]}
                  </p>
                </>
              )}

              {pdfState === 'ready' && pdfUrl && selectedSchool && (
                <>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: SOFT, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <i className="ti ti-circle-check" style={{ fontSize: 30, color: VM }} />
                  </div>
                  <h2 className="s-title" style={{ margin: 0, fontSize: 19, color: TEXT }}>Seu relatório está pronto!</h2>
                  <p style={{ margin: '10px 0 0', fontSize: 13.5, color: MUTED, lineHeight: 1.6, maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
                    O Raio-X Estratégico de <strong>{selectedSchool.no_entidade}</strong> já pode ser baixado.
                  </p>
                  <a
                    href={pdfUrl}
                    download={`raio-x-${selectedSchool.no_entidade.replace(/\s+/g, '_')}.pdf`}
                    className="btn-g"
                    style={{ marginTop: 20, justifyContent: 'center' }}
                  >
                    Baixar Relatório Gratuito
                  </a>
                </>
              )}

              {pdfState === 'error' && (
                <>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <i className="ti ti-alert-circle" style={{ fontSize: 28, color: '#dc2626' }} />
                  </div>
                  <h2 className="s-title" style={{ margin: 0, fontSize: 19, color: TEXT }}>Não foi possível gerar o relatório</h2>
                  <p style={{ margin: '10px 0 0', fontSize: 13.5, color: MUTED, lineHeight: 1.6, maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
                    Seu cadastro foi recebido normalmente, mas houve um problema ao calcular os indicadores. Tente novamente.
                  </p>
                  <button
                    type="button"
                    className="btn-outline-green"
                    onClick={() => selectedSchool && generateReport(selectedSchool, directorName.trim())}
                    style={{ marginTop: 18 }}
                  >
                    Tentar novamente
                  </button>
                </>
              )}

              <style>{`@keyframes raiox-spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
