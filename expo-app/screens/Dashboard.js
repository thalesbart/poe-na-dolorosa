import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import Avatar from '../components/Avatar';
import { api } from '../services/api';
import { escolherEEnviarFoto } from '../services/foto';
import { COLORS, outroUsuario, periodoAtual, formatarMoeda } from '../theme';

const DESCRICAO_INVESTIMENTOS = 'investimentos';
const DESCRICAO_DESPESAS_FIXAS = 'despesas fixas';

const CONFIG_CATEGORIA = {
  receitas: { label: 'Receitas', descricaoPadrao: 'Receitas', tipo: 'receita', subtipo: 'receita', icone: '↑', soft: COLORS.greenSoft, cor: COLORS.green },
  pessoal: { label: 'Despesa Pessoal', descricaoPadrao: 'Despesa Pessoal', tipo: 'debito', subtipo: 'pessoal', icone: '↓', soft: COLORS.redSoft, cor: COLORS.red },
  investimentos: { label: 'Investimentos', descricaoPadrao: 'Investimentos', tipo: 'debito', subtipo: 'pessoal', icone: '💰', soft: COLORS.accentSoft, cor: COLORS.accent },
  fixas: { label: 'Despesas Fixas', descricaoPadrao: 'Despesas Fixas', tipo: 'debito', subtipo: 'pessoal', icone: '📌', soft: COLORS.yellowSoft, cor: COLORS.yellow },
};

function bucketDaTransacao(t, usuario) {
  if (t.dono !== usuario) return null;
  if (t.tipo === 'receita') return 'receitas';
  if (t.subtipo !== 'pessoal') return null;
  const desc = String(t.descricao || '').trim().toLowerCase();
  if (desc === DESCRICAO_INVESTIMENTOS) return 'investimentos';
  if (desc === DESCRICAO_DESPESAS_FIXAS) return 'fixas';
  return 'pessoal';
}

