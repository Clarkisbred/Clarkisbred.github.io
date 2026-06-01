// ============================================================
//  admin.js — BreDucky admin panel
//  Features: login, broadcast, watch convos, takeover bots
// ============================================================
(function () {
  const ADMIN_PW   = window.BREDUCK_CONFIG.ADMIN_PW;
  const TRIGGER    = 'breduck';
  const BANNER_MS  = 10000;
  const SB_URL     = window.BREDUCK_CONFIG.SUPABASE_URL;
  const SB_KEY     = window.BREDUCK_CONFIG.SUPABASE_KEY;
  const HONK_TABLE = 'bd_announcements';
  const POND_HEADS = {
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + SB_KEY,
    'Content-Type': 'application/json',
  };

  let keyBuffer = '', bufferTimer = null, bannerTimer = null;

  // ── Desktop trigger: Shift + Alt + type "breduck" ─────────
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

  // ── Mobile trigger: tap 🦆 in drawer 30 times ─────────────
  let drawerDuckTaps = 0, drawerTapTimer = null;
  function attachDrawerTap() {
    const duck = document.querySelector('.drawer-duck');
    if (!duck) { setTimeout(attachDrawerTap, 300); return; }
    duck.style.cursor = 'pointer';
    duck.addEventListener('click', () => {
      drawerDuckTaps++;
      clearTimeout(drawerTapTimer);
      if (drawerDuckTaps % 5 === 0 && drawerDuckTaps < 30) {
        duck.title = `${30 - drawerDuckTaps} more taps…`;
      }
      if (drawerDuckTaps >= 30) {
        drawerDuckTaps = 0; duck.title = '';
        popAdminLogin();
      } else {
        drawerTapTimer = setTimeout(() => { drawerDuckTaps = 0; duck.title = ''; }, 4000);
      }
    });
  }
  document.addEventListener('DOMContentLoaded', attachDrawerTap);
  attachDrawerTap();

  // ── DOM refs ───────────────────────────────────────────────
  const adminBackdrop   = document.getElementById('bdLoginOverlay');
  const loginClose      = document.getElementById('bdLoginClose');
  const pwField         = document.getElementById('bdAdminPw');
  const enterBtn        = document.getElementById('bdAdminEnter');
  const loginErr        = document.getElementById('bdAdminErr');
  const panelBackdrop   = document.getElementById('bdPanelOverlay');
  const panelClose      = document.getElementById('bdPanelClose');
  const broadcastField  = document.getElementById('bdAnnounceText');
  const announceBtn     = document.getElementById('bdAnnounceSend');
  const logoutBtn       = document.getElementById('bdPanelLogout');
  const honkBanner      = document.getElementById('bdBanner');
  const honkBackdrop    = document.getElementById('bdBannerBackdrop');
  const bannerMsgEl     = document.getElementById('bdBannerMsg');
  const bannerClose     = document.getElementById('bdBannerClose');
  const botDuckBtn      = document.getElementById('adminBotDuck');
  const botShrimpyBtn   = document.getElementById('adminBotShrimpy');
  const spyList         = document.getElementById('bdSpyList');

  // Spy modal
  const spyOverlay      = document.getElementById('bdSpyOverlay');
  const spyClose        = document.getElementById('bdSpyClose');
  const spyTitle        = document.getElementById('bdSpyTitle');
  const spyMessages     = document.getElementById('bdSpyMessages');
  const spyTakeoverBtn  = document.getElementById('bdSpyTakeoverBtn');
  const spyInputRow     = document.getElementById('bdSpyInputRow');
  const spyInput        = document.getElementById('bdSpyInput');
  const spySend         = document.getElementById('bdSpySend');
  const spyRelease      = document.getElementById('bdSpyRelease');

  let selectedBot        = 'duck';
  let watchingSessionId  = null;
  let spyTakenOver       = false;
  let spyRefreshInterval = null;

  // ── Bot selector ───────────────────────────────────────────
  botDuckBtn.addEventListener('click', () => {
    selectedBot = 'duck';
    botDuckBtn.classList.add('active');
    botShrimpyBtn.classList.remove('active');
  });
  botShrimpyBtn.addEventListener('click', () => {
    selectedBot = 'shrimpy';
    botShrimpyBtn.classList.add('active');
    botDuckBtn.classList.remove('active');
  });

  // ── Login flow ─────────────────────────────────────────────
  function popAdminLogin() {
    adminBackdrop.classList.add('open');
    loginErr.textContent = ''; pwField.value = '';
    setTimeout(() => pwField.focus(), 200);
  }
  function ditchAdminLogin() {
    adminBackdrop.classList.remove('open');
    pwField.value = ''; loginErr.textContent = '';
  }
  function popAdminPanel() {
    panelBackdrop.classList.add('open');
    refreshSpyList();
    setTimeout(() => broadcastField.focus(), 200);
  }
  function ditchAdminPanel() { panelBackdrop.classList.remove('open'); }

  function verifyBeak() {
    if (pwField.value === ADMIN_PW) {
      sessionStorage.setItem('breduck-admin', '1');
      document.body.classList.add('breduck-admin-active');
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
    // release any takeovers
    if (window.bdSetTakeover) { window.bdSetTakeover('duck', false); window.bdSetTakeover('shrimpy', false); }
    ditchAdminPanel();
    closeSpyModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (adminBackdrop.classList.contains('open')) ditchAdminLogin();
      if (panelBackdrop.classList.contains('open')) ditchAdminPanel();
      if (spyOverlay.classList.contains('open')) closeSpyModal();
    }
  });

  // ── Spy List ───────────────────────────────────────────────
  function refreshSpyList() {
    const convos = window._bdConversations || {};
    const ids = Object.keys(convos);
    spyList.innerHTML = '';
    if (ids.length === 0) {
      spyList.innerHTML = '<p class="bd-spy-empty">No active chats yet.</p>';
      return;
    }
    // Sort by lastActive desc
    ids.sort((a, b) => (convos[b].lastActive || 0) - (convos[a].lastActive || 0));
    ids.forEach(id => {
      const c = convos[id];
      const item = document.createElement('div');
      item.className = 'bd-spy-item';

      const botEmoji = c.bot === 'duck' ? '🦆' : '🦐';
      const botName  = c.bot === 'duck' ? 'BreDucky' : 'Shrimpy';
      const msgCount = c.messages ? c.messages.length : 0;

      item.innerHTML = `
        <div>
          <div class="bd-spy-item-label">${botEmoji} ${botName} · ${c.userName}</div>
          <div class="bd-spy-item-meta">${msgCount} messages · ${timeAgo(c.lastActive)}</div>
        </div>
        <button class="bd-watch-btn" data-id="${id}">👁 Watch</button>
      `;
      item.querySelector('.bd-watch-btn').addEventListener('click', () => {
        ditchAdminPanel();
        openSpyModal(id);
      });
      spyList.appendChild(item);
    });
  }

  // Expose for chat.js to call
  window._bdRefreshSpyList = refreshSpyList;

  function timeAgo(ts) {
    if (!ts) return '';
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s/60) + 'm ago';
    return Math.floor(s/3600) + 'h ago';
  }

  // ── Spy Modal ──────────────────────────────────────────────
  function openSpyModal(sessionId) {
    watchingSessionId = sessionId;
    spyTakenOver = false;
    spyInputRow.style.display = 'none';
    spyTakeoverBtn.textContent = '🎭 Take Over';
    spyOverlay.classList.add('open');
    renderSpyMessages();
    // Auto-refresh spy messages
    clearInterval(spyRefreshInterval);
    spyRefreshInterval = setInterval(() => {
      if (watchingSessionId) renderSpyMessages();
    }, 1000);
  }

  function closeSpyModal() {
    spyOverlay.classList.remove('open');
    watchingSessionId = null;
    spyTakenOver = false;
    clearInterval(spyRefreshInterval);
    // Release takeover
    if (window.bdSetTakeover) {
      window.bdSetTakeover('duck', false);
      window.bdSetTakeover('shrimpy', false);
    }
  }

  function renderSpyMessages() {
    if (!watchingSessionId) return;
    const c = (window._bdConversations || {})[watchingSessionId];
    if (!c) return;

    const botEmoji = c.bot === 'duck' ? '🦆' : '🦐';
    const botName  = c.bot === 'duck' ? 'BreDucky' : 'Shrimpy';
    spyTitle.textContent = `👁 ${botEmoji} ${botName} ↔ ${c.userName}`;

    // Only re-render if message count changed
    const currentCount = spyMessages.querySelectorAll('.msg').length;
    if (c.messages && c.messages.length !== currentCount) {
      spyMessages.innerHTML = '';
      (c.messages || []).forEach(m => {
        const div = document.createElement('div');
        const isBot = m.role === 'assistant';
        div.className = 'msg ' + (isBot ? 'msg-bot' : 'msg-user');
        // Label each message
        const label = document.createElement('div');
        label.style.cssText = 'font-size:0.68rem;color:#999;margin-bottom:0.2rem;font-weight:700;';
        label.textContent = isBot ? `${botEmoji} ${botName}` : `👤 ${c.userName}`;
        div.prepend(label);
        div.appendChild(document.createTextNode(m.content));
        spyMessages.appendChild(div);
      });
      spyMessages.scrollTop = spyMessages.scrollHeight;
    }
  }

  // Expose for chat.js
  window._bdSpyUpdateConvo = (id) => { if (id === watchingSessionId) renderSpyMessages(); };

  spyClose.addEventListener('click', closeSpyModal);
  spyOverlay.addEventListener('click', e => { if (e.target === spyOverlay) closeSpyModal(); });

  // ── Take Over from spy modal ───────────────────────────────
  spyTakeoverBtn.addEventListener('click', () => {
    if (!watchingSessionId) return;
    const c = (window._bdConversations || {})[watchingSessionId];
    if (!c) return;

    spyTakenOver = !spyTakenOver;
    spyInputRow.style.display = spyTakenOver ? 'flex' : 'none';
    spyTakeoverBtn.textContent = spyTakenOver ? '🤖 Release Bot' : '🎭 Take Over';

    if (window.bdSetTakeover) {
      window.bdSetTakeover(c.bot, spyTakenOver);
    }
  });

  spySend.addEventListener('click', sendSpyMessage);
  spyInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendSpyMessage(); });

  function sendSpyMessage() {
    const text = spyInput.value.trim();
    if (!text || !watchingSessionId) return;
    spyInput.value = '';
    const c = (window._bdConversations || {})[watchingSessionId];
    if (!c) return;

    // Inject as bot message
    if (c.bot === 'duck') {
      const msgs = window._bdDuckHistory;
      msgs.push({ role: 'assistant', content: text });
      // Also render in duck chat
      const duckMsgs = document.getElementById('duckMessages');
      if (duckMsgs && window._bdAppendMsg) window._bdAppendMsg(duckMsgs, text, 'bot', 'duck');
      if (window._bdSyncRegistry) window._bdSyncRegistry('duck', msgs, c.userName);
    } else {
      const msgs = window._bdShrimpyHistory;
      msgs.push({ role: 'assistant', content: text });
      const shrimpyMsgs = document.getElementById('shrimpyMessages');
      if (shrimpyMsgs && window._bdAppendMsg) window._bdAppendMsg(shrimpyMsgs, text, 'bot', 'shrimpy');
      if (window._bdSyncRegistry) window._bdSyncRegistry('shrimpy', msgs, c.userName);
    }
    renderSpyMessages();
  }

  spyRelease.addEventListener('click', () => {
    spyTakenOver = false;
    spyInputRow.style.display = 'none';
    spyTakeoverBtn.textContent = '🎭 Take Over';
    if (window.bdSetTakeover) {
      window.bdSetTakeover('duck', false);
      window.bdSetTakeover('shrimpy', false);
    }
  });

  // ── Broadcast ──────────────────────────────────────────────
  announceBtn.addEventListener('click', async () => {
    const text = broadcastField.value.trim();
    if (!text) return;
    announceBtn.textContent = '📡 Sending…';
    announceBtn.disabled = true;
    try {
      const res = await fetch(SB_URL + '/rest/v1/' + HONK_TABLE, {
        method: 'POST',
        headers: Object.assign({}, POND_HEADS, { 'Prefer': 'return=minimal' }),
        body: JSON.stringify({ message: text, created_at: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(await res.text());
      ditchAdminPanel();
      broadcastField.value = '';
      slapBanner(text);
    } catch (err) { console.error('Broadcast failed:', err); }
    finally { announceBtn.textContent = '📢 Broadcast Now'; announceBtn.disabled = false; }
  });

  // ── Poll Supabase announcements ───────────────────────────
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
    } catch (e) {}
  }
  listenForHonks();
  setInterval(listenForHonks, 4000);

  // ── Banner ─────────────────────────────────────────────────
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
  function killBanner() {
    honkBanner.classList.remove('show');
    honkBackdrop.classList.remove('show');
  }
  honkBackdrop.addEventListener('click', () => { clearTimeout(bannerTimer); killBanner(); });
  bannerClose.addEventListener('click', () => { clearTimeout(bannerTimer); killBanner(); });

  // ── Banner pfp ─────────────────────────────────────────────
  const heroPfpEl = document.querySelector('.hero-profile img');
  if (heroPfpEl) {
    const setPfp = () => { const el = document.getElementById('bdBannerPfp'); if (el && heroPfpEl.src) el.src = heroPfpEl.src; };
    heroPfpEl.complete ? setPfp() : heroPfpEl.addEventListener('load', setPfp);
    setTimeout(setPfp, 200);
  }

  // ── Refresh spy list when panel opens ─────────────────────
  const panelObserver = new MutationObserver(() => {
    if (panelBackdrop.classList.contains('open')) refreshSpyList();
  });
  panelObserver.observe(panelBackdrop, { attributes: true, attributeFilter: ['class'] });

  // ── Expose for direct takeover from panel bot buttons ─────
  window.bdOpenTakeover = function() {
    if (window.bdSetTakeover) window.bdSetTakeover(selectedBot, true);
    if (selectedBot === 'duck' && window.bdOpenDuckChat) window.bdOpenDuckChat();
    if (selectedBot === 'shrimpy' && window.bdOpenShrimpyChat) window.bdOpenShrimpyChat();
  };
})();
