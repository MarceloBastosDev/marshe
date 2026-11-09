/* Painel da loja · aba Desempenho
   Visitas, funil de compra, oportunidades de venda (carrinhos por fechar, interessados,
   buscas sem resultado), produtos, origem, regiões, aparelhos, horários e visitantes.
   Os dados vêm da tabela "eventos" (supabase/desempenho.sql) + pedidos e clientes. */

const PERIODOS = [["hoje", "Hoje"], ["7", "7 dias"], ["30", "30 dias"], ["mes", "Este mês"], ["90", "90 dias"]];
const ORIGEM_NOME = { instagram: "Instagram", facebook: "Facebook", whatsapp: "WhatsApp", google: "Google", tiktok: "TikTok", youtube: "YouTube", direto: "Direto (digitou o endereço ou favorito)", "indicação": "Indicação (Indique e ganhe)", "outras buscas": "Outras buscas" };
const ABANDONO_MIN = 30;   // carrinho parado há mais de 30 minutos = "por fechar"
let periodo = "7";
let cache = null;
let produtosJson = null;

const dia = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
function intervalo(p) {
  const agora = new Date();
  let ini;
  if (p === "hoje") ini = dia(agora);
  else if (p === "mes") ini = new Date(agora.getFullYear(), agora.getMonth(), 1);
  else ini = new Date(dia(agora).getTime() - (Number(p) - 1) * 864e5);
  const dur = agora - ini;
  return { ini, fim: agora, iniAnt: new Date(ini.getTime() - dur), dur };
}
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const pctTxt = (a, b) => pct(a, b).toLocaleString("pt-BR") + "%";
const num = (n) => (n || 0).toLocaleString("pt-BR");
const relativo = (d) => {
  const m = Math.round((Date.now() - new Date(d)) / 6e4);
  if (m < 1) return "agora"; if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `há ${h} h`;
  const dd = Math.round(h / 24); return dd === 1 ? "ontem" : `há ${dd} dias`;
};

async function todosEventos(sb, ok, desde, ate) {
  const lista = [];
  for (let i = 0; i < 40; i++) {   // até 40 mil eventos por período
    const lote = ok(await sb.from("eventos").select("*").gte("criado_em", desde.toISOString()).lt("criado_em", ate.toISOString()).order("criado_em", { ascending: true }).range(i * 1000, i * 1000 + 999));
    lista.push(...lote);
    if (lote.length < 1000) break;
  }
  return lista;
}

async function carregar(ctx) {
  const { sb, ok } = ctx;
  const iv = intervalo(periodo);
  const [eventos, anteriores, identidades, clientes, pedidos, catalogo] = await Promise.all([
    todosEventos(sb, ok, iv.ini, iv.fim),
    // período anterior: só o necessário para comparar
    sb.from("eventos").select("visitante,sessao,tipo,valor").gte("criado_em", iv.iniAnt.toISOString()).lt("criado_em", iv.ini.toISOString()).limit(20000).then(ok),
    // quem se identificou em algum momento (login, pedido, novidades, orçamento) - qualquer data
    sb.from("eventos").select("visitante,user_id,tipo,dados,criado_em").in("tipo", ["login", "finalizar", "novidades", "orcamento"]).order("criado_em", { ascending: false }).limit(5000).then(ok),
    sb.rpc("admin_clientes", { p_busca: "" }).then(ok).catch(() => []),
    sb.rpc("admin_pedidos", { p_status: null }).then(ok).catch(() => []),
    produtosJson || fetch("produtos.json", { cache: "no-cache" }).then((r) => r.json()).then((j) => (produtosJson = j.produtos || []))
  ]);
  // tira da contagem as visitas da própria loja (conta da loja e este aparelho)
  const eu = (await sb.auth.getSession()).data.session?.user?.id;
  const fora = new Set([...identidades, ...eventos].filter((e) => eu && e.user_id === eu).map((e) => e.visitante));
  try { const vid = localStorage.getItem("marshe:vid"); if (vid) fora.add(vid); } catch {}
  const sem = (l) => l.filter((e) => !fora.has(e.visitante));
  return { iv, eventos: sem(eventos), anteriores: sem(anteriores), identidades: sem(identidades), clientes, pedidos, catalogo: produtosJson || catalogo };
}

