/**
 * Caixinhas.gs
 * "Caixinhas" de investimento: cada uma tem um saldo e uma taxa de
 * rendimento mensal (%) configurável. O rendimento é calculado por juros
 * compostos mensais — sempre que a lista é carregada ou a caixinha é
 * movimentada, verificamos quantos meses completos se passaram desde o
 * último cálculo e aplicamos a taxa sobre o saldo esse número de vezes.
 *
 * Colunas da aba "caixinhas":
 * id | nome | taxa_mensal | saldo | data_criacao | data_ultimo_rendimento
 *
 * Colunas da aba "caixinha_movimentos" (histórico p/ mostrar evolução):
 * id | caixinha_id | tipo (aporte|resgate|rendimento) | valor | saldo_apos | data
 */

const COL_CAIXINHA = {
  ID: 0, NOME: 1, TAXA_MENSAL: 2, SALDO: 3, DATA_CRIACAO: 4, DATA_ULTIMO_RENDIMENTO: 5,
};
const COL_MOVIMENTO = { ID: 0, CAIXINHA_ID: 1, TIPO: 2, VALOR: 3, SALDO_APOS: 4, DATA: 5 };

function garantirCabecalhoCaixinhas() {
  const sheet = getSheet(SHEET_NAMES.CAIXINHAS);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['id', 'nome', 'taxa_mensal', 'saldo', 'data_criacao', 'data_ultimo_rendimento']);
  }
  const sheetMov = getSheet(SHEET_NAMES.CAIXINHA_MOVIMENTOS);
  if (sheetMov.getLastRow() === 0) {
    sheetMov.appendRow(['id', 'caixinha_id', 'tipo', 'valor', 'saldo_apos', 'data']);
  }
}

function linhaParaCaixinha(row) {
  return {
    id: row[COL_CAIXINHA.ID],
    nome: row[COL_CAIXINHA.NOME],
    taxa_mensal: row[COL_CAIXINHA.TAXA_MENSAL],
    saldo: row[COL_CAIXINHA.SALDO],
    data_criacao: row[COL_CAIXINHA.DATA_CRIACAO],
    data_ultimo_rendimento: row[COL_CAIXINHA.DATA_ULTIMO_RENDIMENTO],
  };
}

function arredondar2Caixinha(valor) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/**
 * Conta quantos meses completos se passaram entre duas datas, baseado
 * no dia do mês (ex: de 15/jan pra 14/fev ainda não fechou 1 mês).
 */
function mesesCompletosEntre(dataInicial, dataFinal) {
  let meses = (dataFinal.getFullYear() - dataInicial.getFullYear()) * 12 +
    (dataFinal.getMonth() - dataInicial.getMonth());
  if (dataFinal.getDate() < dataInicial.getDate()) meses -= 1;
  return Math.max(0, meses);
}

function somarMeses(data, meses) {
  const d = new Date(data);
  d.setMonth(d.getMonth() + meses);
  return d;
}

function registrarMovimentoInterno(sheetMov, caixinhaId, tipo, valor, saldoApos, data) {
  sheetMov.appendRow([gerarId(), caixinhaId, tipo, valor, saldoApos, data.toISOString()]);
}

/**
 * Se já se passou 1 mês ou mais desde o último cálculo, aplica juros
 * compostos mensais sobre o saldo da caixinha (uma vez por mês completo
 * decorrido), registra um movimento "rendimento" e atualiza a linha na
 * planilha. Retorna o objeto da caixinha já atualizado.
 */
function aplicarRendimentoCaixinha(sheet, sheetMov, linhaSheet, caixinha) {
  const agora = new Date();
  const dataUltimo = new Date(caixinha.data_ultimo_rendimento);
  const meses = mesesCompletosEntre(dataUltimo, agora);
  if (meses <= 0) return caixinha;

  const taxaDecimal = (Number(caixinha.taxa_mensal) || 0) / 100;
  const saldoAntigo = Number(caixinha.saldo) || 0;
  const novoSaldo = arredondar2Caixinha(saldoAntigo * Math.pow(1 + taxaDecimal, meses));
  const novaData = somarMeses(dataUltimo, meses);

  if (novoSaldo !== saldoAntigo) {
    registrarMovimentoInterno(sheetMov, caixinha.id, 'rendimento', arredondar2Caixinha(novoSaldo - saldoAntigo), novoSaldo, novaData);
  }

  sheet.getRange(linhaSheet, COL_CAIXINHA.SALDO + 1).setValue(novoSaldo);
  sheet.getRange(linhaSheet, COL_CAIXINHA.DATA_ULTIMO_RENDIMENTO + 1).setValue(novaData.toISOString());

  return Object.assign({}, caixinha, { saldo: novoSaldo, data_ultimo_rendimento: novaData.toISOString() });
}

/**
 * Cria uma nova caixinha de investimento.
 * body esperado: { nome, taxa_mensal, saldo_inicial }
 */
function criarCaixinha(body) {
  garantirCabecalhoCaixinhas();
  const sheet = getSheet(SHEET_NAMES.CAIXINHAS);
  const sheetMov = getSheet(SHEET_NAMES.CAIXINHA_MOVIMENTOS);
  const id = gerarId();
  const agora = new Date();
  const saldoInicial = arredondar2Caixinha(Number(body.saldo_inicial) || 0);

  sheet.appendRow([id, body.nome, Number(body.taxa_mensal) || 0, saldoInicial, agora.toISOString(), agora.toISOString()]);

  if (saldoInicial > 0) {
    registrarMovimentoInterno(sheetMov, id, 'aporte', saldoInicial, saldoInicial, agora);
  }

  return { sucesso: true, id: id };
}

