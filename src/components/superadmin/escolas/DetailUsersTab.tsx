// @ts-nocheck
// Trecho do detalhe da escola (InstitutionDetails). Os dados chegam por props; tipar em uma etapa futura.
import { Lock, Unlock, Plus, ChevronDown, ChevronUp, UserX, RotateCcw } from 'lucide-react'

export default function DetailUsersTab({ handleDeleteUser, handleReactivateLink, handleToggleUser, removedLinks, setShowNewUser, setShowRemoved, showRemoved, users }: any) {
  return (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-semibold text-gray-700">Usuários da escola</p>
                    <button
                      onClick={() => setShowNewUser(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-xl text-xs font-semibold hover:bg-cyan-100"
                    >
                      <Plus className="w-3 h-3" /> Adicionar usuário
                    </button>
                  </div>
                  {users.length === 0 ? (
                    <p className="text-sm text-gray-400 italic text-center py-8">Nenhum usuário cadastrado.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            {['Nome', 'E-mail', 'Perfil', 'Tipo', 'Status', ''].map(h => (
                              <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {users.map(u => (
                            <tr key={u.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2.5 font-medium text-gray-900">{u.full_name || '—'}</td>
                              <td className="px-3 py-2.5 text-gray-500">{u.email}</td>
                              <td className="px-3 py-2.5 text-gray-600 capitalize">{u.role}</td>
                              <td className="px-3 py-2.5 text-gray-600 text-xs">{u.user_type || 'school_user'}</td>
                              <td className="px-3 py-2.5">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${u.active ? 'text-green-700 bg-green-100' : 'text-gray-500 bg-gray-100'}`}>
                                  {u.active ? 'Ativo' : 'Inativo'}
                                </span>
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex gap-1.5 justify-end">
                                  <button
                                    onClick={() => handleToggleUser(u)}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${u.active ? 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100' : 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'}`}
                                  >
                                    {u.active ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                                    {u.active ? 'Desativar' : 'Ativar'}
                                  </button>
                                  <button
                                    onClick={() => handleDeleteUser(u)}
                                    title="Remover desta escola"
                                    className="p-1.5 bg-red-50 text-red-500 border border-red-200 rounded-lg hover:bg-red-100"
                                  >
                                    <UserX className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {removedLinks.length > 0 && (
                    <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setShowRemoved(v => !v)}
                        className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-gray-500 uppercase hover:bg-gray-50"
                      >
                        Removidos desta escola ({removedLinks.length})
                        {showRemoved ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      {showRemoved && (
                        <div className="divide-y divide-gray-50 border-t border-gray-100">
                          {removedLinks.map(r => (
                            <div key={r.user_id} className="flex items-center justify-between px-4 py-2.5">
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{r.full_name}</p>
                                <p className="text-xs text-gray-400">{r.email}</p>
                              </div>
                              <button
                                onClick={() => handleReactivateLink(r.user_id)}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                              >
                                <RotateCcw className="w-3 h-3" /> Reativar
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
  )
}
