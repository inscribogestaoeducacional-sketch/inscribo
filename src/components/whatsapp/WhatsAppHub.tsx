import React, { useState, useRef, useEffect } from 'react'
import {
  Search, Send, MessageCircle, CheckCheck, Check,
  Phone, User, Tag, Calendar, GraduationCap,
  Zap, X
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string
  text: string
  time: string
  sent: boolean
  read: boolean
}

interface Contact {
  id: string
  name: string
  phone: string
  grade: string
  status: 'new' | 'contact' | 'scheduled' | 'visit' | 'proposal' | 'enrolled' | 'lost'
  temperature: 'hot' | 'warm' | 'cold' | null
  source: string
  lastMessage: string
  lastTime: string
  unread: number
  initials: string
  color: string
  messages: Message[]
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const INITIAL_CONTACTS: Contact[] = [
  {
    id: '1',
    name: 'Ana Silva',
    phone: '(11) 99999-1234',
    grade: '3º Ano EF',
    status: 'contact',
    temperature: 'hot',
    source: 'Instagram',
    lastMessage: 'Gostaria de saber mais sobre o 3º Ano EF 🙏',
    lastTime: '14:32',
    unread: 2,
    initials: 'AS',
    color: '#3b82f6',
    messages: [
      { id: 'm1', text: 'Olá, vi o anúncio da escola no Instagram!', time: '14:28', sent: false, read: true },
      { id: 'm2', text: 'Olá Ana! Seja bem-vinda! Como posso ajudar? 😊', time: '14:29', sent: true, read: true },
      { id: 'm3', text: 'Tenho um filho no 3º Ano EF, gostaria de conhecer melhor a escola', time: '14:30', sent: false, read: true },
      { id: 'm4', text: 'Gostaria de saber mais sobre o 3º Ano EF 🙏', time: '14:32', sent: false, read: false },
    ],
  },
  {
    id: '2',
    name: 'Carlos Mendes',
    phone: '(11) 98888-5678',
    grade: '1ª Série EM',
    status: 'scheduled',
    temperature: 'warm',
    source: 'Google',
    lastMessage: 'Confirmado! Estarei aí amanhã às 10h ✅',
    lastTime: '13:15',
    unread: 0,
    initials: 'CM',
    color: '#f59e0b',
    messages: [
      { id: 'm1', text: 'Queria agendar uma visita para conhecer a escola', time: '09:00', sent: false, read: true },
      { id: 'm2', text: 'Olá Carlos! Claro, temos horários disponíveis. Prefere manhã ou tarde?', time: '09:05', sent: true, read: true },
      { id: 'm3', text: 'Manhã estaria ótimo. Amanhã às 10h seria possível?', time: '09:10', sent: false, read: true },
      { id: 'm4', text: 'Perfeito! Visita agendada para amanhã às 10h. Aguardamos você! 📅', time: '09:12', sent: true, read: true },
      { id: 'm5', text: 'Confirmado! Estarei aí amanhã às 10h ✅', time: '13:15', sent: false, read: true },
    ],
  },
  {
    id: '3',
    name: 'Beatriz Alves',
    phone: '(11) 97777-9012',
    grade: 'Infantil III',
    status: 'new',
    temperature: null,
    source: 'Facebook',
    lastMessage: 'Quanto é a mensalidade do Infantil III?',
    lastTime: '11:45',
    unread: 1,
    initials: 'BA',
    color: '#8b5cf6',
    messages: [
      { id: 'm1', text: 'Quanto é a mensalidade do Infantil III?', time: '11:45', sent: false, read: false },
    ],
  },
  {
    id: '4',
    name: 'Diego Ferreira',
    phone: '(11) 96666-3456',
    grade: '6º Ano EF',
    status: 'proposal',
    temperature: 'hot',
    source: 'Indicação',
    lastMessage: 'Enviei os documentos. Podemos prosseguir?',
    lastTime: 'Ontem',
    unread: 0,
    initials: 'DF',
    color: '#ef4444',
    messages: [
      { id: 'm1', text: 'Fui indicado por um amigo cujo filho estuda aí', time: '10:00', sent: false, read: true },
      { id: 'm2', text: 'Que ótimo! Indicação é muito bem-vinda 😊 Posso ajudar?', time: '10:05', sent: true, read: true },
      { id: 'm3', text: 'Já visitei e gostei muito. Vou matricular meu filho no 6º Ano', time: '10:20', sent: false, read: true },
      { id: 'm4', text: 'Maravilha! Enviamos a proposta para seu email. Por favor verifique 📧', time: '10:25', sent: true, read: true },
      { id: 'm5', text: 'Enviei os documentos. Podemos prosseguir?', time: '16:30', sent: false, read: true },
    ],
  },
  {
    id: '5',
    name: 'Mariana Costa',
    phone: '(11) 95555-7890',
    grade: 'Infantil V',
    status: 'scheduled',
    temperature: 'warm',
    source: 'WhatsApp',
    lastMessage: 'Preciso remarcar a visita para outra data',
    lastTime: 'Ontem',
    unread: 0,
    initials: 'MC',
    color: '#14b8a6',
    messages: [
      { id: 'm1', text: 'Havia agendado uma visita para hoje mas tive um imprevisto', time: '08:00', sent: false, read: true },
      { id: 'm2', text: 'Sem problema! Quando você prefere remarcar?', time: '08:10', sent: true, read: true },
      { id: 'm3', text: 'Preciso remarcar a visita para outra data', time: '08:15', sent: false, read: true },
    ],
  },
]

const QUICK_REPLIES = [
  { id: 'q1', label: 'Boas-vindas', text: 'Olá! Seja bem-vindo(a) à nossa escola! 😊 Como posso ajudar?' },
  { id: 'q2', label: 'Agendar visita', text: 'Temos horários disponíveis para visita. Prefere manhã ou tarde?' },
  { id: 'q3', label: 'Solicitar proposta', text: 'Posso enviar nossa proposta completa para seu email. Qual seria o endereço?' },
  { id: 'q4', label: 'Confirmar visita', text: 'Visita confirmada! Aguardamos você em nossa unidade. Até lá! 📅' },
  { id: 'q5', label: 'Valores', text: 'Para informações sobre valores, qual a série de interesse do seu filho(a)?' },
  { id: 'q6', label: 'Documentos', text: 'Para a matrícula precisamos: RG, CPF, comprovante de residência e histórico escolar.' },
]

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  new:       { label: 'Novo',        bg: 'bg-gray-100',   text: 'text-gray-700'   },
  contact:   { label: 'Em Contato',  bg: 'bg-blue-100',   text: 'text-blue-700'   },
  scheduled: { label: 'Agendado',    bg: 'bg-amber-100',  text: 'text-amber-700'  },
  visit:     { label: 'Visitou',     bg: 'bg-orange-100', text: 'text-orange-700' },
  proposal:  { label: 'Proposta',    bg: 'bg-purple-100', text: 'text-purple-700' },
  enrolled:  { label: 'Matriculado', bg: 'bg-green-100',  text: 'text-green-700'  },
  lost:      { label: 'Perdido',     bg: 'bg-red-100',    text: 'text-red-700'    },
}

