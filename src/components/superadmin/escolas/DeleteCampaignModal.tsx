// @ts-nocheck
// Trecho do detalhe da escola (InstitutionDetails). Os dados chegam por props; tipar em uma etapa futura.
import { fmtBRL, fmtDate } from './format'
import { CheckCircle2, X } from 'lucide-react'

export default function DeleteCampaignModal({ closeDeleteReview, confirmUnderstood, deleteReview, executingCampaignDelete, handleConfirmDeleteCampaign, setConfirmUnderstood, setDeleteReview, toggleReviewRow }: any) {
          const { cycle, funnelRows, campaignRows, showAllFunnel, showAllCampaign } = deleteReview
          const visibleFunnel   = showAllFunnel   ? funnelRows   : funnelRows.filter(r => r._suggested || !r._parsed)
          const visibleCampaign = showAllCampaign ? campaignRows : campaignRows.filter(r => r._suggested || !r._parsed)
          const hiddenFunnelCount   = funnelRows.length - visibleFunnel.length
          const hiddenCampaignCount = campaignRows.length - visibleCampaign.length

          const selectedFunnel   = funnelRows.filter(r => r._selected)
          const selectedCampaign = campaignRows.filter(r => r._selected)
          const funnelHasReal   = (r: any) => (r.registrations || 0) > 0 || (r.schedules || 0) > 0 || (r.visits || 0) > 0 || (r.enrollments || 0) > 0
          const campaignHasReal = (r: any) => (r.investment || 0) > 0 || (r.leads_generated || 0) > 0
          const toDeleteCount = selectedFunnel.filter(r => !funnelHasReal(r)).length + selectedCampaign.filter(r => !campaignHasReal(r)).length
          const toClearCount  = selectedFunnel.length + selectedCampaign.length - toDeleteCount

          return (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
              <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-lg font-bold text-gray-900">Excluir campanha "{cycle.label || cycle.year}"</h2>
                  <button onClick={closeDeleteReview}><X className="w-5 h-5 text-gray-400" /></button>
                </div>
                <p className="text-xs text-gray-500 mb-4">Período: {fmtDate(cycle.start_date)} — {fmtDate(cycle.end_date)}</p>

                <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-xl mb-4">
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-green-800">
                    <strong>Os leads já captados continuam no CRM, qualificados como estão.</strong> Nenhum lead é apagado ou alterado — só perde o vínculo com esta campanha específica (o vínculo fica nulo automaticamente).
                  </p>
                </div>

                <p className="text-xs text-gray-500 mb-3">
                  Revise as linhas abaixo antes de confirmar. Pré-marcadas = período reconhecido dentro da campanha (sugestão automática, não decide sozinha). Desmarque o que não deve ser tocado, ou marque manualmente uma linha com período não reconhecido.
                </p>

                {/* funnel_metrics */}
                <div className="mb-4">
                  <p className="text-xs font-bold text-gray-700 mb-2">Metas de funil — funnel_metrics ({funnelRows.length} no total)</p>
                  {funnelRows.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Nenhum registro de funil para esta instituição.</p>
                  ) : (
                    <>
                      <div className="border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="p-2 text-left w-8"></th>
                              <th className="p-2 text-left">Período</th>
                              <th className="p-2 text-right">Cadastros</th>
                              <th className="p-2 text-right">Agend.</th>
                              <th className="p-2 text-right">Visitas</th>
                              <th className="p-2 text-right">Matríc.</th>
                              <th className="p-2 text-left">Ação</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleFunnel.map(r => {
                              const real = funnelHasReal(r)
                              return (
                                <tr key={r.id} className="border-t border-gray-100">
                                  <td className="p-2">
                                    <input type="checkbox" checked={r._selected} onChange={() => toggleReviewRow('funnelRows', r.id)} />
                                  </td>
                                  <td className="p-2 whitespace-nowrap">
                                    {r.period || '—'}
                                    {!r._parsed && <span className="ml-1.5 text-[10px] font-semibold text-amber-600">⚠ não reconhecido</span>}
                                  </td>
                                  <td className="p-2 text-right">{r.registrations}</td>
                                  <td className="p-2 text-right">{r.schedules}</td>
                                  <td className="p-2 text-right">{r.visits}</td>
                                  <td className="p-2 text-right">{r.enrollments}</td>
                                  <td className="p-2 whitespace-nowrap">
                                    {!r._selected
                                      ? <span className="text-gray-400">Não alterar</span>
                                      : real ? <span className="text-amber-600 font-medium">Limpar meta (mantém real)</span> : <span className="text-red-600 font-medium">Excluir linha</span>}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                      {hiddenFunnelCount > 0 && (
                        <button onClick={() => setDeleteReview(d => d && ({ ...d, showAllFunnel: true }))} className="text-xs text-cyan-600 font-semibold mt-1.5">
                          Mostrar mais {hiddenFunnelCount} linha{hiddenFunnelCount !== 1 ? 's' : ''} fora do período sugerido
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* marketing_campaigns */}
                <div className="mb-4">
                  <p className="text-xs font-bold text-gray-700 mb-2">Investimento/leads — marketing_campaigns ({campaignRows.length} no total)</p>
                  {campaignRows.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Nenhum registro de investimento para esta instituição.</p>
                  ) : (
                    <>
                      <div className="border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="p-2 text-left w-8"></th>
                              <th className="p-2 text-left">Período</th>
                              <th className="p-2 text-right">Investimento</th>
                              <th className="p-2 text-right">Leads</th>
                              <th className="p-2 text-left">Ação</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleCampaign.map(r => {
                              const real = campaignHasReal(r)
                              return (
                                <tr key={r.id} className="border-t border-gray-100">
                                  <td className="p-2">
                                    <input type="checkbox" checked={r._selected} onChange={() => toggleReviewRow('campaignRows', r.id)} />
                                  </td>
                                  <td className="p-2 whitespace-nowrap">
                                    {r.month_year || '—'}
                                    {!r._parsed && <span className="ml-1.5 text-[10px] font-semibold text-amber-600">⚠ não reconhecido</span>}
                                  </td>
                                  <td className="p-2 text-right">{fmtBRL(r.investment)}</td>
                                  <td className="p-2 text-right">{r.leads_generated}</td>
                                  <td className="p-2 whitespace-nowrap">
                                    {!r._selected
                                      ? <span className="text-gray-400">Não alterar</span>
                                      : real ? <span className="text-amber-600 font-medium">Limpar meta (mantém real)</span> : <span className="text-red-600 font-medium">Excluir linha</span>}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                      {hiddenCampaignCount > 0 && (
                        <button onClick={() => setDeleteReview(d => d && ({ ...d, showAllCampaign: true }))} className="text-xs text-cyan-600 font-semibold mt-1.5">
                          Mostrar mais {hiddenCampaignCount} linha{hiddenCampaignCount !== 1 ? 's' : ''} fora do período sugerido
                        </button>
                      )}
                    </>
                  )}
                </div>

                <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-700 mb-4">
                  <strong>{toDeleteCount}</strong> linha{toDeleteCount !== 1 ? 's' : ''} será{toDeleteCount !== 1 ? 'ão' : ''} excluída{toDeleteCount !== 1 ? 's' : ''} · <strong>{toClearCount}</strong> terá{toClearCount !== 1 ? 'ão' : ''} só a meta zerada (dado real preservado) · a campanha em si será excluída definitivamente.
                </div>

                <label className="flex items-start gap-2 mb-4 cursor-pointer">
                  <input type="checkbox" checked={confirmUnderstood} onChange={e => setConfirmUnderstood(e.target.checked)} className="mt-0.5" />
                  <span className="text-xs text-gray-700">Entendi que isso não pode ser desfeito.</span>
                </label>

                <div className="flex gap-3">
                  <button onClick={closeDeleteReview} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">Cancelar</button>
                  <button
                    onClick={handleConfirmDeleteCampaign}
                    disabled={!confirmUnderstood || executingCampaignDelete}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50"
                  >
                    {executingCampaignDelete ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Confirmar exclusão definitiva'}
                  </button>
                </div>
              </div>
            </div>
          )
}
