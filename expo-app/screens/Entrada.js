import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Avatar from '../components/Avatar';
import { COLORS, PESSOAS } from '../theme';

/**
 * Tela de entrada — sem login, apenas escolha do nome.
 * O nome escolhido é salvo no AsyncStorage pelo App.js para
 * persistir entre aberturas do app.
 */
export default function Entrada({ onEscolher, fotos = {} }) {
  return (
    <View style={styles.container}>
      <View style={styles.box}>
        <Text style={styles.emoji}>💰</Text>
        <Text style={styles.titulo}>Põe na Dolorosa</Text>
        <Text style={styles.subtitulo}>Quem está usando agora?</Text>

        <View style={styles.lista}>
          {PESSOAS.map((p) => (
            <TouchableOpacity key={p} style={styles.botaoPessoa} onPress={() => onEscolher(p)}>
              <Avatar name={p} size={44} fotoUrl={fotos[p]} />
              <Text style={styles.nomePessoa}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  box: { width: '85%', alignItems: 'center', padding: 32 },
  emoji: { fontSize: 48, marginBottom: 16 },
  titulo: { color: COLORS.text, fontSize: 28, fontWeight: '800', marginBottom: 8 },
  subtitulo: { color: COLORS.muted, fontSize: 14, marginBottom: 40 },
  lista: { width: '100%', gap: 12 },
  botaoPessoa: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  nomePessoa: { color: COLORS.text, fontSize: 18, fontWeight: '600' },
});
