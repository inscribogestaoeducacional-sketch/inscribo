// @ts-nocheck
// Trecho do detalhe da escola (InstitutionDetails). Os dados chegam por props; tipar em uma etapa futura.
import { RefreshCw, Send, X, Plus, Zap } from 'lucide-react'
import { inp, lbl } from './ui'

export default function DetailTemplatesTab({ handleAddTemplate, handleSyncTemplateDefinitions, loadWaTemplates, loadingTemplates, newTemplate, sendingNewTemplate, setNewTemplate, setShowAddTemplate, showAddTemplate, syncingDefs, waTemplates }: any) {
  return (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-semibold text-gray-700">Templates WhatsApp</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => loadWaTemplates()}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-xl text-xs font-semibold hover:bg-gray-50"
                      >
                        <RefreshCw className="w-3 h-3" /> Sincronizar com Meta
                      </button>
                      <button
                        onClick={handleSyncTemplateDefinitions}
                        disabled={syncingDefs}
                        title="Submete todos os templates cadastrados em Super Admin → WhatsApp → Templates Automáticos pra esta escola"
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-purple-200 text-purple-700 bg-purple-50 rounded-xl text-xs font-semibold hover:bg-purple-100 disabled:opacity-60"
                      >
                        {syncingDefs ? <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /> : <Zap className="w-3 h-3" />}
                        Sincronizar templates
                      </button>
                      <button
                        onClick={() => setShowAddTemplate(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-xl text-xs font-semibold hover:bg-cyan-100"
                      >
                        <Plus className="w-3 h-3" /> Adicionar template
                      </button>
                    </div>
                  </div>

                  {loadingTemplates ? (
                    <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" /></div>
                  ) : waTemplates.length === 0 ? (
                    <p className="text-sm text-gray-400 italic text-center py-8">Nenhum template encontrado.</p>
                  ) : (
                    <div className="space-y-3">
                      {waTemplates.map((tpl: any) => {
                        const statusColors: Record<string, { badge: string; dot: string }> = {
                          APPROVED: { badge: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
                          PENDING:  { badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-400' },
                          REJECTED: { badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
                        }
                        const sc = statusColors[tpl.status] || { badge: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' }
                        const bodyComp = tpl.components?.find((c: any) => c.type === 'BODY')
                        return (
                          <div key={tpl.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-bold text-gray-800">{tpl.name}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">{tpl.category}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 ${sc.badge}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                  {tpl.status}
                                </span>
                              </div>
                              {tpl.created_time && (
                                <span className="text-xs text-gray-400 shrink-0">{new Date(tpl.created_time * 1000).toLocaleDateString('pt-BR')}</span>
                              )}
                            </div>
                            {bodyComp?.text && (
                              <p className="text-xs text-gray-600 bg-white border border-gray-200 rounded-lg p-2 whitespace-pre-wrap">{bodyComp.text}</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Add template modal */}
                  {showAddTemplate && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
                      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
                        <div className="flex items-center justify-between mb-5">
                          <h2 className="text-lg font-bold text-gray-900">Novo Template</h2>
                          <button onClick={() => setShowAddTemplate(false)}><X className="w-5 h-5 text-gray-400" /></button>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <label className={lbl}>Nome (snake_case)</label>
                            <input className={inp} placeholder="ex: boas_vindas" value={newTemplate.name}
                              onChange={e => setNewTemplate(p => ({ ...p, name: e.target.value.toLowerCase().replace(/\s+/g,'_') }))} />
                          </div>
                          <div>
                            <label className={lbl}>Categoria</label>
                            <select className={inp} value={newTemplate.category}
                              onChange={e => setNewTemplate(p => ({ ...p, category: e.target.value }))}>
                              <option value="UTILITY">UTILITY</option>
                              <option value="MARKETING">MARKETING</option>
                              <option value="AUTHENTICATION">AUTHENTICATION</option>
                            </select>
                          </div>
                          <div>
                            <label className={lbl}>Texto do corpo (use {'{{'+'1}}'} para variáveis)</label>
                            <textarea className={inp} rows={4} placeholder="Olá, {{1}}! Bem-vindo ao {{2}}."
                              value={newTemplate.body}
                              onChange={e => setNewTemplate(p => ({ ...p, body: e.target.value }))} />
                          </div>
                          {newTemplate.body && (
                            <div>
                              <label className={lbl}>Preview</label>
                              <div className="bg-[#DCF8C6] rounded-xl px-4 py-3 text-sm text-gray-800 border border-green-200">{newTemplate.body}</div>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-3 mt-6">
                          <button onClick={() => setShowAddTemplate(false)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancelar</button>
                          <button onClick={handleAddTemplate} disabled={sendingNewTemplate}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
                            {sendingNewTemplate ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                            Enviar para aprovação
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
  )
}
