// Formatadores compartilhados das telas de Escolas do Super Admin (lista, detalhe e abas).

export function fmtBRL(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0)
}

// Igual ao fmtBRL, mas mostra "—" quando não há valor (usado na lista).
export function fmtBRLOrDash(n?: number | null) {
  return n?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || '—'
}

export function fmtDate(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('pt-BR')
}

export function fmtDateTime(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function daysLate(due: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(due + 'T12:00:00').getTime()) / 86400000))
}
