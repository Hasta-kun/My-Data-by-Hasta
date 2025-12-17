let students = [];
const SESSION_KEY = 'unpam_session_real';

// --- 1. INIT UTAMA & ANIMASI ---
window.onload = () => {
    initTheme();
    populateJurusanOptions();
    setInterval(updateClock, 1000);
    updateClock(); 

    const landing = document.getElementById('landing-page');
    if (landing && getComputedStyle(landing).display !== 'none') {
        const tl = gsap.timeline({ 
            onComplete: () => { landing.style.display = 'none'; checkSession(); }
        });
        tl.to(".intro-el", { opacity: 1, y: 0, duration: 1.2, stagger: 0.2, ease: "power4.out" })
          .to(".intro-el", { opacity: 0, scale: 0.95, duration: 0.8, delay: 1.0, ease: "power2.in" });
    } else {
        checkSession();
    }
};

// --- 2. AUTHENTICATION ---
function checkSession() {
    const user = localStorage.getItem(SESSION_KEY);
    const authPage = document.getElementById('auth-page');
    if (user) {
        if(authPage) authPage.classList.add('hidden');
        showDashboard(user, false); 
    } else {
        if(authPage) {
            authPage.classList.remove('hidden');
            gsap.fromTo("#auth-page", {opacity:0}, {opacity:1, duration: 0.5});
        }
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

async function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;

    if(!user || !pass) { showToast('Isi username dan password!', 'error'); return; }

    try {
        const res = await fetch('/api/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        const result = await res.json();
        if (res.ok) {
            localStorage.setItem(SESSION_KEY, result.username);
            document.getElementById('auth-page').classList.add('hidden');
            showDashboard(result.username, true);
        } else { showToast(result.error, 'error'); }
    } catch (err) { showToast('Gagal terhubung ke server', 'error'); }
}

async function handleRegister(e) {
    e.preventDefault();
    const user = document.getElementById('reg-user').value;
    const pass = document.getElementById('reg-pass').value;
    const code = document.getElementById('reg-code').value; 

    if(!user || !pass || !code) { showToast('Isi semua data termasuk kode pemulihan!', 'error'); return; }

    try {
        const res = await fetch('/api/register', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        const result = await res.json();
        if (res.ok) {
            showToast('Akun berhasil dibuat! Silakan Login.', 'success');
            setTimeout(() => switchAuth('login'), 1500);
        } else { showToast(result.error, 'error'); }
    } catch (err) { showToast('Error Server', 'error'); }
}

function handleReset(e) {
    e.preventDefault();
    const user = document.getElementById('reset-user').value;
    const code = document.getElementById('reset-code').value;
    const newPass = document.getElementById('reset-new-pass').value;

    if(user && code && newPass) {
        showToast('Password berhasil direset (Simulasi)!', 'success');
        setTimeout(() => switchAuth('login'), 2000);
    } else {
        showToast('Mohon isi semua data reset!', 'error');
    }
}

function handleLogout() {
    if(!confirm('Yakin ingin logout?')) return;
    localStorage.removeItem(SESSION_KEY);
    location.reload(); 
}

// --- 3. DASHBOARD LOGIC ---
function showDashboard(username, showAnim) {
    const dashboard = document.getElementById('dashboard-page');
    dashboard.classList.remove('hidden'); 
    
    const navUser = document.getElementById('nav-user');
    if(navUser) navUser.innerText = username;
    
    fetchStudents(); 

    if (showAnim) {
        const overlay = document.getElementById('welcome-overlay');
        const nameEl = document.getElementById('welcome-username');
        if(overlay && nameEl) {
            nameEl.innerText = username;
            overlay.classList.remove('hidden'); overlay.style.opacity = '1';
            const tl = gsap.timeline({ onComplete: () => { overlay.classList.add('hidden'); } });
            tl.to(".welcome-el", { opacity: 1, y: 0, duration: 0.8, stagger: 0.2, ease: "back.out(1.7)" })
              .to(".welcome-el", { opacity: 0, y: -20, duration: 0.5, delay: 1.0 })
              .to(overlay, { opacity: 0, duration: 0.5 });
        }
    }
}

// --- 4. DATA FETCHING & CRUD ---
async function fetchStudents(params = "") {
    try {
        const res = await fetch(`/api/students?${params}`);
        students = await res.json();
        renderTable();
        updateStats();
    } catch (error) { console.error(error); }
}

async function handleImportCSV(input) {
    const file = input.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    showToast('Sedang mengimport...', 'info');
    try {
        const res = await fetch('/api/import/csv', { method: 'POST', body: formData });
        const result = await res.json();
        if (res.ok) { showToast(result.message, 'success'); fetchStudents(); }
        else { showToast(result.error, 'error'); }
    } catch (err) { showToast('Gagal upload', 'error'); }
    input.value = '';
}

async function handleSendEmail() {
    const email = document.getElementById('email-input').value;
    const btn = document.getElementById('btn-email');
    if (!email) { showToast('Masukkan email dulu!', 'error'); return; }
    
    const oriText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true;
    try {
        const res = await fetch('/api/send-email', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
        });
        const result = await res.json();
        if (res.ok) { showToast(result.message, 'success'); document.getElementById('email-input').value = ''; }
        else { showToast(result.error, 'error'); }
    } catch (err) { showToast('Gagal kirim email', 'error'); } 
    finally { btn.innerHTML = oriText; btn.disabled = false; }
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
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (res.ok) { showToast('Data Disimpan!', 'success'); e.target.reset(); fetchStudents(); } 
        else { showToast(result.error, 'error'); }
    } catch (err) { showToast('Error Server', 'error'); }
}

async function handleDelete(nim) {
    if(!confirm('Hapus data ini?')) return;
    await fetch(`/api/students/${nim}`, { method: 'DELETE' });
    showToast('Data Dihapus', 'success');
    fetchStudents();
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
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            showToast('Update Berhasil!', 'success');
            document.getElementById('editModal').close();
            fetchStudents();
        } else { showToast('Gagal update', 'error'); }
    } catch(err) { showToast('Error koneksi', 'error'); }
}