// quem é cada visitante: conta (login) > nome digitado ao finalizar/novidades/orçamento > anônimo
function identificar(d) {
  const porUser = new Map(d.clientes.map((c) => [c.user_id, c]));
  const quem = new Map();
  const dar = (v, info) => { const q = quem.get(v) || {}; quem.set(v, { ...info, ...q, ...(info.cliente ? { cliente: info.cliente, nome: info.cliente.nome || q.nome || info.nome } : {}) }); };
  [...d.identidades, ...d.eventos].forEach((e) => {
    if (e.user_id && porUser.get(e.user_id)) dar(e.visitante, { cliente: porUser.get(e.user_id) });
    else if (e.dados?.nome && ["finalizar", "novidades", "orcamento"].includes(e.tipo)) { const q = quem.get(e.visitante); if (!q?.nome) dar(e.visitante, { nome: e.dados.nome, cidadeInformada: e.dados.cidade || null }); }
  });
  return quem;
}

function calcular(d) {
  const ev = d.eventos;
  const nomeProd = new Map(d.catalogo.map((p) => [p.id, p.nome]));
  const quem = identificar(d);
  const uniq = (arr) => new Set(arr).size;
  const vis = (tipo) => new Set(ev.filter((e) => e.tipo === tipo).map((e) => e.visitante));
  const visitantes = new Set(ev.map((e) => e.visitante));
  const sessoes = new Map();
  ev.forEach((e) => { if (!sessoes.has(e.sessao)) sessoes.set(e.sessao, e); });
  const finalizar = ev.filter((e) => e.tipo === "finalizar");
  const noPeriodo = (x) => new Date(x.criado_em) >= d.iv.ini;
  const pedidosP = d.pedidos.filter(noPeriodo);
  const confirmados = pedidosP.filter((p) => ["confirmado", "entregue"].includes(p.status));
  const cadastros = d.clientes.filter(noPeriodo);
  const ant = d.anteriores;
  const antFinal = ant.filter((e) => e.tipo === "finalizar");

  // visitas por dia
  const dias = [];
  for (let t = dia(d.iv.ini).getTime(); t <= dia(d.iv.fim).getTime(); t += 864e5) dias.push({ t, visitas: 0, visitantes: new Set() });
  const porDia = new Map(dias.map((x) => [x.t, x]));
  sessoes.forEach((e) => { const x = porDia.get(dia(e.criado_em).getTime()); if (x) x.visitas++; });
  ev.forEach((e) => porDia.get(dia(e.criado_em).getTime())?.visitantes.add(e.visitante));
  // horários e dias da semana (pelas visitas)
  const horas = Array(24).fill(0), semana = Array(7).fill(0);
  sessoes.forEach((e) => { const t = new Date(e.criado_em); horas[t.getHours()]++; semana[t.getDay()]++; });

  const contar = (lista, chave) => { const m = new Map(); lista.forEach((x) => { const k = chave(x); if (k) m.set(k, (m.get(k) || 0) + 1); }); return [...m].sort((a, b) => b[1] - a[1]); };
  const sess = [...sessoes.values()];
  const origens = contar(sess, (e) => e.origem || "direto");
  const estados = contar(sess, (e) => (e.estado ? `${e.estado}${e.pais && e.pais !== "BR" ? " · " + e.pais : ""}` : null));
  const cidades = contar(sess, (e) => (e.cidade ? `${e.cidade}${e.estado ? "/" + e.estado : ""}` : null));
  const semRegiao = sess.filter((e) => !e.cidade && !e.estado).length;
  const aparelhos = contar(sess, (e) => e.dispositivo || "computador");

  // produtos
  const prod = new Map();
  const P = (id) => { if (!prod.has(id)) prod.set(id, { id, nome: nomeProd.get(id) || id, vistos: new Set(), views: 0, add: new Set(), fin: 0, orc: 0 }); return prod.get(id); };
  ev.forEach((e) => {
    if (e.tipo === "produto" && e.produto_id) { const p = P(e.produto_id); p.views++; p.vistos.add(e.visitante); }
    if (e.tipo === "carrinho_add" && e.produto_id) P(e.produto_id).add.add(e.visitante);
    if (e.tipo === "orcamento" && e.produto_id) P(e.produto_id).orc++;
    if (e.tipo === "finalizar") (e.dados?.produtos || []).forEach((id) => P(id).fin++);
  });
  const produtos = [...prod.values()].sort((a, b) => b.vistos.size - a.vistos.size || b.views - a.views);

  // buscas
  const buscas = ev.filter((e) => e.tipo === "busca" && e.dados?.termo);
  const termo = (e) => e.dados.termo.toLowerCase().trim();
  const buscasTop = contar(buscas, termo).slice(0, 12);
  const buscasZero = contar(buscas.filter((e) => e.dados.resultados === 0), termo).slice(0, 12);

  // por visitante
  const porV = new Map();
  ev.forEach((e) => { if (!porV.has(e.visitante)) porV.set(e.visitante, []); porV.get(e.visitante).push(e); });
  const perfilV = (v) => {
    const lista = porV.get(v) || [];
    const ult = lista.at(-1), pri = lista[0];
    const geo = lista.find((e) => e.cidade || e.estado) || {};
    const q = quem.get(v) || {};
    return {
      v, lista, ult, pri, q,
      nome: q.nome || null, cliente: q.cliente || null,
      whatsapp: q.cliente?.whatsapp || null,
      local: geo.cidade ? `${geo.cidade}${geo.estado ? "/" + geo.estado : ""}` : geo.estado || q.cidadeInformada || null,
      origem: pri?.origem || "direto", dispositivo: pri?.dispositivo || "",
      visitas: uniq(lista.map((e) => e.sessao)),
      vistos: [...new Set(lista.filter((e) => e.tipo === "produto").map((e) => e.produto_id))],
      finalizou: lista.some((e) => e.tipo === "finalizar")
    };
  };

  // oportunidades: carrinhos por fechar (último retrato com itens, sem finalizar depois, parado há 30+ min)
  const carrinhos = [];
  porV.forEach((lista, v) => {
    const rets = lista.filter((e) => e.tipo === "carrinho");
    const ret = rets.at(-1);
    if (!ret || !(ret.dados?.itens?.length)) return;
    const fin = lista.filter((e) => e.tipo === "finalizar").at(-1);
    if (fin && new Date(fin.criado_em) >= new Date(ret.criado_em)) return;
    const ultimo = lista.at(-1);
    if (Date.now() - new Date(ultimo.criado_em) < ABANDONO_MIN * 6e4) return;
    carrinhos.push({ ...perfilV(v), itens: ret.dados.itens, total: Number(ret.valor) || 0, quando: ultimo.criado_em });
  });
  carrinhos.sort((a, b) => (b.whatsapp ? 1 : 0) - (a.whatsapp ? 1 : 0) || b.total - a.total);

  // pedidos enviados pelo WhatsApp sem conta (não aparecem na aba Pedidos)
  const semConta = finalizar.filter((e) => !e.dados?.logado).map((e) => ({ ...perfilV(e.visitante), e })).reverse();

  // interessados: viram 3+ vezes o mesmo produto, ou 5+ produtos, ou pediram orçamento - e não finalizaram
  const interessados = [];
  porV.forEach((lista, v) => {
    const p = perfilV(v);
    if (p.finalizou || carrinhos.some((c) => c.v === v)) return;
    const vezes = contar(lista.filter((e) => e.tipo === "produto"), (e) => e.produto_id);
    const orc = lista.filter((e) => e.tipo === "orcamento");
    const motivo = orc.length ? `pediu orçamento${orc[0].produto_id ? ": " + (nomeProd.get(orc[0].produto_id) || orc[0].produto_id) : ""}`
      : vezes[0]?.[1] >= 3 ? `viu ${vezes[0][1]} vezes: ${nomeProd.get(vezes[0][0]) || vezes[0][0]}`
      : p.vistos.length >= 5 ? `viu ${p.vistos.length} produtos` : p.visitas >= 3 ? `voltou ${p.visitas} vezes ao site` : null;
    if (motivo) interessados.push({ ...p, motivo, peso: orc.length * 10 + (vezes[0]?.[1] || 0) + p.vistos.length + p.visitas });
  });
  interessados.sort((a, b) => b.peso - a.peso);

  const recentes = [...porV.keys()].map(perfilV).sort((a, b) => new Date(b.ult.criado_em) - new Date(a.ult.criado_em));

  return {
    visitantes: visitantes.size, visitas: sessoes.size,
    recorrentes: [...porV.values()].filter((l) => uniq(l.map((e) => e.sessao)) > 1).length,
    vistos: vis("produto").size, adicionaram: vis("carrinho_add").size, finalizaram: vis("finalizar").size,
    finalizacoes: finalizar.length, valorFinalizado: finalizar.reduce((t, e) => t + (Number(e.valor) || 0), 0),
    pedidos: pedidosP.length, confirmados: confirmados.length, faturamento: confirmados.reduce((t, p) => t + Number(p.total || 0), 0),
    aguardando: d.pedidos.filter((p) => p.status === "aguardando").length,
    cadastros, buscasTop, buscasZero, produtos, origens, estados, cidades, semRegiao, aparelhos, horas, semana, dias,
    carrinhos, semConta, interessados: interessados.slice(0, 15), recentes,
    ant: { visitantes: uniq(ant.map((e) => e.visitante)), visitas: uniq(ant.map((e) => e.sessao)), finalizacoes: antFinal.length, valorFinalizado: antFinal.reduce((t, e) => t + (Number(e.valor) || 0), 0) },
    nomeProd
  };
}

