-- Marshê Studio 3D · Ficha técnica dos produtos (medidas, material, cores...) editável no painel
-- Rode UMA vez no Supabase: SQL Editor > New query > cole tudo > Run.
-- Pode rodar de novo sem problema (não apaga nada).
--
-- Exemplo: {"medidas": "12 cm de altura", "material": "PLA", "cores": "Branco, dourado", "acabamento": "Pintado", "outros": "Acompanha base"}

alter table public.precos add column if not exists ficha jsonb;
alter table public.precos drop constraint if exists precos_ficha_valida;
alter table public.precos add constraint precos_ficha_valida check (
  ficha is null or (jsonb_typeof(ficha) = 'object' and octet_length(ficha::text) <= 2000 and ficha::text !~ '[<>]')
);
