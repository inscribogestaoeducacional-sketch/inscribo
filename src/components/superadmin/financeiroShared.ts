// src/components/superadmin/financeiroShared.ts
// Tipos e utilidades do Financeiro geral (todas as empresas da Áion).

export const EDU_COMPANY_ID = '00000000-0000-4000-8000-0000000000e1'

export type Company = { id: string; name: string; color: string; active: boolean; sort_order: number }
export type Account = { id: string; company_id: string; name: string; kind: string; active: boolean; sort_order: number }
export type Category = { id: string; name: string; grp: 'receita' | 'custo' | 'despesa'; legacy_key: string; system_key: string | null; active: boolean; sort_order: number }
export type Recurrence = {
  id: string; company_id: string; type: 'entrada' | 'saida'; description: string; amount: number
  category_id: string | null; account_id: string | null; payment_method: string | null
  frequency: 'weekly' | 'monthly' | 'yearly'; next_date: string; end_date: string | null; active: boolean
}
export type Entry = {
  id: string; type: 'entrada' | 'saida'; amount: number; description: string; category: string
  entry_date: string; due_date: string | null; status: 'pago' | 'pendente'; company_id: string
  notes: string | null; folha_tipo: string | null; source: string
  account_id: string | null; category_id: string | null; payment_method: string | null
  installment_no: number | null; installment_total: number | null; group_id: string | null; recurrence_id: string | null
}

export const PAYMENT_METHODS: Record<string, string> = {
  pix: 'Pix', dinheiro: 'Dinheiro', cartao_credito: 'Cartão de crédito', cartao_debito: 'Cartão de débito',
  boleto: 'Boleto', transferencia: 'Transferência', outro: 'Outro',
}
export const ACCOUNT_KINDS: Record<string, string> = {
  banco: 'Conta bancária', asaas: 'Asaas', caixa: 'Caixa (dinheiro)', cartao: 'Cartão', outro: 'Outra',
}
export const FREQUENCIES: Record<string, string> = { monthly: 'Todo mês', weekly: 'Toda semana', yearly: 'Todo ano' }
export const GROUPS: Record<string, string> = { receita: 'Receitas', custo: 'Custos', despesa: 'Despesas' }
export const FOLHA_TIPO: Record<string, string> = {
  funcionario: 'Funcionário', socio_victor: 'Retirada de sócio - Victor', socio_fabio: 'Retirada de sócio - Fábio',
}
export const SOURCE_LABEL: Record<string, string> = { asaas: 'Asaas', recorrente: 'Recorrente' }

export const brl = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0)
export const todayISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]
export const fmtDate = (s: string | null) => s ? new Date(s + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
export const inRange = (d: string, a: string, b: string) => d >= a && d <= b

/** Soma meses mantendo o dia (ex.: 31/01 + 1 mês = 28/02). */
export function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const total = (m - 1) + n
  const ny = y + Math.floor(total / 12)
  const nm = ((total % 12) + 12) % 12
  const last = new Date(ny, nm + 1, 0).getDate()
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`
}

/** Divide o total em N parcelas em centavos; a última absorve a diferença. */
export function splitInstallments(total: number, n: number): number[] {
  const cents = Math.round(total * 100)
  const base = Math.floor(cents / n)
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? cents - base * (n - 1) : base) / 100)
}

export const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all bg-white'
export const lbl = 'block text-xs font-semibold text-gray-600 mb-1.5'
export const btnPrimary = 'flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60'
