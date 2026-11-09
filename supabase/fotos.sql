-- Marshê Studio 3D · Fotos dos produtos editáveis no painel da loja
-- Rode UMA vez no Supabase: SQL Editor > New query > cole tudo > Run.
-- Pode rodar de novo sem problema (não apaga nada).
-- Precisa do produtos-detalhes.sql já rodado antes.

-- 1) Lista de fotos de cada produto (null = usa as fotos do produtos.json)
alter table public.precos add column if not exists fotos text[];
alter table public.precos drop constraint if exists precos_fotos_validas;
alter table public.precos add constraint precos_fotos_validas check (
  fotos is null or (
    cardinality(fotos) between 1 and 12
    and array_to_string(fotos, ',') !~ '[<>"''\s]'          -- só endereços simples, sem espaços nem aspas
  )
);

-- 2) Pasta pública de imagens "produtos" (só WebP/JPEG, até 3 MB cada)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produtos', 'produtos', true, 3145728, array['image/webp', 'image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 3) Qualquer um vê as fotos; só a loja (admins) envia, troca ou apaga
drop policy if exists "produtos: loja envia fotos" on storage.objects;
drop policy if exists "produtos: loja troca fotos" on storage.objects;
drop policy if exists "produtos: loja apaga fotos" on storage.objects;
create policy "produtos: loja envia fotos" on storage.objects for insert to authenticated
  with check (bucket_id = 'produtos' and public.eh_admin());
create policy "produtos: loja troca fotos" on storage.objects for update to authenticated
  using (bucket_id = 'produtos' and public.eh_admin()) with check (bucket_id = 'produtos' and public.eh_admin());
create policy "produtos: loja apaga fotos" on storage.objects for delete to authenticated
  using (bucket_id = 'produtos' and public.eh_admin());
