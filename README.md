# Marshê Studio 3D

Loja da **Marshê Studio 3D** (Terra de Areia/RS): peças e personalizados em
impressão 3D, com o pedido fechado pelo WhatsApp. Site: www.marshe3d.com.br

## Estrutura

```
index.html          loja (página única)
admin.html          painel da loja: pedidos, clientes, pontos, preços e detalhes dos produtos
privacidade.html    política de privacidade
termos.html         termos de uso
produtos.json       catálogo (nome, descrição, preço, fotos, categorias, kits)
js/config.js        configurações: WhatsApp, descontos, Black Marshê, Supabase, pontos
js/app.js           loja: catálogo, filtros, busca, carrinho e pedido
js/conta.js         conta do cliente e Pontos Marshê (Supabase)
js/admin.js         painel da loja
css/                estilos (cores da marca nas variáveis do topo de style.css)
assets/             logos, fontes, imagens e fotos dos produtos (WebP 480/960)
supabase/           SQL do banco e passo a passo (LEIA-ME.md)
```

## Como rodar

Não há build nem dependências. Para testar no computador, sirva a pasta:

```bash
python -m http.server 8000
```

e abra http://localhost:8000 (abrir o `index.html` direto não carrega o `produtos.json`).

## Manutenção

- **Preços e detalhes dos produtos:** pelo painel (`/admin.html`), na aba
  *Produtos e preços*. A loja atualiza na hora.
- **Novo produto ou novas fotos:** edite o `produtos.json` e coloque as fotos em
  `assets/produtos/` (versões `-480.webp` e `-960.webp`).
- **Banco de dados (Supabase):** veja `supabase/LEIA-ME.md`.
- **Publicação:** cada envio para a branch `main` publica sozinho na Vercel.
