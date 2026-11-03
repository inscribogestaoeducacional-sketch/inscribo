// @ts-nocheck
// Trecho do detalhe da escola (InstitutionDetails). Os dados chegam por props; tipar em uma etapa futura.
import { fmtBRL, fmtDate, fmtDateTime } from './format'
import { CheckCircle2, X, Plus, Trash2, Bell, Edit2, Archive, Rocket } from 'lucide-react'
import { CYCLE_STATUS } from './detailConsts'

export default function DetailCampaignsTab({ archivingCampaignId, changeRequests, cycles, deletingCampaignId, handleApproveChangeRequest, handleArchiveCampaign, handleDeleteCampaign, handleReleaseCampaign, id, isSuperAdmin, openDeleteCampaignReview, openEditCampaign, openLimitedEdit, releasingCycleId, reviewLoadingCycleId, reviewingRequestId, setEditingCampaignId, setNewCampaignForm, setRejectReason, setRejectingRequest, setShowNewCampaign, users }: any) {
  return (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-semibold text-gray-700">Ciclos de campanha ({cycles.length})</p>
                    <button
                      onClick={() => {
                        setEditingCampaignId(null)
                        setNewCampaignForm({ year: new Date().getFullYear() + 1, startDate: '', endDate: '', targetNewStudents: '' })
                        setShowNewCampaign(true)
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-xl text-xs font-semibold hover:bg-orange-100"
                    >
                      <Plus className="w-3 h-3" /> Criar nova campanha
                    </button>
                  </div>

                  {changeRequests.length > 0 && (
                    <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 flex items-center gap-2">
                      <Bell className="w-4 h-4" /> {changeRequests.length} ajuste{changeRequests.length > 1 ? 's' : ''} da escola esperando sua resposta
                    </div>
                  )}
                  {cycles.length === 0 ? (
                    <p className="text-sm text-gray-400 italic text-center py-8">Nenhum ciclo de campanha criado ainda.</p>
                  ) : (
                    <div className="space-y-3">
                      {cycles.map(c => {
                        const cst = CYCLE_STATUS[c.status] || CYCLE_STATUS.draft
                        const canRelease = c.status === 'draft' || c.status === 'setup'
                        const isDraftLike = c.status === 'draft' || c.status === 'setup'
                        const isLiveLike = c.status === 'released' || c.status === 'active' || c.status === 'completed'
                        return (
                          <div key={c.id} className="rounded-xl border border-gray-200 p-4">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <p className="text-sm font-bold text-gray-900">{c.label || `Campanha ${c.target_school_year ?? c.year}`}</p>
                                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: cst.c, background: cst.bg }}>{cst.l}</span>
                                </div>
                                <p className="text-xs text-gray-500">
                                  {fmtDate(c.start_date)} — {fmtDate(c.end_date)}
                                  {c.released_at && <span className="ml-2 text-green-600 font-medium">· Liberada em {fmtDate(c.released_at)}</span>}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap min-w-0 max-w-full">
                                {isDraftLike && (
                                  <>
                                    <button
                                      onClick={() => openEditCampaign(c)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-xl text-xs font-semibold hover:bg-gray-50"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" /> Editar
                                    </button>
                                    <button
                                      onClick={() => handleDeleteCampaign(c.id)}
                                      disabled={deletingCampaignId === c.id}
                                      className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 rounded-xl text-xs font-semibold hover:bg-red-50 disabled:opacity-60"
                                    >
                                      {deletingCampaignId === c.id ? <div className="w-3.5 h-3.5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                      Excluir
                                    </button>
                                  </>
                                )}
                                {isLiveLike && (
                                  <>
                                    <button
                                      onClick={() => openLimitedEdit(c)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-xl text-xs font-semibold hover:bg-gray-50"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" /> Editar
                                    </button>
                                    <button
                                      onClick={() => handleArchiveCampaign(c.id)}
                                      disabled={archivingCampaignId === c.id}
                                      className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-xl text-xs font-semibold hover:bg-gray-50 disabled:opacity-60"
                                    >
                                      {archivingCampaignId === c.id ? <div className="w-3.5 h-3.5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                                      Arquivar
                                    </button>
                                    {/* Exclusão real (apaga campaign_cycle + limpa funnel_metrics/marketing_campaigns
                                        do período) — estritamente admin_geral, nunca visível pro gestor de escola nem
                                        pro consultor (que também acessa esta tela via /super-admin/schools/:id). */}
                                    {isSuperAdmin && (
                                      <button
                                        onClick={() => openDeleteCampaignReview(c)}
                                        disabled={reviewLoadingCycleId === c.id}
                                        className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 rounded-xl text-xs font-semibold hover:bg-red-50 disabled:opacity-60"
                                      >
                                        {reviewLoadingCycleId === c.id ? <div className="w-3.5 h-3.5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                        Excluir campanha
                                      </button>
                                    )}
                                  </>
                                )}
                                {canRelease && (
                                  <button
                                    onClick={() => handleReleaseCampaign(c.id)}
                                    disabled={releasingCycleId === c.id}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-orange-500 to-rose-600 text-white rounded-xl text-xs font-semibold disabled:opacity-60 flex-shrink-0"
                                  >
                                    {releasingCycleId === c.id ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Rocket className="w-3.5 h-3.5" />}
                                    Liberar para a escola
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Métricas já coletadas, quando existirem */}
                            {(c.target_new_students || c.base_students || c.projected_cpa) ? (
                              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100">
                                <div className="text-center">
                                  <p className="text-xs text-gray-400">Meta de novos alunos</p>
                                  <p className="text-sm font-bold text-gray-900">{c.target_new_students || '—'}</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-xs text-gray-400">Base de alunos</p>
                                  <p className="text-sm font-bold text-gray-900">{c.base_students || '—'}</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-xs text-gray-400">CPA projetado</p>
                                  <p className="text-sm font-bold text-gray-900">{c.projected_cpa ? fmtBRL(c.projected_cpa) : '—'}</p>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400 italic mt-3 pt-3 border-t border-gray-100">Métricas ainda não preenchidas pela escola.</p>
                            )}

                            {/* Ajuste pendente de aprovação — só aparece quando existe uma
                                campaign_change_requests com status='pending' pra este ciclo. */}
                            {changeRequests.filter(r => r.campaign_cycle_id === c.id).map(req => {
                              const rc = req.requested_changes || {}
                              const requester = users.find(u => u.id === req.requested_by)
                              return (
                                <div key={req.id} className="mt-3 pt-3 border-t border-amber-200 bg-amber-50 -mx-4 -mb-4 px-4 pb-4 rounded-b-xl">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Bell className="w-3.5 h-3.5 text-amber-600" />
                                    <p className="text-xs font-bold text-amber-800">Ajuste pendente de aprovação</p>
                                  </div>
                                  <p className="text-xs text-amber-700 mb-2">
                                    Solicitado por {requester?.full_name || 'gestor'} em {fmtDateTime(req.created_at)}
                                  </p>
                                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                                    <div><span className="text-gray-500">Novatos: </span><span className="font-semibold text-gray-900">{c.target_new_students || 0} → {rc.target_new_students ?? 0}</span></div>
                                    <div><span className="text-gray-500">Rematrícula: </span><span className="font-semibold text-gray-900">{Math.round((c.target_reenrollment_rate || 0) * 100)}% → {Math.round((rc.target_reenrollment_rate ?? 0) * 100)}%</span></div>
                                    <div className="col-span-2"><span className="text-gray-500">Período: </span><span className="font-semibold text-gray-900">{fmtDate(c.start_date)}–{fmtDate(c.end_date)} → {fmtDate(rc.start_date)}–{fmtDate(rc.end_date)}</span></div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleApproveChangeRequest(req)}
                                      disabled={reviewingRequestId === req.id}
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold disabled:opacity-60"
                                    >
                                      {reviewingRequestId === req.id ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                      Aprovar
                                    </button>
                                    <button
                                      onClick={() => { setRejectingRequest(req); setRejectReason('') }}
                                      disabled={reviewingRequestId === req.id}
                                      className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-semibold disabled:opacity-60"
                                    >
                                      <X className="w-3.5 h-3.5" /> Rejeitar
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
  )
}
