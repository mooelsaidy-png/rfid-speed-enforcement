const $ = (s) => document.querySelector(s);
const esc = (s) => {
    if (s === null || s === undefined) return '';
    const d = document.createElement('div'); d.textContent = s; return d.innerHTML;
};

document.addEventListener('DOMContentLoaded', loadDashboard);

async function loadDashboard() {
    try {
        const res = await fetch('api/my_violations.php');
        if (res.status === 401) { location.href = 'login.html'; return; }
        const data = await res.json();
        if (data.error) { location.href = 'login.html'; return; }

        const u = data.user;
        const s = data.summary;

        $('#profileCard').innerHTML = `
            <h3>👤 Profile</h3>
            <div class="detail-grid">
                <div class="detail-item"><span class="k">Owner</span><span class="v">${esc(u.owner_name)}</span></div>
                <div class="detail-item"><span class="k">Plate</span><span class="v"><span class="plate">${esc(u.vehicle_plate)}</span></span></div>
                <div class="detail-item"><span class="k">Vehicle</span><span class="v">${esc(u.vehicle_type ?? '-')}</span></div>
                <div class="detail-item"><span class="k">Color</span><span class="v">${esc(u.vehicle_color ?? '-')}</span></div>
                <div class="detail-item"><span class="k">Tag ID</span><span class="v"><span class="tag-id">${esc(u.tag_id)}</span></span></div>
            </div>
        `;

        const worstClass = s.worst === 'High' ? 'highlight-red'
                         : s.worst === 'Medium' ? 'highlight-orange'
                         : s.worst === 'Low' ? '' : 'highlight-green';

        $('#summaryGrid').innerHTML = `
            <div class="stat-card ${s.total > 0 ? 'highlight-red' : 'highlight-green'}">
                <div class="stat-icon">⚠️</div>
                <div><span class="stat-label">Total Violations</span>
                     <span class="stat-value">${s.total}</span></div>
            </div>
            <div class="stat-card ${worstClass}">
                <div class="stat-icon">🚨</div>
                <div><span class="stat-label">Worst Severity</span>
                     <span class="stat-value">${esc(s.worst)}</span></div>
            </div>
            <div class="stat-card highlight-orange">
                <div class="stat-icon">📈</div>
                <div><span class="stat-label">Total Over By</span>
                     <span class="stat-value">${s.sum_over} km/h</span></div>
            </div>
            <div class="stat-card ${s.total === 0 ? 'highlight-green' : ''}">
                <div class="stat-icon">${s.total === 0 ? '✅' : '📋'}</div>
                <div><span class="stat-label">Status</span>
                     <span class="stat-value">${s.total === 0 ? 'Clean' : 'Attention'}</span></div>
            </div>
        `;

        const tbody = $('#violationsBody');
        if (!data.violations.length) {
            tbody.innerHTML = '<tr><td colspan="11" class="empty">✅ No violations on record</td></tr>';
            return;
        }
        tbody.innerHTML = data.violations.map((v, i) => {
            const sev = v.severity === 'High' ? 'sev-high' : v.severity === 'Medium' ? 'sev-medium' : 'sev-low';
            const typ = v.violation_type === 'Wrong_Way' ? 'type-wrongway' : 'type-speeding';
            return `<tr>
                <td>${i + 1}</td>
                <td><span class="tag-id">${esc(v.violation_uid)}</span></td>
                <td>${esc(v.zone_name ?? '-')}</td>
                <td>${v.zone_limit ?? '-'} km/h</td>
                <td>${v.speed_limit ?? '-'} km/h</td>
                <td><span class="badge danger">${parseFloat(v.speed_kmh).toFixed(1)}</span></td>
                <td>${parseFloat(v.over_by_kmh).toFixed(2)}</td>
                <td><span class="badge ${typ}">${esc(v.violation_type)}</span></td>
                <td><span class="badge ${sev}">${esc(v.severity)}</span></td>
                <td>${esc(v.direction ?? '-')}</td>
                <td>${fmtTime(v.detected_at)}</td>
            </tr>`;
        }).join('');
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
