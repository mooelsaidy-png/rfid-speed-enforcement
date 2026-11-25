const API_BASE = 'api/';
const REFRESH_INTERVAL = 5000; // 5s auto-refresh
let autoTimer = null;

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const esc = (s) => {
    if (s === null || s === undefined) return '';
    const d = document.createElement('div'); d.textContent = s; return d.innerHTML;
};

const params = new URLSearchParams(location.search);
const deviceId = params.get('device');

document.addEventListener('DOMContentLoaded', () => {
    if (deviceId) {
        initDashboard(deviceId);
    } else {
        initPicker();
    }
});

/* ---------- Gantry picker ---------- */
async function initPicker() {
    $('#pickerView').style.display = '';
    setStatus('loading');
    try {
        const res = await fetch(API_BASE + 'devices.php');
        const rows = await res.json();
        const list = $('#deviceList');
        if (!rows.length) { list.innerHTML = '<p class="empty">No devices</p>'; return; }
        list.innerHTML = rows.map(d => `
            <a class="device-card" href="?device=${encodeURIComponent(d.device_id)}">
                <h3>${esc(d.device_id)} — ${esc(d.location_name ?? '')}</h3>
                <div class="dev-meta">Zone: ${esc(d.zone_name ?? '-')} (limit ${d.speed_limit ?? '-'} km/h)</div>
                <div class="dev-meta">Firmware: ${esc(d.firmware_ver ?? '-')} · Backlog: ${d.buffer_backlog ?? 0}</div>
                <div class="dev-meta">
                    <span class="badge ${d.is_online ? 'online' : 'offline'}">${d.is_online ? 'ONLINE' : 'OFFLINE'}</span>
                </div>
            </a>
        `).join('');
        setStatus('online');
    } catch (e) {
        console.error(e); setStatus('offline');
    }
}

/* ---------- Per-gantry dashboard ---------- */
function initDashboard(id) {
    $('#dashboardView').style.display = '';
    loadDeviceInfo(id);
    loadReadings(id);
    startAuto(id);
}

async function loadDeviceInfo(id) {
    try {
        const res = await fetch(API_BASE + 'device_info.php?device=' + encodeURIComponent(id));
        if (!res.ok) throw new Error('device_info failed');
        const d = await res.json();
        $('#gantryTitle').textContent = `${d.device_id} — ${d.location_name ?? ''}`;
        $('#gantrySub').textContent = `Zone: ${d.zone_name ?? '-'} (limit ${d.speed_limit ?? '-'} km/h) · Firmware ${d.firmware_ver ?? '-'} · Edition ${d.edition ?? '-'}`;

        $('#deviceStats').innerHTML = `
            <div class="stat-card highlight-green">
                <div class="stat-icon">📡</div>
                <div><span class="stat-label">Status</span>
                     <span class="stat-value">${d.is_online ? 'Online' : 'Offline'}</span></div>
            </div>
            <div class="stat-card highlight-blue">
                <div class="stat-icon">🚦</div>
                <div><span class="stat-label">Zone Limit</span>
                     <span class="stat-value">${d.speed_limit ?? '-'} km/h</span></div>
            </div>
            <div class="stat-card highlight-orange">
                <div class="stat-icon">📦</div>
                <div><span class="stat-label">Buffer Backlog</span>
                     <span class="stat-value">${d.buffer_backlog ?? 0}</span></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">🕒</div>
                <div><span class="stat-label">Last Seen</span>
                     <span class="stat-value" style="font-size:.95rem">${fmtTime(d.last_seen_at)}</span></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">🆔</div>
                <div><span class="stat-label">Heartbeat Batch</span>
                     <span class="stat-value" style="font-size:.95rem">${d.last_heartbeat_batch ?? '-'}</span></div>
            </div>
        `;
    } catch (e) { console.error(e); setStatus('offline'); }
}

async function loadReadings(id) {
    try {
        const res = await fetch(API_BASE + 'readings.php?device=' + encodeURIComponent(id) + '&limit=100');
        const rows = await res.json();
        renderReadings(rows);
        setStatus('online');
    } catch (e) { console.error(e); setStatus('offline'); }
}

function renderReadings(rows) {
    const tbody = $('#readingsBody');
    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="13" class="empty">No readings for this gantry yet</td></tr>';
        return;
    }
    tbody.innerHTML = rows.map((r, i) => {
        const speed = parseFloat(r.speed_kmh);
        const limit = r.speed_limit ? parseFloat(r.speed_limit) : 80;
        let cls = 'ok';
        if (speed > limit) cls = 'danger';
        else if (speed > limit * 0.85) cls = 'warn';
        return `<tr>
            <td>${i + 1}</td>
            <td><span class="tag-id">${esc(r.tag_id)}</span></td>
            <td>${esc(r.owner_name ?? '-')}</td>
            <td><span class="plate">${esc(r.vehicle_plate ?? '-')}</span></td>
            <td>${esc(r.vehicle_type ?? '-')}</td>
            <td><span class="badge ${cls}">${speed.toFixed(1)}</span></td>
            <td>${r.speed_limit ?? '-'}</td>
            <td>${esc(r.direction ?? '-')}</td>
            <td class="rssi">${r.peak_rssi_1 ?? '-'}</td>
            <td class="rssi">${r.peak_rssi_2 ?? '-'}</td>
            <td>${r.antenna_port ?? '-'}</td>
            <td>${esc(r.diagnostic_tag ?? '-')}</td>
            <td>${fmtTime(r.read_time)}</td>
        </tr>`;
    }).join('');
}

function startAuto(id) {
    stopAuto();
    autoTimer = setInterval(() => loadReadings(id), REFRESH_INTERVAL);
}
function stopAuto() { if (autoTimer) clearInterval(autoTimer); autoTimer = null; }

function setStatus(s) {
    const dot = $('#statusDot'), txt = $('#statusText');
    if (!dot || !txt) return;
    dot.className = 'status-dot';
    if (s === 'online')       { dot.classList.add('online');  txt.textContent = 'Connected'; }
    else if (s === 'offline') { dot.classList.add('offline'); txt.textContent = 'Disconnected'; }
    else                      { txt.textContent = 'Loading...'; }
}

function fmtTime(dt) {
    if (!dt) return '-';
    try {
        const d = new Date(dt.replace(' ', 'T'));
        const diff = Math.floor((Date.now() - d) / 1000);
        if (diff < 60)    return 'Just now';
        if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return d.toLocaleString('en-GB');
    } catch { return dt; }
}
