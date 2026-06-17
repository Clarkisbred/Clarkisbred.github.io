(function() {
  const ADMIN_PW   = window.BREDUCK_CONFIG.ADMIN_PW;
  const TRIGGER    = 'breduck';
  const BANNER_MS  = 10000;
  const SB_URL     = window.BREDUCK_CONFIG.SUPABASE_URL;
  const SB_KEY     = window.BREDUCK_CONFIG.SUPABASE_KEY;
  const HONK_TABLE = 'bd_announcements';
  const POND_HEADS = { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };

  let keyBuffer = '', bufferTimer = null, bannerTimer = null;

  // ── Desktop trigger: Shift + Alt + type "breduck" ─────────────────────────
  document.addEventListener('keydown', e => {
    if (!e.shiftKey || !e.altKey || e.key.length !== 1 || !/[a-zA-Z]/.test(e.key)) {
      if (!e.shiftKey || !e.altKey) { keyBuffer = ''; clearTimeout(bufferTimer); }
      return;
    }
    const tag = document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    keyBuffer += e.key.toLowerCase();
    if (keyBuffer.length > TRIGGER.length) keyBuffer = keyBuffer.slice(-TRIGGER.length);
    clearTimeout(bufferTimer);
    bufferTimer = setTimeout(() => { keyBuffer = ''; }, 2000);
    if (keyBuffer === TRIGGER) { keyBuffer = ''; popAdminLogin(); }
  });

  // ── Mobile trigger: tap the 🦆 in drawer 30 times ─────────────────────────
  let drawerDuckTaps = 0, drawerTapTimer = null;
  // wait for DOM, then attach
  function attachDrawerTap() {
    const duck = document.querySelector('.drawer-duck');
    if (!duck) { setTimeout(attachDrawerTap, 300); return; }
    duck.style.cursor = 'pointer';
    duck.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') duck.click(); });
    duck.addEventListener('click', () => {
      drawerDuckTaps++;
      clearTimeout(drawerTapTimer);
      // show progress every 5 taps
      if (drawerDuckTaps % 5 === 0 && drawerDuckTaps < 30) {
        duck.title = `${30 - drawerDuckTaps} more taps…`;
      }
      if (drawerDuckTaps >= 30) {
        drawerDuckTaps = 0;
        duck.title = '';
        popAdminLogin();
      } else {
        // reset after 4 seconds of inactivity
        drawerTapTimer = setTimeout(() => {
          drawerDuckTaps = 0;
          duck.title = '';
        }, 4000);
      }
    });
  }
  document.addEventListener('DOMContentLoaded', attachDrawerTap);
  // also try immediately in case DOM is ready
  attachDrawerTap();

  // ── DOM refs ────────────────────────────────────────────────────────────────
  const adminBackdrop  = document.getElementById('bdLoginOverlay');
  const loginClose     = document.getElementById('bdLoginClose');
  const pwField        = document.getElementById('bdAdminPw');
  const enterBtn       = document.getElementById('bdAdminEnter');
  const loginErr       = document.getElementById('bdAdminErr');
  const panelBackdrop  = document.getElementById('bdPanelOverlay');
  const panelClose     = document.getElementById('bdPanelClose');
  const broadcastField = document.getElementById('bdAnnounceText');
  const announceBtn    = document.getElementById('bdAnnounceSend');
  const logoutBtn      = document.getElementById('bdPanelLogout');
  const honkBanner     = document.getElementById('bdBanner');
  const honkBackdrop   = document.getElementById('bdBannerBackdrop');
  const bannerMsgEl    = document.getElementById('bdBannerMsg');
  const bannerClose    = document.getElementById('bdBannerClose');

  // Set banner pfp
  const heroPfpEl = document.querySelector('.hero-profile img');
  if (heroPfpEl) {
    const setPfp = () => { const el = document.getElementById('bdBannerPfp'); if (el && heroPfpEl.src) el.src = heroPfpEl.src; };
    heroPfpEl.complete ? setPfp() : heroPfpEl.addEventListener('load', setPfp);
    setTimeout(setPfp, 200);
  }

  function popAdminLogin() {
    adminBackdrop.classList.add('open');
    loginErr.textContent = ''; pwField.value = '';
    setTimeout(() => pwField.focus(), 200);
  }
  function ditchAdminLogin() { adminBackdrop.classList.remove('open'); pwField.value = ''; loginErr.textContent = ''; }
  function popAdminPanel() { panelBackdrop.classList.add('open'); setTimeout(() => broadcastField.focus(), 200); }
  function ditchAdminPanel() { panelBackdrop.classList.remove('open'); }

  function verifyBeak() {
    if (pwField.value === ADMIN_PW) {
      sessionStorage.setItem('breduck-admin', '1');
      document.body.classList.add('breduck-admin-active');
      // tell chat.js Clark is here
      if (window.bdSetDuckName) window.bdSetDuckName('Clark');
      ditchAdminLogin();
      popAdminPanel();
    } else {
      loginErr.textContent = 'Incorrect password.';
      pwField.classList.remove('shake');
      void pwField.offsetWidth;
      pwField.classList.add('shake');
      pwField.value = '';
      setTimeout(() => pwField.classList.remove('shake'), 400);
    }
  }

  loginClose.addEventListener('click', ditchAdminLogin);
  adminBackdrop.addEventListener('click', e => { if (e.target === adminBackdrop) ditchAdminLogin(); });
  enterBtn.addEventListener('click', verifyBeak);
  pwField.addEventListener('keydown', e => { if (e.key === 'Enter') verifyBeak(); });
  panelClose.addEventListener('click', ditchAdminPanel);
  panelBackdrop.addEventListener('click', e => { if (e.target === panelBackdrop) ditchAdminPanel(); });
  logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('breduck-admin');
    sessionStorage.removeItem('breduck-tts');
    document.body.classList.remove('breduck-admin-active');
    ditchAdminPanel();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (adminBackdrop.classList.contains('open')) ditchAdminLogin();
      if (panelBackdrop.classList.contains('open')) ditchAdminPanel();
    }
  });

  // ── Inject extra admin panel buttons after panel loads ────────────────────
  function injectAdminExtras() {
    const panel = document.querySelector('.bd-panel');
    if (!panel || document.getElementById('bdTakeoverBtn')) return;

    const divider = document.createElement('div');
    divider.className = 'bd-panel-divider';
    divider.style.margin = '1rem 0 0.8rem';

    const label = document.createElement('div');
    label.className = 'bd-panel-label';
    label.textContent = 'Clark Takeover & Voice';
    label.style.marginBottom = '0.6rem';

    // Takeover button
    const takeoverBtn = document.createElement('button');
    takeoverBtn.id = 'bdTakeoverBtn';
    takeoverBtn.className = 'admin-btn-primary';
    takeoverBtn.style.cssText = 'width:100%;justify-content:center;margin-bottom:0.5rem;display:flex;align-items:center;gap:0.4rem;background:var(--yellow,#F5C842);color:#111;border:none;padding:0.65rem 1.2rem;font-family:inherit;font-size:0.72rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;';
    takeoverBtn.innerHTML = '🎭 Takeover (BreDucky & Shrimpy)';
    takeoverBtn.addEventListener('click', () => { ditchAdminPanel(); if (window.bdOpenTakeover) window.bdOpenTakeover(); });

    // Mic button
    const micBtn = document.createElement('button');
    micBtn.id = 'bdMicBtn';
    micBtn.className = 'admin-btn-primary';
    micBtn.style.cssText = 'width:100%;justify-content:center;margin-bottom:0.5rem;display:flex;align-items:center;gap:0.4rem;background:var(--surface,#fff);border:1px solid var(--border,#eee);color:var(--text,#111);padding:0.65rem 1.2rem;font-family:inherit;font-size:0.72rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;';
    micBtn.innerHTML = '🎙️ Talk to BreDucky (Mic)';
    micBtn.addEventListener('click', () => {
      ditchAdminPanel();
      if (window.bdOpenDuckChat) window.bdOpenDuckChat();
      setTimeout(() => { if (window.bdToggleMic) window.bdToggleMic(); }, 400);
    });

    // TTS toggle button
    const ttsBtn = document.createElement('button');
    ttsBtn.id = 'bdTtsToggleBtn';
    ttsBtn.className = 'admin-btn-primary';
    ttsBtn.style.cssText = 'width:100%;justify-content:center;margin-bottom:0.5rem;display:flex;align-items:center;gap:0.4rem;background:var(--surface,#fff);border:1px solid var(--border,#eee);color:var(--text,#111);padding:0.65rem 1.2rem;font-family:inherit;font-size:0.72rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;';
    ttsBtn.textContent = sessionStorage.getItem('breduck-tts') === '1' ? '🔊 TTS On' : '🔇 TTS Off';
    ttsBtn.addEventListener('click', () => { if (window.bdToggleTTS) window.bdToggleTTS(); });

    const hint = document.createElement('div');
    hint.className = 'bd-panel-hint';
    hint.textContent = 'TTS: BreDucky speaks replies aloud. Mic: talk to him directly.';

    panel.insertBefore(hint, logoutBtn);
    panel.insertBefore(ttsBtn, hint);
    panel.insertBefore(micBtn, ttsBtn);
    panel.insertBefore(takeoverBtn, micBtn);
    panel.insertBefore(label, takeoverBtn);
    panel.insertBefore(divider, label);
  }

  // inject when panel opens
  const panelObserver = new MutationObserver(() => {
    if (panelBackdrop.classList.contains('open')) injectAdminExtras();
  });
  panelObserver.observe(panelBackdrop, { attributes: true, attributeFilter: ['class'] });

  // ── Broadcast ────────────────────────────────────────────────────────────────
  announceBtn.addEventListener('click', async () => {
    const text = broadcastField.value.trim();
    if (!text) return;
    announceBtn.textContent = '📡 Sending…';
    announceBtn.disabled = true;
    try {
      const res = await fetch(SB_URL + '/rest/v1/' + HONK_TABLE, {
        method: 'POST',
        headers: Object.assign({}, POND_HEADS, { 'Prefer': 'return=minimal' }),
        body: JSON.stringify({ message: text, created_at: new Date().toISOString() })
      });
      if (!res.ok) throw new Error(await res.text());
      ditchAdminPanel();
      broadcastField.value = '';
      slapBanner(text);
    } catch (err) { console.error('Broadcast failed:', err); }
    finally { announceBtn.textContent = '📢 Broadcast Now'; announceBtn.disabled = false; }
  });

  // ── Polling ──────────────────────────────────────────────────────────────────
  let lastSeenId = null, pollInitialized = false;
  async function listenForHonks() {
    try {
      const res = await fetch(
        SB_URL + '/rest/v1/' + HONK_TABLE + '?select=id,message,created_at&order=created_at.desc&limit=1',
        { headers: POND_HEADS }
      );
      if (!res.ok) return;
      const rows = await res.json();
      if (!rows.length) { pollInitialized = true; return; }
      const latest = rows[0];
      if (!pollInitialized) { lastSeenId = latest.id; pollInitialized = true; return; }
      if (latest.id !== lastSeenId) {
        const age = Date.now() - new Date(latest.created_at).getTime();
        lastSeenId = latest.id;
        if (age < 15000) slapBanner(latest.message);
      }
    } catch(e) {}
  }
  listenForHonks();
  setInterval(listenForHonks, 4000);

  function slapBanner(text) {
    clearTimeout(bannerTimer);
    const oldBar = document.getElementById('bdBannerBar');
    const newBar = oldBar.cloneNode();
    oldBar.parentNode.replaceChild(newBar, oldBar);
    bannerMsgEl.textContent = text;
    honkBackdrop.classList.add('show');
    honkBanner.classList.add('show');
    bannerTimer = setTimeout(killBanner, BANNER_MS);
  }
  function killBanner() { honkBanner.classList.remove('show'); honkBackdrop.classList.remove('show'); }
  honkBackdrop.addEventListener('click', () => { clearTimeout(bannerTimer); killBanner(); });
  bannerClose.addEventListener('click', () => { clearTimeout(bannerTimer); killBanner(); });

  // show delete buttons when admin logged in
  setInterval(() => {
    const isAdmin = sessionStorage.getItem('breduck-admin') === '1';
    document.querySelectorAll('.anon-delete-btn').forEach(b => { b.style.display = isAdmin ? 'flex' : 'none'; });
  }, 1000);
})();
