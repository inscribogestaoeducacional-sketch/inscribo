// ETAPA 3B — mapa do novo painel de Configurações (protótipo, só navegação).
//
// Os 51 itens da auditoria (docs/auditoria-configuracoes-2026-10-22.md) em 9
// grupos. Cada item LEVA para a tela que já existe hoje (mesmos componentes,
// mesmas gravações) — nada aqui grava dado. Quem vê o quê continua vindo de
// lib/settingsAccess.ts (campo `access`) ou da mesma regra do menu (Sidebar).
//
// Links antigos (?tab=&sec=, inclusive os dos alertas da central de
// notificações, que apontam para /settings?tab=whatsapp) são resolvidos em
// resolveSettingsRoute().

import { canSeeSettingsItem, canSeeSettingsTab, visibleWhatsAppSections, SETTINGS_ITEMS, type SettingsItemId, type SettingsTabId } from './settingsAccess'

export type SettingsGroupId = 'whatsapp' | 'robo' | 'escola' | 'equipe' | 'funil' | 'bloqueios' | 'plano' | 'ia' | 'lgpd'

export interface SettingsGroup {
  id: SettingsGroupId
  title: string
  description: string
  /** nome do ícone (lucide) — o componente traduz */
  icon: 'MessageCircle' | 'Bot' | 'GraduationCap' | 'Users' | 'Filter' | 'ShieldOff' | 'CreditCard' | 'Sparkles' | 'Lock'
  /** assuntos, na ordem em que aparecem na tela do grupo */
  topics: string[]
}

export const SETTINGS_GROUPS: SettingsGroup[] = [
  { id: 'whatsapp',  icon: 'MessageCircle', title: 'WhatsApp e atendimento', description: 'Conexão, horário de atendimento, respostas rápidas, filas e etiquetas.', topics: ['Conexão', 'Atendimento', 'Organização'] },
  { id: 'robo',      icon: 'Bot',           title: 'Robô e mensagens automáticas', description: 'O robô de atendimento e o que é enviado sozinho: fora do horário, almoço, inatividade.', topics: ['Robô', 'Mensagens automáticas', 'Modelos'] },
  { id: 'escola',    icon: 'GraduationCap', title: 'Escola', description: 'Dados da escola, séries, logo e cores, e os dados da campanha.', topics: ['Dados da escola', 'Séries', 'Logo e cores', 'Campanha de matrículas'] },
  { id: 'equipe',    icon: 'Users',         title: 'Equipe e acessos', description: 'Quem usa o sistema, o que cada pessoa vê e o horário de cada atendente.', topics: ['Pessoas', 'O que cada pessoa vê', 'Horário dos atendentes'] },
  { id: 'funil',     icon: 'Filter',        title: 'Funil e leads', description: 'Etapas, unidade, lembretes, campos de contato, captação e base de alunos.', topics: ['Leads', 'Contatos', 'Captação', 'Base de alunos'] },
  { id: 'bloqueios', icon: 'ShieldOff',     title: 'Bloqueios e privacidade de contatos', description: 'Números bloqueados e contatos que não recebem campanhas.', topics: ['Bloqueios'] },
  { id: 'plano',     icon: 'CreditCard',    title: 'Plano e cobrança', description: 'Seu plano na Áion, pagamentos, módulos contratados e créditos.', topics: ['Plano', 'Pagamentos', 'Módulos e créditos'] },
  { id: 'ia',        icon: 'Sparkles',      title: 'Inteligência artificial', description: 'Quanto da cota de IA a escola já usou no mês.', topics: ['Uso da IA'] },
  { id: 'lgpd',      icon: 'Lock',          title: 'Dados e privacidade (LGPD)', description: 'Termo de uso de dados e exportação de conversas.', topics: ['LGPD', 'Exportação'] },
]

/** Situação do item no plano (coluna do mapa). */
export type MapStatus = 'existente' | 'juntar' | 'remover' | 'nova' | 'fora'

