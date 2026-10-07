import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight, radius } from '../constants/theme';
import { db, auth } from '../services/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import UserAvatar from './UserAvatar';
import UserName from './UserName';

const POSITIVE_BADGES = [
  { key: 'pontual',       label: 'Pontual',          icon: 'time-outline' },
  { key: 'comunicativo',  label: 'Comunicativo(a)', icon: 'chatbubble-outline' },
  { key: 'respeitoso',    label: 'Respeitoso(a)',   icon: 'heart-outline' },
  { key: 'compareceu',    label: 'Compareceu',         icon: 'checkmark-circle-outline' },
  { key: 'organizado',    label: 'Organizado(a)',   icon: 'layers-outline' },
];

export default function RatingModal({
  visible,
  onClose,
  reviewedUserId,
  reviewedUserEmail,
  reviewedUserName: _reviewedUserName,
  reviewedUserAvatar: _reviewedUserAvatar,
  activityPreview,
  existingInitial = null,
  onSubmitted,
}) {
  const [rating, setRating] = useState(existingInitial?.rating || 0);
  const [badges, setBadges] = useState(existingInitial?.badges || []);
  const [comment, setComment] = useState(existingInitial?.comment || '');
  const [submitting, setSubmitting] = useState(false);
  const [hoverStar, setHoverStar] = useState(0);

  useEffect(() => {
    if (visible) {
      setRating(existingInitial?.rating || 0);
      setBadges(existingInitial?.badges || []);
      setComment(existingInitial?.comment || '');
      setSubmitting(false);
    }
  }, [visible, existingInitial, reviewedUserId]);

  const reviewerId = auth.currentUser.uid;
  const activityId = activityPreview?.id;
  const reviewId = useMemo(() => {
    if (!activityId || !reviewerId || !reviewedUserId) return null;
    const sorted = [reviewerId, reviewedUserId].sort();
    return `r_${activityId}_${sorted[0]}_${sorted[1]}`;
  }, [activityId, reviewerId, reviewedUserId]);

  function toggleBadge(key) {
    setBadges((prev) => prev.includes(key) ? prev.filter((b) => b !== key) : [...prev, key]);
  }

  const canSubmit = rating >= 1;

  async function handleSubmit() {
    if (!canSubmit || !reviewId || submitting) return;
    setSubmitting(true);
    try {
      if (__DEV__) console.log('[RatingModal] L62: getDoc users (reviewed aggregates)...');
      const activitySnap = await getDoc(doc(db, 'users', reviewedUserId));
      if (__DEV__) console.log('[RatingModal] L62 ✅ OK: getDoc users (reviewed aggregates)');
      const userData = activitySnap.exists() ? activitySnap.data() : {};
      if (__DEV__) console.log('[RatingModal] L64: getDoc reviews (existe anterior?)...');
      const oldReviewSnap = await getDoc(doc(db, 'reviews', reviewId));
      if (__DEV__) console.log('[RatingModal] L64 ✅ OK: getDoc reviews (existe anterior)');
      const isNew = !oldReviewSnap.exists();
      const oldReview = isNew ? null : oldReviewSnap.data();

      const payloadReview = {
        id: reviewId,
        activityId,
        activityPreview: activityPreview || null,
        reviewerId,
        reviewerEmail: auth.currentUser.email,
        reviewedId: reviewedUserId,
        reviewedEmail: reviewedUserEmail,
        rating,
        badges,
        comment: comment.trim() || null,
        createdAt: Date.now(),
      };

      if (__DEV__) {
        console.log('[RatingModal] Etapa 1/2: criando doc de review', {
          reviewId,
          reviewerId,
          reviewedUserId,
          activityId,
          isNew,
        });
      }
      if (isNew) {
        await setDoc(doc(db, 'reviews', reviewId), payloadReview);
      } else {
        await setDoc(doc(db, 'reviews', reviewId), payloadReview, { merge: true });
      }
      if (__DEV__) {
        console.log('[RatingModal] ✅ Etapa 1/2 OK: review doc criado');
      }

      if (__DEV__) {
        console.log('[RatingModal] ⏳ Etapa 2 removida: aggregates serão calculados pelo listener no App.js (do usuário avaliado, update próprio sempre passa!)');
      }
      onSubmitted && onSubmitted(payloadReview);
      onClose && onClose();
    } catch (e) {
      console.warn('rating error (checar etapa acima no terminal)', e);
      if (__DEV__) {
        alert('Erro detalhe no terminal: ' + (e?.message || String(e)));
      }
      Alert.alert('Ops', 'Não foi possível enviar a avaliação. Tente de novo em instantes.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleResetClose() {
    setRating(existingInitial?.rating || 0);
    setBadges(existingInitial?.badges || []);
    setComment(existingInitial?.comment || '');
    onClose && onClose();
  }

  const displayStar = hoverStar || rating;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleResetClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.handleBar} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>Avaliar participação</Text>
            <TouchableOpacity onPress={handleResetClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl * 2 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {reviewedUserId ? (
              <View style={styles.reviewedUserCard}>
                <UserAvatar userId={reviewedUserId} fallbackEmail={reviewedUserEmail} size={48} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewedLabel}>Avaliando</Text>
                  <UserName
                    userId={reviewedUserId}
                    fallbackEmail={reviewedUserEmail}
                    style={[styles.reviewedName, { numberOfLines: 1 }]}
                    capitalize
                  />
                </View>
              </View>
            ) : null}

            {activityPreview ? (
              <View style={styles.activityCard}>
                <Text style={styles.activityTitle} numberOfLines={1}>
                  {activityPreview.title}
                </Text>
                {activityPreview.date ? (
                  <Text style={styles.activityDate}>
                    <Ionicons name="calendar-outline" size={13} /> {activityPreview.date}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <View style={{ alignItems: 'center', gap: spacing.sm }}>
              <Text style={styles.starsCaption}>Como foi a experiência?</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[1, 2, 3, 4, 5].map((n) => {
                  const filled = n <= displayStar;
                  return (
                    <TouchableOpacity
                      key={n}
                      activeOpacity={0.6}
                      onPress={() => setRating(n)}
                      onPressIn={() => setHoverStar(n)}
                      onPressOut={() => setHoverStar(0)}
                    >
                      <Ionicons
                        name={filled ? 'star' : 'star-outline'}
                        size={36}
                        color={filled ? '#F59E0B' : colors.textFaint}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
              {rating > 0 ? (
                <Text style={styles.ratingCaption}>
                  {rating === 1 ? '😟 Precisa melhorar' :
                   rating === 2 ? '😕 Poderia ser melhor' :
                   rating === 3 ? '😐 Foi ok' :
                   rating === 4 ? '😊 Muito bom' :
                                 '🤩 Incrível!'}
                </Text>
              ) : (
                <Text style={styles.ratingHint}>Toque em uma estrela para avaliar</Text>
              )}
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text style={styles.sectionTitle}>Destaques positivos (opcional)</Text>
              <View style={styles.badgesGrid}>
                {POSITIVE_BADGES.map((b) => {
                  const selected = badges.includes(b.key);
                  return (
                    <TouchableOpacity
                    key={b.key}
                      activeOpacity={0.75}
                      onPress={() => toggleBadge(b.key)}
                      style={[styles.badgeChip, selected && styles.badgeChipSelected]}
                    >
                      <Ionicons name={b.icon} size={16} color={selected ? colors.white : colors.primary} />
                      <Text style={[styles.badgeLabel, selected && styles.badgeLabelSelected]}>{b.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text style={styles.sectionTitle}>Comentário (opcional)</Text>
              <TextInput
                style={styles.textarea}
                multiline
                maxLength={280}
                placeholder="Conte um pouco sobre a experiência (até 280 caracteres)"
                placeholderTextColor={colors.textFaint}
                textAlignVertical="top"
                value={comment}
                onChangeText={setComment}
              />
              <Text style={styles.charCount}>{comment.length}/280</Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.btnGhost}
              activeOpacity={0.7}
              onPress={handleResetClose}
            >
              <Text style={styles.btnGhostLabel}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnPrimary, { opacity: canSubmit && !submitting ? 1 : 0.5 }]}
              activeOpacity={0.75}
              disabled={!canSubmit || submitting}
              onPress={handleSubmit}
            >
              <Text style={styles.btnPrimaryLabel}>
                {submitting ? 'Enviando…' : 'Enviar avaliação'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#00000055',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 24 } }),
  },
  handleBar: { alignSelf: 'center', marginTop: spacing.sm - 1, width: 44, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.sm },
  headerRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  activityCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, gap: 3, marginTop: 2 },
  activityTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  activityDate: { fontSize: fontSize.sm, color: colors.textSecondary },
  starsCaption: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  ratingCaption: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.medium },
  ratingHint: { fontSize: fontSize.sm, color: colors.textFaint },
  sectionTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold },
  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm - 2 },
  badgeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm - 2,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  badgeChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  badgeLabel: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.medium },
  badgeLabelSelected: { color: colors.white },
  textarea: {
    minHeight: 96,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1, borderColor: colors.borderLight,
    fontSize: fontSize.base,
    color: colors.text,
  },
  charCount: { alignSelf: 'flex-end', fontSize: fontSize.xs, color: colors.textFaint },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  btnGhost: {
    flex: 1,
    paddingVertical: spacing.md - 1,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
  },
  btnGhostLabel: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textSecondary },
  btnPrimary: {
    flex: 2,
    paddingVertical: spacing.md - 1,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  btnPrimaryLabel: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.white },
  reviewedUserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  reviewedLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  reviewedName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
});
