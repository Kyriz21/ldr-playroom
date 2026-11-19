import {
  ensureAnonymousUser,
  createRoom,
  joinRoom,
  watchRoom,
  startPresence,
  leaveRoom,
} from './firebase.js';

const $ = (id) => document.getElementById(id);
const roomDialog = $('roomDialog');
const roomForm = $('roomForm');
const playerNameInput = $('playerName');
const codeField = $('codeField');
const roomCodeInput = $('roomCode');
const roomTitle = $('roomTitle');
const roomLead = $('roomLead');
const roomError = $('roomError');
const roomSubmit = $('roomSubmit');
const roomLobby = $('roomLobby');
const lobbyCode = $('lobbyCode');
const lobbyStatus = $('lobbyStatus');
const playerList = $('playerList');
const roomTip = $('lobbyTip');
const roomGames = $('roomGames');
const copyCode = $('copyCode');
const leaveRoomButton = $('leaveRoom');
const gameDialog = $('gameDialog');
const toast = $('toast');

let mode = 'create';
let currentUser = null;
let activeCode = null;
let activeRoom = null;
let activeName = '';
let stopRoomWatch = null;
let stopPresenceWatch = null;
let toastTimer = null;
let submitting = false;

function notify(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 4200);
}

function showError(message) {
  roomError.textContent = message || '';
  roomError.hidden = !message;
}

function setBusy(busy) {
  submitting = busy;
  roomSubmit.disabled = busy;
  roomSubmit.textContent = busy ? 'Menghubungkan…' : (mode === 'join' ? 'Join room ♡' : 'Create room ♡');
}

function resetRoomDialog() {
  roomForm.hidden = false;
  roomLobby.hidden = true;
  codeField.hidden = mode !== 'join';
  roomTitle.textContent = mode === 'join' ? 'Join your person.' : "Let's get together.";
  roomLead.textContent = mode === 'join'
    ? 'Masukkan nama dan kode room yang dibagikan pasanganmu.'
    : 'Buat ruang kecil untuk kalian berdua. Bagikan kodenya kepada pasangan.';
  roomCodeInput.required = mode === 'join';
  showError('');
  setBusy(false);
}

function openRoom(modeToOpen) {
  if (!roomDialog) return;
  if (activeCode) {
    roomForm.hidden = true;
    roomLobby.hidden = false;
    renderRoom(activeRoom);
    if (!roomDialog.open) roomDialog.showModal();
    return;
  }
  mode = modeToOpen === 'join' ? 'join' : 'create';
  resetRoomDialog();
  if (!roomDialog.open) roomDialog.showModal();
  window.setTimeout(() => playerNameInput.focus({ preventScroll: true }), 100);
}

function stopRoomListeners() {
  if (stopRoomWatch) stopRoomWatch();
  if (stopPresenceWatch) stopPresenceWatch();
  stopRoomWatch = null;
  stopPresenceWatch = null;
}

function renderPlayers(room) {
  playerList.replaceChildren();
  const players = Object.entries(room?.players || {});
  players.sort(([uidA], [uidB]) => {
    if (uidA === room?.hostUid) return -1;
    if (uidB === room?.hostUid) return 1;
    return 0;
  });

  players.forEach(([uid, player]) => {
    const row = document.createElement('div');
    row.className = 'player-row';
    const avatar = document.createElement('span');
    avatar.className = 'player-avatar';
    avatar.textContent = (player.name || '?').trim().charAt(0).toUpperCase();
    const details = document.createElement('div');
    details.className = 'player-details';
    const name = document.createElement('b');
    name.textContent = uid === currentUser?.uid ? `${player.name || 'Player'} (You)` : (player.name || 'Player');
    const role = document.createElement('small');
    role.textContent = uid === room?.hostUid ? 'Room host' : 'Guest';
    details.append(name, role);
    const presence = document.createElement('span');
    presence.className = `presence ${player.online ? 'online' : ''}`;
    presence.textContent = player.online ? 'Online' : 'Offline';
    row.append(avatar, details, presence);
    playerList.append(row);
  });

  if (players.length < 2) {
    lobbyStatus.textContent = 'Menunggu pasanganmu bergabung… Bagikan kode room di atas.';
    roomTip.textContent = 'Pasanganmu bisa bergabung dari browser atau HP masing-masing menggunakan kode ini.';
    roomGames.hidden = true;
  } else {
    lobbyStatus.textContent = 'Yeay! Kalian sudah berada di room yang sama. Pilih permainan ♡';
    roomTip.textContent = 'Pilih salah satu aktivitas di bawah. Tampilan game sudah disesuaikan untuk HP dan laptop.';
    roomGames.hidden = false;
  }
}

