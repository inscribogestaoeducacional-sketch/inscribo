// Cadastro dos sistemas de gestão escolar integrados à Áion (ERP).
// Para entrar um sistema novo: acrescentar uma linha aqui. O resto do app (card da família no WhatsApp,
// botões Matricular/Rematricular) usa só este cadastro. Os dados do aluno de qualquer sistema já caem nas
// mesmas tabelas (students, guardians, class_enrollments, student_external_ids com source = chave abaixo).
export type ErpSystem = {
  label: string
  /** Página do aluno onde se faz a matrícula/rematrícula. externalId = id interno do aluno no sistema (não a matrícula). */
  studentUrl: (externalId: string) => string
  /** Página de cadastro de aluno novo. */
  newStudentUrl: () => string
}

const ACTIVESOFT_WEB = 'https://siga03.activesoft.com.br' // tela da Activesoft (a API usa outro endereço); igual para todas as escolas

export const ERP_SYSTEMS: Record<string, ErpSystem> = {
  activesoft: {
    label: 'Activesoft',
    studentUrl: id => `${ACTIVESOFT_WEB}/alunos/${encodeURIComponent(id)}/enturmacao/`,
    newStudentUrl: () => `${ACTIVESOFT_WEB}/alunos/cadastrar/`,
  },
}

export const erpSystem = (provider: string | null | undefined): ErpSystem | null =>
  (provider && ERP_SYSTEMS[provider]) || null
