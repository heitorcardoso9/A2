const MAX_BADGES_PER_REVIEW = 5;

/**
 * Calcula os agregados de reputação a partir da lista de avaliações recebidas.
 * Mantém os mesmos campos que o app já lê: _reviewSum, _reviewCount, avgRating, _badgesCount.
 */
function computeAggregates(reviews) {
  let sum = 0;
  let count = 0;
  const badgesCount = {};
  for (const r of reviews) {
    const rating = Number(r.rating || 0);
    if (rating >= 1 && rating <= 5) {
      sum += rating;
      count += 1;
    }
    if (Array.isArray(r.badges)) {
      for (const b of r.badges.slice(0, MAX_BADGES_PER_REVIEW)) {
        if (typeof b === 'string') badgesCount[b] = (badgesCount[b] || 0) + 1;
      }
    }
  }
  return {
    _reviewSum: sum,
    _reviewCount: count,
    avgRating: count > 0 ? Math.round((sum / count) * 10) / 10 : 0,
    _badgesCount: badgesCount,
  };
}

/** Recalcula e grava os agregados de um usuário. Retorna false se o usuário não existe. */
async function recomputeUserAggregates(db, userId) {
  const snap = await db.collection('reviews').where('reviewedId', '==', userId).get();
  const aggregates = computeAggregates(snap.docs.map((d) => d.data()));
  try {
    // update() substitui o mapa _badgesCount inteiro (set+merge manteria chaves antigas)
    await db.collection('users').doc(userId).update(aggregates);
    return true;
  } catch (e) {
    if (e.code === 5) return false; // NOT_FOUND: perfil excluído
    throw e;
  }
}

module.exports = { computeAggregates, recomputeUserAggregates };
