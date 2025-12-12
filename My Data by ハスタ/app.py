from flask import Flask, render_template, request, jsonify
import json
import os
import re
from datetime import datetime

app = Flask(__name__)
DATA_FILE = 'data.json'

# --- 1. KONSEP OOP (UPDATED: Inheritance & Polimorfisme) ---

# [Parent Class] Class Induk
class Orang:
    def __init__(self, nama):
        self.nama = nama
    
    # [Polimorfisme] Method yang akan di-override
    def get_role(self):
        return "Umum"

# [Child Class] Class Anak mewarisi Orang
class Mahasiswa(Orang):
    def __init__(self, nama, nim, jurusan, ipk, timestamp=None):
        # [Inheritance] Memanggil konstruktor class induk
        super().__init__(nama) 
        self.nim = nim
        self.jurusan = jurusan
        self.ipk = float(ipk)
        self.timestamp = timestamp if timestamp else datetime.now().strftime("%d %b %Y, %H:%M")

    # [Polimorfisme] Override method dari parent
    def get_role(self):
        return "Mahasiswa"

    def to_dict(self):
        return {
            "nama": self.nama,
            "nim": self.nim,
            "jurusan": self.jurusan,
            "ipk": self.ipk,
            "timestamp": self.timestamp,
            "role": self.get_role() # Menambahkan identitas role
        }

# --- 2. DATABASE MANAGER ---
class Database:
    @staticmethod
    def load_data():
        if not os.path.exists(DATA_FILE):
            return []
        try:
            with open(DATA_FILE, 'r') as f:
                return json.load(f)
        except:
            return []

    @staticmethod
    def save_data(data):
        with open(DATA_FILE, 'w') as f:
            json.dump(data, f, indent=4)

# --- 3. ALGORITMA SORTING & SEARCHING (UPDATED: Ada Shell Sort) ---

def bubble_sort(data, key, order):
    n = len(data)
    for i in range(n):
        for j in range(0, n - i - 1):
            val_a = data[j].get(key, "")
            val_b = data[j + 1].get(key, "")
            
            if key == 'ipk':
                val_a = float(val_a)
                val_b = float(val_b)
            else:
                val_a = str(val_a).lower()
                val_b = str(val_b).lower()

            should_swap = False
            if order == 'asc' and val_a > val_b: should_swap = True
            elif order == 'desc' and val_a < val_b: should_swap = True
                
            if should_swap:
                data[j], data[j + 1] = data[j + 1], data[j]
    return data

# [Algoritma Baru] Shell Sort Implementation
def shell_sort(data, key, order):
    n = len(data)
    gap = n // 2
    
    while gap > 0:
        for i in range(gap, n):
            temp = data[i]
            val_temp = temp.get(key, "")
            
            # Helper tipe data
            if key == 'ipk': val_temp = float(val_temp)
            else: val_temp = str(val_temp).lower()

            j = i
            while j >= gap:
                val_prev = data[j - gap].get(key, "")
                if key == 'ipk': val_prev = float(val_prev)
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

def linear_search(data, query):
    result = []
    query = query.lower()
    for item in data:
        if query in item['nama'].lower() or query in item['nim']:
            result.append(item)
    return result

# --- ROUTING ---

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/students', methods=['GET', 'POST'])
def handle_students():
    data = Database.load_data()
    
    if request.method == 'POST':
        try:
            req = request.json
            if not re.match(r'^\d+$', req['nim']):
                return jsonify({"error": "NIM harus angka!"}), 400
            for mhs in data:
                if mhs['nim'] == req['nim']:
                    return jsonify({"error": "NIM sudah terdaftar!"}), 400

            # Menggunakan Class Mahasiswa yang baru (dengan Inheritance)
            mhs_baru = Mahasiswa(req['nama'], req['nim'], req['jurusan'], req['ipk'])
            data.append(mhs_baru.to_dict())
            
            Database.save_data(data)
            return jsonify({"message": "Berhasil disimpan", "data": data})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    # [UPDATED] Handle Search & Sort (Bubble / Shell)
    search_q = request.args.get('q')
    sort_key = request.args.get('key')
    sort_order = request.args.get('order')
    sort_algo = request.args.get('algo') # Menerima parameter algo

    if search_q:
        data = linear_search(data, search_q)
    
    if sort_key and sort_order:
        # Memilih algoritma berdasarkan request
        if sort_algo == 'shell':
            data = shell_sort(data, sort_key, sort_order)
        else:
            data = bubble_sort(data, sort_key, sort_order)

    return jsonify(data)

@app.route('/api/students/<nim>', methods=['DELETE', 'PUT'])
def modify_student(nim):
    data = Database.load_data()
    
    if request.method == 'DELETE':
        new_data = [d for d in data if d['nim'] != nim]
        Database.save_data(new_data)
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
        
        if not found:
            return jsonify({"error": "Data tidak ditemukan"}), 404

        Database.save_data(data)
        return jsonify({"message": "Terupdate", "data": data})

if __name__ == '__main__':
    app.run(debug=True)