/**
 * Telegram.gs
 * Bot do Telegram pro Põe na Dolorosa — permite lançar despesas/receitas,
 * consultar saldo/histórico/caixinhas e registrar acertos por mensagem de
 * texto, reaproveitando 100% das funções de negócio já usadas pelo app
 * (criarTransacao, calcularSaldoEntreUsuarios, listarCaixinhas, etc).
 *
 * Não usa nenhuma LLM: comandos são interpretados por regra fixa, e texto
 * livre é interpretado pelo motor de Nlu.gs (regex + dicionários +
 * similaridade contra as listas já cadastradas). O que não for reconhecido
 * com confiança é perguntado diretamente pelo fluxo guiado abaixo.
 *
 * Setup necessário (feito manualmente, uma única vez):
 *  1. Criar o bot com o @BotFather e pegar o token.
 *  2. No editor do Apps Script: Configurações do projeto (⚙️) > Propriedades
 *     do script > adicionar TELEGRAM_BOT_TOKEN e (opcional) TELEGRAM_SENHA_VINCULO.
 *  3. Rodar configurarWebhookTelegram() uma vez (editando a URL nela antes).
 */

const CAMPOS_FLUXO = {
  pessoal: ['descricao', 'categoria', 'valor_total', 'data'],
  dividido: ['descricao', 'categoria', 'valor_total', 'percentual_outro', 'forma_pagamento', 'data'],
  receita: ['descricao', 'valor_total', 'data'],
};

// ---------------------------------------------------------------------
// API do Telegram
// ---------------------------------------------------------------------

function getTelegramToken() {
  return PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN');
}

function telegramApi(metodo, payload) {
  const token = getTelegramToken();
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN não configurado nas Propriedades do script.');
    return null;
  }
  const url = `https://api.telegram.org/bot${token}/${metodo}`;
  return UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
}

function enviarMensagem(chatId, texto, teclado) {
  const payload = { chat_id: chatId, text: texto, parse_mode: 'Markdown' };
  if (teclado) payload.reply_markup = teclado;
  telegramApi('sendMessage', payload);
}

function responderCallback(callbackQueryId, texto) {
  telegramApi('answerCallbackQuery', { callback_query_id: callbackQueryId, text: texto || '' });
}

function tecladoInline(linhas) {
  return { inline_keyboard: linhas.map((linha) => linha.map((b) => ({ text: b.texto, callback_data: b.dado }))) };
}

function agruparEmLinhas(itens, porLinha) {
  const linhas = [];
  for (let i = 0; i < itens.length; i += porLinha) linhas.push(itens.slice(i, i + porLinha));
  return linhas;
}

function formatarMoedaTelegram(valor) {
  const num = Number(valor) || 0;
  return num.toFixed(2).replace('.', ',');
}

