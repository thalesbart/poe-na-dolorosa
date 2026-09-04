/**
 * Acertos.gs
 * Lógica de cálculo de saldo entre os dois usuários e registro de acertos.
 *
 * Colunas da aba "acertos":
 * id | data | valor | de | para
 */

const COL_ACERTO = { ID: 0, DATA: 1, VALOR: 2, DE: 3, PARA: 4 };

function garantirCabecalhoAcertos() {
  const sheet = getSheet(SHEET_NAMES.ACERTOS);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['id', 'data', 'valor', 'de', 'para']);
  }
}

/**
 * Calcula quanto cada um deve para o outro, considerando:
 *  - todas as transações divididas (subtipo = "dividido")
 *  - menos os acertos já registrados
 *
 * Retorna: { thales_deve, tamires_deve, saldo_liquido, quem_deve, valor }
 * saldo_liquido positivo = Tamires deve para Thales
 * saldo_liquido negativo = Thales deve para Tamires
 */
function calcularSaldoEntreUsuarios() {
  garantirCabecalho();
  garantirCabecalhoAcertos();

  const sheetT = getSheet(SHEET_NAMES.TRANSACOES);
  const transacoes = sheetT.getDataRange().getValues().slice(1).map(linhaParaObjeto)
    .filter(t => t.subtipo === 'dividido');

  // Soma o que cada dono "adiantou" para o outro
  let thalesAdiantouParaTamires = 0;
  let tamiresAdiantouParaThales = 0;

  transacoes.forEach(t => {
    const valorOutro = Number(t.valor_outro) || 0;
    if (t.dono === 'Thales' && t.dividido_com === 'Tamires') {
      thalesAdiantouParaTamires += valorOutro;
    } else if (t.dono === 'Tamires' && t.dividido_com === 'Thales') {
      tamiresAdiantouParaThales += valorOutro;
    }
  });

  // Saldo bruto: positivo = Tamires deve a Thales
  let saldo = thalesAdiantouParaTamires - tamiresAdiantouParaThales;

  // Aplica acertos já registrados
  const sheetA = getSheet(SHEET_NAMES.ACERTOS);
  const acertos = sheetA.getDataRange().getValues().slice(1);
  acertos.forEach(a => {
    const valor = Number(a[COL_ACERTO.VALOR]) || 0;
    const de = a[COL_ACERTO.DE];
    const para = a[COL_ACERTO.PARA];
    // Se Tamires pagou para Thales, reduz o saldo (Tamires deve menos)
    if (de === 'Tamires' && para === 'Thales') {
      saldo -= valor;
    } else if (de === 'Thales' && para === 'Tamires') {
      saldo += valor;
    }
  });

  const quemDeve = saldo > 0 ? 'Tamires' : saldo < 0 ? 'Thales' : null;
  const valorAbsoluto = Math.abs(saldo);

  return {
    saldo_liquido: saldo,
    quem_deve: quemDeve,
    valor: valorAbsoluto,
    quitado: valorAbsoluto < 0.01,
  };
}

/**
 * Registra um acerto (pagamento) entre os dois usuários.
 * body esperado: { valor, de, para }
 *
 * Também vincula ao acerto todas as despesas divididas ainda sem
 * acerto_id (ou seja, pendentes até agora), para que a tela de Acerto
 * consiga mostrar depois quais lançamentos foram quitados por ele.
 */
function registrarAcerto(body) {
  garantirCabecalhoAcertos();
  garantirCabecalho();
  const sheet = getSheet(SHEET_NAMES.ACERTOS);
  const id = gerarId();
  const data = new Date().toISOString();

  sheet.appendRow([id, data, body.valor, body.de, body.para]);

  const sheetT = getSheet(SHEET_NAMES.TRANSACOES);
  const dadosT = sheetT.getDataRange().getValues();
  for (let i = 1; i < dadosT.length; i++) {
    const linha = dadosT[i];
    if (linha[COL.SUBTIPO] === 'dividido' && !linha[COL.ACERTO_ID]) {
      sheetT.getRange(i + 1, COL.ACERTO_ID + 1).setValue(id);
    }
  }

  notificarUsuario(
    body.para,
    'Acerto registrado',
    `${body.de} registrou um acerto de R$ ${Number(body.valor).toFixed(2)}`
  );

  return { sucesso: true, id: id };
}

/**
 * Lista todos os acertos já realizados, do mais recente para o mais antigo.
 */
function listarAcertos() {
  garantirCabecalhoAcertos();
  const sheet = getSheet(SHEET_NAMES.ACERTOS);
  const dados = sheet.getDataRange().getValues().slice(1);

  const acertos = dados
    .filter(a => a[COL_ACERTO.ID])
    .map(a => ({
      id: a[COL_ACERTO.ID],
      data: a[COL_ACERTO.DATA],
      valor: a[COL_ACERTO.VALOR],
      de: a[COL_ACERTO.DE],
      para: a[COL_ACERTO.PARA],
    }))
    .sort((a, b) => new Date(b.data) - new Date(a.data));

  return { acertos: acertos };
}
