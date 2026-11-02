// @ts-nocheck
// Trecho do detalhe da escola (InstitutionDetails). Os dados chegam por props; tipar em uma etapa futura.
import { AlertTriangle, X } from 'lucide-react'

export default function BlockedRemovalModal({ blockedRemoval, setBlockedRemoval }: any) {
  return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-600" />Não é possível remover</h2>
                <button onClick={() => setBlockedRemoval(null)}><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed mb-5">
                <strong>{blockedRemoval.user.full_name}</strong> tem{' '}
                {[
                  blockedRemoval.pendingLeads > 0 ? `${blockedRemoval.pendingLeads} lead${blockedRemoval.pendingLeads > 1 ? 's' : ''} em aberto` : null,
                  blockedRemoval.pendingConversations > 0 ? `${blockedRemoval.pendingConversations} conversa${blockedRemoval.pendingConversations > 1 ? 's' : ''} de WhatsApp em andamento` : null,
                ].filter(Boolean).join(' e ')}{' '}
                atribuído(s) a ele nesta escola. Um admin da escola precisa transferir esses leads/conversas para outro atendente (telas de Leads/WhatsApp) antes de remover este usuário.
              </p>
              <div className="flex flex-col gap-2">
                <button onClick={() => setBlockedRemoval(null)} className="py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">Entendi</button>
              </div>
            </div>
          </div>
  )
}
