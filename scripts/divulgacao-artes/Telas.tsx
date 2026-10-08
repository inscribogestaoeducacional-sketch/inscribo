// =============================================================================
// scripts/divulgacao-artes/Telas.tsx
//
// Telas do produto usadas nas artes do calendário de divulgação
// (docs/marketing/calendario-divulgacao.md). Mesmo método das páginas de
// novidade (scripts/novidades-mockups): cada tela espelha o JSX e os estilos
// inline da tela real, com DADOS FICTÍCIOS da escola de exemplo "Colégio
// Horizonte" — nenhum dado real de escola, família ou atendente. Toda tela
// leva o selo de dados de exemplo. render.mjs fotografa o elemento #shot.
// A tela da Captação (A01) reaproveita public/novidades/img/captacao-dashboard.jpg.
// =============================================================================
import React from 'react'

const DemoSeal = () => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, border: '1.5px dashed #F9A8D4', background: '#FDF2F8', color: '#BE185D', fontSize: 11, fontWeight: 700, letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
    ⓘ Dados de exemplo · demonstração
  </span>
)

// ── Pesquisas: pesquisa aberta, aba Respostas ──────────────────────────────
// Espelha src/pages/gestor/GestorSurveys.tsx: cabeçalho da pesquisa (l.1283),
// abas (l.1370), ReenrollmentPills (l.149) e ResponsesTable (l.478), modo padrão.
const card: React.CSSProperties = { background: 'white', borderRadius: 16, padding: 24, border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#64748B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }
const BADGE = { sim: { bg: '#D1FAE5', color: '#065F46' }, nao: { bg: '#FEE2E2', color: '#991B1B' }, talvez: { bg: '#FEF3C7', color: '#92400E' } }
const bucket = (v: string) => v === 'Ainda não decidi' ? 'talvez' : v === 'Provavelmente não' || v === 'Não vou rematricular' ? 'nao' : 'sim'
const RESP = [
  { name: 'Juliana Andrade', grade: '5º ano', score: 9.2, re: 'Com certeza vou rematricular', date: '05/10/2026' },
  { name: 'Ricardo Menezes', grade: '2º ano', score: 6.4, re: 'Ainda não decidi', date: '05/10/2026' },
  { name: 'Patrícia Lopes', grade: 'Infantil 5', score: 8.8, re: 'Provavelmente sim', date: '04/10/2026' },
  { name: 'Fernando Alves', grade: '8º ano', score: 4.8, re: 'Provavelmente não', date: '04/10/2026' },
  { name: 'Camila Duarte', grade: '1º ano EM', score: 7.0, re: 'Ainda não decidi', date: '03/10/2026' },
  { name: 'Marcos Teixeira', grade: '3º ano', score: 9.6, re: 'Com certeza vou rematricular', date: '03/10/2026' },
]
export function Pesquisas({ talvez }: { talvez?: number } = {}) {
  const pills = [
    { label: 'Todos', count: 48, accent: '#00A896', active: true },
    { label: '✅ Vai renovar', count: 31, accent: '#10B981' },
    { label: '⚠️ Talvez', count: 11, accent: '#F59E0B' },
    { label: '❌ Não vai renovar', count: 6, accent: '#EF4444' },
  ]
  return (
    <div id="shot" style={{ width: 1100, padding: 24, background: '#f8f9fb' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <span style={{ padding: '8px 14px', borderRadius: 10, background: '#F1F5F9', color: '#374151', fontSize: 13, fontWeight: 600 }}>← Voltar</span>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>Pesquisa de Satisfação 2026</h1>
          <p style={{ fontSize: 13, color: '#94A3B8', margin: '2px 0 0' }}><span data-count>48</span> respostas no período selecionado</p>
        </div>
        <DemoSeal />
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #E2E8F0' }}>
        {['Visão Geral', 'Respostas', 'Relatório IA'].map(t => (
          <span key={t} style={{ padding: '10px 18px', fontSize: 13, fontWeight: 700, color: t === 'Respostas' ? '#00A896' : '#94A3B8', borderBottom: t === 'Respostas' ? '2px solid #00A896' : '2px solid transparent', marginBottom: -1 }}>{t}</span>
        ))}
      </div>
      <div data-focus={talvez != null ? String(talvez - 1) : ''} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, width: 'fit-content' }}>
        {pills.map(p => talvez != null && (p.label === 'Todos' || p.label.includes('Talvez')) ? (
          <span key={p.label} style={{ position: 'relative', display: 'inline-block' }}>
            {[p.label === 'Todos', p.label !== 'Todos'].map((on, k) => (
              <span key={k} data-out={k === 0 ? String(talvez) : undefined} data-in={k === 1 ? String(talvez) : undefined} style={{ ...(k === 1 ? { position: 'absolute', inset: 0 } : { display: 'inline-block' }), padding: '7px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', border: `1.5px solid ${p.accent}`, background: on ? p.accent : 'transparent', color: on ? 'white' : p.accent }}>{p.label} ({p.count})</span>
            ))}
          </span>
        ) : (
          <span key={p.label} style={{ padding: '7px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', border: `1.5px solid ${p.accent}`, background: p.active ? p.accent : 'transparent', color: p.active ? 'white' : p.accent }}>
            {p.label} (<span data-count>{p.count}</span>)
          </span>
        ))}
      </div>
      <div style={card}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', marginBottom: 16, marginTop: 0 }}>Respostas individuais (48)</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              <th style={{ width: 28, borderBottom: '1px solid #E2E8F0' }} />
              {['Nome', 'Série', 'Nota geral', 'Rematrícula', 'Data', ''].map((h, i) => <th key={i} style={th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {RESP.map(r => {
              const sc = r.score >= 8 ? '#10B981' : r.score >= 6 ? '#F59E0B' : '#EF4444'
              const b = BADGE[bucket(r.re)]
              return (
                <tr key={r.name} data-row data-collapse data-out={talvez != null && bucket(r.re) !== 'talvez' ? String(talvez) : undefined} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '10px 14px', color: '#CBD5E1' }}>▸</td>
                  <td style={{ padding: '10px 14px', color: '#1A2B4A', fontWeight: 500 }}>{r.name}</td>
                  <td style={{ padding: '10px 14px', color: '#64748B' }}>{r.grade}</td>
                  <td style={{ padding: '10px 14px' }}><span style={{ fontWeight: 700, color: sc }}>{r.score.toFixed(1)}</span></td>
                  <td style={{ padding: '10px 14px' }}><span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: b.bg, color: b.color, whiteSpace: 'nowrap' }}>{r.re}</span></td>
                  <td style={{ padding: '10px 14px', color: '#94A3B8', whiteSpace: 'nowrap' }}>{r.date}</td>
                  <td style={{ padding: '10px 14px' }}><span style={{ padding: '4px 10px', borderRadius: 8, background: '#EFF6FF', color: '#3B82F6', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>Ver em Contatos</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Robô: WhatsApp da família, fora do horário ─────────────────────────────
// Visão do celular da família (não é tela do painel). O robô do fluxo
// (FlowEditor → blocos Pergunta e Transferir) pergunta o nome do aluno e a
// série e passa a conversa pra equipe. Textos do robô são de exemplo: cada
// escola escreve os seus no editor.
const Ticks = () => (
  <svg width="14" height="10" viewBox="0 0 16 11" fill="none" stroke="#53BDEB" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M1 6l3 3 6-7" /><path d="M6 9l1 1 7-8" /></svg>
)
const hora = (t: string, out?: boolean) => (
  <span style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4, fontSize: 13, color: '#667781', marginTop: 3 }}>{t}{out && <Ticks />}</span>
)
export function Robo() {
  const bubble: React.CSSProperties = { borderRadius: 12, padding: '10px 13px 6px', fontSize: 19, lineHeight: 1.42, color: '#111B21', boxShadow: '0 1px 1px rgba(0,0,0,.1)', maxWidth: '84%' }
  const fam = (t: string, h: string) => <div data-msg style={{ ...bubble, alignSelf: 'flex-end', background: '#D9FDD3' }}>{t}{hora(h, true)}</div>
  const bot = (t: string, h: string) => <div data-msg style={{ ...bubble, alignSelf: 'flex-start', background: '#fff' }}>{t}{hora(h)}</div>
  return (
    <div id="shot" style={{ width: 430, background: 'transparent' }}>
      <div style={{ background: '#111', borderRadius: 54, padding: 13 }}>
        <div style={{ borderRadius: 42, overflow: 'hidden', background: '#EFEAE2', height: 900, display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: '#fff', padding: '14px 26px 0', display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, color: '#111' }}>
            <span>21:48</span><span style={{ width: 110, height: 30, background: '#111', borderRadius: 20, marginTop: -6 }} /><span>5G ▮</span>
          </div>
          <div style={{ background: '#fff', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #E9EDEF' }}>
            <span style={{ fontSize: 22, color: '#54656F' }}>‹</span>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#0F766E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15 }}>CH</div>
            <div>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#111B21' }}>Colégio Horizonte</p>
              <p style={{ margin: 0, fontSize: 13, color: '#667781' }}>Conta comercial</p>
            </div>
          </div>
          <div style={{ flex: 1, padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ alignSelf: 'flex-end', fontSize: 13, fontWeight: 700, color: '#BE185D', background: '#FDF2F8', border: '1.5px dashed #F9A8D4', borderRadius: 999, padding: '3px 10px' }}>Ilustração · dados de exemplo</span>
            <span style={{ alignSelf: 'center', background: '#fff', color: '#54656F', fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 8, boxShadow: '0 1px 1px rgba(0,0,0,.08)' }}>SÁBADO</span>
            {fam('Boa noite! Ainda tem vaga para 2027?', '21:47')}
            {bot('Olá! 👋 Aqui é o atendimento do Colégio Horizonte. Já vou adiantar seu atendimento. Qual o nome do aluno?', '21:47')}
            {fam('Pedro Henrique', '21:47')}
            {bot('E qual a série em 2027?', '21:47')}
            {fam('3º ano', '21:48')}
            {bot('Pronto! Sua conversa já está com a nossa equipe de matrículas. 🙂', '21:48')}
          </div>
          <div style={{ background: '#F0F2F5', padding: '10px 14px 24px', display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ flex: 1, background: '#fff', borderRadius: 22, padding: '11px 16px', fontSize: 15, color: '#8696A0' }}>Mensagem</div>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#00A884' }} />
          </div>
        </div>
      </div>
    </div>
  )
}
