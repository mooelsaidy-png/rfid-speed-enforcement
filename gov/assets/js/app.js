const API_BASE = 'api/';
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const esc = (s) => {
    if (s === null || s === undefined) return '';
    const d = document.createElement('div'); d.textContent = s; return d.innerHTML;
};

let currentZoneId = null;
let currentZoneName = '';

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    loadZones();
    $('#backToZones').addEventListener('click', (e) => { e.preventDefault(); showZones(); });
    $('#backToViolations').addEventListener('click', (e) => { e.preventDefault(); showZoneViolations(); });
    $('#sourceToggle').addEventListener('change', () => { if (currentZoneId) loadZoneViolations(currentZoneId, $('#sourceToggle').value); });
    $('#searchBtn').addEventListener('click', doSearch);
    $('#tagInput').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
    $('#plateInput').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
});

function initTabs() {
    $$('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.tab-btn').forEach(b => b.classList.remove('active'));
            $$('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            $('#tab-' + btn.dataset.tab).classList.add('active');
        });
    });
}

/* ---------- Zones ---------- */
async function loadZones() {
    try {
        const res = await fetch(API_BASE + 'zones.php');
        const zones = await res.json();
        $('#zoneList').innerHTML = zones.map(z => `
            <a class="zone-card" data-zone="${z.zone_id}" data-name="${esc(z.zone_name)}">
                <h3>${esc(z.zone_name)}</h3>
                <div class="muted">Limit: ${z.speed_limit} km/h</div>
                <div class="muted">Reported: ${z.reported_count} · Total: ${z.total_count}</div>
            </a>
        `).join('');
        $$('.zone-card').forEach(card => {
            card.addEventListener('click', () => {
                currentZoneId = parseInt(card.dataset.zone);
                currentZoneName = card.dataset.name;
                showZoneViolations();
            });
        });
    } catch (e) { console.error(e); }
}

function showZones() {
    $('#zonesView').style.display = '';
    $('#zoneDetail').style.display = 'none';
    $('#violationDetail').style.display = 'none';
    currentZoneId = null;
}

async function showZoneViolations() {
    $('#zonesView').style.display = 'none';
    $('#violationDetail').style.display = 'none';
    $('#zoneDetail').style.display = '';
    $('#zoneTitle').textContent = currentZoneName;
    await loadZoneViolations(currentZoneId, $('#sourceToggle').value);
}

async function loadZoneViolations(zoneId, source) {
    $('#zoneSub').textContent = `Zone ID: ${zoneId} · source: ${source}`;
    try {
        const res = await fetch(`${API_BASE}zone_violations.php?zone=${zoneId}&source=${source}`);
        const rows = await res.json();
        const tbody = $('#zoneViolationsBody');
        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="11" class="empty">No violations for this source</td></tr>';
            return;
        }
        tbody.innerHTML = rows.map((v, i) => {
            const sev = v.severity === 'High' ? 'sev-high' : v.severity === 'Medium' ? 'sev-medium' : 'sev-low';
            const typ = v.violation_type === 'Wrong_Way' ? 'type-wrongway' : 'type-speeding';
            return `<tr>
                <td>${i + 1}</td>
                <td><span class="tag-id">${esc(v.violation_uid)}</span></td>
                <td><span class="plate">${esc(v.vehicle_plate ?? '-')}</span></td>
                <td><span class="badge danger">${parseFloat(v.speed_kmh).toFixed(1)}</span></td>
                <td>${v.speed_limit ?? '-'}</td>
                <td>${parseFloat(v.over_by_kmh).toFixed(2)}</td>
                <td><span class="badge ${typ}">${esc(v.violation_type)}</span></td>
                <td><span class="badge ${sev}">${esc(v.severity)}</span></td>
                <td>${esc(v.direction ?? '-')}</td>
                <td>${fmtTime(v.detected_at)}</td>
                <td><button class="link-btn" data-vid="${v.id}">Details →</button></td>
            </tr>`;
        }).join('');
        $$('#zoneViolationsBody .link-btn').forEach(b => {
            b.addEventListener('click', () => showViolationDetail(parseInt(b.dataset.vid)));
        });
    } catch (e) { console.error(e); }
}

