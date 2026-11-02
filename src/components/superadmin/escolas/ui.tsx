import { AlertTriangle, CheckCircle2, X } from 'lucide-react'

export function Skeleton({ h = 'h-4', w = 'w-full', cls = '' }: { h?: string; w?: string; cls?: string }) {
  return <div className={`${h} ${w} ${cls} bg-gray-200 rounded animate-pulse`} />
}

// 19 tarefas padrão do processo de implantação — mesma taxonomia usada em
// InstitutionDetails.tsx (5 fases: contract/implementation/training/campaign/
// monthly). Toda escola nova já nasce com o processo criado, eliminando o

export type ToastT = { msg: string; ok: boolean }
export function ToastBar({ toast, onClose }: { toast: ToastT; onClose: () => void }) {
  return (
    <div className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold
      ${toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
      {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      {toast.msg}
      <button onClick={onClose}><X className="w-4 h-4 opacity-70 hover:opacity-100" /></button>
    </div>
  )
}

export const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all bg-white'
export const lbl = 'block text-xs font-semibold text-gray-600 mb-1.5'
