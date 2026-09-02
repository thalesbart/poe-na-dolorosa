/**
 * services/api.js
 * Camada de comunicação com o Google Apps Script (nosso backend gratuito).
 *
 * IMPORTANTE: substitua APPS_SCRIPT_URL pela URL gerada quando você
 * publicar o Apps Script como Web App.
 * Ex: https://script.google.com/macros/s/ABC123.../exec
 */

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbywxYsudged4iSjpXE--ndAjT5clZfg6E4EKsTQm0k96KfEmImvcZfBEqNcN28C4hnSdA/exec';

async function get(action, params = {}) {
  const paramsLimpos = Object.fromEntries(
    Object.entries({ action, ...params }).filter(([, v]) => v !== null && v !== undefined)
  );
  const query = new URLSearchParams(paramsLimpos).toString();
  const response = await fetch(`${APPS_SCRIPT_URL}?${query}`);
  if (!response.ok) {
    throw new Error(`Erro na requisição GET: ${response.status}`);
  }
  return response.json();
}

async function post(body) {
  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Erro na requisição POST: ${response.status}`);
  }
  return response.json();
}

export const api = {
  // ---- Leitura ----
  listarTransacoes: (usuario, periodo) => get('transacoes', { usuario, periodo }),
  listarDescricoes: () => get('descricoes'),
  listarDescricoesReceita: () => get('descricoes_receita'),
  listarFormasPagamento: () => get('formas'),
  listarCategorias: () => get('categorias'),
  buscarSaldo: () => get('saldo'),
  buscarResumo: (usuario, periodo) => get('resumo', { usuario, periodo }),

  // ---- Escrita ----
  criarTransacao: (dados) => post({ action: 'criar_transacao', ...dados }),
  editarTransacao: (dados) => post({ action: 'editar_transacao', ...dados }),
  excluirTransacao: (id) => post({ action: 'excluir_transacao', id }),
  registrarAcerto: (dados) => post({ action: 'registrar_acerto', ...dados }),
  fecharPeriodo: (usuario, periodo) => post({ action: 'fechar_periodo', usuario, periodo }),
  cadastrarDescricao: (valor) => post({ action: 'cadastrar_descricao', valor }),
  cadastrarDescricaoReceita: (valor) => post({ action: 'cadastrar_descricao_receita', valor }),
  cadastrarFormaPagamento: (valor) => post({ action: 'cadastrar_forma', valor }),
  cadastrarCategoria: (valor) => post({ action: 'cadastrar_categoria', valor }),
  salvarTokenPush: (usuario, token) => post({ action: 'salvar_token_push', usuario, token }),
};
