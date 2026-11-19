// LDR Playroom by DiRi — UI and two-player room flow.
import {
  ensureAnonymousUser,
  createRoom,
  joinRoom,
  watchRoom,
  startPresence,
  leaveRoom,
} from './firebase.js';

const roomDialog = document.getElementById('roomDialog');
const roomForm = document.getElementById('roomForm');
const roomCodeField = document.getElementById('roomCodeField');
const roomCodeInput = document.getElementById('roomCode');
const playerNameInput = document.getElementById('playerName');
const roomDialogTitle = document.getElementById('roomDialogTitle');
const dialogDescription = document.getElementById('dialogDescription');
const roomSubmit = document.getElementById('roomSubmit');
const roomError = document.getElementById('roomError');
const roomLobby = document.getElementById('roomLobby');
const lobbyRoomCode = document.getElementById('lobbyRoomCode');
const roomStatus = document.getElementById('roomStatus');
const roomPlayers = document.getElementById('roomPlayers');
const copyRoomCode = document.getElementById('copyRoomCode');
const leaveRoomButton = document.getElementById('leaveRoom');
const toast = document.getElementById('toast');
const menuToggle = document.getElementById('menuToggle');
const mainNav = document.getElementById('mainNav');
const headerRoomButton = document.querySelector('.header-room-button');

function setHeaderRoomButton(label) {
  if (headerRoomButton) headerRoomButton.textContent = label;
}

let roomMode = 'create';
let toastTimer;
let currentUser = null;
let activeRoomCode = null;
let activeRoomData = null;
let stopWatchingRoom = null;
let stopPresence = null;
let isSubmitting = false;

const requiredElements = [
  roomDialog, roomForm, roomCodeField, roomCodeInput, playerNameInput,
  roomDialogTitle, dialogDescription, roomSubmit, roomError, roomLobby,
  lobbyRoomCode, roomStatus, roomPlayers, copyRoomCode, leaveRoomButton,
  toast, menuToggle, mainNav,
];

if (requiredElements.some((element) => !element)) {
  throw new Error('[LDR Playroom by DiRi] Ada elemen HTML yang belum cocok dengan app.js. Pastikan menggunakan index.html versi DiRi terbaru.');
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 4200);
}

function setRoomError(message = '') {
  roomError.textContent = message;
  roomError.classList.toggle('is-visible', Boolean(message));
}

function setSubmitting(isBusy) {
  isSubmitting = isBusy;
  roomSubmit.disabled = isBusy;
  roomSubmit.textContent = isBusy
    ? 'Connecting…'
    : roomMode === 'join' ? 'Join room ♡' : 'Create room ♡';
}

function openRoomDialog(mode) {
  if (activeRoomCode) {
    showRoomLobby();
    if (!roomDialog.open) roomDialog.showModal();
    return;
  }

  roomMode = mode === 'join' ? 'join' : 'create';
  const isJoin = roomMode === 'join';

  roomDialogTitle.textContent = isJoin ? 'Join your person.' : "Let's get together.";
  dialogDescription.textContent = isJoin
    ? 'Masukkan nama dan kode room yang dibagikan pasanganmu.'
    : 'Buat ruang kecil untuk kalian berdua. Bagikan kodenya kepada pasangan.';
  roomCodeField.classList.toggle('is-visible', isJoin);
  roomCodeInput.required = isJoin;
  roomForm.hidden = false;
  roomLobby.hidden = true;
  setRoomError('');
  setSubmitting(false);

  if (!roomDialog.open) roomDialog.showModal();
  window.setTimeout(() => playerNameInput.focus(), 50);
}

function closeRoomDialog() {
  if (roomDialog.open) roomDialog.close();
  if (!activeRoomCode) {
    roomForm.reset();
    setRoomError('');
    roomCodeField.classList.remove('is-visible');
  }
}

function showRoomLobby() {
  roomForm.hidden = true;
  roomLobby.hidden = false;
  roomDialogTitle.textContent = 'You are in your room.';
  dialogDescription.textContent = 'Bagikan kode ini kepada pasanganmu untuk mulai bermain bersama.';
  lobbyRoomCode.textContent = activeRoomCode || '------';
  copyRoomCode.textContent = 'Copy code';
  renderRoomPlayers(activeRoomData);
}

