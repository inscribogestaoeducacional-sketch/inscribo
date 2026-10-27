// Diagnóstico de atendimento: 5 perguntas pontuadas (0 a 100) + 2 opcionais.
// Os pesos são da Áion; nenhuma resposta é inventada: sem resposta, não há nota.
export interface Opcao { v: string; t: string; p: number }
export interface Pergunta { id: string; t: string; icon: string; peso: number; opcoes: Opcao[]; opcional?: boolean }

export const PERGUNTAS: Pergunta[] = [
  { id: 'tempo', t: 'Quanto tempo a escola leva para responder um contato novo?', icon: 'timer', peso: 25, opcoes: [
    { v: 'ate5', t: 'Menos de 5 minutos', p: 1 }, { v: 'ate60', t: 'Até 1 hora', p: 0.7 }, { v: 'dia', t: 'No mesmo dia', p: 0.3 }, { v: 'prox', t: 'Só no dia seguinte', p: 0 }] },
  { id: 'volume', t: 'Quantos contatos de famílias novas chegam por mês? (opcional)', icon: 'inbox', peso: 0, opcional: true, opcoes: [
    { v: '0-10', t: 'Até 10', p: 0 }, { v: '11-50', t: '11 a 50', p: 0 }, { v: '51-150', t: '51 a 150', p: 0 }, { v: '151-300', t: '151 a 300', p: 0 }, { v: '300+', t: 'Mais de 300', p: 0 }] },
  { id: 'visita', t: 'De cada 10 famílias que pedem informação, quantas visitam a escola?', icon: 'door', peso: 20, opcoes: [
    { v: '0-2', t: '0 a 2', p: 0 }, { v: '3-4', t: '3 ou 4', p: 0.4 }, { v: '5-6', t: '5 ou 6', p: 0.75 }, { v: '7+', t: '7 ou mais', p: 1 }] },
  { id: 'fora', t: 'Quem atende fora do horário e nos fins de semana?', icon: 'moon', peso: 20, opcoes: [
    { v: 'ninguem', t: 'Ninguém', p: 0 }, { v: 'um', t: 'Um funcionário, quando dá', p: 0.4 }, { v: 'robo', t: 'Um robô de atendimento', p: 0.8 }, { v: 'plantao', t: 'Equipe de plantão', p: 1 }] },
  { id: 'origem', t: 'A escola sabe de qual anúncio ou ação veio cada matrícula?', icon: 'target', peso: 20, opcoes: [
    { v: 'nao', t: 'Não sabe', p: 0 }, { v: 'alguns', t: 'De alguns', p: 0.5 }, { v: 'todos', t: 'De todos', p: 1 }] },
  { id: 'rematricula', t: 'Como é feita a rematrícula?', icon: 'repeat', peso: 15, opcoes: [
    { v: 'nenhum', t: 'Sem processo', p: 0 }, { v: 'papel', t: 'No papel', p: 0.3 }, { v: 'planilha', t: 'Em planilha', p: 0.6 }, { v: 'sistema', t: 'Sistema com cobrança', p: 1 }] },
  { id: 'outras', t: 'Quantos alunos moram em outra cidade? (opcional)', icon: 'map', peso: 0, opcional: true, opcoes: [
    { v: '0', t: 'Quase nenhum', p: 0 }, { v: '1-10', t: 'Até 10%', p: 0 }, { v: '11-30', t: '11 a 30%', p: 0 }, { v: '30+', t: 'Mais de 30%', p: 0 }] },
]

export type Respostas = Record<string, string>
export type Faixa = 'forte' | 'falhas' | 'perdendo'

export function respondeuTudo(r: Respostas) { return PERGUNTAS.filter(q => !q.opcional).every(q => !!r[q.id]) }

export function pontuar(r: Respostas): { pontuacao: number; faixa: Faixa } | null {
  if (!respondeuTudo(r)) return null
  let s = 0
  for (const q of PERGUNTAS) { const o = q.opcoes.find(x => x.v === r[q.id]); if (o) s += o.p * q.peso }
  const pontuacao = Math.round(s)
  return { pontuacao, faixa: pontuacao >= 80 ? 'forte' : pontuacao >= 50 ? 'falhas' : 'perdendo' }
}

export const FAIXA_TXT: Record<Faixa, string> = { forte: 'Atendimento forte', falhas: 'Atendimento com falhas', perdendo: 'Matrículas se perdendo no caminho' }
export const textoResposta = (id: string, v?: string) => PERGUNTAS.find(q => q.id === id)?.opcoes.find(o => o.v === v)?.t
