import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../theme';

export default function Avatar({ name, size = 32, fotoUrl, onPress }) {
  const cor = name === 'Thales' ? COLORS.accent : '#FF6B9D';
  const [erroAoCarregar, setErroAoCarregar] = useState(false);
  const mostrarFoto = !!fotoUrl && !erroAoCarregar;

  const conteudo = (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: cor },
      ]}
    >
      {mostrarFoto ? (
        <Image
          source={{ uri: fotoUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={() => setErroAoCarregar(true)}
          transition={150}
        />
      ) : (
        <Text style={[styles.letra, { fontSize: size * 0.4 }]}>{name?.[0] || '?'}</Text>
      )}
    </View>
  );

  if (!onPress) return conteudo;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      {conteudo}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  letra: {
    color: '#fff',
    fontWeight: '700',
  },
});
