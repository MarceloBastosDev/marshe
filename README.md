# Marshê Studio 3D

Site institucional da **Marshê Studio 3D** — Terra de Areia/RS.
Produtos e peças personalizadas em impressão 3D.

## Estrutura

```
index.html   página única, dividida em seções comentadas
styles.css   estilos (as cores da marca ficam nas variáveis do topo)
script.js    filtros por categoria, ordenação e carrossel dos destaques
assets/      logos, ícones e ilustrações
assets/Fotos Produtos/   fotos dos produtos
```

## Como rodar

Não há build nem dependências: basta abrir `index.html` no navegador.
Para servir localmente:

```bash
python -m http.server 8000
```

## Manutenção

- **Novo produto:** duplique um bloco `<article class="produto">` dentro da
  categoria desejada em `index.html` e ajuste foto, nome, descrição, preço e
  a data em `data-adicionado`.
- **Destaques:** a classe `produto-destaque` define quais peças abrem o
  carrossel.
- **Nova categoria:** copie um bloco `<div class="grupo" data-categoria="...">`
  e acrescente um botão com o mesmo `data-categoria` na lista de filtros.
- **Fotos:** proporção 4:5 (1080 × 1350), JPG com cerca de 250 KB.
- **Promoção:** o texto da faixa fica no topo do `<body>`.
