// @ts-nocheck
// Trecho do detalhe da escola (InstitutionDetails). Os dados chegam por props; tipar em uma etapa futura.
import { WABA_FIELD_LABEL, WABA_FIELD_PLACEHOLDER } from '../../../lib/whatsappSaveGuard'
import EmbeddedSignupButton from '../../whatsapp/EmbeddedSignupButton'
import LinkAionWabaPanel from '../LinkAionWabaPanel'
import { CheckCircle2, Wifi, WifiOff, Phone } from 'lucide-react'
import { inp, lbl } from './ui'

export default function DetailWhatsAppTab({ handleSaveWhatsApp, handleUpdateLimit, hasOwnNumber, id, institution, isSuperAdmin, loadAll, newLimit, ownWaba, savingWa, setChargeForm, setNewLimit, setShowNewCharge, setWaForm, updatingLimit, usagePct, waConnected, waForm, waInvalidRecord, waSaved, waUsage }: any) {
  return (
                <div className="space-y-5">
                  {/* Connection status */}
                  <div className={`flex items-center gap-3 p-4 rounded-xl border ${waConnected ? 'bg-green-50 border-green-200' : waInvalidRecord ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                    {waConnected
                      ? <><Wifi className="w-5 h-5 text-green-600 shrink-0" /><div><p className="text-sm font-bold text-green-700">Conectado</p><p className="text-xs text-green-600">{institution.whatsapp_phone_number || institution.whatsapp_display_name || ''}</p></div></>
                      : waInvalidRecord
                        ? <><WifiOff className="w-5 h-5 text-red-500 shrink-0" /><div><p className="text-sm font-bold text-red-700">Não conectado — cadastro inválido</p><p className="text-xs text-red-600">A escola está marcada como conectada, mas sem número e conta próprios{waSaved?.waba_id ? <> (cadastro aponta para a conta de teste da Áion {waSaved.waba_id})</> : null}. Vincular a conta abaixo substitui esse cadastro.</p></div></>
                        : <><WifiOff className="w-5 h-5 text-gray-400 shrink-0" /><div><p className="text-sm font-bold text-gray-600">Não conectado</p><p className="text-xs text-gray-400">Configure o WhatsApp Business abaixo.</p></div></>
                    }
                  </div>

                  {/* Reconexão pela Meta em coexistência (popup), feita pela equipe
                      Áion em chamada com a escola. Só aparece com número PRÓPRIO
                      da escola (só aceita a mesma conta/WABA). Sem número próprio
                      não há popup aqui: conta da escola nasce no WhatsApp Manager
                      da Áion e entra por "Vincular conta da Áion" — o popup tenta
                      compartilhar a conta com a própria dona e a Meta recusa
                      (#1690130). Nunca chama /register. Só admin_geral vê. */}
                  {id && isSuperAdmin && hasOwnNumber && waSaved && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                      <div>
                        <p className="text-sm font-bold text-amber-800">Reconectar WhatsApp (coexistência)</p>
                        <p className="text-xs text-amber-900/80 mt-1 leading-relaxed">
                          Religa a conta atual (WABA {ownWaba}) mantendo o app WhatsApp Business no celular da escola. Outra conta é recusada sem alterar nada.
                        </p>
                        <p className="text-xs text-amber-900/80 mt-1 leading-relaxed">
                          <strong>Atenção:</strong> o popup não serve para conta criada no WhatsApp Manager da Áion — a Meta tenta compartilhar a conta com a própria dona e recusa (erro #1690130). Para essas contas, use "Vincular conta da Áion" abaixo.
                        </p>
                      </div>
                      <EmbeddedSignupButton
                        institutionId={id}
                        superAdminInstitutionId={id}
                        onConnected={() => loadAll(true)}
                        mode="reconnect"
                        reconnectTarget={{
                          wabaId: ownWaba,
                          phoneNumber: waSaved.phone_number || institution.whatsapp_phone_number || null,
                          displayName: waSaved.display_name || institution.whatsapp_display_name || null,
                        }}
                      />
                    </div>
                  )}

                  {/* Conta criada no WhatsApp Manager da Áion (o popup não deixa
                      usar o portfólio dona do app): vincula pelo ID da conta.
                      Campo vazio e editável se a escola não tem conta própria. */}
                  {id && isSuperAdmin && (
                    <LinkAionWabaPanel institutionId={id} savedWabaId={ownWaba} onLinked={() => loadAll(true)} />
                  )}

                  {/* WA config form */}
                  <div className="border-t border-gray-100 pt-5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Configuração</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {[
                        { k: 'phone_id',     label: 'Phone ID',     placeholder: 'ID do número (Meta)' },
                        { k: 'phone_number', label: 'Telefone',     placeholder: '+55 (00) 00000-0000' },
                        { k: 'display_name', label: 'Nome exibido', placeholder: 'Nome da conta WA' },
                        { k: 'waba_id',      label: WABA_FIELD_LABEL, placeholder: WABA_FIELD_PLACEHOLDER },
                      ].map(f => (
                        <div key={f.k}>
                          <label className={lbl}>{f.label}</label>
                          <input
                            className={inp}
                            placeholder={f.placeholder}
                            value={(waForm as any)[f.k]}
                            onChange={e => setWaForm(p => ({ ...p, [f.k]: e.target.value }))}
                          />
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={handleSaveWhatsApp}
                      disabled={savingWa}
                      className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60"
                    >
                      {savingWa
                        ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <CheckCircle2 className="w-4 h-4" />}
                      Salvar e verificar
                    </button>
                  </div>
                </div>
  )
}