// ─── WhatsAppHub ──────────────────────────────────────────────────────────────
export default function WhatsAppHub() {
  const [contacts, setContacts] = useState<Contact[]>(INITIAL_CONTACTS)
  const [selected, setSelected] = useState<Contact>(INITIAL_CONTACTS[0])
  const [inputText, setInputText] = useState('')
  const [search, setSearch] = useState('')
  const [showQuickReplies, setShowQuickReplies] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selected.id, selected.messages.length])

  const handleSend = () => {
    if (!inputText.trim()) return
    const newMsg: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      sent: true,
      read: false,
    }
    const updatedContact = { ...selected, messages: [...selected.messages, newMsg], lastMessage: newMsg.text, lastTime: newMsg.time }
    setContacts(prev => prev.map(c => c.id === selected.id ? updatedContact : c))
    setSelected(updatedContact)
    setInputText('')
    setShowQuickReplies(false)
  }

  const handleSelectContact = (c: Contact) => {
    const updated = { ...c, unread: 0 }
    setSelected(updated)
    setContacts(prev => prev.map(x => x.id === c.id ? { ...x, unread: 0 } : x))
    setShowQuickReplies(false)
  }

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  )

  const totalUnread = contacts.reduce((sum, c) => sum + c.unread, 0)
  const cfg = statusConfig[selected.status]

  return (
    <div className="flex overflow-hidden bg-gray-100" style={{ height: 'calc(100vh - 60px)' }}>

      {/* ── Col 1: Conversation List ──────────────────────────────────────── */}
      <div className="w-[272px] flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 bg-[#1e2d6b] flex-shrink-0">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-[#14b8a6]" />
              <span className="text-sm font-bold text-white">WhatsApp CRM</span>
            </div>
            {totalUnread > 0 && (
              <span className="bg-[#14b8a6] text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                {totalUnread}
              </span>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/50" />
            <input
              type="text"
              placeholder="Buscar conversa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white/10 text-white placeholder-white/50 rounded-lg outline-none focus:bg-white/20 border border-white/20 transition-all"
            />
          </div>
        </div>

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.map(c => (
            <button
              key={c.id}
              onClick={() => handleSelectContact(c)}
              className={`w-full flex items-start gap-3 px-3 py-2.5 border-b border-gray-50 hover:bg-gray-50 transition-colors text-left ${
                selected.id === c.id ? 'bg-[#14b8a6]/8 border-l-[3px] border-l-[#14b8a6]' : ''
              }`}
            >
              <div
                className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: c.color }}
              >
                {c.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-semibold text-gray-900 truncate">{c.name}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0 ml-1">{c.lastTime}</span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs text-gray-500 truncate flex-1">{c.lastMessage}</p>
                  {c.unread > 0 && (
                    <span className="bg-[#14b8a6] text-white text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0">
                      {c.unread}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusConfig[c.status]?.bg} ${statusConfig[c.status]?.text}`}>
                    {statusConfig[c.status]?.label}
                  </span>
                  {c.temperature && (
                    <span className="text-xs leading-none">
                      {c.temperature === 'hot' ? '🔥' : c.temperature === 'warm' ? '☀️' : '❄️'}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Col 2: Chat Area ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-[#f0f2f5] min-w-0">
        {/* Chat header */}
        <div className="bg-white px-4 py-2.5 border-b border-gray-200 flex items-center justify-between shadow-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: selected.color }}
            >
              {selected.initials}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 leading-tight">{selected.name}</p>
              <p className="text-xs text-gray-500">{selected.phone}</p>
            </div>
          </div>
          <a
            href={`https://wa.me/55${selected.phone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg transition-colors text-xs font-semibold"
          >
            <Phone className="w-3.5 h-3.5" />
            Abrir WhatsApp
          </a>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
          {selected.messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.sent ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[72%] rounded-2xl px-3 py-2 shadow-sm text-sm leading-relaxed ${
                  msg.sent
                    ? 'bg-[#d9fdd3] text-gray-900 rounded-br-sm'
                    : 'bg-white text-gray-900 rounded-bl-sm'
                }`}
              >
                {msg.text}
                <div className={`flex items-center gap-1 mt-0.5 ${msg.sent ? 'justify-end' : 'justify-start'}`}>
                  <span className="text-xs text-gray-400 leading-none">{msg.time}</span>
                  {msg.sent && (
                    msg.read
                      ? <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                      : <Check className="w-3.5 h-3.5 text-gray-400" />
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick replies panel */}
        {showQuickReplies && (
          <div className="bg-white border-t border-gray-200 px-4 py-3 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Respostas Rápidas</p>
              <button onClick={() => setShowQuickReplies(false)} className="text-gray-400 hover:text-gray-600 p-0.5">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_REPLIES.map(r => (
                <button
                  key={r.id}
                  onClick={() => { setInputText(r.text); setShowQuickReplies(false) }}
                  className="text-left px-3 py-2 bg-gray-50 hover:bg-[#14b8a6]/10 border border-gray-200 hover:border-[#14b8a6]/30 rounded-xl transition-all"
                >
                  <p className="text-xs font-semibold text-[#1e2d6b]">{r.label}</p>
                  <p className="text-xs text-gray-500 truncate">{r.text}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="bg-white px-4 py-2.5 border-t border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQuickReplies(!showQuickReplies)}
              className={`p-2 rounded-lg transition-colors ${
                showQuickReplies
                  ? 'bg-[#14b8a6]/10 text-[#14b8a6]'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
              title="Respostas rápidas"
            >
              <Zap className="w-4 h-4" />
            </button>
            <div className="flex-1 flex items-center bg-gray-100 rounded-full px-4 py-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Escreva uma mensagem..."
                className="flex-1 bg-transparent text-sm outline-none text-gray-900 placeholder-gray-500"
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!inputText.trim()}
              className="w-9 h-9 bg-[#14b8a6] hover:bg-[#0d9488] disabled:bg-gray-300 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Col 3: Lead Panel ─────────────────────────────────────────────── */}
      <div className="w-[252px] flex-shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-y-auto">
        {/* Lead avatar + name */}
        <div className="px-4 py-4 border-b border-gray-100 text-center bg-gradient-to-b from-gray-50 to-white">
          <div
            className="w-12 h-12 rounded-full mx-auto flex items-center justify-center text-white font-bold mb-2 shadow-md text-base"
            style={{ backgroundColor: selected.color }}
          >
            {selected.initials}
          </div>
          <h3 className="text-sm font-bold text-[#1e2d6b]">{selected.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{selected.phone}</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cfg?.bg} ${cfg?.text}`}>
              {cfg?.label}
            </span>
            {selected.temperature && (
              <span className="text-sm leading-none">
                {selected.temperature === 'hot' ? '🔥' : selected.temperature === 'warm' ? '☀️' : '❄️'}
              </span>
            )}
          </div>
        </div>

        {/* Lead info */}
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">Informações</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <GraduationCap className="w-3.5 h-3.5 text-[#14b8a6] flex-shrink-0" />
              <span className="text-gray-500">Série:</span>
              <span className="font-semibold text-gray-800 truncate">{selected.grade}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Tag className="w-3.5 h-3.5 text-[#14b8a6] flex-shrink-0" />
              <span className="text-gray-500">Origem:</span>
              <span className="font-semibold text-gray-800">{selected.source}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <MessageCircle className="w-3.5 h-3.5 text-[#14b8a6] flex-shrink-0" />
              <span className="text-gray-500">Msgs:</span>
              <span className="font-semibold text-gray-800">{selected.messages.length} mensagens</span>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">Ações Rápidas</p>
          <div className="space-y-1.5">
            <a
              href={`https://wa.me/55${selected.phone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-xl transition-colors text-xs font-semibold"
            >
              <Phone className="w-3.5 h-3.5" />
              Abrir no WhatsApp
            </a>
            <button className="w-full flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-xl transition-colors text-xs font-semibold">
              <Calendar className="w-3.5 h-3.5" />
              Agendar Visita
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl transition-colors text-xs font-semibold">
              <User className="w-3.5 h-3.5" />
              Ver no Kanban
            </button>
          </div>
        </div>

        {/* Quick replies reference */}
        <div className="px-4 py-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">Respostas Rápidas</p>
          <div className="space-y-1.5">
            {QUICK_REPLIES.map(r => (
              <button
                key={r.id}
                onClick={() => setInputText(r.text)}
                className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-[#14b8a6]/10 rounded-xl transition-colors group"
              >
                <p className="text-xs font-semibold text-[#1e2d6b] group-hover:text-[#14b8a6] transition-colors">{r.label}</p>
                <p className="text-xs text-gray-400 truncate">{r.text.slice(0, 38)}…</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
