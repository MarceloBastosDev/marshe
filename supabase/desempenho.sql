-- Marshê Studio 3D · Desempenho do site (visitas, funil, carrinhos e regiões)
-- Rode UMA vez no Supabase: SQL Editor > New query > cole tudo > Run.
-- Pode rodar de novo sem problema (não apaga nada).
--
-- O site grava eventos ANÔNIMOS (sem IP, sem dados pessoais): um código aleatório por
-- navegador ("visitante"), um por visita ("sessao"), o tipo do evento, o produto, a origem,
-- o tipo de aparelho e a cidade/estado aproximados. Se a pessoa fizer login, o evento leva
-- a conta dela (preenchida pelo banco, não pelo navegador). Só a loja lê os eventos.

create table if not exists public.eventos (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  visitante text not null check (char_length(visitante) between 6 and 40),
  sessao text not null check (char_length(sessao) between 6 and 40),
  tipo text not null check (tipo in ('visita', 'produto', 'carrinho', 'carrinho_add', 'finalizar', 'busca', 'orcamento', 'whatsapp', 'login', 'novidades')),
  produto_id text check (produto_id is null or char_length(produto_id) <= 80),
  valor numeric(10, 2) check (valor is null or (valor >= 0 and valor < 1000000)),
  dados jsonb check (dados is null or (jsonb_typeof(dados) = 'object' and octet_length(dados::text) <= 4000)),
  origem text check (origem is null or char_length(origem) <= 60),
  dispositivo text check (dispositivo is null or dispositivo in ('celular', 'tablet', 'computador')),
  cidade text check (cidade is null or char_length(cidade) <= 80),
  estado text check (estado is null or char_length(estado) <= 10),
  pais text check (pais is null or char_length(pais) <= 4),
  pagina text check (pagina is null or char_length(pagina) <= 160),
  user_id uuid
);
create index if not exists eventos_criado_em on public.eventos (criado_em desc);
create index if not exists eventos_visitante on public.eventos (visitante, criado_em desc);

-- a conta vem do login (auth.uid()), nunca do que o navegador mandar
create or replace function public._eventos_conta() returns trigger
language plpgsql security definer set search_path = public as $$
begin new.user_id := auth.uid(); new.criado_em := now(); return new; end $$;
drop trigger if exists eventos_conta on public.eventos;
create trigger eventos_conta before insert on public.eventos
  for each row execute function public._eventos_conta();

alter table public.eventos enable row level security;
drop policy if exists "eventos: site registra" on public.eventos;
drop policy if exists "eventos: loja lê" on public.eventos;
drop policy if exists "eventos: loja apaga" on public.eventos;
create policy "eventos: site registra" on public.eventos for insert to anon, authenticated with check (true);
create policy "eventos: loja lê" on public.eventos for select to authenticated using (public.eh_admin());
create policy "eventos: loja apaga" on public.eventos for delete to authenticated using (public.eh_admin());
revoke all on public.eventos from anon, authenticated;
grant insert on public.eventos to anon, authenticated;
grant select, delete on public.eventos to authenticated;

-- Limpeza opcional (guarda 12 meses): select public.limpar_eventos_antigos();
create or replace function public.limpar_eventos_antigos() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.eh_admin() then raise exception 'Apenas a loja pode fazer isso'; end if;
  delete from public.eventos where criado_em < now() - interval '12 months';
  get diagnostics n = row_count; return n;
end $$;
revoke all on function public.limpar_eventos_antigos() from public, anon;
grant execute on function public.limpar_eventos_antigos() to authenticated;
