import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import Avatar from '../components/Avatar';
import Tag from '../components/Tag';
import { api } from '../services/api';
import { escolherEEnviarFoto } from '../services/foto';
import { COLORS, outroUsuario, periodoAtual, formatarMoeda } from '../theme';

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
  const [ultimosLancamentos, setUltimosLancamentos] = useState([]);
  const [confirmandoFechamento, setConfirmandoFechamento] = useState(false);

  const carregarDados = useCallback(async ({ viaRefresh = false } = {}) => {
    if (viaRefresh) setAtualizando(true);
    else setCarregando(true);
    try {
      const dados = await api.carregarDashboard(usuario, periodo);
      setResumo(dados.resumo);
      setSaldoEntreUsuarios(dados.saldo);
      setUltimosLancamentos((dados.transacoes || []).slice(0, 5));
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível carregar os dados. Verifique sua conexão.');
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [usuario, periodo]);

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

      {/* Últimos lançamentos */}
      <View>
        <Text style={styles.tituloSecao}>ÚLTIMOS LANÇAMENTOS</Text>
        {ultimosLancamentos.length === 0 && (
          <Text style={styles.textoMuted}>Nenhum lançamento neste período ainda.</Text>
        )}
        {ultimosLancamentos.map((item, i) => {
          const ehReceita = item.tipo === 'receita';
          const dividido = item.subtipo === 'dividido';
          const recebidoDoOutro = item.dono !== usuario;
          // Num item dividido, o valor relevante é sempre a parte do outro:
          // positivo/verde para quem lançou (tem a receber), negativo/vermelho para quem participou (tem que pagar)
          const souCredor = dividido && !recebidoDoOutro;
          const valorExibido = dividido ? item.valor_outro : item.valor_dono;
          const positivo = ehReceita || souCredor;

          return (
            <View key={i} style={styles.itemLancamento}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={[styles.iconeCircular, { backgroundColor: positivo ? COLORS.greenSoft : COLORS.redSoft }]}>
                  <Text>{positivo ? '↑' : '↓'}</Text>
                </View>
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={styles.descricaoItem}>{item.descricao}</Text>
                  {dividido && <Tag color={COLORS.accent}>÷ {recebidoDoOutro ? `de ${item.dono}` : item.dividido_com}</Tag>}
                </View>
              </View>
              <Text style={[styles.valorItem, { color: positivo ? COLORS.green : COLORS.red }]}>
                {positivo ? '+' : '-'}R$ {formatarMoeda(valorExibido)}
              </Text>
            </View>
          );
        })}
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
  itemLancamento: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  iconeCircular: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  descricaoItem: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  valorItem: { fontSize: 15, fontWeight: '700' },
});
