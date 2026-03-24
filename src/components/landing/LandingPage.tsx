import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, CheckCircle, ChevronDown, Menu, X, Star,
  Target, BarChart3, TrendingUp, RefreshCw, MessageCircle,
  ClipboardList, Upload, Zap, Bell
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

// ─── Logo component ────────────────────────────────────────────────────────────
function LogoMark({ dark = false }: { dark?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: dark ? '#00523C' : 'rgba(255,255,255,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: dark ? '#00A896' : 'white', border: '2px solid rgba(255,255,255,0.5)' }} />
      </div>
      <div>
        <div style={{ fontSize: 17, fontWeight: 800, color: dark ? '#00523C' : 'white', letterSpacing: '-0.02em', lineHeight: 1.1 }}>Áion Edu</div>
        <div style={{ fontSize: 9, color: dark ? '#64748b' : 'rgba(255,255,255,0.7)', lineHeight: 1 }}>Inteligência em matrículas</div>
      </div>
    </div>
  )
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const links = [
    { label: 'Funcionalidades', href: '#funcionalidades' },
    { label: 'Como funciona',   href: '#como-funciona'   },
    { label: 'Depoimentos',     href: '#depoimentos'     },
  ]

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white shadow-md' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <LogoMark dark={scrolled} />

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            {links.map(l => (
              <a key={l.href} href={l.href} className={`text-sm font-medium transition-colors ${scrolled ? 'text-gray-700 hover:text-[#00523C]' : 'text-white/90 hover:text-white'}`}>
                {l.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/login" className={`px-4 py-2 text-sm font-semibold rounded-lg border transition-colors ${scrolled ? 'border-[#00523C] text-[#00523C] hover:bg-[#00523C] hover:text-white' : 'border-white text-white hover:bg-white/10'}`}>
              Entrar
            </Link>
            <a href="#demo" className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#00A896] text-white hover:bg-[#007A5A] transition-colors shadow-sm">
              Demonstração gratuita
            </a>
          </div>

          <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className={scrolled ? 'text-gray-700' : 'text-white'} /> : <Menu className={scrolled ? 'text-gray-700' : 'text-white'} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-3 shadow-lg">
          {links.map(l => (
            <a key={l.href} href={l.href} onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-gray-700 hover:text-[#00523C]">
              {l.label}
            </a>
          ))}
          <div className="flex gap-3 pt-2">
            <Link to="/login" className="flex-1 text-center px-4 py-2 text-sm font-semibold rounded-lg border border-[#00523C] text-[#00523C]">
              Entrar
            </Link>
            <a href="#demo" className="flex-1 text-center px-4 py-2 text-sm font-semibold rounded-lg bg-[#00A896] text-white">
              Demonstração
            </a>
          </div>
        </div>
      )}
    </nav>
  )
}

// ─── Hero ──────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-16"
      style={{ background: 'linear-gradient(135deg, #00523C 0%, #007A5A 55%, #00A896 100%)' }}>
      {/* Background shapes */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] opacity-10 rounded-full blur-3xl"
        style={{ background: '#00FFCC', transform: 'translate(30%, -30%)' }} />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] opacity-10 rounded-full blur-3xl"
        style={{ background: 'white', transform: 'translate(-30%, 30%)' }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium text-white/90 mb-8"
          style={{ animation: 'fadeInDown 0.6s ease both' }}>
          <span className="w-2 h-2 bg-[#00FFC2] rounded-full animate-pulse" />
          Usado por escolas privadas em todo o Brasil · Dados reais do INEP e Censo Escolar
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6 max-w-4xl mx-auto"
          style={{ animation: 'fadeInUp 0.7s ease 0.1s both' }}>
          Sua escola pronta para{' '}
          <span style={{ color: '#A7F3D0' }}>matricular mais</span>{' '}
          em 2027
        </h1>

        {/* Subheadline */}
        <p className="text-lg sm:text-xl text-white/80 max-w-2xl mx-auto mb-10 leading-relaxed"
          style={{ animation: 'fadeInUp 0.7s ease 0.2s both' }}>
          A Áion Edu analisa o histórico da sua escola, estuda o mercado local e gera um plano de campanha personalizado com IA — para você chegar em agosto já preparado.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6"
          style={{ animation: 'fadeInUp 0.7s ease 0.3s both' }}>
          <a href="#demo"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-[#00523C] font-bold rounded-xl hover:bg-gray-50 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5 text-base">
            Quero uma demonstração gratuita
            <ArrowRight className="w-5 h-5" />
          </a>
          <a href="#como-funciona"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-white/40 text-white font-semibold rounded-xl hover:bg-white/10 transition-all text-base">
            Ver como funciona →
          </a>
        </div>

        <p className="text-white/50 text-sm" style={{ animation: 'fadeInUp 0.7s ease 0.4s both' }}>
          Sem compromisso · Demonstração em 30 minutos · Suporte em português
        </p>
      </div>

      <style>{`
        @keyframes fadeInDown { from { opacity:0; transform:translateY(-20px) } to { opacity:1; transform:none } }
        @keyframes fadeInUp   { from { opacity:0; transform:translateY( 20px) } to { opacity:1; transform:none } }
      `}</style>
    </section>
  )
}

// ─── Números de impacto ────────────────────────────────────────────────────────
function Impacto() {
  const metrics = [
    { value: '+40%',   label: 'de novatos em média após o primeiro ciclo'       },
    { value: '85%',    label: 'de taxa de rematrícula como meta padrão'          },
    { value: '3 min',  label: 'para gerar o plano de campanha completo'          },
    { value: '5.000+', label: 'municípios com dados reais do INEP integrados'    },
  ]
  return (
    <section className="py-16" style={{ background: '#00523C' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {metrics.map(m => (
            <div key={m.value} className="text-center">
              <div className="text-4xl sm:text-5xl font-bold mb-2" style={{ color: '#A7F3D0' }}>{m.value}</div>
              <p className="text-white/70 text-sm leading-relaxed">{m.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Como funciona ────────────────────────────────────────────────────────────
function ComoFunciona() {
  const steps = [
    {
      n: '①',
      icon: <Upload className="w-8 h-8" style={{ color: '#00A896' }} />,
      title: 'Importe seu histórico',
      desc: 'Suba os relatórios do seu ERP (SIGA, Totvs, etc.). A IA lê e entende o padrão da sua escola em segundos.'
    },
    {
      n: '②',
      icon: <Zap className="w-8 h-8" style={{ color: '#00A896' }} />,
      title: 'Gere seu plano de campanha',
      desc: 'Com base no histórico + mercado local, a IA cria metas mês a mês, CPA sugerido e calendário de captação.'
    },
    {
      n: '③',
      icon: <BarChart3 className="w-8 h-8" style={{ color: '#00A896' }} />,
      title: 'Acompanhe e ajuste em tempo real',
      desc: 'Dashboard com desvios visuais, alertas automáticos e recálculo de rota quando necessário.'
    },
  ]

  return (
    <section id="como-funciona" className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-sm font-semibold uppercase tracking-widest" style={{ color: '#00A896' }}>Simples de usar</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900">Como funciona</h2>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">Em três passos, sua escola sai do improviso para um plano estruturado com IA.</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 relative">
          <div className="hidden lg:block absolute top-14 left-[calc(33%-40px)] right-[calc(33%-40px)] h-0.5"
            style={{ background: 'linear-gradient(90deg, #00A89630, #00A896, #00A89630)' }} />

          {steps.map((s, i) => (
            <div key={s.n} className="relative text-center bg-white rounded-2xl p-8 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white border-2 mb-6"
                style={{ borderColor: '#00A89640' }}>
                {s.icon}
                <span className="absolute -top-3 -right-3 w-8 h-8 text-white text-sm font-bold rounded-full flex items-center justify-center"
                  style={{ background: '#00523C' }}>{i + 1}</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{s.title}</h3>
              <p className="text-gray-600 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Funcionalidades ──────────────────────────────────────────────────────────
function Funcionalidades() {
  const features = [
    {
      emoji: '🎯',
      color: 'bg-emerald-50 text-emerald-700',
      title: 'Gerador de campanha com IA',
      desc: 'Plano completo com metas mensais, investimento e CPA baseado no seu histórico real.'
    },
    {
      emoji: '📊',
      color: 'bg-blue-50 text-blue-700',
      title: 'Relatórios cirúrgicos',
      desc: 'Funil, rematrícula, marketing e retenção — tudo em um painel com comparativos históricos.'
    },
    {
      emoji: '🏆',
      color: 'bg-amber-50 text-amber-700',
      title: 'Benchmark de mercado',
      desc: 'Compare sua escola com o setor usando dados reais do INEP e Censo Escolar.'
    },
    {
      emoji: '🔄',
      color: 'bg-rose-50 text-rose-700',
      title: 'Radar de retenção',
      desc: 'Cruza pesquisas de satisfação, transferências e rematrícula para identificar risco de evasão.'
    },
    {
      emoji: '📱',
      color: 'bg-green-50 text-green-700',
      title: 'WhatsApp integrado',
      desc: 'Automações, bot de atendimento e disparo de campanhas direto pelo número da escola.'
    },
    {
      emoji: '📋',
      color: 'bg-purple-50 text-purple-700',
      title: 'Pesquisa de satisfação',
      desc: 'Envie links para as famílias, colete respostas e receba análise da IA com ações prioritárias.'
    },
  ]

  return (
    <section id="funcionalidades" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-sm font-semibold uppercase tracking-widest" style={{ color: '#00A896' }}>Tudo que sua escola precisa</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900">Funcionalidades principais</h2>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">Da importação do ERP até o encerramento do ciclo, a Áion Edu acompanha cada decisão.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map(f => (
            <div key={f.title} className="group p-6 rounded-2xl border border-gray-100 hover:border-emerald-200 hover:shadow-lg transition-all">
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 text-2xl ${f.color}`}>
                {f.emoji}
              </div>
              <h3 className="font-bold text-gray-900 mb-2 text-lg">{f.title}</h3>
              <p className="text-gray-600 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Diferenciais ─────────────────────────────────────────────────────────────
function Diferenciais() {
  const items = [
    {
      title: 'Não é só um CRM — é inteligência de matrículas',
      desc: 'A maioria dos sistemas apenas registra leads. A Áion Edu estuda seus dados e diz o que fazer.'
    },
    {
      title: 'Dados do INEP integrados',
      desc: 'Sabemos quantas escolas concorrem com você, qual é o market share e onde está a oportunidade.'
    },
    {
      title: 'Calendário de captação personalizado',
      desc: 'Baseado nos picos históricos da sua escola — não em uma planilha genérica.'
    },
    {
      title: 'IA que aprende com cada ciclo',
      desc: 'A cada ano, o plano fica mais preciso porque a IA usa seu histórico real, não estimativas.'
    },
    {
      title: 'Tudo em português, para a realidade brasileira',
      desc: 'Calendário escolar brasileiro, ERPs nacionais, INEP, Censo Escolar — feito para o seu contexto.'
    },
  ]

  return (
    <section className="py-24" style={{ background: 'linear-gradient(135deg, #00523C 0%, #007A5A 100%)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-sm font-semibold uppercase tracking-widest" style={{ color: '#A7F3D0' }}>Por que escolher a Áion Edu</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-white">Por que somos diferentes?</h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item, i) => (
            <div key={i} className="flex gap-4 p-6 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <CheckCircle className="w-6 h-6 flex-shrink-0 mt-0.5" style={{ color: '#A7F3D0' }} />
              <div>
                <h3 className="font-bold text-white mb-1">{item.title}</h3>
                <p className="text-white/70 text-sm leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Depoimentos ──────────────────────────────────────────────────────────────
function Depoimentos() {
  const testimonials = [
    {
      avatar: 'DG',
      name: 'Diretora Geral',
      school: 'Escola Particular · Patos, PB',
      text: 'Antes eu chegava em agosto sem saber quantos alunos ia perder. Agora tenho um plano com metas por semana desde julho.'
    },
    {
      avatar: 'GP',
      name: 'Gestor Pedagógico',
      school: 'Colégio Privado · Campina Grande, PB',
      text: 'A IA identificou que nossa taxa de novatos estava caindo há 3 anos. Ninguém tinha percebido isso antes.'
    },
    {
      avatar: 'CA',
      name: 'Coordenador Administrativo',
      school: 'Escola Cristã · João Pessoa, PB',
      text: 'Em 3 minutos o sistema gerou um plano completo com investimento mês a mês. Inacreditável.'
    },
  ]

  return (
    <section id="depoimentos" className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-sm font-semibold uppercase tracking-widest" style={{ color: '#00A896' }}>Prova social</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900">O que dizem os gestores</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <div key={i} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex gap-1 mb-5">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-gray-700 leading-relaxed mb-6 text-base">"{t.text}"</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ background: '#00523C' }}>
                  {t.avatar}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                  <p className="text-gray-500 text-xs">{t.school}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── CTA Demo (formulário) ────────────────────────────────────────────────────
function CTADemo() {
  const [form, setForm] = useState({ name: '', email: '', school: '', city: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSending(true)
    try {
      const { error: dbErr } = await supabase
        .from('sales_pipeline')
        .insert({
          school_name:    form.school,
          contact_name:   form.name,
          contact_email:  form.email,
          city:           form.city.split('/')[0]?.trim(),
          state:          form.city.split('/')[1]?.trim() ?? '',
          stage:          'prospecting',
          notes:          `Lead da landing page. Email: ${form.email}`,
          next_action:    'Agendar demonstração',
          next_action_date: new Date(Date.now() + 2 * 86400000).toISOString().substring(0, 10),
        })
      if (dbErr) throw dbErr
      setSent(true)
    } catch {
      setError('Erro ao enviar. Tente novamente ou escreva para contato@aionedu.com.br')
    } finally {
      setSending(false)
    }
  }

  const inputCls = 'w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent text-sm transition-all'

  return (
    <section id="demo" className="py-24 bg-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="text-sm font-semibold uppercase tracking-widest" style={{ color: '#00A896' }}>Demonstração gratuita</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900">Comece antes da campanha de agosto</h2>
          <p className="mt-4 text-lg text-gray-600">
            Escolas que planejam com antecedência matriculam até 40% mais novatos.
          </p>
        </div>

        {sent ? (
          <div className="text-center p-12 rounded-2xl border-2" style={{ borderColor: '#00A896', background: '#f0fdf4' }}>
            <CheckCircle className="w-14 h-14 mx-auto mb-4" style={{ color: '#00523C' }} />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Recebemos sua solicitação!</h3>
            <p className="text-gray-600">Nossa equipe entrará em contato em até 24h para agendar a demonstração.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 bg-gray-50 rounded-2xl p-8 border border-gray-100">
            <input
              required
              placeholder="Nome completo"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className={inputCls}
              style={{ '--tw-ring-color': '#00A896' } as React.CSSProperties}
            />
            <input
              required type="email"
              placeholder="E-mail profissional"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className={inputCls}
            />
            <input
              required
              placeholder="Nome da escola"
              value={form.school}
              onChange={e => setForm(f => ({ ...f, school: e.target.value }))}
              className={inputCls}
            />
            <input
              required
              placeholder="Cidade / Estado (ex: João Pessoa / PB)"
              value={form.city}
              onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
              className={inputCls}
            />

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={sending}
              className="w-full py-4 rounded-xl text-white font-bold text-base flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #00523C, #007A5A)' }}>
              {sending ? 'Enviando...' : <>Quero minha demonstração gratuita <ArrowRight className="w-5 h-5" /></>}
            </button>

            <p className="text-center text-xs text-gray-400">
              Sem compromisso · Demonstração em 30 minutos · Suporte em português
            </p>
          </form>
        )}
      </div>
    </section>
  )
}

// ─── FAQ ───────────────────────────────────────────────────────────────────────
function FAQ() {
  const [open, setOpen] = useState<number | null>(null)

  const items = [
    {
      q: 'Preciso ter conhecimento técnico para usar?',
      a: 'Não. A interface foi desenvolvida para gestores e secretarias. O onboarding com IA leva menos de 30 minutos.'
    },
    {
      q: 'Como a IA gera o plano de campanha?',
      a: 'Você importa o histórico do seu ERP, informa a meta de novatos e a IA analisa os padrões históricos da sua escola, os dados de mercado do INEP e gera metas mensais, CPA sugerido e calendário de captação.'
    },
    {
      q: 'Quais ERPs são compatíveis para importação?',
      a: 'SIGA, Totvs, Escola Web e qualquer sistema que exporte em Excel/CSV. Nossa IA lê o arquivo e identifica automaticamente as colunas.'
    },
    {
      q: 'Como funciona a integração com WhatsApp?',
      a: 'Conectamos ao WhatsApp Business via Evolution API. Você centraliza as conversas no painel e configura automações de follow-up e campanhas.'
    },
    {
      q: 'Os dados do INEP são atualizados com que frequência?',
      a: 'Usamos os microdados mais recentes do Censo Escolar (INEP), atualizados anualmente. Para dados de mercado local, nossa IA usa as últimas edições disponíveis.'
    },
    {
      q: 'E se eu quiser cancelar?',
      a: 'Sem burocracia. Você cancela quando quiser pelo painel, sem multa e sem necessidade de ligar para ninguém.'
    },
  ]

  return (
    <section className="py-24 bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="text-sm font-semibold uppercase tracking-widest" style={{ color: '#00A896' }}>Dúvidas</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900">Perguntas frequentes</h2>
        </div>

        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-5 text-left"
              >
                <span className="font-semibold text-gray-900 pr-4">{item.q}</span>
                <ChevronDown className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`} />
              </button>
              {open === i && (
                <div className="px-6 pb-5 text-gray-600 leading-relaxed border-t border-gray-50 pt-4">{item.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  const cols = [
    {
      title: 'Produto',
      links: [
        { label: 'Funcionalidades', href: '#funcionalidades' },
        { label: 'Como funciona',   href: '#como-funciona'   },
        { label: 'Preços',          href: '#precos'           },
        { label: 'Blog',            href: '#'                 },
      ]
    },
    {
      title: 'Empresa',
      links: [
        { label: 'Sobre nós',  href: '#' },
        { label: 'Parceiros',  href: '#' },
        { label: 'Contato',    href: 'mailto:contato@aionedu.com.br' },
      ]
    },
    {
      title: 'Legal',
      links: [
        { label: 'Política de Privacidade', href: '#' },
        { label: 'Termos de Uso',           href: '#' },
        { label: 'LGPD',                    href: '#' },
      ]
    },
  ]

  return (
    <footer className="pt-16 pb-8" style={{ background: '#0A1A14' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <LogoMark />
            <p className="text-gray-400 text-sm leading-relaxed mt-4 mb-4">
              Inteligência que transforma histórico escolar em crescimento de matrículas.
            </p>
            <div className="space-y-1">
              <a href="mailto:contato@aionedu.com.br" className="block text-sm text-gray-400 hover:text-white transition-colors">
                contato@aionedu.com.br
              </a>
              <a href="https://www.aionedu.com.br" className="block text-sm text-gray-400 hover:text-white transition-colors">
                www.aionedu.com.br
              </a>
            </div>
          </div>

          {cols.map(col => (
            <div key={col.title}>
              <h4 className="font-semibold text-xs uppercase tracking-widest text-gray-500 mb-4">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map(l => (
                  <li key={l.label}>
                    <a href={l.href} className="text-sm text-gray-400 hover:text-white transition-colors">{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t pt-8 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderColor: '#1a2e25' }}>
          <p className="text-gray-500 text-sm">© 2026 Áion Edu. Todos os direitos reservados.</p>
          <p className="text-gray-600 text-xs">Feito com ♥ para gestores educacionais brasileiros</p>
        </div>
      </div>
    </footer>
  )
}

// ─── Export ────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="font-sans">
      <Navbar />
      <Hero />
      <Impacto />
      <ComoFunciona />
      <Funcionalidades />
      <Diferenciais />
      <Depoimentos />
      <CTADemo />
      <FAQ />
      <Footer />
    </div>
  )
}