function renderRoom(room) {
  if (!room) return;
  activeRoom = room;
  lobbyCode.textContent = activeCode || '------';
  renderPlayers(room);
}

function attachRoom(code, user) {
  stopRoomListeners();
  stopRoomWatch = watchRoom(code, (room) => {
    if (!room) {
      stopRoomListeners();
      activeCode = null;
      activeRoom = null;
      if (roomDialog.open) roomDialog.close();
      notify('Room sudah ditutup. Kamu bisa membuat room baru.');
      return;
    }
    renderRoom(room);
  }, (error) => {
    console.error('[DiRi / LDR Playroom] Room listener error:', error);
    lobbyStatus.textContent = error.message;
    notify(error.message);
  });
  stopPresenceWatch = startPresence(code, user);
}

async function handleRoomSubmit(event) {
  event.preventDefault();
  if (submitting) return;
  showError('');
  const name = playerNameInput.value.trim();
  const code = roomCodeInput.value.trim();
  if (!name) {
    showError('Nama panggilan harus diisi.');
    playerNameInput.focus();
    return;
  }
  if (mode === 'join' && !code) {
    showError('Masukkan kode room dari pasanganmu.');
    roomCodeInput.focus();
    return;
  }

  setBusy(true);
  try {
    currentUser = await ensureAnonymousUser();
    activeName = name;
    activeCode = mode === 'create'
      ? await createRoom({ name, user: currentUser })
      : await joinRoom({ code, name, user: currentUser });

    roomForm.hidden = true;
    roomLobby.hidden = false;
    roomTitle.textContent = 'You are in your room.';
    roomLead.textContent = 'Bagikan kode ini kepada pasanganmu untuk mulai bermain bersama.';
    lobbyCode.textContent = activeCode;
    lobbyStatus.textContent = 'Menghubungkan room…';
    roomGames.hidden = true;
    attachRoom(activeCode, currentUser);
    notify(mode === 'create' ? 'Room berhasil dibuat. Bagikan kodenya ya! ♡' : 'Berhasil bergabung ke room! ♡');
  } catch (error) {
    console.error('[DiRi / LDR Playroom] Room action failed:', error);
    showError(error?.message || 'Terjadi kendala. Coba lagi.');
  } finally {
    setBusy(false);
  }
}

async function handleLeaveRoom() {
  if (!activeCode || !currentUser) return;
  leaveRoomButton.disabled = true;
  leaveRoomButton.textContent = 'Leaving…';
  const codeToLeave = activeCode;
  stopRoomListeners();
  try {
    await leaveRoom({ code: codeToLeave, user: currentUser });
    activeCode = null;
    activeRoom = null;
    roomForm.reset();
    if (roomDialog.open) roomDialog.close();
    notify('Kamu sudah keluar dari room. Sampai bertemu lagi ♡');
  } catch (error) {
    console.error('[DiRi / LDR Playroom] Leave room failed:', error);
    notify(error?.message || 'Belum berhasil keluar dari room.');
    attachRoom(codeToLeave, currentUser);
  } finally {
    leaveRoomButton.disabled = false;
    leaveRoomButton.textContent = 'Leave room';
  }
}

