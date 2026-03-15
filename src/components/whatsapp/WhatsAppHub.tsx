import React, { useState, useEffect } from 'react'
import { MessageCircle, Settings, AlertCircle, X } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

export default function WhatsAppHub() {
  const [searchParams] = useSearchParams()
  const phoneParam = searchParams.get('phone')
  const nameParam = searchParams.get('name')

  const [bannerVisible, setBannerVisible] = useState(!!phoneParam)
  const [searchValue, setSearchValue] = useState(phoneParam || '')

  // Sync if query params change (e.g. navigating from a different card)
  useEffect(() => {
    if (phoneParam) {
      setBannerVisible(true)
      setSearchValue(phoneParam)
    }
  }, [phoneParam, nameParam])

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

        {/* Search / phone input */}
        {phoneParam && (
          <div className="px-3 pt-3 flex-shrink-0">
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Número ou nome..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#14b8a6] focus:border-[#14b8a6] outline-none"
            />
          </div>
        )}

        <div className="flex-1 flex items-center justify-center px-4 text-center">
          <p className="text-xs text-gray-400 leading-relaxed">
            Nenhuma conversa ainda.<br />Conecte a Evolution API nas Configurações.
          </p>
        </div>
      </div>

      {/* ── Center: Empty State ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5] px-8 text-center">

        {/* Incoming lead banner */}
        {bannerVisible && phoneParam && (
          <div className="w-full max-w-md mb-6 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-start gap-3 text-left">
            <MessageCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-green-800">Iniciando conversa</p>
              <p className="text-xs text-green-700 mt-0.5 truncate">
                {nameParam ? <><span className="font-semibold">{decodeURIComponent(nameParam)}</span> — </> : null}
                {phoneParam}
              </p>
            </div>
            <button
              onClick={() => setBannerVisible(false)}
              className="p-1 text-green-500 hover:text-green-700 hover:bg-green-100 rounded transition-colors flex-shrink-0"
              aria-label="Fechar banner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

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
