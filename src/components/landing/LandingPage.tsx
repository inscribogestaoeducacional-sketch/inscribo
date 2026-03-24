import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Calendar,
  BarChart3,
  RefreshCw,
  MessageCircle,
  Zap,
  TrendingUp,
  CheckCircle,
  ChevronDown,
  ArrowRight,
  Star,
  Menu,
  X,
  GraduationCap,
  Target
} from 'lucide-react'

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
    { label: 'Preços', href: '#precos' },
    { label: 'Depoimentos', href: '#depoimentos' },
  ]

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white shadow-md' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <img src="/Inscribologo.png" alt="Áion Edu" className="h-10 w-auto" />

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            {links.map(l => (
              <a key={l.href} href={l.href} className={`text-sm font-medium transition-colors ${scrolled ? 'text-gray-700 hover:text-[#14b8a6]' : 'text-white/90 hover:text-white'}`}>
                {l.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/login" className={`px-4 py-2 text-sm font-semibold rounded-lg border transition-colors ${scrolled ? 'border-[#1e2d6b] text-[#1e2d6b] hover:bg-[#1e2d6b] hover:text-white' : 'border-white text-white hover:bg-white/10'}`}>
              Entrar
            </Link>
            <Link to="/login" className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#14b8a6] text-white hover:bg-[#0d9488] transition-colors shadow-sm">
              Começar grátis
            </Link>
          </div>

          {/* Mobile toggle */}
          <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className={scrolled ? 'text-gray-700' : 'text-white'} /> : <Menu className={scrolled ? 'text-gray-700' : 'text-white'} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-3 shadow-lg">
          {links.map(l => (
            <a key={l.href} href={l.href} onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-gray-700 hover:text-[#14b8a6]">
              {l.label}
            </a>
          ))}
          <div className="flex gap-3 pt-2">
            <Link to="/login" className="flex-1 text-center px-4 py-2 text-sm font-semibold rounded-lg border border-[#1e2d6b] text-[#1e2d6b]">
              Entrar
            </Link>
            <Link to="/login" className="flex-1 text-center px-4 py-2 text-sm font-semibold rounded-lg bg-[#14b8a6] text-white">
              Começar grátis
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}

// ─── Hero ──────────────────────────────────────────────────────────────────────
function Hero() {
  const [count1, setCount1] = useState(0)
  const [count2, setCount2] = useState(0)
  const [count3, setCount3] = useState(0)

  useEffect(() => {
    const animate = (setter: (v: number) => void, target: number, duration: number) => {
      const steps = 40
      const increment = target / steps
      let current = 0
      const interval = setInterval(() => {
        current = Math.min(current + increment, target)
        setter(Math.floor(current))
        if (current >= target) clearInterval(interval)
      }, duration / steps)
    }
    const timer = setTimeout(() => {
      animate(setCount1, 247, 1200)
      animate(setCount2, 38, 1000)
      animate(setCount3, 92, 1100)
    }, 400)
    return () => clearTimeout(timer)
  }, [])

  return (
    <section className="relative min-h-screen flex items-center bg-gradient-to-br from-[#1e2d6b] via-[#1a3a5c] to-[#0d9488] overflow-hidden pt-16">
      {/* Background blobs */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#14b8a6]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-white/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 grid lg:grid-cols-2 gap-16 items-center">
        {/* Left */}
        <div className="text-white space-y-8">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium text-white/90">
            <span className="w-2 h-2 bg-[#14b8a6] rounded-full animate-pulse" />
            Mais de 200 escolas já usam o Áion Edu
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
            Preencha sua escola.{' '}
            <span className="text-[#14b8a6]">Sem perder</span>{' '}
            nenhum lead.
          </h1>

          <p className="text-lg text-white/80 max-w-lg">
            CRM educacional completo para gestão de matrículas. Kanban de leads, automações de WhatsApp e relatórios em tempo real — tudo em um só lugar.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link to="/login" className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#14b8a6] text-white font-semibold rounded-xl hover:bg-[#0d9488] transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
              Começar grátis — 14 dias
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a href="#como-funciona" className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-white/30 text-white font-semibold rounded-xl hover:bg-white/10 transition-all">
              Ver como funciona
            </a>
          </div>

          <p className="text-sm text-white/60">Sem cartão de crédito. Cancele quando quiser.</p>
        </div>

        {/* Right — mock dashboard */}
        <div className="relative hidden lg:block">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-6 shadow-2xl">
            {/* Mock topbar */}
            <div className="flex items-center justify-between mb-6">
              <span className="text-white font-semibold">Dashboard</span>
              <span className="text-white/60 text-sm">Hoje, março 2025</span>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: 'Leads ativos', value: count1, suffix: '', color: 'bg-[#14b8a6]/20 text-[#14b8a6]' },
                { label: 'CPA médio', value: count2, prefix: 'R$', color: 'bg-yellow-400/20 text-yellow-300' },
                { label: 'Rematrícula', value: count3, suffix: '%', color: 'bg-green-400/20 text-green-300' },
              ].map(card => (
                <div key={card.label} className="bg-white/10 rounded-xl p-3 text-center">
                  <div className={`inline-block px-2 py-1 rounded-lg text-xs font-medium mb-2 ${card.color}`}>
                    {card.prefix}{card.value}{card.suffix}
                  </div>
                  <p className="text-white/70 text-xs">{card.label}</p>
                </div>
              ))}
            </div>

            {/* Mock kanban columns */}
            <div className="grid grid-cols-4 gap-2">
              {['Novo', 'Contato', 'Visita', 'Matrícula'].map((col, i) => (
                <div key={col} className="bg-white/10 rounded-lg p-2">
                  <p className="text-white/60 text-xs font-medium mb-2">{col}</p>
                  {Array.from({ length: i === 0 ? 3 : i === 1 ? 2 : i === 2 ? 2 : 1 }).map((_, j) => (
                    <div key={j} className="bg-white/20 rounded p-1.5 mb-1.5">
                      <div className="h-1.5 bg-white/40 rounded w-3/4 mb-1" />
                      <div className="h-1.5 bg-white/20 rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Badge flutuante */}
          <div className="absolute -bottom-4 -left-6 bg-white rounded-xl px-4 py-3 shadow-xl flex items-center gap-2">
            <span className="text-green-500 text-lg">✓</span>
            <div>
              <p className="text-xs font-semibold text-gray-800">WhatsApp conectado</p>
              <p className="text-xs text-gray-500">3 mensagens automáticas ativas</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Problema ─────────────────────────────────────────────────────────────────
function Problema() {
  const pains = [
    { emoji: '📊', title: 'Planilha Excel', desc: 'Dados espalhados em planilhas, sem visão do funil e sem histórico confiável.' },
    { emoji: '💬', title: 'Leads perdidos no WhatsApp', desc: 'Conversas misturadas com pessoais. Nenhum lead fica sem resposta? Você tem certeza?' },
    { emoji: '👁️', title: 'Sem funil visual', desc: 'Não sabe quantos leads estão em cada etapa nem quais são os gargalos da captação.' },
    { emoji: '🔁', title: 'Rematrícula manual', desc: 'Contato um por um com famílias. Sem automação, sem controle, sem previsibilidade.' },
  ]

  return (
    <section className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-sm font-semibold text-[#14b8a6] uppercase tracking-widest">A dura realidade</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900">Você ainda faz assim?</h2>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">Escolas que ainda usam processos manuais perdem em média 35% dos leads antes mesmo do primeiro contato.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {pains.map(p => (
            <div key={p.title} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="text-4xl mb-4">{p.emoji}</div>
              <h3 className="font-bold text-gray-900 mb-2">{p.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{p.desc}</p>
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
      icon: <LayoutDashboard className="w-6 h-6" />,
      color: 'bg-[#14b8a6]/10 text-[#14b8a6]',
      title: 'Kanban de Leads',
      desc: 'Visualize e gerencie todo o funil de captação em colunas drag-and-drop. Nenhum lead esquecido.'
    },
    {
      icon: <MessageCircle className="w-6 h-6" />,
      color: 'bg-green-100 text-green-600',
      title: 'WhatsApp Hub',
      desc: 'Central de mensagens integrada ao WhatsApp Business. Responda e classifique leads em um só lugar.'
    },
    {
      icon: <Zap className="w-6 h-6" />,
      color: 'bg-yellow-100 text-yellow-600',
      title: 'Fluxos Automáticos',
      desc: 'Automações de follow-up, lembretes de visita e sequências de nutrição configuráveis sem código.'
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      color: 'bg-purple-100 text-purple-600',
      title: 'Relatórios CPA',
      desc: 'Calcule o custo por aluno captado por canal. Invista melhor o seu orçamento de marketing.'
    },
    {
      icon: <RefreshCw className="w-6 h-6" />,
      color: 'bg-blue-100 text-blue-600',
      title: 'Rematrícula',
      desc: 'Gestão completa do período de rematrícula: base, inadimplentes, transferidos e meta por turma.'
    },
    {
      icon: <Calendar className="w-6 h-6" />,
      color: 'bg-rose-100 text-rose-600',
      title: 'Calendário de Visitas',
      desc: 'Agende e acompanhe as visitas das famílias. Notificações automáticas e confirmações por WhatsApp.'
    },
  ]

  return (
    <section id="funcionalidades" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-sm font-semibold text-[#14b8a6] uppercase tracking-widest">Tudo que sua escola precisa</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900">Funcionalidades completas</h2>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">Do primeiro contato até a matrícula assinada, o Áion Edu acompanha cada etapa da jornada do aluno.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map(f => (
            <div key={f.title} className="group p-6 rounded-2xl border border-gray-100 hover:border-[#14b8a6]/30 hover:shadow-lg transition-all">
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 ${f.color}`}>
                {f.icon}
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

// ─── Como funciona ────────────────────────────────────────────────────────────
function ComoFunciona() {
  const steps = [
    {
      n: '01',
      icon: <Users className="w-8 h-8 text-[#14b8a6]" />,
      title: 'Cadastre seus leads',
      desc: 'Importe da planilha ou capture diretamente pelo formulário no site. Todos os leads num só lugar, organizados automaticamente.'
    },
    {
      n: '02',
      icon: <LayoutDashboard className="w-8 h-8 text-[#14b8a6]" />,
      title: 'Gerencie no Kanban',
      desc: 'Mova os cards pelo funil de captação, registre interações, agende visitas e dispare mensagens — tudo sem sair da tela.'
    },
    {
      n: '03',
      icon: <BarChart3 className="w-8 h-8 text-[#14b8a6]" />,
      title: 'Acompanhe os resultados',
      desc: 'Dashboards em tempo real com CPA por canal, taxa de conversão por etapa e projeções de matrícula para o período.'
    },
  ]

  return (
    <section id="como-funciona" className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-sm font-semibold text-[#14b8a6] uppercase tracking-widest">Simples de usar</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900">Como funciona</h2>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 relative">
          {/* Connector line */}
          <div className="hidden lg:block absolute top-16 left-1/3 right-1/3 h-0.5 bg-gradient-to-r from-[#14b8a6]/30 via-[#14b8a6] to-[#14b8a6]/30" />

          {steps.map((s, i) => (
            <div key={s.n} className="relative text-center">
              <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white border-2 border-[#14b8a6]/30 shadow-sm mb-6">
                {s.icon}
                <span className="absolute -top-3 -right-3 w-7 h-7 bg-[#1e2d6b] text-white text-xs font-bold rounded-full flex items-center justify-center">{i + 1}</span>
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

// ─── Resultados / Depoimentos ─────────────────────────────────────────────────
function Resultados() {
  const stats = [
    { value: '+40%', label: 'aumento médio em matrículas' },
    { value: '92%', label: 'taxa de rematrícula' },
    { value: 'R$38', label: 'CPA médio por aluno' },
  ]

  const testimonials = [
    {
      name: 'Ana Paula Rocha',
      role: 'Diretora — Colégio Futuro Brilhante, SP',
      avatar: 'AP',
      text: 'Antes eu usava 3 planilhas diferentes. Com o Áion Edu, em uma semana já vi onde estavam os gargalos e aumentei em 30% as visitas agendadas.'
    },
    {
      name: 'Marcos Vinicius',
      role: 'Gerente Comercial — Escola Novo Horizonte, MG',
      avatar: 'MV',
      text: 'O Kanban mudou tudo. Nossa equipe passou a trabalhar de forma alinhada e o período de matrículas foi o melhor dos últimos 5 anos.'
    },
  ]

  return (
    <section id="depoimentos" className="py-24 bg-[#1e2d6b]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Stats */}
        <div className="grid sm:grid-cols-3 gap-8 mb-20">
          {stats.map(s => (
            <div key={s.value} className="text-center">
              <div className="text-5xl sm:text-6xl font-bold text-[#14b8a6] mb-2">{s.value}</div>
              <p className="text-white/70 text-lg">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white">O que dizem os diretores</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {testimonials.map(t => (
            <div key={t.name} className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
              <div className="flex gap-1 mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-[#14b8a6] text-[#14b8a6]" />
                ))}
              </div>
              <p className="text-white/90 text-lg leading-relaxed mb-6">"{t.text}"</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#14b8a6] flex items-center justify-center text-white font-bold text-sm">
                  {t.avatar}
                </div>
                <div>
                  <p className="text-white font-semibold">{t.name}</p>
                  <p className="text-white/60 text-sm">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Preços ────────────────────────────────────────────────────────────────────
function Precos() {
  const [annual, setAnnual] = useState(false)

  const plans = [
    {
      name: 'Starter',
      monthlyPrice: 197,
      desc: 'Para escolas que estão começando',
      highlight: false,
      features: [
        'Até 200 leads/mês',
        '2 atendentes',
        'Kanban de Leads',
        'Calendário de Visitas',
        'Relatórios básicos',
        'Suporte por email',
      ]
    },
    {
      name: 'Pro',
      monthlyPrice: 397,
      desc: 'Para escolas em crescimento',
      highlight: true,
      badge: 'Mais popular',
      features: [
        'Até 1.000 leads/mês',
        '10 atendentes',
        'Tudo do Starter',
        'WhatsApp Hub',
        'Fluxos automáticos',
        'Relatórios CPA',
        'Gestão de rematrícula',
        'Suporte prioritário',
      ]
    },
    {
      name: 'Enterprise',
      monthlyPrice: 797,
      desc: 'Para redes e escolas grandes',
      highlight: false,
      features: [
        'Leads ilimitados',
        'Atendentes ilimitados',
        'Tudo do Pro',
        'Multi-unidades',
        'API + integrações',
        'Gerente de sucesso',
        'SLA garantido',
      ]
    },
  ]

  return (
    <section id="precos" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="text-sm font-semibold text-[#14b8a6] uppercase tracking-widest">Planos</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900">Preço simples e transparente</h2>
          <p className="mt-4 text-lg text-gray-600">Sem taxas ocultas. Sem surpresas na fatura.</p>

          {/* Toggle */}
          <div className="inline-flex items-center gap-3 mt-8 bg-gray-100 rounded-full p-1">
            <button
              onClick={() => setAnnual(false)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${!annual ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              Mensal
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${annual ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              Anual <span className="ml-1 text-xs text-[#14b8a6] font-bold">-20%</span>
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 items-start">
          {plans.map(p => {
            const price = annual ? Math.round(p.monthlyPrice * 0.8) : p.monthlyPrice
            return (
              <div
                key={p.name}
                className={`rounded-2xl p-8 border-2 relative transition-all ${
                  p.highlight
                    ? 'border-[#14b8a6] shadow-xl shadow-[#14b8a6]/10 scale-105'
                    : 'border-gray-100 shadow-sm hover:shadow-md'
                }`}
              >
                {p.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#14b8a6] text-white text-xs font-bold px-4 py-1 rounded-full">
                    {p.badge}
                  </span>
                )}
                <h3 className="text-xl font-bold text-gray-900">{p.name}</h3>
                <p className="text-gray-500 text-sm mt-1 mb-6">{p.desc}</p>

                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-2xl font-semibold text-gray-500">R$</span>
                  <span className="text-5xl font-bold text-gray-900">{price}</span>
                  <span className="text-gray-500">/mês</span>
                </div>

                <Link
                  to="/login"
                  className={`w-full block text-center py-3 rounded-xl font-semibold transition-all mb-8 ${
                    p.highlight
                      ? 'bg-[#14b8a6] text-white hover:bg-[#0d9488] shadow-md hover:shadow-lg'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  Começar agora
                </Link>

                <ul className="space-y-3">
                  {p.features.map(f => (
                    <li key={f} className="flex items-center gap-3 text-sm text-gray-700">
                      <CheckCircle className="w-4 h-4 text-[#14b8a6] flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
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
      a: 'Não. O Áion Edu foi desenvolvido para equipes de secretaria e comercial. A interface é intuitiva e o onboarding leva menos de 30 minutos.'
    },
    {
      q: 'Posso importar meus leads de uma planilha?',
      a: 'Sim. Basta enviar seu arquivo Excel ou CSV e o sistema importa automaticamente, mapeando os campos principais.'
    },
    {
      q: 'Como funciona a integração com WhatsApp?',
      a: 'Conectamos ao WhatsApp Business API. Você centraliza as conversas no painel do Áion Edu e configura as automações de follow-up.'
    },
    {
      q: 'Quantos usuários posso adicionar?',
      a: 'Depende do plano. Starter: 2 atendentes, Pro: 10 atendentes, Enterprise: ilimitado. Adicionar extras é possível mediante consulta.'
    },
    {
      q: 'Meus dados ficam seguros?',
      a: 'Sim. Utilizamos criptografia em trânsito e em repouso, backups diários e infraestrutura em nuvem com SLA de 99,9% de uptime.'
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
          <span className="text-sm font-semibold text-[#14b8a6] uppercase tracking-widest">Dúvidas</span>
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
                <div className="px-6 pb-5 text-gray-600 leading-relaxed border-t border-gray-50 pt-4">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── CTA Final ────────────────────────────────────────────────────────────────
function CTAFinal() {
  return (
    <section className="py-24 bg-[#1e2d6b] relative overflow-hidden">
      {/* Glow teal */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[300px] bg-[#14b8a6]/20 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <GraduationCap className="w-14 h-14 text-[#14b8a6] mx-auto mb-6" />
        <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6 leading-tight">
          Pronto para lotar sua escola<br />neste período de matrículas?
        </h2>
        <p className="text-xl text-white/70 mb-10 max-w-2xl mx-auto">
          Junte-se a mais de 200 escolas que já usam o Áion Edu para captar mais alunos e reter mais famílias.
        </p>
        <Link
          to="/login"
          className="inline-flex items-center gap-3 px-10 py-5 bg-white text-[#1e2d6b] font-bold text-lg rounded-2xl hover:bg-gray-100 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1"
        >
          Começar grátis — 14 dias
          <ArrowRight className="w-6 h-6" />
        </Link>
        <p className="mt-5 text-white/50 text-sm">Sem cartão de crédito. Setup em menos de 30 minutos.</p>
      </div>
    </section>
  )
}

// ─── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  const cols = [
    {
      title: 'Produto',
      links: ['Funcionalidades', 'Preços', 'Changelog', 'Roadmap']
    },
    {
      title: 'Recursos',
      links: ['Blog', 'Central de Ajuda', 'Documentação', 'Status']
    },
    {
      title: 'Empresa',
      links: ['Sobre nós', 'Carreiras', 'Parceiros', 'Contato']
    },
    {
      title: 'Legal',
      links: ['Privacidade', 'Termos de Uso', 'Cookies', 'LGPD']
    },
  ]

  return (
    <footer className="bg-gray-900 text-white pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
          <div className="lg:col-span-1">
            <img src="/Inscribologo.png" alt="Áion Edu" className="h-10 w-auto mb-4 brightness-0 invert" />
            <p className="text-gray-400 text-sm leading-relaxed">CRM educacional para gestão inteligente de matrículas escolares.</p>
          </div>
          {cols.map(col => (
            <div key={col.title}>
              <h4 className="font-semibold text-sm uppercase tracking-widest text-gray-400 mb-4">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map(l => (
                  <li key={l}>
                    <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">{l}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 text-sm">© 2025 Áion Edu. Todos os direitos reservados.</p>
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
      <Problema />
      <Funcionalidades />
      <ComoFunciona />
      <Resultados />
      <Precos />
      <FAQ />
      <CTAFinal />
      <Footer />
    </div>
  )
}
