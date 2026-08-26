
'use strict';

const DATA = 'data';
const S = {
  meta: null,
  metrics: null,
  passes: [],
  top10: [],
  seizures: [],
  grid: null,
  passIdx: 0,
  detCache: new Map(),
  catsOff: new Set(),
  det: null,
  filters: { minLen: 0, minFish: 0, zone: 'all' },
  isPlaying: false,
  playTimer: null,
  isFirstMapLoad: true,
  markerMap: new Map(),
  topMarkerMap: new Map()
};

const CAT = {
  unmatched: { c: '#FF6B45', label: 'Tanpa AIS' },
  fishing: { c: '#FFB347', label: 'Kapal ikan' },
  cargo: { c: '#1477B8', label: 'Kargo' },
  bunker: { c: '#9B7EDE', label: 'Bunker' },
  carrier: { c: '#66D9E8', label: 'Carrier' },
  passenger: { c: '#4ADE80', label: 'Penumpang' },
  tanker: { c: '#F472B6', label: 'Tanker' },
  other: { c: '#8FA6B4', label: 'Lainnya' }
};

const CAT_ICONS = {
  unmatched: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 22h20L12 2z" fill="#FF6B45" stroke="#FFFFFF" stroke-width="1.2"/><circle cx="12" cy="14" r="2" fill="#FFFFFF"/></svg>`,
  fishing: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M2 16l3 3h14l3-3v-4H2v4z" fill="#FFB347" stroke="#FFFFFF" stroke-width="1.2"/><path d="M6 12V7l4-3 4 3v5" fill="#FFB347"/><circle cx="17" cy="7" r="2" fill="#FFB347"/></svg>`,
  cargo: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M2 17l2 3h16l2-3v-4H2v4z" fill="#1477B8" stroke="#FFFFFF" stroke-width="1.2"/><rect x="5" y="7" width="5" height="6" fill="#1477B8" stroke="#FFFFFF" stroke-width="1"/><rect x="11" y="7" width="5" height="6" fill="#1477B8" stroke="#FFFFFF" stroke-width="1"/></svg>`,
  bunker: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 17l2 3h14l2-3v-4H3v4z" fill="#9B7EDE" stroke="#FFFFFF" stroke-width="1.2"/><ellipse cx="12" cy="8" rx="5" ry="3" fill="#9B7EDE" stroke="#FFFFFF" stroke-width="1"/><line x1="7" y1="8" x2="7" y2="13" stroke="#FFFFFF" stroke-width="1.2"/><line x1="17" y1="8" x2="17" y2="13" stroke="#FFFFFF" stroke-width="1.2"/></svg>`,
  carrier: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M2 17l3 3h14l3-3v-5H2v5z" fill="#66D9E8" stroke="#FFFFFF" stroke-width="1.2"/><path d="M5 12V6l6-3 6 3v6" fill="#66D9E8" stroke="#FFFFFF" stroke-width="1"/></svg>`,
  passenger: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M2 18l3 3h14l3-3v-4H2v4z" fill="#4ADE80" stroke="#FFFFFF" stroke-width="1.2"/><path d="M4 14V9h16v5" fill="#4ADE80"/><path d="M7 9V5h10v4" fill="#4ADE80"/></svg>`,
  tanker: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M2 17l2 3h16l2-3v-4H2v4z" fill="#F472B6" stroke="#FFFFFF" stroke-width="1.2"/><circle cx="7" cy="9" r="3.5" fill="#F472B6" stroke="#FFFFFF" stroke-width="1"/><circle cx="15" cy="9" r="3.5" fill="#F472B6" stroke="#FFFFFF" stroke-width="1"/></svg>`,
  other: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 16l3 3h12l3-3v-4H3v4z" fill="#8FA6B4" stroke="#FFFFFF" stroke-width="1.2"/><polygon points="8 12 12 5 16 12" fill="#8FA6B4"/></svg>`
};

const catOf = k => CAT[k] || CAT.other;
const N = (v, d = 2) => (v === null || v === undefined || Number.isNaN(v)) ? '—' : Number(v).toFixed(d);
const NF = v => (v === null || v === undefined) ? '—' : Number(v).toLocaleString('id-ID');
const coord = (la, lo) => (la === null || la === undefined || lo === null || lo === undefined) ? '—' : `${Math.abs(la).toFixed(4)}°${la < 0 ? 'S' : 'N'}  ${Math.abs(lo).toFixed(4)}°${lo < 0 ? 'W' : 'E'}`;


function tierNum(t) {
  if (!t) return 3;
  if (t.includes('SIAGA 1') || t.includes('VERIFIKASI') || t.includes('Prioritas')) return 1;
  if (t.includes('SIAGA 2') || t.includes('TERARAH')) return 2;
  return 3;
}

function getTierChipClass(status) {
  if (!status) return 't-s3-pasif';
  if (status.includes('Prioritas')) return 't-prioritas';
  if (status.includes('SIAGA 1') || status.includes('VERIFIKASI')) return 't-s1';
  if (status.includes('SIAGA 2') || status.includes('TERARAH')) return 't-s2';
  if (status.includes('SIAGA 3 (Pasif)') || status.includes('Pasif')) return 't-s3-pasif';
  if (status.includes('SIAGA 3')) return 't-s3';
  return 't-s3-pasif';
}


const isSiagaPrioritas = t => {
  if (!t) return false;
  const s = String(t.status_siaga || t.tier || '');
  return s.includes('Prioritas');
};

const IDN_MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
function fmtDate(iso) {
  if (!iso) return '—';
  const clean = String(iso).slice(0, 10);
  const parts = clean.split('-');
  if (parts.length < 3) return iso;
  const [y, m, d] = parts.map(Number);
  return `${d} ${IDN_MONTH[m - 1]} ${y}`;
}


function setTopProgress(pct) {
  const p = document.getElementById('topProgressBar');
  if (!p) return;
  p.classList.add('is-active');
  p.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  if (pct >= 100) {
    setTimeout(() => {
      p.style.opacity = '0';
      setTimeout(() => {
        p.classList.remove('is-active');
        p.style.width = '0%';
        p.style.opacity = '';
      }, 400);
    }, 250);
  }
}


function showSkeletonLoaders() {
  const heroStats = document.getElementById('heroStats');
  if (heroStats) {
    const heroSpecs = [
      { minW: '195px', numW: '120px', lblW: '125px' },
      { minW: '175px', numW: '75px', lblW: '130px' },
      { minW: '205px', numW: '60px', lblW: '160px' },
      { minW: '190px', numW: '55px', lblW: '145px' }
    ];
    heroStats.innerHTML = heroSpecs.map(s => `
      <div class="hs skeleton-shimmer is-skeleton" style="min-width:${s.minW}">
        <div class="skel-num" style="width:${s.numW}"></div>
        <div class="skel-lbl" style="width:${s.lblW}"></div>
      </div>
    `).join('');
  }

  const problemStats = document.getElementById('problemStats');
  if (problemStats) {
    problemStats.innerHTML = Array(4).fill(0).map(() => `
      <div class="skeleton-shimmer skeleton-hs" style="min-height:95px;padding:22px 20px">
        <div class="skel-num" style="width:90px;height:26px;border-radius:6px;margin-bottom:8px"></div>
        <div class="skel-lbl" style="width:140px;height:12px;border-radius:4px"></div>
      </div>
    `).join('');
  }

  const dimGrid = document.getElementById('dimGrid');
  if (dimGrid) {
    dimGrid.innerHTML = Array(4).fill(0).map(() => `
      <div class="dim-card skeleton-shimmer" style="min-height:220px;padding:26px 22px;box-sizing:border-box">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div class="skel-lbl" style="width:32px;height:24px;border-radius:6px"></div>
          <div class="skel-lbl" style="width:24px;height:24px;border-radius:50%"></div>
        </div>
        <div class="skel-num" style="width:65%;height:22px;border-radius:6px;margin-bottom:12px"></div>
        <div class="skel-lbl" style="width:90%;height:14px;border-radius:4px;margin-bottom:8px"></div>
        <div class="skel-lbl" style="width:75%;height:14px;border-radius:4px;margin-bottom:20px"></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <div class="skel-lbl" style="width:60px;height:20px;border-radius:4px"></div>
          <div class="skel-lbl" style="width:75px;height:20px;border-radius:4px"></div>
          <div class="skel-lbl" style="width:50px;height:20px;border-radius:4px"></div>
        </div>
      </div>
    `).join('');
  }

  const topCycleLabel = document.getElementById('topCycleLabel');
  if (topCycleLabel) topCycleLabel.textContent = 'memuat…';

  const timelineSparkline = document.getElementById('timelineSparkline');
  if (timelineSparkline) {
    timelineSparkline.innerHTML = Array(32).fill(0).map((_, i) => `
      <div class="skeleton-shimmer skeleton-bar" style="height:${30 + (i % 5) * 15}%"></div>
    `).join('');
  }

  const opList = document.getElementById('opList');
  if (opList) {
    opList.innerHTML = Array(3).fill(0).map(() => `
      <div class="op-item skeleton-shimmer" style="min-height:180px;padding:24px 26px;box-sizing:border-box">
        <div class="skel-num" style="width:48px;height:38px;border-radius:8px"></div>
        <div>
          <div class="skel-num" style="width:50%;height:20px;border-radius:6px;margin-bottom:8px"></div>
          <div class="skel-lbl" style="width:70%;height:13px;border-radius:4px;margin-bottom:12px"></div>
          <div style="display:flex;gap:6px">
            <div class="skel-lbl" style="width:70px;height:20px;border-radius:10px"></div>
            <div class="skel-lbl" style="width:110px;height:20px;border-radius:10px"></div>
          </div>
        </div>
        <div>
          <div class="skel-num" style="width:80px;height:30px;border-radius:6px;margin-bottom:6px"></div>
          <div class="skel-lbl" style="width:60px;height:12px;border-radius:4px"></div>
        </div>
      </div>
    `).join('');
  }

  const kpiRow = document.getElementById('kpiRow');
  if (kpiRow) {
    kpiRow.innerHTML = Array(5).fill(0).map(() => `
      <div class="kpi skeleton-shimmer" style="min-height:110px;padding:22px 20px;box-sizing:border-box">
        <div class="skel-num" style="width:80px;height:32px;border-radius:6px;margin-bottom:8px"></div>
        <div class="skel-lbl" style="width:120px;height:14px;border-radius:4px"></div>
      </div>
    `).join('');
  }
}


function updateSupabasePing(ms, isLive = true) {
  const badge = document.getElementById('supabasePingBadge');
  const dot = document.getElementById('pingDot');
  const text = document.getElementById('pingStatusText');
  if (!badge || !dot || !text) return;

  if (isLive) {
    dot.className = 'ping-dot';
    text.textContent = `Live Database (${ms} ms)`;
    badge.title = `Koneksi Database Cloud Aktif · Latensi: ${ms} ms`;
  } else {
    dot.className = 'ping-dot is-offline';
    text.textContent = 'Database Offline';
    badge.title = 'Koneksi Database Cloud Terputus';
  }
}

async function checkSupabasePing() {
  const t0 = performance.now();
  try {
    const res = await fetch('/api/supabase?table=satellite_passes&select=seq&limit=1');
    const t1 = performance.now();
    const latency = Math.round(t1 - t0);
    if (res.ok) {
      updateSupabasePing(latency, true);
    } else {
      updateSupabasePing(latency, false);
    }
  } catch (e) {
    updateSupabasePing(0, false);
  }
}


const AUTH = {
  KEY: 'poseidon_session_v1',

  getSession() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (Date.now() >= data.expiresAt) {
        this.logout();
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  },

  isLoggedIn() {
    return this.getSession() !== null;
  },

  setSession(user, token, expiresAt) {
    const session = { user, token, expiresAt };
    localStorage.setItem(this.KEY, JSON.stringify(session));
    this.updateUI();
  },

  logout() {
    localStorage.removeItem(this.KEY);
    this.updateUI();
    checkProtectedViews();
  },

  getAuthHeader() {
    const session = this.getSession();
    return session && session.token ? { 'Authorization': `Bearer ${session.token}` } : {};
  },

  updateUI() {
    const session = this.getSession();
    const badge = document.getElementById('navAuthBadge');
    const loginBtn = document.getElementById('btnHeaderLogin');
    const userChip = document.getElementById('authUserChip');
    const timerChip = document.getElementById('authTimerChip');

    if (session) {
      if (loginBtn) loginBtn.style.display = 'none';
      if (badge) badge.style.display = 'inline-flex';
      if (userChip) {
        userChip.textContent = session.user.toUpperCase();
        userChip.title = `Akun Operasional: ${session.user.toUpperCase()}`;
      }

      const remMs = session.expiresAt - Date.now();
      const remMins = Math.max(0, Math.ceil(remMs / 60000));
      if (timerChip) timerChip.textContent = `${remMins}m`;
    } else {
      if (badge) badge.style.display = 'none';
      if (loginBtn) loginBtn.style.display = 'inline-flex';
    }
    repositionNavAuth();
  }
};

function repositionNavAuth() {
  const isMobile = window.innerWidth <= 960;
  const authContainer = document.getElementById('navAuthContainer');
  const navTabs = document.querySelector('.nav-tabs');
  const navMetaGroup = document.getElementById('navMetaGroup');

  if (!authContainer || !navTabs || !navMetaGroup) return;

  if (isMobile) {
    if (authContainer.parentElement !== navTabs) {
      navTabs.appendChild(authContainer);
    }
  } else {
    if (authContainer.parentElement !== navMetaGroup) {
      const navToggle = document.getElementById('navToggle');
      if (navToggle) {
        navMetaGroup.insertBefore(authContainer, navToggle);
      } else {
        navMetaGroup.appendChild(authContainer);
      }
    }
  }
}

window.addEventListener('resize', repositionNavAuth);
window.addEventListener('DOMContentLoaded', repositionNavAuth);


