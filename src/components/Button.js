import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, fontSize, fontWeight, spacing } from '../constants/theme';

export default function Button({ label, onPress, variant = 'primary', disabled, loading, style, icon }) {
  const variantStyle = VARIANTS[variant] || VARIANTS.primary;
  const iconColor = variantStyle.text.color;
  return (
    <TouchableOpacity
      style={[styles.base, variantStyle.button, (disabled || loading) && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={variantStyle.text.color} size="small" />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: icon ? spacing.sm : 0 }}>
          {icon ? <Ionicons name={icon} size={18} color={iconColor} /> : null}
          <Text style={[styles.text, variantStyle.text]}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const VARIANTS = {
  primary: { button: { backgroundColor: colors.primary }, text: { color: colors.white } },
  accent: { button: { backgroundColor: colors.accent }, text: { color: colors.white } },
  outline: { button: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border }, text: { color: colors.text } },
  dangerOutline: { button: { backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.danger + '50' }, text: { color: colors.danger } },
  ghost: { button: { backgroundColor: 'transparent' }, text: { color: colors.textSecondary } },
};

const styles = StyleSheet.create({
  base: { padding: spacing.md + 2, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: fontWeight.bold, fontSize: fontSize.base },
  disabled: { opacity: 0.5 },
});