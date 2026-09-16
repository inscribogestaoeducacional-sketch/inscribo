// @ts-nocheck
// Função TEMPORÁRIA de teste — dispara 1 e-mail direto pra API da Brevo com
// payload fixo, pra validar o webhook de delivered/opened (api/brevo/webhook.ts).
// Lê BREVO_API_KEY dos secrets do Supabase (nunca retorna nem loga o valor).
// Apagar após o teste: `supabase functions delete test-brevo-email`.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const BREVO_KEY = Deno.env.get('BREVO_API_KEY')

serve(async () => {
  try {
    if (!BREVO_KEY) throw new Error('BREVO_API_KEY não configurada nos secrets do Supabase')

    const brevoBody = {
      sender: { name: 'Aion Edu', email: 'noreply@aionedu.com.br' },
      to: [{ email: 'victor.patos52@gmail.com' }],
      subject: 'Teste de webhook Brevo - Áion Edu',
      textContent: 'Este é um e-mail de teste para confirmar o funcionamento do webhook.',
      tags: ['teste_webhook'],
    }

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_KEY,
      },
      body: JSON.stringify(brevoBody),
    })

    const resBody = await res.json()

    return new Response(JSON.stringify({ status: res.status, ok: res.ok, brevoResponse: resBody }), {
      status: res.ok ? 200 : 500,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
