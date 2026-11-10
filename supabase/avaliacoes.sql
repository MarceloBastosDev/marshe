-- Marshê Studio 3D · Avaliações com foto, desconto só no 1º pedido e pontos valendo 6 meses
-- Rode UMA vez no Supabase: SQL Editor > New query > cole tudo > Run.
-- Pode rodar de novo sem problema.

-- ---------- 1) Regras novas ----------
alter table public.regras_pontos add column if not exists bonus_avaliacao_foto int not null default 300;   -- R$ 3,00
alter table public.regras_pontos add column if not exists bonus_avaliacao_texto int not null default 100;  -- R$ 1,00
alter table public.regras_pontos add column if not exists desconto_primeiro_pct numeric(5,2) not null default 10;

-- Pontos valem 6 meses. Os créditos que ainda estão valendo também ganham os 6 meses.
update public.regras_pontos set validade_meses = 6 where id = 1 and validade_meses < 6;
update public.pontos set expira_em = criado_em + interval '6 months'
  where quantidade > 0 and restante > 0 and expira_em > now() and expira_em < criado_em + interval '6 months';

-- ---------- 2) Desconto de primeiro pedido: só se for mesmo o primeiro ----------
create or replace function public._valida_desconto() returns trigger
language plpgsql security definer set search_path = public as $$
declare pct numeric;
begin
  if coalesce(new.desconto, 0) <= 0 then return new; end if;
  if public.eh_admin() and new.user_id is distinct from auth.uid() then return new; end if;  -- lançado pela loja
  if exists (select 1 from public.pedidos where user_id = new.user_id and status <> 'cancelado') then
    raise exception 'O desconto de primeiro pedido vale só para a primeira compra';
  end if;
  select desconto_primeiro_pct into pct from public.regras_pontos where id = 1;
  if new.desconto > round(new.subtotal * coalesce(pct, 10) / 100, 2) + 0.01 then
    raise exception 'Desconto maior que o permitido';
  end if;
  return new;
end $$;
-- o nome vem depois de "valida_pedido" para rodar depois dele (que define o dono do pedido)
drop trigger if exists valida_pedido_desconto on public.pedidos;
create trigger valida_pedido_desconto before insert on public.pedidos
  for each row execute function public._valida_desconto();

-- ---------- 3) Avaliações ----------
create table if not exists public.avaliacoes (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  produto_id text not null check (char_length(produto_id) between 1 and 80),
  nota int not null check (nota between 1 and 5),
  texto text check (texto is null or char_length(texto) <= 600),
  foto text check (foto is null or (char_length(foto) <= 400 and foto ~ '^https://[^<>"'' ]+$')),
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'recusada')),
  pontos int not null default 0,
  revisado_em timestamptz,
  unique (user_id, produto_id)
);
create index if not exists avaliacoes_produto on public.avaliacoes (produto_id, status);
alter table public.avaliacoes enable row level security;
drop policy if exists "avaliacoes: ver as próprias" on public.avaliacoes;
create policy "avaliacoes: ver as próprias" on public.avaliacoes for select to authenticated using (user_id = auth.uid() or public.eh_admin());
revoke all on public.avaliacoes from anon, authenticated;
grant select on public.avaliacoes to authenticated;

-- cliente envia (ou corrige, enquanto não foi aprovada) a avaliação de um produto
create or replace function public.enviar_avaliacao(p_produto text, p_nota int, p_texto text, p_foto text)
returns text language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_status text; v_texto text := nullif(btrim(coalesce(p_texto, '')), '');
begin
  if v_uid is null then raise exception 'Entre na sua conta para avaliar'; end if;
  if not exists (select 1 from public.perfis where id = v_uid and aceite_em is not null) then raise exception 'Complete seu cadastro para avaliar'; end if;
  if p_produto is null or p_produto !~ '^[a-z0-9-]{1,80}$' then raise exception 'Produto inválido'; end if;
  if p_nota is null or p_nota < 1 or p_nota > 5 then raise exception 'Escolha de 1 a 5 estrelas'; end if;
  if v_texto is not null and char_length(v_texto) > 600 then raise exception 'O texto pode ter até 600 caracteres'; end if;
  if p_foto is not null and position('/storage/v1/object/public/avaliacoes/' || v_uid::text || '/' in p_foto) = 0 then raise exception 'Foto inválida'; end if;
  select status into v_status from public.avaliacoes where user_id = v_uid and produto_id = p_produto;
  if v_status = 'aprovada' then raise exception 'Você já avaliou este produto. Obrigado!'; end if;
  insert into public.avaliacoes (user_id, produto_id, nota, texto, foto)
  values (v_uid, p_produto, p_nota, v_texto, p_foto)
  on conflict (user_id, produto_id) do update set nota = excluded.nota, texto = excluded.texto, foto = excluded.foto, status = 'pendente', criado_em = now(), revisado_em = null;
  return 'pendente';
