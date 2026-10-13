// src/components/management/ErpTokenGuide.tsx
//
// "Como gerar o token" — guia genérico, alimentado por src/lib/erpGuides.ts
// (cada ERP traz o seu passo a passo e as suas permissões).
import { useState } from 'react'
import { ChevronDown, ChevronRight, Check, X, Info } from 'lucide-react'
import { guideStepText, type ErpGuide } from '../../lib/erpGuides'

export default function ErpTokenGuide({ guide, defaultOpen }: { guide: ErpGuide; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, background: '#F8FAFC', marginBottom: 16 }}>
      <button onClick={() => setOpen(!open)}
        style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', width: '100%', boxSizing: 'border-box' }}>
        {open ? <ChevronDown size={16} color="#64748B" /> : <ChevronRight size={16} color="#64748B" />}
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A' }}>Como gerar o token no {guide.name}</span>
      </button>
      {open && (
        <div style={{ padding: '0 16px 16px 38px', fontSize: 13, color: '#334155', lineHeight: 1.7 }}>
          <ol style={{ margin: '0 0 14px', paddingLeft: 18 }}>
            {guide.steps.map((s, i) => <li key={i} style={{ marginBottom: 4 }}>{guideStepText(guide, s)}</li>)}
          </ol>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#047857', marginBottom: 4 }}>Marque (só estas)</div>
              {guide.required.map(p => (
                <div key={p.key} style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Check size={14} color="#047857" /> {p.label}</div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#B91C1C', marginBottom: 4 }}>Nunca marque</div>
              {guide.never.map(n => (
                <div key={n} style={{ display: 'flex', gap: 6, alignItems: 'center' }}><X size={14} color="#B91C1C" /> {n}</div>
              ))}
            </div>
          </div>
          {guide.notes.map(n => (
            <p key={n} style={{ margin: '0 0 6px', fontSize: 12, color: '#475569', display: 'flex', gap: 6 }}>
              <Info size={14} color="#64748B" style={{ flexShrink: 0, marginTop: 3 }} /> {n}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
