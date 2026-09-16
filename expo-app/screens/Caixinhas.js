import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, RefreshControl, Modal, TextInput } from 'react-native';
import PromptModal from '../components/PromptModal';
import { api } from '../services/api';
import { COLORS, formatarMoeda, formatarData, parseValorInput } from '../theme';

const ROTULOS_MOVIMENTO = {
  aporte: { label: 'Aporte', cor: COLORS.green, sinal: '+' },
  resgate: { label: 'Resgate', cor: COLORS.red, sinal: '-' },
  rendimento: { label: 'Rendimento', cor: COLORS.accent, sinal: '+' },
};

export default function Caixinhas({ usuario }) {
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [caixinhas, setCaixinhas] = useState([]);

  const [modalNovaAberto, setModalNovaAberto] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novaTaxa, setNovaTaxa] = useState('');
  const [novoSaldoInicial, setNovoSaldoInicial] = useState('');
  const [salvandoNova, setSalvandoNova] = useState(false);

  const [caixinhaSelecionada, setCaixinhaSelecionada] = useState(null);
  const [movimentos, setMovimentos] = useState([]);
  const [carregandoMovimentos, setCarregandoMovimentos] = useState(false);
  const [promptTipo, setPromptTipo] = useState(null); // 'aporte' | 'resgate' | null

  const carregar = useCallback(async ({ viaRefresh = false } = {}) => {
    if (viaRefresh) setAtualizando(true);
    else setCarregando(true);
    try {
      const r = await api.listarCaixinhas();
      setCaixinhas(r.caixinhas || []);
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const abrirModalNova = () => {
    setNovoNome('');
    setNovaTaxa('');
    setNovoSaldoInicial('');
    setModalNovaAberto(true);
  };

  const handleCriarCaixinha = async () => {
    if (!novoNome.trim()) {
      Alert.alert('Verifique os dados', 'Dê um nome para a caixinha.');
      return;
    }
    const taxa = parseValorInput(novaTaxa) || 0;
    const saldoInicial = novoSaldoInicial ? parseValorInput(novoSaldoInicial) || 0 : 0;

    setSalvandoNova(true);
    try {
      await api.criarCaixinha({ nome: novoNome.trim(), taxa_mensal: taxa, saldo_inicial: saldoInicial });
      setModalNovaAberto(false);
      await carregar();
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível criar a caixinha.');
    } finally {
      setSalvandoNova(false);
    }
  };

  const abrirDetalhe = async (caixinha) => {
    setCaixinhaSelecionada(caixinha);
    setCarregandoMovimentos(true);
    try {
      const r = await api.listarMovimentosCaixinha(caixinha.id);
      setMovimentos(r.movimentos || []);
    } finally {
      setCarregandoMovimentos(false);
    }
  };

  const fecharDetalhe = () => {
    setCaixinhaSelecionada(null);
    setMovimentos([]);
    setPromptTipo(null);
  };

  const handleConfirmarMovimento = async (texto) => {
    const valor = parseValorInput(texto);
    if (!valor || valor <= 0) {
      Alert.alert('Verifique o valor', 'Informe um valor válido.');
      throw new Error('valor inválido');
    }
    const r = await api.movimentarCaixinha({ caixinha_id: caixinhaSelecionada.id, tipo: promptTipo, valor });
    if (!r.sucesso) {
      Alert.alert('Não foi possível', r.erro || 'Tente novamente.');
      throw new Error(r.erro || 'falha');
    }
    const [rCaixinhas, rMovimentos] = await Promise.all([
      api.listarCaixinhas(),
      api.listarMovimentosCaixinha(caixinhaSelecionada.id),
    ]);
    setCaixinhas(rCaixinhas.caixinhas || []);
    const atualizada = (rCaixinhas.caixinhas || []).find((c) => c.id === caixinhaSelecionada.id);
    if (atualizada) setCaixinhaSelecionada(atualizada);
    setMovimentos(rMovimentos.movimentos || []);
  };

  const handleExcluirCaixinha = (caixinha) => {
    Alert.alert('Excluir caixinha', `Tem certeza que quer excluir "${caixinha.nome}"? O histórico dela será perdido.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await api.excluirCaixinha(caixinha.id);
          fecharDetalhe();
          await carregar();
        },
      },
    ]);
  };

  if (carregando) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  const totalInvestido = caixinhas.reduce((soma, c) => soma + (Number(c.saldo) || 0), 0);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={atualizando} onRefresh={() => carregar({ viaRefresh: true })} tintColor={COLORS.accent} colors={[COLORS.accent]} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.titulo}>Caixinhas</Text>
        <TouchableOpacity style={styles.botaoNova} onPress={abrirModalNova}>
          <Text style={styles.botaoNovaTexto}>+ Nova</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cardTotal}>
        <Text style={styles.labelTotal}>TOTAL INVESTIDO</Text>
        <Text style={styles.valorTotal}>R$ {formatarMoeda(totalInvestido)}</Text>
      </View>

      {caixinhas.length === 0 && (
        <Text style={styles.textoVazio}>Nenhuma caixinha criada ainda. Toque em "+ Nova" para começar.</Text>
      )}

      {caixinhas.map((c) => (
        <TouchableOpacity key={c.id} style={styles.cardCaixinha} onPress={() => abrirDetalhe(c)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.nomeCaixinha}>{c.nome}</Text>
            <Text style={styles.taxaCaixinha}>{formatarMoeda(c.taxa_mensal)}% ao mês</Text>
          </View>
          <Text style={styles.saldoCaixinha}>R$ {formatarMoeda(c.saldo)}</Text>
        </TouchableOpacity>
      ))}

      {/* Modal: nova caixinha */}
      <Modal visible={modalNovaAberto} transparent animationType="fade" onRequestClose={() => setModalNovaAberto(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <Text style={styles.tituloModal}>Nova caixinha</Text>

            <Text style={styles.labelCampo}>NOME</Text>
            <TextInput
              style={styles.inputModal}
              placeholder="Ex: Reserva de emergência"
              placeholderTextColor={COLORS.muted}
              value={novoNome}
              onChangeText={setNovoNome}
            />

            <Text style={styles.labelCampo}>RENDIMENTO MENSAL (%)</Text>
            <TextInput
              style={styles.inputModal}
              placeholder="Ex: 0,9"
              placeholderTextColor={COLORS.muted}
              keyboardType="decimal-pad"
              value={novaTaxa}
              onChangeText={setNovaTaxa}
            />

            <Text style={styles.labelCampo}>SALDO INICIAL (opcional)</Text>
            <TextInput
              style={styles.inputModal}
              placeholder="R$ 0,00"
              placeholderTextColor={COLORS.muted}
              keyboardType="decimal-pad"
              value={novoSaldoInicial}
              onChangeText={setNovoSaldoInicial}
            />

            {salvandoNova ? (
              <ActivityIndicator color={COLORS.accent} style={{ marginTop: 8 }} />
            ) : (
              <View style={styles.botoesModal}>
                <TouchableOpacity style={styles.botaoCancelarModal} onPress={() => setModalNovaAberto(false)}>
                  <Text style={styles.textoMuted}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.botaoConfirmarModal} onPress={handleCriarCaixinha}>
                  <Text style={styles.textoConfirmarModal}>Criar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal: detalhe da caixinha (evolução + aportar/resgatar) */}
      <Modal visible={!!caixinhaSelecionada} transparent animationType="fade" onRequestClose={fecharDetalhe}>
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.tituloModal}>{caixinhaSelecionada?.nome}</Text>
              <TouchableOpacity onPress={fecharDetalhe}>
                <Text style={styles.fecharModal}>✕</Text>
              </TouchableOpacity>
            </View>

            {caixinhaSelecionada && (
              <>
                <Text style={styles.saldoDetalhe}>R$ {formatarMoeda(caixinhaSelecionada.saldo)}</Text>
                <Text style={styles.textoMuted}>{formatarMoeda(caixinhaSelecionada.taxa_mensal)}% ao mês</Text>

                <View style={styles.botoesAcaoDetalhe}>
                  <TouchableOpacity style={[styles.botaoAcaoDetalhe, { backgroundColor: COLORS.green }]} onPress={() => setPromptTipo('aporte')}>
                    <Text style={styles.botaoAcaoDetalheTexto}>+ Aportar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.botaoAcaoDetalhe, { backgroundColor: COLORS.red }]} onPress={() => setPromptTipo('resgate')}>
                    <Text style={styles.botaoAcaoDetalheTexto}>− Resgatar</Text>
                  </TouchableOpacity>
                </View>

                <Text style={[styles.tituloSecao, { marginTop: 16 }]}>EVOLUÇÃO</Text>
                <ScrollView style={styles.listaMovimentos}>
                  {carregandoMovimentos ? (
                    <ActivityIndicator color={COLORS.accent} style={{ marginTop: 20 }} />
                  ) : movimentos.length === 0 ? (
                    <Text style={[styles.textoMuted, { marginTop: 12 }]}>Nenhuma movimentação ainda.</Text>
                  ) : (
                    movimentos.map((m) => {
                      const rotulo = ROTULOS_MOVIMENTO[m.tipo] || { label: m.tipo, cor: COLORS.muted, sinal: '' };
                      return (
                        <View key={m.id} style={styles.itemMovimento}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.tipoMovimento, { color: rotulo.cor }]}>{rotulo.label}</Text>
                            <Text style={[styles.textoMuted, { textAlign: 'left' }]}>{formatarData(m.data)}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[styles.valorMovimento, { color: rotulo.cor }]}>
                              {rotulo.sinal}R$ {formatarMoeda(m.valor)}
                            </Text>
                            <Text style={styles.saldoAposMovimento}>saldo: R$ {formatarMoeda(m.saldo_apos)}</Text>
                          </View>
                        </View>
                      );
                    })
                  )}
                </ScrollView>

                <TouchableOpacity style={styles.botaoExcluirDetalhe} onPress={() => handleExcluirCaixinha(caixinhaSelecionada)}>
                  <Text style={styles.botaoExcluirDetalheTexto}>🗑 Excluir caixinha</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      <PromptModal
        visivel={promptTipo !== null}
        titulo={promptTipo === 'aporte' ? 'Aportar' : 'Resgatar'}
        mensagem={promptTipo === 'aporte' ? 'Quanto você quer depositar nessa caixinha?' : 'Quanto você quer resgatar dessa caixinha?'}
        placeholder="R$ 0,00"
        corDestaque={promptTipo === 'aporte' ? COLORS.green : COLORS.red}
        labelConfirmar={promptTipo === 'aporte' ? 'Aportar' : 'Resgatar'}
        labelSucesso={promptTipo === 'aporte' ? 'Aportado com sucesso!' : 'Resgatado com sucesso!'}
        teclado="decimal-pad"
        onConfirmar={handleConfirmarMovimento}
        onCancelar={() => setPromptTipo(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, gap: 16 },
  loadingContainer: { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titulo: { color: COLORS.text, fontSize: 20, fontWeight: '700' },
  botaoNova: { backgroundColor: COLORS.accent, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  botaoNovaTexto: { color: '#fff', fontWeight: '700', fontSize: 13 },
  cardTotal: { backgroundColor: COLORS.accentSoft, borderWidth: 1, borderColor: COLORS.accent + '44', borderRadius: 18, padding: 20, alignItems: 'center' },
  labelTotal: { color: COLORS.muted, fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 6 },
  valorTotal: { color: COLORS.accent, fontSize: 30, fontWeight: '800' },
  textoVazio: { color: COLORS.muted, textAlign: 'center', marginTop: 20 },
  cardCaixinha: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 14, padding: 16,
  },
  nomeCaixinha: { color: COLORS.text, fontSize: 15, fontWeight: '700', marginBottom: 3 },
  taxaCaixinha: { color: COLORS.muted, fontSize: 12 },
  saldoCaixinha: { color: COLORS.green, fontSize: 16, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', paddingHorizontal: 20 },
  modalBox: { backgroundColor: COLORS.card, borderRadius: 18, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  tituloModal: { color: COLORS.text, fontSize: 17, fontWeight: '700' },
  fecharModal: { color: COLORS.muted, fontSize: 18 },
  labelCampo: { fontSize: 11, color: COLORS.muted, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  inputModal: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: COLORS.text, fontSize: 14 },
  botoesModal: { flexDirection: 'row', gap: 10, marginTop: 20 },
  botaoCancelarModal: { flex: 1, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, alignItems: 'center' },
  botaoConfirmarModal: { flex: 1, backgroundColor: COLORS.accent, borderRadius: 10, padding: 12, alignItems: 'center' },
  textoConfirmarModal: { color: '#fff', fontWeight: '700' },
  textoMuted: { color: COLORS.muted, fontSize: 12, textAlign: 'center' },
  saldoDetalhe: { color: COLORS.text, fontSize: 30, fontWeight: '800', marginTop: 8 },
  botoesAcaoDetalhe: { flexDirection: 'row', gap: 10, marginTop: 16 },
  botaoAcaoDetalhe: { flex: 1, borderRadius: 12, padding: 13, alignItems: 'center' },
  botaoAcaoDetalheTexto: { color: '#fff', fontWeight: '700', fontSize: 13 },
  tituloSecao: { color: COLORS.muted, fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  listaMovimentos: { maxHeight: 260 },
  itemMovimento: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  tipoMovimento: { fontSize: 13, fontWeight: '700' },
  valorMovimento: { fontSize: 14, fontWeight: '700' },
  saldoAposMovimento: { color: COLORS.muted, fontSize: 10, marginTop: 2 },
  botaoExcluirDetalhe: { borderWidth: 1, borderColor: COLORS.red + '44', borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 16 },
  botaoExcluirDetalheTexto: { color: COLORS.red, fontSize: 13, fontWeight: '600' },
});
