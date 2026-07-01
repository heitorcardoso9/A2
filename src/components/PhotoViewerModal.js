import React from 'react';
import { Modal, View, Image, TouchableOpacity, FlatList, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '../constants/theme';

const { width } = Dimensions.get('window');

export default function PhotoViewerModal({ visible, photos, initialIndex = 0, onClose }) {
  const insets = useSafeAreaInsets();
  if (!photos || photos.length === 0) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={[styles.closeBtn, { top: insets.top + spacing.lg }]} onPress={onClose}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <FlatList
          data={photos}
          horizontal
          pagingEnabled
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          keyExtractor={(item, index) => `${item}-${index}`}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.page}>
              <Image source={{ uri: item }} style={styles.image} resizeMode="contain" />
            </View>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' },
  closeBtn: { position: 'absolute', right: 20, zIndex: 10, padding: 8 },
  page: { width, justifyContent: 'center', alignItems: 'center' },
  image: { width, height: '80%' },
});