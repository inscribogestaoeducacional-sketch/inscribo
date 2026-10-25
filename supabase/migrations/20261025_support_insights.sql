-- Painel do Suporte (Super Admin): o que as pessoas perguntam, o que a assistente resolveu, o que ficou sem aula e foi para a equipe.
create or replace function public.support_insights(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d int := least(greatest(coalesce(p_days, 30), 1), 365); since timestamptz := now() - make_interval(days => d); r jsonb;
begin
  if not public.is_support_staff() then raise exception 'sem permissão' using errcode = '42501'; end if;
  with q as (
    select m.id, m.thread_id, m.created_at, m.body,
           (select n.body from support_messages n where n.thread_id = m.thread_id and n.created_at > m.created_at order by n.created_at limit 1) as reply
      from support_messages m where m.author_type = 'user' and m.created_at >= since
  ), c as (
    select q.*, case
        when q.reply like '%[[AULA:%' then 'ia'
        when q.reply like 'Não achei uma aula%' then 'sem_aula'
        when q.reply like '%assistente da Academia%' or q.reply like 'Por nada%' then 'cumprimento'
        when q.reply like 'Chamei a equipe%' or q.reply is null then 'equipe'
        else 'outro' end as resultado
      from q
  ), w as (
    select word, count(*) n from (
      select regexp_split_to_table(translate(lower(body), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '[^a-z0-9]+') word from c where resultado <> 'cumprimento'
    ) x where length(word) > 3 and word not in ('como','para','uma','com','que','quero','preciso','posso','fazer','onde','esta','esse','essa','isso','meu','minha','pode','voce','tenho','estou','nao','tambem','sobre','quando','porque','qual','quais','mais','muito','ajuda','duvida','duvidas','sistema','aqui','gostaria','fazer','consigo')
    group by word order by n desc limit 15
  ), a as (
    select substring(reply from '\[\[AULA:([^\]]+)\]\]') as aula, count(*) n from c where resultado = 'ia' group by 1 order by n desc limit 10
  )
  select jsonb_build_object(
    'dias', d,
    'conversas', (select count(*) from support_threads where created_at >= since),
    'perguntas', (select count(*) from c where resultado <> 'cumprimento'),
    'ia', (select count(*) from c where resultado = 'ia'),
    'sem_aula', (select count(*) from c where resultado = 'sem_aula'),
    'equipe', (select count(*) from support_threads where escalated_at >= since),
    'aulas', coalesce((select jsonb_agg(jsonb_build_object('aula', aula, 'n', n)) from a), '[]'::jsonb),
    'palavras', coalesce((select jsonb_agg(jsonb_build_object('palavra', word, 'n', n)) from w), '[]'::jsonb),
    'recentes', coalesce((select jsonb_agg(x order by x.at desc) from (
        select c.created_at as at, c.thread_id as thread, left(c.body, 220) as pergunta, c.resultado,
               i.name as escola, u.full_name as pessoa, t.route
          from c join support_threads t on t.id = c.thread_id
          left join institutions i on i.id = t.institution_id
          left join users u on u.id = t.user_id
         where c.resultado <> 'cumprimento' order by c.created_at desc limit 80) x), '[]'::jsonb)
  ) into r;
  return r;
end $$;
revoke all on function public.support_insights(int) from public, anon;
grant execute on function public.support_insights(int) to authenticated;
