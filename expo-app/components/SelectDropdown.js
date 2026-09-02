import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet } from 'react-native';
import { COLORS } from '../theme';

/**
 * Dropdown simples baseado em Modal — funciona em iOS e Android sem
 * dependências externas. Suporta uma opção extra "+ Adicionar novo..."
 * que dispara onAddNew em vez de selecionar.
 */
export default function SelectDropdown({
  label,
  value,
  onChange,
  options,
  placeholder = 'Selecione...',
  accentColor = COLORS.accent,
  onAddNew,
  addNewLabel = '+ Adicionar novo...',
}) {
  const [aberto, setAberto] = useState(false);

  const itensRenderizados = onAddNew ? [...options, '__ADD_NEW__'] : options;

  return (
    <View>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <TouchableOpacity
        style={[styles.campo, { borderColor: value ? accentColor + '99' : COLORS.border }]}
        onPress={() => setAberto(true)}
      >
        <Text style={value ? styles.valor : styles.placeholder}>
          {value || placeholder}
        </Text>
        <Text style={styles.seta}>▾</Text>
      </TouchableOpacity>

      <Modal visible={aberto} transparent animationType="fade" onRequestClose={() => setAberto(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setAberto(false)}>
          <View style={styles.modalBox}>
            <FlatList
              data={itensRenderizados}
              keyExtractor={(item, i) => `${item}-${i}`}
              renderItem={({ item }) => {
                const isAddNew = item === '__ADD_NEW__';
                return (
                  <TouchableOpacity
                    style={styles.opcao}
                    onPress={() => {
                      setAberto(false);
                      if (isAddNew) onAddNew();
                      else onChange(item);
                    }}
                  >
                    <Text style={[styles.opcaoTexto, isAddNew && { color: accentColor, fontWeight: '700' }]}>
                      {isAddNew ? addNewLabel : item}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, color: COLORS.muted, fontWeight: '600', marginBottom: 6 },
  campo: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  valor: { color: COLORS.text, fontSize: 14 },
  placeholder: { color: COLORS.muted, fontSize: 14 },
  seta: { color: COLORS.muted },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalBox: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    maxHeight: '60%',
    paddingVertical: 8,
  },
  opcao: { paddingVertical: 14, paddingHorizontal: 20 },
  opcaoTexto: { color: COLORS.text, fontSize: 15 },
});
