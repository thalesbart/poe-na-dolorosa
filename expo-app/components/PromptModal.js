import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS } from '../theme';

/**
 * Modal de input customizado — substitui Alert.prompt (iOS only).
 * Suporta estado de loading durante o salvamento e mensagem de sucesso.
 */
export default function PromptModal({
  visivel,
  titulo,
  mensagem,
  placeholder = '',
  onConfirmar,
  onCancelar,
  corDestaque = COLORS.accent,
}) {
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    if (visivel) {
      setValor('');
      setSalvando(false);
      setSucesso(false);
    }
  }, [visivel]);

  const handleConfirmar = async () => {
    if (!valor.trim()) return;
    setSalvando(true);
    try {
      await onConfirmar(valor.trim());
      setSucesso(true);
      // fecha automaticamente após 1.2s mostrando sucesso
      setTimeout(() => {
        setSucesso(false);
        setSalvando(false);
      }, 1200);
    } catch (err) {
      setSalvando(false);
    }
  };

  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={onCancelar}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          {sucesso ? (
            <View style={styles.sucessoContainer}>
              <Text style={styles.sucessoEmoji}>✅</Text>
              <Text style={styles.sucessoTexto}>Cadastrado com sucesso!</Text>
            </View>
          ) : (
            <>
              <Text style={styles.titulo}>{titulo}</Text>
              {mensagem ? <Text style={styles.mensagem}>{mensagem}</Text> : null}

              <TextInput
                style={[styles.input, { borderColor: corDestaque + '66' }]}
                placeholder={placeholder}
                placeholderTextColor={COLORS.muted}
                value={valor}
                onChangeText={setValor}
                autoFocus
                editable={!salvando}
              />

              {salvando ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={corDestaque} />
                  <Text style={[styles.loadingTexto, { color: corDestaque }]}>Salvando...</Text>
                </View>
              ) : (
                <View style={styles.botoes}>
                  <TouchableOpacity style={styles.botaoCancelar} onPress={onCancelar}>
                    <Text style={styles.textoCancelar}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.botaoConfirmar, { backgroundColor: corDestaque }]}
                    onPress={handleConfirmar}
                  >
                    <Text style={styles.textoConfirmar}>Adicionar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  box: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 24,
  },
  titulo: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  mensagem: { color: COLORS.muted, fontSize: 13, marginBottom: 12 },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    color: COLORS.text,
    fontSize: 15,
    marginTop: 8,
    marginBottom: 16,
  },
  botoes: { flexDirection: 'row', gap: 10 },
  botaoCancelar: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  textoCancelar: { color: COLORS.muted, fontWeight: '600' },
  botaoConfirmar: { flex: 1, borderRadius: 10, padding: 12, alignItems: 'center' },
  textoConfirmar: { color: '#fff', fontWeight: '700' },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  loadingTexto: { fontSize: 14, fontWeight: '600' },
  sucessoContainer: { alignItems: 'center', paddingVertical: 16 },
  sucessoEmoji: { fontSize: 40, marginBottom: 10 },
  sucessoTexto: { color: COLORS.green, fontSize: 16, fontWeight: '700' },
});
