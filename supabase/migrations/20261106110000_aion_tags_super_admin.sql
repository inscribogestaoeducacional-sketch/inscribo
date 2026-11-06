-- Caixa Áion: o Super Admin lê, cria, edita e apaga as etiquetas (a tabela tinha RLS ligado e nenhuma regra).
drop policy if exists aion_tags_super_admin on public.aion_tags;
create policy aion_tags_super_admin on public.aion_tags for all to authenticated
  using (public.is_super_admin_user()) with check (public.is_super_admin_user());
