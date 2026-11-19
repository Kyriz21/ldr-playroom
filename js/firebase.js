// LDR Playroom by DiRi — Firebase connection (Web SDK, modular CDN).
// Firebase web config is public by design. Database access is protected by RTDB Rules.

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

/** Create a room with its host profile in one atomic transaction. */
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
 * Join the room with one atomic room-level transaction.
 * The guestUid claim and guest player profile are written together. This is
 * important because the Rules validate the complete room structure.
 */
export async function joinRoom({ code, name, user }) {
  if (!user?.uid) throw new Error('Sesi pemain belum siap. Muat ulang halaman dan coba lagi.');

  const normalizedCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-Z0-9]{6}$/.test(normalizedCode)) {
    throw new Error('Kode room harus terdiri dari 6 karakter.');
  }

  const roomRef = ref(db, `rooms/${normalizedCode}`);
  const initialSnapshot = await get(roomRef);
  if (!initialSnapshot.exists()) {
    throw new Error('Room tidak ditemukan. Periksa kembali kode yang diberikan pasanganmu.');
  }

  const initialRoom = initialSnapshot.val();
  const now = Date.now();

  // The host may reopen their own room on the same anonymous account.
  if (initialRoom.hostUid === user.uid) {
    const hostPlayerRef = ref(db, `rooms/${normalizedCode}/players/${user.uid}`);
    await update(hostPlayerRef, { name, online: true, lastSeen: now });
    return normalizedCode;
  }

  if (initialRoom.guestUid && initialRoom.guestUid !== user.uid) {
    throw new Error('Room sudah memiliki dua pemain. Minta pasanganmu membuat room baru.');
  }

  const result = await runTransaction(
    roomRef,
    (currentRoom) => {
      if (!currentRoom || !currentRoom.hostUid || !currentRoom.players?.[currentRoom.hostUid]) {
        return undefined;
      }

      // A room has one guest seat. The same guest can reconnect using the
      // same anonymous Firebase UID; a different UID cannot take that seat.
      if (currentRoom.guestUid && currentRoom.guestUid !== user.uid) {
        return undefined;
      }

      const existingPlayer = currentRoom.players?.[user.uid] || null;
      const players = { ...(currentRoom.players || {}) };
      players[user.uid] = {
        name,
        joinedAt: existingPlayer?.joinedAt || now,
        online: true,
        lastSeen: now,
      };

      return {
        ...currentRoom,
        guestUid: user.uid,
        players,
      };
    },
    { applyLocally: false },
  );

  if (result.committed) return normalizedCode;

  const latestRoom = result.snapshot?.val();
  if (!latestRoom) {
    throw new Error('Room tidak ditemukan. Periksa kembali kode yang diberikan pasanganmu.');
  }
  if (latestRoom.guestUid && latestRoom.guestUid !== user.uid) {
    throw new Error('Room sudah memiliki dua pemain. Minta pasanganmu membuat room baru.');
  }

  throw new Error('Belum berhasil bergabung ke room. Coba lagi, atau minta host membuat room baru.');
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

/** Host deletes the room; guest leaves by atomically freeing their seat. */
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
    const result = await runTransaction(
      roomRef,
      (currentRoom) => {
        if (!currentRoom || currentRoom.guestUid !== user.uid) return undefined;
        const nextRoom = { ...currentRoom };
        const nextPlayers = { ...(currentRoom.players || {}) };
        delete nextRoom.guestUid;
        delete nextPlayers[user.uid];
        nextRoom.players = nextPlayers;
        return nextRoom;
      },
      { applyLocally: false },
    );

    if (!result.committed) {
      throw new Error('Belum berhasil keluar dari room. Muat ulang halaman lalu coba lagi.');
    }
  }
}
