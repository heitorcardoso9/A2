import React, { useState, useMemo } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
                <Pressable style={styles.card} onPress={() => { }}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{title}</Text>
                        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={20} color="#5C6962" />
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
    card: { width: '85%', maxHeight: '60%', backgroundColor: '#fff', borderRadius: 16, padding: 16 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    title: { fontWeight: '700', fontSize: 15 },
    closeBtn: { padding: 4 },
    search: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 10, fontSize: 14, marginBottom: 8 },
    option: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    optionText: { fontSize: 14, color: '#1B231F' },
    empty: { textAlign: 'center', color: '#8B958F', paddingVertical: 20, fontSize: 13 },
});