async function fetchDataset(fileName) {
  const headers = AUTH.getAuthHeader();

  try {
    const res = await fetch(`/api/data?file=${encodeURIComponent(fileName)}`, { headers });
    if (res.ok) return await res.json();
  } catch (e) {
    
  }

  try {
    const res = await fetch(`${DATA}/${fileName}`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.error(`Failed to fetch ${fileName}:`, e);
  }
  return null;
}

async function fetchSupabase(table, params = '') {
  const t0 = performance.now();
  const url = `/api/supabase?table=${encodeURIComponent(table)}${params ? '&' + params : ''}`;
  try {
    const res = await fetch(url);
    const t1 = performance.now();
    updateSupabasePing(Math.round(t1 - t0), res.ok);
    if (!res.ok) {
      console.warn(`Supabase proxy failed for table ${table}: ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    updateSupabasePing(0, false);
    console.error(`Supabase fetch error for table ${table}:`, e);
    return null;
  }
}

async function loadSatellitePasses() {
  const data = await fetchSupabase('satellite_passes', 'select=seq,pass_date,year,month,time,total_detections,dark_count,siaga_1_count,siaga_2_count,siaga_3_count&order=pass_date.asc&limit=1000');
  if (!data || !Array.isArray(data)) return [];
  return data.map(r => ({
    seq: Number(r.seq || 0),
    id: r.pass_date,
    pass_date: r.pass_date,
    year: Number(r.year || (r.pass_date ? r.pass_date.slice(0, 4) : 2026)),
    month: Number(r.month || (r.pass_date ? r.pass_date.slice(5, 7) : 1)),
    time: r.time || '00:00',
    n: Number(r.total_detections || 0),
    total_detections: Number(r.total_detections || 0),
    n_dark: Number(r.dark_count || 0),
    dark_count: Number(r.dark_count || 0),
    n_s1: Number(r.siaga_1_count || 0),
    siaga_1_count: Number(r.siaga_1_count || 0),
    n_s2: Number(r.siaga_2_count || 0),
    siaga_2_count: Number(r.siaga_2_count || 0),
    n_s3: Number(r.siaga_3_count || 0),
    siaga_3_count: Number(r.siaga_3_count || 0)
  }));
}

function formatTop10Row(r) {
  const rawScore = Number(r.raw_risk_score !== null && r.raw_risk_score !== undefined ? r.raw_risk_score : (r.risk_score || 0));
  return {
    id: r.id,
    row_id: r.id,
    pass: r.pass_date,
    pass_date: r.pass_date,
    timestamp: r.timestamp,
    ts: r.timestamp,
    hour: r.timestamp ? String(r.timestamp).slice(11, 16) : '00:00',
    lat: Number(r.lat),
    lon: Number(r.lon),
    score: rawScore,
    raw_risk_score: rawScore,
    risk_score: rawScore,
    tier: r.status_siaga || 'SIAGA 3 (Pasif)',
    status_siaga: r.status_siaga || 'SIAGA 3 (Pasif)',
    rank: Number(r.rank_siklus || 1),
    rank_siklus: Number(r.rank_siklus || 1),
    conformal: Number(r.conformal_flag || 0),
    conformal_flag: Number(r.conformal_flag || 0),
    length_m: Number(r.length_m_new || 0),
    length_m_new: Number(r.length_m_new || 0),
    fishing_score: Number(r.fishing_score_new || 0),
    fishing_score_new: Number(r.fishing_score_new || 0),
    fscore: Number(r.fishing_score_new || 0),
    matching_score: 0,
    vv: Number(r.vv_intensity_db || 0),
    vh: Number(r.vh_intensity_db || 0),
    snr: Number(r.snr_db || 0),
    mpa: Number(r.dist_to_nearest_mpa_km || 0),
    eez: Number(r.dist_to_eez_boundary_km || 0),
    port: Number(r.dist_to_nearest_port_km || 0),
    seizure: Number(r.dist_to_nearest_seizure_km || 0),
    is_dark: Number(r.is_dark || 1),
    ais: Number(r.is_dark || 1) === 0 ? 1 : 0,
    cat: 'unmatched',
    flag: r.ais_flag_country || 'UNKNOWN',
    shap: r.risk_factors_shap ? r.risk_factors_shap.split(' | ') : [],
    risk_factors_shap: r.risk_factors_shap || ''
  };
}

async function loadTop10Priorities() {
  const pageOffsets = [0, 1000, 2000];
  const batches = await Promise.all(
    pageOffsets.map(offset =>
      fetchSupabase('top10_priorities', `select=*&order=pass_date.asc,rank_siklus.asc&limit=1000&offset=${offset}`)
    )
  );

  const allRows = [];
  for (const batch of batches) {
    if (batch && Array.isArray(batch) && batch.length) {
      allRows.push(...batch);
    }
  }

  return allRows.map(formatTop10Row);
}

async function loadDetectionsForPass(passId) {
  if (!passId) return { columns: [], rows: [] };
  if (S.detCache.has(passId)) {
    return S.detCache.get(passId);
  }
  if (!S.detPromiseCache) S.detPromiseCache = new Map();
  if (S.detPromiseCache.has(passId)) {
    return S.detPromiseCache.get(passId);
  }

  const loadPromise = (async () => {
    const yr = parseInt(passId.slice(0, 4), 10);
    let detData = null;

    if (yr <= 2024) {
      try {
        detData = await fetchDataset(`detections/${passId}.json`);
      } catch (e) {
        detData = null;
      }
    } else {
      try {
        const resp = await fetchSupabase(
          'vessel_detections',
          `pass_date=eq.${passId}&select=id,pass_date,lat,lon,length_m_new,is_dark,fishing_score_new,dist_to_nearest_mpa_km,dist_to_eez_boundary_km,dist_to_nearest_port_km,timestamp,vv_intensity_db,vh_intensity_db,snr_db,ais_flag_country&limit=1000`
        );
        if (resp && Array.isArray(resp)) {
          const columns = ['row_id', 'lat', 'lon', 'length_m', 'cat', 'ais', 'fscore', 'mscore', 'flag', 'vv', 'vh', 'snr', 'mpa', 'eez', 'port', 'hour'];
          const rows = resp.map(r => [
            r.id,
            Number(r.lat),
            Number(r.lon),
            Number(r.length_m_new || 0),
            r.is_dark ? 'unmatched' : 'other',
            r.is_dark ? 0 : 1,
            Number(r.fishing_score_new || 0),
            0.0,
            r.ais_flag_country || 'UNKNOWN',
            Number(r.vv_intensity_db || 0),
            Number(r.vh_intensity_db || 0),
            Number(r.snr_db || 0),
            Number(r.dist_to_nearest_mpa_km || 0),
            Number(r.dist_to_eez_boundary_km || 0),
            Number(r.dist_to_nearest_port_km || 0),
            r.timestamp ? String(r.timestamp).slice(11, 16) : '00:00'
          ]);
          detData = { pass_id: passId, columns, rows };
        }
      } catch (e) {
        detData = null;
      }
    }

    if (!detData) {
      detData = { columns: ['row_id', 'lat', 'lon', 'length_m', 'cat', 'ais', 'fscore', 'mscore', 'flag', 'vv', 'vh', 'snr', 'mpa', 'eez', 'port', 'hour'], rows: [] };
    }

    S.detCache.set(passId, detData);
    S.detPromiseCache.delete(passId);
    return detData;
  })();

  S.detPromiseCache.set(passId, loadPromise);
  return loadPromise;
}


function checkProtectedViews(tabName) {
  const currentTab = tabName || document.querySelector('.tab.is-active')?.dataset?.tab || 'platform';
  const protectedTabs = ['dashboard', 'operasi'];
  const isProtected = protectedTabs.includes(currentTab);
  const isLoggedIn = AUTH.isLoggedIn();

  const overlay = document.getElementById('authLockOverlay');

  document.querySelectorAll('.view').forEach(v => {
    const isThisViewProtected = protectedTabs.includes(v.id.replace('view-', ''));
    if (isThisViewProtected && !isLoggedIn) {
      v.classList.add('is-blurred');
    } else {
      v.classList.remove('is-blurred');
    }
  });

  if (isProtected && !isLoggedIn) {
    if (overlay) overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
  } else {
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }
  AUTH.updateUI();
}


function initAuthEvents() {
  const form = document.getElementById('authLoginForm');
  const btnToggle = document.getElementById('authPwdToggle');
  const btnLogout = document.getElementById('btnLogout');
  const btnHeaderLogin = document.getElementById('btnHeaderLogin');
  const inputPwd = document.getElementById('authPassword');

  if (btnHeaderLogin) {
    btnHeaderLogin.onclick = () => {
      switchTab('dashboard');
      const navTabsEl = document.querySelector('.nav-tabs');
      const navToggleBtn = document.getElementById('navToggle');
      if (navTabsEl) navTabsEl.classList.remove('is-open');
      if (navToggleBtn) navToggleBtn.classList.remove('is-open');
      const inputUser = document.getElementById('authUsername');
      if (inputUser) setTimeout(() => inputUser.focus(), 150);
    };
  }

  if (btnToggle && inputPwd) {
    btnToggle.onclick = () => {
      const isPwd = inputPwd.type === 'password';
      inputPwd.type = isPwd ? 'text' : 'password';
      const eyeIcon = document.getElementById('authPwdEyeIcon');
      if (eyeIcon) {
        eyeIcon.innerHTML = isPwd
          ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`
          : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
      }
    };
  }

  if (btnLogout) {
    btnLogout.onclick = () => {
      const navTabsEl = document.querySelector('.nav-tabs');
      const navToggleBtn = document.getElementById('navToggle');
      if (navTabsEl) navTabsEl.classList.remove('is-open');
      if (navToggleBtn) navToggleBtn.classList.remove('is-open');
      AUTH.logout();
    };
  }

  const uInp = document.getElementById('authUsername');
  const pInp = document.getElementById('authPassword');
  if (uInp && !AUTH.isLoggedIn()) uInp.value = '';
  if (pInp && !AUTH.isLoggedIn()) pInp.value = '';

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const userInp = document.getElementById('authUsername').value.trim();
      const passInp = document.getElementById('authPassword').value;
      const alertBox = document.getElementById('authAlert');
      const submitBtn = document.getElementById('authSubmitBtn');

      if (!userInp || !passInp) return;

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Memverifikasi...</span>';
      alertBox.style.display = 'none';

      let result = null;
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: userInp, password: passInp })
        });
        result = await res.json();
      } catch (err) {
        result = { success: false, message: 'Gagal terhubung ke server autentikasi.' };
      }

      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Login</span>';

      if (result && result.success) {
        AUTH.setSession(result.user, result.token, result.expiresAt);
        checkProtectedViews();
        boot();
      } else {
        alertBox.textContent = result ? result.message : 'Username atau Password salah.';
        alertBox.style.display = 'block';
      }
    };
  }
}

window.addEventListener('load', () => {
  if (!AUTH.isLoggedIn()) {
    setTimeout(() => {
      const uInp = document.getElementById('authUsername');
      const pInp = document.getElementById('authPassword');
      if (uInp && !uInp.matches(':focus')) uInp.value = '';
      if (pInp && !pInp.matches(':focus')) pInp.value = '';
    }, 100);
  }
});


function calculateRevisitStats() {
  if (!S.passes || S.passes.length < 2) return { mean: 1.92, median: 2.0 };
  const sorted = [...S.passes].sort((a, b) => new Date(a.pass_date || a.id) - new Date(b.pass_date || b.id));
  const diffs = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const d1 = new Date(sorted[i].pass_date || sorted[i].id);
    const d2 = new Date(sorted[i + 1].pass_date || sorted[i + 1].id);
    const diffDays = (d2 - d1) / (1000 * 60 * 60 * 24);
    if (diffDays > 0 && diffDays < 30) diffs.push(diffDays);
  }
  if (!diffs.length) return { mean: 1.92, median: 2.0 };
  const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  diffs.sort((a, b) => a - b);
  const median = diffs[Math.floor(diffs.length / 2)];
  return { mean, median };
}


function updateInitPing(ms, isLive = true) {
  const dot = document.getElementById('initPingDot');
  const text = document.getElementById('initPingText');
  if (!dot || !text) return;
  if (isLive) {
    dot.className = 'ping-dot';
    text.textContent = `Database Cloud Terhubung (${ms} ms)`;
  } else {
    dot.className = 'ping-dot is-offline';
    text.textContent = 'Database Mode Lokal / Cache';
  }
}

function setInitOverlayProgress(pct, text, sub) {
  const overlay = document.getElementById('appInitOverlay');
  if (!overlay || overlay.classList.contains('is-hidden')) return;
  const fill = document.getElementById('initProgressFill');
  if (fill) fill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  const txtEl = document.getElementById('initProgressText');
  if (txtEl && text) txtEl.textContent = text;
  const subEl = document.getElementById('initProgressSub');
  if (subEl && sub) subEl.textContent = sub;
}

function hideInitOverlay() {
  const overlay = document.getElementById('appInitOverlay');
  if (!overlay) return;
  setInitOverlayProgress(100, 'Sistem siap dioperasikan', 'Inisialisasi selesai');
  setTimeout(() => {
    overlay.classList.add('is-hidden');
    document.body.classList.remove('is-app-loading');
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    setTimeout(() => {
      overlay.remove();
    }, 500);
  }, 280);
}


async function boot() {
  try {
    setTopProgress(15);
    setInitOverlayProgress(20, 'Menghubungkan ke database satelit...', 'Memeriksa sesi otentikasi & koneksi cloud');
    showSkeletonLoaders();
    AUTH.updateUI();

    const pingPromise = (async () => {
      const t0 = performance.now();
      try {
        const res = await fetch('/api/supabase?table=satellite_passes&select=seq&limit=1');
        const t1 = performance.now();
        const latency = Math.round(t1 - t0);
        if (res.ok) {
          updateInitPing(latency, true);
          updateSupabasePing(latency, true);
        } else {
          updateInitPing(0, false);
        }
      } catch (e) {
        updateInitPing(0, false);
      }
    })();

    if (!window._authTimerInit) {
      window._authTimerInit = true;
      setInterval(() => {
        if (AUTH.isLoggedIn()) {
          AUTH.updateUI();
        } else {
          checkProtectedViews();
        }
      }, 15000);
      setInterval(checkSupabasePing, 30000);
      initAuthEvents();
    }

    setTopProgress(35);
    setInitOverlayProgress(45, 'Mengunduh siklus perlintasan radar & analisis risiko...', 'Sinkronisasi 699 siklus Sentinel-1 & 2.944 Top 10 prioritas');
    const [meta, metrics, passes, top10, seizuresData, grid] = await Promise.all([
      fetchDataset('meta.json'),
      fetchDataset('metrics.json'),
      loadSatellitePasses(),
      loadTop10Priorities(),
      fetchDataset('seizures.json'),
      fetchDataset('fishing_grid.json'),
      pingPromise
    ]);

    setTopProgress(75);
    setInitOverlayProgress(85, 'Menyusun visualisasi peta maritim & ringkasan analitik...', 'Merender poligon WPP-711 & grafik tren');
    S.meta = meta;
    S.metrics = metrics;
    S.passes = passes;
    renderTimelineSparkline();
    S.top10 = top10;
    S.seizures = (seizuresData && seizuresData.items) ? seizuresData.items : (seizuresData || []);
    S.grid = grid;

    setTopProgress(90);
    renderPlatform();
    initDashboard();
    renderOperasi();
    renderStatistik();
    initReveal();

    const totalDet = (S.meta && S.meta.data && S.meta.data.total_detections_history)
      ? S.meta.data.total_detections_history
      : S.passes.reduce((sum, p) => sum + (p.n || 0), 0);

    const navMetaEl = document.getElementById('navMeta');
    if (navMetaEl) {
      navMetaEl.textContent = `${NF(totalDet)} deteksi · ${S.passes.length} siklus`;
    }

    const footMetaEl = document.getElementById('footMeta');
    if (footMetaEl && S.meta && S.meta.data) {
      const d = S.meta.data;
      footMetaEl.textContent = `Data ${d.date_start.slice(0, 10)} — ${d.date_end.slice(0, 10)}`;
    }

    const curActive = document.querySelector('.tab.is-active');
    if (curActive) updateNavBoatSlider(null, curActive);

    if (!window._listenersInit) {
      window._listenersInit = true;
      window.addEventListener('resize', () => {
        if (MAP) MAP.invalidateSize();
        const current = document.querySelector('.tab.is-active');
        if (current) updateNavBoatSlider(null, current);
        repositionNavAuth();
      });
      window.addEventListener('orientationchange', () => {
        if (MAP) setTimeout(() => MAP.invalidateSize(), 200);
        const current = document.querySelector('.tab.is-active');
        if (current) updateNavBoatSlider(null, current);
        repositionNavAuth();
      });
    }

    repositionNavAuth();
    checkProtectedViews();
    setTopProgress(100);
    hideInitOverlay();
  } catch (err) {
    setTopProgress(100);
    console.error('Error saat inisialisasi aplikasi:', err);
    setInitOverlayProgress(100, 'Gagal memuat data awal', 'Silakan muat ulang halaman (F5)');
    const subEl = document.getElementById('initProgressSub');
    if (subEl) subEl.innerHTML = `<span style="color:var(--flare)">${err.message || 'Koneksi terputus'}</span>`;
  }
}


const navToggleBtn = document.getElementById('navToggle');
const navTabsEl = document.querySelector('.nav-tabs');

if (navToggleBtn && navTabsEl) {
  navToggleBtn.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = navTabsEl.classList.toggle('is-open');
    navToggleBtn.classList.toggle('is-open', isOpen);
  });
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-tab]');
  if (t) { e.preventDefault(); switchTab(t.dataset.tab); }
  const sc = e.target.closest('[data-scroll]');
  if (sc) {
    const elTarget = document.querySelector(sc.dataset.scroll);
    if (elTarget) elTarget.scrollIntoView({ behavior: 'smooth' });
  }

  if (navTabsEl && navToggleBtn && !e.target.closest('.nav')) {
    navTabsEl.classList.remove('is-open');
    navToggleBtn.classList.remove('is-open');
  }
});

function createSailParticles(sliderEl, direction) {
  const container = sliderEl.querySelector('.boat-particle-container');
  if (!container) return;

  for (let i = 0; i < 16; i++) {
    setTimeout(() => {
      const p = document.createElement('span');
      p.className = 'sail-water-particle';
      const offset = (Math.random() - 0.5) * 14;
      const startX = direction === 'right' ? 12 : sliderEl.offsetWidth - 12;
      p.style.left = `${startX + offset}px`;
      p.style.bottom = `${4 + Math.random() * 8}px`;
      const size = 3 + Math.random() * 3.5;
      p.style.width = `${size}px`;
      p.style.height = `${size}px`;
      const vx = direction === 'right' ? -(14 + Math.random() * 18) : (14 + Math.random() * 18);
      const vy = (Math.random() - 0.5) * 10;
      p.style.setProperty('--p-vx', `${vx}px`);
      p.style.setProperty('--p-vy', `${vy}px`);
      container.appendChild(p);
      setTimeout(() => p.remove(), 650);
    }, i * 28);
  }
}

function updateNavBoatSlider(prevTabEl, newTabEl) {
  const slider = document.getElementById('navBoatSlider');
  if (!slider || !newTabEl) return;
  const navTabs = newTabEl.parentElement;
  if (!navTabs) return;
  const navRect = navTabs.getBoundingClientRect();
  const tabRect = newTabEl.getBoundingClientRect();
  const left = tabRect.left - navRect.left;
  const width = tabRect.width;

  if (prevTabEl) {
    let dir = 'right';
    if (tabRect.left > prevTabEl.getBoundingClientRect().left) {
      dir = 'right';
      slider.classList.add('sailing-right');
      slider.classList.remove('sailing-left');
    } else if (tabRect.left < prevTabEl.getBoundingClientRect().left) {
      dir = 'left';
      slider.classList.add('sailing-left');
      slider.classList.remove('sailing-right');
    }
    createSailParticles(slider, dir);
    setTimeout(() => {
      slider.classList.remove('sailing-right', 'sailing-left');
    }, 500);
  }

  slider.style.transform = `translateX(${left}px)`;
  slider.style.width = `${width}px`;
}

