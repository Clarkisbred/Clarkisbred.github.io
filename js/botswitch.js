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

  // In-header toggle
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
  const toConvoEmpty= document.getElementById('bdToConvoEmpty');
  const toInput     = document.getElementById('bdTakeoverInput');
  const toSendBtn   = document.getElementById('bdTakeoverSend');
  const toExitBtn   = document.getElementById('bdTakeoverExit') || document.getElementById('bdTakeoverClose');
  const toStatus    = document.getElementById('bdTakeoverStatus');
  const toTabDuck   = document.getElementById('bdToTabDuck');
  const toTabShrimp = document.getElementById('bdToTabShrimp');

  let toActiveBot = 'duck';

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

  function renderToConvo() {
    if (!toConvo) return;
    let log = [];
    if (toActiveBot === 'duck') {
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

  toSendBtn && toSendBtn.addEventListener('click', () => {
    const text = toInput.value.trim();
    if (!text) return;
    toInput.value = '';

    if (toActiveBot === 'duck') {
      window.bdInjectReply && window.bdInjectReply(text);
    } else {
      window.spInjectReply && window.spInjectReply(text);
    }

    if (toStatus) {
      toStatus.textContent = 'Sent as ' + (toActiveBot === 'duck' ? 'BreDucky' : 'Shrimpy') + ' ✓';
      setTimeout(() => { toStatus.textContent = ''; }, 2000);
    }

    setTimeout(renderToConvo, 100);
  });

  toInput && toInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); toSendBtn && toSendBtn.click(); }
  });

  toExitBtn && toExitBtn.addEventListener('click', closeTakeover);
  toOverlay && toOverlay.addEventListener('click', e => { if (e.target === toOverlay) closeTakeover(); });

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
  window.bdOpenTakeover  = openTakeover;
  window.bdCloseTakeover = closeTakeover;
  window.getActiveBot    = () => activeBot;
  window.activateBot     = activateBot;

  // Apply initial UI
  applyBotUI();
})();
