import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../theme';

export default function Tag({ children, color = COLORS.muted }) {
  return (
    <View style={styles.tag}>
      <Text style={[styles.texto, { color }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    backgroundColor: COLORS.tag,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  texto: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
});
