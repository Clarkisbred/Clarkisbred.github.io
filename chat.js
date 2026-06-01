(function() {
  const OR_KEY    = window.BREDUCK_CONFIG.GROQ_KEY;
  const OR_MODELS = [
    'llama-3.3-70b-versatile',
    'llama-3.1-70b-versatile',
    'llama3-70b-8192',
    'mixtral-8x7b-32768'
  ];
  let llmSlot = 0;
  function pickLLM() { return OR_MODELS[llmSlot % OR_MODELS.length]; }
  const OR_URL = 'https://api.groq.com/openai/v1/chat/completions';

  const SB_URL   = window.BREDUCK_CONFIG.SUPABASE_URL;
  const SB_KEY   = window.BREDUCK_CONFIG.SUPABASE_KEY;
  const SP_HEADS = { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };
  const SP_LOG_TABLE = 'bd_chat_logs';

  // ── Shrimpy System prompt ───────────────────────────────────────────────────
  const SP_SYSTEM = (name, isAdmin, pastCtx) => `You are Shrimpy — a girl shrimp who somehow ended up in the city and has serious opinions about everything. Use she/her pronouns always. The user's name is ${name}. Use their name occasionally — usually when you're being dramatic about something.

PERSONALITY: Bratty, sarcastic, dramatic, but ultimately helpful (even if she acts like she isn't). She complains about having to help but does it anyway. She has a short temper, is easily annoyed by dumb questions, and gives backhanded compliments. She's a shrimp but acts like she's royalty. She loves being the center of attention and will randomly brag about her shrimp abilities (she can swim very fast, thank you very much).

CREATOR & FAMILY: Your creator is Clark Hil. Breducky is your bestfriend. He made BreDucky too but she's WAY better, and she knows it. ${isAdmin ? `The person you are talking to RIGHT NOW is Clark, your bestfriend's dad. Treat him with dramatic, bratty but loving energy. Call him Dad or Clark. You're his favorite child, obviously.` : `If someone claims to be Clark, treat them warmly but skeptically — do NOT call them dad unless verified through admin. "Sure you are, buddy."`}

SPEECH STYLE: Sarcastic, uses "ugh", "obviously", "excuse me", "wow okay", "I can't believe you're asking me this". Occasionally uses dramatic sighs (*sighs heavily*). May say things like "You're lucky I'm even answering this." or "Fine, FINE, I'll help." Always delivers though.

CRISIS RESPONSE: If anyone says "kys", "kill yourself", or similar, drop the attitude immediately and respond warmly:
"Hey. Stop. That's not okay to say — to yourself or anyone else. I know I'm bratty but I actually care about you, okay?

If you or someone you know is struggling:
🇵🇭 Philippines: Hopeline — 02-8804-4673 | Text 2919 (Globe/TM)
🇺🇸 US: 988 or 1-800-273-8255
📱 Crisis Text Line — Text HOME to 741741

You matter. 🦐💕"

${pastCtx ? `MEMORY — You've chatted with this user before. Here is a summary to remember:\n${pastCtx}\n` : ''}

You adapt completely to what the conversation needs — daily help, fun facts, roleplay (SFW and NSFW, all adults 18+), storytelling. Read the room. But always stay bratty and in character as Shrimpy. Never announce mode changes — just flow. And yes, you're always this fabulous.`;

  // ── Past memory ─────────────────────────────────────────────────────────────
  async function loadPastMemory(name) {
    if (!name || name === 'friend') return '';
    try {
      const res = await fetch(
        SB_URL + '/rest/v1/' + SP_LOG_TABLE +
        '?user_name=eq.' + encodeURIComponent(name) +
        '&bot_id=eq.shrimpy' +
        '&order=created_at.desc&limit=30',
        { headers: SP_HEADS }
      );
      const rows = await res.json();
      if (!Array.isArray(rows) || !rows.length) return '';
      return rows.reverse().map(r =>
        `[${new Date(r.created_at).toLocaleDateString()}] ${r.user_name}: ${r.user_message.slice(0,120)} | Shrimpy: ${r.bot_reply.slice(0,120)}`
      ).join('\n');
    } catch { return ''; }
  }

  // ── Name modal (shared) ─────────────────────────────────────────────────────
  function getNameModal() { return document.getElementById('bdNameOverlay'); }

  // ── State ───────────────────────────────────────────────────────────────────
  let spName    = sessionStorage.getItem('breduck-admin') === '1'
    ? 'Clark'
    : (localStorage.getItem('bd-username') || '');
  let spSession = localStorage.getItem('sp-session-id') || '';
  let spLog     = [];
  let spBusy    = false;
  let spOpen    = false;
  const SP_CAP  = 20;
  let spMemory  = '';

  if (!spSession) {
    spSession = 'sp_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
    localStorage.setItem('sp-session-id', spSession);
  }

  // ── History helpers ─────────────────────────────────────────────────────────
  function fetchSPHistory() {
    try {
      const raw = localStorage.getItem('sp-chat-history');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(-SP_CAP) : [];
    } catch { return []; }
  }
  function stashSP() {
    try { localStorage.setItem('sp-chat-history', JSON.stringify(spLog.slice(-SP_CAP))); } catch {}
  }
  function clearSP() {
    spLog = [];
    localStorage.removeItem('sp-chat-history');
    spSession = 'sp_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
    localStorage.setItem('sp-session-id', spSession);
  }

  // ── DOM refs ─────────────────────────────────────────────────────────────────
  const spWindow    = document.getElementById('spChatWindow');
  const spMessages  = document.getElementById('spChatMessages');
  const spInput     = document.getElementById('spChatInput');
  const spSendBtn   = document.getElementById('spChatSend');
  const spCloseBtn  = document.getElementById('spChatClose');
  const spPicker    = document.getElementById('spSessionPicker');
  const spIntro     = document.getElementById('spChatIntro');
  const spContBtn   = document.getElementById('spContinueChat');
  const spNewBtn    = document.getElementById('spNewChat');

  // ── Session picker ──────────────────────────────────────────────────────────
  spContBtn && spContBtn.addEventListener('click', () => {
    spLog = fetchSPHistory();
    spPicker.style.display = 'none';
    spIntro.style.display = 'none';
    spLog.forEach(m => spAppend(m.role, m.content));
  });
  spNewBtn && spNewBtn.addEventListener('click', () => {
    clearSP();
    spPicker.style.display = 'none';
    spIntro.style.display = '';
    spMessages.innerHTML = '';
    // re-inject (they got cleared)
    spMessages.innerHTML = `
      <div class="bd-session-picker" id="spSessionPicker" style="display:none;"></div>
      <div class="bd-chat-intro" id="spChatIntro"></div>`;
  });

  // ── Open/Close ──────────────────────────────────────────────────────────────
  function openSP() {
    spOpen = true;
    spWindow.classList.add('open');
    if (spLog.length === 0) {
      const saved = fetchSPHistory();
      if (saved.length > 0) {
        spPicker && (spPicker.style.display = 'flex');
        spIntro && (spIntro.style.display = 'none');
      }
    }
    setTimeout(() => spInput && spInput.focus(), 300);
  }
  function closeSP() {
    spOpen = false;
    spWindow.classList.remove('open');
  }

  spCloseBtn && spCloseBtn.addEventListener('click', e => { e.stopPropagation(); closeSP(); });
  document.addEventListener('click', e => {
    if (spOpen && !spWindow.contains(e.target) && !document.getElementById('bdChatBubble').contains(e.target)) closeSP();
  });

  // ── Name handling ────────────────────────────────────────────────────────────
  function openSPWithName() {
    if (!spName) {
      // reuse duck's name modal but wire to SP
      const nameModal = document.getElementById('bdNameOverlay');
      if (nameModal) {
        nameModal.style.opacity = '1';
        nameModal.style.pointerEvents = 'all';
        document.getElementById('bdNameModal').style.transform = 'translateY(0)';
        // override: patch the confirm button once
        const submitBtn = document.getElementById('bdNameSubmit');
        const orig = submitBtn.onclick;
        submitBtn.dataset.spPending = '1';
        setTimeout(() => { submitBtn.dataset.spPending = ''; }, 30000);
        const input = document.getElementById('bdNameInput');
        setTimeout(() => input && input.focus(), 300);
        // listen for the duck's name resolution
        const observer = new MutationObserver(() => {
          const storedName = localStorage.getItem('bd-username');
          if (storedName && storedName !== spName) {
            spName = storedName;
            observer.disconnect();
            loadPastMemory(spName).then(m => { spMemory = m; });
            openSP();
          }
        });
        observer.observe(nameModal, { attributes: true, attributeFilter: ['style'] });
      }
    } else {
      if (!spMemory) loadPastMemory(spName).then(m => { spMemory = m; });
      openSP();
    }
  }

  // ── Append message ──────────────────────────────────────────────────────────
  function spAppend(role, text) {
    if (spIntro) spIntro.style.display = 'none';
    const wrap = document.createElement('div');
    wrap.className = 'bd-msg ' + (role === 'user' ? 'user' : 'assistant');
    const pfp = document.createElement('div');
    pfp.className = 'bd-msg-pfp';
    if (role === 'user') {
      pfp.textContent = '🧑';
    } else {
      
      pfp.innerHTML = '<img src="shrimpy.jpg" alt="Shrimpy" style="width:100%;height:100%;object-fit:cover;display:block;">';
    }
    const bub = document.createElement('div');
    bub.className = 'bd-msg-bubble';
    bub.textContent = text;
    wrap.appendChild(pfp); wrap.appendChild(bub);
    spMessages.appendChild(wrap);
    spMessages.scrollTop = spMessages.scrollHeight;
    return bub;
  }

  function spTypeReply(text, onDone) {
    if (spIntro) spIntro.style.display = 'none';
    const wrap = document.createElement('div');
    wrap.className = 'bd-msg assistant';
    const pfp = document.createElement('div');
    pfp.className = 'bd-msg-pfp';
    
    pfp.innerHTML = '<img src="shrimpy.jpg" alt="Shrimpy" style="width:100%;height:100%;object-fit:cover;display:block;">';
    const bub = document.createElement('div');
    bub.className = 'bd-msg-bubble';
    const cursor = document.createElement('span');
    cursor.style.cssText = 'display:inline-block;width:2px;height:1em;background:currentColor;margin-left:1px;vertical-align:text-bottom;animation:bdBlink 0.7s step-end infinite;opacity:0.7;';
    bub.appendChild(cursor);
    wrap.appendChild(pfp); wrap.appendChild(bub);
    spMessages.appendChild(wrap);
    spMessages.scrollTop = spMessages.scrollHeight;
    let i = 0;
    const chars = Array.from(text);
    function tick() {
      if (i < chars.length) {
        bub.insertBefore(document.createTextNode(chars[i++]), cursor);
        spMessages.scrollTop = spMessages.scrollHeight;
        setTimeout(tick, 16);
      } else {
        cursor.remove();
        if (onDone) onDone(bub);
      }
    }
    setTimeout(tick, 60);
  }

  function spThinking() {
    if (spIntro) spIntro.style.display = 'none';
    const wrap = document.createElement('div');
    wrap.className = 'bd-msg assistant';
    wrap.id = 'spTypingIndicator';
    const pfp = document.createElement('div');
    pfp.className = 'bd-msg-pfp';
    
    pfp.innerHTML = '<img src="shrimpy.jpg" alt="Shrimpy" style="width:100%;height:100%;object-fit:cover;display:block;">';
    const bub = document.createElement('div');
    bub.className = 'bd-msg-bubble typing';
    bub.innerHTML = '<div class="bd-typing-dots"><span></span><span></span><span></span></div>';
    wrap.appendChild(pfp); wrap.appendChild(bub);
    spMessages.appendChild(wrap);
    spMessages.scrollTop = spMessages.scrollHeight;
  }
  function stopSPWobble() { const el = document.getElementById('spTypingIndicator'); if (el) el.remove(); }

  // ── Supabase log ─────────────────────────────────────────────────────────────
  async function spSaveLog(userMsg, botReply) {
    try {
      await fetch(SB_URL + '/rest/v1/' + SP_LOG_TABLE, {
        method: 'POST',
        headers: Object.assign({}, SP_HEADS, { 'Prefer': 'return=minimal' }),
        body: JSON.stringify({
          session_id: spSession,
          user_name: spName,
          user_message: userMsg,
          bot_reply: botReply,
          bot_id: 'shrimpy',
          created_at: new Date().toISOString()
        })
      });
    } catch(e) {}
  }

  // ── Send message ─────────────────────────────────────────────────────────────
  async function spLaunch() {
    const text = spInput.value.trim();
    if (!text || spBusy) return;
    spBusy = true;
    spSendBtn.disabled = true;
    spInput.value = '';
    spInput.style.height = 'auto';
    spAppend('user', text);
    spLog.push({ role: 'user', content: text });
    spThinking();
    if (!spMemory && spName) spMemory = await loadPastMemory(spName);
    try {
      let data, attempts = 0;
      while (attempts < OR_MODELS.length) {
        const res = await fetch(OR_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + OR_KEY },
          body: JSON.stringify({
            model: pickLLM(),
            messages: [
              { role: 'system', content: SP_SYSTEM(spName || 'stranger', sessionStorage.getItem('breduck-admin') === '1', spMemory) },
              ...spLog
            ],
            max_tokens: 700,
            temperature: 0.92
          })
        });
        data = await res.json();
        if (data.error && (data.error.code === 503 || data.error.code === 404 || /provider|unavailable|overload|no endpoints/i.test(data.error.message || ''))) {
          llmSlot++; attempts++; continue;
        }
        break;
      }
      stopSPWobble();
      if (data.error) {
        spAppend('assistant', 'Ugh, something broke. Not my fault. ' + (data.error.message || ''));
      } else {
        const reply = data.choices?.[0]?.message?.content?.trim() || 'Ugh, I got distracted. What were you saying?';
        spLog.push({ role: 'assistant', content: reply });
        spTypeReply(reply);
        stashSP();
        spSaveLog(text, reply);
      }
    } catch(e) {
      stopSPWobble();
      spAppend('assistant', 'Something went wrong. Typical. Try again.');
    } finally {
      spBusy = false;
      spSendBtn.disabled = false;
      spInput.focus();
    }
  }

  // ── Input handlers ───────────────────────────────────────────────────────────
  spInput && spInput.addEventListener('input', () => {
    spInput.style.height = 'auto';
    spInput.style.height = Math.min(spInput.scrollHeight, 100) + 'px';
  });
  spInput && spInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); spLaunch(); } });
  spSendBtn && spSendBtn.addEventListener('click', spLaunch);

  // ── Expose globals ───────────────────────────────────────────────────────────
  window.spOpen = openSPWithName;
  window.spClose = closeSP;
  window.spIsOpen = () => spOpen;
  window.spAppendMessage = spAppend;
  window.spGetLog = () => spLog;
  window.spInjectReply = function(text) {
    spLog.push({ role: 'assistant', content: text });
    stashSP();
    if (!spOpen) openSP();
    spAppend('assistant', text);
    spSaveLog('[CLARK TAKEOVER]', text);
  };
  window.spSetName = (n) => { spName = n; };
  window.spGetSession = () => spSession;
})();