function renderRoomPlayers(room) {
  roomPlayers.replaceChildren();
  const players = room?.players ? Object.entries(room.players) : [];

  players.forEach(([uid, player]) => {
    const row = document.createElement('div');
    row.className = 'room-player';

    const avatar = document.createElement('span');
    avatar.className = 'room-player-avatar';
    avatar.textContent = (player.name || '?').trim().charAt(0).toUpperCase();

    const details = document.createElement('span');
    details.className = 'room-player-details';
    const name = document.createElement('strong');
    name.textContent = uid === currentUser?.uid ? `${player.name || 'Player'} (You)` : (player.name || 'Player');
    const role = document.createElement('small');
    role.textContent = uid === room.hostUid ? 'Room host' : 'Guest';
    details.append(name, role);

    const status = document.createElement('span');
    status.className = `player-presence ${player.online ? 'is-online' : 'is-offline'}`;
    status.textContent = player.online ? 'Online' : 'Offline';

    row.append(avatar, details, status);
    roomPlayers.append(row);
  });

  if (players.length >= 2) {
    roomStatus.textContent = 'Pasanganmu sudah bergabung. Room kalian siap! ♡';
    roomStatus.classList.add('is-ready');
  } else {
    roomStatus.textContent = 'Menunggu pasanganmu bergabung… Bagikan kode room di atas.';
    roomStatus.classList.remove('is-ready');
  }
}

function mapFirebaseError(error) {
  const message = error?.message || '';
  if (message.includes('Database URL belum diisi')) {
    return 'Database URL belum diisi. Buka js/firebase.js dan tempel URL dari Firebase Realtime Database.';
  }
  const code = error?.code || '';
  if (code.includes('permission-denied') || code.includes('PERMISSION_DENIED')) {
    return 'Akses database ditolak. Periksa Realtime Database Rules dan pastikan Anonymous Authentication aktif.';
  }
  if (code.includes('auth/operation-not-allowed')) {
    return 'Anonymous Authentication belum diaktifkan di Firebase Authentication.';
  }
  if (code.includes('network')) {
    return 'Koneksi internet bermasalah. Periksa jaringan lalu coba lagi.';
  }
  return error?.message || 'Terjadi kesalahan. Silakan coba lagi.';
}

async function enterRoom(code) {
  activeRoomCode = code;
  lobbyRoomCode.textContent = code;
  showRoomLobby();

  if (stopWatchingRoom) stopWatchingRoom();
  if (stopPresence) await stopPresence();

  stopWatchingRoom = watchRoom(code, (room) => {
    if (!room) {
      activeRoomCode = null;
      activeRoomData = null;
      if (stopWatchingRoom) stopWatchingRoom();
      stopWatchingRoom = null;
      if (stopPresence) stopPresence();
      stopPresence = null;
      roomLobby.hidden = true;
      roomForm.hidden = false;
      if (roomDialog.open) roomDialog.close();
      setHeaderRoomButton('↗ Join a room');
      showToast('Room telah ditutup oleh host. Kamu bisa membuat room baru.');
      return;
    }

    activeRoomData = room;
    if (!roomLobby.hidden) renderRoomPlayers(room);
  }, (error) => {
    setRoomError(mapFirebaseError(error));
    showToast(mapFirebaseError(error));
  });

  stopPresence = startPresence(code, currentUser);
  setHeaderRoomButton('♡ My room');
}

