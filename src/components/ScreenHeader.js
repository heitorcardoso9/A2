import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, spacing } from '../constants/theme';

export default function ScreenHeader({ title, onBack, rightElement }) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.6}
        >
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
          <Text style={styles.backText}>Voltar</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.placeholder} />
      )}

      {title ? <Text style={styles.titleAbsolute}>{title}</Text> : null}

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
  backBtn: {
    minWidth: 80,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.sm,
  },
  backText: {
    color: colors.primary,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.lg,
    marginLeft: -4,
  },
  titleAbsolute: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    zIndex: 1,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.xl,
    color: colors.text,
  },
  placeholder: { width: 80, height: 44 },
});