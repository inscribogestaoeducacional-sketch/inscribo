import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, Building2, Plus, Save, X, Edit, Trash2, ToggleLeft, ToggleRight, Sparkles, Eye } from 'lucide-react'

interface Institution {
  id: string
  name: string
  primary_color: string
  secondary_color: string
  active: boolean
  created_at: string
}

export default function SuperAdminInstitutions() {
  const navigate = useNavigate()
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewInstitution, setShowNewInstitution] = useState(false)
  const [showEditInstitution, setShowEditInstitution] = useState(false)

  const [newInst, setNewInst] = useState({ name: '', primary_color: '#00C7B7', secondary_color: '#1A1F71' })
  const [editInst, setEditInst] = useState<Institution | null>(null)

  useEffect(() => {
    loadInstitutions()
  }, [])

  const loadInstitutions = async () => {
    try {
      const { data, error } = await supabase
        .from('institutions')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setInstitutions(data || [])
    } catch (error) {
      console.error('Erro:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateInstitution = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { error } = await supabase
        .from('institutions')
        .insert([{ ...newInst, active: true }])

      if (error) throw error
      
      alert('✅ Instituição criada!')
      setShowNewInstitution(false)
      setNewInst({ name: '', primary_color: '#00C7B7', secondary_color: '#1A1F71' })
      loadInstitutions()
    } catch (error: any) {
      alert('❌ Erro: ' + error.message)
    }
  }

  const handleUpdateInstitution = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editInst) return

    try {
      const { error } = await supabase
        .from('institutions')
        .update({
          name: editInst.name,
          primary_color: editInst.primary_color,
          secondary_color: editInst.secondary_color,
        })
        .eq('id', editInst.id)

      if (error) throw error
      
      alert('✅ Instituição atualizada!')
      setShowEditInstitution(false)
      setEditInst(null)
      loadInstitutions()
    } catch (error: any) {
      alert('❌ Erro: ' + error.message)
    }
  }

  const handleToggleInstitution = async (inst: Institution) => {
    const action = inst.active ? 'desativar' : 'ativar'
    if (!confirm(`Deseja ${action} a instituição "${inst.name}"?`)) return

    try {
      const { error } = await supabase
        .from('institutions')
        .update({ active: !inst.active })
        .eq('id', inst.id)

      if (error) throw error
      
      alert(`✅ Instituição ${inst.active ? 'desativada' : 'ativada'}!`)
      loadInstitutions()
    } catch (error: any) {
      alert('❌ Erro: ' + error.message)
    }
  }

  const handleDeleteInstitution = async (inst: Institution) => {
    if (!confirm(`⚠️ ATENÇÃO! Excluir "${inst.name}" irá remover TODOS os dados. Continuar?`)) return

    try {
      const { error } = await supabase
        .from('institutions')
        .delete()
        .eq('id', inst.id)

      if (error) throw error
      
      alert('✅ Instituição excluída!')
      loadInstitutions()
    } catch (error: any) {
      alert('❌ Erro: ' + error.message)
    }
  }

  if (loading) {
    return (
      <div className="p-8 bg-gradient-to-br from-blue-50 via-white to-indigo-50 min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    )
  }

  return (
    <div className="p-8 bg-gradient-to-br from-blue-50 via-white to-indigo-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              to="/super-admin"
              className="p-2 hover:bg-white rounded-lg transition-colors"
            >
              <ArrowLeft className="h-6 w-6 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <Sparkles className="w-8 h-8 mr-3 text-[#00D4C4]" />
                Instituições
              </h1>
              <p className="text-lg text-gray-600 mt-1">Gerenciar todas as instituições</p>
            </div>
          </div>
          <button
            onClick={() => setShowNewInstitution(true)}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl"
          >
            <Plus className="h-5 w-5" />
            <span className="font-semibold">Nova Instituição</span>
          </button>
        </div>
      </div>

      {/* Grid de Instituições */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {institutions.map((inst) => (
          <div
            key={inst.id}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-200"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{inst.name}</h3>
                  <p className="text-sm text-gray-500">
                    {new Date(inst.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                inst.active
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {inst.active ? 'Ativo' : 'Inativo'}
              </span>
            </div>

            <div className="flex items-center space-x-2 mb-4">
              <div
                className="w-8 h-8 rounded-lg border-2 border-gray-200"
                style={{ backgroundColor: inst.primary_color }}
              />
              <div
                className="w-8 h-8 rounded-lg border-2 border-gray-200"
                style={{ backgroundColor: inst.secondary_color }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => navigate(`/super-admin/institutions/${inst.id}`)}
                className="flex items-center justify-center space-x-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Eye className="h-4 w-4" />
                <span>Ver</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setEditInst(inst)
                  setShowEditInstitution(true)
                }}
                className="flex items-center justify-center space-x-1 px-3 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors text-sm font-medium"
              >
                <Edit className="h-4 w-4" />
                <span>Editar</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleToggleInstitution(inst)
                }}
                className={`flex items-center justify-center space-x-1 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
                  inst.active
                    ? 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                    : 'bg-green-50 text-green-600 hover:bg-green-100'
                }`}
              >
                {inst.active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                <span>{inst.active ? 'Desativar' : 'Ativar'}</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteInstitution(inst)
                }}
                className="flex items-center justify-center space-x-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
              >
                <Trash2 className="h-4 w-4" />
                <span>Excluir</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Nova Instituição */}
      {showNewInstitution && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Nova Instituição</h3>
              <button onClick={() => setShowNewInstitution(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateInstitution} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nome *</label>
                <input
                  type="text"
                  required
                  value={newInst.name}
                  onChange={(e) => setNewInst({ ...newInst, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="Ex: Escola Exemplo"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Cor Primária</label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={newInst.primary_color}
                    onChange={(e) => setNewInst({ ...newInst, primary_color: e.target.value })}
                    className="w-16 h-12 border-2 border-gray-300 rounded-xl cursor-pointer"
                  />
                  <input
                    type="text"
                    value={newInst.primary_color}
                    onChange={(e) => setNewInst({ ...newInst, primary_color: e.target.value })}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Cor Secundária</label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={newInst.secondary_color}
                    onChange={(e) => setNewInst({ ...newInst, secondary_color: e.target.value })}
                    className="w-16 h-12 border-2 border-gray-300 rounded-xl cursor-pointer"
                  />
                  <input
                    type="text"
                    value={newInst.secondary_color}
                    onChange={(e) => setNewInst({ ...newInst, secondary_color: e.target.value })}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl font-semibold"
              >
                <Save className="h-5 w-5" />
                <span>Criar Instituição</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Instituição */}
      {showEditInstitution && editInst && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Editar Instituição</h3>
              <button onClick={() => {
                setShowEditInstitution(false)
                setEditInst(null)
              }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateInstitution} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nome *</label>
                <input
                  type="text"
                  required
                  value={editInst.name}
                  onChange={(e) => setEditInst({ ...editInst, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Cor Primária</label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={editInst.primary_color}
                    onChange={(e) => setEditInst({ ...editInst, primary_color: e.target.value })}
                    className="w-16 h-12 border-2 border-gray-300 rounded-xl cursor-pointer"
                  />
                  <input
                    type="text"
                    value={editInst.primary_color}
                    onChange={(e) => setEditInst({ ...editInst, primary_color: e.target.value })}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Cor Secundária</label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={editInst.secondary_color}
                    onChange={(e) => setEditInst({ ...editInst, secondary_color: e.target.value })}
                    className="w-16 h-12 border-2 border-gray-300 rounded-xl cursor-pointer"
                  />
                  <input
                    type="text"
                    value={editInst.secondary_color}
                    onChange={(e) => setEditInst({ ...editInst, secondary_color: e.target.value })}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl font-semibold"
              >
                <Save className="h-5 w-5" />
                <span>Salvar Alterações</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
