let students = [];
const SESSION_KEY = 'unpam_session_v8';

// --- INIT UTAMA ---
window.onload = () => {
    initTheme();
    populateJurusanOptions();
    setInterval(updateClock, 1000);
    updateClock(); 

    try {
        const landing = document.getElementById('landing-page');
        if (landing && getComputedStyle(landing).display !== 'none') {
            const tl = gsap.timeline({ 
                onComplete: () => { enterApp(); }
            });
            tl.to(".intro-el", { opacity: 1, y: 0, duration: 1.2, stagger: 0.2, ease: "power4.out" })
              .to(".intro-el", { opacity: 0, scale: 0.95, duration: 0.8, delay: 1.5, ease: "power2.in" });
        } else {
            enterApp();
        }
    } catch (err) {
        enterApp();
    }
};

// --- LOGIKA HALAMAN ---
function enterApp() {
    const landing = document.getElementById('landing-page');
    if(landing) landing.style.display = 'none';
    const user = localStorage.getItem(SESSION_KEY);
    if (user) {
        showDashboard(user, false); 
    } else {
        document.getElementById('dashboard-page').classList.add('hidden');
        document.getElementById('auth-page').classList.remove('hidden');
        gsap.fromTo("#auth-page", {opacity:0}, {opacity:1, duration: 0.5});
    }
}

window.switchAuth = function(panel) {
    document.querySelectorAll('.auth-panel').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(`${panel}-panel`);
    if(target) {
        target.classList.remove('hidden');
        gsap.fromTo(target, {opacity: 0, x: 20}, {opacity: 1, x: 0, duration: 0.4});
    }
};

function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;
    if(user && pass) {
        localStorage.setItem(SESSION_KEY, user);
        document.getElementById('auth-page').classList.add('hidden');
        showDashboard(user, true); 
    } else {
        showToast('Isi username dan password!', 'error');
    }
}

function handleRegister(e) {
    e.preventDefault();
    const user = document.getElementById('reg-user').value;
    const pass = document.getElementById('reg-pass').value;
    const code = document.getElementById('reg-code').value;
    if(user && pass && code) {
        showToast('Akun berhasil dibuat! Silakan Login.', 'success');
        localStorage.setItem('recovery_' + user, code);
        setTimeout(() => switchAuth('login'), 1500);
    } else {
        showToast('Semua field wajib diisi!', 'error');
    }
}

function handleReset(e) {
    e.preventDefault();
    const user = document.getElementById('reset-user').value;
    const code = document.getElementById('reset-code').value;
    const savedCode = localStorage.getItem('recovery_' + user);
    if(savedCode && savedCode === code) {
        showToast('Password berhasil direset!', 'success');
        setTimeout(() => switchAuth('login'), 1500);
    } else {
        showToast('Kode pemulihan salah atau user tidak ada!', 'error');
    }
}

function handleLogout() {
    if(!confirm('Yakin ingin logout?')) return;
    localStorage.removeItem(SESSION_KEY);
    location.reload(); 
}

function showDashboard(username, showWelcomeAnim = false) {
    const dashboard = document.getElementById('dashboard-page');
    dashboard.classList.remove('hidden'); 
    document.getElementById('nav-user').innerText = username;
    fetchStudents(); 
    if (showWelcomeAnim) {
        const overlay = document.getElementById('welcome-overlay');
        const nameEl = document.getElementById('welcome-username');
        if(overlay && nameEl) {
            nameEl.innerText = username;
            overlay.classList.remove('hidden'); 
            overlay.style.opacity = '1';
            const tl = gsap.timeline({ onComplete: () => { overlay.classList.add('hidden'); } });
            tl.to(".welcome-el", { opacity: 1, y: 0, duration: 0.8, stagger: 0.2, ease: "back.out(1.7)" })
              .to(".welcome-el", { opacity: 0, y: -20, duration: 0.5, delay: 1.5 })
              .to(overlay, { opacity: 0, duration: 0.5 });
        }
    }
}

// --- DATA FETCHING ---
async function fetchStudents(params = "") {
    try {
        const res = await fetch(`/api/students?${params}`);
        students = await res.json();
        renderTable();
        updateStats();
    } catch (error) { console.error(error); }
}

