// ─── Pipeline ─────────────────────────────────────────────────────────────
export const PIPELINE_STAGES = [
  { key: 'cadastro',    label: 'Cadastro'    },
  { key: 'contrato',    label: 'Contrato'    },
  { key: 'assinado',    label: 'Assinado'    },
  { key: 'pagamento',   label: 'Pagamento'   },
  { key: 'implantacao', label: 'Implantação' },
  { key: 'ativo',       label: 'Ativo'       },
]

export function getPipelineStep(inst: any): number {
  if (inst.plan_status === 'active') return 6
  if (inst.plan_status === 'pending_payment') return 3
  if (inst.plan_status === 'pending_contract') return 2
  if (inst.plan === 'gratuito') return 6
  return 1
}

export function PipelineBar({ inst }: { inst: any }) {
  const step = getPipelineStep(inst)
  return (
    <div className="flex items-center gap-0.5" title={`Etapa ${step}/6: ${PIPELINE_STAGES[step - 1]?.label}`}>
      {PIPELINE_STAGES.map((s, i) => (
        <div key={s.key}
          className={`h-1.5 rounded-full transition-all ${i === 0 ? 'w-4' : 'w-3'} ${
            i < step ? 'bg-cyan-500' : i === step ? 'bg-cyan-200' : 'bg-gray-100'
          }`}
          title={s.label}
        />
      ))}
      <span className="ml-1.5 text-[10px] text-gray-400 font-medium">{step}/6</span>
    </div>
  )
}

// Etapa real da implantação (onboarding_processes.current_phase), a mesma da página da escola
import { TIMELINE_PHASES } from './detailConsts'

export function getStage(inst: any, phase?: string | null): { label: string; color: string; bg: string; step?: number } {
  const idx = TIMELINE_PHASES.findIndex(p => p.id === phase)
  if (idx >= 0) {
    const ph = TIMELINE_PHASES[idx]
    return { label: ph.label, color: ph.color, bg: ph.color + '18', step: idx + 1 }
  }
  if (inst.plan === 'gratuito') return { label: 'Sem implantação', color: '#7c3aed', bg: '#f5f3ff' }
  if (inst.plan_status === 'pending_contract') return { label: 'Contrato', color: '#6366f1', bg: '#eef2ff', step: 1 }
  return { label: 'Não iniciada', color: '#9ca3af', bg: '#f3f4f6' }
}

export function StageBadge({ inst, phase }: { inst: any; phase?: string | null }) {
  const st = getStage(inst, phase)
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ color: st.color, background: st.bg }}>
      {st.label}{st.step ? <span className="opacity-60 font-medium">{st.step}/{TIMELINE_PHASES.length}</span> : null}
    </span>
  )
}
