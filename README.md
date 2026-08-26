<div align="center">

# POSEIDON: Sistem Intelligence dan Prioritisasi Patroli IUU Fishing WPPNRI 711

*Maritime Domain Awareness 4 Dimensi Berbasis Radar Satelit Sentinel-1, Dual-Pipeline PU Learning, dan Conformal Prediction*

[![Website Live Demo](https://img.shields.io/badge/Website-Live%20Demo-0070f3?style=for-the-badge&logo=firefox&logoColor=white)](https://poseidon-website.netlify.app)
[![Hugging Face](https://img.shields.io/badge/Hugging%20Face-Models%20%26%20Data-FFD21E?style=for-the-badge)](https://huggingface.co/JullMol/POSEIDON)
[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)

[Akses Live Web Dashboard](https://poseidon-website.netlify.app) | [Repositori Hugging Face](https://huggingface.co/JullMol/POSEIDON)

</div>

---

## Ringkasan Eksekutif

**POSEIDON** (*Platform Optimization for Surveillance and Enforcement Interception against Dark Vessel Operation Networks*) adalah platform intelijen maritim dan sistem pendukung keputusan taktis (*tactical decision support system*) yang dirancang untuk memprioritaskan penindakan armada kapal pelaku *Illegal, Unreported, and Unregulated (IUU) Fishing* di Wilayah Pengelolaan Perikanan Negara Republik Indonesia 711 (WPPNRI 711 — Laut Natuna Utara, Selat Karimata, dan Laut China Selatan).

Tantangan fundamental pengawasan laut di perairan luas adalah fenomena kapal gelap (*dark vessels*), yaitu kapal-kapal yang sengaja mematikan transponder *Automatic Identification System* (AIS) untuk menghindari deteksi otoritas patroli. 

Untuk menyelesaikan keterbatasan sumber daya armada patroli, POSEIDON mengintegrasikan tiga pilar teknologi:
1. **Penginderaan Jauh Multi-Sumber**: Citra radar *Synthetic Aperture Radar* (SAR) satelit Sentinel-1 yang mampu menembus awan dan beroperasi siang-malam, diintegrasikan dengan data *Global Fishing Watch* (GFW) dan *Google Earth Engine* (GEE).
2. **Dual-Pipeline PU Learning**: Formulasi *Positive-Unlabeled (PU) Learning* yang mengatasi ketiadaan label negatif pasti di laut lepas, didukung arsitektur **Pipeline GFW** (17 Fitur sebagai model utama) dan **Pipeline GEE** (13 Fitur sebagai strategi mitigasi operasional).
3. **Conformal Prediction Risk Bounds**: Kalibrasi ambang batas risiko matematis ($\hat{q}$) dengan jaminan statistik *out-of-time* (OOT) cakupan 90%–100%, meminimalisir alarm palsu pada kapal niaga legal (*Reliable Negative*).

---

## Ringkasan Data & Populasi Observasi

Berikut ringkasan statistik dataset observasi satelit dan penindakan di wilayah WPPNRI 711:

| Parameter Data | Nilai Aktual | Keterangan |
| :--- | :--- | :--- |
| **Rentang Waktu Observasi** | **2023–Sekarang (Live Ingestion)** | Terkoneksi basis data real-time (*Continuous Ingestion*) |
| **Total Deteksi Radar Satelit** | **184.248+** | Titik deteksi citra SAR Sentinel-1 (terus bertambah) |
| **Jumlah Siklus Perlintasan Satelit** | **699+ siklus** | Siklus pass pengamatan satelit Sentinel-1 |
| **Sampel Terlabel Positif ($P$)** | **44 kasus** | Kejadian penangkapan kapal ilegal terverifikasi |
| **Sampel Reliable Negative ($RN$)** | **27.540 kapal** | Kapal niaga legal terverifikasi AIS |
| **Sampel Unlabeled ($U$)** | **156.664 deteksi** | Populasi deteksi radar tak berlabel |
| **Total Deteksi Dinilai (Operasional)** | **84.513+ deteksi** | Evaluasi operasional out-of-time (OOT) & live feed |
| **Estimasi Class Prior ($\pi$)** | **0,001534** | $\approx 0,153\%$ estimasi proporsi kapal IUU di laut |

---

## Arsitektur Dual-Pipeline POSEIDON

Sistem POSEIDON mengimplementasikan dua jalur pemrosesan (*dual-pipeline architecture*) untuk memastikan keandalan analitik dan keberlanjutan operasional maritim:

```
┌────────────────────────────────────────────────────────────────────────┐
│             CITRA RADAR SATELIT SENTINEL-1 SAR (WPPNRI 711)            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
       ┌────────────────────────────┴────────────────────────────┐
       ▼                                                         ▼
┌──────────────────────────────┐          ┌──────────────────────────────┐
│        PIPELINE GFW          │          │        PIPELINE GEE          │
│    (Pipeline Utama · 17 Fitur)│          │ (Strategi Mitigasi · 13 Fitur)│
├──────────────────────────────┤          ├──────────────────────────────┤
│ Dim A: Fisik Radar (6)       │          │ Dim A: Fisik Radar (6)       │
│ Dim B: Spasial Regulasi (4)  │          │ Dim B: Spasial Regulasi (4)  │
│ Dim C: Fishing Score (1)     │          │ Dim C: Fishing Score GEE (1) │
│ Dim D: Spasio-Temporal (6)   │          │ Dim D: Spasio-Temporal (2)   │
├──────────────────────────────┤          ├──────────────────────────────┤
│ Model Terbaik: LightGBM      │          │ Model Terbaik: XGBoost       │
│ AUC-ROC: 0.9495              │          │ AUC-ROC: 0.9261              │
│ AUPRC: 0.005229              │          │ AUPRC: 0.004467              │
│ Alert Efficiency: 37.5% (3/8)│          │ Alert Efficiency: 25.0% (2/8)│
└──────────────┬───────────────┘          └──────────────┬───────────────┘
               │                                         │
               └────────────────────┬────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│           SISTEM PRIORITISASI PATROLI & DASHBOARD TAKTIS               │
│         Top-10 Kapal Prioritas per Siklus · Klasifikasi SIAGA 1-3      │
└────────────────────────────────────────────────────────────────────────┘
```

### 1. Pipeline GFW (Pipeline Utama)
* **Peran**: Pipeline analitik utama sistem POSEIDON dengan fidelitas fitur spasio-temporal dan AIS tertinggi (17 Fitur).
* **Model Terbaik**: `LightGBM (GFW)`
* **Evaluasi Performa**:
  * **AUC-ROC**: **0.9495**
  * **AUPRC**: **0.005229**
  * **Alert Efficiency**: **37.5%** (3/8 kasus target terverifikasi di Top-10 per siklus)
* **Fitur**:
  * **Dimensi A (Karakteristik Fisik Radar - 6 Fitur)**: `vv_intensity_db`, `vh_intensity_db`, `radar_intensity_diff`, `background_clutter`, `snr_db`, `length_m`.
  * **Dimensi B (Konteks Spasial & Regulasi - 4 Fitur)**: `dist_to_nearest_mpa_km`, `dist_to_eez_boundary_km`, `dist_to_nearest_port_km`, `dist_to_nearest_seizure_km`.
  * **Dimensi C (Fishing Score Oseanografi - 1 Fitur)**: `fishing_score`.
  * **Dimensi D (Perilaku AIS & Spasio-Temporal - 6 Fitur)**: `matching_score`, `ais_flag_country_encoded`, `area_dark_count_30d`, `area_dark_flag`, `historical_hotspot`, `quarter`.

### 2. Pipeline GEE (Strategi Mitigasi)
* **Peran**: Jalur pemrosesan data darurat (*failover & mitigation pipeline*) berbasis komputasi *cloud* Google Earth Engine (13 Fitur).
* **Fungsi Strategis**: Menjaga ketersediaan deteksi kapal dan inferensi risiko secara berkelanjutan ketika feed data eksternal GFW mengalami disrupsi atau kekosongan akibat masa transisi orbit satelit Sentinel-1.
* **Model Terbaik**: `XGBoost (GEE)`
* **Evaluasi Performa**:
  * **AUC-ROC**: **0.9261**
  * **AUPRC**: **0.004467**
  * **Alert Efficiency**: **25.0%** (2/8 kasus target terverifikasi di Top-10 per siklus)
* **Fitur**: Mempertahankan seluruh fitur Dimensi A (6) dan B (4), dengan `fishing_score_new` (Dimensi C) serta fitur temporal mandiri `historical_hotspot` dan `quarter` (Dimensi D).

---

## Evaluasi Komparatif Model

Hasil evaluasi performa model POSEIDON terhadap model pembanding (*baselines*) pada data uji *out-of-time* (OOT 2026):

| Model / Metodologi | AUC-ROC | AUPRC |
| :--- | :--- | :--- |
| **LightGBM (GFW) — Pipeline Utama** | **0.9495** | **0.005229** |
| **Hybrid Stacking (GFW)** | 0.9465 | 0.005115 |
| **XGBoost (GFW)** | 0.9424 | 0.005107 |
| **XGBoost (GEE) — Strategi Mitigasi** | **0.9261** | **0.004467** |
| **Hybrid Stacking (GEE)** | 0.9261 | 0.004208 |
| **LightGBM (GEE)** | 0.9233 | 0.003724 |
| GFW Fishing Score Only | 0.8926 | 0.001703 |
| Supervised LightGBM (Tanpa PU) | 0.8386 | 0.002833 |
| AIS+SAR Stacking Baseline | 0.8297 | 0.000946 |
| Naive AIS Detection | 0.7554 | 0.000811 |

### Perbandingan Alert Efficiency (Best Model: GFW vs GEE)
* **Pipeline Utama — LightGBM (GFW)**: **37.5% (3/8)** *(3 dari 8 kasus pelanggar OOT 2026 berhasil terjaring ke dalam Top-10 prioritas per siklus)*
* **Strategi Mitigasi — XGBoost (GEE)**: **25.0% (2/8)** *(2 dari 8 kasus pelanggar OOT 2026 berhasil terjaring ke dalam Top-10 prioritas per siklus)*

---

## Fitur Utama Web Platform

Antarmuka POSEIDON dirancang secara modular dan responsif dengan tema visual *Ocean-Dark Glassmorphism*:

1. **Modul Platform**:
   * Penjelasan arsitektur sistem POSEIDON, formulasi matematis nnPU Learning, matriks 4 Dimensi MDA, serta rincian 17 fitur radar.
2. **Modul Dashboard Peta Interaktif** *(Terproteksi)*:
   * Peta GIS interaktif Leaflet.js dengan integrasi *basemap* Citra Satelit ArcGIS dan CartoDB Voyager.
   * Visualisasi sebaran deteksi radar, klasifikasi jenis kapal (*vessel badge icons*), batas teritorial ZEE dan Kawasan Konservasi Perairan (MPA).
   * Navigasi linimasa siklus satelit (*time-series bar chart* & *sparkline*) dengan pemuatan data instan (*0ms latency*).
   * Animasi *pulsing dual-wave radar beacon* untuk menyorot koordinat dan profil spektrogram kapal terpilih.
3. **Modul Operasi Taktis** *(Terproteksi)*:
   * Tabel dan kartu Top-10 kapal dengan probabilitas risiko tertinggi per siklus perlintasan radar.
   * Klasifikasi tingkat siaga operasional: **SIAGA 1 (Prioritas Verifikasi)**, **SIAGA 2 (Pengawasan Terarah)**, dan **SIAGA 3 (Pemantauan Pasif)**.
   * Ekspor data taktis briefing patroli dalam format **GeoJSON** dan **CSV**.
4. **Modul Statistik & Validasi**:
   * Kurva presisi tinggi **ROC (AUC = 0.9495)** dan **Precision-Recall (AUPRC = 0.005229)** berbasis data aktual evaluasi model.
   * Perbandingan performa terhadap model-model pembanding (*baseline*).
   * Komparasi Alert Efficiency operasional antara Pipeline Utama dan Strategi Mitigasi.
   * Grafik tren musiman kapal tanpa AIS (2023–Sekarang).
   * Analisis ablasi arsitektur dan matriks kontribusi fitur (*feature importance gain*).

---

## Struktur Direktori Proyek

```
poseidon_web/
├── index.html                   # Struktur HTML5 aplikasi web utama
├── styles.css                   # Desain antarmuka, tema glassmorphism, dan responsivitas CSS
├── app.js                       # Logika frontend, manipulasi state, peta Leaflet, dan rendering grafik
├── server.py                    # Server development lokal (Python ThreadingHTTPServer & API Proxy)
├── netlify.toml                 # Konfigurasi deploy Netlify, build directory, dan API rewrites
├── README.md                    # Dokumentasi teknis resmi sistem POSEIDON
│
├── background/                  # Komponen animasi visual canvas latar belakang
│   ├── ocean.js                 # Animasi partikel arus laut dan ambient gelombang
│   ├── dashboard_bg.js          # Efek canvas dinamis pada view dashboard
│   ├── operasi_bg.js            # Efek visual radar sweep pada view operasi
│   └── statistik_bg.js          # Visualisasi grafik data statistik
│
├── netlify/
│   └── functions/               # Serverless Edge Functions (Node.js)
│       ├── supabase.js          # REST API Proxy ke Supabase Database
│       ├── login.js             # Autentikasi sesi operator (HMAC-SHA256)
│       ├── config.js            # Status kesiapan variabel lingkungan
│       └── data.js              # Endpoint pengambilan data JSON terproteksi
│
├── data/                        # Dataset evaluasi, metrik model, dan spasial WPPNRI 711
│   ├── meta.json                # Metadata fitur 4 dimensi dan ringkasan populasi data
│   ├── metrics.json             # Metrik evaluasi ROC, PR Curve, Conformal, dan perbandingan model
│   ├── seizures.json            # Rekam data penindakan patroli kapal ilegal (Label P)
│   ├── fishing_grid.json        # Grid spasial densitas zona tangkap potensial
│   ├── wpp711_geojson.json      # Batas poligon spasial resmi WPPNRI 711
│   └── detections/              # Arsip 381 berkas JSON deteksi radar satelit 2023–2024
│
└── database_config/             # Konfigurasi basis data cloud Supabase
    ├── schema.sql               # Skema DDL pembuatan tabel dan kebijakan keamanan PostgreSQL
    ├── update_supabase.py       # Skrip ETL sinkronisasi data deteksi ke basis data Supabase
    └── supabase_*.csv           # Berkas dump data migrasi tabel
```

---

## Panduan Menjalankan Aplikasi Secara Lokal

Sistem telah dilengkapi server lokal mandiri `server.py` yang mengintegrasikan *handler* berkas statis, *proxy* Supabase, dan otentikasi login:

```bash
# 1. Pastikan Python 3.10+ terpasang
python --version

# 2. Jalankan server lokal POSEIDON (Port default: 8000)
python server.py

# 3. Buka browser pada alamat:
# http://localhost:8000
```

---

<div align="center">

**POSEIDON: Maritime Domain Awareness & IUU Fishing Interception System**  
*Mendukung Penegakan Kedaulatan dan Keberlanjutan Maritim Indonesia.*

</div>
