// @ts-nocheck
// Trecho do detalhe da escola (InstitutionDetails). Os dados chegam por props; tipar em uma etapa futura.
import { CreditCard, X } from 'lucide-react'
import { inp, lbl } from './ui'

export default function NewChargeModal({ chargeForm, handleNewCharge, savingCharge, setChargeForm, setShowNewCharge }: any) {
  return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900">Nova cobrança</h2>
                <button onClick={() => setShowNewCharge(false)}><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Tipo</label>
                    <select className={inp} value={chargeForm.payment_type} onChange={e => setChargeForm(f => ({ ...f, payment_type: e.target.value }))}>
                      <option value="monthly">Mensalidade</option>
                      <option value="implementation">Implantação</option>
                      <option value="extra_conversations">Conversas extras</option>
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Forma</label>
                    <select className={inp} value={chargeForm.billingType} onChange={e => setChargeForm(f => ({ ...f, billingType: e.target.value }))}>
                      <option value="PIX">PIX</option>
                      <option value="BOLETO">Boleto</option>
                      <option value="CREDIT_CARD">Cartão</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Valor (R$) *</label>
                    <input type="number" className={inp} value={chargeForm.amount} onChange={e => setChargeForm(f => ({ ...f, amount: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Vencimento</label>
                    <input type="date" className={inp} value={chargeForm.due_date} onChange={e => setChargeForm(f => ({ ...f, due_date: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className={lbl}>Descrição</label>
                  <input className={inp} value={chargeForm.description} onChange={e => setChargeForm(f => ({ ...f, description: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowNewCharge(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">Cancelar</button>
                <button onClick={handleNewCharge} disabled={savingCharge} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
                  {savingCharge ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CreditCard className="w-4 h-4" />} Gerar cobrança
                </button>
              </div>
            </div>
          </div>
  )
}
