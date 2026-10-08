// =============================================================================
// scripts/divulgacao-artes/TelasDez.tsx
//
// Telas de dezembro que ainda não tinham espelho. Mesmas regras de TelasApp.tsx.
// Permissões — src/components/management/UserManagement.tsx (modal "Editar
// Usuário": perfil, chaves do WhatsApp e "🔒 Acesso aos Módulos", PERM_MODULES).
// =============================================================================
import React from 'react'
import { X } from 'lucide-react'
import { DemoSeal } from './TelasApp'

const d = (o: Record<string, any>) => o as any
const PERM_MODULES = [
  ['inicio', 'Início', '🏠'], ['leads', 'Leads', '👥'], ['contatos', 'Contatos', '📋'], ['visitas', 'Visitas', '📅'], ['whatsapp', 'WhatsApp', '💬'],
  ['captacao', 'Captação', '📣'], ['vitrine', 'Vitrine', '🏫'], ['transmissoes', 'Transmissões', '📨'], ['relatorios', 'Relatórios', '📊'],
  ['transferencias', 'Transferências', '↔️'], ['pesquisas', 'Pesquisas', '⭐'], ['usuarios', 'Usuários', '👤'], ['configuracoes', 'Configurações', '⚙️'],
] as const
// Atendente: só o atendimento liberado
const LIGADOS = ['inicio', 'leads', 'contatos', 'visitas', 'whatsapp']
const Toggle = ({ on }: { on: boolean }) => (
  <div style={{ width: 36, height: 20, borderRadius: 999, background: on ? '#00A896' : '#CBD5E1', flexShrink: 0, position: 'relative' }}>
    <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 16, height: 16, background: '#fff', borderRadius: '50%', display: 'block' }} />
  </div>
)
export function PermissoesUsuario({ desligaAt = 2.2 }: { desligaAt?: number }) {
  const lab: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }
  const inp: React.CSSProperties = { padding: '10px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, color: '#1A2B4A', background: '#fff' }
  return (
    <div id="shot" style={{ width: 760, background: 'rgba(15,23,42,0.6)', padding: 36 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 28, boxShadow: '0 24px 64px rgba(0,0,0,0.22)', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>Editar Usuário</h2>
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}><DemoSeal /><X size={20} color="#94A3B8" /></span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label style={lab}>Nome Completo *</label><div style={inp}>Camila Rocha</div></div>
          <div><label style={lab}>E-mail *</label><div style={{ ...inp, background: '#F8FAFC', color: '#94A3B8' }}>camila@exemplo.com</div></div>
        </div>
        <div><label style={lab}>Perfil de Acesso *</label><div style={inp}>👤 Consultor — Leads, visitas e matrículas</div></div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0' }}>
          <div style={{ marginTop: 2 }}><Toggle on={false} /></div>
          <div><p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: 0 }}>Pode ver todas as conversas do WhatsApp</p><p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>Quando ativado, este usuário enxerga todas as conversas da instituição, incluindo as atribuídas a outros atendentes.</p></div>
        </div>
        <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>🔒 Acesso aos Módulos</p>
            <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>Administradores e gestores têm acesso total.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#E2E8F0' }}>
            {PERM_MODULES.map(([id, label, icon]) => {
              const on = LIGADOS.includes(id)
              const anim = id === 'relatorios'
              const row = (en: boolean) => (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#fff', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 16 }}>{icon}</span><span style={{ fontSize: 12, fontWeight: 600, color: en ? '#1A2B4A' : '#94A3B8' }}>{label}</span></div>
                  <Toggle on={en} />
                </div>
              )
              return anim ? (
                <div key={id} {...d({ 'data-focus': desligaAt - 1 })} style={{ position: 'relative' }}>
                  <div {...d({ 'data-out': desligaAt })}>{row(true)}</div>
                  <div {...d({ 'data-in': desligaAt })} style={{ position: 'absolute', inset: 0 }}>{row(false)}</div>
                </div>
              ) : <div key={id}>{row(on)}</div>
            })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid #F1F5F9' }}>
          <span style={{ padding: '9px 20px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, color: '#64748B' }}>Cancelar</span>
          <span style={{ padding: '9px 20px', borderRadius: 10, background: '#00A896', color: '#fff', fontSize: 13, fontWeight: 600 }}>Salvar alterações</span>
        </div>
      </div>
    </div>
  )
}
