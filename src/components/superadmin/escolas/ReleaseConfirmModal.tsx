// @ts-nocheck
// Confirmação antes de liberar uma campanha: mostra escola, ano, datas sugeridas e o que a escola recebe.
import { X, Megaphone } from 'lucide-react'
import { fmtDate } from './format'

export default function ReleaseConfirmModal({ schoolName, year, startDate, endDate, busy, onConfirm, onClose }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Liberar campanha {year}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{schoolName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 space-y-2 text-sm text-orange-900">
          <div className="flex justify-between gap-3"><span className="text-orange-700">Ano letivo</span><span className="font-semibold">{year}</span></div>
          <div className="flex justify-between gap-3"><span className="text-orange-700">Período sugerido</span><span className="font-semibold">{fmtDate(startDate)} a {fmtDate(endDate)}</span></div>
        </div>
        <p className="text-sm text-gray-500 mt-4">
          A escola recebe o aviso no sistema e confere a meta sugerida na página Campanha de Matrículas. O gestor acerta as datas e ativa. Você não precisa preencher meta aqui.
        </p>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">Cancelar</button>
          <button onClick={onConfirm} disabled={busy} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-orange-500 to-rose-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
            {busy ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Megaphone className="w-4 h-4" />} Liberar campanha
          </button>
        </div>
      </div>
    </div>
  )
}
