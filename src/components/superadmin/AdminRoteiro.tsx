// Super admin: libera o "Roteiro da campanha" por ano, para todas as escolas ou uma a uma.
import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'

interface Row { institution_id: string; name: string; released: boolean; done: number }

export default function AdminRoteiro() {
  const [year, setYear] = useState(new Date().getFullYear() + 1)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('roadmap_admin_list', { p_year: year })
    if (error) setErr(error.message); else { setErr(''); setRows((data ?? []) as Row[]) }
  }, [year])
  useEffect(() => { setRows(null); load() }, [load])
  const release = async (inst: string | null, on: boolean) => {
    setBusy(inst ?? 'all')
    const { error } = await supabase.rpc('roadmap_release', { p_year: year, p_inst: inst, p_on: on })
    setBusy('')
    if (error) setErr(error.message); else load()
  }
  const allOn = !!rows?.length && rows.every(r => r.released)
  return (
    <SuperAdminLayout>
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-gray-900">Roteiro da campanha</h1>
        <p className="text-sm text-gray-500 mt-1">Libere o passo a passo “Minha campanha” de um ano. A escola vê o item no menu Ajuda depois de liberado.</p>
        <div className="flex items-center gap-3 mt-5 flex-wrap">
          <label className="text-sm font-semibold text-gray-700">Ano da campanha
            <select value={year} onChange={e => setYear(Number(e.target.value))} className="ml-2 px-3 py-2 border border-gray-200 rounded-lg text-sm">
              {[0, 1, 2].map(i => { const y = new Date().getFullYear() + i; return <option key={y} value={y}>{y}</option> })}
            </select>
          </label>
          <button onClick={() => release(null, !allOn)} disabled={!rows || busy === 'all'}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50">
            {busy === 'all' ? '...' : allOn ? `Recolher ${year} de todas` : `Liberar ${year} para todas`}
          </button>
        </div>
        {err && <div className="mt-4 text-sm text-red-600">{err}</div>}
        {!rows ? <div className="mt-6 flex gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div> : (
          <div className="mt-5 bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {rows.map(r => (
              <div key={r.institution_id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0"><div className="text-sm font-semibold text-gray-900 truncate">{r.name}</div>
                  <div className="text-xs text-gray-500">{r.released ? `${r.done} etapa(s) marcadas à mão` : 'não liberado'}</div></div>
                <button onClick={() => release(r.institution_id, !r.released)} disabled={busy === r.institution_id}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${r.released ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {r.released ? 'Liberado' : 'Liberar'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </SuperAdminLayout>
  )
}
