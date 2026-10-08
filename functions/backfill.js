// Recalcula os agregados de todos os usuários que já têm avaliações (rodar uma vez após o deploy).
// Uso: GOOGLE_CLOUD_PROJECT=<id-do-projeto> node backfill.js
// Requer credenciais: `gcloud auth application-default login` ou GOOGLE_APPLICATION_CREDENTIALS.
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { recomputeUserAggregates } = require('./aggregates');

initializeApp();
const db = getFirestore();

(async () => {
  const snap = await db.collection('reviews').select('reviewedId').get();
  const userIds = new Set(snap.docs.map((d) => d.get('reviewedId')).filter(Boolean));
  console.log(`Recalculando ${userIds.size} usuário(s)...`);
  for (const uid of userIds) {
    const ok = await recomputeUserAggregates(db, uid);
    console.log(`${ok ? 'ok     ' : 'ausente'} ${uid}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
