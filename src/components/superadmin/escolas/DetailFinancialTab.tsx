// @ts-nocheck
// Trecho do detalhe da escola (InstitutionDetails). Os dados chegam por props; tipar em uma etapa futura.
import { fmtBRL, fmtDate, daysLate } from './format'
import { CheckCircle2, ExternalLink, Copy, Send, MessageCircle, Plus, Ban } from 'lucide-react'
import { PAYMENT_STATUS, BROADCAST_AUTO_RELEASE } from './detailConsts'

export default function DetailFinancialTab({ copied, copyToClipboard, handleCancelPayment, handleGenerateLink, handleMarkPaid, handleResendPaymentEmail, handleSendWhatsAppPayment, payments, setShowNewCharge }: any) {
                const allPmt = payments
                const totalPaid = allPmt.filter(p => p.status === 'paid').reduce((s, p) => s + (p.amount || 0), 0)
                const totalOpen = allPmt.filter(p => p.status === 'pending' || p.status === 'overdue').reduce((s, p) => s + (p.amount || 0), 0)
                const nextDue = allPmt.filter(p => p.status === 'pending' && p.due_date).sort((a, b) => a.due_date.localeCompare(b.due_date))[0]
                return (
                  <div>
                    {/* KPIs */}
                    <div className="grid grid-cols-3 gap-4 mb-5">
                      <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
                        <p className="text-xs font-semibold text-green-600 mb-1">Total pago</p>
                        <p className="text-lg font-bold text-green-700">{fmtBRL(totalPaid)}</p>
                      </div>
                      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
                        <p className="text-xs font-semibold text-amber-600 mb-1">Em aberto</p>
                        <p className="text-lg font-bold text-amber-700">{fmtBRL(totalOpen)}</p>
                      </div>
                      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
                        <p className="text-xs font-semibold text-blue-600 mb-1">Próx. vencimento</p>
                        <p className="text-lg font-bold text-blue-700">{nextDue ? fmtDate(nextDue.due_date) : '—'}</p>
                      </div>
                    </div>

                    {/* Table */}
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-gray-700">Cobranças</p>
                      <button
                        onClick={() => setShowNewCharge(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-xl text-xs font-semibold hover:bg-cyan-100"
                      >
                        <Plus className="w-3 h-3" /> Nova cobrança
                      </button>
                    </div>
                    {allPmt.length === 0 ? (
                      <p className="text-sm text-gray-400 italic text-center py-8">Nenhuma cobrança registrada.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100">
                              {['Descrição', 'Valor', 'Vencimento', 'Status', ''].map(h => (
                                <th key={h} className="px-2 py-2 text-left text-xs font-semibold text-gray-400 uppercase">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {allPmt.map(p => {
                              const pst = PAYMENT_STATUS[p.status] || PAYMENT_STATUS.pending
                              const late = p.status === 'overdue' ? daysLate(p.due_date) : 0
                              return (
                                <tr key={p.id} className="hover:bg-gray-50">
                                  <td className="px-2 py-2 text-gray-700">
                                    {p.payment_type === 'broadcast' && (
                                      <span className="mr-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full text-sky-700 bg-sky-100 align-middle">Transmissão</span>
                                    )}
                                    {p.description || 'Cobrança'}
                                  </td>
                                  <td className="px-2 py-2 font-semibold text-gray-900">{fmtBRL(p.amount)}</td>
                                  <td className="px-2 py-2 text-gray-500">
                                    {fmtDate(p.due_date)}
                                    {late > 0 && <span className="ml-1 text-xs text-red-500 font-bold">{late}d</span>}
                                  </td>
                                  <td className="px-2 py-2">
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: pst.c, background: pst.bg }}>{pst.l}</span>
                                  </td>
                                  <td className="px-2 py-2">
                                    <div className="flex gap-1">
                                      {p.asaas_charge_url && (
                                        <>
                                          <button onClick={() => copyToClipboard(p.asaas_charge_url, `pay-${p.id}`)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                                            {copied === `pay-${p.id}` ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                          </button>
                                          <button onClick={() => handleResendPaymentEmail(p)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Send className="w-3.5 h-3.5" /></button>
                                          <button onClick={() => handleSendWhatsAppPayment(p)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg"><MessageCircle className="w-3.5 h-3.5" /></button>
                                          <a href={p.asaas_charge_url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg"><ExternalLink className="w-3.5 h-3.5" /></a>
                                        </>
                                      )}
                                      {p.payment_type === 'broadcast' ? (
                                        // Nem "marcar como pago" nem "🔗 Link" (que gera cobrança de
                                        // mensalidade): a campanha só sai pelo pagamento no Asaas.
                                        ['pending', 'overdue'].includes(p.status) && (
                                          <span className="text-[11px] text-gray-400 self-center whitespace-nowrap">{BROADCAST_AUTO_RELEASE}</span>
                                        )
                                      ) : (
                                        <>
                                          {!p.asaas_charge_url && p.status !== 'paid' && (
                                            <button onClick={() => handleGenerateLink(p.id)} className="px-2 py-1 text-xs bg-gray-100 border border-gray-200 text-gray-600 rounded-lg font-semibold">🔗 Link</button>
                                          )}
                                          {p.status === 'pending' && (
                                            <button onClick={() => handleMarkPaid(p.id, p.payment_type === 'implementation')} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg"><CheckCircle2 className="w-3.5 h-3.5" /></button>
                                          )}
                                        </>
                                      )}
                                      {p.status !== 'paid' && p.status !== 'cancelled' && (
                                        <button onClick={() => handleCancelPayment(p.id, p.asaas_payment_id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Ban className="w-3.5 h-3.5" /></button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
}
