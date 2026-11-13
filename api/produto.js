// Página própria de cada produto: /produto/<id>
// Entrega a mesma loja (index.html), mas com título, descrição, foto, preço e dados
// estruturados do produto já no HTML, para o Google e para a prévia do link no WhatsApp.
// O navegador abre a loja normalmente, com a janela do produto aberta.
const { SITE, ler, ajustes, avaliacoes, catalogo, aplicar, menorPreco, absoluta, esc, brl } = require("./_loja");

module.exports = async (req, res) => {
  const id = String((req.query && req.query.id) || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 80);
  let html = ler("index.html");
  const base = catalogo().find((p) => p.id === id);
  const [linhas, avs] = base ? await Promise.all([ajustes(`&produto_id=eq.${encodeURIComponent(id)}`), avaliacoes(id)]) : [[], []];
  const linha = linhas[0] || null;
  const p = base && aplicar(base, linha);

  if (!p || p.oculto) {
    // produto que não existe (ou escondido): mostra a loja, avisa o Google para não indexar
    html = html.replace("</head>", `  <meta name="robots" content="noindex">\n</head>`);
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=60");
    return res.end(html);
  }

  const url = `${SITE}/produto/${p.id}`;
  const preco = menorPreco(p);
  const titulo = `${p.nome} · Marshê Studio 3D`;
  const resumo = String(p.descricao || "").replace(/\s+/g, " ").trim();
  const desc = (preco ? `${p.precoDe && p.precoDe > preco ? "Oferta: " : ""}${preco !== +p.preco || p.variacoes || p._variacoesPainel ? "a partir de " : ""}${brl(preco)}. ` : "Sob consulta. ") + (resumo.length > 140 ? resumo.slice(0, 137) + "…" : resumo) + " Feito à mão pela Marshê em Terra de Areia/RS.";
  const descM = desc.charAt(0).toUpperCase() + desc.slice(1);
  const foto = absoluta((p.fotos || [])[0]);
  const fotos = (p.fotos || []).slice(0, 6).map(absoluta);
  const ld = {
    "@context": "https://schema.org", "@type": "Product",
    name: p.nome, description: resumo, url, image: fotos.length ? fotos : [foto],
    category: (p.categorias || []).join(", "), brand: { "@type": "Brand", name: "Marshê Studio 3D" },
    ...(avs.length ? { aggregateRating: { "@type": "AggregateRating", ratingValue: (avs.reduce((t, a) => t + a.nota, 0) / avs.length).toFixed(1), reviewCount: avs.length, bestRating: 5 }, review: avs.slice(0, 5).map((a) => ({ "@type": "Review", reviewRating: { "@type": "Rating", ratingValue: a.nota, bestRating: 5 }, author: { "@type": "Person", name: a.nome || "Cliente" }, ...(a.texto ? { reviewBody: a.texto } : {}), datePublished: String(a.criado_em).slice(0, 10) })) } : {}),
    ...(preco ? { offers: { "@type": "Offer", url, priceCurrency: "BRL", price: preco.toFixed(2), availability: "https://schema.org/MadeToOrder", seller: { "@type": "Organization", name: "Marshê Studio 3D" } } } : {})
  };
  const troca = (re, novo) => { html = html.replace(re, novo); };
  troca(/<title>[^<]*<\/title>/, `<title>${esc(titulo)}</title>`);
  troca(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(descM)}">`);
  troca(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`);
  troca(/<meta property="og:type" content="[^"]*">/, `<meta property="og:type" content="product">`);
  troca(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(p.nome)}">`);
  troca(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(descM)}">`);
  troca(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`);
  troca(/<meta property="og:image" content="[^"]*">\s*<meta property="og:image:width" content="[^"]*">\s*<meta property="og:image:height" content="[^"]*">/,
    `<meta property="og:image" content="${esc(foto)}">\n  <meta property="og:image:width" content="960">\n  <meta property="og:image:height" content="1200">\n  <meta property="og:image:alt" content="${esc(p.nome)}">${preco ? `\n  <meta property="product:price:amount" content="${preco.toFixed(2)}">\n  <meta property="product:price:currency" content="BRL">` : ""}`);
  troca(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${esc(p.nome)}">`);
  troca(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${esc(descM)}">`);
  troca(/<meta name="twitter:image" content="[^"]*">/, `<meta name="twitter:image" content="${esc(foto)}">`);
  html = html.replace("</head>", `  <script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>\n</head>`);
  // conteúdo do produto já no HTML (para quem lê sem JavaScript); a loja substitui pela janela do produto
  html = html.replace(/<body([^>]*)>/, `<body$1>\n  <noscript><article class="produto-ssr"><h1>${esc(p.nome)}</h1>${foto ? `<img src="${esc(foto)}" alt="${esc(p.nome)}" width="480" height="600">` : ""}<p>${esc(resumo)}</p><p><strong>${preco ? (p.variacoes || p._variacoesPainel ? "A partir de " : "") + brl(preco) : "Sob consulta"}</strong></p><p><a href="${SITE}/">Ver a loja Marshê Studio 3D</a></p></article></noscript>`);

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // cache curto na Vercel: mudanças do painel aparecem em poucos minutos
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
  res.end(html);
};