export interface MapItem {
  id: string
  /** número(s) do item na auditoria de 22/10 */
  n: number[]
  group: SettingsGroupId | null
  topic: string
  label: string
  /** uma frase de ajuda, para gestor de escola */
  help: string
  keywords?: string
  status: MapStatus
  /** com quem junta (texto do mapa) ou por que sai */
  note?: string
  /** tela atual; null = ainda sem tela ("em breve") */
  href: string | null
  /** permissão vinda de settingsAccess (fonte única das telas /settings) */
  access?: SettingsItemId
  /** sem `access`: perfis que abrem hoje (ou que vão abrir, se "em breve") */
  roles?: ('admin' | 'manager')[]
  /** módulo liberado pela Áion para a escola (mesma regra do menu) */
  needs?: 'transmissoes'
}

const A: ('admin' | 'manager')[] = ['admin']
const AM: ('admin' | 'manager')[] = ['admin', 'manager']

export const SETTINGS_MAP: MapItem[] = [
  // ── WhatsApp e atendimento ────────────────────────────────────────────────
  { id: 'wa-conexao', n: [23], group: 'whatsapp', topic: 'Conexão', label: 'Conexão do WhatsApp', help: 'Número conectado, conversas do mês, testar e reconectar.', keywords: 'numero meta conectar reconectar testar status', status: 'existente', href: '/settings?tab=whatsapp&sec=conexao', access: 'whatsapp.conexao' },
  { id: 'wa-alertas', n: [50], group: 'whatsapp', topic: 'Conexão', label: 'Alertas do WhatsApp', help: 'Quem é avisado quando o WhatsApp cai ou fica sem receber mensagens.', keywords: 'aviso queda silencio sino notificacao', status: 'nova', href: null, roles: AM },
  { id: 'wa-horario', n: [13], group: 'whatsapp', topic: 'Atendimento', label: 'Dias e horário de atendimento', help: 'Quando a escola atende. Fora disso, o robô avisa o horário.', keywords: 'expediente horario dias semana funcionamento', status: 'existente', href: '/settings?tab=whatsapp&sec=horario', access: 'whatsapp.horario' },
  { id: 'wa-parada', n: [18], group: 'whatsapp', topic: 'Atendimento', label: 'Conversa parada', help: 'Depois de quantas horas sem resposta a conversa conta como parada.', keywords: 'parada inativa horas stale', status: 'existente', href: '/settings?tab=whatsapp&sec=horario', access: 'whatsapp.horario' },
  { id: 'wa-respostas', n: [24], group: 'whatsapp', topic: 'Atendimento', label: 'Respostas rápidas', help: 'Textos prontos que a equipe usa no chat. O Hub continua com o atalho.', keywords: 'atalho texto pronto mensagem pronta', status: 'juntar', note: 'uma lista só (hoje editável aqui e no Hub)', href: '/settings?tab=whatsapp&sec=respostas', access: 'whatsapp.respostas' },
  { id: 'wa-nome-atendente', n: [5], group: 'whatsapp', topic: 'Atendimento', label: 'Nome do atendente nas mensagens', help: 'Mostra quem está respondendo no começo de cada mensagem.', keywords: 'assinatura nome atendente', status: 'existente', href: '/settings?tab=whatsapp&sec=conexao', access: 'whatsapp.conexao' },
  { id: 'wa-avaliacao', n: [22], group: 'whatsapp', topic: 'Atendimento', label: 'Avaliação do atendimento', help: 'Ao encerrar, a família avalia: Ruim, Regular ou Ótimo.', keywords: 'pesquisa satisfacao nota avaliar', status: 'existente', note: 'renomear: deixa de se chamar "Pesquisa"', href: '/settings?tab=whatsapp&sec=pesquisa', access: 'whatsapp.pesquisa' },
  { id: 'wa-grupos', n: [25], group: 'whatsapp', topic: 'Organização', label: 'Grupos de atendimento (filas)', help: 'Quem recebe as conversas de cada assunto, em rodízio.', keywords: 'fila setor departamento rodizio distribuicao', status: 'existente', href: '/settings?tab=whatsapp&sec=equipe', access: 'whatsapp.equipe' },
  { id: 'wa-etiquetas', n: [28], group: 'whatsapp', topic: 'Organização', label: 'Etiquetas', help: 'Cores para organizar conversas e contatos.', keywords: 'tag cor marcador', status: 'existente', href: '/settings?tab=whatsapp&sec=etiquetas', access: 'whatsapp.etiquetas' },

  // ── Robô e mensagens automáticas ─────────────────────────────────────────
  { id: 'robo-editor', n: [12], group: 'robo', topic: 'Robô', label: 'Robô de atendimento', help: 'Monte o caminho da conversa e ligue ou desligue o robô. Botão "Editar robô" na Conexão.', keywords: 'bot fluxo menu chatbot automacao', status: 'existente', href: '/settings?tab=whatsapp&sec=conexao', access: 'whatsapp.conexao' },
  { id: 'robo-fora-horario', n: [15, 14], group: 'robo', topic: 'Mensagens automáticas', label: 'Mensagem fora do horário', help: 'O que a família recebe quando chama fora do horário de atendimento.', keywords: 'fora do horario ausencia fechado', status: 'juntar', note: 'fica só a das transferências (#15); a genérica (#14) sai', href: '/settings?tab=whatsapp&sec=horario', access: 'whatsapp.horario' },
  { id: 'robo-almoco', n: [16], group: 'robo', topic: 'Mensagens automáticas', label: 'Mensagem de almoço', help: 'Enviada quando o atendente está no horário de almoço.', keywords: 'almoco intervalo pausa', status: 'existente', href: '/settings?tab=whatsapp&sec=horario', access: 'whatsapp.horario' },
  { id: 'robo-inatividade', n: [17, 19], group: 'robo', topic: 'Mensagens automáticas', label: 'Tempo do robô (inatividade)', help: 'Depois de quantos minutos sem resposta o robô passa a conversa adiante, e para quem.', keywords: 'timeout inatividade transferir minutos espera', status: 'juntar', note: 'juntar os dois tempos (Horário e Equipe) num só; o destino fora do horário vira campo próprio', href: '/settings?tab=whatsapp&sec=horario', access: 'whatsapp.horario' },
  { id: 'robo-inatividade-equipe', n: [19], group: 'robo', topic: 'Mensagens automáticas', label: 'Tempo de inatividade (Equipe)', help: 'Hoje só vale se o tempo do robô estiver vazio. Vai ser juntado com o de cima.', keywords: 'timeout inatividade equipe', status: 'juntar', note: 'parte do #17', href: '/settings?tab=whatsapp&sec=equipe', access: 'whatsapp.equipe' },
  { id: 'robo-modelos', n: [41], group: 'robo', topic: 'Modelos', label: 'Modelos aprovados pela Meta', help: 'Mensagens prontas para campanhas e para falar com a família depois de 24 h.', keywords: 'template modelo meta aprovado', status: 'existente', href: '/transmissoes?aba=modelos', roles: AM, needs: 'transmissoes' },
  { id: 'robo-boasvindas', n: [20], group: 'robo', topic: 'Robô', label: 'Boas-vindas e menu antigos', help: '', status: 'remover', note: 'sem efeito (o robô visual substituiu); parar de regravar', href: null },
  { id: 'robo-reativacao', n: [21], group: 'robo', topic: 'Robô', label: 'Reativação de conversa', help: '', status: 'remover', note: 'nenhum código lê', href: null },

  // ── Escola ───────────────────────────────────────────────────────────────
  { id: 'escola-dados', n: [1], group: 'escola', topic: 'Dados da escola', label: 'Nome, e-mail, telefone e CNPJ', help: 'Aparecem nas telas e nos contratos.', keywords: 'nome cnpj email telefone cadastro', status: 'existente', href: '/settings?tab=geral', access: 'geral' },
  { id: 'escola-cidade', n: [2], group: 'escola', topic: 'Dados da escola', label: 'Cidade e estado', help: 'Usados no Início e no estudo de mercado.', keywords: 'cidade estado uf municipio endereco', status: 'juntar', note: 'uma cópia só (hoje também no assistente da campanha)', href: '/settings?tab=geral', access: 'geral' },
  { id: 'escola-series', n: [4], group: 'escola', topic: 'Séries', label: 'Séries', help: 'As séries que a escola oferece. Leads, contatos e base de alunos usam esta lista.', keywords: 'serie ano turma segmento infantil fundamental medio', status: 'juntar', note: 'uma lista só (hoje o assistente tem outra)', href: '/settings?tab=escola', access: 'escola.series' },
  { id: 'escola-logo', n: [3], group: 'escola', topic: 'Logo e cores', label: 'Logo e cores da escola', help: 'Usados nas telas e, quando a Vitrine não tem os próprios, nela também.', keywords: 'logo marca cor identidade visual', status: 'existente', href: '/settings?tab=identidade', access: 'identidade' },
  { id: 'escola-assistente', n: [35], group: 'escola', topic: 'Campanha de matrículas', label: 'Dados da campanha (assistente)', help: 'Mensalidade média da escola, alunos atuais, INEP e arquivos do sistema escolar.', keywords: 'campanha meta mensalidade media inep assistente', status: 'juntar', note: 'cidade/UF e séries passam a vir de Escola', href: '/settings?tab=escola', access: 'escola.dados' },
  { id: 'escola-pedidos', n: [36], group: 'escola', topic: 'Campanha de matrículas', label: 'Pedidos de mudança da campanha', help: 'Pedir à Áion para ajustar metas ou datas da campanha.', keywords: 'pedido mudanca meta campanha', status: 'existente', href: '/home', roles: AM },

  // ── Equipe e acessos ─────────────────────────────────────────────────────
  { id: 'equipe-usuarios', n: [6], group: 'equipe', topic: 'Pessoas', label: 'Usuários', help: 'Cadastrar, ativar, desativar e trocar a senha de quem usa o sistema.', keywords: 'usuario pessoa senha cadastro funcionario', status: 'existente', href: '/users', roles: A },
  { id: 'equipe-perfil', n: [11], group: 'equipe', topic: 'Pessoas', label: 'Meu perfil', help: 'Seu nome e telefone.', keywords: 'perfil meu nome telefone', status: 'existente', note: 'fica no menu da pessoa', href: '/profile', roles: AM },
  { id: 'equipe-conversas', n: [7], group: 'equipe', topic: 'O que cada pessoa vê', label: 'Vê todas as conversas e o histórico', help: 'Por pessoa: se vê só as conversas dela ou as da escola toda.', keywords: 'ver conversas historico acesso', status: 'existente', href: '/users', roles: A },
  { id: 'equipe-modulos', n: [8], group: 'equipe', topic: 'O que cada pessoa vê', label: 'Módulos por atendente', help: 'Quais telas cada atendente abre. Admin e gestor abrem todas.', keywords: 'permissao modulo acesso tela', status: 'juntar', note: 'mostrar junto o que a escola contratou (#44)', href: '/users', roles: A },
  { id: 'equipe-perm-mortas', n: [9], group: 'equipe', topic: 'O que cada pessoa vê', label: 'Permissões Relatórios, Pesquisas, Usuários, Configurações', help: '', status: 'remover', note: 'sem efeito: o perfil já decide', href: null },
  { id: 'equipe-horarios', n: [10], group: 'equipe', topic: 'Horário dos atendentes', label: 'Horário e almoço de cada atendente', help: 'Dias, entrada, saída e almoço. O WhatsApp usa para saber quem está disponível.', keywords: 'horario atendente almoco escala expediente', status: 'existente', href: '/settings?tab=whatsapp&sec=equipe', access: 'whatsapp.equipe.horarios' },

  // ── Funil e leads ────────────────────────────────────────────────────────
  { id: 'funil-etapas', n: [32], group: 'funil', topic: 'Leads', label: 'Nomes das etapas do funil', help: 'Novo, Em contato, Visita, Proposta, Matriculado, Perdido.', keywords: 'etapa funil kanban status', status: 'nova', note: 'antes: fonte única dos nomes (hoje copiados em 6 arquivos)', href: null, roles: AM },
  { id: 'funil-perda', n: [31], group: 'funil', topic: 'Leads', label: 'Motivos de perda', help: 'A lista de motivos ao marcar um lead como perdido.', keywords: 'perda perdido motivo', status: 'nova', note: 'só consulta no início', href: null, roles: AM },
  { id: 'funil-unidade', n: [29], group: 'funil', topic: 'Leads', label: 'Campo de unidade do lead', help: 'Para escolas com mais de uma unidade.', keywords: 'unidade filial sede', status: 'existente', href: '/settings?tab=escola', access: 'escola.unidade' },
  { id: 'funil-lembrete', n: [30], group: 'funil', topic: 'Leads', label: 'Lembrete de lead sem contato', help: 'Depois de quantos dias sem contato o lead aparece como atrasado.', keywords: 'lembrete atraso sem contato dias', status: 'existente', href: '/settings?tab=escola', access: 'escola.lembrete' },
  { id: 'funil-campos', n: [33], group: 'funil', topic: 'Contatos', label: 'Campos personalizados de contato', help: 'Informações extras na ficha do contato. Botão "Campos" em Contatos.', keywords: 'campo personalizado ficha contato', status: 'existente', href: '/contacts', roles: AM },
  { id: 'funil-captacao', n: [34], group: 'funil', topic: 'Captação', label: 'Captação Inteligente', help: 'Anúncio → mensagem automática → fila certa.', keywords: 'anuncio captacao gatilho campanha meta ads', status: 'existente', note: 'fica no módulo', href: '/captacao', roles: AM },
  { id: 'funil-vitrine', n: [40], group: 'funil', topic: 'Captação', label: 'Vitrine (página de links)', help: 'A página da escola com botões, agenda e vídeos.', keywords: 'vitrine linktree link pagina', status: 'existente', note: 'fica no módulo; logo e cores herdam de Escola', href: '/vitrine', roles: AM },
  { id: 'funil-planilha', n: [37], group: 'funil', topic: 'Base de alunos', label: 'Base de alunos: planilha e lançamento manual', help: 'Enviar o relatório de alunos ou lançar os números por série.', keywords: 'base alunos planilha relatorio rematricula', status: 'existente', href: '/settings?tab=integracoes', access: 'integracoes.planilha' },
  { id: 'funil-fonte', n: [37], group: 'funil', topic: 'Base de alunos', label: 'Fonte da base e rematrícula', help: 'De onde vêm os números da base de alunos.', keywords: 'fonte base rematricula', status: 'existente', href: '/settings?tab=integracoes', access: 'integracoes.config' },
  { id: 'funil-activesoft', n: [39], group: 'funil', topic: 'Base de alunos', label: 'Activesoft', help: 'Ligação com o sistema escolar para trazer os alunos.', keywords: 'activesoft erp sistema escolar integracao token', status: 'existente', href: '/settings?tab=integracoes', access: 'integracoes.activesoft' },
  { id: 'funil-pesquisa-saida', n: [38], group: 'funil', topic: 'Base de alunos', label: 'Pesquisa de saída', help: 'Perguntas para quem pede transferência.', keywords: 'pesquisa saida transferencia evasao', status: 'existente', note: 'renomear "Pesquisa de saída"', href: '/pesquisas', roles: AM },

  // ── Bloqueios e privacidade de contatos ──────────────────────────────────
  { id: 'bloq-numeros', n: [26], group: 'bloqueios', topic: 'Bloqueios', label: 'Números bloqueados', help: 'O sistema ignora as mensagens desses números.', keywords: 'bloquear bloqueio spam numero', status: 'juntar', note: 'tela única com 2 tipos (tabelas continuam separadas)', href: '/settings?tab=whatsapp&sec=bloqueios', access: 'whatsapp.bloqueios' },
  { id: 'bloq-campanhas', n: [27], group: 'bloqueios', topic: 'Bloqueios', label: 'Não recebem campanhas', help: 'Contatos que pediram para não receber mensagens em massa.', keywords: 'nao recebem descadastro opt out sair campanha', status: 'juntar', note: 'mesma tela dos bloqueados, tipo "só campanhas"', href: '/transmissoes?aba=nao-recebem', roles: AM, needs: 'transmissoes' },

  // ── Plano e cobrança ─────────────────────────────────────────────────────
  { id: 'plano-plano', n: [42], group: 'plano', topic: 'Plano', label: 'Plano e mensalidade da Áion', help: 'Seu plano, situação e o valor pago à Áion.', keywords: 'plano mensalidade aion assinatura valor', status: 'existente', note: 'renomear "Mensalidade da Áion"', href: '/settings?tab=geral', access: 'geral' },
  { id: 'plano-pagamentos', n: [43], group: 'plano', topic: 'Pagamentos', label: 'Pagamentos', help: 'Histórico das cobranças da Áion.', keywords: 'pagamento boleto fatura cobranca', status: 'existente', href: '/settings?tab=pagamentos', access: 'pagamentos' },
  { id: 'plano-modulos', n: [44], group: 'plano', topic: 'Módulos e créditos', label: 'Módulos contratados', help: 'O que a escola tem liberado (Transmissões, Base de alunos…).', keywords: 'modulo contratado liberado', status: 'nova', note: 'escola só vê; a Áion libera', href: null, roles: A },
  { id: 'plano-creditos', n: [45], group: 'plano', topic: 'Módulos e créditos', label: 'Créditos de Transmissões', help: 'Saldo e extrato dos créditos de campanhas.', keywords: 'credito saldo transmissao extrato', status: 'existente', href: '/settings?tab=transmissoes', access: 'transmissoes', needs: 'transmissoes' },

  // ── Inteligência artificial ──────────────────────────────────────────────
  { id: 'ia-cota', n: [46], group: 'ia', topic: 'Uso da IA', label: 'Uso da IA no mês', help: 'Quanto da cota de IA a escola já usou. O limite é definido pela Áion.', keywords: 'ia inteligencia artificial cota limite', status: 'nova', href: null, roles: A },

  // ── Dados e privacidade (LGPD) ───────────────────────────────────────────
  { id: 'lgpd-aceite', n: [47], group: 'lgpd', topic: 'LGPD', label: 'Termo de uso de dados (LGPD)', help: 'Aceite do aditivo de tratamento de dados.', keywords: 'lgpd termo aceite privacidade aditivo', status: 'nova', note: 'aguarda texto final', href: null, roles: A },
  { id: 'lgpd-exportar', n: [48], group: 'lgpd', topic: 'Exportação', label: 'Exportar conversas', help: 'Hoje: baixar a conversa aberta no WhatsApp. Exportação completa em breve.', keywords: 'exportar baixar csv conversa backup', status: 'existente', note: 'ampliar depois', href: '/whatsapp', roles: AM },
  { id: 'lgpd-notif', n: [49], group: 'lgpd', topic: 'LGPD', label: 'notification_settings', help: '', status: 'remover', note: 'coluna sem código', href: null },

  // ── Fora do painel da escola ─────────────────────────────────────────────
  { id: 'aion-silencio', n: [51], group: null, topic: '', label: 'Limites do silêncio e escolas ignoradas', help: '', status: 'fora', note: 'Super Admin → Configurações (regra da Áion)', href: null },
]

