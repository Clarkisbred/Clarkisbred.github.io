(function() {
  // ── Bot Switcher ─────────────────────────────────────────────────────────────
  // Which bot is currently selected: 'duck' or 'shrimp'
  let activeBot = localStorage.getItem('bd-active-bot') || 'duck';

  const bubble     = document.getElementById('bdChatBubble');
  const switcher   = document.getElementById('bdBotSwitcher');
  const toggle     = document.getElementById('bdBotToggle');
  const toggleBall = toggle ? toggle.querySelector('.bd-bot-toggle-ball') : null;
  const nameBadge  = document.getElementById('bdBotNameBadge');
  const duckWindow = document.getElementById('bdChatWindow');
  const spWindow   = document.getElementById('spChatWindow');

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

  function switchBot() {
    // close both windows first
    duckWindow && duckWindow.classList.remove('open');
    spWindow && spWindow.classList.remove('open');
    activeBot = activeBot === 'duck' ? 'shrimp' : 'duck';
    localStorage.setItem('bd-active-bot', activeBot);
    applyBotUI();
  }

  toggle && toggle.addEventListener('click', e => {
    e.stopPropagation();
    switchBot();
  });

  // ── Show switcher near the bubble ────────────────────────────────────────────
  let switcherVisible = false;
  let switcherTimer = null;

  function showSwitcher() {
    if (!switcher) return;
    switcherVisible = true;
    switcher.classList.add('visible');
    clearTimeout(switcherTimer);
    switcherTimer = setTimeout(hideSwitcher, 3500);
  }
  function hideSwitcher() {
    switcherVisible = false;
    switcher && switcher.classList.remove('visible');
  }

  // Show switcher on hover/long-press of bubble
  if (bubble) {
    bubble.addEventListener('mouseenter', showSwitcher);
    bubble.addEventListener('mouseleave', () => {
      clearTimeout(switcherTimer);
      switcherTimer = setTimeout(hideSwitcher, 1200);
    });
    // keep visible while hovering switcher
    switcher && switcher.addEventListener('mouseenter', () => {
      clearTimeout(switcherTimer);
    });
    switcher && switcher.addEventListener('mouseleave', () => {
      switcherTimer = setTimeout(hideSwitcher, 800);
    });

    // On mobile: show on tap-hold
    let touchTimer = null;
    bubble.addEventListener('touchstart', () => {
      touchTimer = setTimeout(showSwitcher, 500);
    }, { passive: true });
    bubble.addEventListener('touchend', () => clearTimeout(touchTimer), { passive: true });

    // Override bubble click to open correct bot
    bubble.addEventListener('click', e => {
      e.stopPropagation();
      // if switcher is tapping, don't open chat
      if (switcherVisible && e.target === toggle) return;

      const duckClosed = !duckWindow.classList.contains('open');
      const spClosed = !spWindow.classList.contains('open');

      if (activeBot === 'shrimp') {
        if (spClosed) {
          // close duck if open
          duckWindow.classList.remove('open');
          window.spOpen && window.spOpen();
        } else {
          window.spClose && window.spClose();
        }
      } else {
        if (duckClosed) {
          spWindow.classList.remove('open');
          // trigger duck open via existing bdOpenDuckChat
          window.bdOpenDuckChat && window.bdOpenDuckChat();
          // if no name yet, the duck handles the name modal
        } else {
          duckWindow.classList.remove('open');
          window.bdCloseDuckChat && window.bdCloseDuckChat();
        }
      }
    }, true); // capture phase to override duck's listener
  }

  // ── New Takeover Panel ────────────────────────────────────────────────────────
  const toOverlay   = document.getElementById('bdTakeoverOverlay');
  const toModal     = document.getElementById('bdTakeoverModal');
  const toConvo     = document.getElementById('bdToConvo');
  const toConvoEmpty= document.getElementById('bdToConvoEmpty');
  const toInput     = document.getElementById('bdTakeoverInput');
  const toSendBtn   = document.getElementById('bdTakeoverSend');
  const toExitBtn   = document.getElementById('bdTakeoverExit') || document.getElementById('bdTakeoverClose');
  const toStatus    = document.getElementById('bdTakeoverStatus');
  const toTabDuck   = document.getElementById('bdToTabDuck');
  const toTabShrimp = document.getElementById('bdToTabShrimp');

  let toActiveBot = 'duck'; // which bot the takeover panel is targeting

  function openTakeover() {
    if (!toOverlay) return;
    toOverlay.style.opacity = '1'; toOverlay.style.pointerEvents = 'all';
    toModal && (toModal.style.transform = 'translateY(0)');
    renderToConvo();
    setTimeout(() => toInput && toInput.focus(), 300);
  }

  function closeTakeover() {
    if (!toOverlay) return;
    toOverlay.style.opacity = '0'; toOverlay.style.pointerEvents = 'none';
    toModal && (toModal.style.transform = 'translateY(20px)');
  }

  // Build convo view from current bot's log
  function renderToConvo() {
    if (!toConvo) return;
    let log = [];
    if (toActiveBot === 'duck') {
      // get BreDucky's log from chat.js exposed global
      log = window.bdGetChatLog ? window.bdGetChatLog() : [];
    } else {
      log = window.spGetLog ? window.spGetLog() : [];
    }

    toConvo.innerHTML = '';
    if (!log.length) {
      const empty = document.createElement('div');
      empty.className = 'bd-takeover-empty';
      empty.textContent = 'No messages yet in this conversation.';
      toConvo.appendChild(empty);
      return;
    }

    log.forEach(m => {
      const row = document.createElement('div');
      row.className = 'bd-to-msg ' + (m.role === 'user' ? 'user' : '') + (m.role === 'user' && toActiveBot === 'shrimp' ? ' shrimpy' : '');

      const pfp = document.createElement('div');
      pfp.className = 'bd-to-pfp' + (m.role !== 'user' && toActiveBot === 'shrimp' ? ' shrimpy-pfp' : '');
      if (m.role === 'user') {
        pfp.textContent = '🧑';
      } else {
        pfp.innerHTML = toActiveBot === 'shrimp' ? '<img src="shrimpy.jpg" alt="Shrimpy" style="width:100%;height:100%;object-fit:cover;display:block;">' : '🦆';
        if (toActiveBot !== 'shrimp') pfp.style.background = 'var(--yellow)';
      }

      const bub = document.createElement('div');
      bub.className = 'bd-to-bubble';
      bub.textContent = m.content;

      row.appendChild(pfp); row.appendChild(bub);
      toConvo.appendChild(row);
    });
    toConvo.scrollTop = toConvo.scrollHeight;
  }

  // Tab switching
  function setToTab(bot) {
    toActiveBot = bot;
    if (bot === 'duck') {
      toTabDuck && toTabDuck.classList.add('active');
      toTabShrimp && toTabShrimp.classList.remove('active');
      toSendBtn && (toSendBtn.textContent = 'Send as BreDucky 🦆');
      toSendBtn && toSendBtn.classList.remove('shrimpy');
      toInput && toInput.classList.remove('shrimpy-focus');
      toStatus && toStatus.classList.remove('shrimpy');
      toInput && (toInput.placeholder = 'Type what BreDucky should say…');
    } else {
      toTabShrimp && toTabShrimp.classList.add('active');
      toTabDuck && toTabDuck.classList.remove('active');
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

  // Send takeover message
  toSendBtn && toSendBtn.addEventListener('click', () => {
    const text = toInput.value.trim();
    if (!text) return;
    toInput.value = '';

    if (toActiveBot === 'duck') {
      // inject into BreDucky chat
      window.bdInjectReply && window.bdInjectReply(text);
    } else {
      window.spInjectReply && window.spInjectReply(text);
    }

    if (toStatus) {
      toStatus.textContent = 'Sent as ' + (toActiveBot === 'duck' ? 'BreDucky' : 'Shrimpy') + ' ✓';
      setTimeout(() => { toStatus.textContent = ''; }, 2000);
    }

    // refresh convo view
    setTimeout(renderToConvo, 100);
  });

  toInput && toInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); toSendBtn && toSendBtn.click(); }
  });

  toExitBtn && toExitBtn.addEventListener('click', closeTakeover);
  toOverlay && toOverlay.addEventListener('click', e => { if (e.target === toOverlay) closeTakeover(); });

  // Auto-refresh convo while panel is open
  let toRefreshInterval = null;
  const toObserver = new MutationObserver(() => {
    if (toOverlay && toOverlay.style.opacity === '1') {
      if (!toRefreshInterval) toRefreshInterval = setInterval(renderToConvo, 1500);
    } else {
      clearInterval(toRefreshInterval); toRefreshInterval = null;
    }
  });
  toOverlay && toObserver.observe(toOverlay, { attributes: true, attributeFilter: ['style'] });

  // ── Expose globals ──────────────────────────────────────────────────────────
  window.bdOpenTakeover = openTakeover;
  window.bdCloseTakeover = closeTakeover;
  window.getActiveBot = () => activeBot;

  // Apply initial UI
  applyBotUI();
})();
