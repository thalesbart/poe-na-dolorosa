/**
 * Põe na Dolorosa API — Google Apps Script
 * ------------------------------------
 * Backend gratuito que roda sobre uma planilha Google Sheets.
 * Publique como "Web App" (Implantar > Nova implantação > App da Web)
 *   - Executar como: Eu
 *   - Quem tem acesso: Qualquer pessoa
 *
 * Abas esperadas na planilha:
 *   transacoes, acertos, descricoes_pessoais, formas_pagamento, usuarios
 */

const SHEET_NAMES = {
  TRANSACOES: 'transacoes',
  ACERTOS: 'acertos',
  DESCRICOES: 'descricoes_pessoais',
  DESCRICOES_RECEITA: 'descricoes_receita',
  FORMAS: 'formas_pagamento',
  CATEGORIAS: 'categorias',
  USUARIOS: 'usuarios',
};

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function periodoAtual() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function gerarId() {
  return Utilities.getUuid();
}

/**
 * GET /exec?action=...
 * Ações disponíveis:
 *  - transacoes        -> lista transações (filtra por usuario, periodo opcional)
 *  - descricoes        -> lista descrições pessoais cadastradas
 *  - formas             -> lista formas de pagamento cadastradas
 *  - saldo               -> saldo entre os dois usuários
 *  - resumo               -> resumo do dashboard (receitas, débitos, saldo do mês)
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    const usuario = e.parameter.usuario;
    // Só usamos o período atual como padrão quando o parâmetro realmente
    // não foi enviado. Se o app mandar periodo vazio/ausente de propósito
    // (para listar todos os períodos no Histórico), respeitamos isso.
    const periodoParam = e.parameter.periodo;
    const periodoVazio = !periodoParam || periodoParam === 'null' || periodoParam === 'undefined';

    switch (action) {
      case 'transacoes':
        // Para "transacoes", período vazio significa "todos os períodos"
        return jsonResponse(listarTransacoes(usuario, periodoVazio ? null : periodoParam));
      case 'descricoes':
        return jsonResponse(listarSimples(SHEET_NAMES.DESCRICOES, 'descricao'));
      case 'descricoes_receita':
        return jsonResponse(listarSimples(SHEET_NAMES.DESCRICOES_RECEITA, 'descricao'));
      case 'formas':
        return jsonResponse(listarSimples(SHEET_NAMES.FORMAS, 'forma'));
      case 'categorias':
        return jsonResponse(listarSimples(SHEET_NAMES.CATEGORIAS, 'categoria'));
      case 'saldo':
        return jsonResponse(calcularSaldoEntreUsuarios());
      case 'acertos':
        return jsonResponse(listarAcertos());
      case 'despesas_acerto':
        return jsonResponse(listarDespesasAcerto(e.parameter.acerto_id));
      case 'resumo':
        // Resumo sempre precisa de um período concreto — usa o atual se vazio
        return jsonResponse(calcularResumo(usuario, periodoVazio ? periodoAtual() : periodoParam));
      case 'dashboard':
        // Combina resumo + saldo + transações recentes numa única execução,
        // evitando 3 chamadas separadas (cada uma paga o "cold start" do Apps Script)
        return jsonResponse(carregarDashboard(usuario, periodoVazio ? periodoAtual() : periodoParam));
      case 'opcoes_formulario':
        // Combina descrições, descrições de receita, formas e categorias numa única execução
        return jsonResponse(carregarOpcoesFormulario());
      case 'fotos_perfil':
        return jsonResponse(listarFotosPerfil());
      default:
        return jsonResponse({ erro: 'Ação GET desconhecida: ' + action });
    }
  } catch (err) {
    return jsonResponse({ erro: err.message });
  }
}

/**
 * POST /exec
 * Body JSON: { action: "...", ...dados }
 * Ações disponíveis:
 *  - criar_transacao
 *  - editar_transacao
 *  - excluir_transacao
 *  - registrar_acerto
 *  - fechar_periodo
 *  - cadastrar_descricao
 *  - cadastrar_forma
 *  - salvar_token_push
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    switch (action) {
      case 'criar_transacao':
        return jsonResponse(criarTransacao(body));
      case 'editar_transacao':
        return jsonResponse(editarTransacao(body));
      case 'excluir_transacao':
        return jsonResponse(excluirTransacao(body));
      case 'registrar_acerto':
        return jsonResponse(registrarAcerto(body));
      case 'fechar_periodo':
        return jsonResponse(fecharPeriodo(body));
      case 'cadastrar_descricao':
        return jsonResponse(cadastrarSimples(SHEET_NAMES.DESCRICOES, 'descricao', body.valor));
      case 'cadastrar_descricao_receita':
        return jsonResponse(cadastrarSimples(SHEET_NAMES.DESCRICOES_RECEITA, 'descricao', body.valor));
      case 'cadastrar_forma':
        return jsonResponse(cadastrarSimples(SHEET_NAMES.FORMAS, 'forma', body.valor));
      case 'cadastrar_categoria':
        return jsonResponse(cadastrarSimples(SHEET_NAMES.CATEGORIAS, 'categoria', body.valor));
      case 'salvar_token_push':
        return jsonResponse(salvarTokenPush(body));
      case 'salvar_foto_perfil':
        return jsonResponse(salvarFotoPerfil(body));
      default:
        return jsonResponse({ erro: 'Ação POST desconhecida: ' + action });
    }
  } catch (err) {
    return jsonResponse({ erro: err.message });
  }
}
