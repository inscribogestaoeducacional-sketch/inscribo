// Endereços da tela da Activesoft (SIGA). A API usa outro endereço (siga.activesoft.com.br/api/v0);
// a tela que a equipe abre no navegador é esta, igual para todas as escolas.
// O número da URL é o id interno do aluno (o mesmo que a API devolve em alunos.id), NÃO o número da matrícula.
export const ACTIVESOFT_WEB = 'https://siga03.activesoft.com.br'

/** Página de turmas do aluno (onde fica "Nova matrícula"). */
export const activesoftStudentUrl = (externalId: string | number) =>
  `${ACTIVESOFT_WEB}/alunos/${encodeURIComponent(String(externalId))}/enturmacao/`

/** Cadastro de aluno novo. */
export const activesoftNewStudentUrl = () => `${ACTIVESOFT_WEB}/alunos/cadastrar/`
