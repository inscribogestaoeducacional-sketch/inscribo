// Saídas que a Activesoft já marcou (transferido/cancelado) e ainda não têm registro em Transferências.
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Row { student_id: string; name: string; registration: string | null; grade: string | null; status: string; changed_at: string | null; registered: boolean }

export default function SaidasActivesoft({ institutionId, onRegister }: { institutionId: string; onRegister: (name: string, grade: string) => void }) {
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    let alive = true
    supabase.rpc('transfers_erp_gap', { p_inst: institutionId, p_year: year }).then(({ data, error }) => { if (alive) setRows(error ? [] : ((data ?? []) as Row[])) })
    return () => { alive = false }
  }, [institutionId, year])
  if (rows == null || (rows.length === 0 && year === thisYear)) return null
  const missing = rows.filter(r => !r.registered)
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '14px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b' }}>Saídas na Activesoft em {year}: {rows.length}</div>
          <div style={{ fontSize: 12.5, color: '#64748b' }}>{missing.length > 0 ? `${missing.length} ainda sem registro aqui. Registre para a escola entender o motivo.` : 'Todas já têm registro aqui.'}</div>
        </div>
        <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}>
          {[thisYear, thisYear - 1, thisYear - 2].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {rows.length > 0 && <button onClick={() => setOpen(o => !o)} style={{ padding: '7px 14px', borderRadius: 9, border: '1px solid #e2e8f0', background: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{open ? 'Ocultar' : 'Ver lista'}</button>}
      </div>
      {open && (
        <div style={{ marginTop: 12, maxHeight: 320, overflowY: 'auto' }}>
          {rows.map(r => (
            <div key={r.student_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid #f1f5f9', fontSize: 13 }}>
              <div style={{ flex: 1 }}><b>{r.name}</b>{r.registration ? ` · ${r.registration}` : ''}<div style={{ color: '#94a3b8', fontSize: 12 }}>{r.grade ?? 'sem série'} · {r.status === 'cancelado' ? 'cancelado' : 'transferido'}{r.changed_at ? ` em ${new Date(r.changed_at).toLocaleDateString('pt-BR')}` : ''}</div></div>
              {r.registered
                ? <span style={{ padding: '3px 10px', borderRadius: 99, background: '#DCFCE7', color: '#15803D', fontSize: 11.5, fontWeight: 700 }}>Já registrado</span>
                : <button onClick={() => onRegister(r.name, r.grade ?? '')} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#1e2d6b', color: '#fff', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>Registrar</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