end $$;

-- avaliações aprovadas para mostrar na loja (só o primeiro nome de quem avaliou)
create or replace function public.avaliacoes_publicas(p_produto text default null)
returns table (id bigint, produto_id text, nota int, texto text, foto text, nome text, criado_em timestamptz)
language sql stable security definer set search_path = public as $$
  select a.id, a.produto_id, a.nota, a.texto, a.foto, split_part(coalesce(nullif(btrim(f.nome), ''), 'Cliente'), ' ', 1), a.criado_em
  from public.avaliacoes a left join public.perfis f on f.id = a.user_id
  where a.status = 'aprovada' and (p_produto is null or a.produto_id = p_produto)
  order by (a.foto is not null) desc, a.criado_em desc
  limit 500;
$$;

-- painel: lista para aprovar
create or replace function public.admin_avaliacoes(p_status text default 'pendente')
returns table (id bigint, criado_em timestamptz, produto_id text, nota int, texto text, foto text, status text, pontos int, nome text, email text, whatsapp text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eh_admin() then raise exception 'Apenas a loja pode fazer isso'; end if;
  return query
    select a.id, a.criado_em, a.produto_id, a.nota, a.texto, a.foto, a.status, a.pontos, f.nome, u.email::text, f.whatsapp
    from public.avaliacoes a join auth.users u on u.id = a.user_id left join public.perfis f on f.id = a.user_id
    where p_status is null or a.status = p_status
    order by a.criado_em desc limit 300;
end $$;

-- painel: aprovar (credita os pontos uma vez) ou recusar
create or replace function public.moderar_avaliacao(p_id bigint, p_aprovar boolean, p_produto_nome text default null)
returns int language plpgsql security definer set search_path = public as $$
declare a public.avaliacoes; v_pts int := 0; r public.regras_pontos;
begin
  if not public.eh_admin() then raise exception 'Apenas a loja pode fazer isso'; end if;
  select * into a from public.avaliacoes where id = p_id for update;
  if not found then raise exception 'Avaliação não encontrada'; end if;
  if p_aprovar then
    if a.status = 'aprovada' then return a.pontos; end if;
    select * into r from public.regras_pontos where id = 1;
    v_pts := case when a.foto is not null then coalesce(r.bonus_avaliacao_foto, 300) else coalesce(r.bonus_avaliacao_texto, 100) end;
    if a.pontos = 0 and v_pts > 0 then
      perform public._creditar(a.user_id, v_pts, null, 'Avaliação' || case when a.foto is not null then ' com foto' else '' end || ': ' || coalesce(nullif(btrim(p_produto_nome), ''), a.produto_id));
    else v_pts := a.pontos; end if;
    update public.avaliacoes set status = 'aprovada', pontos = v_pts, revisado_em = now() where id = p_id;
    return v_pts;
  end if;
  update public.avaliacoes set status = 'recusada', revisado_em = now() where id = p_id;
  return 0;
end $$;

revoke all on function public.enviar_avaliacao(text, int, text, text) from public, anon;
revoke all on function public.admin_avaliacoes(text) from public, anon;
revoke all on function public.moderar_avaliacao(bigint, boolean, text) from public, anon;
grant execute on function public.enviar_avaliacao(text, int, text, text) to authenticated;
grant execute on function public.avaliacoes_publicas(text) to anon, authenticated;
grant execute on function public.admin_avaliacoes(text) to authenticated;
grant execute on function public.moderar_avaliacao(bigint, boolean, text) to authenticated;

-- ---------- 4) Fotos das avaliações (pasta pública "avaliacoes") ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avaliacoes', 'avaliacoes', true, 3145728, array['image/webp', 'image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "avaliacoes: cliente envia foto" on storage.objects;
drop policy if exists "avaliacoes: cliente apaga a própria foto" on storage.objects;
-- cada cliente só grava na própria pasta (avaliacoes/<id da conta>/...)
create policy "avaliacoes: cliente envia foto" on storage.objects for insert to authenticated
  with check (bucket_id = 'avaliacoes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avaliacoes: cliente apaga a própria foto" on storage.objects for delete to authenticated
  using (bucket_id = 'avaliacoes' and ((storage.foldername(name))[1] = auth.uid()::text or public.eh_admin()));
