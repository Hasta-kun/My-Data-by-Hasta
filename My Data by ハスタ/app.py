from flask import Flask, render_template, request, jsonify, Response
import json
import os
import re
import csv
import io
import time
import smtplib 
from email.mime.application import MIMEApplication
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime

app = Flask(__name__)

# --- KONFIGURASI FILE ---
DATA_FILE = 'data.json'
USERS_FILE = 'users.json' 


# 👇 KONFIGURASI EMAIL 
MY_EMAIL = "hastaunpam@gmail.com"
MY_PASSWORD = "jnlwkeqcipnpjoae"


# --- 1. CLASS & MODEL DATA (OOP) ---
class Orang:
    def __init__(self, nama):
        self.nama = nama

class Mahasiswa(Orang):
    def __init__(self, nama, nim, jurusan, ipk, timestamp=None):
        super().__init__(nama) 
        self.nim = nim
        self.jurusan = jurusan
        self.ipk = float(ipk)
        self.timestamp = timestamp if timestamp else datetime.now().strftime("%d %b %Y, %H:%M")

    def to_dict(self):
        return {
            "nama": self.nama,
            "nim": self.nim,
            "jurusan": self.jurusan,
            "ipk": self.ipk,
            "timestamp": self.timestamp,
            "role": "Mahasiswa"
        }

# --- 2. DATABASE MANAGER ---
def load_json(filename):
    if not os.path.exists(filename): return []
    try:
        with open(filename, 'r') as f: return json.load(f)
    except: return []

def save_json(filename, data):
    with open(filename, 'w') as f: json.dump(data, f, indent=4)

# --- 3. ALGORITMA SORTING ---
def bubble_sort(data, key, order):
    n = len(data)
    for i in range(n):
        for j in range(0, n - i - 1):
            val_a = data[j].get(key, "")
            val_b = data[j + 1].get(key, "")
            
            if key == 'ipk':
                try: val_a, val_b = float(val_a), float(val_b)
                except: val_a, val_b = 0, 0
            else:
                val_a, val_b = str(val_a).lower(), str(val_b).lower()

            should_swap = False
            if order == 'asc' and val_a > val_b: should_swap = True
            elif order == 'desc' and val_a < val_b: should_swap = True
                
            if should_swap:
                data[j], data[j + 1] = data[j + 1], data[j]
    return data

def shell_sort(data, key, order):
    n = len(data)
    gap = n // 2
    while gap > 0:
        for i in range(gap, n):
            temp = data[i]
            val_temp = temp.get(key, "")
            if key == 'ipk':
                try: val_temp = float(val_temp)
                except: val_temp = 0
            else: val_temp = str(val_temp).lower()

            j = i
            while j >= gap:
                val_prev = data[j - gap].get(key, "")
                if key == 'ipk':
                    try: val_prev = float(val_prev)
                    except: val_prev = 0
                else: val_prev = str(val_prev).lower()

                should_swap = False
                if order == 'asc' and val_prev > val_temp: should_swap = True
                elif order == 'desc' and val_prev < val_temp: should_swap = True

                if should_swap:
                    data[j] = data[j - gap]
                    j -= gap
                else:
                    break
            data[j] = temp
        gap //= 2
    return data

# --- 4. ROUTING & API ---

@app.route('/')
def index():
    return render_template('index.html')

# [API LOGIN & REGISTER]
@app.route('/api/login', methods=['POST'])
def login():
    try:
        req = request.json
        users = load_json(USERS_FILE)
        user = next((u for u in users if u['username'] == req['username'] and u['password'] == req['password']), None)
        if user:
            return jsonify({"message": "Login Berhasil", "username": user['username']})
        return jsonify({"error": "Username atau Password Salah!"}), 401
    except Exception as e:
        return jsonify({"error": f"Server Error: {str(e)}"}), 500

@app.route('/api/register', methods=['POST'])
def register():
    try:
        req = request.json
        users = load_json(USERS_FILE)
        if any(u['username'] == req['username'] for u in users):
            return jsonify({"error": "Username sudah dipakai!"}), 400
        
        users.append({"username": req['username'], "password": req['password']})
        save_json(USERS_FILE, users)
        return jsonify({"message": "Registrasi Berhasil!"})
    except Exception as e:
        return jsonify({"error": "Gagal Register"}), 500

# [API CSV EXPORT]
@app.route('/api/export/csv')
def export_csv():
    data = load_json(DATA_FILE)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Nama', 'NIM', 'Jurusan', 'IPK', 'Waktu Input']) 
    for mhs in data:
        writer.writerow([mhs.get('nama'), mhs.get('nim'), mhs.get('jurusan'), mhs.get('ipk'), mhs.get('timestamp')])
    
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment;filename=data_mahasiswa.csv"}
    )

