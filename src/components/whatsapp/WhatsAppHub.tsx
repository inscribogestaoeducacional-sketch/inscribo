import React from 'react'
import { MessageCircle, Settings, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function WhatsAppHub() {
  return (
    <div className="flex overflow-hidden bg-gray-100" style={{ height: 'calc(100vh - 56px)' }}>

      {/* ── Col 1: Conversation List ──────────────────────────────────────── */}
      <div className="w-[272px] flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-4 py-3 bg-[#1e2d6b] flex-shrink-0">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-[#14b8a6]" />
            <span className="text-sm font-bold text-white">WhatsApp CRM</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-4 text-center">
          <p className="text-xs text-gray-400 leading-relaxed">
            Nenhuma conversa ainda.<br />Conecte a Evolution API nas Configurações.
          </p>
        </div>
      </div>

      {/* ── Center: Empty State ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5] px-8 text-center">
        {/* Config banner */}
        <div className="w-full max-w-md mb-8 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3 text-left">
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Evolution API não configurada</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Para usar o WhatsApp CRM, configure a Evolution API em{' '}
              <Link to="/settings" className="underline font-semibold hover:text-amber-900">
                Configurações
              </Link>.
            </p>
          </div>
        </div>

        <MessageCircle className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-base font-semibold text-gray-500 mb-1">Nenhuma conversa ainda</h2>
        <p className="text-sm text-gray-400 max-w-xs">
          Conecte a Evolution API nas Configurações para começar a receber e enviar mensagens pelo CRM.
        </p>

        <Link
          to="/settings"
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-[#1e2d6b] text-white text-sm font-semibold rounded-lg hover:bg-[#151b4e] transition-colors"
        >
          <Settings className="w-4 h-4" />
          Ir para Configurações
        </Link>
      </div>
    </div>
  )
}
