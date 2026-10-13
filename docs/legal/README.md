# Aditivo de Proteção de Dados (LGPD) — publicação de versão

O aceite na tela (Configurações → Integrações → "Aditivo de proteção de dados (LGPD)")
só funciona para uma versão **publicada**. Publicar a v1 (ou uma versão nova):

1. Salvar o texto final aprovado pelo jurídico em `public/legal/aditivo-lgpd-v1.md`
   (Markdown simples: `#` títulos, `-` listas, tabelas com `|`, `**negrito**`).
   O `.gitattributes` mantém os bytes exatos (`-text`).
2. Conferir o resumo de 5 linhas em `src/lib/lgpdAddendum.ts` (`LGPD_SUMMARY`) contra o texto final.
3. Mergear no main e esperar o deploy da Vercel.
4. Calcular o SHA-256 **do arquivo servido** (não do local):
   `curl -s https://<domínio>/legal/aditivo-lgpd-v1.md | sha256sum`
5. Com ok, publicar no banco:
   `INSERT INTO lgpd_text_versions (version, text_sha256, notes) VALUES ('v1', '<sha256>', 'texto final aprovado em <data>');`

Versão publicada não se edita: texto novo = versão nova (`v2`), e as escolas aceitam de novo
(o aceite antigo continua no registro `lgpd_acceptances`).

A minuta de 12/10 (com campos entre colchetes) **não** é a v1.