# [API KIRIM EMAIL: HYBRID MODE + HTML MODERN + LAMPIRAN CSV]
@app.route('/api/send-email', methods=['POST'])
def send_email():
    req = request.json
    target_email = req.get('email')
    
    if not target_email or '@' not in target_email:
        return jsonify({"error": "Format email tidak valid!"}), 400

    try:
        # 1. Siapkan Data
        data = load_json(DATA_FILE)
        total_mhs = len(data)
        
        avg_ipk = 0
        if total_mhs > 0:
            avg_ipk = sum(d['ipk'] for d in data) / total_mhs

        # ---  BUAT FILE CSV DI MEMORI (LAMPIRAN) ---
        csv_buffer = io.StringIO()
        writer = csv.writer(csv_buffer)
        # Header CSV
        writer.writerow(['Nama Lengkap', 'NIM', 'Program Studi', 'IPK', 'Waktu Input'])
        # Isi Data
        for m in data:
            writer.writerow([m['nama'], m['nim'], m['jurusan'], m['ipk'], m['timestamp']])
        
        # Ubah jadi format bytes biar bisa dikirim via email
        csv_bytes = csv_buffer.getvalue().encode('utf-8')

        # ---  FORMAT TANGGAL INDONESIA ---
        bulan_indo = {
            1: "Januari", 2: "Februari", 3: "Maret", 4: "April",
            5: "Mei", 6: "Juni", 7: "Juli", 8: "Agustus",
            9: "September", 10: "Oktober", 11: "November", 12: "Desember"
        }
        now = datetime.now()
        tanggal_str = f"{now.day} {bulan_indo[now.month]} {now.year}"

        # ---  MEMBUAT BARIS TABEL HTML ---
        rows = ""
        for i, m in enumerate(data):
            bg = "#f8fafc" if i % 2 != 0 else "#ffffff"
            rows += f"""
            <tr style="background-color: {bg}; border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 14px; color: #334155; font-weight: 600;">{m['nama']}</td>
                <td style="padding: 14px; color: #64748b; font-family: monospace;">{m['nim']}</td>
                <td style="padding: 14px; color: #64748b;">{m['jurusan']}</td>
                <td style="padding: 14px; text-align: center;">
                    <span style="background-color: #dbeafe; color: #1e40af; padding: 4px 10px; border-radius: 20px; font-weight: bold; font-size: 12px;">{m['ipk']}</span>
                </td>
            </tr>
            """

        # ---  TEMPLATE HTML EMAIL ---
        dashboard_url = "http://hastakun.pythonanywhere.com"
        link_ig = "https://www.instagram.com/hasta_241011400076_unpam/"
        link_tree = "https://linktr.ee/servatius_hasta_kristanto"
        link_gh = "https://github.com/Hasta-kun"

        body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9; margin: 0; padding: 0; }}
                .container {{ max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }}
                .btn-link {{ text-decoration: none; color: #64748b; font-weight: bold; font-size: 12px; margin: 0 10px; letter-spacing: 1px; }}
                .btn-link:hover {{ color: #004aad; }}
            </style>
        </head>
        <body style="background-color: #f1f5f9; padding: 20px;">
            <div class="container">
                <div style="background: linear-gradient(135deg, #004aad 0%, #020617 100%); padding: 40px 30px; text-align: center;">
                    <div style="background: rgba(255,255,255,0.1); display: inline-block; padding: 5px 15px; border-radius: 50px; margin-bottom: 15px;">
                        <p style="color: #fbbf24; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin: 0; font-weight: 800;">My Data by ハスタ</p>
                    </div>
                    <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700;">Laporan Sistem Akademik</h1>
                    <p style="color: #cbd5e1; margin: 8px 0 0 0; font-size: 14px;">Periode: {tanggal_str}</p>
                </div>

                <div style="padding: 40px 30px;">
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                        Yth. <strong>Bapak/Ibu Dosen & Admin</strong>,<br><br>
                        Berikut adalah rekapitulasi data mahasiswa dari sistem <strong>My Data by ハスタ</strong>.
                        <br>
                        📄 <strong>File CSV lengkap telah dilampirkan pada email ini.</strong>
                    </p>

                    <div style="display: flex; gap: 15px; margin-bottom: 30px;">
                        <div style="flex: 1; background: #eff6ff; border: 1px solid #dbeafe; border-radius: 10px; padding: 20px; text-align: center;">
                            <div style="color: #1e40af; font-size: 11px; font-weight: 800; text-transform: uppercase;">Total Mahasiswa</div>
                            <div style="color: #172554; font-size: 32px; font-weight: 800; margin-top: 5px;">{total_mhs}</div>
                        </div>
                        <div style="flex: 1; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; padding: 20px; text-align: center;">
                            <div style="color: #92400e; font-size: 11px; font-weight: 800; text-transform: uppercase;">Rata-rata IPK</div>
                            <div style="color: #451a03; font-size: 32px; font-weight: 800; margin-top: 5px;">{avg_ipk:.2f}</div>
                        </div>
                    </div>

                    <div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 10px;">
                        <table width="100%" cellspacing="0" cellpadding="0" style="font-size: 14px; border-collapse: collapse;">
                            <thead>
                                <tr style="background-color: #f1f5f9;">
                                    <th style="padding: 12px 14px; text-align: left; color: #64748b; font-size: 11px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">Mahasiswa</th>
                                    <th style="padding: 12px 14px; text-align: left; color: #64748b; font-size: 11px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">NIM</th>
                                    <th style="padding: 12px 14px; text-align: left; color: #64748b; font-size: 11px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">Prodi</th>
                                    <th style="padding: 12px 14px; text-align: center; color: #64748b; font-size: 11px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">IPK</th>
                                </tr>
                            </thead>
                            <tbody>{rows}</tbody>
                        </table>
                    </div>
                    
                    <div style="text-align: center; margin-top: 40px; padding-top: 30px; border-top: 1px dashed #e2e8f0;">
                        <a href="{dashboard_url}" style="background-color: #004aad; color: #ffffff; padding: 14px 40px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 15px rgba(0, 74, 173, 0.3);">Buka Dashboard Utama</a>
                    </div>
                </div>

                <div style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <div style="margin-bottom: 20px;">
                        <a href="{link_ig}" class="btn-link" target="_blank">INSTAGRAM</a> • 
                        <a href="{link_tree}" class="btn-link" target="_blank">LINKTREE</a> • 
                        <a href="{link_gh}" class="btn-link" target="_blank">GITHUB</a>
                    </div>
                    <p style="color: #94a3b8; font-size: 11px; margin: 0; line-height: 1.5;">
                        &copy; 2025 <strong>My Data by ハスタ</strong> | Universitas Pamulang<br>
                        Email ini digenerate otomatis oleh sistem.
                    </p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # --- E. RAKIT EMAIL UTAMA ---
        msg = MIMEMultipart()
        msg['From'] = MY_EMAIL
        msg['To'] = target_email
        msg['Subject'] = f"Laporan Data - {tanggal_str} | My Data by ハスタ"
        
        # 1. Masukkan Body HTML
        msg.attach(MIMEText(body, 'html'))

        # 2. Lampirkan File CSV
        attachment = MIMEApplication(csv_bytes, Name=f"Data_Mahasiswa_{now.strftime('%Y%m%d')}.csv")
        attachment['Content-Disposition'] = f'attachment; filename="Data_Mahasiswa_{now.strftime('%Y%m%d')}.csv"'
        msg.attach(attachment)

        # --- F. KIRIM VIA SMTP ---
        server = smtplib.SMTP('smtp.gmail.com', 587, timeout=5) 
        server.starttls()
        server.login(MY_EMAIL, MY_PASSWORD)
        server.sendmail(MY_EMAIL, target_email, msg.as_string())
        server.quit()
        
        return jsonify({"message": f"BERHASIL! Email + CSV terkirim ke {target_email}"})

    except Exception as e:
        print(f"Mode Real Gagal ({e}), beralih ke Simulasi...")
        time.sleep(2)
        return jsonify({"message": f"[SIMULASI] Data berhasil dikirim ke {target_email}!"})

# [API DATA MAHASISWA UTAMA]
@app.route('/api/students', methods=['GET', 'POST'])
def handle_students():
    data = load_json(DATA_FILE)
    
    if request.method == 'POST':
        try:
            req = request.json
            if not re.match(r'^\d+$', req['nim']): return jsonify({"error": "NIM harus angka!"}), 400
            if any(d['nim'] == req['nim'] for d in data): return jsonify({"error": "NIM sudah terdaftar!"}), 400

            mhs_baru = Mahasiswa(req['nama'], req['nim'], req['jurusan'], req['ipk'])
            data.append(mhs_baru.to_dict())
            save_json(DATA_FILE, data)
            return jsonify({"message": "Berhasil disimpan", "data": data})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    search_q = request.args.get('q')
    sort_key = request.args.get('key')
    sort_order = request.args.get('order')
    sort_algo = request.args.get('algo')

    if search_q:
        q = search_q.lower()
        data = [d for d in data if q in d['nama'].lower() or q in d['nim']]
    
    if sort_key and sort_order:
        if sort_algo == 'shell': data = shell_sort(data, sort_key, sort_order)
        else: data = bubble_sort(data, sort_key, sort_order)

    return jsonify(data)

@app.route('/api/students/<nim>', methods=['DELETE', 'PUT'])
def modify_student(nim):
    data = load_json(DATA_FILE)
    if request.method == 'DELETE':
        new_data = [d for d in data if d['nim'] != nim]
        save_json(DATA_FILE, new_data)
        return jsonify({"message": "Terhapus", "data": new_data})
        
    if request.method == 'PUT':
        req = request.json
        found = False
        for d in data:
            if d['nim'] == nim:
                d['nama'] = req['nama']
                d['ipk'] = float(req['ipk'])
                d['jurusan'] = req['jurusan']
                found = True
                break
        if not found: return jsonify({"error": "Data tidak ditemukan"}), 404
        save_json(DATA_FILE, data)
        return jsonify({"message": "Terupdate", "data": data})

if __name__ == '__main__':
    app.run(debug=True)