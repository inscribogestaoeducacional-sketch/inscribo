// Fase 6.2 — permissão POR ITEM nas Configurações.
//
// Antes, a rota /settings inteira era só do admin (o gestor não abria nada).
// Agora a rota aceita admin e gestor, e cada aba/seção/bloco declara quem vê.
// O que um perfil não vê não aparece na tela nem pode ser aberto por URL
// (?tab=…&sec=…). É a fonte única: telas e links leem daqui.
//
// Regras desta lista:
//  - Itens que o BANCO só deixa o admin gravar ficam só com o admin
//    (ex.: horário dos atendentes = UPDATE em users, política só de admin).
//  - Decisões já tomadas pelo Victor: dias de "sem contato" só admin (11/10).
//  - O resto que o gestor usa no dia a dia (auditoria de 12/10, item 4) fica
//    aberto para admin e gestor — lista a confirmar pelo Victor.
// Atendente ('user') não abre Configurações.

export type SettingsRole = 'admin' | 'manager'

// 5 abas (reorganização de 23/10): escola, plano, funil, whatsapp, integracoes.
export type SettingsTabId = 'escola' | 'plano' | 'funil' | 'whatsapp' | 'integracoes'

export interface SettingsItem {
  tab: SettingsTabId
  /** seção dentro da aba (WhatsApp tem seções; as outras abas usam blocos) */
  section?: string
  label: string
  roles: SettingsRole[]
}

const BOTH: SettingsRole[] = ['admin', 'manager']
const ADMIN: SettingsRole[] = ['admin']

export const SETTINGS_ITEMS = {
  'escola.dados':                  { tab: 'escola', section: 'dados',      label: 'Dados da escola',             roles: ADMIN },
  'escola.identidade':             { tab: 'escola', section: 'identidade', label: 'Logo e cores',                roles: ADMIN },
  'escola.series':                 { tab: 'escola', section: 'series',     label: 'Séries',                      roles: BOTH },
  'escola.campanha':               { tab: 'escola', section: 'campanha',   label: 'Dados da campanha (assistente)', roles: ADMIN },
  'plano.plano':                   { tab: 'plano', section: 'plano',       label: 'Plano e faturamento',         roles: ADMIN },
  'plano.pagamentos':              { tab: 'plano', section: 'pagamentos',  label: 'Pagamentos',                  roles: ADMIN },
  'plano.creditos':                { tab: 'plano', section: 'creditos',    label: 'Créditos de Transmissões',    roles: ADMIN },
  'funil.origens':                 { tab: 'funil', section: 'origens', label: 'Origens do lead', roles: BOTH },
  'funil.motivos':                 { tab: 'funil', section: 'motivos', label: 'Motivos de perda', roles: BOTH },
  'funil.etapas':                  { tab: 'funil', section: 'etapas', label: 'Etapas do funil', roles: BOTH },
  'funil.unidade':                 { tab: 'funil', section: 'unidade', label: 'Campo de unidade do lead',    roles: BOTH },
  'funil.lembrete':                { tab: 'funil', section: 'lembrete', label: 'Lembrete de lead sem contato', roles: ADMIN },
  'whatsapp.conexao':              { tab: 'whatsapp', section: 'conexao',   label: 'Conexão e robô',           roles: ADMIN },
  'whatsapp.automacoes':           { tab: 'whatsapp', section: 'automacoes', label: 'Painel de automações',              roles: ADMIN },
  'whatsapp.datas':               { tab: 'whatsapp', section: 'datas',     label: 'Feriados e datas especiais', roles: ADMIN },
  'whatsapp.horario':              { tab: 'whatsapp', section: 'horario',   label: 'Horário e mensagens automáticas', roles: ADMIN },
  'whatsapp.respostas':            { tab: 'whatsapp', section: 'respostas', label: 'Respostas rápidas',        roles: BOTH },
  'whatsapp.equipe':               { tab: 'whatsapp', section: 'equipe',    label: 'Grupos e tempo de inatividade', roles: BOTH },
  'whatsapp.equipe.horarios':      { tab: 'whatsapp', section: 'equipe',    label: 'Horário por atendente',    roles: ADMIN },
  'whatsapp.bloqueios':            { tab: 'whatsapp', section: 'bloqueios', label: 'Números bloqueados',       roles: BOTH },
  'whatsapp.etiquetas':            { tab: 'whatsapp', section: 'etiquetas', label: 'Etiquetas',                roles: BOTH },
  'whatsapp.pesquisa':             { tab: 'whatsapp', section: 'pesquisa',  label: 'Avaliação do atendimento', roles: BOTH },
  'whatsapp.parada':               { tab: 'whatsapp', section: 'parada',    label: 'Conversa parada', roles: BOTH },
  'whatsapp.modelos':              { tab: 'whatsapp', section: 'modelos',   label: 'Modelos da Meta', roles: ADMIN },
  'whatsapp.alertas':              { tab: 'whatsapp', section: 'alertas',   label: 'Alertas', roles: ADMIN },
  // Etapa B passo 4: relatório de alunos (planilha) — admin e gestor; o banco aceita os dois
  'integracoes.planilha':          { tab: 'integracoes', section: 'planilha',  label: 'Enviar relatório de alunos (planilha)', roles: BOTH },
  // Fase 2 · marco 1: números manuais por série (admin e gestor; o banco aceita os dois)
  'integracoes.manual':            { tab: 'integracoes', section: 'manual',  label: 'Lançamento manual da base (por série)', roles: BOTH },
  // Token do ERP, fonte da base e rematrícula: só admin (o banco também exige admin)
  'integracoes.activesoft':        { tab: 'integracoes', section: 'activesoft',  label: 'Activesoft (token e carga)', roles: ADMIN },
  'integracoes.config':            { tab: 'integracoes', section: 'config',  label: 'Fonte da base e rematrícula', roles: ADMIN },
} as const satisfies Record<string, SettingsItem>

export type SettingsItemId = keyof typeof SETTINGS_ITEMS

export function toSettingsRole(role: string | null | undefined): SettingsRole | null {
  return role === 'admin' || role === 'manager' ? role : null
}

export function canSeeSettingsItem(id: SettingsItemId, role: string | null | undefined): boolean {
  const r = toSettingsRole(role)
  return !!r && (SETTINGS_ITEMS[id].roles as readonly SettingsRole[]).includes(r)
}

/** A aba aparece se o perfil vê ao menos um item dela. */
export function canSeeSettingsTab(tab: SettingsTabId, role: string | null | undefined): boolean {
  return (Object.keys(SETTINGS_ITEMS) as SettingsItemId[])
    .some(id => SETTINGS_ITEMS[id].tab === tab && canSeeSettingsItem(id, role))
}

/** Seções da aba WhatsApp que o perfil vê. */
export function visibleWhatsAppSections(role: string | null | undefined): string[] {
  return (Object.keys(SETTINGS_ITEMS) as SettingsItemId[])
    .filter(id => SETTINGS_ITEMS[id].tab === 'whatsapp' && 'section' in SETTINGS_ITEMS[id] && canSeeSettingsItem(id, role))
    .map(id => (SETTINGS_ITEMS[id] as SettingsItem).section!)
    .filter((s, i, a) => a.indexOf(s) === i)
}

/** Monta o link de um item: /settings?tab=…&sec=… */
export function settingsHref(id: SettingsItemId): string {
  const it = SETTINGS_ITEMS[id] as SettingsItem
  return `/settings?tab=${it.tab}${it.section ? `&sec=${it.section}` : ''}`
}
