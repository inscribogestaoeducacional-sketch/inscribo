// src/components/superadmin/InstitutionBaseModuleTab.tsx
//
// Aba "Base de alunos" do InstitutionDetails (Super Admin): liga/desliga o
// módulo para UMA escola (base_set_module; o banco só aceita Super Admin).
// Ligado: a escola vê "Matrículas › Base de alunos" e o envio do relatório de
// alunos em Configurações → Integrações. Desligado: não vê nada.
import { useEffect, useState } from 'react'
import { Loader2, GraduationCap } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function InstitutionBaseModuleTab({ institutionId }: { institutionId: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    supabase.rpc('base_module_enabled', { p_institution_id: institutionId })
      .then(({ data, error: e }) => {
        if (!alive) return
        if (e) { setError('Não foi possível ler: ' + e.message); setEnabled(false); return }
        setEnabled(data === true)
      })
    return () => { alive = false }
  }, [institutionId])

  const toggle = async () => {
    if (enabled === null) return
    const next = !enabled
    if (!window.confirm(next
      ? 'Liberar o módulo Base de alunos para esta escola? Admin e gestor passam a ver "Matrículas › Base de alunos" e o envio do relatório de alunos.'
      : 'Desligar o módulo Base de alunos para esta escola? O menu e o envio somem; os dados já enviados ficam guardados.')) return
    setSaving(true); setError('')
    const { error: e } = await supabase.rpc('base_set_module', { p_institution_id: institutionId, p_enabled: next })
    setSaving(false)
    if (e) { setError('Não foi possível salvar: ' + e.message); return }
    setEnabled(next)
  }

  return (
    <div className="max-w-xl">
      <div className="flex items-start gap-3 p-4 rounded-xl border border-gray-200">
        <GraduationCap size={20} className="text-teal-600 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-900">Base de alunos (rematrícula)</p>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            Envio do relatório de alunos em Configurações → Integrações e o painel "Matrículas › Base de alunos".
            Atendentes só veem com a permissão "Base de alunos" ligada em Usuários.
          </p>
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </div>
        <button onClick={toggle} disabled={enabled === null || saving}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold ${enabled ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
          {enabled === null || saving ? <Loader2 size={14} className="animate-spin" /> : enabled ? 'Liberado' : 'Desligado'}
        </button>
      </div>
    </div>
  )
}
