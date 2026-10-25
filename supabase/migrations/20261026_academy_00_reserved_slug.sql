-- Academia Áion Edu: /academia passa a ser rota do app, então nenhuma Vitrine pode usar esse endereço.
insert into vitrine_reserved_slugs (slug) values ('academia') on conflict do nothing;
