/**
 * Auxiliares.gs
 * Funções para listas simples (descrições pessoais, formas de pagamento),
 * cadastro de usuários/tokens e envio de notificações push via Expo.
 */

/**
 * Lista valores de uma aba "simples" (uma coluna só, com cabeçalho).
 * Usado para descricoes_pessoais, formas_pagamento e categorias.
 * Se a aba "categorias" estiver vazia, popula com valores padrão na primeira vez.
 */
function listarSimples(nomeAba, nomeColuna) {
  const sheet = getSheet(nomeAba);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([nomeColuna]);
    if (nomeAba === SHEET_NAMES.CATEGORIAS) {
      const padrao = ['Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Moradia', 'Custos Fixos', 'Outros'];
      padrao.forEach(c => sheet.appendRow([c]));
      return { valores: padrao };
    }
    return { valores: [] };
  }
  const dados = sheet.getDataRange().getValues().slice(1);
  const valores = dados.map(row => row[0]).filter(v => v !== '');
  return { valores: valores };
}

/**
 * Combina descrições pessoais, descrições de receita, formas de pagamento
 * e categorias numa única execução, para a tela de lançamento carregar
 * com 1 requisição em vez de 4.
 */
function carregarOpcoesFormulario() {
  return {
    descricoes: listarSimples(SHEET_NAMES.DESCRICOES, 'descricao').valores,
    descricoes_receita: listarSimples(SHEET_NAMES.DESCRICOES_RECEITA, 'descricao').valores,
    formas: listarSimples(SHEET_NAMES.FORMAS, 'forma').valores,
    categorias: listarSimples(SHEET_NAMES.CATEGORIAS, 'categoria').valores,
  };
}

/**
 * Cadastra um novo valor em uma aba "simples", evitando duplicados.
 * body: { valor }
 */
function cadastrarSimples(nomeAba, nomeColuna, valor) {
  const sheet = getSheet(nomeAba);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([nomeColuna]);
  }
  const existentes = sheet.getDataRange().getValues().slice(1).map(r => r[0]);
  if (existentes.indexOf(valor) === -1) {
    sheet.appendRow([valor]);
  }
  return { sucesso: true, valor: valor };
}

/**
 * Garante que a aba "usuarios" tenha as colunas nome | expo_push_token | foto_url
 * e retorna { sheet, linha } para o usuário informado (cria a linha se não existir).
 */
function encontrarOuCriarLinhaUsuario(usuario) {
  const sheet = getSheet(SHEET_NAMES.USUARIOS);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['nome', 'expo_push_token', 'foto_url']);
  }
  const dados = sheet.getDataRange().getValues();
  for (let i = 1; i < dados.length; i++) {
    if (dados[i][0] === usuario) {
      return { sheet: sheet, linha: i + 1 };
    }
  }
  sheet.appendRow([usuario, '', '']);
  return { sheet: sheet, linha: sheet.getLastRow() };
}

/**
 * Salva ou atualiza o token de push notification de um usuário.
 * body: { usuario, token }
 */
function salvarTokenPush(body) {
  const { sheet, linha } = encontrarOuCriarLinhaUsuario(body.usuario);
  const jaTinhaToken = !!sheet.getRange(linha, 2).getValue();
  sheet.getRange(linha, 2).setValue(body.token);
  return { sucesso: true, atualizado: jaTinhaToken };
}

/**
 * Salva a foto de perfil de um usuário: recebe a imagem em base64,
 * grava como arquivo no Google Drive (pasta "Poe na Dolorosa - Fotos de Perfil",
 * criada automaticamente na primeira vez) e guarda a URL pública na aba "usuarios".
 * body: { usuario, imagem_base64, mime_type }
 */
function salvarFotoPerfil(body) {
  const NOME_PASTA = 'Poe na Dolorosa - Fotos de Perfil';
  const pastas = DriveApp.getFoldersByName(NOME_PASTA);
  const pasta = pastas.hasNext() ? pastas.next() : DriveApp.createFolder(NOME_PASTA);

  const mimeType = body.mime_type || 'image/jpeg';
  const bytes = Utilities.base64Decode(body.imagem_base64);
  const blob = Utilities.newBlob(bytes, mimeType, body.usuario + '.jpg');

  // Remove foto antiga do mesmo usuário, se existir, para não acumular lixo no Drive
  const antigos = pasta.getFilesByName(body.usuario + '.jpg');
  while (antigos.hasNext()) {
    antigos.next().setTrashed(true);
  }

  const arquivo = pasta.createFile(blob);
  arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // URL direta que funciona embutida em <Image> no app
  const url = 'https://lh3.googleusercontent.com/d/' + arquivo.getId();

  const { sheet, linha } = encontrarOuCriarLinhaUsuario(body.usuario);
  sheet.getRange(linha, 3).setValue(url);

  return { sucesso: true, url: url };
}

/**
 * Lista as fotos de perfil de todos os usuários cadastrados.
 * Retorna: { fotos: { "Thales": "https://...", "Tamires": "https://..." } }
 */
function listarFotosPerfil() {
  const sheet = getSheet(SHEET_NAMES.USUARIOS);
  if (sheet.getLastRow() === 0) return { fotos: {} };
  const dados = sheet.getDataRange().getValues().slice(1);
  const fotos = {};
  dados.forEach(row => {
    if (row[0] && row[2]) fotos[row[0]] = row[2];
  });
  return { fotos: fotos };
}

/**
 * Busca o token de push de um usuário pelo nome.
 */
function buscarTokenPush(usuario) {
  const sheet = getSheet(SHEET_NAMES.USUARIOS);
  if (sheet.getLastRow() === 0) return null;
  const dados = sheet.getDataRange().getValues();
  for (let i = 1; i < dados.length; i++) {
    if (dados[i][0] === usuario) {
      return dados[i][1];
    }
  }
  return null;
}

/**
 * Envia uma notificação push via Expo Push API.
 * Gratuito, sem necessidade de credenciais.
 */
function notificarUsuario(usuario, titulo, corpo) {
  const token = buscarTokenPush(usuario);
  if (!token) return; // usuário ainda não abriu o app / não tem token salvo

  const payload = {
    to: token,
    title: titulo,
    body: corpo,
    sound: 'default',
  };

  try {
    UrlFetchApp.fetch('https://exp.host/--/api/v2/push/send', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
  } catch (err) {
    // Falha silenciosa — não deve travar a criação da transação
    console.error('Erro ao enviar push: ' + err.message);
  }
}
