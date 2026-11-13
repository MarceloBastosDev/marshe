// Funções em comum das páginas montadas na Vercel (página de produto e sitemap).
// O arquivo começa com "_" para a Vercel não transformá-lo em endereço.
const fs = require("fs");
const path = require("path");

const SITE = "https://www.marshe3d.com.br";
const raiz = path.join(__dirname, "..");
const ler = (arq) => fs.readFileSync(path.join(raiz, arq), "utf8");

// endereço e chave pública do Supabase saem do próprio js/config.js (um lugar só)
function configSupabase() {
  const cfg = ler("js/config.js");
  const url = (cfg.match(/supabaseUrl:\s*"([^"]+)"/) || [])[1];
  const key = (cfg.match(/supabaseAnonKey:\s*"([^"]+)"/) || [])[1];
  return url && key ? { url, key } : null;
}

// ajustes feitos no painel (preço, nome, fotos, oculto...), com tempo limite curto
async function ajustes(filtro = "") {
  const sb = configSupabase();
  if (!sb) return [];
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2500);
  try {
    const r = await fetch(`${sb.url}/rest/v1/precos?select=*${filtro}`, { headers: { apikey: sb.key, Authorization: `Bearer ${sb.key}` }, signal: ctrl.signal });
    return r.ok ? await r.json() : [];
  } catch { return []; } finally { clearTimeout(t); }
}

// avaliações aprovadas de um produto (para as estrelas no Google)
async function avaliacoes(id) {
  const sb = configSupabase();
  if (!sb) return [];
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2000);
  try {
    const r = await fetch(`${sb.url}/rest/v1/rpc/avaliacoes_publicas`, { method: "POST", headers: { apikey: sb.key, Authorization: `Bearer ${sb.key}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_produto: id }), signal: ctrl.signal });
    return r.ok ? await r.json() : [];
  } catch { return []; } finally { clearTimeout(t); }
}

// peças com "arquivado": true saem do site (continuam no arquivo para voltar quando quiser)
const catalogo = () => (JSON.parse(ler("produtos.json")).produtos || []).filter((p) => !p.arquivado);

// produto como a loja mostra: arquivo + ajustes do painel
function aplicar(p, l) {
  if (!l) return { ...p };
  const q = { ...p };
  if (l.oculto) q.oculto = true;
  q.sobConsulta = !!l.sob_consulta;
  if (l.preco != null) q.preco = +l.preco;
  if (l.preco_de != null && +l.preco_de > 0) q.precoDe = +l.preco_de; else delete q.precoDe;
  if (l.nome) q.nome = l.nome;
  if (l.descricao != null) q.descricao = l.descricao;
  if (Array.isArray(l.categorias) && l.categorias.length) q.categorias = l.categorias;
  if (Array.isArray(l.fotos) && l.fotos.length) q.fotos = l.fotos.filter((u) => typeof u === "string" && /^(https:\/\/|assets\/)/.test(u));
  if (l.ficha && typeof l.ficha === "object") q.ficha = l.ficha;
  if (Array.isArray(l.variacoes)) q._variacoesPainel = l.variacoes;
  if (l.opcoes && p.variacoes?.opcoes) q.variacoes = { ...p.variacoes, opcoes: p.variacoes.opcoes.map((o) => ({ ...o, preco: l.opcoes[o.nome] != null ? +l.opcoes[o.nome] : o.preco })) };
  return q;
}

// menor preço ("a partir de")
function menorPreco(p) {
  if (p.sobConsulta) return null;
  const g0 = p._variacoesPainel?.[0];
  if (g0 && g0.precoPorOpcao !== false && (g0.opcoes || []).some((o) => o.preco != null)) {
    const v = g0.opcoes.map((o) => +o.preco).filter((n) => n > 0);
    if (v.length) return Math.min(...v);
  }
  const ops = p.variacoes?.opcoes || [];
  if (!p._variacoesPainel && ops.length) {
    const v = ops.map((o) => +(o.preco ?? p.preco)).filter((n) => n > 0);
    if (v.length) return Math.min(...v);
  }
  return p.preco > 0 ? +p.preco : null;
}

const absoluta = (u) => (!u ? `${SITE}/assets/img/og-marshe.jpg` : /^https?:/.test(u) ? u : `${SITE}/${u.replace(/^\/+/, "")}`);
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const brl = (v) => (+v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

module.exports = { SITE, ler, ajustes, avaliacoes, catalogo, aplicar, menorPreco, absoluta, esc, brl };
