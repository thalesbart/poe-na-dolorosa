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
