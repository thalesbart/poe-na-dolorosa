/**
 * Nlu.gs
 * Motor de interpretação de texto livre baseado em REGRAS (regex +
 * dicionários + similaridade de string) — sem chamar nenhuma LLM.
 *
 * A ideia: como o vocabulário é pequeno e conhecido (2 usuários, poucas
 * categorias/descrições já cadastradas na planilha), dá pra extrair a
 * maioria dos campos de frases como "gastei 45,90 no mercado" ou
 * "dividido 100 jantar com a Tamires" só com regex + comparação contra
 * as listas cadastradas. O que não for reconhecido com confiança fica
 * null e o fluxo guiado (Telegram.gs) pergunta diretamente pro usuário.
 */

const PALAVRAS_RECEITA = ['recebi', 'ganhei', 'caiu', 'salario', 'freela', 'freelance', 'entrada', 'pix recebido'];
const PALAVRAS_DIVIDIDO = ['dividido', 'dividi', 'dividimos', 'meio a meio', 'rachado', 'racha', 'rachei'];

const PALAVRAS_CATEGORIA = {
  'Alimentação': ['mercado', 'supermercado', 'restaurante', 'ifood', 'lanche', 'padaria', 'feira', 'almoco', 'janta', 'jantar'],
  'Transporte': ['uber', 'gasolina', 'combustivel', 'onibus', '99', 'estacionamento', 'passagem'],
  'Lazer': ['cinema', 'bar', 'show', 'viagem', 'passeio', 'balada'],
  'Saúde': ['farmacia', 'remedio', 'medico', 'consulta', 'exame'],
  'Moradia': ['aluguel', 'condominio', 'luz', 'agua', 'internet'],
};

/**
 * Minúsculas + sem acento, pra comparação tolerante a "Mercado"/"mercado"/"mercadão".
 */
function normalizarTexto(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Converte texto digitado em número, aceitando "45,90" e "45.90"
 * (mesma lógica do parseValorInput do app, replicada aqui porque o
 * Apps Script do bot não compartilha módulos com o React Native).
 */
function parseValorInputTelegram(texto) {
  if (texto === null || texto === undefined) return NaN;
  let s = String(texto).trim();
  if (s === '') return NaN;
  if (s.includes('.') && s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  return parseFloat(s);
}

function arredondar2Telegram(valor) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/**
 * Extrai o valor monetário de uma frase. Remove primeiro qualquer trecho
 * "<número>%" pra não confundir o percentual da divisão com o valor total
 * (ex: "dividido 50% jantar 100" — o valor é 100, não 50).
 */
function extrairValor(textoNormalizado) {
  const semPercentual = textoNormalizado.replace(/\d+(?:[.,]\d{1,2})?\s*%/g, '');
  const match = semPercentual.match(/(\d+(?:[.,]\d{1,2})?)/);
  if (!match) return null;
  const valor = parseValorInputTelegram(match[1]);
  return isNaN(valor) ? null : valor;
}

function extrairPercentual(textoNormalizado) {
  const match = textoNormalizado.match(/(\d{1,3})\s*%/);
  if (!match) return null;
  const p = Number(match[1]);
  return p > 0 && p <= 100 ? p : null;
}

/**
 * "hoje"/"ontem"/"anteontem" ou "dd/mm" ou "dd/mm/aaaa". Sem menção
 * nenhuma de data, assume hoje.
 */
function extrairData(textoNormalizado) {
  const hoje = new Date();
  if (/\bhoje\b/.test(textoNormalizado)) return hoje;
  if (/\bontem\b/.test(textoNormalizado)) {
    const d = new Date(hoje);
    d.setDate(d.getDate() - 1);
    return d;
  }
  if (/\banteontem\b/.test(textoNormalizado)) {
    const d = new Date(hoje);
    d.setDate(d.getDate() - 2);
    return d;
  }
  const matchData = textoNormalizado.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (matchData) {
    const dia = Number(matchData[1]);
    const mes = Number(matchData[2]) - 1;
    let ano = hoje.getFullYear();
    if (matchData[3]) {
      ano = matchData[3].length === 2 ? 2000 + Number(matchData[3]) : Number(matchData[3]);
    }
    const d = new Date(ano, mes, dia, 12, 0, 0);
    if (!isNaN(d.getTime()) && d.getDate() === dia && d.getMonth() === mes) return d;
  }
  return hoje;
}

/**
 * Distância de Levenshtein clássica (número mínimo de edições pra
 * transformar uma string na outra) — usada pra tolerar erro de digitação
 * ao comparar uma palavra da frase com um item já cadastrado.
 */
function distanciaLevenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = [];
  for (let i = 0; i <= m; i++) {
    dp.push(new Array(n + 1).fill(0));
    dp[i][0] = i;
  }
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + custo);
    }
  }
  return dp[m][n];
}

