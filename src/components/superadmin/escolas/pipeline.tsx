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