function formatarDataTelegram(dataIso) {
  const d = new Date(dataIso);
  if (isNaN(d.getTime())) return '';
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${d.getFullYear()}`;
}

/**
 * Rodar manualmente uma vez pelo editor do Apps Script (troque a URL pela
 * mesma URL /exec usada em expo-app/services/api.js) pra registrar o
 * webhook do bot.
 */
function configurarWebhookTelegram() {
  const url = 'COLE_AQUI_A_URL_DO_SEU_APPS_SCRIPT/exec';
  const resposta = telegramApi('setWebhook', { url: url });
  Logger.log(resposta.getContentText());
}

// ---------------------------------------------------------------------
// Cadastro de usuários vinculados e estado de conversa (por chat_id)
// ---------------------------------------------------------------------

function garantirCabecalhoTelegram() {
  const sheetU = getSheet(SHEET_NAMES.USUARIOS_TELEGRAM);
  if (sheetU.getLastRow() === 0) sheetU.appendRow(['chat_id', 'nome', 'data_vinculo']);
  const sheetC = getSheet(SHEET_NAMES.CONVERSAS_TELEGRAM);
  if (sheetC.getLastRow() === 0) sheetC.appendRow(['chat_id', 'fluxo', 'etapa', 'dados', 'atualizado_em']);
}

function buscarUsuarioTelegram(chatId) {
  garantirCabecalhoTelegram();
  const sheet = getSheet(SHEET_NAMES.USUARIOS_TELEGRAM);
  const dados = sheet.getDataRange().getValues();
  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][0]) === String(chatId)) return dados[i][1];
  }
  return null;
}

function vincularUsuarioTelegram(chatId, nome) {
  garantirCabecalhoTelegram();
  const sheet = getSheet(SHEET_NAMES.USUARIOS_TELEGRAM);
  sheet.appendRow([chatId, nome, new Date().toISOString()]);
}

function encontrarLinhaPorChatId(sheet, chatId) {
  const dados = sheet.getDataRange().getValues();
  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][0]) === String(chatId)) return i + 1;
  }
  return -1;
}

function obterConversa(chatId) {
  garantirCabecalhoTelegram();
  const sheet = getSheet(SHEET_NAMES.CONVERSAS_TELEGRAM);
  const linha = encontrarLinhaPorChatId(sheet, chatId);
  if (linha === -1) return null;
  const row = sheet.getRange(linha, 1, 1, 5).getValues()[0];
  if (!row[1]) return null;
  let dados = {};
  try {
    dados = JSON.parse(row[3] || '{}');
  } catch (err) {
    dados = {};
  }
  return { fluxo: row[1], etapa: row[2], dados: dados };
}

function salvarConversa(chatId, fluxo, etapa, dados) {
  garantirCabecalhoTelegram();
  const sheet = getSheet(SHEET_NAMES.CONVERSAS_TELEGRAM);
  const linha = encontrarLinhaPorChatId(sheet, chatId);
  const valores = [chatId, fluxo || '', etapa || '', JSON.stringify(dados || {}), new Date().toISOString()];
  if (linha === -1) {
    sheet.appendRow(valores);
  } else {
    sheet.getRange(linha, 1, 1, 5).setValues([valores]);
  }
}

function limparConversa(chatId) {
  salvarConversa(chatId, '', '', {});
}

// ---------------------------------------------------------------------
// Ponto de entrada do webhook (chamado por doPost em Code.gs)
// ---------------------------------------------------------------------

function processarAtualizacaoTelegram(update) {
  try {
    if (update.callback_query) {
      tratarCallbackQuery(update.callback_query);
    } else if (update.message) {
      tratarMensagem(update.message);
    }
  } catch (err) {
    console.error('Erro processando update do Telegram: ' + err.message);
  }
  return ContentService.createTextOutput('ok');
}

function tratarMensagem(message) {
  const chatId = message.chat.id;
  const textoBruto = (message.text || '').trim();
  if (!textoBruto) return;

  if (textoBruto.startsWith('/')) {
    tratarComando(chatId, textoBruto);
    return;
  }

  const usuario = buscarUsuarioTelegram(chatId);
  if (!usuario) {
    enviarMensagem(chatId, 'Você ainda não está vinculado. Envie /start <senha> pra começar.');
    return;
  }

  const conversa = obterConversa(chatId);
  if (conversa && conversa.etapa) {
    processarRespostaEtapa(chatId, usuario, conversa, textoBruto);
    return;
  }

  iniciarFluxoPorTexto(chatId, usuario, textoBruto);
}

function tratarCallbackQuery(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const dado = callbackQuery.data || '';
  responderCallback(callbackQuery.id, '');

  if (dado.startsWith('link:')) {
    const nome = dado.split(':')[1];
    vincularUsuarioTelegram(chatId, nome);
    enviarMensagem(chatId, `Pronto, ${nome}! Envie /ajuda pra ver o que dá pra fazer por aqui.`);
    return;
  }

  const usuario = buscarUsuarioTelegram(chatId);
  if (!usuario) return;

  if (dado.startsWith('resp:')) {
    const partes = dado.split(':');
    const campo = partes[1];
    const valor = partes.slice(2).join(':');
    const conversa = obterConversa(chatId);
    if (!conversa) return;
    aplicarRespostaCampo(chatId, usuario, conversa, campo, valor);
    return;
  }

  if (dado === 'conf:sim') {
    confirmarESalvarLancamento(chatId, usuario);
    return;
  }
  if (dado === 'conf:nao') {
    limparConversa(chatId);
    enviarMensagem(chatId, 'Cancelado.');
    return;
  }

  if (dado === 'acerto:sim') {
    executarAcerto(chatId, usuario);
    return;
  }
  if (dado === 'acerto:nao') {
    limparConversa(chatId);
    enviarMensagem(chatId, 'Ok, acerto não registrado.');
    return;
  }
}

// ---------------------------------------------------------------------
// Comandos (/despesa, /saldo, etc)
// ---------------------------------------------------------------------

function tratarComando(chatId, textoBruto) {
  const partes = textoBruto.trim().split(/\s+/);
  const comando = partes[0].toLowerCase().replace(/@.*$/, '');
  const resto = partes.slice(1).join(' ');

  if (comando === '/start') {
    tratarStart(chatId, resto);
    return;
  }

  const usuario = buscarUsuarioTelegram(chatId);
  if (!usuario) {
    enviarMensagem(chatId, 'Você ainda não está vinculado. Envie /start <senha> pra começar.');
    return;
  }

  switch (comando) {
    case '/ajuda':
    case '/help':
      enviarAjuda(chatId);
      break;
    case '/cancelar':
      limparConversa(chatId);
      enviarMensagem(chatId, 'Ok, cancelado.');
      break;
    case '/saldo':
      comandoSaldo(chatId);
      break;
    case '/resumo':
      comandoResumo(chatId, usuario);
      break;
    case '/historico':
      comandoHistorico(chatId, usuario);
      break;
    case '/caixinhas':
      comandoCaixinhas(chatId);
      break;
    case '/despesa':
      limparConversa(chatId);
      avancarFluxo(chatId, usuario, 'pessoal', {});
      break;
    case '/dividido':
      limparConversa(chatId);
      avancarFluxo(chatId, usuario, 'dividido', {});
      break;
    case '/receita':
      limparConversa(chatId);
      avancarFluxo(chatId, usuario, 'receita', {});
      break;
    case '/aportar':
      iniciarMovimentoCaixinha(chatId, usuario, 'aporte', resto);
      break;
    case '/resgatar':
      iniciarMovimentoCaixinha(chatId, usuario, 'resgate', resto);
      break;
    case '/acerto':
      comandoAcerto(chatId);
      break;
    default:
      enviarMensagem(chatId, 'Comando não reconhecido. Envie /ajuda pra ver as opções.');
  }
}

function tratarStart(chatId, senha) {
  const usuarioAtual = buscarUsuarioTelegram(chatId);
  if (usuarioAtual) {
    enviarMensagem(chatId, `Você já está vinculado como ${usuarioAtual}.`);
    return;
  }
  const senhaEsperada = PropertiesService.getScriptProperties().getProperty('TELEGRAM_SENHA_VINCULO');
  if (senhaEsperada && senha !== senhaEsperada) {
    enviarMensagem(chatId, 'Senha incorreta. Envie /start <senha> com a senha combinada.');
    return;
  }
  enviarMensagem(chatId, 'Quem é você?', tecladoInline([
    [{ texto: 'Thales', dado: 'link:Thales' }, { texto: 'Tamires', dado: 'link:Tamires' }],
  ]));
}

function enviarAjuda(chatId) {
  const texto = [
    '*Comandos disponíveis:*',
    '/despesa — lançar despesa pessoal',
    '/dividido — lançar despesa dividida',
    '/receita — lançar receita',
    '/saldo — ver quem deve pra quem',
    '/resumo — receitas/débitos/saldo do mês',
    '/historico — últimos lançamentos',
    '/caixinhas — ver saldo das caixinhas',
    '/aportar <caixinha> <valor> — aportar numa caixinha',
    '/resgatar <caixinha> <valor> — resgatar de uma caixinha',
    '/acerto — registrar o acerto de contas pendente',
    '/cancelar — cancela o que estiver em andamento',
    '',
    'Ou escreva direto o que você gastou, tipo:',
    '_"gastei 45,90 no mercado"_ ou _"dividido 100 jantar com a Tamires"_',
  ].join('\n');
  enviarMensagem(chatId, texto);
}

function comandoSaldo(chatId) {
  const saldo = calcularSaldoEntreUsuarios();
  if (saldo.quitado) {
    enviarMensagem(chatId, '🎉 Vocês estão quites!');
    return;
  }
  enviarMensagem(chatId, `${saldo.quem_deve} deve R$ ${formatarMoedaTelegram(saldo.valor)} para ${outroUsuario(saldo.quem_deve)}.`);
}

function comandoResumo(chatId, usuario) {
  const dashboard = carregarDashboard(usuario, periodoAtual());
  const r = dashboard.resumo;
  const texto = [
    `*Resumo de ${r.periodo}*`,
    `Receitas: R$ ${formatarMoedaTelegram(r.receitas)}`,
    `Débitos: R$ ${formatarMoedaTelegram(r.debitos)}`,
    `Saldo: R$ ${formatarMoedaTelegram(r.saldo)}`,
  ].join('\n');
  enviarMensagem(chatId, texto);
}

function comandoHistorico(chatId, usuario) {
  const r = listarTransacoes(usuario, null);
  const itens = (r.transacoes || []).slice(0, 10);
  if (itens.length === 0) {
    enviarMensagem(chatId, 'Nenhum lançamento encontrado.');
    return;
  }
  const linhas = itens.map((t) => {
    const sinal = t.tipo === 'receita' ? '+' : '-';
    const valor = t.subtipo === 'dividido' ? t.valor_outro : t.valor_dono;
    return `${formatarDataTelegram(t.data)} — ${t.descricao} — ${sinal}R$ ${formatarMoedaTelegram(valor)}`;
  });
  enviarMensagem(chatId, ['*Últimos lançamentos:*', ...linhas].join('\n'));
}

function comandoCaixinhas(chatId) {
  const r = listarCaixinhas();
  if (!r.caixinhas || r.caixinhas.length === 0) {
    enviarMensagem(chatId, 'Nenhuma caixinha criada ainda.');
    return;
  }
  const linhas = r.caixinhas.map((c) => `${c.nome}: R$ ${formatarMoedaTelegram(c.saldo)} (${formatarMoedaTelegram(c.taxa_mensal)}% ao mês)`);
  enviarMensagem(chatId, ['*Caixinhas:*', ...linhas].join('\n'));
}

function comandoAcerto(chatId) {
  const saldo = calcularSaldoEntreUsuarios();
  if (saldo.quitado) {
    enviarMensagem(chatId, '🎉 Vocês já estão quites, nada pra acertar.');
    return;
  }
  salvarConversa(chatId, 'acerto', 'confirmacao', { quem_deve: saldo.quem_deve, valor: saldo.valor });
  enviarMensagem(
    chatId,
    `${saldo.quem_deve} deve R$ ${formatarMoedaTelegram(saldo.valor)} para ${outroUsuario(saldo.quem_deve)}. Confirma o acerto? Isso zera o saldo.`,
    tecladoInline([[{ texto: '✅ Confirmar', dado: 'acerto:sim' }, { texto: '❌ Cancelar', dado: 'acerto:nao' }]])
  );
}

function executarAcerto(chatId) {
  const conversa = obterConversa(chatId);
  if (!conversa || conversa.fluxo !== 'acerto') return;
  const de = conversa.dados.quem_deve;
  const para = outroUsuario(de);
  registrarAcerto({ valor: conversa.dados.valor, de: de, para: para });
  limparConversa(chatId);
  enviarMensagem(chatId, '✅ Acerto registrado! Saldo zerado.');
}

// ---------------------------------------------------------------------
// Fluxo guiado de lançamento (despesa pessoal / dividida / receita)
// ---------------------------------------------------------------------

function proximoCampoFaltante(fluxo, dados) {
  const campos = CAMPOS_FLUXO[fluxo] || [];
  for (const campo of campos) {
    if (dados[campo] === undefined || dados[campo] === null || dados[campo] === '') return campo;
  }
  return null;
}

function iniciarFluxoPorTexto(chatId, usuario, texto) {
  const opcoes = carregarOpcoesFormulario();
  const interpretado = interpretarTexto(texto, usuario, {
    descricoesPessoais: opcoes.descricoes,
    descricoesReceita: opcoes.descricoes_receita,
    categorias: opcoes.categorias,
  });

  const dados = {
    descricao: interpretado.descricao,
    categoria: interpretado.subtipo === 'receita' ? undefined : interpretado.categoria,
    valor_total: interpretado.valor_total,
    percentual_outro: interpretado.percentual_outro,
    forma_pagamento: null,
    data: interpretado.data ? interpretado.data.toISOString() : new Date().toISOString(),
  };

  avancarFluxo(chatId, usuario, interpretado.subtipo, dados);
}

function avancarFluxo(chatId, usuario, fluxo, dados) {
  const campoFaltante = proximoCampoFaltante(fluxo, dados);
  if (!campoFaltante) {
    salvarConversa(chatId, fluxo, 'confirmacao', dados);
    mostrarConfirmacao(chatId, fluxo, dados);
    return;
  }
  salvarConversa(chatId, fluxo, campoFaltante, dados);
  perguntarCampo(chatId, usuario, campoFaltante);
}

function perguntarCampo(chatId, usuario, campo) {
  const opcoes = carregarOpcoesFormulario();

  if (campo === 'categoria') {
    const botoes = agruparEmLinhas(opcoes.categorias.map((c) => ({ texto: c, dado: `resp:categoria:${c}` })), 2);
    enviarMensagem(chatId, 'Qual a categoria?', tecladoInline(botoes));
    return;
  }
  if (campo === 'forma_pagamento') {
    const botoes = agruparEmLinhas(opcoes.formas.map((f) => ({ texto: f, dado: `resp:forma_pagamento:${f}` })), 2);
    enviarMensagem(chatId, 'Qual a forma de pagamento?', tecladoInline(botoes));
    return;
  }
  if (campo === 'percentual_outro') {
    const outro = outroUsuario(usuario);
    enviarMensagem(chatId, `Quanto é a parte de ${outro}?`, tecladoInline([
      [{ texto: '50%', dado: 'resp:percentual_outro:50' }, { texto: '100%', dado: 'resp:percentual_outro:100' }],
    ]));
    return;
  }

  const perguntas = {
    descricao: 'Qual a descrição?',
    valor_total: 'Qual o valor total? (ex: 45,90)',
    data: 'Quando foi? (hoje, ontem, ou dd/mm)',
  };
  enviarMensagem(chatId, perguntas[campo] || `Informe ${campo}:`);
}

function processarRespostaEtapa(chatId, usuario, conversa, texto) {
  if (conversa.fluxo === 'aportar' || conversa.fluxo === 'resgatar') {
    processarRespostaMovimentoCaixinha(chatId, conversa, texto);
    return;
  }
  if (conversa.etapa === 'confirmacao') {
    // Usuário digitou algo em vez de tocar num botão — trata como novo lançamento
    limparConversa(chatId);
    iniciarFluxoPorTexto(chatId, usuario, texto);
    return;
  }
  aplicarRespostaCampo(chatId, usuario, conversa, conversa.etapa, texto);
}

function aplicarRespostaCampo(chatId, usuario, conversa, campo, valorBruto) {
  const dados = conversa.dados;

  if (campo === 'valor_total') {
    const valor = parseValorInputTelegram(valorBruto);
    if (!valor || isNaN(valor) || valor <= 0) {
      enviarMensagem(chatId, 'Não entendi o valor. Tente algo como 45,90.');
      return;
    }
    dados.valor_total = valor;
  } else if (campo === 'percentual_outro') {
    const p = extrairPercentual(normalizarTexto(valorBruto)) || Number(valorBruto);
    if (!p || isNaN(p) || p <= 0 || p > 100) {
      enviarMensagem(chatId, 'Não entendi o percentual. Responda por ex. 50 ou 100.');
      return;
    }
    dados.percentual_outro = p;
  } else if (campo === 'data') {
    dados.data = extrairData(normalizarTexto(valorBruto)).toISOString();
  } else {
    dados[campo] = String(valorBruto).trim();
  }

  avancarFluxo(chatId, usuario, conversa.fluxo, dados);
}

function mostrarConfirmacao(chatId, fluxo, dados) {
  const rotulo = { pessoal: 'Despesa pessoal', dividido: 'Despesa dividida', receita: 'Receita' }[fluxo];
  const linhas = [`*${rotulo}*`, `Descrição: ${dados.descricao}`];
  if (dados.categoria) linhas.push(`Categoria: ${dados.categoria}`);
  linhas.push(`Valor total: R$ ${formatarMoedaTelegram(dados.valor_total)}`);
  if (fluxo === 'dividido') {
    linhas.push(`Parte do outro: ${dados.percentual_outro}%`);
    if (dados.forma_pagamento) linhas.push(`Forma de pagamento: ${dados.forma_pagamento}`);
  }
  linhas.push(`Data: ${formatarDataTelegram(dados.data)}`);
  linhas.push('', 'Confirma?');
  enviarMensagem(chatId, linhas.join('\n'), tecladoInline([
    [{ texto: '✅ Confirmar', dado: 'conf:sim' }, { texto: '❌ Cancelar', dado: 'conf:nao' }],
  ]));
}

function confirmarESalvarLancamento(chatId, usuario) {
  const conversa = obterConversa(chatId);
  if (!conversa || conversa.etapa !== 'confirmacao') return;

  const dados = conversa.dados;
  const outro = outroUsuario(usuario);
  const totalNum = Number(dados.valor_total) || 0;
  const percentual = Number(dados.percentual_outro) || 50;
  const dividido = conversa.fluxo === 'dividido';
  const valorOutro = dividido ? arredondar2Telegram((totalNum * percentual) / 100) : '';
  const minhaParte = dividido ? arredondar2Telegram(totalNum - valorOutro) : totalNum;

  criarTransacao({
    tipo: conversa.fluxo === 'receita' ? 'receita' : 'debito',
    subtipo: conversa.fluxo,
    descricao: dados.descricao,
    categoria: conversa.fluxo === 'receita' ? '' : (dados.categoria || ''),
    forma_pagamento: dividido ? (dados.forma_pagamento || '') : '',
    dono: usuario,
    valor_dono: minhaParte,
    dividido_com: dividido ? outro : '',
    valor_outro: dividido ? valorOutro : '',
    periodo: periodoAtual(),
    data: dados.data,
  });

  limparConversa(chatId);
  enviarMensagem(chatId, '✅ Lançado com sucesso!');
}

// ---------------------------------------------------------------------
// Aportar / resgatar caixinha via chat
// ---------------------------------------------------------------------

function iniciarMovimentoCaixinha(chatId, usuario, tipo, resto) {
  const textoResto = (resto || '').trim();
  const matchValor = textoResto.match(/(\d+(?:[.,]\d{1,2})?)\s*$/);
  const valorTexto = matchValor ? matchValor[1] : null;
  const nomeTexto = matchValor ? textoResto.slice(0, matchValor.index).trim() : textoResto;

  const r = listarCaixinhas();
  const nomes = (r.caixinhas || []).map((c) => c.nome);
  const nomeEncontrado = nomeTexto ? encontrarMaisParecido(normalizarTexto(nomeTexto), nomes, 0.34) : null;
  const caixinha = (r.caixinhas || []).find((c) => c.nome === nomeEncontrado);
  const valor = valorTexto ? parseValorInputTelegram(valorTexto) : null;

  if (caixinha && valor) {
    executarMovimentoCaixinhaDireto(chatId, caixinha.id, tipo, valor);
    return;
  }

  const dadosParciais = {
    caixinha_id: caixinha ? caixinha.id : null,
    caixinha_nome: caixinha ? caixinha.nome : null,
    valor: valor,
    tipo_movimento: tipo,
  };

  if (!caixinha) {
    salvarConversa(chatId, tipo === 'aporte' ? 'aportar' : 'resgatar', 'nome_caixinha', dadosParciais);
    const listaTexto = nomes.length ? `Caixinhas existentes: ${nomes.join(', ')}.` : 'Você ainda não tem caixinhas — crie uma pelo app primeiro.';
    enviarMensagem(chatId, `Qual caixinha? ${listaTexto}`);
    return;
  }

  salvarConversa(chatId, tipo === 'aporte' ? 'aportar' : 'resgatar', 'valor_caixinha', dadosParciais);
  enviarMensagem(chatId, `Quanto você quer ${tipo === 'aporte' ? 'aportar' : 'resgatar'} em "${caixinha.nome}"?`);
}

function processarRespostaMovimentoCaixinha(chatId, conversa, texto) {
  const dados = conversa.dados;
  const tipo = dados.tipo_movimento;

  if (conversa.etapa === 'nome_caixinha') {
    const r = listarCaixinhas();
    const nomes = (r.caixinhas || []).map((c) => c.nome);
    const nomeEncontrado = encontrarMaisParecido(normalizarTexto(texto), nomes, 0.34);
    const caixinha = (r.caixinhas || []).find((c) => c.nome === nomeEncontrado);
    if (!caixinha) {
      enviarMensagem(chatId, `Não achei essa caixinha. Opções: ${nomes.join(', ') || '(nenhuma cadastrada ainda)'}`);
      return;
    }
    dados.caixinha_id = caixinha.id;
    dados.caixinha_nome = caixinha.nome;
    if (dados.valor) {
      executarMovimentoCaixinhaDireto(chatId, dados.caixinha_id, tipo, dados.valor);
      return;
    }
    salvarConversa(chatId, conversa.fluxo, 'valor_caixinha', dados);
    enviarMensagem(chatId, `Quanto você quer ${tipo === 'aporte' ? 'aportar' : 'resgatar'} em "${caixinha.nome}"?`);
    return;
  }

  if (conversa.etapa === 'valor_caixinha') {
    const valor = parseValorInputTelegram(texto);
    if (!valor || isNaN(valor) || valor <= 0) {
      enviarMensagem(chatId, 'Não entendi o valor. Tente de novo (ex: 100).');
      return;
    }
    executarMovimentoCaixinhaDireto(chatId, dados.caixinha_id, tipo, valor);
  }
}

function executarMovimentoCaixinhaDireto(chatId, caixinhaId, tipo, valor) {
  const r = movimentarCaixinha({ caixinha_id: caixinhaId, tipo: tipo, valor: valor });
  limparConversa(chatId);
  if (!r.sucesso) {
    enviarMensagem(chatId, `Não foi possível: ${r.erro}`);
    return;
  }
  enviarMensagem(chatId, `✅ ${tipo === 'aporte' ? 'Aportado' : 'Resgatado'}! Novo saldo: R$ ${formatarMoedaTelegram(r.saldo)}`);
}
