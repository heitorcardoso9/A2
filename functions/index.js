const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { recomputeUserAggregates } = require('./aggregates');

initializeApp();
const db = getFirestore();

// Região deve ser a mesma (ou compatível) do seu Firestore. Veja em Firebase Console > Firestore.
// Ex.: banco em southamerica-east1 -> 'southamerica-east1'. Banco nam5 (US multi-region) -> 'us-central1'.
const REGION = 'us-central1';

/**
 * Sempre que uma avaliação é criada, editada ou apagada, recalcula a reputação
 * do usuário avaliado. É a única fonte de verdade dos agregados: o app não grava mais esses campos.
 */
exports.onReviewWritten = onDocumentWritten(
  { document: 'reviews/{reviewId}', region: REGION },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const userIds = new Set([before?.reviewedId, after?.reviewedId].filter(Boolean));
    await Promise.all([...userIds].map((uid) => recomputeUserAggregates(db, uid)));
  }
);
