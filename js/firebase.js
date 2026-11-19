// LDR Playroom by DiRi — Firebase Realtime Database + Anonymous Auth.
// This is a browser Firebase config. Database access is protected by RTDB Rules.
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
  set,
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
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app, firebaseConfig.databaseURL);

export class RoomError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RoomError';
    this.code = code;
  }
}

export function normalizeFirebaseError(error, fallback = 'Terjadi kendala saat menghubungi Firebase.') {
  const code = String(error?.code || '').toLowerCase();
  if (code.includes('permission-denied') || code.includes('permission_denied')) {
    return new RoomError('permission-denied', 'Firebase menolak akses. Pastikan Rules terbaru sudah di-Publish dan kedua perangkat memakai versi website terbaru.');
  }
  if (code.includes('network') || code.includes('unavailable')) {
    return new RoomError('network-error', 'Koneksi internet terputus atau Firebase belum bisa dijangkau. Periksa jaringan lalu coba lagi.');
  }
  if (code.includes('auth/operation-not-allowed')) {
    return new RoomError('auth-disabled', 'Anonymous Authentication belum aktif di Firebase Console.');
  }
  return new RoomError(code || 'unknown', error?.message || fallback);
}

export async function ensureAnonymousUser() {
  if (auth.currentUser) return auth.currentUser;

  return new Promise((resolve, reject) => {
    let unsubscribe = () => {};
    unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (user) {
        resolve(user);
        return;
      }
      try {
        const credential = await signInAnonymously(auth);
        resolve(credential.user);
      } catch (error) {
        reject(normalizeFirebaseError(error, 'Gagal membuat sesi pemain anonim.'));
      }
    }, (error) => {
      unsubscribe();
      reject(normalizeFirebaseError(error, 'Gagal memeriksa sesi pemain.'));
    });
  });
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeRoomCode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
}

function cleanName(value) {
  const name = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 20);
  if (!name) throw new RoomError('invalid-name', 'Nama panggilan harus diisi.');
  return name;
}

function playerRecord(name, joinedAt = Date.now()) {
  return {
    name,
    joinedAt,
    online: true,
    lastSeen: Date.now(),
  };
}

function isPermissionError(error) {
  const code = String(error?.code || '').toLowerCase();
  return code.includes('permission-denied') || code.includes('permission_denied');
}

/**
 * Create room using a seat-claim transaction only at /hostUid.
 * Room metadata and profile are then written to their own leaf paths atomically.
 */
export async function createRoom({ name, user }) {
  const safeName = cleanName(name);
  if (!user?.uid) throw new RoomError('no-user', 'Sesi pemain belum siap. Muat ulang halaman.');

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = makeRoomCode();
    const roomRef = ref(db, `rooms/${code}`);
    const hostUidRef = ref(db, `rooms/${code}/hostUid`);

    try {
      const claim = await runTransaction(
        hostUidRef,
        (currentValue) => currentValue === null ? user.uid : undefined,
        { applyLocally: false },
      );
      if (!claim.committed) continue;

      const now = Date.now();
      const updates = {};
      updates[`rooms/${code}/createdAt`] = now;
      updates[`rooms/${code}/players/${user.uid}`] = playerRecord(safeName, now);

      try {
        await update(ref(db), updates);
      } catch (error) {
        // Roll back the reserved host seat if the rest of room creation failed.
        await remove(hostUidRef).catch(() => {});
        throw error;
      }

      return code;
    } catch (error) {
      if (error instanceof RoomError) throw error;
      if (isPermissionError(error)) {
        throw normalizeFirebaseError(error, 'Firebase menolak pembuatan room.');
      }
      throw normalizeFirebaseError(error, 'Gagal membuat room.');
    }
  }

  throw new RoomError('code-generation-failed', 'Belum berhasil mendapatkan kode unik. Tekan Create Room sekali lagi.');
}

/**
 * Join by atomically claiming only /guestUid. This avoids parent-room writes,
 * which were the source of the previous Rules/transaction mismatch.
 */
