// Conteúdo da Academia Áion Edu: todas as aulas, as trilhas por módulo e os primeiros passos por papel.
// Escrito lendo o código de cada tela: os nomes de botões, abas e campos são idênticos aos da tela
// (a assistente de IA usa este mesmo texto, via public/academy-lessons.json gerado no prebuild).
import { MODULES, type Lesson, type Trail } from './academy'
import { LESSONS_A } from './lessons/a_inicio_leads'
import { LESSONS_B } from './lessons/b_contatos_whatsapp'
import { LESSONS_C } from './lessons/c_captacao_transmissoes'
import { LESSONS_D } from './lessons/d_campanha_base'
import { LESSONS_E } from './lessons/e_relatorios_pesquisas_admin'
import { LESSONS_F } from './lessons/f_admin_celular'

export const LESSONS: Lesson[] = [...LESSONS_A, ...LESSONS_B, ...LESSONS_C, ...LESSONS_D, ...LESSONS_E, ...LESSONS_F]

export const LESSON_BY_KEY: Record<string, Lesson> = Object.fromEntries(LESSONS.map(l => [l.key, l]))

// Ordem em que as aulas de cada módulo fazem sentido. Módulo sem ordem escrita usa a ordem do arquivo.
const ORDER: Record<string, string[]> = {
  inicio: ['ini_gestor', 'ini_atendente'],
  leads: ['ld_novo', 'ld_funil', 'ld_filtros', 'ld_atencao', 'ld_lembrete', 'ld_perdido'],
  visitas: ['vi_agendar', 'vi_confirmar', 'vi_baixa', 'vi_motivos'],
  contatos: ['ct_novo', 'ct_buscar', 'ct_importar'],
  whatsapp: ['wa_atender', 'wa_filtros', 'wa_respostas', 'wa_nova', 'wa_lead', 'wa_transferir', 'wa_concluir'],
  captacao: ['cp_nova', 'cp_resultados'],
  vitrine: ['vt_montar'],
  transmissoes: ['tr_nova', 'tr_acompanhar', 'tr_templates'],
  campanha: ['cm_visao', 'cm_vincular', 'cm_invest', 'cm_matriculometro', 'cm_config'],
  base_alunos: ['ba_visao', 'ba_alunos', 'ba_serie', 'ba_conferencia'],
  transferencias: ['tf_registrar', 'tf_relatorio'],
  relatorios: ['rl_ler'],
  pesquisas: ['pq_criar', 'pq_resultados'],
  usuarios: ['us_novo', 'us_acesso', 'us_senha'],
  configuracoes: ['cf_funil', 'cf_whatsapp', 'cf_escola', 'cf_integracoes', 'cf_plano'],
  celular: ['cel_instalar', 'cel_avisos', 'cel_ajuda', 'cel_barra', 'cel_status'],
}

/** Uma trilha por módulo. */
export const TRAILS: Trail[] = MODULES.map(m => ({
  module: m.id,
  title: m.label,
  desc: m.desc,
  lessons: ORDER[m.id] ?? LESSONS.filter(l => l.module === m.id).map(l => l.key),
}))

export { FIRST_STEPS } from './academy'