function switchTab(name) {
  const prevActive = document.querySelector('.tab.is-active');
  const targetTab = document.querySelector(`.tab[data-tab="${name}"]`);

  if (navTabsEl) navTabsEl.classList.remove('is-open');
  if (navToggleBtn) navToggleBtn.classList.remove('is-open');

  document.querySelectorAll('.view').forEach(v => v.classList.toggle('is-active', v.id === `view-${name}`));
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('is-active', b.dataset.tab === name));

  checkProtectedViews(name);

  if (targetTab) updateNavBoatSlider(prevActive, targetTab);

  window.scrollTo({ top: 0, behavior: 'smooth' });
  window.dispatchEvent(new Event('resize'));
  if (name === 'dashboard' && MAP) {
    setTimeout(() => MAP.invalidateSize(), 80);
    setTimeout(() => MAP.invalidateSize(), 300);
    setTimeout(() => centerActiveSparklineBar(), 100);
    setTimeout(() => centerActiveSparklineBar(), 350);
  }
  if (name === 'operasi') {
    setTimeout(() => {
      if (S.passes && S.passes[S.passIdx]) highlightSiaga1ChartBar(S.passes[S.passIdx].id);
    }, 80);
    setTimeout(() => {
      if (S.passes && S.passes[S.passIdx]) highlightSiaga1ChartBar(S.passes[S.passIdx].id);
    }, 250);
  }
}


function renderPlatform() {
  if (!S.meta) return;
  const d = S.meta.data, m = S.meta.model;

  const years = [...new Set(S.passes.map(p => p.year))].sort((a, b) => a - b);
  const yearRangeStr = years.length ? `${years[0]}–${years[years.length - 1]}` : '2023–2026';
  const totalDet = d.total_detections_history || d.total_detections || S.passes.reduce((sum, p) => sum + (p.n || 0), 0);

  const lblTotalDet = document.getElementById('lblTotalDet');
  if (lblTotalDet) lblTotalDet.textContent = NF(totalDet);
  const lblLabelP = document.getElementById('lblLabelP');
  if (lblLabelP) lblLabelP.textContent = NF(d.label_P);
  const lblLabelU = document.getElementById('lblLabelU');
  if (lblLabelU) lblLabelU.textContent = NF(d.label_U);

  const lblLimitYears = document.getElementById('lblLimitYears');
  if (lblLimitYears) lblLimitYears.textContent = yearRangeStr;
  const lblHeroYears = document.getElementById('lblHeroYears');
  if (lblHeroYears) lblHeroYears.textContent = yearRangeStr;

  const lblLimitP = document.getElementById('lblLimitP');
  if (lblLimitP) lblLimitP.textContent = NF(d.label_P);

  const totalSeiz = (d && d.seizures_total !== undefined) ? d.seizures_total : (S.seizures ? (Array.isArray(S.seizures) ? S.seizures.length : (S.seizures.items ? S.seizures.items.length : 61)) : 61);
  const unmatchedSeiz = (d && d.seizures_unmatched !== undefined) ? d.seizures_unmatched : 17;

  const lblLimitSeizTotal = document.getElementById('lblLimitSeizTotal');
  if (lblLimitSeizTotal) lblLimitSeizTotal.textContent = NF(totalSeiz);
  const lblLimitSeizUnmatched = document.getElementById('lblLimitSeizUnmatched');
  if (lblLimitSeizUnmatched) lblLimitSeizUnmatched.textContent = NF(unmatchedSeiz);

  const topYears = [...new Set(S.top10.map(t => t.pass.slice(0, 4)))].sort();
  const lblDashOpYear = document.getElementById('lblDashOpYear');
  if (lblDashOpYear && topYears.length > 0) lblDashOpYear.textContent = topYears.join('–');

  document.getElementById('heroStats').innerHTML = [
    [NF(totalDet), 'Deteksi radar'],
    [S.passes.length, 'Siklus satelit'],
    [d.label_P, 'Kasus terkonfirmasi'],
    [(m.n_features_gfw || m.n_features_gee || (m.features_gfw ? m.features_gfw.length : (m.features_gee ? m.features_gee.length : 0))), 'Fitur · 4 dimensi']
  ].map(([b, s]) => `<div class="hs"><b>${b}</b><span>${s}</span></div>`).join('');

  document.getElementById('problemStats').innerHTML = [
    [NF(d.label_U), 'Kapal berstatus tidak diketahui'],
    [NF(d.label_RN), 'Kapal niaga teridentifikasi'],
    [d.label_P, 'Kapal terkonfirmasi ilegal'],
    [`1 : ${Math.round(d.label_U / Math.max(d.label_P, 1)).toLocaleString('id-ID')}`, 'Rasio kasus terhadap data']
  ].map(([b, s]) => `<div><b>${b}</b><span>${s}</span></div>`).join('');

  const DIM_ICONS = {
    A: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--sonar)" stroke-width="2"><path d="M4.9 19.1C1.4 15.6 1.4 10 4.9 6.5"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9c3.5 3.5 3.5 9.1 0 12.6"/></svg>`,
    B: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--kelp)" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
    C: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" stroke-width="2"><path d="M6.5 12c.94-2.07 3.08-3.5 5.5-3.5 2.43 0 4.56 1.43 5.5 3.5-1 2.07-3.13 3.5-5.5 3.5-2.42 0-4.56-1.43-5.5-3.5z"/><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/></svg>`,
    D: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--flare)" stroke-width="2"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20" stroke-width="3"/></svg>`
  };

  const labelsMap = (S.meta && S.meta.feature_labels) || {};
  document.getElementById('dimGrid').innerHTML = S.meta.dimensions.map(x => `
    <div class="dim-card reveal">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div class="dim-code">${x.code}</div>
        <div>${DIM_ICONS[x.code] || ''}</div>
      </div>
      <h4>${x.name}</h4>${x.desc ? `<p>${x.desc}</p>` : ''}
      <div class="dim-feats">${x.features.map(f => `<span title="${labelsMap[f] || f}">${f}</span>`).join('')}</div>
    </div>`).join('');

  const pipelineSteps = [
    { step: 'AKUISISI', title: 'Deteksi radar Sentinel-1', desc: 'Deteksi radar Sentinel-1 melalui GEE (strategi mitigasi saat masa transisi satelit) dan GFW, disaring ke dalam poligon resmi WPP-711 (BIG/Portal Satu Peta).' },
    { step: 'FITUR', title: 'Ekstraksi 4 dimensi', desc: 'Setiap deteksi diperkaya dengan karakteristik fisik radar, konteks spasial-regulasi ZEE/MPA, estimasi aktivitas penangkapan ikan, dan pola temporal.' },
    { step: 'PELABELAN', title: 'Pencocokan catatan penindakan', desc: 'Catatan penangkapan resmi dicocokkan ke deteksi radar melalui alokasi global spasial-temporal, lalu diaudit ulang untuk menyaring kecocokan lemah.' },
    { step: 'PEMODELAN', title: 'Positive-Unlabeled Learning', desc: 'Model dilatih untuk tidak memaksa menganggap seluruh kapal tak berlabel sebagai kapal aman, karena sebagian di antaranya kemungkinan kapal ilegal yang belum tertangkap.' },
    { step: 'KALIBRASI', title: 'Conformal Prediction', desc: 'Ambang batas skor dikalibrasi agar memberi jaminan cakupan statistik, bukan sekadar angka probabilitas mentah.' },
    { step: 'OPERASIONAL', title: 'Sepuluh prioritas per siklus', desc: 'Setiap siklus satelit menghasilkan sepuluh kapal prioritas dengan penjelasan faktor risiko yang dapat ditindaklanjuti.' }
  ];

  document.getElementById('pipelineList').innerHTML = pipelineSteps.map(p => `
    <li class="reveal">
      <div class="p-step">${p.step}</div>
      <div>
        <h4>${p.title}</h4>
        <p>${p.desc}</p>
      </div>
    </li>`).join('');

  const allModels = (S.metrics && (S.metrics.all_models || S.metrics.comparison || S.metrics.baselines_oot2026)) ? (S.metrics.all_models || S.metrics.comparison) : [];
  const pos = (S.metrics && S.metrics.best_models_two_pipelines && S.metrics.best_models_two_pipelines.gfw_pipeline_best) || (S.metrics && S.metrics.poseidon) || allModels.find(r => (r.label || r.name || '').includes('LightGBM (GFW)')) || allModels[0] || null;
  const sup = (S.metrics && S.metrics.baselines_oot2026 ? S.metrics.baselines_oot2026 : allModels).find(r => (r.label || r.name || '').includes('No PU')) || null;

  const posAuc = (pos && (pos.auc_roc !== undefined ? pos.auc_roc : pos.auc)) || 0;
  const supAuc = (sup && (sup.auc_roc !== undefined ? sup.auc_roc : sup.auc)) || 0;
  const posAuprc = (pos && pos.auprc !== undefined) ? pos.auprc : 0;
  const supAuprc = (sup && sup.auprc !== undefined) ? sup.auprc : 0;

  const compareMiniBox = document.getElementById('compareMini');
  if (compareMiniBox) {
    compareMiniBox.innerHTML = `
      <div class="is-poseidon"><b>${N(posAuc, 4)}</b><span>AUC POSEIDON (OOT 2026)</span></div>
      <div><b>${N(supAuc, 4)}</b><span>AUC Tanpa PU Learning</span></div>
      <div class="is-poseidon"><b>${N(posAuprc, 4)}</b><span>AUPRC POSEIDON (Presisi Terukur)</span></div>
      <div><b>${N(supAuprc, 4)}</b><span>AUPRC Model No PU</span></div>`;
  }

  const g = document.getElementById('sweepDots');
  if (g) {
    let dots = '';
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, r = 40 + Math.random() * 240;
      const hot = Math.random() < .18;
      dots += `<circle cx="${(300 + Math.cos(a) * r).toFixed(1)}" cy="${(300 + Math.sin(a) * r).toFixed(1)}" r="4"
        class="${hot ? 'hot' : ''}" style="animation-delay:${((a / (Math.PI * 2)) * 7).toFixed(2)}s"/>`;
    }
    g.innerHTML = dots;
  }
}

function initReveal() {
  const io = new IntersectionObserver(es => {
    es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
  }, { threshold: .1 });
  document.querySelectorAll('.reveal').forEach(n => io.observe(n));
}


let MAP = null;
let LAYER_DET = null, LAYER_FISH = null, LAYER_SEIZ = null, LAYER_WPP = null, LAYER_TOP = null;

function initDashboard() {
  if (MAP) return;
  MAP = L.map('map', {
    zoomControl: false,
    scrollWheelZoom: true,
    touchZoom: true,
    dragging: true,
    doubleClickZoom: true,
    zoomSnap: 0.1,
    zoomDelta: 0.5,
    zoomAnimation: true,
    zoomAnimationThreshold: 10,
    fadeAnimation: true,
    markerZoomAnimation: true,
    wheelDebounceTime: 30,
    wheelPxPerZoomLevel: 100,
    minZoom: 5,
    maxZoom: 12,
    attributionControl: false
  }).setView([2.5, 107.5], 7);

  let currentBasemap = 'satellite';
  let tileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 12
  }).addTo(MAP);

  const btnBase = document.getElementById('mapBasemapBtn');
  if (btnBase) {
    btnBase.classList.add('is-satellite');
    btnBase.onclick = () => {
      if (currentBasemap === 'satellite') {
        currentBasemap = 'voyager';
        MAP.removeLayer(tileLayer);
        tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          maxZoom: 12,
          subdomains: 'abcd'
        }).addTo(MAP);
        btnBase.classList.remove('is-satellite');
      } else {
        currentBasemap = 'satellite';
        MAP.removeLayer(tileLayer);
        tileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 12
        }).addTo(MAP);
        btnBase.classList.add('is-satellite');
      }
    };
  }

  const zoomSlider = document.getElementById('mapZoomSlider');
  const zoomInBtn = document.getElementById('mapZoomInBtn');
  const zoomOutBtn = document.getElementById('mapZoomOutBtn');
  const zoomBadge = document.getElementById('mapZoomLevelVal');

  function updateZoomUI() {
    if (!MAP) return;
    const z = MAP.getZoom();
    if (z === undefined || z === null) return;
    if (zoomSlider) zoomSlider.value = z;
    if (zoomBadge) zoomBadge.textContent = `${Number(z).toFixed(1)}×`;
  }

  if (zoomSlider) {
    zoomSlider.oninput = e => {
      if (MAP) MAP.setZoom(+e.target.value);
    };
  }
  if (zoomInBtn) zoomInBtn.onclick = () => { if (MAP) MAP.zoomIn(); };
  if (zoomOutBtn) zoomOutBtn.onclick = () => { if (MAP) MAP.zoomOut(); };

  MAP.on('zoom zoomend', updateZoomUI);
  updateZoomUI();

  const scrollHint = document.getElementById('mapScrollHint');
  if (scrollHint) {
    scrollHint.onclick = () => {
      if (window.scrollY > 200) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const dashBottom = document.querySelector('.dash-bottom');
        if (dashBottom) dashBottom.scrollIntoView({ behavior: 'smooth' });
      }
    };

    window.addEventListener('scroll', () => {
      if (window.scrollY > 200) {
        scrollHint.classList.add('is-scrolled');
        const textEl = scrollHint.querySelector('.hint-text');
        if (textEl) textEl.textContent = 'Kembali ke Peta Operasional';
      } else {
        scrollHint.classList.remove('is-scrolled');
        const textEl = scrollHint.querySelector('.hint-text');
        if (textEl) textEl.textContent = 'Detail Operasional & Prioritas Patroli';
      }
    });
  }

  LAYER_FISH = L.layerGroup();
  LAYER_SEIZ = L.layerGroup();
  LAYER_WPP = L.layerGroup().addTo(MAP);
  LAYER_DET = L.layerGroup().addTo(MAP);
  LAYER_TOP = L.layerGroup().addTo(MAP);

  
  const fallbackPoly = [
    [105.5, -4.25], [106.0, -4.25], [107.0, -3.8], [108.0, -3.5], [110.5, -3.3],
    [110.5, -2.0], [109.8, -1.0], [109.5, 0.5], [109.0, 1.8], [109.8, 2.5],
    [110.0, 3.5], [109.8, 4.5], [108.5, 5.8], [107.8, 5.8], [105.8, 5.5],
    [105.2, 5.1], [104.5, 3.8], [104.5, 2.2], [104.2, 1.5], [103.0, 0.5],
    [103.2, -0.8], [104.0, -1.3], [104.7, -2.5], [105.5, -4.25]
  ];

  fetchDataset('wpp711_geojson.json')
    .then(geoData => {
      if (geoData) {
        L.geoJSON(geoData, {
          style: {
            color: '#66D9E8',
            weight: 2.2,
            fillColor: '#1477B8',
            fillOpacity: 0.08,
            dashArray: '6 4'
          }
        }).addTo(LAYER_WPP);
      } else {
        throw new Error('Fallback poly');
      }
    })
    .catch(() => {
      const latLngs = fallbackPoly.map(c => [c[1], c[0]]);
      L.polygon(latLngs, {
        color: '#66D9E8', weight: 2.2, fillColor: '#1477B8', fillOpacity: 0.08, dashArray: '6 4'
      }).addTo(LAYER_WPP);
    });

  
  document.getElementById('catLegend').innerHTML = Object.entries(CAT).map(([k, v]) => `
    <label class="leg-item" data-cat="${k}">
      <input type="checkbox" data-cat="${k}" ${!S.catsOff.has(k) ? 'checked' : ''}>
      <span class="cat-icon-wrap">${CAT_ICONS[k] || CAT_ICONS.other}</span>
      <span class="lb">${v.label}</span>
      <span class="cn mono" data-cnt="${k}">0</span>
    </label>`).join('');

  document.querySelectorAll('#catLegend input[type="checkbox"]').forEach(chk => {
    chk.onchange = e => {
      const k = e.target.dataset.cat;
      if (e.target.checked) {
        S.catsOff.delete(k);
      } else {
        S.catsOff.add(k);
      }
      drawDetections();
    };
  });

  document.getElementById('catAll').onclick = () => {
    S.catsOff.clear();
    document.querySelectorAll('#catLegend input[type="checkbox"]').forEach(chk => { chk.checked = true; });
    drawDetections();
  };

  
  const filterLen = document.getElementById('filterMinLen');
  const filterFish = document.getElementById('filterMinFish');
  const filterZone = document.getElementById('filterZone');
  if (filterLen && filterFish && filterZone) {
    filterLen.oninput = e => {
      S.filters.minLen = +e.target.value;
      document.getElementById('filterMinLenVal').textContent = S.filters.minLen > 0 ? `${S.filters.minLen} m` : 'Semua';
      drawDetections();
    };
    filterFish.oninput = e => {
      S.filters.minFish = +e.target.value;
      document.getElementById('filterMinFishVal').textContent = S.filters.minFish > 0 ? `≥ ${S.filters.minFish}` : 'Semua';
      drawDetections();
    };
    filterZone.onchange = e => {
      S.filters.zone = e.target.value;
      drawDetections();
    };
  }

  
  document.getElementById('layFishing').onchange = e => {
    e.target.checked ? LAYER_FISH.addTo(MAP) : MAP.removeLayer(LAYER_FISH);
    document.getElementById('fishLegend').classList.toggle('is-on', e.target.checked);
  };
  document.getElementById('laySeizure').onchange = e =>
    e.target.checked ? LAYER_SEIZ.addTo(MAP) : MAP.removeLayer(LAYER_SEIZ);
  document.getElementById('layWpp').onchange = e =>
    e.target.checked ? LAYER_WPP.addTo(MAP) : MAP.removeLayer(LAYER_WPP);
  document.getElementById('layTop10').onchange = e =>
    e.target.checked ? LAYER_TOP.addTo(MAP) : MAP.removeLayer(LAYER_TOP);

  
  const slider = document.getElementById('passSlider');
  if (slider) {
    slider.max = Math.max(0, S.passes.length - 1);
    let sliderDebounce = null;
    slider.oninput = e => {
      const targetVal = +e.target.value;
      if (S.passes[targetVal]) {
        const p = S.passes[targetVal];
        const seqEl = document.getElementById('passSeq');
        if (seqEl) seqEl.textContent = `PASS ${String(p.seq || targetVal + 1).padStart(3, '0')} / ${S.passes.length}`;
        const dateEl = document.getElementById('passDate');
        if (dateEl) dateEl.textContent = fmtDate(p.id);
      }
      clearTimeout(sliderDebounce);
      sliderDebounce = setTimeout(() => {
        selectPass(targetVal);
      }, 40);
    };
  }
  const prevBtn = document.getElementById('passPrev');
  if (prevBtn) prevBtn.onclick = () => selectPass(S.passIdx - 1);
  const nextBtn = document.getElementById('passNext');
  if (nextBtn) nextBtn.onclick = () => selectPass(S.passIdx + 1);
  const playBtn = document.getElementById('passPlay');
  if (playBtn) playBtn.onclick = toggleAutoPlay;

  
  document.getElementById('mapSearchBtn').onclick = searchMap;
  document.getElementById('mapSearchInput').onkeyup = e => { if (e.key === 'Enter') searchMap(); };

  
  document.getElementById('exportDashGeoJSON').onclick = () => {
    if (S.passes[S.passIdx]) exportPassData(S.passes[S.passIdx].id, 'geojson');
  };
  document.getElementById('exportDashCSV').onclick = () => {
    if (S.passes[S.passIdx]) exportPassData(S.passes[S.passIdx].id, 'csv');
  };

  if (!S.passes || !S.passes.length) return;
  const years = [...new Set(S.passes.map(p => p.year))].sort((a, b) => b - a);
  const yearSel = document.getElementById('jumpYear');
  if (yearSel) {
    yearSel.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
    yearSel.onchange = () => {
      fillJumpPass(+yearSel.value);
      const jumpPassEl = document.getElementById('jumpPass');
      if (jumpPassEl && jumpPassEl.value !== '') selectPass(+jumpPassEl.value);
    };
  }
  const jumpPassEl = document.getElementById('jumpPass');
  if (jumpPassEl) {
    jumpPassEl.onchange = e => selectPass(+e.target.value);
  }

  
  const startIdx = S.passes.length - 1;
  if (S.passes[startIdx] && yearSel) {
    yearSel.value = S.passes[startIdx].year;
    fillJumpPass(S.passes[startIdx].year);
    renderTimelineSparkline();
    selectPass(startIdx);
  }

  buildSeizureLayer();
  buildFishingLayer();
}

function toggleAutoPlay() {
  const btn = document.getElementById('passPlay');
  if (S.isPlaying) {
    clearInterval(S.playTimer);
    S.isPlaying = false;
    if (btn) btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20"/></svg>';
  } else {
    S.isPlaying = true;
    if (btn) btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
    S.playTimer = setInterval(() => {
      let next = S.passIdx + 1;
      if (next >= S.passes.length) next = 0;
      selectPass(next);
    }, 1500);
  }
}


function clearFocusHighlight() {
  if (S.beaconCleanTimer) {
    clearTimeout(S.beaconCleanTimer);
    S.beaconCleanTimer = null;
  }
  if (MAP) {
    if (S.searchBeaconPulse1) {
      MAP.removeLayer(S.searchBeaconPulse1);
      S.searchBeaconPulse1 = null;
    }
    if (S.searchBeaconPulse2) {
      MAP.removeLayer(S.searchBeaconPulse2);
      S.searchBeaconPulse2 = null;
    }
    if (S.searchBeaconCore) {
      MAP.removeLayer(S.searchBeaconCore);
      S.searchBeaconCore = null;
    }
  }
  if (S.activeFocusMarker) {
    if (typeof S.activeFocusMarker.setZIndexOffset === 'function') {
      S.activeFocusMarker.setZIndexOffset(S.activeFocusMarker._origZIndex || 1000);
    }
    const oldEl = typeof S.activeFocusMarker.getElement === 'function' ? S.activeFocusMarker.getElement() : null;
    if (oldEl) oldEl.classList.remove('is-active-focus-pin');
    S.activeFocusMarker = null;
  }
}


function highlightVesselMarker(targetId, lat, lon) {
  if (!MAP) return;

  clearFocusHighlight();

  if (typeof MAP.flyTo === 'function') {
    MAP.flyTo([lat, lon], 10, {
      animate: true,
      duration: 1.15,
      easeLinearity: 0.2
    });
  } else {
    MAP.setView([lat, lon], 10, { animate: true, duration: 0.8 });
  }

  S.searchBeaconPulse1 = L.circleMarker([lat, lon], {
    radius: 18,
    color: '#FF6B45',
    fillColor: '#FF6B45',
    fillOpacity: 0.35,
    weight: 2,
    interactive: false,
    className: 'radar-focus-svg-beacon'
  }).addTo(MAP);

  S.searchBeaconPulse2 = L.circleMarker([lat, lon], {
    radius: 18,
    color: '#FF6B45',
    fillColor: '#FF6B45',
    fillOpacity: 0.35,
    weight: 2,
    interactive: false,
    className: 'radar-focus-svg-beacon delayed'
  }).addTo(MAP);

  S.searchBeaconCore = L.circleMarker([lat, lon], {
    radius: 4.5,
    color: '#FFFFFF',
    fillColor: '#FF6B45',
    fillOpacity: 1,
    weight: 1.5,
    interactive: false,
    className: 'radar-focus-svg-core'
  }).addTo(MAP);

  let m = null;
  if (targetId !== null && targetId !== undefined) {
    if (S.topMarkerMap && (S.topMarkerMap.has(targetId) || S.topMarkerMap.has(Number(targetId)) || S.topMarkerMap.has(String(targetId)))) {
      m = S.topMarkerMap.get(targetId) || S.topMarkerMap.get(Number(targetId)) || S.topMarkerMap.get(String(targetId));
    } else if (S.markerMap && (S.markerMap.has(targetId) || S.markerMap.has(Number(targetId)) || S.markerMap.has(String(targetId)))) {
      m = S.markerMap.get(targetId) || S.markerMap.get(Number(targetId)) || S.markerMap.get(String(targetId));
    }
  }

  if (m) {
    if (typeof m.setZIndexOffset === 'function') {
      m.setZIndexOffset(60000);
    }
    m.openTooltip();
    if (typeof m.getElement === 'function') {
      const elDom = m.getElement();
      if (elDom) {
        elDom.classList.add('is-active-focus-pin');
      }
    }
    S.activeFocusMarker = m;
  }

  S.beaconCleanTimer = setTimeout(() => {
    clearFocusHighlight();
  }, 30000);
}

async function searchMap() {
  const q = document.getElementById('mapSearchInput').value.trim();
  if (!q) return;
  if (q.includes(',')) {
    const [la, lo] = q.split(',').map(Number);
    if (!isNaN(la) && !isNaN(lo)) {
      highlightVesselMarker(null, la, lo);
      return;
    }
  }
  const targetId = parseInt(q.replace('#', ''), 10);
  if (!isNaN(targetId)) {
    if (S.det && S.det.rows) {
      const C = S.det.columns, ix = k => C.indexOf(k);
      const [iId, iLa, iLo, iLen, iCat, iAis, iFs, iMs, iFlag, iVv, iVh, iSnr, iMpa, iEez, iPort, iHour] =
        ['row_id', 'lat', 'lon', 'length_m', 'cat', 'ais', 'fscore', 'mscore', 'flag', 'vv', 'vh', 'snr', 'mpa', 'eez', 'port', 'hour'].map(ix);
      const row = S.det.rows.find(r => r[iId] === targetId);
      if (row) {
        highlightVesselMarker(row[iId], row[iLa], row[iLo]);
        showDetail({
          id: row[iId], lat: row[iLa], lon: row[iLo], len: row[iLen],
          cat: (row[iAis] === 0 ? 'unmatched' : (CAT[row[iCat]] ? row[iCat] : 'other')),
          rawCat: row[iCat], ais: row[iAis], fs: row[iFs], ms: row[iMs], flag: row[iFlag],
          vv: row[iVv], vh: row[iVh], snr: row[iSnr], mpa: row[iMpa], eez: row[iEez],
          port: row[iPort], hour: row[iHour]
        });
        return;
      }
    }
    const topMatch = S.top10.find(t => t.row_id === targetId || t.id === targetId);
    if (topMatch) {
      const passIdx = S.passes.findIndex(p => p.id === topMatch.pass);
      if (passIdx >= 0) {
        await selectPass(passIdx);
        highlightVesselMarker(topMatch.row_id, topMatch.lat, topMatch.lon);
        showDetail({
          id: topMatch.row_id, lat: topMatch.lat, lon: topMatch.lon, len: topMatch.length_m,
          cat: topMatch.cat, rawCat: topMatch.cat, ais: topMatch.ais, fs: topMatch.fishing_score,
          ms: topMatch.matching_score, flag: topMatch.flag, vv: topMatch.vv, vh: topMatch.vh,
          snr: topMatch.snr, mpa: topMatch.mpa, eez: topMatch.eez, port: topMatch.port,
          hour: topMatch.hour
        });
        return;
      }
    }
    alert(`Deteksi #${targetId} tidak ditemukan pada siklus ini atau daftar prioritas.`);
  }
}

