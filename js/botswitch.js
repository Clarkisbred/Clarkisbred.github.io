(function() {
  // ── Bot Switcher ─────────────────────────────────────────────────────────────
  let activeBot = localStorage.getItem('bd-active-bot') || 'duck';

  const bubble     = document.getElementById('bdChatBubble');
  const switcher   = document.getElementById('bdBotSwitcher');
  const toggle     = document.getElementById('bdBotToggle');
  const toggleBall = toggle ? toggle.querySelector('.bd-bot-toggle-ball') : null;
  const nameBadge  = document.getElementById('bdBotNameBadge');
  const duckWindow = document.getElementById('bdChatWindow');
  const spWindow   = document.getElementById('spChatWindow');
  const spToggle   = document.getElementById('spBotToggle');

  // ── Hover popup above the floating bubble ──────────────────────────────────
  // Inject the popup HTML once
  const popup = document.createElement('div');
  popup.id = 'bdBotHoverPopup';
  popup.innerHTML = `
    <button id="bdHoverDuck" class="bd-hover-bot-btn ${activeBot === 'duck' ? 'active' : ''}">
      <span class="bd-hover-bot-emoji">🦆</span>
      <span class="bd-hover-bot-label">BreDucky</span>
    </button>
    <button id="bdHoverShrimp" class="bd-hover-bot-btn ${activeBot === 'shrimp' ? 'active' : ''}">
      <span class="bd-hover-bot-emoji"><img src="shrimpy.jpg" alt="Shrimpy" style="width:22px;height:22px;object-fit:cover;border-radius:50%;vertical-align:middle;"></span>
      <span class="bd-hover-bot-label">Shrimpy</span>
    </button>
  `;
  document.body.appendChild(popup);

  // Inject styles
  const style = document.createElement('style');
  style.textContent = `
    #bdBotHoverPopup {
      position: fixed;
      bottom: 90px;
      right: 24px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: 999990;
      opacity: 0;
      pointer-events: none;
      transform: translateY(8px);
      transition: opacity 0.18s ease, transform 0.18s ease;
    }
    #bdBotHoverPopup.visible {
      opacity: 1;
      pointer-events: all;
      transform: translateY(0);
    }
    .bd-hover-bot-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--surface, #fff);
      border: 1.5px solid var(--border, #e5e5e5);
      border-radius: 999px;
      padding: 7px 16px 7px 10px;
      font-family: inherit;
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--text, #111);
      cursor: pointer;
      box-shadow: 0 2px 12px rgba(0,0,0,0.10);
      transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
      white-space: nowrap;
    }
    .bd-hover-bot-btn:hover {
      border-color: var(--yellow-dark, #d4a017);
      box-shadow: 0 4px 18px rgba(0,0,0,0.14);
    }
    .bd-hover-bot-btn.active {
      background: var(--yellow, #F5C842);
      border-color: var(--yellow-dark, #d4a017);
      color: #111;
    }
    .bd-hover-bot-btn.active.shrimpy-btn {
      background: var(--shrimpy, #FF6B9D);
      border-color: #e0457a;
      color: #fff;
    }
    .bd-hover-bot-emoji {
      display: flex;
      align-items: center;
      font-size: 1.1rem;
    }
    @media (max-width: 480px) {
      #bdBotHoverPopup {
        bottom: 84px;
        right: 16px;
      }
    }
  `;
  document.head.appendChild(style);

  const hoverDuckBtn  = document.getElementById('bdHoverDuck');
  const hoverShrimpBtn = document.getElementById('bdHoverShrimp');

  // Add shrimpy class for active styling
  hoverShrimpBtn && hoverShrimpBtn.classList.add('shrimpy-btn');

  let popupHideTimer = null;

  function showPopup() {
    clearTimeout(popupHideTimer);
    popup.classList.add('visible');
  }

  function scheduleHidePopup() {
    clearTimeout(popupHideTimer);
    popupHideTimer = setTimeout(() => popup.classList.remove('visible'), 300);
  }

  // Show on hover over bubble OR popup itself
  bubble && bubble.addEventListener('mouseenter', showPopup);
  bubble && bubble.addEventListener('mouseleave', scheduleHidePopup);
  popup.addEventListener('mouseenter', showPopup);
  popup.addEventListener('mouseleave', scheduleHidePopup);

  // Touch: show popup on long-press or tap when chat is closed (mobile)
  let touchTimer = null;
  bubble && bubble.addEventListener('touchstart', () => {
    touchTimer = setTimeout(showPopup, 400);
  }, { passive: true });
  bubble && bubble.addEventListener('touchend', () => clearTimeout(touchTimer), { passive: true });

  function applyBotUI() {
    if (!bubble) return;
    if (activeBot === 'shrimp') {
      bubble.innerHTML = '<img src="shrimpy.jpg" alt="Shrimpy" style="width:36px;height:36px;object-fit:cover;border-radius:50%;">';
      bubble.appendChild(createUnreadPip());
      bubble.classList.add('shrimpy-mode');
      toggle && toggle.classList.add('shrimpy-active');
      if (toggleBall) toggleBall.innerHTML = '<img src="shrimpy.jpg" alt="Shrimpy" style="width:16px;height:16px;object-fit:cover;border-radius:50%;">';
      nameBadge && (nameBadge.textContent = 'Shrimpy');
      nameBadge && nameBadge.classList.add('shrimpy');
    } else {
      bubble.textContent = '🦆';
      bubble.appendChild(createUnreadPip());
      bubble.classList.remove('shrimpy-mode');
      toggle && toggle.classList.remove('shrimpy-active');
      toggleBall && (toggleBall.textContent = '🦆');
      nameBadge && (nameBadge.textContent = 'BreDucky');
      nameBadge && nameBadge.classList.remove('shrimpy');
    }
    // Update hover popup active states
    hoverDuckBtn && hoverDuckBtn.classList.toggle('active', activeBot === 'duck');
    hoverShrimpBtn && hoverShrimpBtn.classList.toggle('active', activeBot === 'shrimp');
  }

  function createUnreadPip() {
    let pip = document.getElementById('bdChatUnread');
    if (!pip) {
      pip = document.createElement('div');
      pip.className = 'bd-chat-unread';
      pip.id = 'bdChatUnread';
    }
    return pip;
  }

  // ── Core switch: set bot, update UI, open window ───────────────────────────
  function activateBot(bot) {
    if (bot === activeBot) {
      // Already this bot — just open its window
      openBotWindow(bot);
      return;
    }
    // Close both windows
    duckWindow && duckWindow.classList.remove('open');
    spWindow && spWindow.classList.remove('open');
    activeBot = bot;
    localStorage.setItem('bd-active-bot', activeBot);
    applyBotUI();
    popup.classList.remove('visible');
    setTimeout(() => openBotWindow(bot), 50);
  }

  function openBotWindow(bot) {
    if (bot === 'shrimp') {
      window.spOpen && window.spOpen();
    } else {
      // Must handle the name-prompt the same way the bubble click does
      const duckName = localStorage.getItem('bd-username') ||
                       (sessionStorage.getItem('breduck-admin') === '1' ? 'Clark' : null);
      if (!duckName && window.bdAskDuckName) {
        window.bdAskDuckName();
      } else {
        window.bdOpenDuckChat && window.bdOpenDuckChat();
      }
    }
  }

  function switchBot() {
    activateBot(activeBot === 'duck' ? 'shrimp' : 'duck');
  }

  // Hover popup buttons
  hoverDuckBtn && hoverDuckBtn.addEventListener('click', e => {
    e.stopPropagation();
    activateBot('duck');
  });
  hoverShrimpBtn && hoverShrimpBtn.addEventListener('click', e => {
    e.stopPropagation();
    activateBot('shrimp');
  });

  // Keep existing in-header toggle working too
  toggle && toggle.addEventListener('click', e => {
    e.stopPropagation();
    switchBot();
  });
  spToggle && spToggle.addEventListener('click', e => {
    e.stopPropagation();
    switchBot();
  });

  // ── Bubble click: open correct bot window ──────────────────────────────────
  if (bubble) {
    bubble.addEventListener('click', e => {
      e.stopPropagation();

      const duckOpen = duckWindow && duckWindow.classList.contains('open');
      const spOpen   = spWindow && spWindow.classList.contains('open');

      if (activeBot === 'shrimp') {
        if (!spOpen) {
          duckWindow && duckWindow.classList.remove('open');
          window.spOpen && window.spOpen();
        } else {
          window.spClose && window.spClose();
        }
      } else {
        if (!duckOpen) {
          spWindow && spWindow.classList.remove('open');
          openBotWindow('duck');
        } else {
          duckWindow.classList.remove('open');
          window.bdCloseDuckChat && window.bdCloseDuckChat();
        }
      }
    }, true); // capture phase
  }

  // ── Takeover Panel ──────────────────────────────────────────────────────────
  const toOverlay   = document.getElementById('bdTakeoverOverlay');
  const toModal     = document.getElementById('bdTakeoverModal');
  const toConvo     = document.getElementById('bdToConvo');
  const toInput     = document.getElementById('bdTakeoverInput');
  const toSendBtn   = document.getElementById('bdTakeoverSend');
  const toExitBtn   = document.getElementById('bdTakeoverExit') || document.getElementById('bdTakeoverClose');
  const toStatus    = document.getElementById('bdTakeoverStatus');
  const toTabDuck   = document.getElementById('bdToTabDuck');
  const toTabShrimp = document.getElementById('bdToTabShrimp');

  let toActiveBot = 'duck';
  // Track which bots Clark has taken over (per-bot, not per-session global)
  const takenOver = { duck: false, shrimp: false };

  // ── Inject takeover toggle button into the panel header ──────────────────
  function injectTakeoverToggle() {
    if (document.getElementById('bdToTakeoverToggle')) return;
    const header = toModal && toModal.querySelector('.bd-takeover-header');
    if (!header) return;

    const toggleWrap = document.createElement('div');
    toggleWrap.style.cssText = 'display:flex;align-items:center;gap:0.6rem;margin-top:0.5rem;padding:0.6rem 0.8rem;background:var(--bg2,#f5f5f5);border-radius:8px;border:1px solid var(--border,#eee);';
    toggleWrap.id = 'bdToTakeoverToggle';

    const label = document.createElement('span');
    label.style.cssText = 'font-size:0.72rem;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:var(--text3,#888);flex:1;';
    label.textContent = 'AI Control';

    const duckToggleBtn = document.createElement('button');
    duckToggleBtn.id = 'bdToDuckToggle';
    duckToggleBtn.style.cssText = 'font-size:0.7rem;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;padding:0.3rem 0.75rem;border-radius:6px;border:1.5px solid var(--border,#eee);background:var(--surface,#fff);color:var(--text,#111);cursor:pointer;transition:all 0.15s;';
    duckToggleBtn.textContent = '🦆 AI On';

    const shrimpToggleBtn = document.createElement('button');
    shrimpToggleBtn.id = 'bdToShrimpToggle';
    shrimpToggleBtn.style.cssText = 'font-size:0.7rem;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;padding:0.3rem 0.75rem;border-radius:6px;border:1.5px solid var(--border,#eee);background:var(--surface,#fff);color:var(--text,#111);cursor:pointer;transition:all 0.15s;';
    shrimpToggleBtn.textContent = '🦐 AI On';

    duckToggleBtn.addEventListener('click', () => toggleBotTakeover('duck', duckToggleBtn));
    shrimpToggleBtn.addEventListener('click', () => toggleBotTakeover('shrimp', shrimpToggleBtn));

    toggleWrap.appendChild(label);
    toggleWrap.appendChild(duckToggleBtn);
    toggleWrap.appendChild(shrimpToggleBtn);
    header.insertAdjacentElement('afterend', toggleWrap);
  }

  function updateToggleBtns() {
    const dBtn = document.getElementById('bdToDuckToggle');
    const sBtn = document.getElementById('bdToShrimpToggle');
    if (dBtn) {
      if (takenOver.duck) {
        dBtn.textContent = '🦆 AI Off';
        dBtn.style.background = '#F5C842';
        dBtn.style.borderColor = '#d4a017';
        dBtn.style.color = '#111';
      } else {
        dBtn.textContent = '🦆 AI On';
        dBtn.style.background = 'var(--surface,#fff)';
        dBtn.style.borderColor = 'var(--border,#eee)';
        dBtn.style.color = 'var(--text,#111)';
      }
    }
    if (sBtn) {
      if (takenOver.shrimp) {
        sBtn.textContent = '🦐 AI Off';
        sBtn.style.background = '#FF6B9D';
        sBtn.style.borderColor = '#e0457a';
        sBtn.style.color = '#fff';
      } else {
        sBtn.textContent = '🦐 AI On';
        sBtn.style.background = 'var(--surface,#fff)';
        sBtn.style.borderColor = 'var(--border,#eee)';
        sBtn.style.color = 'var(--text,#111)';
      }
    }
  }

  function toggleBotTakeover(bot, btn) {
    takenOver[bot] = !takenOver[bot];
    if (bot === 'duck') {
      if (window.bdSetTakeover) window.bdSetTakeover(takenOver.duck);
    } else {
      if (window.spSetTakeover) window.spSetTakeover(takenOver.shrimp);
    }
    updateToggleBtns();
    // Status feedback
    if (toStatus) {
      const name = bot === 'duck' ? 'BreDucky' : 'Shrimpy';
      toStatus.textContent = takenOver[bot]
        ? `🎭 You're now controlling ${name}! AI is paused.`
        : `🤖 ${name}'s AI is back online.`;
      setTimeout(() => { if (toStatus) toStatus.textContent = ''; }, 2500);
    }
  }

  function openTakeover() {
    if (!toOverlay) return;
    toOverlay.style.opacity = '1'; toOverlay.style.pointerEvents = 'all';
    toModal && (toModal.style.transform = 'translateY(0)');
    injectTakeoverToggle();
    updateToggleBtns();
    renderToConvo();
    setTimeout(() => toInput && toInput.focus(), 300);
  }

  function closeTakeover() {
    if (!toOverlay) return;
    // Restore AI for both bots on exit
    if (takenOver.duck) {
      takenOver.duck = false;
      if (window.bdSetTakeover) window.bdSetTakeover(false);
    }
    if (takenOver.shrimp) {
      takenOver.shrimp = false;
      if (window.spSetTakeover) window.spSetTakeover(false);
    }
    updateToggleBtns();
    toOverlay.style.opacity = '0'; toOverlay.style.pointerEvents = 'none';
    toModal && (toModal.style.transform = 'translateY(20px)');
  }

  // ── Real-time: when a user message comes in while in takeover, flash the panel ──
  window._bdTakeoverOnUserMsg = function(bot, text) {
    // If takeover panel is open on the right tab, just refresh
    if (toOverlay && toOverlay.style.opacity === '1' && toActiveBot === bot) {
      renderToConvo();
      // Flash the convo area to signal new message
      if (toConvo) {
        toConvo.style.boxShadow = '0 0 0 2px ' + (bot === 'duck' ? '#F5C842' : '#FF6B9D');
        setTimeout(() => { if (toConvo) toConvo.style.boxShadow = ''; }, 600);
      }
    }
    // If panel is not on this bot's tab, pulse the tab button
    if (toOverlay && toOverlay.style.opacity === '1' && toActiveBot !== bot) {
      const tab = bot === 'duck' ? toTabDuck : toTabShrimp;
      if (tab) {
        tab.style.animation = 'none';
        tab.textContent = (bot === 'duck' ? '🦆 BreDucky' : '🦐 Shrimpy') + ' 🔴';
        setTimeout(() => { tab.textContent = bot === 'duck' ? '🦆 BreDucky' : '🦐 Shrimpy'; }, 3000);
      }
    }
  };

  window._bdTakeoverOnBotMsg = function(bot, text) {
    if (toOverlay && toOverlay.style.opacity === '1' && toActiveBot === bot) {
      renderToConvo();
    }
  };

  function renderToConvo() {
    if (!toConvo) return;
    let log = toActiveBot === 'duck'
      ? (window.bdGetChatLog ? window.bdGetChatLog() : [])
      : (window.spGetLog ? window.spGetLog() : []);

    const wasAtBottom = toConvo.scrollHeight - toConvo.scrollTop - toConvo.clientHeight < 40;

    toConvo.innerHTML = '';
    if (!log.length) {
      const empty = document.createElement('div');
      empty.className = 'bd-takeover-empty';
      empty.textContent = 'No messages yet. The conversation will appear here live.';
      toConvo.appendChild(empty);
      return;
    }

    log.forEach(m => {
      const row = document.createElement('div');
      const isUser = m.role === 'user';
      row.className = 'bd-to-msg' + (isUser ? ' user' : '') + (!isUser && toActiveBot === 'shrimp' ? ' shrimpy-bot' : '');

      const pfp = document.createElement('div');
      pfp.className = 'bd-to-pfp' + (!isUser && toActiveBot === 'shrimp' ? ' shrimpy-pfp' : '');
      if (isUser) {
        pfp.textContent = '🧑';
      } else if (toActiveBot === 'shrimp') {
        pfp.innerHTML = '<img src="shrimpy.jpg" alt="Shrimpy" style="width:100%;height:100%;object-fit:cover;display:block;">';
      } else {
        pfp.textContent = '🦆';
        pfp.style.background = 'var(--yellow,#F5C842)';
      }

      const bub = document.createElement('div');
      bub.className = 'bd-to-bubble';
      // Tag messages injected by Clark
      if (m.content && m.content.startsWith && m.role === 'assistant') {
        bub.textContent = m.content;
        // Subtle "Clark" tag if from a takeover message
        if (m._fromClark) {
          const tag = document.createElement('span');
          tag.style.cssText = 'display:block;font-size:0.6rem;opacity:0.55;margin-top:0.2rem;letter-spacing:0.06em;text-transform:uppercase;';
          tag.textContent = '— Clark (you)';
          bub.appendChild(tag);
        }
      } else {
        bub.textContent = m.content;
      }

      row.appendChild(pfp); row.appendChild(bub);
      toConvo.appendChild(row);
    });

    if (wasAtBottom) toConvo.scrollTop = toConvo.scrollHeight;
  }

  function setToTab(bot) {
    toActiveBot = bot;
    if (bot === 'duck') {
      toTabDuck && toTabDuck.classList.add('active');
      toTabShrimp && toTabShrimp.classList.remove('active');
      toTabDuck && (toTabDuck.textContent = '🦆 BreDucky');
      toSendBtn && (toSendBtn.textContent = 'Send as BreDucky 🦆');
      toSendBtn && toSendBtn.classList.remove('shrimpy');
      toInput && toInput.classList.remove('shrimpy-focus');
      toStatus && toStatus.classList.remove('shrimpy');
      toInput && (toInput.placeholder = 'Type what BreDucky should say…');
    } else {
      toTabShrimp && toTabShrimp.classList.add('active');
      toTabDuck && toTabDuck.classList.remove('active');
      toTabShrimp && (toTabShrimp.textContent = '🦐 Shrimpy');
      toSendBtn && (toSendBtn.textContent = 'Send as Shrimpy 🦐');
      toSendBtn && toSendBtn.classList.add('shrimpy');
      toInput && toInput.classList.add('shrimpy-focus');
      toStatus && toStatus.classList.add('shrimpy');
      toInput && (toInput.placeholder = 'Type what Shrimpy should say… (bratty optional)');
    }
    renderToConvo();
  }

  toTabDuck && toTabDuck.addEventListener('click', () => setToTab('duck'));
  toTabShrimp && toTabShrimp.addEventListener('click', () => setToTab('shrimp'));

  toSendBtn && toSendBtn.addEventListener('click', () => {
    const text = toInput.value.trim();
    if (!text) return;
    toInput.value = '';
    toInput.style.height = 'auto';

    if (toActiveBot === 'duck') {
      // Auto-enable takeover for duck if not already on
      if (!takenOver.duck) {
        takenOver.duck = true;
        if (window.bdSetTakeover) window.bdSetTakeover(true);
        updateToggleBtns();
      }
      window.bdInjectReply && window.bdInjectReply(text);
    } else {
      // Auto-enable takeover for shrimp if not already on
      if (!takenOver.shrimp) {
        takenOver.shrimp = true;
        if (window.spSetTakeover) window.spSetTakeover(true);
        updateToggleBtns();
      }
      window.spInjectReply && window.spInjectReply(text);
    }

    if (toStatus) {
      const name = toActiveBot === 'duck' ? 'BreDucky' : 'Shrimpy';
      toStatus.textContent = `Sent as ${name} ✓`;
      setTimeout(() => { if (toStatus) toStatus.textContent = ''; }, 1800);
    }

    setTimeout(renderToConvo, 80);
    setTimeout(() => toInput && toInput.focus(), 100);
  });

  toInput && toInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); toSendBtn && toSendBtn.click(); }
  });

  toExitBtn && toExitBtn.addEventListener('click', closeTakeover);
  toOverlay && toOverlay.addEventListener('click', e => { if (e.target === toOverlay) closeTakeover(); });

  // Live refresh while panel is open
  let toRefreshInterval = null;
  const toObserver = new MutationObserver(() => {
    if (toOverlay && toOverlay.style.opacity === '1') {
      if (!toRefreshInterval) toRefreshInterval = setInterval(renderToConvo, 1200);
    } else {
      clearInterval(toRefreshInterval); toRefreshInterval = null;
    }
  });
  toOverlay && toObserver.observe(toOverlay, { attributes: true, attributeFilter: ['style'] });

  // ── Expose globals ──────────────────────────────────────────────────────────
  window.bdOpenTakeover  = openTakeover;
  window.bdCloseTakeover = closeTakeover;
  window.getActiveBot    = () => activeBot;
  window.activateBot     = activateBot;

  // Apply initial UI
  applyBotUI();
})();