export default function Dashboard({ usuario, fotos = {}, onFotoAtualizada }) {
  const outro = outroUsuario(usuario);
  const periodo = periodoAtual();

  const handleTrocarFoto = async () => {
    const url = await escolherEEnviarFoto(usuario);
    if (url && onFotoAtualizada) onFotoAtualizada();
  };

  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [resumo, setResumo] = useState({ receitas: 0, debitos: 0, saldo: 0 });
  const [saldoEntreUsuarios, setSaldoEntreUsuarios] = useState({ quitado: true, quem_deve: null, valor: 0 });
  const [transacoesPeriodo, setTransacoesPeriodo] = useState([]);
  const [confirmandoFechamento, setConfirmandoFechamento] = useState(false);

  const [categoriaEditando, setCategoriaEditando] = useState(null);
  const [valorInput, setValorInput] = useState('');
  const [salvandoCategoria, setSalvandoCategoria] = useState(false);

  const carregarDados = useCallback(async ({ viaRefresh = false } = {}) => {
    if (viaRefresh) setAtualizando(true);
    else setCarregando(true);
    try {
      const dados = await api.carregarDashboard(usuario, periodo);
      setResumo(dados.resumo);
      setSaldoEntreUsuarios(dados.saldo);
      setTransacoesPeriodo(dados.transacoes || []);
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível carregar os dados. Verifique sua conexão.');
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [usuario, periodo]);

  const buckets = { receitas: [], pessoal: [], investimentos: [], fixas: [] };
  transacoesPeriodo.forEach((t) => {
    const b = bucketDaTransacao(t, usuario);
    if (b) buckets[b].push(t);
  });
  const totais = Object.fromEntries(
    Object.keys(buckets).map((id) => [id, buckets[id].reduce((s, t) => s + (Number(t.valor_dono) || 0), 0)])
  );

  const dividoCredor = transacoesPeriodo
    .filter((t) => t.subtipo === 'dividido' && t.dono === usuario)
    .reduce((s, t) => s + (Number(t.valor_outro) || 0), 0);
  const dividoDevedor = transacoesPeriodo
    .filter((t) => t.subtipo === 'dividido' && t.dividido_com === usuario)
    .reduce((s, t) => s + (Number(t.valor_outro) || 0), 0);

  const handleTocarCard = (id) => {
    const itens = buckets[id];
    if (itens.length >= 2) {
      Alert.alert('Vários lançamentos', 'Essa categoria tem mais de um lançamento neste período. Edite cada um pelo Histórico.');
      return;
    }
    const valorAtual = itens.length === 1 ? Number(itens[0].valor_dono) || 0 : totais[id];
    setCategoriaEditando(id);
    setValorInput(valorAtual > 0 ? String(valorAtual) : '');
  };

  const handleCancelarEdicaoCategoria = () => {
    setCategoriaEditando(null);
    setValorInput('');
  };

  const handleConfirmarEdicaoCategoria = async () => {
    const id = categoriaEditando;
    const novoValor = parseFloat(valorInput) || 0;
    if (novoValor <= 0) {
      Alert.alert('Valor inválido', 'Informe um valor maior que zero.');
      return;
    }
    const itens = buckets[id];
    const cfg = CONFIG_CATEGORIA[id];
    setSalvandoCategoria(true);
    try {
      if (itens.length === 1) {
        await api.editarTransacao({ id: itens[0].id, valor_dono: novoValor });
      } else {
        await api.criarTransacao({
          tipo: cfg.tipo,
          subtipo: cfg.subtipo,
          descricao: cfg.descricaoPadrao,
          dono: usuario,
          valor_dono: novoValor,
          periodo,
        });
      }
      setCategoriaEditando(null);
      setValorInput('');
      await carregarDados();
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível salvar o valor.');
    } finally {
      setSalvandoCategoria(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const handleFecharPeriodo = async () => {
    try {
      await api.fecharPeriodo(usuario, periodo);
      setConfirmandoFechamento(false);
      Alert.alert('Período arquivado!', 'Seus lançamentos foram arquivados com sucesso.');
      carregarDados();
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível fechar o período.');
    }
  };

  const acertoQuitado = saldoEntreUsuarios.quitado;
  const outroTeDevee = saldoEntreUsuarios.quem_deve === outro;

  if (carregando) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={atualizando}
          onRefresh={() => carregarDados({ viaRefresh: true })}
          tintColor={COLORS.accent}
          colors={[COLORS.accent]}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.saudacao}>Olá,</Text>
          <Text style={styles.nomeUsuario}>{usuario}</Text>
        </View>
        <View style={styles.headerDireita}>
          <Text style={styles.periodoTexto}>{periodo}</Text>
          <Avatar name={usuario} fotoUrl={fotos[usuario]} onPress={handleTrocarFoto} />
        </View>
      </View>

      {/* Saldo do mês */}
      <View style={styles.cardSaldo}>
        <Text style={styles.labelSaldo}>SALDO DO MÊS</Text>
        <Text style={styles.valorSaldo}>R$ {formatarMoeda(resumo.saldo)}</Text>
        <View style={styles.linhaReceitaDebito}>
          <View style={[styles.miniCard, { backgroundColor: COLORS.greenSoft }]}>
            <Text style={[styles.miniLabel, { color: COLORS.green }]}>↑ RECEITAS</Text>
            <Text style={styles.miniValor}>R$ {formatarMoeda(resumo.receitas)}</Text>
          </View>
          <View style={[styles.miniCard, { backgroundColor: COLORS.redSoft }]}>
            <Text style={[styles.miniLabel, { color: COLORS.red }]}>↓ DÉBITOS</Text>
            <Text style={styles.miniValor}>R$ {formatarMoeda(resumo.debitos)}</Text>
          </View>
        </View>
      </View>

      {/* Saldo entre vocês */}
      <View style={styles.cardCinza}>
        <Text style={styles.tituloSecao}>SALDO ENTRE VOCÊS</Text>
        <View style={styles.linhaSaldoEntre}>
          <Avatar name={outro} size={38} fotoUrl={fotos[outro]} />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.textoMuted}>
              {acertoQuitado ? 'Vocês estão quites 🎉' : outroTeDevee ? `${outro} te deve` : `Você deve para ${outro}`}
            </Text>
            <Text style={[styles.valorMedio, { color: acertoQuitado ? COLORS.muted : COLORS.green }]}>
              R$ {formatarMoeda(saldoEntreUsuarios.valor)}
            </Text>
          </View>
        </View>
      </View>

      {/* Fechar período */}
      <View style={[styles.cardCinza, { backgroundColor: acertoQuitado ? COLORS.greenSoft : COLORS.yellowSoft }]}>
        <View style={styles.linhaFechamento}>
          <View style={{ flex: 1 }}>
            <Text style={styles.tituloFechamento}>Fechar período — {periodo}</Text>
            <Text style={styles.textoMuted}>
              {acertoQuitado ? 'Acerto quitado. Pronto para arquivar o mês.' : `Quite o saldo com ${outro} antes de fechar.`}
            </Text>
          </View>
          <Text style={{ fontSize: 20 }}>{acertoQuitado ? '✅' : '🔒'}</Text>
        </View>

        {acertoQuitado && !confirmandoFechamento && (
          <TouchableOpacity style={styles.botaoVerde} onPress={() => setConfirmandoFechamento(true)}>
            <Text style={styles.botaoTextoBranco}>Arquivar período</Text>
          </TouchableOpacity>
        )}

        {acertoQuitado && confirmandoFechamento && (
          <View style={{ marginTop: 14, gap: 8 }}>
            <Text style={styles.confirmacaoTexto}>Tem certeza? Seus lançamentos serão arquivados.</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={styles.botaoCancelar} onPress={() => setConfirmandoFechamento(false)}>
                <Text style={styles.textoMuted}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.botaoVerde, { flex: 1 }]} onPress={handleFecharPeriodo}>
                <Text style={styles.botaoTextoBranco}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Categorias do mês */}
      <View>
        <Text style={styles.tituloSecao}>NO MÊS</Text>

        {Object.keys(CONFIG_CATEGORIA).map((id) => {
          const cfg = CONFIG_CATEGORIA[id];
          const emEdicao = categoriaEditando === id;
          return (
            <TouchableOpacity
              key={id}
              style={styles.cartaoCategoria}
              activeOpacity={0.7}
              disabled={emEdicao}
              onPress={() => handleTocarCard(id)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={[styles.iconeCircular, { backgroundColor: cfg.soft }]}>
                  <Text>{cfg.icone}</Text>
                </View>
                <Text style={styles.labelCategoria}>{cfg.label}</Text>
              </View>

              {emEdicao ? (
                <View style={styles.linhaEdicaoCategoria}>
                  <TextInput
                    style={styles.inputCategoria}
                    keyboardType="decimal-pad"
                    autoFocus
                    value={valorInput}
                    onChangeText={setValorInput}
                    placeholder="0,00"
                    placeholderTextColor={COLORS.muted}
                  />
                  <TouchableOpacity onPress={handleCancelarEdicaoCategoria} disabled={salvandoCategoria}>
                    <Text style={styles.botaoEdicaoCancelar}>✕</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleConfirmarEdicaoCategoria} disabled={salvandoCategoria}>
                    <Text style={styles.botaoEdicaoConfirmar}>{salvandoCategoria ? '…' : '✓'}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={[styles.valorCategoria, { color: cfg.cor }]}>R$ {formatarMoeda(totais[id])}</Text>
              )}
            </TouchableOpacity>
          );
        })}

        {/* Contabilidade do que foi dividido — somente informativo, não editável aqui */}
        <View style={styles.cartaoCategoria}>
          <View style={[styles.iconeCircular, { backgroundColor: COLORS.accentSoft }]}>
            <Text>⇄</Text>
          </View>
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.labelCategoria}>Dividido no mês</Text>
            <Text style={styles.textoDividido}>
              A receber de {outro}: R$ {formatarMoeda(dividoCredor)} · A pagar: R$ {formatarMoeda(dividoDevedor)}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, gap: 20 },
  loadingContainer: { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  saudacao: { color: COLORS.muted, fontSize: 13 },
  nomeUsuario: { color: COLORS.text, fontSize: 24, fontWeight: '700' },
  headerDireita: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  periodoTexto: { color: COLORS.muted, fontSize: 12 },
  cardSaldo: {
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accent + '44',
    borderRadius: 20,
    padding: 20,
  },
  labelSaldo: { color: COLORS.muted, fontSize: 12, letterSpacing: 1, marginBottom: 4 },
  valorSaldo: { color: COLORS.text, fontSize: 36, fontWeight: '800', marginBottom: 20 },
  linhaReceitaDebito: { flexDirection: 'row', gap: 16 },
  miniCard: { flex: 1, borderRadius: 12, padding: 12 },
  miniLabel: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
  miniValor: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  cardCinza: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 18 },
  tituloSecao: { color: COLORS.muted, fontSize: 12, fontWeight: '600', letterSpacing: 1, marginBottom: 12 },
  linhaSaldoEntre: { flexDirection: 'row', alignItems: 'center' },
  textoMuted: { color: COLORS.muted, fontSize: 13 },
  valorMedio: { fontSize: 20, fontWeight: '700' },
  linhaFechamento: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  tituloFechamento: { color: COLORS.text, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  botaoVerde: { marginTop: 14, backgroundColor: COLORS.green, borderRadius: 12, padding: 12, alignItems: 'center' },
  botaoTextoBranco: { color: '#fff', fontSize: 14, fontWeight: '700' },
  botaoCancelar: { flex: 1, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12, alignItems: 'center' },
  confirmacaoTexto: { color: COLORS.text, fontSize: 13, textAlign: 'center' },
  iconeCircular: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cartaoCategoria: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 14, padding: 14, marginBottom: 10,
  },
  labelCategoria: { color: COLORS.text, fontSize: 14, fontWeight: '600', marginLeft: 12 },
  valorCategoria: { fontSize: 15, fontWeight: '700' },
  textoDividido: { color: COLORS.muted, fontSize: 11, marginTop: 2 },
  linhaEdicaoCategoria: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inputCategoria: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.accent + '55',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, color: COLORS.text,
    fontSize: 14, fontWeight: '700', minWidth: 90, textAlign: 'right',
  },
  botaoEdicaoCancelar: { color: COLORS.muted, fontSize: 18 },
  botaoEdicaoConfirmar: { color: COLORS.green, fontSize: 18, fontWeight: '700' },
});