function fillJumpPass(year) {
  const jumpPassEl = document.getElementById('jumpPass');
  if (!jumpPassEl) return;
  jumpPassEl.innerHTML = S.passes
    .map((p, i) => ({ p, i })).filter(o => o.p.year === year)
    .map(o => `<option value="${o.i}">${fmtDate(o.p.id)} · ${o.p.n} deteksi</option>`).join('');
}

let selectPassSeq = 0;

async function selectPass(i) {
  if (i < 0 || i >= S.passes.length) return;
  const currentSeq = ++selectPassSeq;
  S.passIdx = i;
  const p = S.passes[i];

  
  clearFocusHighlight();

  
  const detailBox = document.getElementById('railDetail');
  if (detailBox) {
    detailBox.innerHTML = `
      <div class="rail-head">
        <span class="rail-head-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          Detail deteksi
        </span>
      </div>
      <p class="rail-empty">Klik salah satu titik kapal di peta untuk melihat detail spesifikasi radar & risiko.</p>`;
  }

  const slider = document.getElementById('passSlider');
  if (slider && slider.value !== String(i)) slider.value = i;

  const seqEl = document.getElementById('passSeq');
  if (seqEl) seqEl.textContent = `PASS ${String(p.seq || i + 1).padStart(3, '0')} / ${S.passes.length}`;
  const dateEl = document.getElementById('passDate');
  if (dateEl) dateEl.textContent = fmtDate(p.id);
  const detCount = (p.n !== undefined && p.n !== null) ? Number(p.n) : (p.total_detections ? Number(p.total_detections) : (p.n_dark || 0));
  const subEl = document.getElementById('passSub');
  if (subEl) subEl.textContent = `${p.time} UTC · ${detCount} deteksi · ${p.n_dark || 0} tanpa AIS`;

  const warnContainer = document.getElementById('passWarningContainer');
  if (warnContainer) {
    if (detCount < 50) {
      warnContainer.innerHTML = `
        <div class="pass-warning-badge" id="passWarningBadge" tabindex="0" onmouseleave="this.blur()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFB347" stroke-width="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span>Cakupan Sempit</span>
          <div class="pass-warning-tooltip">
            <strong><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFB347" stroke-width="2.2" style="display:inline-block;vertical-align:-1px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Cakupan Satelit Terbatas</strong>
            <p>Pada perlintasan tanggal ini, cakupan wilayah pencitraan radar satelit Sentinel-1 relatif sempit di area WPP 711, sehingga total kapal yang terdeteksi (${detCount} kapal) lebih sedikit dibandingkan perlintasan normal.</p>
          </div>
        </div>
      `;
    } else {
      warnContainer.innerHTML = '';
    }
  }

  const jumpYearEl = document.getElementById('jumpYear');
  if (jumpYearEl && jumpYearEl.value !== String(p.year)) {
    jumpYearEl.value = p.year;
    fillJumpPass(p.year);
  }
  const jumpPassEl = document.getElementById('jumpPass');
  if (jumpPassEl && jumpPassEl.value !== String(i)) jumpPassEl.value = i;

  
  const box = document.getElementById('timelineSparkline');
  if (box) {
    const prevBar = box.querySelector('.sparkline-bar.is-active');
    if (prevBar) prevBar.classList.remove('is-active');
    const newBar = box.querySelector(`[data-pass-idx="${i}"]`);
    if (newBar) {
      newBar.classList.add('is-active');
      if (box.offsetWidth > 0) {
        box.scrollLeft = newBar.offsetLeft - (box.offsetWidth / 2) + (newBar.offsetWidth / 2);
      }
    }
  }

  
  drawTop10ForPass(p.id);
  renderTopStrip(p.id);

  const selOp = document.getElementById('opCycle');
  if (selOp) {
    if (selOp.value !== p.id) selOp.value = p.id;
    const tierBtn = document.querySelector('#opTierFilter .is-on');
    if (tierBtn) drawOpList(p.id, tierBtn.dataset.tier, document.getElementById('opConformal').checked);
  }
  if (typeof highlightSiaga1ChartBar === 'function') highlightSiaga1ChartBar(p.id);

  
  const mapEl = document.getElementById('map');
  const mapLoading = document.getElementById('mapLoadingOverlay');
  const mapBadge = document.getElementById('mapBadge');
  if (mapBadge) mapBadge.textContent = 'memuat deteksi radar…';

  const isCached = S.detCache && S.detCache.has(p.id);
  if (!isCached) {
    if (mapEl) mapEl.classList.add('is-loading');
    if (mapLoading) mapLoading.classList.add('is-active');
  }

  const detData = await loadDetectionsForPass(p.id);
  if (currentSeq !== selectPassSeq) return;

  S.det = detData;
  drawDetections();

  if (mapEl) mapEl.classList.remove('is-loading');
  if (mapLoading) mapLoading.classList.remove('is-active');
}

const PIN_ICON_CACHE = {};
function getCachedPinIcon(key, col, shapeSVG) {
  if (!PIN_ICON_CACHE[key]) {
    PIN_ICON_CACHE[key] = L.divIcon({
      className: 'vessel-pin-badge-wrap',
      html: `
        <div class="vessel-pin-badge" style="--v-col: ${col};">
          <div class="v-pin-icon" style="border-color:${col};color:${col};background:#0B1E2D">
            ${shapeSVG}
          </div>
        </div>
      `,
      iconSize: [24, 28],
      iconAnchor: [12, 28]
    });
  }
  return PIN_ICON_CACHE[key];
}

