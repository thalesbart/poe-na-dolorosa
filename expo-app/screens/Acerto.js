import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import Avatar from '../components/Avatar';
import { api } from '../services/api';
import { COLORS, outroUsuario, formatarMoeda } from '../theme';

export default function Acerto({ usuario, fotos = {}, onAcertoRegistrado }) {
  const outro = outroUsuario(usuario);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [saldo, setSaldo] = useState({ quitado: true, quem_deve: null, valor: 0 });
  const [confirmando, setConfirmando] = useState(false);
  const [registrando, setRegistrando] = useState(false);

  const carregar = useCallback(async ({ viaRefresh = false } = {}) => {
    if (viaRefresh) setAtualizando(true);
    else setCarregando(true);
    try {
      const r = await api.buscarSaldo();
      setSaldo(r);
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const handleRegistrarAcerto = async () => {
    setRegistrando(true);
    try {
      // quem_deve paga para o outro
      const de = saldo.quem_deve;
      const para = de === usuario ? outro : usuario;
      await api.registrarAcerto({ valor: saldo.valor, de, para });
      setConfirmando(false);
      await carregar();
      onAcertoRegistrado?.();
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível registrar o acerto.');
    } finally {
      setRegistrando(false);
    }
  };

  if (carregando) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  const outroTeDevee = saldo.quem_deve === outro;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={atualizando}
          onRefresh={() => carregar({ viaRefresh: true })}
          tintColor={COLORS.accent}
          colors={[COLORS.accent]}
        />
      }
    >
      <Text style={styles.titulo}>Acerto de contas</Text>

      {saldo.quitado ? (
        <View style={styles.cardQuitado}>
          <Text style={styles.emojiGrande}>🎉</Text>
          <Text style={styles.tituloQuitado}>Vocês estão quites!</Text>
          <Text style={styles.textoMuted}>Nenhum saldo pendente entre você e {outro}.</Text>
          <Text style={styles.dicaQuitado}>✓ Pode fechar o período no Dashboard</Text>
        </View>
      ) : (
        <>
          <View style={styles.cardSaldo}>
            <Avatar name={outro} size={56} fotoUrl={fotos[outro]} />
            <Text style={styles.labelDeve}>{outroTeDevee ? `${outro} te deve` : `Você deve para ${outro}`}</Text>
            <Text style={styles.valorGrande}>R$ {formatarMoeda(saldo.valor)}</Text>
          </View>

          {!confirmando ? (
            <TouchableOpacity style={styles.botaoRegistrar} onPress={() => setConfirmando(true)}>
              <Text style={styles.botaoTexto}>✓ Registrar acerto de R$ {formatarMoeda(saldo.valor)}</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ gap: 10 }}>
              <Text style={styles.confirmacaoTexto}>Confirmar acerto? Isso zerará o saldo entre vocês.</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={styles.botaoCancelar} onPress={() => setConfirmando(false)}>
                  <Text style={styles.textoMuted}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.botaoRegistrar, { flex: 1 }]} onPress={handleRegistrarAcerto} disabled={registrando}>
                  <Text style={styles.botaoTexto}>{registrando ? 'Salvando...' : 'Confirmar'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <Text style={styles.textoRodape}>Isso zerará o saldo e liberará o fechamento de período.</Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, gap: 20 },
  loadingContainer: { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' },
  titulo: { color: COLORS.text, fontSize: 20, fontWeight: '700' },
  cardQuitado: { backgroundColor: COLORS.greenSoft, borderWidth: 1, borderColor: COLORS.green + '44', borderRadius: 20, padding: 32, alignItems: 'center' },
  emojiGrande: { fontSize: 48, marginBottom: 12 },
  tituloQuitado: { color: COLORS.green, fontSize: 24, fontWeight: '800', marginBottom: 8 },
  textoMuted: { color: COLORS.muted, fontSize: 13, textAlign: 'center' },
  dicaQuitado: { color: COLORS.green, fontSize: 13, fontWeight: '600', marginTop: 12 },
  cardSaldo: { backgroundColor: COLORS.greenSoft, borderWidth: 1, borderColor: COLORS.green + '44', borderRadius: 20, padding: 24, alignItems: 'center' },
  labelDeve: { color: COLORS.muted, fontSize: 13, marginTop: 12, marginBottom: 4 },
  valorGrande: { color: COLORS.green, fontSize: 40, fontWeight: '800' },
  botaoRegistrar: { backgroundColor: COLORS.green, borderRadius: 14, padding: 16, alignItems: 'center' },
  botaoTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
  botaoCancelar: { flex: 1, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 13, alignItems: 'center' },
  confirmacaoTexto: { color: COLORS.text, fontSize: 13, textAlign: 'center' },
  textoRodape: { color: COLORS.muted, fontSize: 12, textAlign: 'center' },
});
