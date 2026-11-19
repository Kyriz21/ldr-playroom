// LDR Playroom — fondasi interaksi antarmuka.
// Multiplayer dan penyimpanan room belum dihubungkan pada tahap ini.

const roomDialog = document.getElementById('roomDialog');
const roomForm = document.getElementById('roomForm');
const roomCodeField = document.getElementById('roomCodeField');
const roomCodeInput = document.getElementById('roomCode');
const playerNameInput = document.getElementById('playerName');
const roomDialogTitle = document.getElementById('roomDialogTitle');
const dialogDescription = document.getElementById('dialogDescription');
const roomSubmit = document.getElementById('roomSubmit');
const toast = document.getElementById('toast');
const menuToggle = document.getElementById('menuToggle');
const mainNav = document.getElementById('mainNav');

let roomMode = 'create';
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 3600);
}

function openRoomDialog(mode) {
  roomMode = mode === 'join' ? 'join' : 'create';
  const isJoin = roomMode === 'join';

  roomDialogTitle.textContent = isJoin ? 'Join your person.' : "Let's get together.";
  dialogDescription.textContent = isJoin
    ? 'Masukkan nama dan kode room yang dibagikan pasanganmu.'
    : 'Buat ruang kecil untuk kalian berdua. Bagikan kodenya kepada pasangan.';
  roomCodeField.classList.toggle('is-visible', isJoin);
  roomCodeInput.required = isJoin;
  roomSubmit.innerHTML = isJoin ? 'Join room <span>♡</span>' : 'Create room <span>♡</span>';

  if (!roomDialog.open) roomDialog.showModal();
  window.setTimeout(() => playerNameInput.focus(), 50);
}

function closeRoomDialog() {
  if (roomDialog.open) roomDialog.close();
  roomForm.reset();
  roomCodeField.classList.remove('is-visible');
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

roomForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const playerName = playerNameInput.value.trim();
  const roomCode = roomCodeInput.value.trim().toUpperCase();

  if (!playerName) {
    playerNameInput.focus();
    return;
  }
  if (roomMode === 'join' && !roomCode) {
    roomCodeInput.focus();
    return;
  }

  closeRoomDialog();
  const message = roomMode === 'join'
    ? `Hai, ${playerName}! Form bergabung dengan kode ${roomCode} sudah siap. Koneksi real-time akan ditambahkan pada tahap berikutnya.`
    : `Hai, ${playerName}! Alur pembuatan room sudah disiapkan. Kode dan koneksi real-time akan aktif setelah Firebase dipasang.`;
  showToast(message);
});

document.querySelectorAll('[data-game-open]').forEach((button) => {
  button.addEventListener('click', () => {
    showToast(`${button.dataset.gameOpen} akan kita bangun setelah fondasi dan room real-time selesai.`);
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

document.getElementById('currentYear').textContent = new Date().getFullYear();
