import { doc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';

export async function cleanupDuplicateParticipations(userId) {
  if (!userId) return;
  try {
    const q = query(collection(db, 'participations'), where('userId', '==', userId));
    const snap = await getDocs(q);
    if (snap.empty) return;
    const todos = [];
    for (const d of snap.docs) {
      todos.push({ id: d.id, ...d.data() });
    }
    const porAtividade = new Map();
    for (const p of todos) {
      if (!porAtividade.has(p.activityId)) porAtividade.set(p.activityId, []);
      porAtividade.get(p.activityId).push(p);
    }
    const STATUS_PRIORITY = { confirmado: 4, espera: 3, pendente: 2, recusado: 1 };
    let deletadas = 0;
    const promessasDelete = [];
    for (const [, grupo] of porAtividade) {
      if (grupo.length <= 1) continue;
      grupo.sort((a, b) => {
        const pa = STATUS_PRIORITY[a.status] || 0;
        const pb = STATUS_PRIORITY[b.status] || 0;
        if (pb !== pa) return pb - pa;
        const ca = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt || 0);
        const cb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt || 0);
        return cb - ca;
      });
      const paraDeletar = grupo.slice(1);
      for (const extra of paraDeletar) {
        promessasDelete.push(deleteDoc(doc(db, 'participations', extra.id)));
        deletadas += 1;
      }
    }
    if (deletadas > 0) {
      console.log(`[App] Limpando ${deletadas} participations duplicadas...`);
      await Promise.all(promessasDelete);
      console.log(`[App] ${deletadas} participations duplicadas apagadas.`);
    }
  } catch (e) {
    console.warn('[App] cleanupDuplicateParticipations erro:', e);
  }
}
