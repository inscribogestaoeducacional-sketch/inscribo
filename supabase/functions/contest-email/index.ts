// @ts-nocheck
// E-mails do Concurso de Bolsas (Brevo). Ações:
//  confirm  (público, logo após a inscrição)  { slug, number }
//  send     (gestor)  { contest_id, subject, body, grade?, candidate_ids?, kind? }
//  test     (gestor)  { contest_id, subject, body }  -> envia para o e-mail de quem chamou
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BREVO_KEY = Deno.env.get('BREVO_API_KEY')
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SITE = 'https://aionedu.com.br'
const FONT = `'Helvetica Neue',Helvetica,Arial,sans-serif`

const DEFAULT_CONFIRMATION = {
  subject: 'Inscrição confirmada — {{concurso}}',
  body: `Olá, {{responsavel}}!\n\nA inscrição de {{aluno}} ({{serie}}) no {{concurso}} foi recebida.\n\nNúmero de inscrição: {{numero}}\nData da prova: {{data_prova}}\nLocal: {{local}}\n\nGuarde este número: ele será pedido no dia da prova. Em breve a escola envia as demais orientações.\n\n{{escola}}`,
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const fmtDate = (d?: string | null) => d ? d.split('T')[0].split('-').reverse().join('/') : 'a definir'

function vars(c: any, k: any, school: any) {
  return {
    aluno: k.student_name, responsavel: k.responsible_name, numero: k.number, serie: k.grade, concurso: c.name,
    data_prova: fmtDate(c.exam_date), local: c.location || 'a definir', duracao: c.exam_duration || '',
    escola: school?.name || '', link: c.public_slug ? `${SITE}/bolsas/${c.public_slug}` : '',
  } as Record<string, unknown>
}
const fill = (t: string, v: Record<string, unknown>, html = false) =>
  t.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => (html ? esc(v[k] ?? '') : String(v[k] ?? '')))