async function showViolationDetail(vid) {
    $('#zoneDetail').style.display = 'none';
    $('#violationDetail').style.display = '';
    $('#detailTitle').textContent = `Violation #${vid}`;
    try {
        const res = await fetch(`${API_BASE}violation_detail.php?id=${vid}`);
        const d = await res.json();
        if (d.error) { $('#detailCard').innerHTML = `<p class="empty">${esc(d.error)}</p>`; return; }
        $('#detailCard').innerHTML = `
            <h3>🚗 Vehicle</h3>
            <div class="detail-grid">
                <div class="detail-item"><span class="k">Owner</span><span class="v">${esc(d.owner_name ?? '-')}</span></div>
                <div class="detail-item"><span class="k">Plate</span><span class="v"><span class="plate">${esc(d.vehicle_plate ?? d.tag_plate ?? '-')}</span></span></div>
                <div class="detail-item"><span class="k">Vehicle</span><span class="v">${esc(d.vehicle_type ?? '-')}</span></div>
                <div class="detail-item"><span class="k">Color</span><span class="v">${esc(d.vehicle_color ?? '-')}</span></div>
                <div class="detail-item"><span class="k">Tag ID</span><span class="v"><span class="tag-id">${esc(d.tag_id)}</span></span></div>
            </div>
            <h3 style="margin-top:24px">⚠️ Violation</h3>
            <div class="detail-grid">
                <div class="detail-item"><span class="k">UID</span><span class="v">${esc(d.violation_uid)}</span></div>
                <div class="detail-item"><span class="k">Type</span><span class="v">${esc(d.violation_type)}</span></div>
                <div class="detail-item"><span class="k">Severity</span><span class="v">${esc(d.severity)}</span></div>
                <div class="detail-item"><span class="k">Speed</span><span class="v">${parseFloat(d.speed_kmh).toFixed(1)} km/h</span></div>
                <div class="detail-item"><span class="k">Limit (snapshot)</span><span class="v">${d.speed_limit ?? '-'} km/h</span></div>
                <div class="detail-item"><span class="k">Over by</span><span class="v">${parseFloat(d.over_by_kmh).toFixed(2)} km/h</span></div>
                <div class="detail-item"><span class="k">Direction</span><span class="v">${esc(d.direction ?? '-')}</span></div>
            </div>
            <h3 style="margin-top:24px">📍 Zone & Device</h3>
            <div class="detail-grid">
                <div class="detail-item"><span class="k">Zone</span><span class="v">${esc(d.zone_name ?? '-')}</span></div>
                <div class="detail-item"><span class="k">Zone limit (current)</span><span class="v">${d.zone_limit ?? '-'} km/h</span></div>
                <div class="detail-item"><span class="k">Device</span><span class="v">${esc(d.device_id ?? '-')}</span></div>
                <div class="detail-item"><span class="k">Location</span><span class="v">${esc(d.location_name ?? '-')}</span></div>
                <div class="detail-item"><span class="k">Detected</span><span class="v">${fmtTime(d.detected_at)}</span></div>
                <div class="detail-item"><span class="k">Sync status</span><span class="v">${esc(d.sync_status ?? '-')}</span></div>
                <div class="detail-item"><span class="k">Gov ACK</span><span class="v">${esc(d.ack_reference ?? '—')}</span></div>
                <div class="detail-item"><span class="k">Gov Reported</span><span class="v">${d.reported_at ? fmtTime(d.reported_at) : '—'}</span></div>
            </div>
        `;
    } catch (e) { console.error(e); }
}

/* ---------- Tag / Plate search ---------- */
async function doSearch() {
    const tag = $('#tagInput').value.trim();
    const plate = $('#plateInput').value.trim();
    if (!tag && !plate) { $('#searchResult').innerHTML = '<p class="muted">Enter a tag ID or plate.</p>'; return; }
    const url = API_BASE + 'tag_search.php?' +
        (tag ? 'tag_id=' + encodeURIComponent(tag) : 'plate=' + encodeURIComponent(plate));
    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.error) { $('#searchResult').innerHTML = `<p class="empty">${esc(data.error)}</p>`; return; }
        const t = data.tag;
        const vs = data.violations;
        $('#searchResult').innerHTML = `
            <div class="chart-card">
                <h3>👤 Vehicle Profile</h3>
                <div class="detail-grid">
                    <div class="detail-item"><span class="k">Owner</span><span class="v">${esc(t.owner_name)}</span></div>
                    <div class="detail-item"><span class="k">Plate</span><span class="v"><span class="plate">${esc(t.vehicle_plate)}</span></span></div>
                    <div class="detail-item"><span class="k">Vehicle</span><span class="v">${esc(t.vehicle_type ?? '-')}</span></div>
                    <div class="detail-item"><span class="k">Color</span><span class="v">${esc(t.vehicle_color ?? '-')}</span></div>
                    <div class="detail-item"><span class="k">Tag ID</span><span class="v"><span class="tag-id">${esc(t.tag_id)}</span></span></div>
                </div>
            </div>
            <div class="chart-card">
                <h3>⚠️ Violations (${vs.length})</h3>
                ${vs.length ? `
                <div class="table-wrapper" style="box-shadow:none;border:none">
                <table class="data-table">
                    <thead><tr>
                        <th>#</th><th>UID</th><th>Zone</th><th>Zone Limit</th>
                        <th>Speed</th><th>Snapshot Limit</th><th>Over By</th>
                        <th>Type</th><th>Severity</th><th>Direction</th><th>Time</th>
                    </tr></thead>
                    <tbody>
                    ${vs.map((v,i) => {
                        const sev = v.severity === 'High' ? 'sev-high' : v.severity === 'Medium' ? 'sev-medium' : 'sev-low';
                        const typ = v.violation_type === 'Wrong_Way' ? 'type-wrongway' : 'type-speeding';
                        return `<tr>
                            <td>${i+1}</td>
                            <td><span class="tag-id">${esc(v.violation_uid)}</span></td>
                            <td>${esc(v.zone_name ?? '-')}</td>
                            <td>${v.zone_limit ?? '-'} km/h</td>
                            <td><span class="badge danger">${parseFloat(v.speed_kmh).toFixed(1)}</span></td>
                            <td>${v.speed_limit ?? '-'}</td>
                            <td>${parseFloat(v.over_by_kmh).toFixed(2)}</td>
                            <td><span class="badge ${typ}">${esc(v.violation_type)}</span></td>
                            <td><span class="badge ${sev}">${esc(v.severity)}</span></td>
                            <td>${esc(v.direction ?? '-')}</td>
                            <td>${fmtTime(v.detected_at)}</td>
                        </tr>`;
                    }).join('')}
                    </tbody>
                </table></div>` : '<p class="empty">No violations for this vehicle ✅</p>'}
            </div>
            <div class="chart-card">
                <h3>🚦 Speed Limits (all zones)</h3>
                <div class="detail-grid">
                    ${data.zones.map(z => `
                        <div class="detail-item"><span class="k">${esc(z.zone_name)}</span><span class="v">${z.speed_limit} km/h</span></div>
                    `).join('')}
                </div>
            </div>
        `;
    } catch (e) { console.error(e); }
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
