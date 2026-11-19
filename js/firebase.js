// LDR Playroom by DiRi — Firebase connection (Web SDK, modular CDN).
// Firebase web config is public by design. Database access is protected by Realtime Database Rules.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import {
  getDatabase,
  ref,
  get,
  update,
  remove,
  runTransaction,
  onValue,
  onDisconnect,
} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-database.js';

const firebaseConfig = {
  apiKey: 'AIzaSyB5zJsxfpw1CigEC7JW4US2OX75panKW3w',
  authDomain: 'ldr-playroom.firebaseapp.com',
  databaseURL: 'https://ldr-playroom-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'ldr-playroom',
  storageBucket: 'ldr-playroom.firebasestorage.app',
  messagingSenderId: '463949725675',
  appId: '1:463949725675:web:b75d2b1a5cd81d9d9ea3ae',
  measurementId: 'G-RPDX3Y7V7S',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app, firebaseConfig.databaseURL);

/** Wait for an existing anonymous session, or create one on this browser. */
export async function ensureAnonymousUser() {
  const existingUser = await new Promise((resolve) => {
    let unsubscribe = () => {};
    unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    }, () => resolve(null));
  });

  if (existingUser) return existingUser;
  const credential = await signInAnonymously(auth);
  return credential.user;
}

function makeRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const randomValues = new Uint8Array(6);
  crypto.getRandomValues(randomValues);
  return Array.from(randomValues, (value) => alphabet[value % alphabet.length]).join('');
}

/** Create a room. The host player is stored under their Firebase UID. */
export async function createRoom({ name, user }) {
  if (!user?.uid) throw new Error('Sesi pemain belum siap. Muat ulang halaman dan coba lagi.');

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = makeRoomCode();
    const now = Date.now();
    const roomRef = ref(db, `rooms/${code}`);
    const initialRoom = {
      hostUid: user.uid,
      createdAt: now,
      players: {
        [user.uid]: {
          name,
          joinedAt: now,
          online: true,
          lastSeen: now,
        },
      },
    };

    const result = await runTransaction(
      roomRef,
      (currentRoom) => (currentRoom === null ? initialRoom : undefined),
      { applyLocally: false },
    );

    if (result.committed) return code;
  }

  throw new Error('Belum berhasil membuat kode room. Silakan coba sekali lagi.');
}

/**
 * Claim the single guest seat first, then write the guest's player record.
 * A fixed guestUid makes the two-player limit enforceable in RTDB Rules
 * without unsupported child-count methods.
 */
export async function joinRoom({ code, name, user }) {
  if (!user?.uid) throw new Error('Sesi pemain belum siap. Muat ulang halaman dan coba lagi.');

  const normalizedCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-Z0-9]{6}$/.test(normalizedCode)) {
    throw new Error('Kode room harus terdiri dari 6 karakter.');
  }

  const roomRef = ref(db, `rooms/${normalizedCode}`);
  const roomSnapshot = await get(roomRef);
  if (!roomSnapshot.exists()) {
    throw new Error('Room tidak ditemukan. Periksa kembali kode yang diberikan pasanganmu.');
  }

  const room = roomSnapshot.val();
  const now = Date.now();
  const playerRef = ref(db, `rooms/${normalizedCode}/players/${user.uid}`);

  // Let the host re-open their own room without trying to occupy the guest seat.
  if (room.hostUid === user.uid) {
    const existingHost = room.players?.[user.uid];
    if (!existingHost) throw new Error('Data host tidak ditemukan di room ini.');
    await update(playerRef, { name, online: true, lastSeen: now });
    return normalizedCode;
  }

  const guestUidRef = ref(db, `rooms/${normalizedCode}/guestUid`);
  const claim = await runTransaction(
    guestUidRef,
    (currentGuestUid) => {
      if (currentGuestUid === null || currentGuestUid === user.uid) return user.uid;
      return undefined;
    },
    { applyLocally: false },
  );

  if (!claim.committed) {
    throw new Error('Room sudah memiliki dua pemain. Minta pasanganmu membuat room baru.');
  }

  const existingPlayer = room.players?.[user.uid] || null;
  try {
    await update(playerRef, {
      name,
      joinedAt: existingPlayer?.joinedAt || now,
      online: true,
      lastSeen: now,
    });
  } catch (error) {
    // Release the guest seat if writing the player profile fails.
    try {
      const latestClaim = await get(guestUidRef);
      if (latestClaim.val() === user.uid) await remove(guestUidRef);
    } catch (cleanupError) {
      console.warn('[LDR Playroom] Guest seat cleanup failed:', cleanupError);
    }
    throw error;
  }

  return normalizedCode;
}

/** Watch room data so both players see changes immediately. */
export function watchRoom(code, callback, onError) {
  return onValue(
    ref(db, `rooms/${code}`),
    (snapshot) => callback(snapshot.exists() ? snapshot.val() : null),
    onError,
  );
}

/** Keep a player's online flag in sync with the Firebase connection. */
export function startPresence(code, user) {
  const playerRef = ref(db, `rooms/${code}/players/${user.uid}`);
  const connectionRef = ref(db, '.info/connected');

  const unsubscribe = onValue(connectionRef, async (snapshot) => {
    if (snapshot.val() !== true) return;

    try {
      await onDisconnect(playerRef).update({
        online: false,
        lastSeen: Date.now(),
      });
      await update(playerRef, {
        online: true,
        lastSeen: Date.now(),
      });
    } catch (error) {
      console.error('[LDR Playroom] Presence update failed:', error);
    }
  });

  return async () => {
    unsubscribe();
    try {
      await onDisconnect(playerRef).cancel();
    } catch (error) {
      console.warn('[LDR Playroom] Could not cancel onDisconnect:', error);
    }
  };
}

/** The host closes the room; the guest frees their own seat. */
export async function leaveRoom({ code, user }) {
  const roomRef = ref(db, `rooms/${code}`);
  const roomSnapshot = await get(roomRef);
  if (!roomSnapshot.exists()) return;

  const room = roomSnapshot.val();
  if (room.hostUid === user.uid) {
    await remove(roomRef);
    return;
  }

  if (room.guestUid === user.uid) {
    // Remove the player before releasing guestUid; the Rules require this order.
    await remove(ref(db, `rooms/${code}/players/${user.uid}`));
    await remove(ref(db, `rooms/${code}/guestUid`));
  }
}
