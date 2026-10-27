// Roteiro da campanha: etapas fixas (só o que se refaz a cada campanha). O que já está pronto na escola
// (WhatsApp, dados, equipe) não entra. O sistema marca sozinho o que detecta (auto) e a pessoa pode marcar à mão.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

export type StepStatus = 'done' | 'skipped' | 'todo'
export interface RoadmapStep {
  key: string
  title: string
  why: string
  todo: string[]
  to: string
  cta: string
  /** chave devolvida por roadmap_state.auto; sem ela, só a pessoa marca */
  auto?: string
  minutes: number
}

export const ROADMAP_STEPS: RoadmapStep[] = [
  { key: 'funil', title: 'Ajustar as etapas do funil de leads', minutes: 5, to: '/settings?tab=funil', cta: 'Abrir Funil e leads', auto: 'funil',
    why: 'As etapas são o cronograma de cada família: do primeiro contato à matrícula. Com elas certas, o funil da campanha mostra onde se perde gente.',
    todo: ['Abra Configurações, aba Funil e leads.', 'Confira se o nome de cada etapa ainda faz sentido para a campanha nova.', 'Crie uma etapa extra se precisar (por exemplo, “Concurso de bolsa”).', 'Revise as origens (como a família chegou) e os motivos de perda.'] },
  { key: 'base', title: 'Trazer a base de alunos do ano', minutes: 5, to: '/base-alunos', cta: 'Abrir Base de alunos', auto: 'base',
    why: 'É a base que separa rematrícula de aluno novo e mostra quem falta rematricular. Sem ela, os números da campanha ficam incompletos.',
    todo: ['Abra a Base de alunos.', 'Confirme que a lista do ano da campanha chegou (pela integração com o sistema da escola ou pela planilha).', 'Veja a aba Conferir matrículas e resolva o que estiver diferente.', 'Escolha como a escola conta pré-matrícula e quem já foi aluno e voltou.'] },
  { key: 'campanha', title: 'Criar e ativar a Campanha de Matrículas', minutes: 10, to: '/campanha', cta: 'Abrir a Campanha', auto: 'campanha',
    why: 'A campanha define as datas e organiza tudo: metas, funil, investimento e acompanhamento do ano.',
    todo: ['Abra Campanha de Matrículas e siga o passo a passo da configuração.', 'Passo 1: confirme início e fim (normalmente agosto a março).', 'Passo 2: veja o plano inicial feito com o histórico da escola.', 'Ative a campanha no final.'] },
  { key: 'metas', title: 'Revisar as metas, mês a mês', minutes: 8, to: '/campanha', cta: 'Abrir as metas', auto: 'metas',
    why: 'A meta de cada mês acumula: o que faltou soma no mês seguinte e o que sobrou diminui. Metas realistas mantêm a equipe no ritmo.',
    todo: ['Na Campanha, abra Configuração da campanha, passo Metas.', 'Confira o total de alunos, as rematrículas e os novos.', 'Ajuste a distribuição por mês onde achar que o histórico não vale.', 'Salve. A partir daí o sistema acompanha e compensa mês a mês.'] },
  { key: 'sequencia', title: 'Ligar o robô de sequência para lead sem resposta', minutes: 8, to: '/settings?tab=whatsapp&sec=sequencia', cta: 'Abrir a sequência', auto: 'sequencia',
    why: 'Quando o lead para de responder, o robô manda até 5 mensagens, uma por vez, no horário que você definir. É retorno que a equipe não precisa lembrar.',
    todo: ['Abra Configurações, WhatsApp, Sequência para lead sem resposta.', 'Escreva (ou revise) as mensagens de cada passo e o intervalo entre elas.', 'Defina os dias e o horário de envio.', 'Ligue a sequência.'] },
  { key: 'vitrine', title: 'Atualizar e publicar a Vitrine', minutes: 10, to: '/vitrine', cta: 'Abrir a Vitrine', auto: 'vitrine',
    why: 'É a página da escola com um link só. Todo anúncio e toda postagem da campanha deve apontar para ela.',
    todo: ['Abra a Vitrine.', 'Atualize fotos, texto e botões com a campanha do ano.', 'Confira o formulário de contato e o WhatsApp.', 'Publique e copie o link para usar na divulgação.'] },
  { key: 'captacao', title: 'Montar a captação dos anúncios', minutes: 8, to: '/captacao', cta: 'Abrir a Captação',
    why: 'Mostra de qual anúncio veio cada conversa. É assim que você sabe o que dá resultado.',
    todo: ['Abra a Captação.', 'Crie uma captação para cada anúncio ou campanha do ano.', 'Use o link ou a mensagem pronta no anúncio.', 'Depois, acompanhe o que cada uma trouxe.'] },
  { key: 'transmissao', title: 'Preparar a lista de transmissão', minutes: 10, to: '/transmissoes', cta: 'Abrir Transmissões', auto: 'transmissao',
    why: 'Chama de uma vez as famílias que precisam rematricular e os leads antigos que ainda podem fechar.',
    todo: ['Abra Transmissões e crie uma campanha.', 'Escolha o público: quem falta rematricular, leads antigos ou os inscritos de um concurso de bolsa.', 'Escolha o modelo de mensagem e agende o envio.', 'Acompanhe quem respondeu.'] },
  { key: 'pesquisa', title: 'Rodar a pesquisa de satisfação', minutes: 8, to: '/pesquisas', cta: 'Abrir Pesquisas', auto: 'pesquisa',
    why: 'Ouvir as famílias antes da rematrícula mostra quem está insatisfeito a tempo de agir.',
    todo: ['Abra Pesquisas e crie uma pesquisa de satisfação.', 'Envie o link para as famílias (WhatsApp ou transmissão).', 'Depois de algumas respostas, peça a análise da IA.', 'Procure quem deu nota baixa e retorne.'] },
  { key: 'acompanhar', title: 'Montar a rotina de acompanhamento', minutes: 5, to: '/campanha', cta: 'Abrir a Campanha',
    why: 'Campanha boa é acompanhada toda semana. Este é o hábito que mantém as metas em dia.',
    todo: ['Veja o Matriculômetro e o Dia a dia da Campanha.', 'Olhe o Funil e a etapa onde mais se perde.', 'No fim do mês, gere o relatório mensal com a análise da IA.', 'Ajuste metas e ações com base nisso.'] },
]

