import React, { useState, useEffect } from 'react'
import { Copy, Check, Code2, Globe, ExternalLink } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

export default function GestorEmbed() {
  const { user } = useAuth()
  const institutionId = user?.institution_id ?? ''

  const [color, setColor] = useState('#00A896')
  const [title, setTitle] = useState('Quero conhecer a escola')
  const [success, setSuccess] = useState('Obrigado! Entraremos em contato em breve.')
  const [copied, setCopied] = useState(false)

  const [stats, setStats] = useState({ total: 0, thisMonth: 0, lastLeadDays: null as number | null })

  useEffect(() => {
    if (!institutionId) return
    async function fetchStats() {
      const now = new Date()
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const [{ count: total }, { count: thisMonth }, { data: last }] = await Promise.all([
        supabase.from('leads').select('id', { count: 'exact', head: true })
          .eq('institution_id', institutionId).eq('source', 'embed'),
        supabase.from('leads').select('id', { count: 'exact', head: true })
          .eq('institution_id', institutionId).eq('source', 'embed')
          .gte('created_at', firstOfMonth),
        supabase.from('leads').select('created_at')
          .eq('institution_id', institutionId).eq('source', 'embed')
          .order('created_at', { ascending: false }).limit(1),
      ])

      let lastLeadDays: number | null = null
      if (last && last.length > 0) {
        const diff = Date.now() - new Date(last[0].created_at).getTime()
        lastLeadDays = Math.floor(diff / (1000 * 60 * 60 * 24))
      }

      setStats({ total: total ?? 0, thisMonth: thisMonth ?? 0, lastLeadDays })
    }
    fetchStats()
  }, [institutionId])

  const embedCode = `<!-- Áion Edu — Formulário de Captação -->
<div
  data-aionedu-form
  data-institution-id="${institutionId}"
  data-color="${color}"
  data-title="${title}"
  data-success="${success}">
</div>
<script src="https://aionedu.com.br/embed.js"><\/script>`

  function handleCopy() {
    navigator.clipboard.writeText(embedCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  // Preview inline (same render logic as embed.js)
  const previewStyle = {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    maxWidth: 480,
    background: '#fff',
    borderRadius: 12,
    padding: 28,
    boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
    borderTop: `4px solid ${color}`,
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb',
    borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none',
    color: '#111',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 6,
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#E6F7F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Code2 size={18} color="#00A896" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A2B4A' }}>Formulário de captação para seu site</h1>
        </div>
        <p style={{ fontSize: 14, color: '#64748B', marginLeft: 46 }}>
          Cole o código abaixo em qualquer página do site da escola. Os leads entram direto no CRM da Áion Edu.
        </p>
      </div>

      {/* Estatísticas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Leads via site', value: stats.total, color: '#00A896', bg: '#E6F7F5' },
          { label: 'Este mês', value: stats.thisMonth, color: '#6366F1', bg: '#EDE9FE' },
          {
            label: 'Último lead',
            value: stats.lastLeadDays === null ? '—' : stats.lastLeadDays === 0 ? 'Hoje' : `${stats.lastLeadDays}d atrás`,
            color: '#F59E0B', bg: '#FEF3C7',
          },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: '18px 20px' }}>
            <p style={{ fontSize: 26, fontWeight: 800, color: s.color, marginBottom: 2 }}>{s.value}</p>
            <p style={{ fontSize: 13, color: '#64748B' }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
        {/* Lado esquerdo: personalização + código */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Personalização */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', marginBottom: 18 }}>Personalização</h2>

            <div style={{ marginBottom: 14 }}>
              <label style={{ ...labelStyle, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#475569' }}>Cor principal</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input type="color" value={color} onChange={e => setColor(e.target.value)}
                  style={{ width: 44, height: 38, borderRadius: 8, border: '1.5px solid #E2E8F0', cursor: 'pointer', padding: 2 }} />
                <input type="text" value={color} onChange={e => setColor(e.target.value)}
                  style={{ ...inputStyle, width: 120, padding: '9px 12px' }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  {['#00A896', '#00523C', '#6366F1', '#F59E0B', '#EF4444'].map(c => (
                    <button key={c} onClick={() => setColor(c)}
                      style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: color === c ? '2px solid #1A2B4A' : '2px solid transparent', cursor: 'pointer' }} />
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ ...labelStyle, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#475569' }}>Título do formulário</label>
              <input style={inputStyle} value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Quero conhecer a escola" />
            </div>

            <div>
              <label style={{ ...labelStyle, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#475569' }}>Mensagem de sucesso</label>
              <input style={inputStyle} value={success} onChange={e => setSuccess(e.target.value)}
                placeholder="Obrigado! Entraremos em contato em breve." />
            </div>
          </div>

          {/* Código */}
          <div style={{ background: '#0F172A', borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Code2 size={14} color="#94A3B8" />
                <span style={{ fontSize: 13, color: '#94A3B8', fontWeight: 600 }}>Código para copiar</span>
              </div>
              <button onClick={handleCopy} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: copied ? '#059669' : '#1E293B',
                color: copied ? '#fff' : '#94A3B8',
                border: `1px solid ${copied ? '#059669' : '#334155'}`,
                borderRadius: 7, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                transition: 'all .2s',
              }}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Copiado!' : 'Copiar código'}
              </button>
            </div>
            <pre style={{
              margin: 0, fontSize: 12, color: '#E2E8F0', lineHeight: 1.7,
              fontFamily: '"Fira Code", "Cascadia Code", Consolas, monospace',
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              <span style={{ color: '#64748B' }}>{`<!-- Áion Edu — Formulário de Captação -->`}</span>{'\n'}
              <span style={{ color: '#93C5FD' }}>{`<div`}</span>{'\n'}
              {'  '}<span style={{ color: '#86EFAC' }}>data-aionedu-form</span>{'\n'}
              {'  '}<span style={{ color: '#86EFAC' }}>data-institution-id</span>=<span style={{ color: '#FDE68A' }}>{`"${institutionId}"`}</span>{'\n'}
              {'  '}<span style={{ color: '#86EFAC' }}>data-color</span>=<span style={{ color: '#FDE68A' }}>{`"${color}"`}</span>{'\n'}
              {'  '}<span style={{ color: '#86EFAC' }}>data-title</span>=<span style={{ color: '#FDE68A' }}>{`"${title}"`}</span>{'\n'}
              {'  '}<span style={{ color: '#86EFAC' }}>data-success</span>=<span style={{ color: '#FDE68A' }}>{`"${success}"`}</span>{`>`}{'\n'}
              <span style={{ color: '#93C5FD' }}>{`</div>`}</span>{'\n'}
              <span style={{ color: '#93C5FD' }}>{`<script`}</span> <span style={{ color: '#86EFAC' }}>src</span>=<span style={{ color: '#FDE68A' }}>"https://aionedu.com.br/embed.js"</span><span style={{ color: '#93C5FD' }}>{`></script>`}</span>
            </pre>
          </div>

          {/* Como usar */}
          <div style={{ background: '#F0FDF9', borderRadius: 14, border: '1px solid #A7F3D0', padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#065F46', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
              <Globe size={15} /> Como usar
            </h3>
            <ol style={{ paddingLeft: 18, margin: 0 }}>
              {[
                'Copie o código acima',
                'Cole no HTML da página do site onde quer o formulário (ex: página de contato)',
                'O formulário aparece automaticamente com o visual configurado',
                'Leads chegam direto no seu CRM com a tag "Via site"',
              ].map((step, i) => (
                <li key={i} style={{ fontSize: 13, color: '#065F46', lineHeight: 1.7, marginBottom: 4 }}>{step}</li>
              ))}
            </ol>
            <a href="https://aionedu.com.br/embed.js" target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 10, fontSize: 12, color: '#00A896', textDecoration: 'none', fontWeight: 600 }}>
              <ExternalLink size={12} /> Ver embed.js
            </a>
          </div>
        </div>

        {/* Preview ao vivo */}
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', marginBottom: 16 }}>
            Preview ao vivo
          </h2>
          <div style={previewStyle}>
            <h3 style={{ margin: '0 0 8px', color: '#1a1a1a', fontSize: 20, fontWeight: 700 }}>{title || 'Quero conhecer a escola'}</h3>
            <p style={{ margin: '0 0 24px', color: '#666', fontSize: 14 }}>Preencha e nossa equipe entrará em contato rapidamente.</p>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Nome completo *</label>
              <input readOnly placeholder="Seu nome" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>WhatsApp *</label>
              <input readOnly placeholder="(83) 99999-9999" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>E-mail</label>
              <input readOnly placeholder="seu@email.com" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Série de interesse</label>
              <select disabled style={{ ...inputStyle, background: '#fff', color: '#999' }}>
                <option>Selecione...</option>
              </select>
            </div>
            <button disabled style={{
              width: '100%', padding: 14, background: color, color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'not-allowed',
            }}>
              Quero conhecer a escola →
            </button>
            <p style={{ textAlign: 'center', fontSize: 11, color: '#999', margin: '12px 0 0' }}>
              Seus dados estão seguros · Não enviamos spam
            </p>
          </div>
          <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 10 }}>
            * Preview não-interativo. O formulário real funciona quando incorporado no site.
          </p>
        </div>
      </div>
    </div>
  )
}
