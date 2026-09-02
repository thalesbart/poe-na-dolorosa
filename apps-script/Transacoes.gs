/**
 * Transacoes.gs
 * Lógica de criação, leitura, edição e exclusão de transações.
 *
 * Colunas da aba "transacoes" (nesta ordem):
 * id | data | tipo | subtipo | descricao | categoria | forma_pagamento |
 * dono | valor_dono | dividido_com | valor_outro | periodo | status_periodo
 */

const COL = {
  ID: 0, DATA: 1, TIPO: 2, SUBTIPO: 3, DESCRICAO: 4, CATEGORIA: 5,
  FORMA: 6, DONO: 7, VALOR_DONO: 8, DIVIDIDO_COM: 9, VALOR_OUTRO: 10,
  PERIODO: 11, STATUS_PERIODO: 12,
};

function garantirCabecalho() {
  const sheet = getSheet(SHEET_NAMES.TRANSACOES);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'id', 'data', 'tipo', 'subtipo', 'descricao', 'categoria',
      'forma_pagamento', 'dono', 'valor_dono', 'dividido_com',
      'valor_outro', 'periodo', 'status_periodo',
    ]);
  }
}

function normalizarPeriodo(periodo) {
  if (!periodo) return periodoAtual();
  // Se for objeto Date (Google Sheets converte automaticamente)
  if (periodo instanceof Date) {
    return Utilities.formatDate(periodo, Session.getScriptTimeZone(), 'yyyy-MM');
  }
  // Se for string, pega só os primeiros 7 caracteres (ex: "2026-06")
  return String(periodo).substring(0, 7);
}

function linhaParaObjeto(row) {
  return {
    id: row[COL.ID],
    data: row[COL.DATA],
    tipo: row[COL.TIPO],
    subtipo: row[COL.SUBTIPO],
    descricao: row[COL.DESCRICAO],
    categoria: row[COL.CATEGORIA],
    forma_pagamento: row[COL.FORMA],
    dono: row[COL.DONO],
    valor_dono: row[COL.VALOR_DONO],
    dividido_com: row[COL.DIVIDIDO_COM],
    valor_outro: row[COL.VALOR_OUTRO],
    periodo: row[COL.PERIODO],
    status_periodo: row[COL.STATUS_PERIODO],
  };
}

/**
 * Lista transações visíveis para um usuário:
 *  - tudo que ele lançou (dono = usuario)
 *  - tudo que foi dividido com ele (dividido_com = usuario)
 * Filtra por período se informado.
 */
function listarTransacoes(usuario, periodo) {
  garantirCabecalho();
  const sheet = getSheet(SHEET_NAMES.TRANSACOES);
  const dados = sheet.getDataRange().getValues();
  const linhas = dados.slice(1); // remove cabeçalho

  const resultado = linhas
    .map(linhaParaObjeto)
    .filter(t => {
      const pertenceAoUsuario = t.dono === usuario || t.dividido_com === usuario;
      const periodoNormalizado = normalizarPeriodo(t.periodo);
      const noPeríodo = !periodo || periodoNormalizado === periodo;
      // Se filtrando por período específico, ignora transações fechadas
      const statusOk = !periodo || t.status_periodo !== 'fechado';
      return pertenceAoUsuario && noPeríodo && statusOk;
    })
    .sort((a, b) => new Date(b.data) - new Date(a.data));

  return { transacoes: resultado };
}

/**
 * Cria uma nova transação.
 * body esperado:
 * {
 *   tipo: "debito" | "receita",
 *   subtipo: "pessoal" | "dividido" | "receita",
 *   descricao, categoria, forma_pagamento,
 *   dono, valor_dono, dividido_com, valor_outro
 * }
 */
function criarTransacao(body) {
  garantirCabecalho();
  const sheet = getSheet(SHEET_NAMES.TRANSACOES);
  const id = gerarId();
  const data = body.data || new Date().toISOString();

  // Salva a linha e depois força a coluna período como texto
  // para evitar que o Google Sheets converta "2026-06" para Date
  const ultimaLinha = sheet.getLastRow();
  sheet.appendRow([
    id,
    data,
    body.tipo,
    body.subtipo,
    body.descricao,
    body.categoria || '',
    body.forma_pagamento || '',
    body.dono,
    body.valor_dono,
    body.dividido_com || '',
    body.valor_outro || '',
    periodoAtual(), // salva temporariamente
    'aberto',
  ]);
  // Força a célula do período (coluna 12, índice 11) como texto puro
  const celulasPeriodo = sheet.getRange(ultimaLinha + 1, 12);
  celulasPeriodo.setNumberFormat('@STRING@');
  celulasPeriodo.setValue(body.periodo || periodoAtual());

  // Notifica o outro usuário se foi dividido
  if (body.subtipo === 'dividido' && body.dividido_com) {
    notificarUsuario(
      body.dividido_com,
      'Novo gasto dividido',
      `${body.dono} lançou "${body.descricao}": R$ ${Number(body.valor_outro).toFixed(2)} para você`
    );
  }

  return { sucesso: true, id: id };
}

