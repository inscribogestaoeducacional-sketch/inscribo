import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Nome de cada tela na aba do navegador (e no Google, nas páginas públicas)
const S = ' · Áion Edu'
const TITLES: [string, string][] = [
  ['/super-admin/consultant/schools', 'Escolas do consultor'], ['/super-admin/consultant/contracts', 'Contratos'], ['/super-admin/consultant', 'Painel do consultor'],
  ['/super-admin/crm', 'CRM da Áion'], ['/super-admin/schools', 'Escolas'], ['/super-admin/institutions', 'Escola'], ['/super-admin/school-groups', 'Redes de escolas'],
  ['/super-admin/showcase-schools', 'Vitrines'], ['/super-admin/market-intelligence', 'Inteligência de mercado'], ['/super-admin/consultants', 'Consultores'],
  ['/super-admin/financial', 'Financeiro'], ['/super-admin/transmissoes', 'Preços das transmissões'], ['/super-admin/settings', 'Configurações da plataforma'],
  ['/super-admin/updates', 'Atualizações'], ['/super-admin/whatsapp-templates', 'Modelos de WhatsApp'], ['/super-admin/whatsapp', 'WhatsApp da plataforma'],
  ['/super-admin/aion-inbox', 'Caixa de entrada Áion'], ['/super-admin/profile', 'Meu perfil'], ['/super-admin', 'Painel Super Admin'],
  ['/home', 'Início'], ['/atendente', 'Início'], ['/dashboard', 'Painel'], ['/leads', 'Leads'], ['/clients', 'Clientes'], ['/contacts', 'Contatos'], ['/visits', 'Visitas'],
  ['/whatsapp', 'WhatsApp'], ['/captacao', 'Captação inteligente'], ['/vitrine', 'Vitrine'], ['/transmissoes', 'Transmissões'], ['/campanha', 'Campanha de matrículas'],
  ['/base-alunos', 'Base de alunos'], ['/transferencias', 'Transferências'], ['/updates', 'Atualizações'], ['/pesquisas', 'Pesquisas'], ['/reports', 'Relatórios'],
  ['/users', 'Usuários'], ['/settings', 'Configurações'], ['/profile', 'Meu perfil'],
  ['/entrar', 'Bem-vindo'], ['/login', 'Entrar'], ['/reset-password', 'Redefinir senha'], ['/privacidade', 'Política de privacidade'], ['/termos', 'Termos de uso'],
  ['/sobre', 'Sobre a Áion'], ['/parceiros', 'Parceiros'], ['/parceria-meta', 'Parceria com a Meta'],
]

export default function PageTitle() {
  const { pathname } = useLocation()
  useEffect(() => {
    if (pathname === '/') { document.title = 'Áion Edu — Inteligência em matrículas para escolas'; return }
    const hit = TITLES.find(([p]) => pathname === p || pathname.startsWith(p + '/'))
    if (hit) document.title = hit[1] + S
  }, [pathname])
  return null
}
