// @ts-nocheck
// Trecho do detalhe da escola (InstitutionDetails). Os dados chegam por props; tipar em uma etapa futura.
import { X, Eye, EyeOff } from 'lucide-react'
import { inp, lbl } from './ui'

export default function NewUserModal({ handleCreateUser, newUser, savingUser, setNewUser, setShowNewUser, setShowPw, showPw, user }: any) {
  return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900">Novo usuário</h2>
                <button onClick={() => setShowNewUser(false)}><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="space-y-3">
                <div><label className={lbl}>Nome completo *</label><input className={inp} value={newUser.full_name} onChange={e => setNewUser(u => ({ ...u, full_name: e.target.value }))} /></div>
                <div><label className={lbl}>E-mail *</label><input type="email" className={inp} value={newUser.email} onChange={e => setNewUser(u => ({ ...u, email: e.target.value }))} /></div>
                <div>
                  <label className={lbl}>Senha *</label>
                  <div className="relative">
                    <input type={showPw ? 'text' : 'password'} className={inp + ' pr-10'} placeholder="Mínimo 8 caracteres" value={newUser.password} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} />
                    <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                  </div>
                </div>
                <div>
                  <label className={lbl}>Perfil</label>
                  <select className={inp} value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}>
                    <option value="admin">Admin</option><option value="manager">Gerente</option><option value="user">Usuário</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowNewUser(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">Cancelar</button>
                <button onClick={handleCreateUser} disabled={savingUser} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
                  {savingUser ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Criar usuário'}
                </button>
              </div>
            </div>
          </div>
  )
}
