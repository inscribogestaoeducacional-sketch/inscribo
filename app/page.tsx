import Link from 'next/link'
import { 
  GraduationCap, 
  Users, 
  Calendar, 
  TrendingUp, 
  BarChart3, 
  Shield, 
  Zap, 
  Target,
  CheckCircle,
  Star,
  ArrowRight,
  Play,
  Menu,
  X
} from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/95 backdrop-blur-sm border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <GraduationCap className="h-8 w-8 text-blue-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">Inscribo</span>
              </div>
            </div>
            
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-8">
                <a href="#funcionalidades" className="text-gray-600 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors">
                  Funcionalidades
                </a>
                <a href="#precos" className="text-gray-600 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors">
                  Preços
                </a>
                <a href="#depoimentos" className="text-gray-600 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors">
                  Depoimentos
                </a>
                <a href="#contato" className="text-gray-600 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors">
                  Contato
                </a>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Link 
                href="/login" 
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-all font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                Fazer Login
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-20 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Gestão de matrículas 
                <span className="gradient-text block">mais simples e inteligente</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Centralize leads, visitas, matrículas e rematrículas em um só lugar. 
                Aumente suas conversões com análises automáticas e insights inteligentes.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link 
                  href="/signup" 
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all font-semibold text-lg shadow-xl hover:shadow-2xl transform hover:-translate-y-1 flex items-center justify-center"
                >
                  Comece Grátis
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
                <button className="border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-xl hover:border-blue-600 hover:text-blue-600 transition-all font-semibold text-lg flex items-center justify-center">
                  <Play className="mr-2 h-5 w-5" />
                  Ver Demonstração
                </button>
              </div>
            </div>
            
            <div className="relative">
              <div className="bg-white rounded-2xl shadow-2xl p-8 animate-float">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-gray-900">Dashboard Inscribo</h3>
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-xl">
                    <div className="text-2xl font-bold text-blue-600">247</div>
                    <div className="text-sm text-gray-600">Leads Ativos</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-xl">
                    <div className="text-2xl font-bold text-green-600">92.5%</div>
                    <div className="text-sm text-gray-600">Taxa Rematrícula</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Meta de Conversão</span>
                    <span className="font-semibold">85%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full" style={{width: '85%'}}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Por que escolher o Inscribo?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Transforme sua gestão educacional com tecnologia de ponta e insights automáticos
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: <Zap className="h-8 w-8 text-yellow-500" />,
                title: "Automação Inteligente",
                description: "Automatize tarefas repetitivas e foque no que realmente importa: seus alunos."
              },
              {
                icon: <BarChart3 className="h-8 w-8 text-blue-500" />,
                title: "Análises Avançadas",
                description: "Relatórios automáticos de CPA, funil de vendas e performance em tempo real."
              },
              {
                icon: <Shield className="h-8 w-8 text-green-500" />,
                title: "Segurança Total",
                description: "Seus dados protegidos com criptografia de ponta e backup automático."
              }
            ].map((benefit, index) => (
              <div key={index} className="text-center p-8 rounded-2xl hover:shadow-lg transition-all duration-300 border border-gray-100">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-50 rounded-2xl mb-6">
                  {benefit.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">{benefit.title}</h3>
                <p className="text-gray-600 leading-relaxed">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="funcionalidades" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Funcionalidades Completas
            </h2>
            <p className="text-xl text-gray-600">
              Tudo que você precisa para gerenciar sua instituição
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: <Users className="h-6 w-6" />,
                title: "Gestão de Leads",
                description: "Kanban visual para acompanhar cada lead do primeiro contato até a matrícula"
              },
              {
                icon: <Calendar className="h-6 w-6" />,
                title: "Calendário de Visitas",
                description: "Agende e gerencie visitas com lembretes automáticos e follow-up"
              },
              {
                icon: <GraduationCap className="h-6 w-6" />,
                title: "Controle de Matrículas",
                description: "Registre matrículas, valores e acompanhe a evolução mensal"
              },
              {
                icon: <TrendingUp className="h-6 w-6" />,
                title: "Análise de CPA",
                description: "Monitore investimento em marketing e custo por aquisição automaticamente"
              },
              {
                icon: <Target className="h-6 w-6" />,
                title: "Funil de Vendas",
                description: "Visualize e otimize cada etapa do seu processo comercial"
              },
              {
                icon: <BarChart3 className="h-6 w-6" />,
                title: "Relatórios Automáticos",
                description: "Relatórios detalhados exportáveis em PDF e Excel"
              }
            ].map((feature, index) => (
              <div key={index} className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-xl mb-4 text-blue-600">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="precos" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Planos que Crescem com Você
            </h2>
            <p className="text-xl text-gray-600">
              Escolha o plano ideal para sua instituição
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: "Starter",
                price: "Grátis",
                period: "para sempre",
                description: "Perfeito para começar",
                features: [
                  "Até 100 leads/mês",
                  "Gestão básica de visitas",
                  "Relatórios simples",
                  "Suporte por email"
                ],
                cta: "Começar Grátis",
                popular: false
              },
              {
                name: "Professional",
                price: "R$ 97",
                period: "/mês",
                description: "Para instituições em crescimento",
                features: [
                  "Leads ilimitados",
                  "Análise completa de CPA",
                  "Funil de vendas avançado",
                  "Relatórios exportáveis",
                  "Integrações com Meta/Google",
                  "Suporte prioritário"
                ],
                cta: "Teste 14 dias grátis",
                popular: true
              },
              {
                name: "Enterprise",
                price: "R$ 297",
                period: "/mês",
                description: "Para grandes instituições",
                features: [
                  "Tudo do Professional",
                  "Multi-unidades",
                  "API personalizada",
                  "Treinamento dedicado",
                  "Suporte 24/7",
                  "Gerente de sucesso"
                ],
                cta: "Falar com Vendas",
                popular: false
              }
            ].map((plan, index) => (
              <div key={index} className={`relative rounded-2xl p-8 ${
                plan.popular 
                  ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-500 shadow-xl' 
                  : 'bg-white border border-gray-200 shadow-sm hover:shadow-lg'
              } transition-all duration-300`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-full text-sm font-semibold">
                      Mais Popular
                    </span>
                  </div>
                )}
                
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <p className="text-gray-600 mb-4">{plan.description}</p>
                  <div className="flex items-baseline justify-center">
                    <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-gray-600 ml-1">{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button className={`w-full py-3 px-6 rounded-xl font-semibold transition-all ${
                  plan.popular
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transform hover:-translate-y-1'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}>
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="depoimentos" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              O que nossos clientes dizem
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: "Maria Silva",
                role: "Diretora - Colégio São José",
                content: "O Inscribo revolucionou nossa gestão. Aumentamos as matrículas em 40% no primeiro semestre!",
                rating: 5
              },
              {
                name: "João Santos",
                role: "Coordenador - Instituto Educacional",
                content: "Finalmente conseguimos ter controle total sobre nosso funil de vendas. Recomendo!",
                rating: 5
              },
              {
                name: "Ana Costa",
                role: "Gestora - Escola Criativa",
                content: "A análise de CPA nos ajudou a otimizar nosso investimento em marketing. Excelente!",
                rating: 5
              }
            ].map((testimonial, index) => (
              <div key={index} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-700 mb-6 italic">"{testimonial.content}"</p>
                <div>
                  <div className="font-semibold text-gray-900">{testimonial.name}</div>
                  <div className="text-sm text-gray-600">{testimonial.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-white mb-6">
            Pronto para transformar sua gestão?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Junte-se a centenas de instituições que já usam o Inscribo
          </p>
          <Link 
            href="/signup"
            className="bg-white text-blue-600 px-8 py-4 rounded-xl hover:bg-gray-50 transition-all font-semibold text-lg shadow-xl hover:shadow-2xl transform hover:-translate-y-1 inline-flex items-center"
          >
            Começar Agora - É Grátis
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center mb-4">
                <GraduationCap className="h-8 w-8 text-blue-400" />
                <span className="ml-2 text-xl font-bold">Inscribo</span>
              </div>
              <p className="text-gray-400 mb-6 max-w-md">
                Sistema completo de gestão educacional para aumentar suas matrículas e otimizar seus processos.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Produto</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#funcionalidades" className="hover:text-white transition-colors">Funcionalidades</a></li>
                <li><a href="#precos" className="hover:text-white transition-colors">Preços</a></li>
                <li><a href="/login" className="hover:text-white transition-colors">Login</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Empresa</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Sobre</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Termos</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacidade</a></li>
                <li><a href="#contato" className="hover:text-white transition-colors">Contato</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
            <p>&copy; 2024 Inscribo. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}