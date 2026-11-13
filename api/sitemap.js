// Sitemap automático: início, telas das linhas e de encomendas, páginas legais e todos os produtos visíveis
const { SITE, ajustes, catalogo } = require("./_loja");

module.exports = async (req, res) => {
  const linhas = await ajustes("");
  const porId = new Map(linhas.map((l) => [l.produto_id, l]));
  const dia = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
  const urls = [
    { loc: `${SITE}/`, freq: "weekly", pri: "1.0" },
    { loc: `${SITE}/fe`, freq: "weekly", pri: "0.9" },
    { loc: `${SITE}/com-seu-nome`, freq: "weekly", pri: "0.9" },
    { loc: `${SITE}/encomendas`, freq: "monthly", pri: "0.8" },
    { loc: `${SITE}/loja`, freq: "weekly", pri: "0.7" },
    ...catalogo().filter((p) => !porId.get(p.id)?.oculto).map((p) => ({ loc: `${SITE}/produto/${p.id}`, mod: dia(porId.get(p.id)?.atualizado_em) || p.adicionado || null, freq: "weekly", pri: "0.8" })),
    { loc: `${SITE}/privacidade.html`, pri: "0.2" },
    { loc: `${SITE}/termos.html`, pri: "0.2" },
    { loc: `${SITE}/trocas.html`, pri: "0.3" }
  ];
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.end(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u.loc}</loc>${u.mod ? `<lastmod>${u.mod}</lastmod>` : ""}${u.freq ? `<changefreq>${u.freq}</changefreq>` : ""}<priority>${u.pri}</priority></url>`).join("\n")}\n</urlset>\n`);
};
