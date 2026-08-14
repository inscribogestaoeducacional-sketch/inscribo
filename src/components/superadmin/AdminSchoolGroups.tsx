// src/components/superadmin/AdminSchoolGroups.tsx
// Tela Admin "Grupos Escolares" — cria/edita grupos, vincula unidades
// (institutions) existentes, configura o WhatsApp compartilhado do grupo
// (mesmo padrão de UI usado em InstitutionDetails.tsx pra WhatsApp de uma
// escola, adaptado pro nível de grupo) e o mapeamento "opção do menu do bot
// → unidade" que alimenta a resolução em api/whatsapp/webhook.ts
// (resolveOrRouteGroupSharedContact).
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import FlowEditor from '../whatsapp/FlowEditor'
import {
  Network, Plus, X, CheckCircle2, AlertTriangle, ChevronRight,
  Building2, Trash2, Wifi, WifiOff, Bot, ArrowLeft,
} from 'lucide-react'

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all bg-white'
const lbl = 'block text-xs font-semibold text-gray-600 mb-1.5'

type ToastT = { msg: string; ok: boolean }
function ToastBar({ toast, onClose }: { toast: ToastT; onClose: () => void }) {
  return (
    <div className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold
      ${toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
      {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      {toast.msg}
      <button onClick={onClose}><X className="w-4 h-4 opacity-70 hover:opacity-100" /></button>
    </div>
  )
}

interface SchoolGroup {
  id: string
  name: string
  menu_institution_map: { option_index: number; institution_id: string }[]
  created_at: string
}
interface Institution { id: string; name: string; city: string | null; school_group_id: string | null }

// ─── Lista de grupos ──────────────────────────────────────────────────────
export default function AdminSchoolGroups() {
  const { id } = useParams()
  if (id) return <SchoolGroupDetail id={id} />
  return <SchoolGroupList />
}

function SchoolGroupList() {
  const navigate = useNavigate()
  const [groups, setGroups] = useState<(SchoolGroup & { institution_count: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<ToastT | null>(null)

  const load = async () => {
    setLoading(true)
    const [{ data: grp }, { data: insts }] = await Promise.all([
      supabase.from('school_groups').select('*').order('name'),
      supabase.from('institutions').select('id, school_group_id').not('school_group_id', 'is', null),
    ])
    const counts: Record<string, number> = {}
    ;(insts || []).forEach((i: any) => { counts[i.school_group_id] = (counts[i.school_group_id] || 0) + 1 })
    setGroups(((grp as SchoolGroup[]) || []).map(g => ({ ...g, institution_count: counts[g.id] || 0 })))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const createGroup = async () => {
    if (!newName.trim()) return
    setSaving(true)
    const { data, error } = await supabase.from('school_groups')
      .insert({ name: newName.trim() }).select('id').maybeSingle()
    setSaving(false)
    if (error) { setToast({ msg: error.message, ok: false }); return }
    setShowNew(false); setNewName('')
    if (data?.id) navigate(`/super-admin/school-groups/${data.id}`)
  }

  return (
    <SuperAdminLayout>
      <div className="p-8 space-y-6">
        {toast && <ToastBar toast={toast} onClose={() => setToast(null)} />}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Grupos Escolares</h1>
            <p className="text-sm text-gray-500 mt-1">Redes de unidades com WhatsApp compartilhado opcional</p>
          </div>
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm shadow-sm hover:from-cyan-600 hover:to-blue-700">
            <Plus className="w-4 h-4" /> Novo grupo
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Grupo', 'Unidades', ''].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={3} className="px-5 py-10 text-center text-sm text-gray-400">Carregando…</td></tr>
                ) : groups.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-16 text-center">
                      <Network className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                      <p className="text-sm text-gray-400">Nenhum grupo escolar cadastrado</p>
                      <button onClick={() => setShowNew(true)} className="mt-2 text-sm text-cyan-600 font-semibold">+ Criar primeiro grupo</button>
                    </td>
                  </tr>
                ) : groups.map(g => (
                  <tr key={g.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => navigate(`/super-admin/school-groups/${g.id}`)}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-100 to-blue-100 flex items-center justify-center flex-shrink-0">
                          <Network className="w-4 h-4 text-cyan-600" />
                        </div>
                        <p className="font-semibold text-gray-900 text-sm">{g.name}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{g.institution_count} unidade{g.institution_count !== 1 ? 's' : ''}</td>
                    <td className="px-5 py-3.5 text-right"><ChevronRight className="w-4 h-4 text-gray-300 inline-block" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {showNew && (
          <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4" onClick={() => setShowNew(false)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-bold text-gray-900 mb-4">Novo grupo escolar</h2>
              <label className={lbl}>Nome do grupo</label>
              <input className={inp} placeholder="Ex: Rede Colégio Exemplo" value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
              <div className="flex items-center gap-2 mt-5">
                <button onClick={() => setShowNew(false)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button onClick={createGroup} disabled={saving || !newName.trim()}
                  className="flex-1 px-4 py-2.5 bg-cyan-600 text-white rounded-xl text-sm font-semibold hover:bg-cyan-700 disabled:opacity-50">
                  {saving ? 'Criando…' : 'Criar grupo'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  )
}

// ─── Detalhe de um grupo ──────────────────────────────────────────────────
type DetailTab = 'institutions' | 'whatsapp' | 'bot'

function SchoolGroupDetail({ id }: { id: string }) {
  const navigate = useNavigate()
  const [group, setGroup] = useState<SchoolGroup | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<DetailTab>('institutions')
  const [toast, setToast] = useState<ToastT | null>(null)

  const [memberInstitutions, setMemberInstitutions] = useState<Institution[]>([])
  const [availableInstitutions, setAvailableInstitutions] = useState<Institution[]>([])
  const [addingId, setAddingId] = useState('')

  const [waConnected, setWaConnected] = useState(false)
  const [waForm, setWaForm] = useState({ phone_id: '', phone_number: '', display_name: '', waba_id: '' })
  const [savingWa, setSavingWa] = useState(false)

  const [showFlowEditor, setShowFlowEditor] = useState(false)
  const [mapRows, setMapRows] = useState<{ option_index: number; institution_id: string }[]>([])
  const [savingMap, setSavingMap] = useState(false)

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000) }

  const loadAll = async () => {
    setLoading(true)
    const [{ data: grp }, { data: members }, { data: available }, { data: waRow }] = await Promise.all([
      supabase.from('school_groups').select('*').eq('id', id).maybeSingle(),
      supabase.from('institutions').select('id, name, city, school_group_id').eq('school_group_id', id).order('name'),
      supabase.from('institutions').select('id, name, city, school_group_id').is('school_group_id', null).order('name'),
      supabase.from('whatsapp_phone_numbers').select('*').eq('school_group_id', id).maybeSingle(),
    ])
    setGroup(grp as SchoolGroup)
    setMapRows((grp as SchoolGroup)?.menu_institution_map || [])
    setMemberInstitutions((members as Institution[]) || [])
    setAvailableInstitutions((available as Institution[]) || [])
    if (waRow) {
      setWaConnected(true)
      setWaForm({
        phone_id: waRow.phone_number_id || '', phone_number: waRow.phone_number || '',
        display_name: waRow.display_name || '', waba_id: waRow.waba_id || '',
      })
    } else {
      setWaConnected(false)
    }
    setLoading(false)
  }
  useEffect(() => { loadAll() }, [id])

  const addInstitution = async () => {
    if (!addingId) return
    const { error } = await supabase.from('institutions').update({ school_group_id: id }).eq('id', addingId)
    if (error) { showToast(error.message, false); return }
    setAddingId('')
    showToast('Unidade vinculada ao grupo!')
    loadAll()
  }

  const removeInstitution = async (instId: string) => {
    if (!confirm('Remover esta unidade do grupo? A escola continua funcionando normalmente, só deixa de fazer parte do grupo.')) return
    const { error } = await supabase.from('institutions').update({ school_group_id: null }).eq('id', instId)
    if (error) { showToast(error.message, false); return }
    showToast('Unidade removida do grupo.')
    loadAll()
  }

  const handleSaveWhatsApp = async () => {
    if (!waForm.phone_id) { showToast('Phone Number ID é obrigatório.', false); return }
    setSavingWa(true)
    try {
      const { data: settingsRows } = await supabase
        .from('platform_settings').select('key, value').in('key', ['wa_access_token', 'wa_waba_id'])
      const settingsMap: Record<string, string> = {}
      settingsRows?.forEach((r: any) => { settingsMap[r.key] = r.value })
      const globalToken = settingsMap['wa_access_token'] || ''
      if (!globalToken) throw new Error('Token de acesso não encontrado. Vá em Admin → Configurações → WhatsApp e salve o Access Token.')
      const testRes = await fetch(`https://graph.facebook.com/v19.0/${waForm.phone_id}?fields=display_phone_number,verified_name`, { headers: { Authorization: `Bearer ${globalToken}` } })
      if (!testRes.ok) { const err = await testRes.json(); throw new Error((err as any)?.error?.message || 'Phone ID inválido ou token sem permissão') }
      const testData = await testRes.json()
      const AION_WABA_ID = settingsMap['wa_waba_id'] || ''
      const effectiveWabaId = waForm.waba_id?.trim() || AION_WABA_ID

      const { error } = await supabase.from('whatsapp_phone_numbers').upsert({
        school_group_id: id,
        institution_id:  null,
        phone_number_id: waForm.phone_id,
        phone_number:    waForm.phone_number || testData.display_phone_number || '',
        display_name:    waForm.display_name || testData.verified_name || '',
        waba_id:         effectiveWabaId,
        is_active:       true,
        use_meta_api:    true,
      }, { onConflict: 'school_group_id' })
      if (error) throw error

      showToast('WhatsApp do grupo configurado e verificado!')
      loadAll()
    } catch (e: any) { showToast(e.message || 'Erro ao verificar.', false) }
    finally { setSavingWa(false) }
  }

  const addMapRow = () => setMapRows(rows => [...rows, { option_index: rows.length, institution_id: memberInstitutions[0]?.id || '' }])
  const removeMapRow = (idx: number) => setMapRows(rows => rows.filter((_, i) => i !== idx))
  const updateMapRow = (idx: number, patch: Partial<{ option_index: number; institution_id: string }>) =>
    setMapRows(rows => rows.map((r, i) => i === idx ? { ...r, ...patch } : r))

  const saveMap = async () => {
    setSavingMap(true)
    const { error } = await supabase.from('school_groups').update({ menu_institution_map: mapRows }).eq('id', id)
    setSavingMap(false)
    if (error) { showToast(error.message, false); return }
    showToast('Mapeamento salvo!')
  }

  if (loading) {
    return (
      <SuperAdminLayout>
        <div className="p-8"><p className="text-sm text-gray-400">Carregando…</p></div>
      </SuperAdminLayout>
    )
  }
  if (!group) {
    return (
      <SuperAdminLayout>
        <div className="p-8"><p className="text-sm text-gray-400">Grupo não encontrado.</p></div>
      </SuperAdminLayout>
    )
  }

  if (showFlowEditor) {
    return <FlowEditor institutionId={id} ownerType="group" onClose={() => setShowFlowEditor(false)} />
  }

  return (
    <SuperAdminLayout>
      <div className="p-8 space-y-6">
        {toast && <ToastBar toast={toast} onClose={() => setToast(null)} />}

        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/super-admin/school-groups')} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{memberInstitutions.length} unidade{memberInstitutions.length !== 1 ? 's' : ''} vinculada{memberInstitutions.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="flex gap-1 border-b border-gray-200">
          {[
            { id: 'institutions' as const, label: 'Unidades', icon: Building2 },
            { id: 'whatsapp' as const,     label: 'WhatsApp',  icon: waConnected ? Wifi : WifiOff },
            { id: 'bot' as const,          label: 'Fluxo do Bot', icon: Bot },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                tab === t.id ? 'border-cyan-500 text-cyan-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {tab === 'institutions' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className={lbl}>Vincular unidade existente</label>
                <select className={inp} value={addingId} onChange={e => setAddingId(e.target.value)}>
                  <option value="">Selecione uma escola…</option>
                  {availableInstitutions.map(i => <option key={i.id} value={i.id}>{i.name}{i.city ? ` — ${i.city}` : ''}</option>)}
                </select>
              </div>
              <button onClick={addInstitution} disabled={!addingId}
                className="px-4 py-2.5 bg-cyan-600 text-white rounded-lg text-sm font-semibold disabled:opacity-40 hover:bg-cyan-700">
                Vincular
              </button>
            </div>
            {availableInstitutions.length === 0 && (
              <p className="text-xs text-gray-400">Todas as escolas já pertencem a algum grupo.</p>
            )}

            <div className="border-t border-gray-100 pt-4 space-y-2">
              {memberInstitutions.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhuma unidade vinculada ainda.</p>
              ) : memberInstitutions.map(inst => (
                <div key={inst.id} className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-800">{inst.name}</span>
                    {inst.city && <span className="text-xs text-gray-400">{inst.city}</span>}
                  </div>
                  <button onClick={() => removeInstitution(inst.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'whatsapp' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
            <div className={`flex items-center gap-3 p-4 rounded-xl border ${waConnected ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
              {waConnected
                ? <><Wifi className="w-5 h-5 text-green-600 shrink-0" /><div><p className="text-sm font-bold text-green-700">Conectado</p><p className="text-xs text-green-600">{waForm.phone_number || waForm.display_name || ''}</p></div></>
                : <><WifiOff className="w-5 h-5 text-gray-400 shrink-0" /><div><p className="text-sm font-bold text-gray-600">Não conectado</p><p className="text-xs text-gray-400">Configure o número compartilhado do grupo abaixo.</p></div></>
              }
            </div>
            <p className="text-xs text-gray-500 -mt-2">
              Esse número é compartilhado por todas as unidades do grupo. Uma unidade só pode ter número
              próprio OU pertencer a um grupo com número compartilhado — nunca os dois ao mesmo tempo.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { k: 'phone_id',     label: 'Phone ID',     placeholder: 'ID do número (Meta)' },
                { k: 'phone_number', label: 'Telefone',     placeholder: '+55 (00) 00000-0000' },
                { k: 'display_name', label: 'Nome exibido', placeholder: 'Nome da conta WA' },
                { k: 'waba_id',      label: 'WABA ID (deixe vazio se usar o WABA da Áion)', placeholder: '2812701862456294' },
              ].map(f => (
                <div key={f.k}>
                  <label className={lbl}>{f.label}</label>
                  <input className={inp} placeholder={f.placeholder} value={(waForm as any)[f.k]}
                    onChange={e => setWaForm(p => ({ ...p, [f.k]: e.target.value }))} />
                </div>
              ))}
            </div>
            <button onClick={handleSaveWhatsApp} disabled={savingWa}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
              {savingWa ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Salvar e verificar
            </button>
          </div>
        )}

        {tab === 'bot' && (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <p className="text-sm font-semibold text-gray-700">Fluxo de boas-vindas e menu de unidade</p>
              <p className="text-xs text-gray-500">
                Monte aqui o fluxo que o contato vê antes de escolher a unidade: mensagens de boas-vindas e um
                nó de <strong>menu</strong> com uma opção por unidade. Depois de responder o menu, o mapeamento
                abaixo decide pra qual unidade a conversa vai — e a partir daí segue o fluxo normal dessa escola.
              </p>
              <button onClick={() => setShowFlowEditor(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm">
                <Bot className="w-4 h-4" /> Abrir editor de fluxo
              </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <p className="text-sm font-semibold text-gray-700">Mapeamento opção do menu → unidade</p>
              <p className="text-xs text-gray-500">
                A opção 1 do nó de menu é o índice 0, a opção 2 é o índice 1, e assim por diante — na mesma
                ordem em que as opções aparecem no nó de menu do editor de fluxo.
              </p>
              {mapRows.length === 0 && <p className="text-sm text-gray-400">Nenhum mapeamento configurado ainda.</p>}
              {mapRows.map((row, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-28">
                    <label className={lbl}>Opção</label>
                    <input type="number" min={0} className={inp} value={row.option_index}
                      onChange={e => updateMapRow(idx, { option_index: parseInt(e.target.value, 10) || 0 })} />
                  </div>
                  <div className="flex-1">
                    <label className={lbl}>Unidade</label>
                    <select className={inp} value={row.institution_id} onChange={e => updateMapRow(idx, { institution_id: e.target.value })}>
                      <option value="">Selecione…</option>
                      {memberInstitutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </div>
                  <button onClick={() => removeMapRow(idx)} className="mt-5 p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1">
                <button onClick={addMapRow} disabled={memberInstitutions.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50 disabled:opacity-40">
                  <Plus className="w-3.5 h-3.5" /> Adicionar opção
                </button>
                <button onClick={saveMap} disabled={savingMap}
                  className="flex items-center gap-1.5 px-3 py-2 bg-cyan-600 text-white rounded-lg text-xs font-semibold hover:bg-cyan-700 disabled:opacity-60">
                  {savingMap ? 'Salvando…' : 'Salvar mapeamento'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  )
}