export async function joinRoom({ code, name, user }) {
  const safeName = cleanName(name);
  const normalizedCode = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-Z0-9]{6}$/.test(normalizedCode)) {
    throw new RoomError('invalid-code', 'Kode room harus terdiri dari 6 karakter.');
  }
  if (!user?.uid) throw new RoomError('no-user', 'Sesi pemain belum siap. Muat ulang halaman.');

  const roomRef = ref(db, `rooms/${normalizedCode}`);
  let snapshot;
  try {
    snapshot = await get(roomRef);
  } catch (error) {
    if (isPermissionError(error)) {
      throw new RoomError('room-private-or-full', 'Room tidak dapat dibaca. Kemungkinan room sudah diisi pemain lain, atau Rules belum sesuai dengan versi terbaru.');
    }
    throw normalizeFirebaseError(error, 'Gagal memeriksa room.');
  }

  if (!snapshot.exists()) {
    throw new RoomError('room-not-found', 'Room tidak ditemukan. Periksa kode atau minta host membuat room baru.');
  }

  const room = snapshot.val();
  if (!room?.hostUid || !room?.createdAt) {
    throw new RoomError('room-incomplete', 'Room belum siap. Minta host membuat room baru.');
  }

  const now = Date.now();
  if (room.hostUid === user.uid) {
    const hostPlayerRef = ref(db, `rooms/${normalizedCode}/players/${user.uid}`);
    try {
      await set(hostPlayerRef, playerRecord(safeName, room.players?.[user.uid]?.joinedAt || now));
      return normalizedCode;
    } catch (error) {
      throw normalizeFirebaseError(error, 'Tidak bisa menyambungkan kembali host.');
    }
  }

  if (room.guestUid && room.guestUid !== user.uid) {
    throw new RoomError('room-full', 'Room sudah memiliki dua pemain. Minta host membuat room baru.');
  }

  const guestUidRef = ref(db, `rooms/${normalizedCode}/guestUid`);
  try {
    const claim = await runTransaction(
      guestUidRef,
      (currentValue) => {
        if (currentValue === null) return user.uid;
        if (currentValue === user.uid) return user.uid; // reconnect same browser/session
        return undefined;
      },
      { applyLocally: false },
    );

    if (!claim.committed) {
      throw new RoomError('room-full', 'Room sudah diisi pasangan lain. Minta host membuat room baru.');
    }

    const previousJoinedAt = room.players?.[user.uid]?.joinedAt || now;
    const guestPlayerRef = ref(db, `rooms/${normalizedCode}/players/${user.uid}`);
    try {
      await set(guestPlayerRef, playerRecord(safeName, previousJoinedAt));
    } catch (error) {
      // Release the guest seat if profile creation fails, so it can be retried.
      await remove(guestUidRef).catch(() => {});
      throw error;
    }
    return normalizedCode;
  } catch (error) {
    if (error instanceof RoomError) throw error;
    if (isPermissionError(error)) {
      throw new RoomError('join-permission-denied', 'Firebase menolak proses Join. Periksa bahwa Rules baru sudah di-Publish dan file js/firebase.js serta js/app.js berasal dari paket terbaru.');
    }
    throw normalizeFirebaseError(error, 'Gagal bergabung ke room.');
  }
}

export function watchRoom(code, onData, onError) {
  return onValue(
    ref(db, `rooms/${code}`),
    (snapshot) => onData(snapshot.exists() ? snapshot.val() : null),
    (error) => onError?.(normalizeFirebaseError(error, 'Koneksi room terputus.')),
  );
}

export function startPresence(code, user) {
  const playerRef = ref(db, `rooms/${code}/players/${user.uid}`);
  const connectedRef = ref(db, '.info/connected');

  const unsubscribe = onValue(connectedRef, async (snapshot) => {
    if (snapshot.val() !== true) return;
    try {
      await onDisconnect(playerRef).update({ online: false, lastSeen: Date.now() });
      await update(playerRef, { online: true, lastSeen: Date.now() });
    } catch (error) {
      console.warn('[DiRi / LDR Playroom] Presence update failed:', error);
    }
  });

  return async () => {
    unsubscribe();
    try {
      await onDisconnect(playerRef).cancel();
    } catch (error) {
      console.warn('[DiRi / LDR Playroom] Presence cleanup failed:', error);
    }
  };
}

/**
 * Host removes each known leaf; guest removes only their seat and profile.
 * No transaction or write is issued against /rooms/{code} as a parent.
 */
export async function leaveRoom({ code, user }) {
  if (!code || !user?.uid) return;
  const roomRef = ref(db, `rooms/${code}`);
  let snapshot;
  try {
    snapshot = await get(roomRef);
  } catch (error) {
    throw normalizeFirebaseError(error, 'Tidak bisa membaca room sebelum keluar.');
  }
  if (!snapshot.exists()) return;

  const room = snapshot.val();
  const patch = {};

  if (room.hostUid === user.uid) {
    patch[`rooms/${code}/hostUid`] = null;
    patch[`rooms/${code}/createdAt`] = null;
    patch[`rooms/${code}/guestUid`] = null;
    Object.keys(room.players || {}).forEach((uid) => {
      patch[`rooms/${code}/players/${uid}`] = null;
    });
  } else if (room.guestUid === user.uid) {
    patch[`rooms/${code}/guestUid`] = null;
    patch[`rooms/${code}/players/${user.uid}`] = null;
  } else {
    return;
  }

  try {
    await update(ref(db), patch);
  } catch (error) {
    throw normalizeFirebaseError(error, 'Belum berhasil keluar dari room. Coba muat ulang lalu ulangi.');
  }
}