function render(body: string, v: Record<string, unknown>, school: any, accent: string) {
  const paras = fill(body, v, true).split(/\n{2,}/).map(p => `<p style="font-family:${FONT};font-size:15px;line-height:1.6;color:#1E293B;margin:0 0 14px;">${p.replace(/\n/g, '<br>')}</p>`).join('')
  const logo = school?.logo_url ? `<img src="${esc(school.logo_url)}" alt="" height="44" style="display:inline-block;vertical-align:middle;margin-right:12px;background:#fff;border-radius:8px;padding:4px;">` : ''
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#EEF2F6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#EEF2F6"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td bgcolor="${accent}" style="background:${accent};border-radius:16px 16px 0 0;padding:22px 28px;font-family:${FONT};color:#fff;font-size:18px;font-weight:800;">${logo}<span style="vertical-align:middle;">${esc(school?.name || '')}</span></td></tr>
<tr><td bgcolor="#ffffff" style="background:#fff;padding:30px 28px;border:1px solid #E2E8F0;border-top:0;">${paras}</td></tr>
<tr><td bgcolor="#F8FAFC" style="background:#F8FAFC;border:1px solid #E2E8F0;border-top:0;border-radius:0 0 16px 16px;padding:14px 28px;font-family:${FONT};font-size:11.5px;color:#64748B;text-align:center;">Enviado por ${esc(school?.name || 'sua escola')} via Áion Edu</td></tr>
</table></td></tr></table></body></html>`
}

async function brevo(to: string, subject: string, html: string, senderName: string) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'api-key': BREVO_KEY! },
    body: JSON.stringify({ sender: { name: senderName, email: 'noreply@aionedu.com.br' }, to: [{ email: to }], subject, htmlContent: html, tags: ['concurso-bolsas'] }),
  })
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.message || `Brevo ${res.status}`) }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    if (!BREVO_KEY) return json(500, { error: 'BREVO_API_KEY não configurada' })
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })
    const b = await req.json().catch(() => ({}))
    const action = String(b.action ?? '')

    const loadSchool = async (id: string) => (await admin.from('institutions').select('name, logo_url, primary_color').eq('id', id).maybeSingle()).data
    const log = (row: any) => admin.from('contest_emails').insert(row)

    // ---------- confirmação automática (público) ----------
    if (action === 'confirm') {
      const slug = String(b.slug ?? ''); const number = Number(b.number)
      const { data: c } = await admin.from('contests').select('*').eq('public_slug', slug).maybeSingle()
      if (!c || !Number.isInteger(number)) return json(404, { error: 'não encontrado' })
      if (c.email_auto_confirm === false) return json(200, { skipped: 'desligado' })
      const { data: k } = await admin.from('contest_candidates').select('*').eq('contest_id', c.id).eq('number', number).maybeSingle()
      if (!k || !k.email || !EMAIL_RE.test(k.email)) return json(200, { skipped: 'sem e-mail' })
      if (Date.now() - new Date(k.created_at).getTime() > 15 * 60 * 1000) return json(200, { skipped: 'fora da janela' })
      const { data: prev } = await admin.from('contest_emails').select('id').eq('candidate_id', k.id).eq('kind', 'confirmation').eq('status', 'sent').limit(1)
      if (prev?.length) return json(200, { skipped: 'já enviado' })
      const school = await loadSchool(c.institution_id)
      const tpl = { ...DEFAULT_CONFIRMATION, ...(c.email_confirmation?.subject ? c.email_confirmation : {}) }
      const v = vars(c, k, school)
      const subject = fill(tpl.subject, v)
      try {
        await brevo(k.email, subject, render(tpl.body, v, school, c.print_color || school?.primary_color || '#05907B'), school?.name || 'Áion Edu')
        await log({ institution_id: c.institution_id, contest_id: c.id, candidate_id: k.id, kind: 'confirmation', to_email: k.email, subject, status: 'sent' })
        return json(200, { ok: true })
      } catch (e) {
        await log({ institution_id: c.institution_id, contest_id: c.id, candidate_id: k.id, kind: 'confirmation', to_email: k.email, subject, status: 'error', error: String(e.message ?? e) })
        return json(200, { ok: false })
      }
    }

    // ---------- ações do gestor ----------
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
    const { data: who } = token ? await admin.auth.getUser(token) : { data: null }
    if (!who?.user) return json(401, { error: 'Não autenticado' })
    const { data: c } = await admin.from('contests').select('*').eq('id', String(b.contest_id ?? '')).maybeSingle()
    if (!c) return json(404, { error: 'Concurso não encontrado' })
    const { data: prof } = await admin.from('users').select('user_type, role, active, institution_id, active_institution_id, email').eq('id', who.user.id).maybeSingle()
    const isSuper = prof?.user_type === 'admin_geral'
    const isMgr = !!prof && prof.active !== false && ['admin', 'manager'].includes(prof.role) && [prof.institution_id, prof.active_institution_id].includes(c.institution_id)
    if (!isSuper && !isMgr) return json(403, { error: 'Sem permissão' })
    const { data: st } = await admin.from('contest_settings').select('module_enabled').eq('institution_id', c.institution_id).maybeSingle()
    if (st?.module_enabled !== true) return json(403, { error: 'Módulo não liberado' })

    const subjectT = String(b.subject ?? '').trim(); const bodyT = String(b.body ?? '').trim()
    if (!subjectT || !bodyT) return json(400, { error: 'Preencha o assunto e a mensagem.' })
    const school = await loadSchool(c.institution_id)
    const accent = c.print_color || school?.primary_color || '#05907B'

    if (action === 'test') {
      const to = prof?.email || who.user.email
      if (!to) return json(400, { error: 'Sem e-mail para o teste' })
      const sample = { student_name: 'Nome do Aluno', responsible_name: 'Nome do Responsável', number: 1001, grade: (c.grades?.[0] ?? '6º ano') }
      const v = vars(c, sample, school)
      const subject = '[TESTE] ' + fill(subjectT, v)
      try { await brevo(to, subject, render(bodyT, v, school, accent), school?.name || 'Áion Edu') } catch (e) { return json(200, { ok: false, error: String(e.message ?? e) }) }
      await log({ institution_id: c.institution_id, contest_id: c.id, kind: 'test', to_email: to, subject, status: 'sent', sent_by: who.user.id })
      return json(200, { ok: true, to })
    }

    if (action === 'send') {
      let q = admin.from('contest_candidates').select('*').eq('contest_id', c.id).not('email', 'is', null).order('number')
      if (b.grade) q = q.eq('grade', String(b.grade))
      if (Array.isArray(b.candidate_ids) && b.candidate_ids.length) q = q.in('id', b.candidate_ids)
      const { data: list } = await q.limit(1000)
      const targets = (list ?? []).filter((k: any) => EMAIL_RE.test(k.email))
      if (!targets.length) return json(200, { sent: 0, failed: 0, total: 0 })
      let sent = 0; let failed = 0
      const rows: any[] = []
      for (let i = 0; i < targets.length; i += 8) {
        await Promise.all(targets.slice(i, i + 8).map(async (k: any) => {
          const v = vars(c, k, school); const subject = fill(subjectT, v)
          try {
            await brevo(k.email, subject, render(bodyT, v, school, accent), school?.name || 'Áion Edu'); sent++
            rows.push({ institution_id: c.institution_id, contest_id: c.id, candidate_id: k.id, kind: b.kind === 'confirmation' ? 'confirmation' : 'custom', to_email: k.email, subject, status: 'sent', sent_by: who.user.id })
          } catch (e) {
            failed++
            rows.push({ institution_id: c.institution_id, contest_id: c.id, candidate_id: k.id, kind: 'custom', to_email: k.email, subject, status: 'error', error: String(e.message ?? e), sent_by: who.user.id })
          }
        }))
      }
      await log(rows)
      return json(200, { sent, failed, total: targets.length })
    }
    return json(400, { error: 'Ação inválida' })
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : String(e) })
  }
})
