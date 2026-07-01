import React, { useState, useMemo } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, fontSize, fontWeight, spacing } from '../constants/theme';

function normalizar(texto) {
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export default function SearchablePickerModal({ visible, title, options, onSelect, onClose, placeholder }) {
  const [busca, setBusca] = useState('');

  const filtradas = useMemo(() => {
    if (!busca.trim()) return options;
    const termo = normalizar(busca);
    return options.filter((o) => normalizar(o.label).includes(termo));
  }, [busca, options]);

  function handleClose() {
    setBusca('');
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.search}
            placeholder={placeholder || 'Pesquisar...'}
            value={busca}
            onChangeText={setBusca}
            autoCapitalize="none"
            autoFocus
          />
          <FlatList
            data={filtradas}
            keyExtractor={(item) => item.value}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.empty}>Nada encontrado.</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.option}
                onPress={() => {
                  onSelect(item.value);
                  handleClose();
                }}
              >
                <Text style={styles.optionText}>{item.label}</Text>
              </TouchableOpacity>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  card: { width: '85%', maxHeight: '60%', backgroundColor: colors.background, borderRadius: radius.xl, padding: spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm + 2 },
  title: { fontWeight: fontWeight.bold, fontSize: fontSize.lg },
  closeBtn: { padding: 4 },
  search: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 10, fontSize: fontSize.base, marginBottom: spacing.sm },
  option: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  optionText: { fontSize: fontSize.base, color: colors.text },
  empty: { textAlign: 'center', color: colors.textFaint, paddingVertical: 20, fontSize: fontSize.md },
});