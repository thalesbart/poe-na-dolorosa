/**
 * theme.js
 * Paleta de cores compartilhada por todas as telas.
 */
export const COLORS = {
  bg: '#0F0F14',
  surface: '#1A1A24',
  card: '#22222F',
  border: '#2E2E3E',
  accent: '#7C6FFF',
  accentSoft: 'rgba(124, 111, 255, 0.13)',
  green: '#2ECC8A',
  greenSoft: 'rgba(46, 204, 138, 0.1)',
  red: '#FF5F6D',
  redSoft: 'rgba(255, 95, 109, 0.1)',
  yellow: '#FFB547',
  yellowSoft: 'rgba(255, 181, 71, 0.1)',
  text: '#F0EFF8',
  muted: '#7A7A9A',
  tag: '#2A2A3A',
};

export const PESSOAS = ['Thales', 'Tamires'];

export function outroUsuario(usuario) {
  return usuario === 'Thales' ? 'Tamires' : 'Thales';
}

export function periodoAtual() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function formatarMoeda(valor) {
  const num = Number(valor) || 0;
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Converte texto digitado num campo de valor para número, aceitando tanto
 * "150.50" quanto "150,50" — o teclado numérico do Android costuma usar
 * vírgula como separador decimal (padrão brasileiro), e o parseFloat comum
 * ignora tudo depois da vírgula, cortando os centavos (ou zerando o valor).
 */
export function parseValorInput(texto) {
  if (texto === null || texto === undefined) return NaN;
  let s = String(texto).trim();
  if (s === '') return NaN;
  if (s.includes('.') && s.includes(',')) {
    // "1.500,50" — ponto como separador de milhar, vírgula como decimal
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    // "150,50" — vírgula como separador decimal
    s = s.replace(',', '.');
  }
  return parseFloat(s);
}

/**
 * Formata uma data (ISO string ou Date) para "DD/MM/AAAA", exibição padrão
 * no app. Retorna '' se a data for inválida/vazia.
 */
export function formatarData(data) {
  if (!data) return '';
  const d = data instanceof Date ? data : new Date(data);
  if (isNaN(d.getTime())) return '';
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

/**
 * Aplica máscara "DD/MM/AAAA" enquanto o usuário digita (só números),
 * inserindo as barras automaticamente.
 */
export function aplicarMascaraData(texto) {
  const digitos = String(texto).replace(/\D/g, '').slice(0, 8);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
}

/**
 * Converte "DD/MM/AAAA" num Date válido (meio-dia local, pra não sofrer
 * com virada de fuso horário ao serializar). Retorna null se inválida.
 */
export function parseDataInput(texto) {
  const match = String(texto).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, diaStr, mesStr, anoStr] = match;
  const dia = Number(diaStr);
  const mes = Number(mesStr);
  const ano = Number(anoStr);
  const d = new Date(ano, mes - 1, dia, 12, 0, 0);
  if (d.getDate() !== dia || d.getMonth() !== mes - 1 || d.getFullYear() !== ano) return null;
  return d;
}
