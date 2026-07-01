import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, radius, fontSize, fontWeight, spacing } from '../constants/theme';

export default function Button({ label, onPress, variant = 'primary', disabled, loading, style }) {
  const variantStyle = VARIANTS[variant] || VARIANTS.primary;
  return (
    <TouchableOpacity
      style={[styles.base, variantStyle.button, disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={variantStyle.text.color} size="small" />
      ) : (
        <Text style={[styles.text, variantStyle.text]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const VARIANTS = {
  primary: { button: { backgroundColor: colors.primary }, text: { color: colors.white } },
  accent: { button: { backgroundColor: colors.accent }, text: { color: colors.white } },
  outline: { button: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border }, text: { color: colors.text } },
  ghost: { button: { backgroundColor: 'transparent' }, text: { color: colors.textSecondary } },
};

const styles = StyleSheet.create({
  base: { padding: spacing.md + 2, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: fontWeight.bold, fontSize: fontSize.base },
  disabled: { backgroundColor: colors.disabled },
});