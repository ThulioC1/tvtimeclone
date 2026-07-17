import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const PROJECT_ID = 'tvtimeclone-14558';
const SERVICE_ACCOUNT_PATH = new URL('./serviceAccountKey.json', import.meta.url);

function getAdmin() {
  if (getApps().length) return getFirestore();
  const key = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
  initializeApp({ credential: cert(key) });
  return getFirestore();
}

async function recalcUser(db, uid) {
  const showsSnap = await db.collection('users').doc(uid).collection('userShows').get();
  let totalMinutes = 0;
  const writes = [];

  for (const showDoc of showsSnap.docs) {
    const showId = showDoc.id;
    const epsSnap = await db
      .collection('users').doc(uid).collection('userShows').doc(showId).collection('episodes')
      .get();

    let watchedCount = 0;
    for (const epDoc of epsSnap.docs) {
      const rt = epDoc.get('runtime');
      totalMinutes += typeof rt === 'number' && rt > 0 ? rt : 30;
      watchedCount += 1;
    }
    writes.push(showDoc.ref.update({ watchedCount }));
  }

  if (writes.length) await Promise.all(writes);
  await db.collection('users').doc(uid).update({ totalWatchMinutes: totalMinutes });
  return { shows: showsSnap.size, totalMinutes };
}

async function main() {
  const db = getAdmin();
  const usersSnap = await db.collection('users').get();
  console.log(`Encontrados ${usersSnap.size} usuários.`);
  let ok = 0;
  for (const u of usersSnap.docs) {
    try {
      const res = await recalcUser(db, u.id);
      console.log(`OK ${u.id}: ${res.shows} séries, ${res.totalMinutes} min`);
      ok += 1;
    } catch (err) {
      console.error(`ERRO ${u.id}:`, err.message);
    }
  }
  console.log(`Concluído. ${ok}/${usersSnap.size} usuários recalculados.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
