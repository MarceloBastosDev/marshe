-- Marshê Studio 3D · Etiqueta personalizada dos produtos (texto e cores escolhidos no painel)
-- Rode UMA vez no Supabase: SQL Editor > New query > cole tudo > Run.
-- Pode rodar de novo sem problema (não apaga nada).
--
-- Exemplo do que fica gravado: {"texto": "LANÇAMENTO", "fundo": "#111111", "cor": "#FFFFFF", "estilo": "faixa"}
--   estilo "faixa" = faixa na parte de baixo da foto (como a da Black Marshê)
--   estilo "selo"  = selo no canto de cima da foto

alter table public.precos add column if not exists etiqueta jsonb;
alter table public.precos drop constraint if exists precos_etiqueta_valida;
alter table public.precos add constraint precos_etiqueta_valida check (
  etiqueta is null or (
    jsonb_typeof(etiqueta) = 'object'
    and char_length(coalesce(etiqueta->>'texto', '')) between 1 and 24
    and coalesce(etiqueta->>'fundo', '') ~ '^#[0-9A-Fa-f]{6}$'
    and coalesce(etiqueta->>'cor', '') ~ '^#[0-9A-Fa-f]{6}$'
    and coalesce(etiqueta->>'estilo', '') in ('faixa', 'selo')
  )
);