export interface SettingsCtx {
  role: string | null | undefined
  /** Transmissões liberado pela Áion (null = ainda carregando) */
  broadcast: boolean | null
}

export function isVisibleItem(it: MapItem, ctx: SettingsCtx): boolean {
  if (!it.group || it.status === 'remover' || it.status === 'fora') return false
  if (it.needs === 'transmissoes' && ctx.broadcast !== true) return false
  if (it.access) return canSeeSettingsItem(it.access, ctx.role)
  return ctx.role === 'admin' || ctx.role === 'manager' ? (it.roles ?? []).includes(ctx.role) : false
}

export const isSoon = (it: MapItem) => it.href === null

export function visibleGroupItems(group: SettingsGroupId, ctx: SettingsCtx): MapItem[] {
  return SETTINGS_MAP.filter(it => it.group === group && isVisibleItem(it, ctx))
}

/** Cartão aparece se o perfil vê ao menos um item do grupo (inclusive "em breve"). */
export function visibleGroups(ctx: SettingsCtx): SettingsGroup[] {
  return SETTINGS_GROUPS.filter(g => visibleGroupItems(g.id, ctx).length > 0)
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Busca pelo nome da opção (e palavras parecidas), sem ligar para acento. */
export function searchSettings(q: string, ctx: SettingsCtx): MapItem[] {
  const words = fold(q).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  return SETTINGS_MAP
    .filter(it => isVisibleItem(it, ctx))
    .map(it => {
      const label = fold(it.label)
      const hay = `${label} ${fold(it.help)} ${fold(it.keywords ?? '')} ${fold(SETTINGS_GROUPS.find(g => g.id === it.group)?.title ?? '')}`
      if (!words.every(w => hay.includes(w))) return null
      return { it, score: (words.every(w => label.includes(w)) ? 0 : 1) + (isSoon(it) ? 2 : 0) }
    })
    .filter((x): x is { it: MapItem; score: number } => !!x)
    .sort((a, b) => a.score - b.score)
    .map(x => x.it)
}

export type SettingsRoute =
  | { kind: 'home' }
  | { kind: 'group'; group: SettingsGroupId }
  | { kind: 'tab'; tab: SettingsTabId; sec: string | null }
  | { kind: 'redirect'; to: string }
  | { kind: 'wait' }

/**
 * Decide o que /settings mostra.
 * - /settings → Início (cartões)
 * - /settings/<grupo> → tela do grupo (redireciona ao Início se o perfil não vê)
 * - /settings?tab=…&sec=… (links antigos) → a mesma tela de hoje; exceções:
 *   · ?tab=whatsapp sem sec (alertas da central, atalhos do Hub) ou com uma sec
 *     que o perfil não abre → tela do grupo WhatsApp e atendimento
 *   · aba que o perfil não abre (ou inexistente) → Início
 */
export function resolveSettingsRoute(p: { grupo?: string | null; tab?: string | null; sec?: string | null }, ctx: SettingsCtx): SettingsRoute {
  if (p.grupo) {
    const g = SETTINGS_GROUPS.find(x => x.id === p.grupo)
    return g && visibleGroupItems(g.id, ctx).length ? { kind: 'group', group: g.id } : { kind: 'redirect', to: '/settings' }
  }
  if (!p.tab) return { kind: 'home' }
  const tab = p.tab as SettingsTabId
  const known = Object.values(SETTINGS_ITEMS).some(i => i.tab === tab)
  if (!known || !canSeeSettingsTab(tab, ctx.role)) return { kind: 'redirect', to: '/settings' }
  if (tab === 'transmissoes') {
    if (ctx.broadcast === null) return { kind: 'wait' }
    if (!ctx.broadcast) return { kind: 'redirect', to: '/settings' }
  }
  if (tab === 'whatsapp') {
    if (!p.sec || !visibleWhatsAppSections(ctx.role).includes(p.sec)) return { kind: 'redirect', to: '/settings/whatsapp' }
    return { kind: 'tab', tab, sec: p.sec }
  }
  return { kind: 'tab', tab, sec: p.sec ?? null }
}

/** Grupo de volta para uma tela antiga (cabeçalho "← grupo"). */
export function groupForTab(tab: string, sec: string | null): SettingsGroupId | null {
  const exact = `/settings?tab=${tab}${sec ? `&sec=${sec}` : ''}`
  const hit = SETTINGS_MAP.find(it => it.href === exact && it.group) ?? SETTINGS_MAP.find(it => it.href?.startsWith(`/settings?tab=${tab}`) && it.group)
  return hit?.group ?? null
}