// --- UTILS ---
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

function renderTable() {
    const tbody = document.getElementById('table-body');
    const emptyState = document.getElementById('empty-state');
    tbody.innerHTML = '';
    
    if (students.length === 0) {
        if(emptyState) { emptyState.classList.remove('hidden'); emptyState.classList.add('flex'); }
    } else {
        if(emptyState) { emptyState.classList.add('hidden'); emptyState.classList.remove('flex'); }
        students.forEach((s, i) => {
            const row = document.createElement('tr');
            let badgeClass = parseFloat(s.ipk) >= 3.5 ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : (parseFloat(s.ipk) >= 3.0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300');
            const safeNama = s.nama ? s.nama.replace(/</g, "&lt;") : "";
            const safeJurusan = s.jurusan ? s.jurusan.replace(/</g, "&lt;") : "";
            const timestamp = s.timestamp ? s.timestamp : "";

            row.className = "bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition";
            row.innerHTML = `
                <td class="p-4 pl-6 font-bold text-slate-700 dark:text-slate-200">
                    ${safeNama}
                    <div class="text-[10px] opacity-60 font-normal mt-1">${timestamp}</div>
                </td>
                <td class="p-4 font-mono text-blue-600 dark:text-blue-400 font-bold">${s.nim}</td>
                <td class="p-4 text-slate-600 dark:text-slate-400 hidden sm:table-cell text-sm">${safeJurusan}</td>
                <td class="p-4"><span class="px-3 py-1 rounded-full text-xs font-bold ${badgeClass}">${s.ipk}</span></td>
                <td class="p-4 text-center">
                    <button onclick="openEditModal('${s.nim}')" class="text-blue-500 hover:bg-blue-100 p-2 rounded transition"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button onclick="handleDelete('${s.nim}')" class="text-red-500 hover:bg-red-100 p-2 rounded transition"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }
    updateStats();
}

function updateStats() {
    const el = document.getElementById('stat-total');
    if(el) el.innerText = students.length;

    const pageInfo = document.getElementById('page-info');
    if(pageInfo) pageInfo.innerText = `Total Data: ${students.length}`;

    const avgEl = document.getElementById('stat-avg');
    if(students.length === 0) { if(avgEl) avgEl.innerText = "0.00"; return; }
    const totalIpk = students.reduce((sum, s) => sum + parseFloat(s.ipk), 0);
    if(avgEl) avgEl.innerText = (totalIpk / students.length).toFixed(2);
}

function animateAndRunSort(algo) {
    const key = document.getElementById('sort-key').value;
    const order = document.getElementById('sort-order').value;
    const start = performance.now();
    fetchStudents(`key=${key}&order=${order}&algo=${algo}`).then(() => {
        const time = (performance.now() - start).toFixed(2);
        document.getElementById('stat-time').innerText = time + ' ms';
        showToast(`Sorted by ${key} (${algo})`, 'success');
    });
}

function handleSearch() { fetchStudents(`q=${document.getElementById('search-query').value}`); }
function resetData() { document.getElementById('search-query').value = ''; fetchStudents(); showToast('Tabel di-reset', 'info'); }

function showToast(msg, type) {
    const container = document.getElementById('toast-container');
    if(!container) return; 
    const toast = document.createElement('div');
    const color = type === 'success' ? 'border-green-500 text-green-700 bg-green-50' : (type === 'info' ? 'border-blue-500 text-blue-700 bg-blue-50' : 'border-red-500 text-red-700 bg-red-50');
    toast.className = `p-4 rounded-xl shadow-lg border-l-4 ${color} bg-white dark:bg-slate-800 dark:text-white mb-2 animate-bounce flex items-center gap-3`;
    toast.innerHTML = `<i class="fa-solid ${type==='success'?'fa-check':(type==='info'?'fa-info-circle':'fa-triangle-exclamation')}"></i> <span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function updateClock() {
    const el = document.getElementById('realtime-clock');
    if(el) el.innerText = new Date().toLocaleString('id-ID');
}
function toggleTheme() { document.documentElement.classList.toggle('dark'); }
function initTheme() { if(window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.classList.add('dark'); }
function togglePass(id, btn) {
    const input = document.getElementById(id);
    const icon = btn.querySelector('i');
    if (input.type === "password") {
        input.type = "text"; icon.classList.remove('fa-eye'); icon.classList.add('fa-eye-slash');
    } else {
        input.type = "password"; icon.classList.remove('fa-eye-slash'); icon.classList.add('fa-eye');
    }
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
                group.className = "font-bold text-slate-900 dark:text-white bg-gray-200 dark:bg-slate-700";
                
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

// --- FUNGSI FORMATTING BARU (SMART INPUT) ---
function formatIPK(el) { 
    let val = el.value.replace(/[^0-9.]/g, ''); 
    
    // SMART FEATURE: Jika user ketik > 4 tanpa titik, anggap user lupa titik
    // Contoh: User ketik "389" -> kita ubah jadi "3.89"
    if (val && parseFloat(val) > 4 && !val.includes('.')) {
        const autoDec = val.charAt(0) + "." + val.slice(1);
        if (parseFloat(autoDec) <= 4) {
            val = autoDec; // Ubah otomatis jadi desimal
        } else {
            val = "4"; // Kalau tetap gak masuk akal (misal 589), mentok 4
        }
    }
    // Jika user ketik desimal beneran tapi > 4 (misal 4.5), mentok 4
    else if (parseFloat(val) > 4) {
        val = "4";
    }

    el.value = val; 
}

function formatNIM(el) { el.value = el.value.replace(/[^0-9]/g, '').slice(0, 15); }