async function handleAddStudent(e) {
    e.preventDefault();
    const payload = {
        nama: document.getElementById('in-nama').value,
        nim: document.getElementById('in-nim').value,
        jurusan: document.getElementById('in-jurusan').value,
        ipk: document.getElementById('in-ipk').value
    };
    try {
        const res = await fetch('/api/students', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (res.ok) {
            showToast('Data Berhasil Disimpan!', 'success');
            e.target.reset();
            fetchStudents();
        } else { showToast(result.error || 'Gagal', 'error'); }
    } catch (err) { showToast('Error Server', 'error'); }
}

async function handleDelete(nim) {
    if(!confirm('Hapus data ini?')) return;
    await fetch(`/api/students/${nim}`, { method: 'DELETE' });
    showToast('Data Dihapus', 'success');
    fetchStudents();
}

function openEditModal(nim) {
    const mhs = students.find(s => s.nim === nim);
    if (!mhs) return;
    document.getElementById('edit-old-nim').value = mhs.nim;
    document.getElementById('edit-nama').value = mhs.nama;
    document.getElementById('edit-nim').value = mhs.nim;
    document.getElementById('edit-ipk').value = mhs.ipk;
    document.getElementById('edit-jurusan').value = mhs.jurusan;
    document.getElementById('editModal').showModal();
}

async function handleEditSubmit(e) {
    e.preventDefault();
    const nim = document.getElementById('edit-old-nim').value;
    const payload = {
        nama: document.getElementById('edit-nama').value,
        ipk: document.getElementById('edit-ipk').value,
        jurusan: document.getElementById('edit-jurusan').value
    };
    try {
        const res = await fetch(`/api/students/${nim}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            showToast('Perubahan berhasil disimpan!', 'success');
            document.getElementById('editModal').close();
            fetchStudents();
        } else {
            showToast('Gagal update data', 'error');
        }
    } catch(err) {
        showToast('Error koneksi', 'error');
    }
}

// --- FUNGSI RENDER TABEL (SUDAH DIPERBAIKI) ---
function renderTable() {
    const tbody = document.getElementById('table-body');
    const emptyState = document.getElementById('empty-state');
    tbody.innerHTML = '';
    
    if (students.length === 0) {
        emptyState.classList.remove('hidden'); emptyState.classList.add('flex');
    } else {
        emptyState.classList.add('hidden'); emptyState.classList.remove('flex');
        students.forEach((s, i) => {
            const row = document.createElement('tr');
            
            // LOGIC WARNA BADGE IPK
            let badgeClass = '';
            let ipkVal = parseFloat(s.ipk);
            if (ipkVal >= 3.5) { 
                badgeClass = 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-300 dark:border-green-800'; 
            } else if (ipkVal >= 3.0) { 
                badgeClass = 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-300 dark:border-yellow-800'; 
            } else { 
                badgeClass = 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900 dark:text-red-300 dark:border-red-800'; 
            }
            
            // TIMESTAMP
            let timestampHtml = s.timestamp ? 
                `<div class="text-[10px] opacity-60 mt-1 font-mono text-slate-500 dark:text-slate-400">
                    <i class="fa-regular fa-clock mr-1"></i>${s.timestamp}
                </div>` : '';

            // CLASS UNTUK STYLE BARIS
            row.className = "bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700 transition duration-200 cursor-default shadow-sm";
            
            // --- FIX 1: SANITASI DATA ---
            // Mengubah karakter < menjadi &lt; agar tidak dianggap tag HTML
            const safeNama = s.nama ? s.nama.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";
            const safeJurusan = s.jurusan ? s.jurusan.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";

            row.innerHTML = `
                <td class="p-4 pl-6 font-bold text-sm text-slate-700 dark:text-slate-200">
                    ${safeNama}
                    ${timestampHtml}
                </td>
                <td class="p-4 font-mono font-bold text-unpamBlue dark:text-blue-400 text-sm">
                    ${s.nim}
                </td>
                <td class="p-4 text-xs font-medium text-slate-600 dark:text-slate-400 hidden sm:table-cell">
                    ${safeJurusan}
                </td>
                <td class="p-4">
                    <span class="px-3 py-1 rounded-full text-xs font-bold border ${badgeClass}">
                        ${s.ipk}
                    </span>
                </td>
                <td class="p-4 text-center">
                    <div class="flex items-center justify-center gap-2">
                        <button onclick="openEditModal('${s.nim}')" class="text-blue-500 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900 p-2 rounded-lg transition" title="Edit Data"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button onclick="handleDelete('${s.nim}')" class="text-red-500 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900 p-2 rounded-lg transition" title="Hapus Data"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
            
            // --- FIX 2: ANIMASI LEBIH STABIL ---
            // Gunakan fromTo + clearProps agar element pasti muncul setelah animasi
            gsap.fromTo(row, 
                { opacity: 0, y: 10 },
                { opacity: 1, y: 0, delay: i * 0.05, duration: 0.3, clearProps: "all" }
            );
        });
    }
    document.getElementById('page-info').innerText = `Total Data: ${students.length}`;
    document.getElementById('stat-total').innerText = students.length;
    updateStats();
}