/* ---------- desenho ---------- */
function html(c, d, ctx) {
  const { esc, brl, waLink } = ctx;
  const delta = (a, b) => {
    if (!b) return a ? `<span class="dsp__d dsp__d--up">novo</span>` : "";
    const v = Math.round(((a - b) / b) * 100);
    return `<span class="dsp__d ${v > 0 ? "dsp__d--up" : v < 0 ? "dsp__d--down" : ""}" title="Comparado ao período anterior">${v > 0 ? "▲" : v < 0 ? "▼" : "="} ${Math.abs(v)}%</span>`;
  };
  const kpi = (rotulo, valor, extra = "", dica = "") => `<div class="dsp__kpi"${dica ? ` title="${esc(dica)}"` : ""}><span>${rotulo}</span><strong>${valor}</strong>${extra ? `<small>${extra}</small>` : ""}</div>`;
  const barras = (lista, total, fmt = (k) => k, max = 8) => {
    const top = lista.slice(0, max);
    const maior = top[0]?.[1] || 1;
    return top.length ? `<ul class="dsp__bars">${top.map(([k, n]) => `<li data-tip="${esc(fmt(k))}: ${num(n)} (${pctTxt(n, total)})"><span class="dsp__bl">${esc(fmt(k))}</span><span class="dsp__bt"><i style="width:${Math.max(2, (n / maior) * 100)}%"></i></span><b>${num(n)}</b><em>${pctTxt(n, total)}</em></li>`).join("")}</ul>` : `<p class="dsp__vazio">Sem dados no período.</p>`;
  };
  const nomeV = (p) => p.cliente ? `<strong>${esc(p.nome || p.cliente.email)}</strong><span class="dsp__tag dsp__tag--conta">cliente com conta</span>`
    : p.nome ? `<strong>${esc(p.nome)}</strong><span class="dsp__tag">se identificou</span>` : `<strong>Visitante ${esc(p.v.slice(-5).toUpperCase())}</strong><span class="dsp__tag dsp__tag--anon">anônimo</span>`;
  const sub = (p) => [p.local, ORIGEM_NOME[p.origem] ? ORIGEM_NOME[p.origem].split(" (")[0] : p.origem, p.dispositivo, `${p.visitas} ${p.visitas === 1 ? "visita" : "visitas"}`].filter(Boolean).map(esc).join(" · ");
  const zap = (p, texto) => p.whatsapp ? `<a class="btn btn--wa dsp__wa" href="${waLink(p.whatsapp, texto)}" target="_blank" rel="noopener"><svg class="ico" aria-hidden="true"><use href="#i-wa"/></svg> Chamar no WhatsApp</a>` : "";
  const lista = (itens, n, fn, cls = "") => `<div class="dsp__lista ${cls}">${itens.slice(0, n).map(fn).join("")}</div>${itens.length > n ? `<details class="dsp__mais"><summary>Ver mais ${itens.length - n}</summary><div class="dsp__lista ${cls}">${itens.slice(n).map(fn).join("")}</div></details>` : ""}`;
  const totalVis = c.visitas;
  const maxDia = Math.max(1, ...c.dias.map((x) => x.visitas));
  const maxHora = Math.max(1, ...c.horas);
  const pico = c.horas.indexOf(Math.max(...c.horas));
  const nomesSem = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const funil = [["Visitantes", c.visitantes], ["Viram um produto", c.vistos], ["Adicionaram ao carrinho", c.adicionaram], ["Clicaram em Finalizar", c.finalizaram]];
  const jornada = (p) => `<ol class="dsp__jornada">${p.lista.slice(-40).reverse().map((e) => {
    const t = new Date(e.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    const prod = e.produto_id ? esc(c.nomeProd.get(e.produto_id) || e.produto_id) : "";
    const txt = { visita: `Entrou no site (${esc(ORIGEM_NOME[e.origem]?.split(" (")[0] || e.origem || "direto")})`, produto: `Viu <b>${prod}</b>`, carrinho_add: `Adicionou <b>${prod}</b> ao carrinho`, carrinho: e.dados?.itens?.length ? `Carrinho: ${e.dados.itens.length} ${e.dados.itens.length === 1 ? "item" : "itens"}, ${brl(e.valor)}` : "Esvaziou o carrinho", finalizar: `<b>Clicou em Finalizar</b> (${brl(e.valor)})${e.dados?.nome ? ` como ${esc(e.dados.nome)}` : ""}`, busca: `Buscou “${esc(e.dados?.termo || "")}” (${e.dados?.resultados ?? "?"} resultados)`, orcamento: `Pediu orçamento${prod ? ` de <b>${prod}</b>` : e.dados?.tipo ? ` (${esc(e.dados.tipo)})` : ""}`, whatsapp: `Abriu o WhatsApp (${esc(e.dados?.de || "")})`, login: "Entrou na conta", novidades: "Pediu para receber novidades" }[e.tipo] || esc(e.tipo);
    return `<li><time>${t}</time><span>${txt}</span></li>`;
  }).join("")}</ol>`;

  return `
  <div class="dsp__top">
    <div class="dsp__periodo" role="group" aria-label="Período">${PERIODOS.map(([v, l]) => `<button type="button" class="chip" aria-pressed="${periodo === v}" data-periodo="${v}">${l}</button>`).join("")}</div>
    <span class="dsp__eu">As visitas da loja (seus aparelhos) não entram na contagem</span>
    <button type="button" class="link-btn" data-dsp-atualizar>Atualizar</button>
  </div>

  <section class="dsp__kpis">
    ${kpi("Visitantes", num(c.visitantes), `${delta(c.visitantes, c.ant.visitantes)} · ${num(c.recorrentes)} voltaram`, "Pessoas diferentes (por navegador) no período")}
    ${kpi("Visitas", num(c.visitas), delta(c.visitas, c.ant.visitas), "Entradas no site; uma visita termina após 30 min parado")}
    ${kpi("Clicaram em Finalizar", num(c.finalizacoes), `${delta(c.finalizacoes, c.ant.finalizacoes)} · ${brl(c.valorFinalizado)}`, "Pedidos montados e enviados para o WhatsApp")}
    ${kpi("Conversão", `${pctTxt(c.finalizaram, c.visitantes)}`, "visitantes que finalizaram", "Dos visitantes, quantos clicaram em Finalizar")}
    ${kpi("Vendas confirmadas", brl(c.faturamento), `${num(c.confirmados)} ${c.confirmados === 1 ? "pedido" : "pedidos"} com conta`, "Pedidos com conta marcados como confirmados ou entregues")}
    ${kpi("Valor médio", c.finalizacoes ? brl(c.valorFinalizado / c.finalizacoes) : "–", "por pedido enviado")}
    ${kpi("Cadastros novos", num(c.cadastros.length), "contas criadas")}
    ${kpi("Pedidos aguardando", num(c.aguardando), `<a href="#" data-ir-pedidos>ver na aba Pedidos</a>`)}
  </section>

  <section class="dsp__card">
    <h2>Visitas por dia</h2>
    ${c.dias.length > 1 ? `<div class="dsp__col" role="img" aria-label="Visitas por dia">${c.dias.map((x) => { const dt = new Date(x.t); const r = dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); return `<span class="dsp__colb" data-tip="${r} (${nomesSem[dt.getDay()]}): ${num(x.visitas)} visitas, ${num(x.visitantes.size)} visitantes"><i style="height:${(x.visitas / maxDia) * 100}%"></i><small>${c.dias.length <= 14 || dt.getDate() % 5 === 1 ? r.slice(0, 2) : ""}</small></span>`; }).join("")}</div>` : `<p class="dsp__big">${num(c.visitas)} <small>visitas hoje</small></p>`}
  </section>

  <section class="dsp__card">
    <h2>Funil de compra <small>onde as pessoas desistem</small></h2>
    <ul class="dsp__funil">${funil.map(([r, n], i) => `<li><span>${r}</span><span class="dsp__bt"><i style="width:${Math.max(1.5, pct(n, funil[0][1] || 1))}%"></i></span><b>${num(n)}</b><em>${i ? `${pctTxt(n, funil[i - 1][1])} da etapa anterior` : ""}</em></li>`).join("")}</ul>
  </section>

  <section class="dsp__card dsp__op">
    <h2>Oportunidades de venda</h2>
    <h3>Carrinhos por fechar <small>${num(c.carrinhos.length)} · montaram e saíram sem finalizar</small></h3>
    ${c.carrinhos.length ? lista(c.carrinhos.slice(0, 60), 5, (p) => `<article class="dsp__op-item">
      <header>${nomeV(p)}<span class="dsp__valor">${brl(p.total)}</span></header>
      <p class="dsp__sub">${sub(p)} · ${relativo(p.quando)}</p>
      <p class="dsp__itens">${p.itens.map((i) => `${i.q}x ${esc(c.nomeProd.get(i.id) || i.nome || i.id)}${i.v ? ` (${esc(i.v)})` : ""}`).join(" · ")}</p>
      <div class="dsp__acts">${zap(p, `Olá, ${(p.nome || "").split(" ")[0] || "tudo bem"}! Aqui é da Marshê Studio 3D. Vi que você separou ${p.itens.map((i) => c.nomeProd.get(i.id) || i.nome || i.id).slice(0, 3).join(", ")} no carrinho do site. Posso te ajudar a finalizar? 😊`)}<details><summary>Ver o que fez no site</summary>${jornada(p)}</details></div>
    </article>`) : `<p class="dsp__vazio">Nenhum carrinho abandonado no período.</p>`}

    <h3>Pedidos enviados pelo WhatsApp sem conta <small>confira se a mensagem chegou</small></h3>
    ${c.semConta.length ? lista(c.semConta.slice(0, 60), 4, (p) => `<article class="dsp__op-item">
      <header><strong>${esc(p.e.dados?.nome || "Sem nome")}</strong><span class="dsp__tag">${esc(p.e.dados?.cidade || p.local || "")}</span><span class="dsp__valor">${brl(p.e.valor)}</span></header>
      <p class="dsp__sub">${new Date(p.e.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · ${num(p.e.dados?.itens || 0)} ${p.e.dados?.itens === 1 ? "item" : "itens"} · ${esc(p.e.dados?.recebimento || "")}</p>
      <p class="dsp__itens">${(p.e.dados?.produtos || []).map((id) => esc(c.nomeProd.get(id) || id)).join(" · ")}</p>
    </article>`) : `<p class="dsp__vazio">Nenhum no período.</p>`}

    <h3>Clientes interessados <small>voltaram, viram muito ou pediram orçamento, sem fechar</small></h3>
    ${c.interessados.length ? lista(c.interessados, 4, (p) => `<article class="dsp__op-item">
      <header>${nomeV(p)}</header>
      <p class="dsp__sub">${sub(p)} · ${relativo(p.ult.criado_em)}</p>
      <p class="dsp__itens">${esc(p.motivo)}</p>
      <div class="dsp__acts">${zap(p, `Olá, ${(p.nome || "").split(" ")[0] || "tudo bem"}! Aqui é da Marshê Studio 3D. Posso te ajudar com alguma peça? 😊`)}<details><summary>Ver o que fez no site</summary>${jornada(p)}</details></div>
    </article>`) : `<p class="dsp__vazio">Ninguém se destacou no período.</p>`}

    <div class="dsp__duas">
      <div><h3>Procuraram e não acharam <small>ideias de produto</small></h3>${barras(c.buscasZero, c.buscasZero.reduce((t, x) => t + x[1], 0) || 1, (k) => `“${k}”`, 10)}</div>
      <div><h3>Mais buscados</h3>${barras(c.buscasTop, c.buscasTop.reduce((t, x) => t + x[1], 0) || 1, (k) => `“${k}”`, 10)}</div>
    </div>
  </section>

  <section class="dsp__card">
    <h2>Produtos <small>do mais visto para o menos visto</small></h2>
    ${c.produtos.length ? `<div class="dsp__tabela"><table><thead><tr><th>Produto</th><th title="Pessoas diferentes que abriram o produto">Viram</th><th>Carrinho</th><th title="Vezes que entrou num pedido enviado">Pedidos</th><th title="De quem viu, quantos adicionaram">Conversão</th></tr></thead><tbody>
      ${c.produtos.slice(0, 25).map((p) => `<tr><td>${esc(p.nome)}${p.orc ? ` <span class="dsp__tag">${p.orc} orçamento${p.orc > 1 ? "s" : ""}</span>` : ""}</td><td>${num(p.vistos.size)}</td><td>${num(p.add.size)}</td><td>${num(p.fin)}</td><td>${p.vistos.size ? pctTxt(p.add.size, p.vistos.size) : "–"}</td></tr>`).join("")}
    </tbody></table></div>` : `<p class="dsp__vazio">Sem dados no período.</p>`}
  </section>

  <div class="dsp__duas">
    <section class="dsp__card"><h2>De onde vêm <small>por visita</small></h2>${barras(c.origens, totalVis, (k) => ORIGEM_NOME[k] || k)}</section>
    <section class="dsp__card"><h2>Aparelhos</h2>${barras(c.aparelhos, totalVis, (k) => k.charAt(0).toUpperCase() + k.slice(1))}</section>
  </div>
  <div class="dsp__duas">
    <section class="dsp__card"><h2>Estados</h2>${barras(c.estados, totalVis - c.semRegiao || 1)}</section>
    <section class="dsp__card"><h2>Cidades <small>aproximadas pela internet</small></h2>${barras(c.cidades, totalVis - c.semRegiao || 1, (k) => k, 10)}</section>
  </div>

  <section class="dsp__card">
    <h2>Horários de mais visitas ${c.visitas ? `<small>pico às ${pico}h · bom horário para postar</small>` : ""}</h2>
    <div class="dsp__col dsp__col--h" role="img" aria-label="Visitas por hora do dia">${c.horas.map((n, h) => `<span class="dsp__colb${h === pico && n ? " is-pico" : ""}" data-tip="${h}h às ${h + 1}h: ${num(n)} visitas"><i style="height:${(n / maxHora) * 100}%"></i><small>${h % 3 === 0 ? h + "h" : ""}</small></span>`).join("")}</div>
    <p class="dsp__semana">${c.semana.map((n, i) => `<span><b>${nomesSem[i]}</b> ${num(n)}</span>`).join("")}</p>
  </section>

  <section class="dsp__card">
    <h2>Quem visitou <small>${num(c.recentes.length)} visitantes · os mais recentes primeiro</small></h2>
    <p class="dsp__nota">Quem não fez login aparece como <b>anônimo</b>. Se depois a pessoa entrar na conta, ou digitar o nome ao finalizar um pedido, todas as visitas dela passam a aparecer com o nome.</p>
    ${lista(c.recentes.slice(0, 100), 8, (p) => `<article class="dsp__op-item">
      <header>${nomeV(p)}<span class="dsp__quando">${relativo(p.ult.criado_em)}</span></header>
      <p class="dsp__sub">${sub(p)}${p.vistos.length ? ` · viu ${p.vistos.length} ${p.vistos.length === 1 ? "produto" : "produtos"}` : ""}${p.finalizou ? " · <b>finalizou pedido</b>" : ""}</p>
      <div class="dsp__acts">${zap(p, `Olá, ${(p.nome || "").split(" ")[0] || "tudo bem"}! Aqui é da Marshê Studio 3D.`)}<details><summary>Ver o que fez no site</summary>${jornada(p)}</details></div>
    </article>`)}
  </section>

  <section class="dsp__card">
    <h2>Cadastros novos <small>${num(c.cadastros.length)} no período</small></h2>
    ${c.cadastros.length ? `<ul class="dsp__cad">${c.cadastros.slice(0, 30).map((u) => `<li><strong>${esc(u.nome || "Cadastro incompleto")}</strong><span>${esc(u.email)}</span><time>${new Date(u.criado_em).toLocaleDateString("pt-BR")}</time>${u.whatsapp ? `<a href="${waLink(u.whatsapp, `Olá, ${(u.nome || "").split(" ")[0]}! Aqui é da Marshê Studio 3D. Obrigado por criar sua conta! 😊`)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}</li>`).join("")}</ul>` : `<p class="dsp__vazio">Nenhum cadastro novo no período.</p>`}
  </section>
  <div class="dsp__tip" role="tooltip" hidden></div>`;
}

export async function renderDesempenho(box, ctx) {
  box.innerHTML = `<p class="dsp__carregando">Carregando os números…</p>`;
  try {
    if (!cache || cache.periodo !== periodo || Date.now() - cache.t > 120000) cache = { periodo, t: Date.now(), d: await carregar(ctx) };
    const c = calcular(cache.d);
    box.innerHTML = `<div class="dsp">${html(c, cache.d, ctx)}</div>`;
  } catch (e) {
    const falta = /eventos|schema cache|does not exist/i.test(e.message);
    box.innerHTML = `<div class="adm__card"><h1>${falta ? "Falta um passo no Supabase" : "Não foi possível carregar"}</h1><p>${falta ? "Rode o arquivo <code>supabase/desempenho.sql</code> no SQL Editor do Supabase (uma vez só). Os números começam a aparecer a partir daí." : ctx.esc(e.message)}</p></div>`;
    return;
  }
  // período, atualizar, ir para pedidos
  box.onclick = (e) => {
    const b = e.target.closest("[data-periodo]");
    if (b) { periodo = b.dataset.periodo; renderDesempenho(box, ctx); return; }
    if (e.target.closest("[data-dsp-atualizar]")) { cache = null; renderDesempenho(box, ctx); return; }
    if (e.target.closest("[data-ir-pedidos]")) { e.preventDefault(); document.querySelector('[data-aba="pedidos"]')?.click(); }
  };
  // dica ao passar o mouse/tocar nas barras
  const tip = box.querySelector(".dsp__tip");
  const mostrar = (e) => {
    const t = e.target.closest("[data-tip]");
    if (!t) { tip.hidden = true; return; }
    tip.textContent = t.dataset.tip; tip.hidden = false;
    const r = t.getBoundingClientRect(), w = tip.offsetWidth;
    tip.style.left = Math.min(innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2)) + "px";
    tip.style.top = r.top - tip.offsetHeight - 8 + "px";
  };
  box.onpointerover = mostrar;
  box.onpointerdown = mostrar;
  box.onpointerleave = () => (tip.hidden = true);
}
