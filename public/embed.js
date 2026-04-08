;(function () {
  var SUPABASE_URL = 'https://syxxuumxkhhnoqrxporj.supabase.co'
  var ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5eHh1dW14a2hobm9xcnhwb3JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNDkyODMsImV4cCI6MjA3MzYyNTI4M30.LYR5S0DH3rsp9iWJm11gwNGoFn3s1nqwzW-JUpiHlC8'

  document.querySelectorAll('[data-aionedu-form]').forEach(function (container) {
    var institutionId = container.getAttribute('data-institution-id')
    var primaryColor = container.getAttribute('data-color') || '#00A896'
    var title = container.getAttribute('data-title') || 'Quero conhecer a escola'
    var successMsg = container.getAttribute('data-success') || 'Obrigado! Entraremos em contato em breve.'

    if (!institutionId) {
      console.warn('[Áion Edu] data-institution-id não definido no container do formulário.')
      return
    }

    var formId = 'aionedu-form-' + institutionId
    var successId = 'aionedu-success-' + institutionId

    container.innerHTML =
      '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;max-width:480px;background:#fff;border-radius:12px;padding:32px;box-shadow:0 4px 24px rgba(0,0,0,0.10);border-top:4px solid ' + primaryColor + '">' +
        '<h3 style="margin:0 0 8px;color:#1a1a1a;font-size:20px;font-weight:700">' + title + '</h3>' +
        '<p style="margin:0 0 24px;color:#666;font-size:14px">Preencha e nossa equipe entrará em contato rapidamente.</p>' +

        '<form id="' + formId + '">' +

          '<div style="margin-bottom:16px">' +
            '<label style="display:block;font-size:13px;font-weight:600;color:#333;margin-bottom:6px">Nome completo *</label>' +
            '<input name="name" required placeholder="Seu nome"' +
            ' style="width:100%;padding:10px 14px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:14px;box-sizing:border-box;outline:none" />' +
          '</div>' +

          '<div style="margin-bottom:16px">' +
            '<label style="display:block;font-size:13px;font-weight:600;color:#333;margin-bottom:6px">WhatsApp *</label>' +
            '<input name="phone" required placeholder="(83) 99999-9999"' +
            ' style="width:100%;padding:10px 14px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:14px;box-sizing:border-box;outline:none" />' +
          '</div>' +

          '<div style="margin-bottom:16px">' +
            '<label style="display:block;font-size:13px;font-weight:600;color:#333;margin-bottom:6px">E-mail</label>' +
            '<input name="email" type="email" placeholder="seu@email.com"' +
            ' style="width:100%;padding:10px 14px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:14px;box-sizing:border-box;outline:none" />' +
          '</div>' +

          '<div style="margin-bottom:24px">' +
            '<label style="display:block;font-size:13px;font-weight:600;color:#333;margin-bottom:6px">Série de interesse</label>' +
            '<select name="grade"' +
            ' style="width:100%;padding:10px 14px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:14px;box-sizing:border-box;background:#fff;outline:none">' +
              '<option value="">Selecione...</option>' +
              '<option>Infantil I</option>' +
              '<option>Infantil II</option>' +
              '<option>Infantil III</option>' +
              '<option>Infantil IV</option>' +
              '<option>Infantil V</option>' +
              '<option>1º ao 5º EF</option>' +
              '<option>6º ao 9º EF</option>' +
              '<option>Ensino Médio</option>' +
            '</select>' +
          '</div>' +

          '<button type="submit"' +
          ' style="width:100%;padding:14px;background:' + primaryColor + ';color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer">' +
            'Quero conhecer a escola →' +
          '</button>' +

          '<p style="text-align:center;font-size:11px;color:#999;margin:12px 0 0">' +
            'Seus dados estão seguros · Não enviamos spam' +
          '</p>' +
        '</form>' +

        '<div id="' + successId + '" style="display:none;text-align:center;padding:24px 0">' +
          '<div style="font-size:48px;margin-bottom:16px">✓</div>' +
          '<p style="font-size:16px;font-weight:600;color:#00523C;margin:0 0 8px">' + successMsg + '</p>' +
          '<p style="font-size:14px;color:#666;margin:0">Nossa equipe vai entrar em contato em breve pelo WhatsApp.</p>' +
        '</div>' +
      '</div>'

    document.getElementById(formId).addEventListener('submit', function (e) {
      e.preventDefault()
      var btn = e.target.querySelector('button[type="submit"]')
      btn.disabled = true
      btn.textContent = 'Enviando...'

      var data = new FormData(e.target)

      fetch(SUPABASE_URL + '/rest/v1/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': ANON_KEY,
          'Authorization': 'Bearer ' + ANON_KEY,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          institution_id: institutionId,
          name: data.get('name'),
          phone: data.get('phone'),
          email: data.get('email') || null,
          grade: data.get('grade') || null,
          source: 'embed',
          status: 'new',
          created_at: new Date().toISOString(),
        }),
      })
        .then(function (res) {
          if (res.ok || res.status === 201) {
            document.getElementById(formId).style.display = 'none'
            document.getElementById(successId).style.display = 'block'
          } else {
            btn.disabled = false
            btn.textContent = 'Quero conhecer a escola →'
            alert('Erro ao enviar. Tente novamente.')
          }
        })
        .catch(function () {
          btn.disabled = false
          btn.textContent = 'Quero conhecer a escola →'
          alert('Erro ao enviar. Verifique sua conexão e tente novamente.')
        })
    })
  })
})()