function drawDetections() {
  if (!LAYER_DET) return;
  LAYER_DET.clearLayers();
  S.markerMap = new Map();
  if (!S.det || !MAP || !S.det.rows) return;

  const C = S.det.columns, ix = k => C.indexOf(k);
  const [iId, iLa, iLo, iLen, iCat, iAis, iFs, iMs, iFlag, iVv, iVh, iSnr, iMpa, iEez, iPort, iHour] =
    ['row_id', 'lat', 'lon', 'length_m', 'cat', 'ais', 'fscore', 'mscore', 'flag', 'vv', 'vh', 'snr', 'mpa', 'eez', 'port', 'hour'].map(ix);

  const counts = {};
  let shown = 0;
  const bounds = [];
  const markers = [];
  const rows = S.det.rows;
  const numRows = rows.length;

  for (let idx = 0; idx < numRows; idx++) {
    const r = rows[idx];
    const key = (r[iAis] === 0) ? 'unmatched' : (CAT[r[iCat]] ? r[iCat] : 'other');
    counts[key] = (counts[key] || 0) + 1;

    if (S.catsOff && S.catsOff.has(key)) continue;
    if (S.filters && S.filters.minLen && r[iLen] < S.filters.minLen) continue;
    if (S.filters && S.filters.minFish && r[iFs] < S.filters.minFish) continue;
    if (S.filters && S.filters.zone === 'eez50' && r[iEez] > 50) continue;
    if (S.filters && S.filters.zone === 'mpa30' && r[iMpa] > 30) continue;

    shown++;
    bounds.push([r[iLa], r[iLo]]);

    const col = (r[iAis] === 0) ? '#FF6B45' : (CAT[r[iCat]] ? CAT[r[iCat]].c : '#8FA6B4');
    const shapeSVG = CAT_ICONS[key] || CAT_ICONS.other;
    const icon = getCachedPinIcon(key, col, shapeSVG);

    const marker = L.marker([r[iLa], r[iLo]], { icon: icon, riseOnHover: true })
      .bindTooltip(() => `
        <div class="v-tip-head">
          <span class="v-tip-id">Deteksi #${r[iId]}</span>
          <span class="v-tip-cat" style="color:${col}">${catOf(key).label}</span>
        </div>
        <div class="v-tip-body">
          <span>Koordinat: <b style="color:var(--foam);font-family:var(--f-mono)">${coord(r[iLa], r[iLo])}</b></span>
          <span>Waktu UTC: <b>${r[iHour]}</b></span>
          <span>Panjang Kapal: <b>${N(r[iLen], 1)} m</b></span>
          <span>Radar VV/VH: <b>${N(r[iVv], 1)} / ${N(r[iVh], 1)} dB</b></span>
          <span>Kesesuaian Sinyal: <b style="color:${r[iAis] ? '#4ADE80' : '#FF6B45'}">${r[iAis] ? 'AIS Cocok' : 'Tanpa Sinyal AIS'}</b></span>
        </div>
      `, { direction: 'top', offset: [0, -22], opacity: 1, className: 'vessel-pin-tooltip-popup' })
      .on('click', () => {
        highlightVesselMarker(r[iId], r[iLa], r[iLo]);
        showDetail({
          id: r[iId], lat: r[iLa], lon: r[iLo], len: r[iLen], cat: key, rawCat: r[iCat],
          ais: r[iAis], fs: r[iFs], ms: r[iMs], flag: r[iFlag], vv: r[iVv], vh: r[iVh],
          snr: r[iSnr], mpa: r[iMpa], eez: r[iEez], port: r[iPort], hour: r[iHour]
        });
      });

    marker._origZIndex = 1000;
    S.markerMap.set(r[iId], marker);
    markers.push(marker);
  }

  if (markers.length > 0) {
    const group = L.featureGroup(markers);
    group.addTo(LAYER_DET);
  }

  if (S.isFirstMapLoad && shown > 0 && bounds.length > 0 && MAP) {
    S.isFirstMapLoad = false;
    MAP.fitBounds(bounds, {
      padding: [80, 80],
      maxZoom: 7.2,
      animate: false
    });
  }

  Object.keys(CAT).forEach(k => {
    const n = document.querySelector(`[data-cnt="${k}"]`);
    if (n) n.textContent = counts[k] ? counts[k].toLocaleString('id-ID') : '0';
  });

  const mapBadge = document.getElementById('mapBadge');
  if (mapBadge) {
    mapBadge.textContent = `${shown.toLocaleString('id-ID')} dari ${S.det.rows.length.toLocaleString('id-ID')} deteksi ditampilkan`;
  }
}

function showDetail(v) {
  const c = catOf(v.cat);
  const pctVV = Math.min(100, Math.max(5, ((v.vv + 30) / 40) * 100));
  const pctVH = Math.min(100, Math.max(5, ((v.vh + 30) / 40) * 100));
  const pctSNR = Math.min(100, Math.max(5, (v.snr / 40) * 100));
  const estRCS = Math.round(Math.pow(10, (v.vv + 35) / 15) * 2.2);

  const detailBox = document.getElementById('railDetail');
  if (!detailBox) return;

  const topMatch = S.top10.find(t => t.row_id === v.id || t.id === v.id);
  const rawScore = topMatch ? topMatch.score : (v.raw_risk_score !== undefined ? v.raw_risk_score : null);

  detailBox.innerHTML = `
    <div class="rail-head">
      <span class="rail-head-title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        Detail deteksi
      </span>
    </div>
    <p class="det-title">Deteksi #${v.id}</p>
    <span class="det-chip" style="background:${c.c}22;color:${c.c}">${c.label}</span>
    <dl class="kv">
      <dt>Koordinat</dt><dd>${coord(v.lat, v.lon)}</dd>
      <dt>Waktu</dt><dd>${v.hour} UTC</dd>
      <dt>Panjang</dt><dd>${N(v.len, 1)} m</dd>
      ${rawScore !== null ? `<dt>Skor risiko (raw)</dt><dd style="color:var(--flare);font-weight:700">${N(rawScore, 5)}</dd>` : ''}
      <dt>Status AIS</dt><dd>${v.ais ? 'Cocok' : 'Tidak cocok'}</dd>
      <dt>Bendera</dt><dd>${v.flag || '—'}</dd>
      <dt>Skor cocok</dt><dd>${N(v.ms, 3)}</dd>
      <dt>Skor ikan</dt><dd>${N(v.fs, 3)}</dd>
      <dt>VV / VH</dt><dd>${N(v.vv, 1)} / ${N(v.vh, 1)} dB</dd>
      <dt>Estimasi RCS</dt><dd>${estRCS.toLocaleString('id-ID')} m²</dd>
      <dt>SNR</dt><dd>${N(v.snr, 1)} dB</dd>
      <dt>Jarak MPA</dt><dd>${N(v.mpa, 1)} km</dd>
      <dt>Jarak ZEE</dt><dd>${N(v.eez, 1)} km</dd>
      <dt>Jarak pelabuhan</dt><dd>${N(v.port, 1)} km</dd>
    </dl>

    <div class="radar-profile">
      <h5>Profil Spektrogram Radar SAR</h5>
      <div class="radar-gauge-row">
        <span>Intensitas VV</span>
        <div class="radar-gauge-track"><div class="radar-gauge-fill" style="width:${pctVV}%"></div></div>
        <span>${N(v.vv, 1)} dB</span>
      </div>
      <div class="radar-gauge-row">
        <span>Intensitas VH</span>
        <div class="radar-gauge-track"><div class="radar-gauge-fill" style="width:${pctVH}%;background:var(--amber)"></div></div>
        <span>${N(v.vh, 1)} dB</span>
      </div>
      <div class="radar-gauge-row">
        <span>Signal SNR</span>
        <div class="radar-gauge-track"><div class="radar-gauge-fill" style="width:${pctSNR}%;background:var(--kelp)"></div></div>
        <span>${N(v.snr, 1)} dB</span>
      </div>
    </div>`;
}

function buildFishingLayer() {
  if (!LAYER_FISH) return;
  LAYER_FISH.clearLayers();
  if (!S.grid || !MAP || !S.grid.rows) return;
  const cs = S.grid.cell_size || .25;
  S.grid.rows.forEach(([la, lo, fs]) => {
    const col = fs > .7 ? '#0E7C6B' : fs >= .3 ? '#3FA796' : '#1B4B57';
    L.rectangle([[la, lo], [la + cs, lo + cs]], {
      color: col, weight: 0, fillColor: col, fillOpacity: fs > .7 ? .42 : fs >= .3 ? .26 : .12
    }).bindPopup(`<b>Potensi lokasi ikan</b><br>skor rata-rata ${N(fs, 3)}`).addTo(LAYER_FISH);
  });
}

function buildSeizureLayer() {
  if (!LAYER_SEIZ) return;
  LAYER_SEIZ.clearLayers();
  if (!S.seizures || !MAP) return;
  const seizSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

  S.seizures.forEach(s => {
    const col = s.matched ? '#FF6B45' : '#1477B8';
    const seizIcon = L.divIcon({
      className: 'vessel-pin-badge-wrap',
      html: `
        <div class="vessel-pin-badge" style="--v-col: ${col};">
          <div class="v-pin-icon" style="border-color:${col};color:${col};background:#0B1E2D">
            ${seizSVG}
          </div>
          <div class="v-pin-tooltip">
            <div class="v-tip-head">
              <span class="v-tip-id">Penindakan Patroli</span>
              <span class="v-tip-cat" style="color:${col}">${fmtDate(s.date)}</span>
            </div>
            <div class="v-tip-body">
              <span>Koordinat: <b style="color:var(--foam);font-family:var(--f-mono)">${coord(s.lat, s.lon)}</b></span>
              <span>Bendera: <b>${s.flag}</b></span>
              <span>Jenis: <b>${s.type}</b></span>
              ${s.gt ? `<span>Bobot: <b>GT ${N(s.gt, 0)}</b></span>` : ''}
              <span>Radar SAR: <b style="color:${s.matched ? '#4ADE80' : '#FF6B45'}">${s.matched ? 'Tercocokkan' : 'Tanpa AIS'}</b></span>
            </div>
          </div>
        </div>
      `,
      iconSize: [24, 28],
      iconAnchor: [12, 28]
    });

    L.marker([s.lat, s.lon], { icon: seizIcon, riseOnHover: true, zIndexOffset: 1500 })
      .on('click', () => MAP.setView([s.lat, s.lon], 9))
      .addTo(LAYER_SEIZ);
  });
}

function drawTop10ForPass(passId) {
  if (!LAYER_TOP) return;
  LAYER_TOP.clearLayers();
  S.topMarkerMap = new Map();
  if (!MAP) return;

  const items = S.top10.filter(t => t.pass === passId).sort((a, b) => b.rank - a.rank);

  items.forEach(t => {
    const col = t.rank <= 3 ? '#FF6B45' : t.rank <= 6 ? '#FFB347' : '#66D9E8';
    const topIcon = L.divIcon({
      className: 'vessel-pin-badge-wrap',
      html: `
        <div class="vessel-pin-badge" style="--v-col: ${col}; width:28px; height:34px;">
          <div class="v-pin-icon" style="width:28px;height:28px;border-color:${col};color:${col};background:#071B2A;font-family:var(--f-mono);font-weight:800;font-size:12.5px;box-shadow:0 2px 6px rgba(0,0,0,0.5)">
            ${t.rank}
          </div>
        </div>
      `,
      iconSize: [28, 34],
      iconAnchor: [14, 34]
    });

    const tipHtml = `
      <div class="v-tip-head">
        <span class="v-tip-id">Prioritas #${t.rank}</span>
        <span class="v-tip-cat" style="color:${col}">${t.tier || 'Siaga Patroli'}</span>
      </div>
      <div class="v-tip-body">
        <span>ID Deteksi: <b>#${t.row_id || t.id}</b></span>
        <span>Koordinat: <b style="color:var(--foam);font-family:var(--f-mono)">${coord(t.lat, t.lon)}</b></span>
        <span>Skor Risiko: <b style="color:var(--flare);font-family:var(--f-mono)">${N(t.score, 5)}</b></span>
        <span>Tingkat Risiko: <b>${t.tier || 'Siaga'}</b></span>
        <span>Panjang Kapal: <b>${N(t.length_m, 1)} m</b></span>
        <span>Radar VV/VH: <b>${N(t.vv, 1)} / ${N(t.vh, 1)} dB</b></span>
        <span>Jaminan Conformal: <b style="color:${t.conformal ? '#4ADE80' : '#8FA6B4'}">${t.conformal ? 'Lolos (90%)' : 'Standar'}</b></span>
      </div>
    `;

    const zOffset = 7000 + (11 - t.rank) * 100;

    const marker = L.marker([t.lat, t.lon], { icon: topIcon, riseOnHover: true, zIndexOffset: zOffset })
      .bindTooltip(tipHtml, { direction: 'top', offset: [0, -26], opacity: 1, className: 'vessel-pin-tooltip-popup' })
      .on('click', () => {
        highlightVesselMarker(t.row_id || t.id, t.lat, t.lon);
        showDetail({
          id: t.row_id || t.id,
          lat: t.lat,
          lon: t.lon,
          len: t.length_m,
          cat: t.cat || (t.is_dark ? 'unmatched' : 'other'),
          rawCat: t.cat || 'unmatched',
          ais: t.ais !== undefined ? t.ais : (t.is_dark ? 0 : 1),
          fs: t.fishing_score || t.fishing_score_new || 0,
          ms: 0,
          flag: t.flag || 'UNKNOWN',
          vv: t.vv || 0,
          vh: t.vh || 0,
          snr: t.snr || 0,
          mpa: t.mpa || 0,
          eez: t.eez || 0,
          port: t.port || 0,
          hour: t.hour || (t.ts ? String(t.ts).slice(11, 16) : '00:00'),
          raw_risk_score: t.score
        });
      })
      .addTo(LAYER_TOP);

    marker._origZIndex = zOffset;

    const rowKey = t.row_id !== undefined ? t.row_id : t.id;
    if (rowKey !== undefined && rowKey !== null) {
      S.topMarkerMap.set(rowKey, marker);
      S.topMarkerMap.set(Number(rowKey), marker);
      S.topMarkerMap.set(String(rowKey), marker);
    }
  });
}

