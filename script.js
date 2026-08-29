// Menu mobile
const toggle = document.getElementById('menuToggle');
const menu = document.getElementById('menu');

toggle.addEventListener('click', () => {
  menu.classList.toggle('aberto');
});

// Fecha o menu ao clicar em um link
menu.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => menu.classList.remove('aberto'));
});

// ===== CATÁLOGO: categorias, ordenação e carrossel =====
const filtros = document.querySelectorAll('#filtros .filtro');
const grupos = document.querySelectorAll('.produtos .grupo');
const catalogo = document.getElementById('catalogo');
const catalogoNota = document.getElementById('catalogoNota');
const seletorOrdem = document.getElementById('ordenar');
const carrossel = document.getElementById('carrossel');
const setaAnterior = document.getElementById('setaAnterior');
const setaProxima = document.getElementById('setaProxima');

// Lê o preço do próprio card, então basta manter o texto "R$ 00,00"
// atualizado — não existe um segundo lugar para esquecer de mudar.
function precoDo(produto) {
  const texto = produto.querySelector('.preco')?.textContent ?? '';
  const numero = texto.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const valor = parseFloat(numero);
  return Number.isNaN(valor) ? 0 : valor;
}

function nomeDo(produto) {
  return produto.querySelector('h4')?.textContent.trim() ?? '';
}

const comparadores = {
  'recentes': (a, b) =>
    (b.dataset.adicionado ?? '').localeCompare(a.dataset.adicionado ?? '') ||
    nomeDo(a).localeCompare(nomeDo(b), 'pt-BR'),
  'nome-az': (a, b) => nomeDo(a).localeCompare(nomeDo(b), 'pt-BR'),
  'nome-za': (a, b) => nomeDo(b).localeCompare(nomeDo(a), 'pt-BR'),
  'preco-menor': (a, b) => precoDo(a) - precoDo(b) || nomeDo(a).localeCompare(nomeDo(b), 'pt-BR'),
  'preco-maior': (a, b) => precoDo(b) - precoDo(a) || nomeDo(a).localeCompare(nomeDo(b), 'pt-BR'),
};

// Os cards continuam no HTML dentro da sua categoria; a ordem visual é
// definida pela propriedade CSS "order", que vale tanto na grade quanto
// na faixa do carrossel.
function ordenar() {
  const criterio = comparadores[seletorOrdem.value] ?? comparadores['recentes'];
  const emCarrossel = catalogo.classList.contains('modo-carrossel');

  // No carrossel as peças marcadas como destaque abrem a fila
  const criterioFinal = emCarrossel
    ? (a, b) => {
        const da = a.classList.contains('produto-destaque') ? 0 : 1;
        const db = b.classList.contains('produto-destaque') ? 0 : 1;
        return da - db || criterio(a, b);
      }
    : criterio;

  if (emCarrossel || catalogo.classList.contains('modo-lista')) {
    [...catalogo.querySelectorAll('.produto')]
      .sort(criterioFinal)
      .forEach((produto, i) => { produto.style.order = i; });
  } else {
    grupos.forEach((grupo) => {
      [...grupo.querySelectorAll('.produto')]
        .sort(criterio)
        .forEach((produto, i) => { produto.style.order = i; });
    });
  }

  if (emCarrossel) {
    // Espera o navegador aplicar a nova ordem antes de voltar ao início:
    // reordenar com encaixe ligado faz o carrossel pular sozinho.
    requestAnimationFrame(() => {
      catalogo.scrollTo({ left: 0, behavior: "auto" });
      atualizarSetas();
    });
  }
}

// Desliga a seta quando não há mais para onde ir daquele lado
function atualizarSetas() {
  if (!catalogo.classList.contains('modo-carrossel')) return;
  // O encaixe para no primeiro card, que fica depois do recuo lateral,
  // entao o inicio da faixa nao e zero.
  const recuo = parseFloat(getComputedStyle(catalogo).paddingLeft) || 0;
  const fim = catalogo.scrollWidth - catalogo.clientWidth;
  setaAnterior.disabled = catalogo.scrollLeft <= recuo + 8;
  setaProxima.disabled = catalogo.scrollLeft >= fim - 8;
}

function passoDoCarrossel() {
  const card = catalogo.querySelector('.produto');
  if (!card) return catalogo.clientWidth;
  const espaco = parseFloat(getComputedStyle(catalogo).columnGap) || 24;
  return card.getBoundingClientRect().width + espaco;
}

setaAnterior.addEventListener('click', () => {
  catalogo.scrollBy({ left: -passoDoCarrossel(), behavior: 'smooth' });
});
setaProxima.addEventListener('click', () => {
  catalogo.scrollBy({ left: passoDoCarrossel(), behavior: 'smooth' });
});
catalogo.addEventListener('scroll', atualizarSetas);
window.addEventListener('resize', atualizarSetas);

function mostrarCategoria(alvo) {
  filtros.forEach((b) => b.classList.toggle('ativo', b.dataset.categoria === alvo));

  // "Destaques" vira o carrossel; "Ver tudo" vira uma grade só, sem
  // títulos de categoria. As demais mantêm a grade da própria categoria.
  catalogo.classList.toggle('modo-carrossel', alvo === 'destaques');
  catalogo.classList.toggle('modo-lista', alvo === 'todos');
  carrossel.classList.toggle('ativo', alvo === 'destaques');
  catalogoNota.hidden = alvo !== 'destaques';

  grupos.forEach((grupo) => {
    grupo.hidden = !['destaques', 'todos'].includes(alvo) && grupo.dataset.categoria !== alvo;
  });

  ordenar();
}

filtros.forEach((botao) => {
  botao.addEventListener('click', () => mostrarCategoria(botao.dataset.categoria));
});

seletorOrdem.addEventListener('change', ordenar);

document.getElementById('verTudo').addEventListener('click', () => {
  mostrarCategoria('todos');
});

mostrarCategoria('destaques');

// As fotos mudam a largura da faixa ao carregar, então revisamos as setas
window.addEventListener('load', atualizarSetas);