function openGamePreview(gameName) {
  if (!activeCode || !activeRoom) {
    notify('Buat atau gabung room terlebih dahulu untuk memilih game.');
    openRoom('create');
    return;
  }
  const playerCount = Object.keys(activeRoom.players || {}).length;
  if (playerCount < 2) {
    notify('Tunggu pasanganmu bergabung dulu ya.');
    if (!roomDialog.open) roomDialog.showModal();
    return;
  }

  $('gameTitle').textContent = gameName;
  const people = Object.entries(activeRoom.players || {});
  const me = people.find(([uid]) => uid === currentUser?.uid)?.[1];
  const partner = people.find(([uid]) => uid !== currentUser?.uid)?.[1];
  $('gamePlayerOne').textContent = (me?.name || activeName || 'Y').charAt(0).toUpperCase();
  $('gamePlayerOneName').textContent = me?.name || activeName || 'You';
  $('gamePlayerTwo').textContent = (partner?.name || '♡').charAt(0).toUpperCase();
  $('gamePlayerTwoName').textContent = partner?.name || 'Your person';
  const board = $('gameBoardPreview');
  board.hidden = gameName !== 'Tic Tac Toe';
  $('gameScreenMessage').textContent = gameName === 'Tic Tac Toe'
    ? 'Layout papan Tic Tac Toe dibuat responsif untuk sentuhan jari. Sinkronisasi giliran dan logika multiplayer akan diaktifkan pada tahap pengembangan game.'
    : `Tampilan ${gameName} akan dibuat mengikuti ukuran layar perangkat. Logika dan sinkronisasi multiplayer game ini akan dikembangkan setelah fondasi room stabil.`;

  if (roomDialog.open) roomDialog.close();
  if (!gameDialog.open) gameDialog.showModal();
}

function returnToRoom() {
  if (gameDialog.open) gameDialog.close();
  if (activeCode && !roomDialog.open) {
    roomForm.hidden = true;
    roomLobby.hidden = false;
    roomTitle.textContent = 'You are in your room.';
    roomLead.textContent = 'Bagikan kode ini kepada pasanganmu untuk mulai bermain bersama.';
    roomDialog.showModal();
  }
}

// Page interactions
$('year').textContent = new Date().getFullYear();
$('menuToggle').addEventListener('click', () => {
  const nav = $('mainNav');
  const isOpen = nav.classList.toggle('open');
  $('menuToggle').setAttribute('aria-expanded', String(isOpen));
});
$('mainNav').querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  $('mainNav').classList.remove('open');
  $('menuToggle').setAttribute('aria-expanded', 'false');
}));
document.querySelectorAll('[data-open-room]').forEach((button) => {
  button.addEventListener('click', () => openRoom(button.dataset.openRoom));
});
roomForm.addEventListener('submit', handleRoomSubmit);
$('closeRoom').addEventListener('click', () => roomDialog.close());
$('leaveRoom').addEventListener('click', handleLeaveRoom);
roomCodeInput.addEventListener('input', () => {
  roomCodeInput.value = roomCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
});
copyCode.addEventListener('click', async () => {
  if (!activeCode) return;
  try {
    await navigator.clipboard.writeText(activeCode);
    notify('Kode room berhasil disalin. ♡');
  } catch {
    notify(`Kode room: ${activeCode}`);
  }
});
document.querySelectorAll('[data-game]').forEach((button) => {
  button.addEventListener('click', () => openGamePreview(button.dataset.game));
});
$('closeGame').addEventListener('click', returnToRoom);
$('backToRoom').addEventListener('click', returnToRoom);
gameDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  returnToRoom();
});
window.addEventListener('pagehide', () => {
  // Firebase onDisconnect handles presence when the browser closes or loses connection.
  // Do not delete the room here; the other player's session may still be active.
  if (stopPresenceWatch) stopPresenceWatch();
});
