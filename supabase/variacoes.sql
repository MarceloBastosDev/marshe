-- Marshê Studio 3D · Variações dos produtos (tamanho, cor, acabamento...) editáveis no painel
-- Rode UMA vez no Supabase: SQL Editor > New query > cole tudo > Run.
-- Pode rodar de novo sem problema (não apaga nada).
--
-- Exemplo do que fica gravado (null = usa as variações do produtos.json):
-- [
--   {"nome": "Tamanho", "opcoes": [{"nome": "4 cm", "preco": 20}, {"nome": "7 cm", "preco": 30}]},
--   {"nome": "Cor",     "opcoes": [{"nome": "Azul"}, {"nome": "Dourado", "extra": 5}]}
-- ]
-- A 1ª característica pode ter um preço por opção; as outras podem ter um acréscimo ("extra").
-- Lista vazia [] = produto sem variações.

alter table public.precos add column if not exists variacoes jsonb;
alter table public.precos drop constraint if exists precos_variacoes_validas;
alter table public.precos add constraint precos_variacoes_validas check (
  variacoes is null or (
    jsonb_typeof(variacoes) = 'array'
    and jsonb_array_length(variacoes) <= 4
    and octet_length(variacoes::text) <= 8000
    and variacoes::text !~ '[<>]'
  )
);
