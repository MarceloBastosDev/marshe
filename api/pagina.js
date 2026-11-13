// Telas do site (/, /fe, /com-seu-nome, /loja, /encomendas) montadas no servidor.
// Entrega o site.html já com os produtos e os PREÇOS ATUAIS (arquivo + painel) dentro do HTML,
// para o Google, para a prévia do WhatsApp e para IAs que leem a página sem rodar o JavaScript.
// No navegador, a loja (js/app.js) desenha os cards por cima dessa lista.
const { SITE, ler, ajustes, catalogo, aplicar, menorPreco, absoluta, esc, brl } = require("./_loja");

const DESC_INICIO = "Imagens de santos e Nossas Senhoras, e presentes com o seu nome, criados e finalizados à mão pela Marshê em Terra de Areia/RS. Encomendas e lembrancinhas para todo o Brasil.";
const TELAS = {
  "": { title: "Marshê Studio 3D · Imagens de fé e presentes com o seu nome, feitos à mão", desc: DESC_INICIO, linha: "todos" },
  fe: { title: "Fé · Imagens de santos e Nossas Senhoras · Marshê Studio 3D", desc: "Imagens de santos, Nossas Senhoras, kits e peças de devoção pintadas à mão pela Marshê em Terra de Areia/RS.", linha: "fe" },
  "com-seu-nome": { title: "Com o seu nome · Presentes personalizados · Marshê Studio 3D", desc: "Chaveiros, letreiros, luminárias e lembranças com nome, foto ou pet, feitos à mão pela Marshê em Terra de Areia/RS.", linha: "nome" },
  loja: { title: "Todos os produtos · Marshê Studio 3D", desc: DESC_INICIO, linha: "todos" },
  encomendas: { title: "Encomendas e lembrancinhas · Marshê Studio 3D", desc: "Peças criadas do zero a partir da sua ideia e lembrancinhas em quantidade para casamento, batizado, paróquia e empresa. Marshê, Terra de Areia/RS.", linha: "encomendas" }
};

// mesmas regras do js/app.js: Fé = "Religiosos"; Com o seu nome = "Personalizados"; encomendas ficam à parte
const linhasDe = (p) => p.encomenda ? [] : [
  ...((p.categorias || []).includes("Religiosos") ? ["fe"] : []),
  ...((p.categorias || []).includes("Personalizados") ? ["nome"] : [])
];
const naLinha = (p, l) => l === "encomendas" ? !!p.encomenda : l === "todos" ? linhasDe(p).length > 0 : linhasDe(p).includes(l);
const temFaixa = (p) => !!(p._variacoesPainel || p.variacoes);

function itemHtml(p) {
  const v = menorPreco(p);
  const preco = v ? `${temFaixa(p) ? "A partir de " : ""}${brl(v)}${p.precoDe && p.precoDe > v ? ` (de ${brl(p.precoDe)})` : ""}` : "Sob consulta";
  const resumo = String(p.descricao || "").replace(/\s+/g, " ").trim();
  return `<article class="card card--ssr"><div class="card__body"><h3 class="card__title"><a href="/produto/${esc(p.id)}">${esc(p.nome)}</a></h3>`
    + `<p class="card__desc">${esc(resumo)}</p><span class="card__price">${esc(preco)}</span></div></article>`;
}

module.exports = async (req, res) => {
  const chave = String((req.query && req.query.tela) || "").toLowerCase().replace(/[^a-z-]/g, "");
  const tela = TELAS[chave] ? chave : "";
  const t = TELAS[tela];
  let html = ler("site.html");

  const linhas = await ajustes("");
  const porId = new Map(linhas.map((l) => [l.produto_id, l]));
  const todos = catalogo().map((p) => aplicar(p, porId.get(p.id))).filter((p) => !p.oculto)
    .sort((a, b) => (a.destaque ?? 99) - (b.destaque ?? 99));
  const daTela = todos.filter((p) => naLinha(p, t.linha === "encomendas" ? "todos" : t.linha));
  const encomendas = todos.filter((p) => p.encomenda);

  const url = SITE + (tela ? `/${tela}` : "/");
  const troca = (re, novo) => { html = html.replace(re, novo); };
  troca(/<title>[^<]*<\/title>/, `<title>${esc(t.title)}</title>`);
  troca(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(t.desc)}">`);
  troca(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`);
  troca(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`);
  if (tela) {
    troca(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(t.title)}">`);
    troca(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(t.desc)}">`);
  }

  // lista de produtos com preço já no HTML (o JavaScript troca pelos cards da loja)
  troca(/(<div class="grid" data-grid>)(<\/div>)/, `$1${daTela.map(itemHtml).join("")}$2`);
  troca(/(<div class="grid" data-grid-enc>)(<\/div>)/, `$1${encomendas.map(itemHtml).join("")}$2`);

  // dados estruturados: lista de produtos com preço e disponibilidade
  const lista = tela === "encomendas" ? encomendas : [...daTela, ...encomendas.filter((p) => !daTela.includes(p))];
  const ld = {
    "@context": "https://schema.org", "@type": "ItemList", name: t.title, url,
    numberOfItems: lista.length,
    itemListElement: lista.map((p, i) => {
      const v = menorPreco(p);
      return {
        "@type": "ListItem", position: i + 1,
        item: {
          "@type": "Product", name: p.nome, description: String(p.descricao || "").replace(/\s+/g, " ").trim(),
          url: `${SITE}/produto/${p.id}`, image: absoluta((p.fotos || [])[0]), category: (p.categorias || []).join(", "),
          brand: { "@type": "Brand", name: "Marshê Studio 3D" },
          ...(v ? { offers: { "@type": "Offer", url: `${SITE}/produto/${p.id}`, priceCurrency: "BRL", price: v.toFixed(2), availability: "https://schema.org/MadeToOrder" } } : {})
        }
      };
    })
  };
  html = html.replace("</head>", `  <script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>\n</head>`);

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // cache curto na Vercel: preço mudado no painel aparece em poucos minutos
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
  res.end(html);
};