export interface RoadmapState { released: boolean; year?: number; steps?: Record<string, 'done' | 'skipped'>; auto?: Record<string, boolean> }

export const stepStatus = (s: RoadmapStep, st: RoadmapState): StepStatus => {
  if (s.auto && st.auto?.[s.auto]) return 'done'
  const m = st.steps?.[s.key]
  return m === 'done' ? 'done' : m === 'skipped' ? 'skipped' : 'todo'
}

const REFRESH = 'aion:roadmap-refresh'

export function useRoadmap(institutionId?: string) {
  const [state, setState] = useState<RoadmapState | null>(null)
  const load = useCallback(async () => {
    if (!institutionId) return
    const { data, error } = await supabase.rpc('roadmap_state', { p_inst: institutionId })
    setState(error ? { released: false } : (data as RoadmapState))
  }, [institutionId])
  useEffect(() => { load(); const h = () => load(); window.addEventListener(REFRESH, h); return () => window.removeEventListener(REFRESH, h) }, [load])
  const setStep = useCallback(async (key: string, status: 'done' | 'skipped' | null) => {
    if (!institutionId || !state?.year) return
    await supabase.rpc('roadmap_set_step', { p_inst: institutionId, p_year: state.year, p_step: key, p_status: status })
    window.dispatchEvent(new Event(REFRESH))
  }, [institutionId, state?.year])
  return { state, reload: load, setStep }
}
