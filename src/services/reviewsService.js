import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * ID direcional (quem avalia -> quem é avaliado). O prefixo rv2_ nunca colide com os
 * IDs antigos (r_), que eram simétricos. Avaliações antigas reaproveitam o próprio ID.
 */
export function buildReviewId({ activityId, reviewerId, reviewedId, existingId = null }) {
  if (existingId) return existingId;
  if (!activityId || !reviewerId || !reviewedId) return null;
  return `rv2_${activityId}_${reviewerId}_${reviewedId}`;
}

/**
 * Cria ou atualiza uma avaliação. As médias do avaliado são recalculadas
 * pela Cloud Function onReviewWritten, o app não grava esses campos.
 */
export async function saveReview({ reviewId, activityPreview, reviewer, reviewedId, reviewedEmail, rating, badges, comment }) {
  const payload = {
    id: reviewId,
    activityId: activityPreview?.id,
    activityPreview: activityPreview || null,
    reviewerId: reviewer.uid,
    reviewerEmail: reviewer.email,
    reviewedId,
    reviewedEmail: reviewedEmail || null,
    rating,
    badges,
    comment: comment.trim() || null,
    createdAt: Date.now(),
  };
  await setDoc(doc(db, 'reviews', reviewId), payload, { merge: true });
  return payload;
}
