import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../theme';

export default function Avatar({ name, size = 32 }) {
  const cor = name === 'Thales' ? COLORS.accent : '#FF6B9D';
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: cor },
      ]}
    >
      <Text style={[styles.letra, { fontSize: size * 0.4 }]}>{name?.[0] || '?'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  letra: {
    color: '#fff',
    fontWeight: '700',
  },
});
