const $ = (s) => document.querySelector(s);

document.addEventListener('DOMContentLoaded', async () => {
    // If already logged in, skip to dashboard
    try {
        const res = await fetch('api/session.php');
        if (res.ok) { location.href = 'dashboard.html'; return; }
    } catch {}

    $('#loginBtn').addEventListener('click', doLogin);
    $('#password').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
    $('#identifier').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
});

async function doLogin() {
    const identifier = $('#identifier').value.trim();
    const password = $('#password').value.trim();
    const err = $('#loginError');
    err.style.display = 'none';

    if (!identifier || !password) {
        err.textContent = 'Please enter both fields.';
        err.style.display = '';
        return;
    }

    const body = new URLSearchParams({ identifier, password });
    try {
        const res = await fetch('api/login.php', { method: 'POST', body });
        const data = await res.json();
        if (!res.ok) {
            err.textContent = data.error || 'Login failed';
            err.style.display = '';
            return;
        }
        location.href = 'dashboard.html';
    } catch (e) {
        err.textContent = 'Network error';
        err.style.display = '';
    }
}