function renderTopStrip(passId) {
  const items = S.top10.filter(t => t.pass === passId).sort((a, b) => a.rank - b.rank);
  const cycleLabelEl = document.getElementById('topCycleLabel');
  if (cycleLabelEl) cycleLabelEl.textContent = fmtDate(passId);

  const box = document.getElementById('topStrip');
  if (!box) return;

  if (!items.length) {
    box.innerHTML = `<p class="rail-empty" style="color:var(--ink-2)">
      Siklus ini di luar rentang prioritas operasional terhitung.</p>`;
    renderDashExtraPanels(passId);
    return;
  }

  box.innerHTML = items.map(t => {
    const isP = isSiagaPrioritas(t);
    const chipClass = getTierChipClass(t.status_siaga || t.tier);
    return `
    <div class="top-card ${isP ? 'is-p70-card is-prioritas' : ''}" data-goto="${t.lat},${t.lon}" data-rowid="${t.row_id}">
      <div class="rank">PRIORITAS ${String(t.rank).padStart(2, '0')}</div>
      <div class="score ${isP ? 'is-p70-score' : ''}">${N(t.score, 5)}</div>
      <div class="coord">${coord(t.lat, t.lon)}</div>
      <div class="chip-row">
        <span class="tier-chip ${chipClass}">${t.status_siaga || t.tier}</span>
        ${t.conformal ? '<span class="tier-chip t-conformal">CONFORMAL 90%</span>' : ''}
      </div>
    </div>`;
  }).join('');

  box.querySelectorAll('[data-goto]').forEach(c => c.onclick = () => {
    const [la, lo] = c.dataset.goto.split(',').map(Number);
    const rId = c.dataset.rowid ? parseInt(c.dataset.rowid, 10) : null;
    document.getElementById('layTop10').checked = true;
    LAYER_TOP.addTo(MAP);
    highlightVesselMarker(rId, la, lo);
    const topItem = S.top10.find(t => (t.row_id === rId || t.id === rId) && t.pass === passId) || S.top10.find(t => t.row_id === rId || t.id === rId);
    if (topItem) {
      showDetail({
        id: topItem.row_id || topItem.id,
        lat: topItem.lat,
        lon: topItem.lon,
        len: topItem.length_m,
        cat: topItem.cat || (topItem.is_dark ? 'unmatched' : 'other'),
        rawCat: topItem.cat || 'unmatched',
        ais: topItem.ais !== undefined ? topItem.ais : (topItem.is_dark ? 0 : 1),
        fs: topItem.fishing_score || topItem.fishing_score_new || 0,
        ms: 0,
        flag: topItem.flag || 'UNKNOWN',
        vv: topItem.vv || 0,
        vh: topItem.vh || 0,
        snr: topItem.snr || 0,
        mpa: topItem.mpa || 0,
        eez: topItem.eez || 0,
        port: topItem.port || 0,
        hour: topItem.hour || (topItem.ts ? String(topItem.ts).slice(11, 16) : '00:00'),
        raw_risk_score: topItem.score
      });
    }
    document.querySelector('.map-wrap').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  renderDashExtraPanels(passId);
}

function renderDashExtraPanels(passId) {
  const items = S.top10.filter(t => t.pass === passId).sort((a, b) => a.rank - b.rank);
  const elSummary = document.getElementById('dashExtraSummary');
  const elMatrix = document.getElementById('dashRiskMatrix');
  const elTable = document.getElementById('dashTablePanel');

  if (!items.length) {
    if (elSummary) elSummary.innerHTML = '';
    if (elMatrix) elMatrix.innerHTML = '';
    if (elTable) elTable.innerHTML = '';
    return;
  }

  const avgScore = items.reduce((a, b) => a + b.score, 0) / items.length;
  const threatLabel = avgScore >= 0.015 ? 'SIAGA TINGGI' : avgScore >= 0.008 ? 'SIAGA SEDANG' : 'SIAGA NORMAL';
  const s1Count = items.filter(t => tierNum(t.tier) === 1).length;
  const s2Count = items.filter(t => tierNum(t.tier) === 2).length;
  const s3Count = items.filter(t => tierNum(t.tier) === 3).length;
  const confCount = items.filter(t => t.conformal === 1).length;
  const avgLen = items.reduce((a, b) => a + (b.length_m || 0), 0) / items.length;
  const meanLat = items.reduce((a, b) => a + b.lat, 0) / items.length;
  const meanLon = items.reduce((a, b) => a + b.lon, 0) / items.length;

  if (elSummary) {
    elSummary.innerHTML = `
      <div class="dash-summary-grid">
        <div class="dash-summary-item"><b>${threatLabel}</b><span>Status Ancaman Siklus</span></div>
        <div class="dash-summary-item"><b>${s1Count} S1 · ${s2Count} S2 · ${s3Count} S3</b><span>Komposisi Siaga</span></div>
        <div class="dash-summary-item"><b>${confCount} / 10 Kapal</b><span>Sertifikasi Conformal 90%</span></div>
        <div class="dash-summary-item"><b>${N(avgLen, 1)} m</b><span>Rata-Rata Panjang Kapal</span></div>
        <div class="dash-summary-item"><b>${coord(meanLat, meanLon)}</b><span>Pusat Klaster Ancaman (Centroid)</span></div>
      </div>`;
  }

  const eezCount = items.filter(t => (t.eez || 999) <= 50).length;
  const mpaCount = items.filter(t => (t.mpa || 999) <= 30).length;
  const fishCount = items.filter(t => (t.fishing_score || t.fscore || 0) >= 0.4).length;
  const darkCount = items.filter(t => t.is_dark === 1 || t.ais === 0).length;

  if (elMatrix) {
    elMatrix.innerHTML = `
      <div class="dash-matrix-box">
        <h4>Matriks Analisis Indikator Risiko Siklus</h4>
        <div class="dash-matrix-grid">
          <div class="dash-matrix-card">
            <h5>Kedekatan Garis ZEE</h5>
            <p>${eezCount} dari 10 kapal prioritas berjarak kurang dari 50 km dari garis batas ZEE Indonesia.</p>
            <div class="dash-matrix-bar"><div class="dash-matrix-fill" style="width:${eezCount * 10}%"></div></div>
          </div>
          <div class="dash-matrix-card">
            <h5>Zona Perikanan Aktif</h5>
            <p>${fishCount} dari 10 kapal terdeteksi di area berpotensi ikan tinggi (Skor Aktivitas ≥ 0.4).</p>
            <div class="dash-matrix-bar"><div class="dash-matrix-fill" style="width:${fishCount * 10}%;background:var(--amber)"></div></div>
          </div>
          <div class="dash-matrix-card">
            <h5>Potensi Kawasan Konservasi</h5>
            <p>${mpaCount} dari 10 kapal terdeteksi dalam jangkauan 30 km dari Kawasan Konservasi Perairan (MPA).</p>
            <div class="dash-matrix-bar"><div class="dash-matrix-fill" style="width:${mpaCount * 10}%;background:var(--kelp)"></div></div>
          </div>
          <div class="dash-matrix-card">
            <h5>Kapal Tanpa AIS</h5>
            <p>${darkCount} dari 10 kapal prioritas merupakan kapal yang tidak memancarkan sinyal AIS resmi.</p>
            <div class="dash-matrix-bar"><div class="dash-matrix-fill" style="width:${darkCount * 10}%;background:var(--flare)"></div></div>
          </div>
        </div>
      </div>`;
  }

  if (elTable) {
    const rowsHtml = items.map(t => {
      const chipClass = getTierChipClass(t.tier);
      return `
      <tr>
        <td><b>PRIORITAS ${String(t.rank).padStart(2, '0')}</b></td>
        <td>#${t.row_id}</td>
        <td><span class="tier-chip ${chipClass}">${t.tier}</span> ${t.conformal ? '<span class="tier-chip t-conformal">CONFORMAL</span>' : ''}</td>
        <td>${coord(t.lat, t.lon)}</td>
        <td><b>${N(t.score, 5)}</b></td>
        <td>${N(t.length_m, 1)} m</td>
        <td>${N(t.fishing_score, 3)}</td>
        <td>${N(t.eez, 1)} km</td>
        <td>${N(t.mpa, 1)} km</td>
        <td>${N(t.port, 1)} km</td>
        <td><button class="btn btn-sm" data-goto="${t.lat},${t.lon}">Fokus Peta</button></td>
      </tr>`;
    }).join('');

    elTable.innerHTML = `
      <div class="panel" style="margin-top:0">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
          <h3 style="margin:0">Tabel Komparasi Operasional Kapal Prioritas</h3>
          <span class="mono" style="font-size:12.5px;color:var(--ink-2)">Sepuluh Target Utama Siklus Ini</span>
        </div>
        <div class="table-scroll">
          <table class="tbl">
            <thead>
              <tr>
                <th>Target</th>
                <th>ID Deteksi</th>
                <th>Status Siaga</th>
                <th>Koordinat</th>
                <th>Skor Risiko</th>
                <th>Panjang</th>
                <th>Skor Ikan</th>
                <th>Jarak ZEE</th>
                <th>Jarak MPA</th>
                <th>Jarak Pelabuhan</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>`;

    elTable.querySelectorAll('[data-goto]').forEach(c => c.onclick = () => {
      const [la, lo] = c.dataset.goto.split(',').map(Number);
      const rId = c.dataset.rowid ? parseInt(c.dataset.rowid, 10) : null;
      document.getElementById('layTop10').checked = true;
      LAYER_TOP.addTo(MAP);
      highlightVesselMarker(rId, la, lo);
      const topItem = S.top10.find(t => (t.row_id === rId || t.id === rId) && t.pass === passId) || S.top10.find(t => t.row_id === rId || t.id === rId);
      if (topItem) {
        showDetail({
          id: topItem.row_id || topItem.id,
          lat: topItem.lat,
          lon: topItem.lon,
          len: topItem.length_m,
          cat: topItem.cat || (topItem.is_dark ? 'unmatched' : 'other'),
          rawCat: topItem.cat || 'unmatched',
          ais: topItem.ais !== undefined ? topItem.ais : (topItem.is_dark ? 0 : 1),
          fs: topItem.fishing_score || topItem.fishing_score_new || 0,
          ms: 0,
          flag: topItem.flag || 'UNKNOWN',
          vv: topItem.vv || 0,
          vh: topItem.vh || 0,
          snr: topItem.snr || 0,
          mpa: topItem.mpa || 0,
          eez: topItem.eez || 0,
          port: topItem.port || 0,
          hour: topItem.hour || (topItem.ts ? String(topItem.ts).slice(11, 16) : '00:00'),
          raw_risk_score: topItem.score
        });
      }
      document.querySelector('.map-wrap').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }
}


function renderOperasi() {
  const cycles = [...new Set(S.top10.map(t => t.pass))].sort((a, b) => b.localeCompare(a));
  const sel = document.getElementById('opCycle');
  if (!sel) return;
  sel.innerHTML = cycles.map(c => `<option value="${c}">${fmtDate(c)}</option>`).join('');

  renderSiaga1BarChart();

  const draw = () => {
    const tierBtn = document.querySelector('#opTierFilter .is-on');
    const tierVal = tierBtn ? tierBtn.dataset.tier : 'all';
    drawOpList(sel.value, tierVal, document.getElementById('opConformal').checked);
    highlightSiaga1ChartBar(sel.value);
  };

  sel.onchange = () => {
    const pIdx = S.passes.findIndex(p => p.id === sel.value);
    if (pIdx >= 0 && pIdx !== S.passIdx) {
      selectPass(pIdx);
    } else {
      draw();
    }
  };

  const chkConf = document.getElementById('opConformal');
  if (chkConf) chkConf.onchange = draw;

  document.querySelectorAll('#opTierFilter .seg-btn').forEach(b => b.onclick = () => {
    document.querySelectorAll('#opTierFilter .seg-btn').forEach(x => x.classList.remove('is-on'));
    b.classList.add('is-on');
    draw();
  });

  const btnExpGeo = document.getElementById('opExportGeoJSON');
  if (btnExpGeo) btnExpGeo.onclick = () => exportPassData(sel.value, 'geojson');
  const btnExpCsv = document.getElementById('opExportCSV');
  if (btnExpCsv) btnExpCsv.onclick = () => exportPassData(sel.value, 'csv');

  if (cycles.length) draw();
  else {
    const opList = document.getElementById('opList');
    if (opList) opList.innerHTML = '<p class="loading">Data prioritas belum tersedia.</p>';
  }
}

function showGlobalBarTooltip(e, html) {
  const tip = document.getElementById('globalBarTooltip');
  if (!tip) return;
  tip.innerHTML = html;
  const rect = e.currentTarget.getBoundingClientRect();
  tip.style.left = `${rect.left + rect.width / 2}px`;
  tip.style.top = `${rect.top}px`;
  tip.classList.add('is-active');
}

function hideGlobalBarTooltip() {
  const tip = document.getElementById('globalBarTooltip');
  if (tip) tip.classList.remove('is-active');
}


function renderSiaga1BarChart() {
  const chartBox = document.getElementById('opSiaga1BarChart');
  if (!chartBox) return;

  const validPasses = S.passes.filter(p => S.top10.some(t => t.pass === p.id));
  if (!validPasses.length) {
    chartBox.innerHTML = '<span class="note">Distribusi tidak tersedia.</span>';
    return;
  }

  const passStats = validPasses.map(p => {
    const s1Items = S.top10.filter(t => t.pass === p.id && t.tier && (t.tier.includes('SIAGA 1') || t.tier.includes('Prioritas')));
    const hasPrioritas = s1Items.some(x => isSiagaPrioritas(x));
    const maxScore = s1Items.length ? Math.max(...s1Items.map(x => x.score)) : 0;
    return { pass: p, s1Count: s1Items.length, maxScore, hasPrioritas };
  });

  const overallMax = Math.max(...passStats.map(s => s.maxScore), 0.001);

  chartBox.innerHTML = passStats.map(s => {
    const heightPct = Math.min(100, Math.max(6, (s.maxScore / overallMax) * 100));
    const globalIdx = S.passes.findIndex(p => p.id === s.pass.id);
    const isP = s.hasPrioritas;
    return `
      <div class="op-bar-item ${isP ? 'is-p70 is-prioritas' : ''}" data-pass-id="${s.pass.id}" data-pass-idx="${globalIdx}" data-date="${fmtDate(s.pass.id)}" data-score="${N(s.maxScore, 4)}" data-prioritas="${isP}">
        <div class="op-bar-fill" style="height:${heightPct.toFixed(1)}%"></div>
      </div>
    `;
  }).join('');

  chartBox.querySelectorAll('.op-bar-item').forEach(item => {
    item.onclick = () => {
      const idx = +item.dataset.passIdx;
      if (idx >= 0) selectPass(idx);
    };
    item.onmouseenter = e => {
      const date = item.dataset.date;
      const score = item.dataset.score;
      const isP = item.dataset.prioritas === 'true';
      const html = `<div style="font-weight:700;color:#FFF;font-size:11px">${date}</div>
                    <div style="font-size:10.5px;color:rgba(238,245,249,0.85);margin-top:2px">Skor Siaga 1: <b style="color:${isP ? 'var(--flare)' : 'var(--sonar)'}">${score}</b> ${isP ? '<span style="color:var(--flare);font-weight:700">[SIAGA 1 PRIORITAS P90]</span>' : ''}</div>`;
      showGlobalBarTooltip(e, html);
    };
    item.onmouseleave = hideGlobalBarTooltip;
  });

  if (S.passes && S.passes[S.passIdx]) {
    highlightSiaga1ChartBar(S.passes[S.passIdx].id);
  }
}

function highlightSiaga1ChartBar(passId) {
  const chartBox = document.getElementById('opSiaga1BarChart');
  const labelActive = document.getElementById('opChartActiveLabel');
  if (!chartBox) return;

  let activeBar = null;
  chartBox.querySelectorAll('.op-bar-item').forEach(bar => {
    if (bar.dataset.passId === passId) {
      bar.classList.add('is-active');
      activeBar = bar;
    } else {
      bar.classList.remove('is-active');
    }
  });

  if (activeBar) {
    const doCenter = () => {
      const cWidth = chartBox.clientWidth;
      if (cWidth > 0) {
        const barLeft = activeBar.offsetLeft;
        const barWidth = activeBar.offsetWidth;
        const targetLeft = barLeft - (cWidth / 2) + (barWidth / 2);
        chartBox.scrollLeft = Math.max(0, targetLeft);
      }
    };
    doCenter();
    requestAnimationFrame(doCenter);
  }

  if (labelActive) {
    const s1Items = S.top10.filter(t => t.pass === passId && t.tier && (t.tier.includes('SIAGA 1') || t.tier.includes('VERIFIKASI') || t.tier.includes('Prioritas')));
    const maxScore = s1Items.length ? Math.max(...s1Items.map(x => x.score)) : 0;
    labelActive.textContent = `${fmtDate(passId)} · Skor Siaga 1: ${N(maxScore, 4)}`;
  }
}

function drawOpList(pass, tier, onlyConf) {
  let items = S.top10.filter(t => t.pass === pass);
  if (tier !== 'all') {
    items = items.filter(t => tierNum(t.tier) === +tier);
  }
  if (onlyConf) {
    items = items.filter(t => t.conformal === 1);
  }
  items.sort((a, b) => a.rank - b.rank);

  const box = document.getElementById('opList');
  if (!box) return;

  if (!items.length) {
    box.innerHTML = '<p class="loading">Tidak ada kapal yang cocok dengan filter ini.</p>';
    return;
  }

  box.innerHTML = items.map(t => {
    const shapHtml = (t.shap || []).map(s => {
      const m = s.match(/kontribusi ([+-][\d.]+)/);
      const val = m ? parseFloat(m[1]) : 0;
      const widthPct = Math.min(100, Math.max(6, (Math.abs(val) / 2.2) * 100));
      const col = val > 0 ? '#FF6B45' : '#1477B8';
      return `<div class="shap-row"><div>${s.split(' (')[0]}
        <div class="shap-bar"><i style="width:${widthPct.toFixed(1)}%;background:${col}"></i></div></div>
        <span class="mono" style="color:${col}">${val > 0 ? '+' : ''}${val.toFixed(4)}</span></div>`;
    }).join('');

    const isP = isSiagaPrioritas(t);
    const chipClass = getTierChipClass(t.status_siaga || t.tier);
    const timeDisplay = t.ts ? String(t.ts).slice(0, 16).replace('T', ' ') : `${t.pass} ${t.hour}`;

    return `<div class="op-item ${isP ? 'is-p70-item is-prioritas' : ''}" data-goto="${t.lat},${t.lon}" data-rowid="${t.row_id}" style="cursor:pointer" title="Klik untuk fokus target pada peta">
      <div class="op-rank ${isP ? 'is-p70-rank' : ''}">${String(t.rank).padStart(2, '0')}</div>
      <div class="op-main">
        <h4>Deteksi #${t.row_id} · ${catOf(t.ais === 0 ? 'unmatched' : t.cat).label}</h4>
        <div class="op-coord">${coord(t.lat, t.lon)} · ${timeDisplay} UTC
          · panjang ${N(t.length_m, 1)} m</div>
        <div class="chip-row">
          <span class="tier-chip ${chipClass}">${t.status_siaga || t.tier}</span>
          ${t.conformal ? '<span class="tier-chip t-conformal">LOLOS CONFORMAL 90%</span>' : ''}
        </div>
        <div class="shap-list">${shapHtml || '<span class="note">Penjelasan faktor risiko pohon ML tidak tersedia.</span>'}</div>
      </div>
      <div class="op-side">
        <div class="op-score ${isP ? 'is-p70-score' : ''}">${N(t.score, 5)}<small>SKOR RISIKO</small></div>
        <dl class="kv" style="margin-top:16px;color:var(--ink)">
          <dt style="color:var(--ink-2)">Skor ikan</dt><dd>${N(t.fishing_score, 3)}</dd>
          <dt style="color:var(--ink-2)">Jarak MPA</dt><dd>${N(t.mpa, 1)} km</dd>
          <dt style="color:var(--ink-2)">Jarak ZEE</dt><dd>${N(t.eez, 1)} km</dd>
          <dt style="color:var(--ink-2)">Jarak pelabuhan</dt><dd>${N(t.port, 1)} km</dd>
        </dl>
      </div>
    </div>`;
  }).join('');

  box.querySelectorAll('.op-item[data-goto]').forEach(c => c.onclick = () => {
    const [la, lo] = c.dataset.goto.split(',').map(Number);
    const rId = c.dataset.rowid ? parseInt(c.dataset.rowid, 10) : null;
    switchTab('dashboard');
    document.getElementById('layTop10').checked = true;
    LAYER_TOP.addTo(MAP);
    highlightVesselMarker(rId, la, lo);
    const topItem = S.top10.find(t => t.row_id === rId || t.id === rId);
    if (topItem) {
      showDetail({
        id: topItem.row_id || topItem.id,
        lat: topItem.lat,
        lon: topItem.lon,
        len: topItem.length_m,
        cat: topItem.cat || (topItem.is_dark ? 'unmatched' : 'other'),
        rawCat: topItem.cat || 'unmatched',
        ais: topItem.ais !== undefined ? topItem.ais : (topItem.is_dark ? 0 : 1),
        fs: topItem.fishing_score || topItem.fishing_score_new || 0,
        ms: 0,
        flag: topItem.flag || 'UNKNOWN',
        vv: topItem.vv || 0,
        vh: topItem.vh || 0,
        snr: topItem.snr || 0,
        mpa: topItem.mpa || 0,
        eez: topItem.eez || 0,
        port: topItem.port || 0,
        hour: topItem.hour || (topItem.ts ? String(topItem.ts).slice(11, 16) : '00:00'),
        raw_risk_score: topItem.score
      });
    }
  });
}


function renderStatistik() {
  const M = S.metrics || {};
  const p = (M.best_models_two_pipelines && M.best_models_two_pipelines.gfw_pipeline_best) || M.poseidon || null;
  const cmp = (M.all_models || M.comparison || M.baselines_oot2026 || []);
  const pos = p || cmp.find(r => (r.label || r.name || '').includes('GFW')) || cmp[0];
  const d = S.meta ? S.meta.data : null;
  const m = S.meta ? S.meta.model : null;

  const years = [...new Set(S.passes.map(x => x.year))].sort((a, b) => a - b);
  const yearRangeStr = years.length ? `${years[0]}–${years[years.length - 1]}` : '2023–2026';

  const lblPassCount = document.getElementById('lblPassCount');
  if (lblPassCount) lblPassCount.textContent = `${S.passes.length}`;
  const lblTimeSeriesYears = document.getElementById('lblTimeSeriesYears');
  if (lblTimeSeriesYears) lblTimeSeriesYears.textContent = yearRangeStr;

  const revisit = calculateRevisitStats();
  const lblRevisitYears = document.getElementById('lblRevisitYears');
  if (lblRevisitYears) lblRevisitYears.textContent = yearRangeStr;
  const lblRevisitPasses = document.getElementById('lblRevisitPasses');
  if (lblRevisitPasses) lblRevisitPasses.textContent = `${S.passes.length}`;
  const revisitMeanVal = document.getElementById('revisitMeanVal');
  if (revisitMeanVal) revisitMeanVal.textContent = revisit.mean.toFixed(2).replace('.', ',');
  const revisitMedianVal = document.getElementById('revisitMedianVal');
  if (revisitMedianVal) revisitMedianVal.textContent = revisit.median.toFixed(2).replace('.', ',');

  if (p || pos) {
    const targetObj = p || pos;
    const aucVal = (targetObj.auc_roc !== undefined ? targetObj.auc_roc : targetObj.auc) || 0;
    const auprcVal = targetObj.auprc !== undefined ? targetObj.auprc : 0;
    const basePi = (m && (m.class_prior_pi_gfw || m.class_prior_pi_gee || m.class_prior_pi)) ? (m.class_prior_pi_gfw || m.class_prior_pi_gee || m.class_prior_pi) : (d && d.total_detections_history ? (d.label_P / d.total_detections_history) : 0);
    const liftVal = (targetObj.lift && targetObj.lift > 0) ? targetObj.lift : (basePi > 0 ? (auprcVal / basePi) : 0);
    const alertEffVal = (targetObj.alert_efficiency !== undefined) ? targetObj.alert_efficiency : (pos && pos.alert_efficiency !== undefined ? pos.alert_efficiency : 0);
    const hitsCount = (targetObj.alert_efficiency_hits !== undefined) ? targetObj.alert_efficiency_hits : 0;
    const totalHits = (targetObj.alert_efficiency_total !== undefined) ? targetObj.alert_efficiency_total : 0;
    const effRatio = targetObj.alert_efficiency_ratio || `${hitsCount}/${totalHits}`;

    const kpiBox = document.getElementById('kpiRow');
    if (kpiBox) {
      kpiBox.innerHTML = `
        <div class="kpi"><b>${N(aucVal, 4)}</b><span>AUC-ROC</span><small>0,5 = tebakan acak</small></div>
        <div class="kpi"><b>${N(auprcVal, 6)}</b><span>AUPRC</span><small>area under precision-recall</small></div>
        <div class="kpi"><b>${N(alertEffVal, 1)}%</b><span>Alert Efficiency</span><small>recall Top-10 per siklus (${effRatio})</small></div>`;
    }
  }

  if (cmp.length) {
    const cols = ['AUC-ROC', 'AUPRC'];
    const head = `<thead><tr><th>Model / Metodologi</th>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead>`;

    const bestGfwName = (M.best_models_two_pipelines && M.best_models_two_pipelines.gfw_pipeline_best && M.best_models_two_pipelines.gfw_pipeline_best.name) || 'LightGBM (GFW)';
    const bestGeeName = (M.best_models_two_pipelines && M.best_models_two_pipelines.gee_pipeline_best && M.best_models_two_pipelines.gee_pipeline_best.name) || 'XGBoost (GEE)';

    const body = cmp.map(r => {
      const label = r.label || r.Model || r.name || 'Model';
      const on = label === bestGfwName || label === bestGeeName || label.includes(bestGfwName) || label.includes(bestGeeName);
      const auc = r['AUC-ROC'] || r.auc_roc || r.auc || 0;
      const auprc = r['AUPRC'] || r.auprc || 0;

      return `<tr class="${on ? 'is-poseidon' : ''}">
        <td><b>${label}</b></td>
        <td>${N(auc, 4)}</td>
        <td>${N(auprc, 6)}</td>
      </tr>`;
    }).join('');
    const cmpTable = document.getElementById('cmpTable');
    if (cmpTable) cmpTable.innerHTML = head + `<tbody>${body}</tbody>`;
  }

  const alertEffBox = document.getElementById('alertEffContainer');
  if (alertEffBox) {
    const bestGfw = (M.best_models_two_pipelines && M.best_models_two_pipelines.gfw_pipeline_best) || {};
    const bestGee = (M.best_models_two_pipelines && M.best_models_two_pipelines.gee_pipeline_best) || {};
    
    const gfwName = bestGfw.name || 'LightGBM (GFW)';
    const geeName = bestGee.name || 'XGBoost (GEE)';
    const gfwEff = bestGfw.alert_efficiency_display || (bestGfw.alert_efficiency !== undefined ? `${N(bestGfw.alert_efficiency, 1)}%` : '37,5%');
    const gfwRatio = bestGfw.alert_efficiency_ratio || '3/8';
    const geeEff = bestGee.alert_efficiency_display || (bestGee.alert_efficiency !== undefined ? `${N(bestGee.alert_efficiency, 1)}%` : '25,0%');
    const geeRatio = bestGee.alert_efficiency_ratio || '2/8';

    alertEffBox.innerHTML = `
      <div class="alert-eff-card-wrapper" style="background:rgba(20,119,184,0.04);border:1px solid var(--rim);border-radius:12px;padding:16px 20px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
          <div>
            <h4 style="margin:0;font-size:13px;font-weight:700;color:var(--ink-1);display:flex;align-items:center;gap:8px;text-transform:uppercase;letter-spacing:0.5px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--sonar)" stroke-width="2.2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              Alert Efficiency Operasional (Top-10 per Siklus)
            </h4>
            <p style="margin:4px 0 0;font-size:12px;color:var(--ink-2);">Proporsi kasus kapal pelanggar terverifikasi yang berhasil terjaring ke dalam Top-10 prioritas patroli per siklus perlintasan radar (Recall Operasional).</p>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;">
          <div style="background:var(--surface);border:1.5px solid var(--sonar);border-radius:10px;padding:14px 16px;display:flex;align-items:center;gap:14px;">
            <div style="background:rgba(20,119,184,0.12);color:var(--sonar);width:46px;height:46px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;flex-shrink:0;">
              ${gfwRatio}
            </div>
            <div>
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--sonar);">Pipeline Utama (GFW)</div>
              <div style="font-size:13px;font-weight:600;color:var(--ink-1);margin-top:2px;">${gfwName} · <b style="color:var(--sonar);font-size:14px;">${gfwEff}</b></div>
              <div style="font-size:11px;color:var(--ink-2);margin-top:2px;">3 dari 8 kasus OOT 2026 teridentifikasi di Top-10</div>
            </div>
          </div>
          <div style="background:var(--surface);border:1px solid var(--rim);border-radius:10px;padding:14px 16px;display:flex;align-items:center;gap:14px;">
            <div style="background:rgba(102,217,232,0.1);color:var(--accent);width:46px;height:46px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;flex-shrink:0;">
              ${geeRatio}
            </div>
            <div>
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--ink-2);">Strategi Mitigasi (GEE)</div>
              <div style="font-size:13px;font-weight:600;color:var(--ink-1);margin-top:2px;">${geeName} · <b style="color:var(--ink-1);font-size:14px;">${geeEff}</b></div>
              <div style="font-size:11px;color:var(--ink-2);margin-top:2px;">2 dari 8 kasus OOT 2026 teridentifikasi di Top-10</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  drawTimeSeries();

  drawPrCurve(M);
  drawRocCurve(M);

  drawImportance(M);
  drawConformal(M.conformal);
  drawAblation(M);
}

function exportPassData(passId, format) {
  const items = S.top10.filter(t => t.pass === passId).sort((a, b) => a.rank - b.rank);
  if (!items.length) { alert('Data prioritas tidak tersedia untuk siklus ini.'); return; }
  if (format === 'geojson') {
    const geojson = {
      type: "FeatureCollection",
      features: items.map(t => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [t.lon, t.lat] },
        properties: {
          rank: t.rank,
          pass: t.pass,
          row_id: t.row_id,
          score: t.score,
          tier: t.tier,
          conformal: t.conformal === 1,
          timestamp: t.ts,
          length_m: t.length_m,
          category: t.cat,
          ais: t.ais,
          shap_drivers: t.shap || []
        }
      }))
    };
    downloadBlob(JSON.stringify(geojson, null, 2), `poseidon_priorities_${passId}.geojson`, 'application/json');
  } else if (format === 'csv') {
    const headers = ['rank', 'pass', 'row_id', 'latitude', 'longitude', 'score', 'tier', 'conformal', 'timestamp', 'length_m', 'category', 'ais'];
    const rows = items.map(t => [
      t.rank, t.pass, t.row_id, t.lat, t.lon, t.score, `"${t.tier}"`, t.conformal, `"${t.ts}"`, t.length_m, `"${t.cat}"`, t.ais
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    downloadBlob(csv, `poseidon_priorities_${passId}.csv`, 'text/csv');
  }
}

function downloadBlob(content, filename, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function drawTimeSeries() {
  if (!S.passes.length) return;
  const monthly = {};
  S.passes.forEach(p => {
    const ym = p.id.slice(0, 7);
    if (!monthly[ym]) monthly[ym] = { total: 0, dark: 0, count: 0 };
    monthly[ym].total += p.n;
    monthly[ym].dark += p.n_dark;
    monthly[ym].count += 1;
  });
  const keys = Object.keys(monthly).sort();
  const pts = keys.map(k => ({ ym: k, dark: monthly[k].dark, total: monthly[k].total }));
  const W = 880, H = 290, L = 68, R = 24, T = 18, B = 60, iw = W - L - R, ih = H - T - B;
  const maxDark = Math.max(...pts.map(p => p.dark)) * 1.1;
  let s = svgEl(W, H);
  [0, 0.25, 0.5, 0.75, 1].forEach(f => {
    const y = T + ih - f * ih;
    s += `<line class="gl" x1="${L}" y1="${y}" x2="${W - R}" y2="${y}"/>
          <text x="${L - 10}" y="${y + 4}" text-anchor="end" style="font-size:11.5px">${Math.round(maxDark * f)}</text>`;
  });
  const pathD = pts.map((p, i) => `${i ? 'L' : 'M'}${(L + i * (iw / (pts.length - 1))).toFixed(1)} ${(T + ih - (p.dark / maxDark) * ih).toFixed(1)}`).join(' ');
  s += `<path class="ln" d="${pathD}" style="stroke:var(--flare);stroke-width:2.2"/>`;
  pts.forEach((p, i) => {
    if (i % 3 === 0) {
      const x = L + i * (iw / (pts.length - 1));
      s += `<text x="${x}" y="${T + ih + 22}" text-anchor="middle" style="font-size:11.5px">${p.ym}</text>`;
    }
  });

  const years = [...new Set(S.passes.map(x => x.year))].sort((a, b) => a - b);
  const yearRangeStr = years.length ? `${years[0]}–${years[years.length - 1]}` : '2023–2026';

  s += `<line class="ax" x1="${L}" y1="${T + ih}" x2="${W - R}" y2="${T + ih}"/>
        <text x="${L + iw / 2}" y="${H - 10}" text-anchor="middle" style="font-size:12.5px;font-weight:500">Bulan (${yearRangeStr})</text>
        <text x="18" y="${T + ih / 2}" text-anchor="middle" transform="rotate(-90 18 ${T + ih / 2})" style="font-size:12.5px;font-weight:500">Kapal Tanpa AIS</text></svg>`;
  const container = document.getElementById('timeSeriesChart');
  if (container) container.innerHTML = s;
}

function svgEl(w, h) {
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">`;
}


function drawPrCurve(M) {
  const box = document.getElementById('prChart');
  if (!box) return;

  const best = M ? M.best_models_two_pipelines : null;
  const gfw = best ? best.gfw_pipeline_best : null;
  const gee = best ? best.gee_pipeline_best : null;

  const gfwAuprc = (gfw && gfw.auprc !== undefined) ? gfw.auprc : ((M && M.poseidon && M.poseidon.auprc) || 0.0052);
  const geeAuprc = (gee && gee.auprc !== undefined) ? gee.auprc : ((M && M.poseidon && M.poseidon.auprc) || 0.0045);

  const prGee = (M && M.pr_curve_gee && M.pr_curve_gee.length) ? M.pr_curve_gee : (M && M.pr_curve) || [];
  const prGfw = (M && M.pr_curve_gfw && M.pr_curve_gfw.length) ? M.pr_curve_gfw : [];

  const W = 540, H = 290, L = 56, R = 20, T = 20, B = 48, iw = W - L - R, ih = H - T - B;

  let s = svgEl(W, H);

  [0, 0.2, 0.4, 0.6, 0.8, 1.0].forEach(f => {
    const y = T + ih - f * ih;
    s += `<line class="gl" x1="${L}" y1="${y}" x2="${W - R}" y2="${y}"/>
          <text x="${L - 8}" y="${y + 4}" text-anchor="end" style="font-size:11px">${f.toFixed(1)}</text>`;
    const x = L + f * iw;
    s += `<line class="gl" x1="${x}" y1="${T}" x2="${x}" y2="${T + ih}"/>
          <text x="${x}" y="${T + ih + 16}" text-anchor="middle" style="font-size:11px">${f.toFixed(1)}</text>`;
  });

  if (prGfw.length > 0) {
    const dGfw = prGfw.map((p, i) => `${i ? 'L' : 'M'}${(L + p[0] * iw).toFixed(1)} ${(T + ih - p[1] * ih).toFixed(1)}`).join(' ');
    s += `<path d="${dGfw}" fill="none" stroke="#EF4444" stroke-width="2.2" />`;
  }
  if (prGee.length > 0) {
    const dGee = prGee.map((p, i) => `${i ? 'L' : 'M'}${(L + p[0] * iw).toFixed(1)} ${(T + ih - p[1] * ih).toFixed(1)}`).join(' ');
    s += `<path d="${dGee}" fill="none" stroke="#10B981" stroke-width="2.2" />`;
  }

  s += `<line class="ax" x1="${L}" y1="${T + ih}" x2="${W - R}" y2="${T + ih}"/>
        <line class="ax" x1="${L}" y1="${T}" x2="${L}" y2="${T + ih}"/>
        <text x="${L + iw / 2}" y="${H - 6}" text-anchor="middle" style="font-size:12px">Recall</text>
        <text x="16" y="${T + ih / 2}" text-anchor="middle" transform="rotate(-90 16 ${T + ih / 2})" style="font-size:12px">Precision</text>`;

  const legW = 212, legH = 44, legX = L + iw - legW - 10, legY = T + ih - legH - 10;
  s += `
    <g transform="translate(${legX}, ${legY})">
      <rect x="0" y="0" width="${legW}" height="${legH}" rx="6" fill="#FFFFFF" fill-opacity="0.94" stroke="rgba(8, 32, 47, 0.16)" stroke-width="1" />
      <line x1="10" y1="14" x2="22" y2="14" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round" />
      <text x="28" y="18" style="font-size:10.5px;fill:var(--ink);font-weight:600;font-family:var(--f-mono)">Pipeline GFW (AUPRC=${N(gfwAuprc, 4)})</text>
      <line x1="10" y1="29" x2="22" y2="29" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" />
      <text x="28" y="33" style="font-size:10.5px;fill:var(--ink);font-weight:600;font-family:var(--f-mono)">Pipeline GEE (AUPRC=${N(geeAuprc, 4)})</text>
    </g>
  </svg>`;

  box.innerHTML = s;
}


function drawRocCurve(M) {
  const box = document.getElementById('rocChart');
  if (!box) return;

  const best = M ? M.best_models_two_pipelines : null;
  const gfw = best ? best.gfw_pipeline_best : null;
  const gee = best ? best.gee_pipeline_best : null;

  const gfwAuc = (gfw && gfw.auc_roc !== undefined) ? gfw.auc_roc : ((M && M.poseidon && M.poseidon.auc_roc) || 0.9495);
  const geeAuc = (gee && gee.auc_roc !== undefined) ? gee.auc_roc : ((M && M.poseidon && M.poseidon.auc_roc) || 0.9261);

  const rocGee = (M && M.roc_curve_gee && M.roc_curve_gee.length) ? M.roc_curve_gee : (M && M.roc_curve) || [];
  const rocGfw = (M && M.roc_curve_gfw && M.roc_curve_gfw.length) ? M.roc_curve_gfw : [];

  const W = 540, H = 290, L = 56, R = 20, T = 20, B = 48, iw = W - L - R, ih = H - T - B;

  let s = svgEl(W, H);

  [0, 0.2, 0.4, 0.6, 0.8, 1.0].forEach(f => {
    const y = T + ih - f * ih;
    s += `<line class="gl" x1="${L}" y1="${y}" x2="${W - R}" y2="${y}"/>
          <text x="${L - 8}" y="${y + 4}" text-anchor="end" style="font-size:11px">${f.toFixed(1)}</text>`;
    const x = L + f * iw;
    s += `<line class="gl" x1="${x}" y1="${T}" x2="${x}" y2="${T + ih}"/>
          <text x="${x}" y="${T + ih + 16}" text-anchor="middle" style="font-size:11px">${f.toFixed(1)}</text>`;
  });

  s += `<line x1="${L}" y1="${T + ih}" x2="${L + iw}" y2="${T}" stroke="#64748B" stroke-width="1.4" stroke-dasharray="5 5" />`;

  if (rocGfw.length > 0) {
    const dGfw = rocGfw.map((p, i) => `${i ? 'L' : 'M'}${(L + p[0] * iw).toFixed(1)} ${(T + ih - p[1] * ih).toFixed(1)}`).join(' ');
    s += `<path d="${dGfw}" fill="none" stroke="#EF4444" stroke-width="2.2" />`;
  }
  if (rocGee.length > 0) {
    const dGee = rocGee.map((p, i) => `${i ? 'L' : 'M'}${(L + p[0] * iw).toFixed(1)} ${(T + ih - p[1] * ih).toFixed(1)}`).join(' ');
    s += `<path d="${dGee}" fill="none" stroke="#10B981" stroke-width="2.2" />`;
  }

  s += `<line class="ax" x1="${L}" y1="${T + ih}" x2="${W - R}" y2="${T + ih}"/>
        <line class="ax" x1="${L}" y1="${T}" x2="${L}" y2="${T + ih}"/>
        <text x="${L + iw / 2}" y="${H - 6}" text-anchor="middle" style="font-size:12px">False Positive Rate</text>
        <text x="16" y="${T + ih / 2}" text-anchor="middle" transform="rotate(-90 16 ${T + ih / 2})" style="font-size:12px">True Positive Rate</text>`;

  const legW = 200, legH = 44, legX = L + iw - legW - 10, legY = T + ih - legH - 10;
  s += `
    <g transform="translate(${legX}, ${legY})">
      <rect x="0" y="0" width="${legW}" height="${legH}" rx="6" fill="#FFFFFF" fill-opacity="0.94" stroke="rgba(8, 32, 47, 0.16)" stroke-width="1" />
      <line x1="10" y1="14" x2="22" y2="14" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round" />
      <text x="28" y="18" style="font-size:10.5px;fill:var(--ink);font-weight:600;font-family:var(--f-mono)">Pipeline GFW (AUC=${N(gfwAuc, 4)})</text>
      <line x1="10" y1="29" x2="22" y2="29" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" />
      <text x="28" y="33" style="font-size:10.5px;fill:var(--ink);font-weight:600;font-family:var(--f-mono)">Pipeline GEE (AUC=${N(geeAuc, 4)})</text>
    </g>
  </svg>`;

  box.innerHTML = s;
}


function drawImportance(M) {
  const box = document.getElementById('impChart');
  if (!box) return;

  const featureLabels = (S.meta && S.meta.feature_labels) || {
    'vv_intensity_db': 'Intensitas radar VV',
    'vh_intensity_db': 'Intensitas radar VH',
    'radar_intensity_diff': 'Selisih intensitas VV-VH',
    'background_clutter': 'Tingkat noise citra radar',
    'snr_db': 'Signal-to-noise ratio',
    'length_m': 'Panjang kapal',
    'length_m_new': 'Panjang kapal (estimasi)',
    'dist_to_nearest_mpa_km': 'Jarak ke kawasan konservasi',
    'dist_to_eez_boundary_km': 'Jarak ke batas ZEE',
    'dist_to_nearest_port_km': 'Jarak ke pelabuhan',
    'dist_to_nearest_seizure_km': 'Jarak ke lokasi Locus delicti',
    'fishing_score': 'Fishing score',
    'fishing_score_new': 'Fishing score (estimasi)',
    'matching_score': 'Skor kecocokan AIS',
    'ais_flag_country_encoded': 'Negara bendera AIS',
    'area_dark_count_30d': 'Jumlah kapal gelap 30 hari terakhir',
    'area_dark_flag': 'Flag area rawan kapal gelap',
    'historical_hotspot': 'Riwayat area rawan pelanggaran',
    'quarter': 'Kuartal musim'
  };

  const featureDims = {
    'vv_intensity_db': 'A',
    'vh_intensity_db': 'A',
    'radar_intensity_diff': 'A',
    'background_clutter': 'A',
    'snr_db': 'A',
    'length_m': 'A',
    'length_m_new': 'A',
    'dist_to_nearest_mpa_km': 'B',
    'dist_to_eez_boundary_km': 'B',
    'dist_to_nearest_port_km': 'B',
    'dist_to_nearest_seizure_km': 'B',
    'fishing_score': 'C',
    'fishing_score_new': 'C',
    'historical_hotspot': 'D',
    'quarter': 'D',
    'matching_score': 'D',
    'ais_flag_country_encoded': 'D',
    'area_dark_count_30d': 'D',
    'area_dark_flag': 'D'
  };

  const geeRows = (M && (M.feature_importance_gee || M.feature_importance)) || [];
  const gfwRows = (M && M.feature_importance_gfw) || [];

  const maxGee = geeRows.length ? Math.max(...geeRows.map(r => r.gain_pct)) : 1;
  const maxGfw = gfwRows.length ? Math.max(...gfwRows.map(r => r.gain_pct)) : 1;

  const renderRow = (r, maxGain) => {
    const lbl = featureLabels[r.feature] || r.label || r.feature;
    const dim = r.dimension || featureDims[r.feature] || 'A';
    const widthPct = maxGain > 0 ? ((r.gain_pct / maxGain) * 100).toFixed(1) : '0.0';
    return `
      <div class="fi-row" title="${lbl} (${r.feature}) · Dimensi ${dim} · ${N(r.gain_pct, 2)}%">
        <span class="fi-label">${lbl}</span>
        <div class="fi-track">
          <div class="fi-fill dim${dim}" style="width:${widthPct}%"></div>
        </div>
        <span class="fi-pct">${N(r.gain_pct, 2)}%</span>
      </div>
    `;
  };

  const geeListHtml = geeRows.map(r => renderRow(r, maxGee)).join('');
  const gfwListHtml = gfwRows.map(r => renderRow(r, maxGfw)).join('');

  box.innerHTML = `
    <div class="grid-2" style="gap:32px;align-items:start">
      <div class="fi-pipeline-col">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid var(--line)">
          <div>
            <h4 style="margin:0;font-size:14px;color:var(--sonar);font-weight:700">Pipeline GFW · Pipeline Utama</h4>
            <span class="mono" style="font-size:11px;color:var(--ink-2)">17 Fitur · Standar Historis GFW (OOT 2026)</span>
          </div>
          <span class="tier-chip t-s1" style="font-size:11px;padding:3px 8px">Model Utama</span>
        </div>
        <div class="fi-list">
          ${gfwListHtml}
        </div>
      </div>

      <div class="fi-pipeline-col">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid var(--line)">
          <div>
            <h4 style="margin:0;font-size:14px;color:var(--ink);font-weight:700">Pipeline GEE · Strategi Mitigasi</h4>
            <span class="mono" style="font-size:11px;color:var(--ink-2)">13 Fitur · Mitigasi Peralihan Satelit (OOT 2026)</span>
          </div>
          <span class="tier-chip t-s3" style="font-size:11px;padding:3px 8px">Strategi Mitigasi</span>
        </div>
        <div class="fi-list">
          ${geeListHtml}
        </div>
      </div>
    </div>

    <div class="fi-legend" style="margin-top:20px">
      <span class="leg-tag"><i style="background:#1477B8"></i> Dim A (Fisik Radar)</span>
      <span class="leg-tag"><i style="background:#0D9488"></i> Dim B (Spasial Regulasi)</span>
      <span class="leg-tag"><i style="background:#F59E0B"></i> Dim C (Fishing Score Oseanografi)</span>
      <span class="leg-tag"><i style="background:#EF4444"></i> Dim D (Spasio-Temporal & AIS)</span>
    </div>
  `;
}


function drawConformal(c) {
  const box = document.getElementById('confPanel');
  if (!box) return;
  const targetCov = (c && c.target_coverage !== undefined) ? c.target_coverage : (c && c.alpha !== undefined ? (1 - c.alpha) : 0);
  const covEval = (c && (c.coverage_eval !== undefined ? c.coverage_eval : c.coverage_holdout)) !== undefined ? (c.coverage_eval !== undefined ? c.coverage_eval : c.coverage_holdout) : (c && c.gee && c.gee.coverage_eval !== undefined ? c.gee.coverage_eval : 0);
  const qHat = (c && c.q_hat !== undefined) ? c.q_hat : ((S.meta && S.meta.model && (S.meta.model.conformal_q_gee || S.meta.model.conformal_q_gfw || S.meta.model.conformal_q)) || (c && c.gee && c.gee.q_hat) || 0);
  const alphaVal = (c && c.alpha !== undefined) ? c.alpha : (targetCov > 0 ? (1 - targetCov) : 0);
  const falseAlarm = (c && c.false_alarm_rn !== undefined) ? c.false_alarm_rn : (c && c.gee && c.gee.false_alarm_rn !== undefined ? c.gee.false_alarm_rn : 0);
  const totalScored = (S.meta && S.meta.data && (S.meta.data.total_detections_scored || S.meta.data.total_detections_history)) || 0;

  box.innerHTML = `
    <div class="conf-grid">
      <div class="conf-item"><span>Target jaminan cakupan (1 − α)</span><b>${N(targetCov * 100, 0)}%</b></div>
      <div class="conf-item"><span>Cakupan empiris pada evaluasi data uji</span><b>${N(covEval * 100, 1)}%</b></div>
      <div class="conf-item"><span>Ambang batas skor terkalibrasi (q̂)</span><b>${N(qHat, 6)}</b></div>
      <div class="conf-item"><span>Tingkat signifikansi error (α)</span><b>${N(alphaVal, 2)}</b></div>
      <div class="conf-item"><span>Alarm palsu pada kapal niaga (Label RN)</span><b>${N(falseAlarm * 100, 2)}%</b></div>
      <div class="conf-item"><span>Total deteksi dinilai (2025–2026)</span><b>${NF(totalScored)}</b></div>
    </div>
    <p class="note">Ambang batas skor q̂ = ${N(qHat, 6)} memberikan jaminan cakupan statistik ${N(targetCov * 100, 0)}% pada data out-of-time (OOT), memastikan armada patroli memprioritaskan kapal dengan risiko terukur.</p>`;
}


function drawAblation(M) {
  const box = document.getElementById('ablPanel');
  if (!box) return;
  const best = M ? M.best_models_two_pipelines : null;
  const gfw = best ? best.gfw_pipeline_best : null;
  const gee = best ? best.gee_pipeline_best : null;

  if (gfw && gee) {
    const gfwEff = gfw.alert_efficiency_display || (gfw.alert_efficiency !== undefined ? `${gfw.alert_efficiency}%` : '—');
    const geeEff = gee.alert_efficiency_display || (gee.alert_efficiency !== undefined ? `${gee.alert_efficiency}%` : '—');

    const noPuModel = (M.baselines_oot2026 || M.all_models || []).find(r => (r.label || r.name || '').includes('No PU'));
    const noPuAuprc = (noPuModel && noPuModel.auprc !== undefined) ? noPuModel.auprc : 0;
    const deltaVsNoPu = (noPuAuprc > 0) ? (((gfw.auprc - noPuAuprc) / noPuAuprc) * 100) : 0;

    box.innerHTML = `
      <div class="abl-grid">
        <div class="abl-card" style="border-color:var(--sonar);background:rgba(20,119,184,0.06)">
          <b style="color:var(--sonar)">${N(gfw.auc_roc, 4)}</b>
          <span>${gfw.name} · Pipeline Utama (POSEIDON)</span>
          <div class="mono" style="font-size:11px;color:var(--sonar);font-weight:700;margin-top:6px">AUPRC: ${N(gfw.auprc, 6)} · Alert Eff: ${gfwEff} (${gfw.alert_efficiency_ratio || '—'})</div>
        </div>
        <div class="abl-card">
          <b>${N(gee.auc_roc, 4)}</b>
          <span>${gee.name} · Pipeline GEE (Strategi Mitigasi)</span>
          <div class="mono" style="font-size:11px;color:var(--ink-2);margin-top:6px">AUPRC: ${N(gee.auprc, 6)} · Alert Eff: ${geeEff} (${gee.alert_efficiency_ratio || '—'})</div>
        </div>
        <div class="abl-card" style="border-color:var(--kelp);background:rgba(13,148,136,0.06)">
          <b style="color:var(--kelp)">+${N(deltaVsNoPu, 1)}%</b>
          <span>Peningkatan Presisi AUPRC (vs Tanpa PU)</span>
          <div class="mono" style="font-size:11px;color:var(--kelp);margin-top:6px">Metodologi PU Learning Mengungguli Klasifikasi Konvensional</div>
        </div>
      </div>
      <p class="note">Pipeline GFW berfungsi sebagai model utama sistem POSEIDON (17 Fitur) dengan performa AUC ${N(gfw.auc_roc, 4)} dan peningkatan presisi AUPRC +${N(deltaVsNoPu, 1)}% dibanding pendekatan supervised tanpa PU Learning. Sementara itu, Pipeline GEE (13 Fitur) disiapkan sebagai strategi mitigasi operasional saat ketiadaan sebagian data GFW akibat masa peralihan satelit.</p>
    `;
  }
}

function centerActiveSparklineBar() {
  const box = document.getElementById('timelineSparkline');
  if (!box) return;
  const activeBar = box.querySelector('.sparkline-bar.is-active');
  if (activeBar && box.offsetWidth > 0) {
    box.scrollLeft = activeBar.offsetLeft - (box.offsetWidth / 2) + (activeBar.offsetWidth / 2);
  }
}

function renderTimelineSparkline() {
  const box = document.getElementById('timelineSparkline');
  if (!box || !S.passes.length) return;
  const maxDet = Math.max(...S.passes.map(p => Number(p.n || p.total_detections || p.n_dark || 1)));
  box.innerHTML = S.passes.map((p, i) => {
    const totalCount = (p.n !== undefined && p.n !== null) ? Number(p.n) : (p.total_detections ? Number(p.total_detections) : (p.n_dark || 0));
    const darkCount = p.n_dark || 0;
    const pct = Math.min(100, Math.max(8, (totalCount / maxDet) * 100));
    const isActive = i === S.passIdx;
    return `<div class="sparkline-bar ${isActive ? 'is-active' : ''}" data-pass-idx="${i}" data-date="${fmtDate(p.id)}" data-total="${totalCount}" data-dark="${darkCount}" style="height:${pct}%"></div>`;
  }).join('');

  if (!box._hasSparklineEvents) {
    box._hasSparklineEvents = true;
    box.addEventListener('click', e => {
      const b = e.target.closest('.sparkline-bar');
      if (b && b.dataset.passIdx !== undefined) selectPass(+b.dataset.passIdx);
    });
    box.addEventListener('mouseover', e => {
      const b = e.target.closest('.sparkline-bar');
      if (b) {
        const date = b.dataset.date;
        const total = b.dataset.total;
        const dark = b.dataset.dark;
        const html = `<div style="font-weight:700;color:#FFF;font-size:11px">${date}</div>
                      <div style="font-size:10.5px;color:rgba(238,245,249,0.85);margin-top:2px">Total Deteksi: <b style="color:var(--foam)">${total}</b></div>
                      <div style="font-size:10px;color:var(--ink-2);margin-top:1px">Kapal Tanpa AIS: <b style="color:var(--flare)">${dark}</b></div>`;
        showGlobalBarTooltip(e, html);
      }
    });
    box.addEventListener('mouseout', e => {
      if (e.target.closest('.sparkline-bar')) hideGlobalBarTooltip();
    });
  }
  centerActiveSparklineBar();
}


window.addEventListener('keydown', e => {
  const activeView = document.querySelector('.view.is-active');
  if (!activeView || activeView.id !== 'view-dashboard') return;
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

  if (e.code === 'Space') {
    e.preventDefault();
    toggleAutoPlay();
  } else if (e.code === 'ArrowLeft') {
    e.preventDefault();
    selectPass(S.passIdx - 1);
  } else if (e.code === 'ArrowRight') {
    e.preventDefault();
    selectPass(S.passIdx + 1);
  } else if (e.code === 'KeyF') {
    e.preventDefault();
    if (!S.passes[S.passIdx]) return;
    const top1 = S.top10.find(t => t.pass === S.passes[S.passIdx].id && t.rank === 1);
    if (top1 && MAP) {
      document.getElementById('layTop10').checked = true;
      LAYER_TOP.addTo(MAP);
      MAP.setView([top1.lat, top1.lon], 10);
    }
  } else if (e.code === 'Escape') {
    e.preventDefault();
    const searchInp = document.getElementById('mapSearchInput');
    if (searchInp) searchInp.value = '';
  }
});


boot();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', repositionNavAuth);
} else {
  repositionNavAuth();
}
