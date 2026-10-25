// Academia Áion Edu: tipos, módulos, trilhas, primeiros passos por papel e regras de visibilidade.
// O conteúdo das aulas fica em academyContent.ts (um arquivo só, versionado no código).
// Regra de ouro: cada pessoa só vê as aulas dos módulos que a escola liberou e que o papel dela permite.

export type TourTarget = {
  /** [data-tour="nome"]: o jeito mais estável de apontar um elemento */
  tour?: string
  /** texto exato do botão (ou, se não houver, um botão que contenha o texto) */
  button?: string
  /** rótulo do campo: leva ao campo dentro do rótulo, ao lado dele ou ligado por for= */
  label?: string
  /** qualquer elemento que mostre este texto */
  text?: string
  /** último recurso */
  css?: string
  /** procura só na janela aberta por cima */
  in?: 'modal'
  /** quando há dois botões com o mesmo nome */
  pick?: 'first' | 'last'
}

export interface TourStep {
  /** o que a voz fala e o balão mostra (curto) */
  say: string
  target?: TourTarget
  /** click: a pessoa toca na opção; fill: preenche o campo; info: só mostra */
  action?: 'click' | 'fill' | 'info'
  /** abre esta tela antes do passo (nunca ensinamos a clicar no menu lateral) */
  route?: string
  /** texto mostrado se a opção não existir nesta escola ou neste momento */
  ifMissing?: string
  /** sem a opção, a aula termina aqui */
  endIfMissing?: boolean
}

export interface Lesson {
  key: string
  module: string
  title: string
  minutes: number
  summary: string
  steps: string[]
  tip?: string
  /** tela que o botão "Abrir esta tela" abre */
  to: string
  /** telas onde a aula aparece no botão "?" */
  routes: string[]
  managerOnly?: boolean
  /** só administrador (o gestor não vê) */
  adminOnly?: boolean
  /** aula só para atendente (quem não é admin nem gestor) */
  attendantOnly?: boolean
  tour?: TourStep[]
}

export interface AcademyModule {
  id: string
  label: string
  desc: string
  /** nome do ícone lucide (ver AcademyIcon) */
  icon: string
}

/** Os módulos são os itens do menu da Áion Edu (mais "Use no celular"). */
export const MODULES: AcademyModule[] = [
  { id: 'inicio', label: 'Início', desc: 'O painel do dia: o que pede ação e como a escola está indo.', icon: 'House' },
  { id: 'leads', label: 'Leads', desc: 'O funil das famílias interessadas, do primeiro contato à matrícula.', icon: 'Funnel' },
  { id: 'visitas', label: 'Visitas', desc: 'Agendar, confirmar e dar baixa nas visitas à escola.', icon: 'CalendarCheck' },
  { id: 'contatos', label: 'Contatos', desc: 'A agenda de todas as famílias e pessoas que falam com a escola.', icon: 'AddressBook' },
  { id: 'whatsapp', label: 'WhatsApp', desc: 'Atender as conversas das famílias, em equipe.', icon: 'WhatsappLogo' },
  { id: 'captacao', label: 'Captação', desc: 'Descobrir de qual anúncio veio cada conversa.', icon: 'Megaphone' },
  { id: 'vitrine', label: 'Vitrine', desc: 'A página da escola com um link só, para divulgar.', icon: 'Storefront' },
  { id: 'transmissoes', label: 'Transmissões', desc: 'Campanhas em massa pelo WhatsApp oficial da escola.', icon: 'PaperPlaneTilt' },
  { id: 'campanha', label: 'Campanha de Matrículas', desc: 'Metas, funil, investimento e andamento das matrículas do ano.', icon: 'Flag' },
  { id: 'base_alunos', label: 'Base de alunos', desc: 'Quem já rematriculou, quem falta e quem saiu.', icon: 'GraduationCap' },
  { id: 'transferencias', label: 'Transferências', desc: 'Registrar saídas e entender o motivo real.', icon: 'ArrowsLeftRight' },
  { id: 'relatorios', label: 'Relatórios', desc: 'Números por período, com exportação e análise da IA.', icon: 'ChartLineUp' },
  { id: 'pesquisas', label: 'Pesquisas', desc: 'Pesquisas de satisfação das famílias e dos colaboradores.', icon: 'ClipboardText' },
  { id: 'usuarios', label: 'Usuários', desc: 'Quem usa o sistema e o que cada pessoa pode acessar.', icon: 'UsersThree' },
  { id: 'configuracoes', label: 'Configurações', desc: 'Funil, WhatsApp, séries, plano e integrações.', icon: 'GearSix' },
  { id: 'celular', label: 'Use no celular', desc: 'Instalar o app, ligar os avisos e usar o "?" no dia a dia.', icon: 'DeviceMobile' },
]

