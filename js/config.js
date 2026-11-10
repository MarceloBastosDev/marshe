/* Configurações da loja · edite aqui sem mexer no resto do código. */
window.MARSHE = {
  // WhatsApp com código do país + DDD, só números
  whatsapp: "5551981231848",
  whatsappExibicao: "(51) 98123-1848",
  instagram: "marshe_studio3d",
  email: "marshe3d@gmail.com",
  cidade: "Terra de Areia/RS",

  // Desconto do primeiro pedido (em %)
  descontoPrimeiroPedido: 10,

  // Prazo de produção mostrado nos produtos (cada produto pode ter "prazo" próprio no produtos.json)
  prazoPadrao: "3 a 5 dias úteis",

  // Se este arquivo existir, o destaque do topo vira a peça girando em 3D
  modelo3d: "assets/3d/destaque.glb",
  // Produto ligado ao destaque do topo
  produtoDestaque: "nossa-senhora-aparecida",

  // false = animações rodam sempre, mesmo com "movimento reduzido" ligado no aparelho.
  // true  = quem pediu menos movimento no aparelho vê só fades curtos (recomendado para acessibilidade).
  respeitarMovimentoReduzido: false,

  // CNPJ (aparece no rodapé e nas páginas de privacidade e termos)
  cnpj: "64.588.570/0001-27",

  // ---------- Pix ----------
  // Chave e dados do QR code mostrado ao finalizar (nome e cidade sem acento, como o Pix exige)
  pix: { chave: "marshe3d@gmail.com", nome: "MARSHE STUDIO 3D", cidade: "TERRA DE AREIA" },

  // ---------- Envio ----------
  // Valores ESTIMADOS ("a partir de") para um pacote pequeno, de até 500 g; o valor exato sai pelo CEP
  // e é confirmado na conversa. Referência: preços dos Correios de 2026. Ajuste à vontade.
  // "prazo" é o tempo de entrega, contado depois que a peça fica pronta.
  frete: [
    { nome: "Entrega em Terra de Areia", detalhe: "No endereço que você indicar", valor: 0, prazo: "1 dia útil" },
    { nome: "Entrega no Litoral Norte", detalhe: "Torres, Capão da Canoa, Osório, Tramandaí, Três Cachoeiras e região", valor: 10, prazo: "1 a 2 dias úteis" },
    { nome: "Correios para o Rio Grande do Sul", detalhe: "PAC", valor: 18, prazo: "3 a 6 dias úteis" },
    { nome: "Correios para Sul e Sudeste", detalhe: "PAC (SEDEX a partir de R$ 35)", valor: 25, prazo: "5 a 9 dias úteis" },
    { nome: "Correios para os demais estados", detalhe: "PAC (SEDEX a partir de R$ 55)", valor: 35, prazo: "7 a 14 dias úteis" }
  ],

  // ---------- Vendas ----------
  // Fim da Black Friday (a contagem regressiva some sozinha depois dessa data)
  blackFridayFim: "2026-11-30T23:59:59-03:00",
  // Embalagem de presente (com cartão e mensagem) e meta para ela sair grátis
  embalagemPreco: 5,
  embalagemGratisAcima: 100,
  // Indique e ganhe: pontos para quem indicou e para o indicado (mude também em regras_pontos)
  bonusIndicacao: 1000,

  // ---------- Pontos Marshê (cashback) ----------
  // Veja o passo a passo em supabase/LEIA-ME.md. Enquanto os dois campos abaixo
  // estiverem vazios, o programa fica escondido no site.
  supabaseUrl: "https://cwtmcmxcjqxtisseyluq.supabase.co",
  supabaseAnonKey: "sb_publishable_5ofqkTbPNRCMy8Zlagfv2Q_PEeTHXS9", // chave "publishable" (sb_publishable_...) ou "anon public" do projeto (pode ficar no site)
  loginGoogle: true,      // true depois de ativar o Google no Supabase (passo a passo em supabase/LEIA-ME.md)
  cashbackPct: 5,         // % de volta em pontos (mude também em regras_pontos no Supabase)
  validadePontosMeses: 6, // validade dos pontos (idem)
  pontosDemo: false       // true = mostra as telas em modo demonstração, sem banco
};
