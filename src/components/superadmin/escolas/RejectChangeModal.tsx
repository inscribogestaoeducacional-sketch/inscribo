// @ts-nocheck
// Trecho do detalhe da escola (InstitutionDetails). Os dados chegam por props; tipar em uma etapa futura.
import { X } from 'lucide-react'
import { inp, lbl } from './ui'

export default function RejectChangeModal({ handleRejectChangeRequest, rejectReason, rejectingRequest, reviewingRequestId, setRejectReason, setRejectingRequest }: any) {
  return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Rejeitar ajuste</h2>
                <button onClick={() => { setRejectingRequest(null); setRejectReason('') }}><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <label className={lbl}>Motivo (opcional — visível para o gestor)</label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
                placeholder="Ex: meta de novatos muito alta pro período, revise e reenvie."
                className={inp}
              />
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => { setRejectingRequest(null); setRejectReason('') }} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button
                  onClick={handleRejectChangeRequest}
                  disabled={reviewingRequestId === rejectingRequest.id}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold disabled:opacity-60"
                >
                  {reviewingRequestId === rejectingRequest.id ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <X className="w-3.5 h-3.5" />}
                  Rejeitar solicitação
                </button>
              </div>
            </div>
          </div>
  )
}