export const MODULE_BY_ID: Record<string, AcademyModule> = Object.fromEntries(MODULES.map(m => [m.id, m]))

export interface Trail {
  module: string
  title: string
  desc: string
  /** chaves das aulas, na ordem em que fazem sentido */
  lessons: string[]
}

export type RoleKey = 'gestor' | 'secretaria' | 'atendimento'

export interface FirstSteps {
  role: RoleKey
  title: string
  subtitle: string
  lessons: string[]
}

/** Primeiros passos por papel. Aulas que a pessoa não pode ver somem da faixa sozinhas. */
export const FIRST_STEPS: Record<RoleKey, FirstSteps> = {
  gestor: {
    role: 'gestor', title: 'Primeiros passos do gestor', subtitle: 'Do painel à equipe: o que fazer na primeira semana.',
    lessons: ['ini_gestor', 'cf_funil', 'us_novo', 'wa_atender', 'ld_novo', 'vi_agendar', 'cm_visao', 'cel_instalar'],
  },
  secretaria: {
    role: 'secretaria', title: 'Primeiros passos da secretaria', subtitle: 'Matrículas, alunos e saídas, passo a passo.',
    lessons: ['ba_visao', 'ba_alunos', 'ct_novo', 'tf_registrar', 'vi_baixa', 'cel_instalar'],
  },
  atendimento: {
    role: 'atendimento', title: 'Primeiros passos do atendimento', subtitle: 'Atender, cadastrar e agendar sem se perder.',
    lessons: ['ini_atendente', 'wa_atender', 'wa_respostas', 'ld_novo', 'vi_agendar', 'ld_lembrete', 'cel_instalar'],
  },
}

export const ROLE_LABEL: Record<RoleKey, string> = { gestor: 'Gestor', secretaria: 'Secretaria', atendimento: 'Atendimento' }

/** Papel sugerido para a pessoa: admin/gestor veem o roteiro do gestor; atendente, o do atendimento. */
export function defaultRole(isManager: boolean, has: (m: string) => boolean): RoleKey {
  if (isManager) return 'gestor'
  if (has('base_alunos') && !has('whatsapp')) return 'secretaria'
  return 'atendimento'
}

export type Has = (module: string) => boolean

/** O que esta pessoa pode ver: módulos liberados (has), se é admin/gestor e se é administrador. */
export interface Access { has: Has; manager: boolean; admin: boolean }

export function canSee(l: Lesson, a: Access): boolean {
  if (!a.has(l.module)) return false
  if (l.managerOnly && !a.manager) return false
  if (l.adminOnly && !a.admin) return false
  if (l.attendantOnly && a.manager) return false
  return true
}

/** Só as aulas que esta pessoa pode ver (módulo liberado + papel). O progresso conta só estas. */
export function visibleLessons(all: Lesson[], a: Access): Lesson[] {
  return all.filter(l => canSee(l, a))
}

/** Aulas de uma tela, casadas pelo endereço (/leads também casa /leads/qualquer-coisa). */
export function lessonsForPath(visible: Lesson[], pathname: string): Lesson[] {
  const p = pathname.replace(/\/+$/, '') || '/'
  return visible.filter(l => l.routes.some(r => p === r || p.startsWith(r + '/')))
}

export function trailLessons(trail: Trail, visible: Lesson[]): Lesson[] {
  const by = new Map(visible.map(l => [l.key, l]))
  return trail.lessons.map(k => by.get(k)).filter((l): l is Lesson => !!l)
}

export function trailsFor(all: Trail[], visible: Lesson[]): { trail: Trail; lessons: Lesson[] }[] {
  return all.map(t => ({ trail: t, lessons: trailLessons(t, visible) })).filter(x => x.lessons.length > 0)
}

export function countDone(lessons: Lesson[], done: Set<string>): number {
  return lessons.reduce((n, l) => n + (done.has(l.key) ? 1 : 0), 0)
}

/** Primeira aula da lista que ainda não foi feita. */
export function nextLesson(lessons: Lesson[], done: Set<string>): Lesson | undefined {
  return lessons.find(l => !done.has(l.key))
}

export const TOUR_START_EVENT = 'aion:tour-start'
export const TOUR_END_EVENT = 'aion:tour-end'
export const HELP_OPEN_EVENT = 'aion:help-open'
export const LESSON_OPEN_EVENT = 'aion:lesson-open'
export const PROGRESS_EVENT = 'aion:academy-progress'
