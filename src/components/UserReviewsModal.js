import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { colors, spacing, radius, fontSize, fontWeight } from '../constants/theme';
import UserAvatar from './UserAvatar';
import UserName from './UserName';

export const BADGES_META = [
  { key: 'pontual',      label: 'Pontual',       emoji: '⏰' },
  { key: 'comunicativo', label: 'Comunicativo',  emoji: '💬' },
  { key: 'respeitoso',   label: 'Respeitoso',    emoji: '💚' },
  { key: 'compareceu',   label: 'Compareceu',    emoji: '✅' },
  { key: 'organizado',   label: 'Organizado',    emoji: '🗂️' },
];

export default function UserReviewsModal({ visible, onClose, userId, userName, userAvatar, fallbackEmail, avgRating = 0, totalReviews = 0, badgesCount = {} }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible || !userId) return;
    setLoading(true);
    const q = query(collection(db, 'reviews'), where('reviewedId', '==', userId));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt || 0);
        const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt || 0);
        return tb - ta;
      });
      setReviews(list);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [visible, userId]);

  const distribution = useMemo(() => {
    const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const r of reviews) {
      const k = Math.min(5, Math.max(1, Number(r.rating) || 0));
      if (k) dist[k] += 1;
    }
    return dist;
  }, [reviews]);

  const badgesSorted = useMemo(() => {
    const total = Object.entries(badgesCount || {}).reduce((s, [, v]) => s + Number(v || 0), 0);
    const list = BADGES_META.map((m) => ({ ...m, count: Number(badgesCount?.[m.key] || 0) }))
      .filter((b) => b.count > 0)
      .sort((a, b) => b.count - a.count);
    return { total, list };
  }, [badgesCount]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <SafeAreaView style={{ flex: 0 }} edges={['top']}>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Avaliações</Text>
                <Text style={styles.subtitle}>Confira o que as pessoas disseram</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} activeOpacity={0.7} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.overviewCard}>
              <View style={styles.overviewLeft}>
                <UserAvatar userId={userId} fallbackEmail={fallbackEmail} size={52} />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <UserName userId={userId} fallbackEmail={fallbackEmail} style={styles.overviewName} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <Ionicons name="star" size={14} color="#F59E0B" />
                    <Text style={styles.overviewAvg}>{Number(avgRating || 0).toFixed(1)}</Text>
                    <Text style={styles.overviewTotal}>· {totalReviews || 0} {totalReviews === 1 ? 'avaliação' : 'avaliações'}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.distribution}>
                {[5, 4, 3, 2, 1].map((n) => {
                  const c = distribution[n] || 0;
                  const pct = reviews.length > 0 ? (c / reviews.length) * 100 : 0;
                  return (
                    <View key={n} style={styles.distRow}>
                      <Text style={styles.distN}>{n}</Text>
                      <Ionicons name="star" size={11} color="#F59E0B" style={{ marginRight: 8 }} />
                      <View style={styles.distTrack}>
                        <View style={[styles.distFill, { width: `${pct}%` }]} />
                      </View>
                      <Text style={styles.distCount}>{c}</Text>
                    </View>
                  );
                })}
              </View>

              {badgesSorted.total > 0 ? (
                <View style={styles.badgesWrap}>
                  <Text style={styles.badgesTitle}>Selos recebidos · {badgesSorted.total}</Text>
                  <View style={styles.badgesRow}>
                    {badgesSorted.list.map((b) => (
                      <View key={b.key} style={styles.badgeChip}>
                        <Text style={styles.badgeEmoji}>{b.emoji}</Text>
                        <Text style={styles.badgeLabel} numberOfLines={1}>{b.label}</Text>
                        <View style={styles.badgeCountWrap}>
                          <Text style={styles.badgeCount}>{b.count}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>

            {loading ? (
              <View style={{ paddingVertical: spacing.xxl }}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : reviews.length === 0 ? (
              <EmptyReviews />
            ) : (
              <View style={{ marginTop: spacing.md, gap: spacing.md }}>
                {reviews.map((r) => (
                  <ReviewCard key={r.id} review={r} />
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function EmptyReviews() {
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxl * 2, paddingHorizontal: spacing.xl }}>
      <View style={styles.emptyIcon}>
        <Ionicons name="star-half" size={26} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>Sem avaliações por enquanto</Text>
      <Text style={styles.emptySub}>Quando esse usuário participar de atividades, as avaliações aparecerão aqui.</Text>
    </View>
  );
}

function ReviewCard({ review }) {
  const rating = Number(review.rating) || 0;
  const badges = Array.isArray(review.badges) ? review.badges : [];
  let dataText = '';
  try {
    if (review.createdAt) {
      const d = review.createdAt.toDate ? review.createdAt.toDate() : new Date(review.createdAt);
      const agora = Date.now();
      const difMs = agora - d.getTime();
      const dias = Math.floor(difMs / (24 * 60 * 60 * 1000));
      if (dias === 0) dataText = 'Hoje';
      else if (dias === 1) dataText = 'Ontem';
      else if (dias < 7) dataText = `há ${dias} dias`;
      else dataText = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
  } catch {}
  const badgesMeta = BADGES_META.reduce((acc, m) => { acc[m.key] = m; return acc; }, {});
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHead}>
        <UserAvatar userId={review.reviewerId} size={40} />
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <UserName userId={review.reviewerId} style={styles.reviewerName} />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            {[1,2,3,4,5].map((i) => (
              <Ionicons key={i} name={i <= rating ? 'star' : 'star-outline'} size={13} color="#F59E0B" style={{ marginRight: 1 }} />
            ))}
            {dataText ? <Text style={styles.reviewDate}>· {dataText}</Text> : null}
          </View>
        </View>
      </View>
      {badges.length > 0 ? (
        <View style={styles.reviewBadgesRow}>
          {badges.map((k) => {
            const meta = badgesMeta[k];
            if (!meta) return null;
            return (
              <View key={k} style={styles.reviewBadgeChip}>
                <Text style={styles.reviewBadgeEmoji}>{meta.emoji}</Text>
                <Text style={styles.reviewBadgeLabel}>{meta.label}</Text>
              </View>
            );
          })}
        </View>
      ) : null}
      {review.comment && typeof review.comment === 'string' && review.comment.trim() ? (
        <Text style={styles.reviewComment}>"{review.comment.trim()}"</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    maxHeight: '92%',
    minHeight: '60%',
    paddingTop: spacing.sm,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.placeholder || '#CBD5E1',
    marginBottom: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewCard: {
    backgroundColor: colors.surface || '#FFFFFF',
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border || '#E2E8F0',
  },
  overviewLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overviewName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  overviewAvg: {
    fontSize: fontSize.sm + 1,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginLeft: 4,
    marginRight: 4,
  },
  overviewTotal: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  distribution: {
    marginTop: spacing.md,
    gap: 4,
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distN: {
    width: 14,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  distTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.backgroundAlt,
    marginRight: spacing.sm,
    overflow: 'hidden',
  },
  distFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 3,
  },
  distCount: {
    width: 24,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  badgesWrap: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border || '#E2E8F0',
  },
  badgesTitle: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.sm,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.primaryTint || '#E7EEFC',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primaryTint || '#D7E3FB',
  },
  badgeEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  badgeLabel: {
    fontSize: fontSize.xs,
    color: colors.primary,
    fontWeight: fontWeight.medium,
    maxWidth: 120,
  },
  badgeCountWrap: {
    marginLeft: 6,
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCount: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: '#FFFFFF',
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTint || '#E7EEFC',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  reviewCard: {
    backgroundColor: colors.surface || '#FFFFFF',
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border || '#E2E8F0',
  },
  reviewHead: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewerName: {
    fontSize: fontSize.sm + 1,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  reviewDate: {
    fontSize: 11,
    color: colors.textSecondary,
    marginLeft: 6,
  },
  reviewBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.sm,
  },
  reviewBadgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: colors.backgroundAlt,
    borderRadius: radius.md,
  },
  reviewBadgeEmoji: {
    fontSize: 12,
    marginRight: 3,
  },
  reviewBadgeLabel: {
    fontSize: 11,
    color: colors.text,
    fontWeight: fontWeight.medium,
  },
  reviewComment: {
    marginTop: spacing.sm,
    fontSize: fontSize.sm,
    lineHeight: 19,
    color: colors.text,
    fontStyle: 'italic',
  },
});