function updateStats() {
    if(students.length === 0) { document.getElementById('stat-avg').innerText = "0.00"; return; }
    const totalIpk = students.reduce((sum, s) => sum + parseFloat(s.ipk), 0);
    const avg = (totalIpk / students.length).toFixed(2);
    document.getElementById('stat-avg').innerText = avg;
}
function handleSearch() {
    const q = document.getElementById('search-query').value;
    fetchStudents(`q=${q}`);
}
function animateAndRunSort(algo, btn) {
    const key = document.getElementById('sort-key').value;
    const order = document.getElementById('sort-order').value;
    const start = performance.now();
    
    // TAMBAHKAN parameter &algo=${algo} DI SINI:
    fetchStudents(`key=${key}&order=${order}&algo=${algo}`).then(() => {
        const time = (performance.now() - start).toFixed(2);
        document.getElementById('stat-time').innerText = time + ' ms';
        showToast(`Sorted by ${key} using ${algo}`, 'success'); // Ubah pesan toast
    });
}
function resetData() {
    document.getElementById('search-query').value = '';
    fetchStudents();
    showToast('Tabel di-reset', 'success');
}
function updateClock() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = now.toLocaleDateString('id-ID', options);
    const timeStr = now.toLocaleTimeString('id-ID');
    const clockEl = document.getElementById('realtime-clock');
    if(clockEl) clockEl.innerHTML = `${dateStr} <span class="mx-2">|</span> <span class="font-black text-unpamBlue dark:text-unpamYellow">${timeStr}</span>`;
}
function populateJurusanOptions() {
    const dataProdi = {
        "D3 & D4 (Vokasi)": [ "Administrasi Perkantoran (D3)", "Akuntansi Perpajakan (D4)" ],
        "S1 (Sarjana)": [
            "Teknik Informatika (S1)", "Sistem Informasi (S1)", "Manajemen (S1)", "Akuntansi (S1)",
            "Ilmu Komunikasi (S1)", "Ilmu Hukum (S1)", "Pendidikan Bahasa Inggris (S1)",
            "Pendidikan Matematika (S1)", "Pendidikan Pancasila dan Kewarganegaraan (S1)",
            "Pendidikan Ekonomi (S1)", "Sastra Inggris (S1)", "Sastra Indonesia (S1)",
            "Pendidikan Agama Islam (S1)", "Ekonomi Syariah (S1)", "Teknik Mesin (S1)",
            "Teknik Elektro (S1)", "Teknik Industri (S1)", "Teknik Sipil (S1)",
            "Matematika (S1)", "Biologi (S1)", "Kimia (S1)", "Administrasi Negara (S1)", "Ilmu Pemerintahan (S1)"
        ],
        "S2 (Pascasarjana)": [ "Ilmu Hukum (S2)", "Manajemen (S2)", "Teknik Informatika (S2)", "Akuntansi (S2)", "Manajemen Pendidikan (S2)" ]
    };
    const selects = ['in-jurusan', 'edit-jurusan'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.innerHTML = '<option value="">-- Pilih Program Studi --</option>'; 
            for (const [kategori, listJurusan] of Object.entries(dataProdi)) {
                const group = document.createElement('optgroup');
                group.label = kategori;
                group.className = "font-bold text-slate-900 dark:text-white bg-gray-100 dark:bg-slate-700";
                listJurusan.forEach(j => {
                    const opt = document.createElement('option');
                    opt.value = j; opt.innerText = j;
                    opt.className = "text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800";
                    group.appendChild(opt);
                });
                el.appendChild(group);
            }
        }
    });
}
function formatIPK(el) { 
    let val = el.value.replace(/[^0-9]/g, '');
    if (val.length > 1) val = val.slice(0, 1) + '.' + val.slice(1);
    if (val.length > 4) val = val.slice(0, 4);
    if (parseFloat(val) > 4.00) val = "4.00";
    el.value = val;
}
function formatNIM(el) { el.value = el.value.replace(/[^0-9]/g, '').slice(0, 15); }
function showToast(msg, type) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const color = type === 'success' ? 'border-green-500 text-green-700 bg-green-50' : 'border-red-500 text-red-700 bg-red-50';
    toast.className = `p-4 rounded-xl shadow-lg border-l-4 ${color} flex items-center gap-3 transform translate-x-full transition-all duration-300 bg-white dark:bg-slate-800 dark:text-white`;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-triangle-exclamation'}"></i> <span class="font-bold text-sm">${msg}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove('translate-x-full'));
    setTimeout(() => { toast.classList.add('translate-x-full', 'opacity-0'); setTimeout(() => toast.remove(), 300); }, 3000);
}
function togglePass(id, btn) {
    const input = document.getElementById(id);
    const icon = btn.querySelector('i');
    if (input.type === "password") { input.type = "text"; icon.classList.replace('fa-eye', 'fa-eye-slash'); }
    else { input.type = "password"; icon.classList.replace('fa-eye-slash', 'fa-eye'); }
}
function toggleTheme() { document.documentElement.classList.toggle('dark'); }
function initTheme() { if(window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.classList.add('dark'); }