/**
 * Lista todas as caixinhas, aplicando antes o rendimento pendente de
 * cada uma (juros compostos mensais sobre a taxa configurada).
 */
function listarCaixinhas() {
  garantirCabecalhoCaixinhas();
  const sheet = getSheet(SHEET_NAMES.CAIXINHAS);
  const sheetMov = getSheet(SHEET_NAMES.CAIXINHA_MOVIMENTOS);
  const dados = sheet.getDataRange().getValues();

  const caixinhas = [];
  for (let i = 1; i < dados.length; i++) {
    if (!dados[i][COL_CAIXINHA.ID]) continue;
    let caixinha = linhaParaCaixinha(dados[i]);
    caixinha = aplicarRendimentoCaixinha(sheet, sheetMov, i + 1, caixinha);
    caixinhas.push(caixinha);
  }

  return { caixinhas: caixinhas };
}

/**
 * Registra um aporte ou resgate numa caixinha (aplica o rendimento
 * pendente antes, pra manter a ordem cronológica correta na evolução).
 * body esperado: { caixinha_id, tipo: "aporte" | "resgate", valor }
 */
function movimentarCaixinha(body) {
  garantirCabecalhoCaixinhas();
  const sheet = getSheet(SHEET_NAMES.CAIXINHAS);
  const sheetMov = getSheet(SHEET_NAMES.CAIXINHA_MOVIMENTOS);
  const dados = sheet.getDataRange().getValues();

  for (let i = 1; i < dados.length; i++) {
    if (dados[i][COL_CAIXINHA.ID] !== body.caixinha_id) continue;

    let caixinha = linhaParaCaixinha(dados[i]);
    caixinha = aplicarRendimentoCaixinha(sheet, sheetMov, i + 1, caixinha);

    const valor = arredondar2Caixinha(Number(body.valor) || 0);
    const saldoAtual = Number(caixinha.saldo) || 0;
    if (body.tipo === 'resgate' && valor > saldoAtual) {
      return { sucesso: false, erro: 'Saldo insuficiente para esse resgate.' };
    }

    const novoSaldo = arredondar2Caixinha(body.tipo === 'resgate' ? saldoAtual - valor : saldoAtual + valor);
    sheet.getRange(i + 1, COL_CAIXINHA.SALDO + 1).setValue(novoSaldo);

    const agora = new Date();
    registrarMovimentoInterno(sheetMov, body.caixinha_id, body.tipo, valor, novoSaldo, agora);

    return { sucesso: true, saldo: novoSaldo };
  }

  return { sucesso: false, erro: 'Caixinha não encontrada.' };
}

/**
 * Lista os movimentos (aportes, resgates, rendimentos) de uma caixinha,
 * do mais recente para o mais antigo — usado pra mostrar a evolução.
 */
function listarMovimentosCaixinha(caixinhaId) {
  garantirCabecalhoCaixinhas();
  const sheet = getSheet(SHEET_NAMES.CAIXINHA_MOVIMENTOS);
  const dados = sheet.getDataRange().getValues().slice(1);

  const movimentos = dados
    .filter(m => m[COL_MOVIMENTO.CAIXINHA_ID] === caixinhaId)
    .map(m => ({
      id: m[COL_MOVIMENTO.ID],
      caixinha_id: m[COL_MOVIMENTO.CAIXINHA_ID],
      tipo: m[COL_MOVIMENTO.TIPO],
      valor: m[COL_MOVIMENTO.VALOR],
      saldo_apos: m[COL_MOVIMENTO.SALDO_APOS],
      data: m[COL_MOVIMENTO.DATA],
    }))
    .sort((a, b) => new Date(b.data) - new Date(a.data));

  return { movimentos: movimentos };
}

/**
 * Edita nome e/ou taxa mensal de uma caixinha (não mexe no saldo).
 * body esperado: { id, nome, taxa_mensal }
 */
function editarCaixinha(body) {
  garantirCabecalhoCaixinhas();
  const sheet = getSheet(SHEET_NAMES.CAIXINHAS);
  const dados = sheet.getDataRange().getValues();
  for (let i = 1; i < dados.length; i++) {
    if (dados[i][COL_CAIXINHA.ID] === body.id) {
      if (body.nome !== undefined) sheet.getRange(i + 1, COL_CAIXINHA.NOME + 1).setValue(body.nome);
      if (body.taxa_mensal !== undefined) {
        sheet.getRange(i + 1, COL_CAIXINHA.TAXA_MENSAL + 1).setValue(Number(body.taxa_mensal) || 0);
      }
      return { sucesso: true };
    }
  }
  return { sucesso: false, erro: 'Caixinha não encontrada.' };
}

/**
 * Exclui uma caixinha e todo o seu histórico de movimentos.
 * body esperado: { id }
 */
function excluirCaixinha(body) {
  garantirCabecalhoCaixinhas();
  const sheet = getSheet(SHEET_NAMES.CAIXINHAS);
  const dados = sheet.getDataRange().getValues();
  let linhaEncontrada = -1;
  for (let i = 1; i < dados.length; i++) {
    if (dados[i][COL_CAIXINHA.ID] === body.id) {
      linhaEncontrada = i + 1;
      break;
    }
  }
  if (linhaEncontrada === -1) return { sucesso: false, erro: 'Caixinha não encontrada.' };
  sheet.deleteRow(linhaEncontrada);

  const sheetMov = getSheet(SHEET_NAMES.CAIXINHA_MOVIMENTOS);
  const dadosMov = sheetMov.getDataRange().getValues();
  for (let i = dadosMov.length - 1; i >= 1; i--) {
    if (dadosMov[i][COL_MOVIMENTO.CAIXINHA_ID] === body.id) {
      sheetMov.deleteRow(i + 1);
    }
  }

  return { sucesso: true };
}