function encontrarLinhaPorId(sheet, id) {
  const dados = sheet.getDataRange().getValues();
  for (let i = 1; i < dados.length; i++) {
    if (dados[i][COL.ID] === id) {
      return i + 1; // +1 porque getRange é 1-indexed
    }
  }
  return -1;
}

/**
 * Edita uma transação existente.
 * body esperado: { id, ...campos a atualizar }
 */
function editarTransacao(body) {
  const sheet = getSheet(SHEET_NAMES.TRANSACOES);
  const linha = encontrarLinhaPorId(sheet, body.id);
  if (linha === -1) return { sucesso: false, erro: 'Transação não encontrada' };

  const atual = sheet.getRange(linha, 1, 1, 13).getValues()[0];

  const atualizado = [
    atual[COL.ID],
    body.data || atual[COL.DATA],
    body.tipo || atual[COL.TIPO],
    body.subtipo || atual[COL.SUBTIPO],
    body.descricao !== undefined ? body.descricao : atual[COL.DESCRICAO],
    body.categoria !== undefined ? body.categoria : atual[COL.CATEGORIA],
    body.forma_pagamento !== undefined ? body.forma_pagamento : atual[COL.FORMA],
    atual[COL.DONO], // dono não muda
    body.valor_dono !== undefined ? body.valor_dono : atual[COL.VALOR_DONO],
    body.dividido_com !== undefined ? body.dividido_com : atual[COL.DIVIDIDO_COM],
    body.valor_outro !== undefined ? body.valor_outro : atual[COL.VALOR_OUTRO],
    atual[COL.PERIODO],
    atual[COL.STATUS_PERIODO],
  ];

  sheet.getRange(linha, 1, 1, 13).setValues([atualizado]);
  return { sucesso: true };
}

/**
 * Exclui uma transação pelo id.
 * body esperado: { id }
 */
function excluirTransacao(body) {
  const sheet = getSheet(SHEET_NAMES.TRANSACOES);
  const linha = encontrarLinhaPorId(sheet, body.id);
  if (linha === -1) return { sucesso: false, erro: 'Transação não encontrada' };

  sheet.deleteRow(linha);
  return { sucesso: true };
}

/**
 * Fecha o período atual de um usuário: marca todas as transações
 * "pessoais" dele (dono = usuario) no período como status_periodo = "fechado".
 * Não fecha transações divididas pendentes — isso deve ser checado
 * no front-end via calcularSaldoEntreUsuarios() antes de chamar isso.
 */
function fecharPeriodo(body) {
  const sheet = getSheet(SHEET_NAMES.TRANSACOES);
  const dados = sheet.getDataRange().getValues();
  const periodo = body.periodo || periodoAtual();

  for (let i = 1; i < dados.length; i++) {
    const linha = dados[i];
    if (linha[COL.DONO] === body.usuario && linha[COL.PERIODO] === periodo) {
      sheet.getRange(i + 1, COL.STATUS_PERIODO + 1).setValue('fechado');
    }
  }

  return { sucesso: true, periodo_fechado: periodo };
}

/**
 * Calcula o resumo do dashboard para um usuário em um período:
 * receitas, débitos totais (próprios + parte dividida) e saldo.
 */
function calcularResumo(usuario, periodo) {
  garantirCabecalho();
  const sheet = getSheet(SHEET_NAMES.TRANSACOES);
  const dados = sheet.getDataRange().getValues();
  const linhas = dados.slice(1).map(linhaParaObjeto)
    .filter(t => normalizarPeriodo(t.periodo) === periodo && t.status_periodo !== 'fechado');

  let receitas = 0;
  let debitos = 0;

  linhas.forEach(t => {
    if (t.dono === usuario) {
      if (t.tipo === 'receita') {
        receitas += Number(t.valor_dono) || 0;
      } else if (t.tipo === 'debito') {
        // Minha parte vai para débitos
        debitos += Number(t.valor_dono) || 0;
        // Parte da outra pessoa vai para receitas (ela me deve)
        if (t.subtipo === 'dividido' && t.valor_outro) {
          receitas += Number(t.valor_outro) || 0;
        }
      }
    } else if (t.dividido_com === usuario) {
      // Recebi um gasto dividido — minha parte vai para débitos
      debitos += Number(t.valor_outro) || 0;
    }
  });

  return {
    receitas: receitas,
    debitos: debitos,
    saldo: receitas - debitos,
    periodo: periodo,
  };
}
