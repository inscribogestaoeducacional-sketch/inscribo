// @ts-nocheck
// Trecho do detalhe da escola (InstitutionDetails). Os dados chegam por props; tipar em uma etapa futura.
import { X } from 'lucide-react'
import { inp, lbl } from './ui'

export default function CampaignFormModal({ editingCampaignId, handleCreateCampaign, handleUpdateCampaign, newCampaignForm, savingCampaign, setEditingCampaignId, setNewCampaignForm, setShowNewCampaign }: any) {
  return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900">{editingCampaignId ? 'Editar campanha' : 'Criar nova campanha'}</h2>
                <button onClick={() => { setShowNewCampaign(false); setEditingCampaignId(null) }}><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className={lbl}>Ano *</label>
                  <input type="number" className={inp} value={newCampaignForm.year} onChange={e => setNewCampaignForm(f => ({ ...f, year: Number(e.target.value) }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Data início *</label>
                    <input type="date" className={inp} value={newCampaignForm.startDate} onChange={e => setNewCampaignForm(f => ({ ...f, startDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Data fim *</label>
                    <input type="date" className={inp} value={newCampaignForm.endDate} onChange={e => setNewCampaignForm(f => ({ ...f, endDate: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className={lbl}>Meta de novos alunos</label>
                  <input type="number" className={inp} value={newCampaignForm.targetNewStudents} onChange={e => setNewCampaignForm(f => ({ ...f, targetNewStudents: e.target.value }))} placeholder="Ex: 50" />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => { setShowNewCampaign(false); setEditingCampaignId(null) }} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">Cancelar</button>
                <button onClick={editingCampaignId ? handleUpdateCampaign : handleCreateCampaign} disabled={savingCampaign} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-orange-500 to-rose-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
                  {savingCampaign ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : (editingCampaignId ? 'Salvar alterações' : 'Criar campanha')}
                </button>
              </div>
            </div>
          </div>
  )
}
