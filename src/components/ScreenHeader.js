import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fontSize, fontWeight, spacing } from '../constants/theme';

export default function ScreenHeader({ title, onBack, rightElement }) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.back}>‹ Voltar</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.placeholder} />
      )}
      {title ? <Text style={styles.title}>{title}</Text> : <View style={{ flex: 1 }} />}
      {rightElement || <View style={styles.placeholder} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  back: { color: colors.primary, fontWeight: fontWeight.bold, fontSize: fontSize.xl },
  title: { fontWeight: fontWeight.bold, fontSize: fontSize.xl },
  placeholder: { width: 50 },
});