async function handleRoomSubmit(event) {
  event.preventDefault();
  if (isSubmitting) return;

  const playerName = playerNameInput.value.trim();
  const roomCode = roomCodeInput.value.trim().toUpperCase();
  if (!playerName) {
    playerNameInput.focus();
    return;
  }
  if (roomMode === 'join' && !/^[A-Z0-9]{6}$/.test(roomCode)) {
    setRoomError('Masukkan kode room yang terdiri dari 6 karakter.');
    roomCodeInput.focus();
    return;
  }

  setRoomError('');
  setSubmitting(true);

  try {
    currentUser = currentUser || await authReady;
    if (!currentUser) throw new Error('Tidak berhasil masuk secara anonim. Muat ulang halaman dan coba lagi.');

    const code = roomMode === 'create'
      ? await createRoom({ name: playerName, user: currentUser })
      : await joinRoom({ code: roomCode, name: playerName, user: currentUser });

    await enterRoom(code);
    showRoomLobby();
    if (!roomDialog.open) roomDialog.showModal();
  } catch (error) {
    console.error('[LDR Playroom] Room action failed:', error);
    setRoomError(mapFirebaseError(error));
  } finally {
    setSubmitting(false);
  }
}

async function handleLeaveRoom() {
  if (!activeRoomCode || !currentUser) return;
  const code = activeRoomCode;
  const shouldLeave = window.confirm('Keluar dari room ini? Jika kamu pembuat room, room akan ditutup untuk pasanganmu juga.');
  if (!shouldLeave) return;

  leaveRoomButton.disabled = true;
  try {
    if (stopWatchingRoom) stopWatchingRoom();
    stopWatchingRoom = null;
    if (stopPresence) await stopPresence();
    stopPresence = null;
    await leaveRoom({ code, user: currentUser });
    activeRoomCode = null;
    activeRoomData = null;
    roomForm.reset();
    roomForm.hidden = false;
    roomLobby.hidden = true;
    if (roomDialog.open) roomDialog.close();
    setHeaderRoomButton('↗ Join a room');
    showToast('Kamu sudah keluar dari room. Sampai jumpa di permainan berikutnya!');
  } catch (error) {
    showToast(mapFirebaseError(error));
  } finally {
    leaveRoomButton.disabled = false;
  }
}

document.querySelectorAll('[data-open-room]').forEach((button) => {
  button.addEventListener('click', () => {
    openRoomDialog(button.dataset.openRoom);
    mainNav.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
  });
});

document.getElementById('closeDialog').addEventListener('click', closeRoomDialog);
roomDialog.addEventListener('click', (event) => {
  if (event.target === roomDialog) closeRoomDialog();
});
roomForm.addEventListener('submit', handleRoomSubmit);
leaveRoomButton.addEventListener('click', handleLeaveRoom);
copyRoomCode.addEventListener('click', async () => {
  if (!activeRoomCode) return;
  try {
    await navigator.clipboard.writeText(activeRoomCode);
    copyRoomCode.textContent = 'Copied! ♡';
    showToast('Kode room berhasil disalin. Kirim ke pasanganmu!');
    window.setTimeout(() => { copyRoomCode.textContent = 'Copy code'; }, 1800);
  } catch {
    showToast(`Kode room kalian: ${activeRoomCode}`);
  }
});

roomCodeInput.addEventListener('input', () => {
  roomCodeInput.value = roomCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
});

document.querySelectorAll('[data-game-open]').forEach((button) => {
  button.addEventListener('click', () => {
    if (!activeRoomCode) {
      showToast('Buat atau gabung room terlebih dahulu untuk bermain bersama.');
      openRoomDialog('create');
      return;
    }
    showToast(`${button.dataset.gameOpen} akan diaktifkan pada tahap pengembangan game berikutnya.`);
  });
});

menuToggle.addEventListener('click', () => {
  const isOpen = mainNav.classList.toggle('is-open');
  menuToggle.setAttribute('aria-expanded', String(isOpen));
  menuToggle.setAttribute('aria-label', isOpen ? 'Tutup navigasi' : 'Buka navigasi');
});

mainNav.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    mainNav.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
  });
});

const authReady = ensureAnonymousUser()
  .then((user) => {
    currentUser = user;
    return user;
  })
  .catch((error) => {
    console.error('[LDR Playroom] Anonymous sign-in failed:', error);
    showToast(mapFirebaseError(error));
    throw error;
  });

// Avoid an unhandled rejection when a visitor opens the page but does not create/join a room.
authReady.catch(() => {});

document.getElementById('currentYear').textContent = new Date().getFullYear();
