// @ts-nocheck
// Trecho do detalhe da escola (InstitutionDetails). Os dados chegam por props; tipar em uma etapa futura.
import { X, ArrowRight } from 'lucide-react'
import { TIMELINE_PHASES } from './detailConsts'

export default function AdvancePhaseModal({ advancingPhase, confirmAdvancePhase, isTaskDone, onboardingProcess, setShowAdvanceConfirm, tasksForPhase }: any) {
          const curIdx = TIMELINE_PHASES.findIndex(p => p.id === onboardingProcess.current_phase)
          const cur = TIMELINE_PHASES[curIdx]
          const next = TIMELINE_PHASES[curIdx + 1]
          if (!cur || !next) return null
          const CurIcon = cur.icon
          const NextIcon = next.icon
          const pending = tasksForPhase(cur.id).filter(t => !isTaskDone(cur.id, t)).length
          return (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
              <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Avançar fase</h2>
                  <button onClick={() => setShowAdvanceConfirm(false)}><X className="w-5 h-5 text-gray-400" /></button>
                </div>
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: cur.color + '18' }}>
                      <CurIcon className="w-5 h-5" style={{ color: cur.color }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-500">{cur.label}</span>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: next.color }}>
                      <NextIcon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xs font-bold text-gray-900">{next.label}</span>
                  </div>
                </div>
                {pending > 0 && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4 text-center">
                    {pending} tarefa{pending > 1 ? 's' : ''} pendente{pending > 1 ? 's' : ''} na fase "{cur.label}" — dá pra avançar mesmo assim.
                  </p>
                )}
                <p className="text-sm text-gray-500 text-center mb-5">
                  A escola passará da fase <strong className="text-gray-700">{cur.label}</strong> para <strong className="text-gray-700">{next.label}</strong>.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setShowAdvanceConfirm(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">Cancelar</button>
                  <button onClick={confirmAdvancePhase} disabled={advancingPhase}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-white rounded-xl font-semibold text-sm disabled:opacity-60"
                    style={{ background: next.color }}>
                    {advancingPhase ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <>Avançar <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </div>
            </div>
          )
}
