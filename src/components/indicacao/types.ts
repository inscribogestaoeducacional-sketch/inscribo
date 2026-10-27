// Indicação de escolas: quem usa a Áion Edu indica o gestor de outra escola e ganha o prêmio
// quando a escola indicada paga a implantação.
export type IndStatus = 'indicado' | 'em_contato' | 'fechou' | 'pago' | 'nao_fechou' | 'ja_no_crm'

export interface Indicacao {
  id: string
  created_at: string
  gestor_nome: string
  gestor_whatsapp: string
  gestor_email?: string | null
  escola_nome: string
  status: IndStatus
  premio: number            // valor prometido no dia da indicação
  indicador_nome?: string   // só na tela da Áion
  indicador_escola?: string
}

export const STATUS_INFO: Record<IndStatus, { label: string; cor: string; fundo: string; dica: string }> = {
  indicado:   { label: 'Indicado',   cor: '#1D4ED8', fundo: '#EFF6FF', dica: 'Recebemos a sua indicação.' },
  em_contato: { label: 'Em contato', cor: '#B45309', fundo: '#FFFBEB', dica: 'Nossa equipe já falou com o gestor.' },
  fechou:     { label: 'Fechou',     cor: '#047857', fundo: '#ECFDF5', dica: 'A escola contratou. O prêmio é liberado quando a implantação for paga.' },
  pago:       { label: 'Pago',       cor: '#05907B', fundo: '#E6F7F5', dica: 'Prêmio pago por Pix.' },
  nao_fechou: { label: 'Não fechou', cor: '#64748B', fundo: '#F1F5F9', dica: 'A escola não seguiu desta vez.' },
  ja_no_crm:  { label: 'Já estava em contato', cor: '#64748B', fundo: '#F1F5F9', dica: 'Esse gestor já falava com a gente, então a indicação não vale.' },
}

export const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
export const dataCurta = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
export const MSG_PADRAO = 'Olá, {gestor}! {indicador}, da {escola_indicador}, indicou você para conhecer a Áion Edu, o sistema que organiza a captação e a matrícula da escola. Parabéns pela indicação! Posso te mostrar como funciona em poucos minutos?'