/**
 * Procura, dentro de uma frase inteira, o item de uma lista já cadastrada
 * (descrições, categorias) que melhor combina com o texto:
 *  1) match direto por substring (cobre nomes com mais de uma palavra)
 *  2) match aproximado por palavra individual, tolerando erro de
 *     digitação proporcional ao tamanho da palavra
 * Retorna o item original da lista (com acentuação/maiúsculas corretas)
 * ou null se nada bateu com confiança suficiente.
 */
function encontrarMaisParecido(fraseNormalizada, lista, limiarRelativo) {
  if (!lista || lista.length === 0) return null;
  const limiar = limiarRelativo || 0.3;

  let melhorSubstring = null;
  lista.forEach((item) => {
    const candidato = normalizarTexto(item);
    if (candidato && fraseNormalizada.includes(candidato)) {
      if (!melhorSubstring || candidato.length > normalizarTexto(melhorSubstring).length) {
        melhorSubstring = item;
      }
    }
  });
  if (melhorSubstring) return melhorSubstring;

  const palavras = fraseNormalizada.split(/\s+/).filter(Boolean);
  let melhor = null;
  let melhorDist = Infinity;
  palavras.forEach((palavra) => {
    lista.forEach((item) => {
      const candidato = normalizarTexto(item);
      if (!candidato) return;
      const dist = distanciaLevenshtein(palavra, candidato);
      const limite = Math.max(1, Math.floor(candidato.length * limiar));
      if (dist <= limite && dist < melhorDist) {
        melhorDist = dist;
        melhor = item;
      }
    });
  });
  return melhor;
}

/**
 * Interpreta uma frase livre e devolve o máximo de campos que conseguir
 * reconhecer. Campos não reconhecidos vêm null — quem chama decide o que
 * fazer (perguntar pro usuário).
 *
 * opcoes: { descricoesPessoais, descricoesReceita, categorias }
 */
function interpretarTexto(textoOriginal, usuario, opcoes) {
  const texto = normalizarTexto(textoOriginal);
  const outro = normalizarTexto(outroUsuario(usuario));

  let subtipo;
  if (PALAVRAS_RECEITA.some((p) => texto.includes(p))) {
    subtipo = 'receita';
  } else if (PALAVRAS_DIVIDIDO.some((p) => texto.includes(p)) || (outro && texto.includes(outro))) {
    subtipo = 'dividido';
  } else {
    subtipo = 'pessoal';
  }

  const listaDescricoes = subtipo === 'receita' ? (opcoes.descricoesReceita || []) : (opcoes.descricoesPessoais || []);
  const descricao = encontrarMaisParecido(texto, listaDescricoes, 0.3);

  let categoria = null;
  if (subtipo !== 'receita') {
    categoria = encontrarMaisParecido(texto, opcoes.categorias || [], 0.3);
    if (!categoria) {
      for (const chave of Object.keys(PALAVRAS_CATEGORIA)) {
        if (PALAVRAS_CATEGORIA[chave].some((p) => texto.includes(p))) {
          categoria = chave;
          break;
        }
      }
    }
  }

  return {
    subtipo: subtipo,
    valor_total: extrairValor(texto),
    percentual_outro: subtipo === 'dividido' ? extrairPercentual(texto) : null,
    categoria: categoria,
    descricao: descricao,
    data: extrairData(texto),
  };
}
