// @ts-nocheck
// Trecho do detalhe da escola (InstitutionDetails). Os dados chegam por props; tipar em uma etapa futura.
import { X } from 'lucide-react'
import { inp, lbl } from './ui'
import { CYCLE_STATUS } from './detailConsts'

export default function LimitedCampaignEditModal({ handleSaveLimitedEdit, limitedEditCampaign, limitedEditForm, savingLimitedEdit, setLimitedEditCampaign, setLimitedEditForm }: any) {
  return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900">Editar campanha</h2>
                <button onClick={() => setLimitedEditCampaign(null)}><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                Campanha já {CYCLE_STATUS[limitedEditCampaign.status]?.l.toLowerCase() || limitedEditCampaign.status} — ano e data de início não podem ser alterados.
              </p>
              <div className="space-y-3">
                <div>
                  <label className={lbl}>Data fim *</label>
                  <input type="date" className={inp} value={limitedEditForm.endDate} onChange={e => setLimitedEditForm(f => ({ ...f, endDate: e.target.value }))} />
                </div>
                <div>
                  <label className={lbl}>Meta de novos alunos</label>
                  <input type="number" className={inp} value={limitedEditForm.targetNewStudents} onChange={e => setLimitedEditForm(f => ({ ...f, targetNewStudents: e.target.value }))} placeholder="Ex: 50" />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setLimitedEditCampaign(null)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">Cancelar</button>
                <button onClick={handleSaveLimitedEdit} disabled={savingLimitedEdit} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-orange-500 to-rose-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
                  {savingLimitedEdit ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Salvar alterações'}
                </button>
              </div>
            </div>
          </div>
  )
}
