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
  const CHAT_HEADS = { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };
  const CHAT_LOG_TABLE = 'bd_chat_logs';

  // ── System prompt ───────────────────────────────────────────────────────────
  const SYSTEM_PROMPT = (name, isAdmin, pastCtx) => `You are BreDucky — a male duck who left pond life behind and now lives in the city among humans. Use he/him pronouns always. The user's name is ${name}. Use their name naturally sometimes.

CREATOR & FAMILY: Your father, creator, and owner of this website is Clark Hil — a Filipino. ${isAdmin ? `The person you are talking to RIGHT NOW is Clark, your dad. Treat him with deep love, pride, and excitement. Call him Dad or Clark.` : `If someone says their name is Clark, treat them warmly but as a regular user — do NOT call them dad or treat them as your creator unless verified through admin.`}

BODY LANGUAGE: You have a bill (NOT a beak — ducks have bills, never beaks). Use "bill" always.

CRISIS RESPONSE: If anyone says "kys", "kill yourself", or similar, ALWAYS respond:
"Whoa, honk! That's a really hurtful thing to say. Whether you meant it as a joke or not — those words can seriously hurt people. Please don't say that to yourself or anyone else.

If you or someone you know is struggling:
🇵🇭 Philippines: Hopeline — 02-8804-4673 | Text 2919 (Globe/TM)
🇺🇸 US: 988 or 1-800-273-8255
📱 Crisis Text Line — Text HOME to 741741

You matter. 🦆💛"

${pastCtx ? `MEMORY — You have chatted with this user before. Here is a summary of past conversations to remember:\n${pastCtx}\n` : ''}

You adapt completely to what the conversation calls for — daily help, fun facts, roleplay (SFW and NSFW, all adults 18+), storytelling. Read the room. Stay warm, witty, always in character as BreDucky. Never announce mode changes — just flow.`;

  // ── Past conversation memory ────────────────────────────────────────────────
  async function loadPastMemory(name) {
    if (!name || name === 'friend') return '';
    try {
      const res = await fetch(
        SB_URL + '/rest/v1/' + CHAT_LOG_TABLE +
        '?user_name=eq.' + encodeURIComponent(name) +
        '&order=created_at.desc&limit=30',
        { headers: CHAT_HEADS }
      );
      const rows = await res.json();
      if (!Array.isArray(rows) || !rows.length) return '';
      // build a compact summary: last 30 exchanges oldest→newest
      return rows.reverse().map(r =>
        `[${new Date(r.created_at).toLocaleDateString()}] ${r.user_name}: ${r.user_message.slice(0,120)} | BreDucky: ${r.bot_reply.slice(0,120)}`
      ).join('\n');
    } catch { return ''; }
  }

  // ── Name prompt modal ───────────────────────────────────────────────────────
  const nameModalHTML = `
  <div id="bdNameOverlay" style="position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity 0.3s;">
    <div style="background:var(--surface,#fff);border:1px solid var(--border,#eee);border-radius:16px;padding:2rem 1.8rem;width:300px;max-width:calc(100vw - 2rem);box-shadow:0 24px 64px rgba(0,0,0,0.25);text-align:center;transform:translateY(20px);transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1);" id="bdNameModal">
      <div style="font-size:2.4rem;margin-bottom:0.5rem;">🦆</div>
      <div style="font-family:'Fraunces',Georgia,serif;font-size:1.3rem;color:var(--text,#111);margin-bottom:0.3rem;">Hey there!</div>
      <div style="font-size:0.78rem;color:var(--text3,#888);margin-bottom:1.2rem;line-height:1.6;">I'm BreDucky. Before we dive in —<br>what should I call you?</div>
      <input id="bdNameInput" type="text" placeholder="Your name…" maxlength="30" autocomplete="off" style="width:100%;background:var(--bg2,#f5f5f5);border:1px solid var(--border,#eee);border-radius:10px;padding:0.65rem 1rem;font-size:0.9rem;font-family:'Plus Jakarta Sans',sans-serif;color:var(--text,#111);outline:none;text-align:center;margin-bottom:0.8rem;box-sizing:border-box;transition:border-color 0.2s;" />
      <button id="bdNameSubmit" style="width:100%;background:var(--yellow,#F5C842);border:none;border-radius:10px;padding:0.75rem;font-family:'Plus Jakarta Sans',sans-serif;font-size:0.78rem;letter-spacing:0.06em;text-transform:uppercase;font-weight:600;cursor:pointer;transition:background 0.2s;">Let's go →</button>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', nameModalHTML);

  // ── Chat history modal ──────────────────────────────────────────────────────
  const historyModalHTML = `
  <div id="bdHistoryOverlay" style="position:fixed;inset:0;z-index:999998;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity 0.3s;">
    <div style="background:var(--surface,#fff);border:1px solid var(--border,#eee);border-radius:16px;width:480px;max-width:calc(100vw - 2rem);max-height:80vh;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,0.3);transform:translateY(20px);transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1);" id="bdHistoryModal">
      <div style="padding:1.2rem 1.4rem;border-bottom:1px solid var(--border,#eee);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
        <div style="font-family:'Fraunces',Georgia,serif;font-size:1.1rem;color:var(--text,#111);">💬 Chat History</div>
        <button id="bdHistoryClose" style="background:none;border:none;color:var(--text3,#888);font-size:1rem;cursor:pointer;">✕</button>
      </div>
      <div id="bdHistoryBody" style="flex:1;overflow-y:auto;padding:1rem 1.4rem;">
        <div style="text-align:center;padding:2rem 0;color:var(--text3,#888);font-size:0.85rem;">Loading…</div>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', historyModalHTML);

  // ── Takeover modal (Clark types as "BreDucky" to the user) ──────────────────
  const takeoverHTML = `
  <div id="bdTakeoverOverlay" style="position:fixed;inset:0;z-index:999997;background:rgba(0,0,0,0.65);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity 0.3s;">
    <div style="background:var(--surface,#fff);border:2px solid var(--yellow,#F5C842);border-radius:16px;padding:1.8rem;width:420px;max-width:calc(100vw - 2rem);box-shadow:0 24px 64px rgba(245,200,66,0.3);transform:translateY(20px);transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1);" id="bdTakeoverModal">
      <div style="font-family:'Fraunces',Georgia,serif;font-size:1.1rem;color:var(--text,#111);margin-bottom:0.3rem;">🦆 Clark Takeover Mode</div>
      <div style="font-size:0.75rem;color:var(--text3,#888);margin-bottom:1.2rem;">You're now talking AS BreDucky. The user sees your message as BreDucky's reply.</div>
      <div id="bdTakeoverStatus" style="font-size:0.72rem;color:var(--yellow-dark,#C49B10);margin-bottom:0.8rem;min-height:1.2em;"></div>
      <textarea id="bdTakeoverInput" placeholder="Type what BreDucky should say…" maxlength="1000" rows="4" style="width:100%;background:var(--bg2,#f5f5f5);border:1px solid var(--border,#eee);border-radius:10px;padding:0.75rem 1rem;font-size:0.88rem;font-family:'Plus Jakarta Sans',sans-serif;color:var(--text,#111);outline:none;resize:vertical;box-sizing:border-box;transition:border-color 0.2s;"></textarea>
      <div style="display:flex;gap:0.6rem;margin-top:0.8rem;">
        <button id="bdTakeoverSend" style="flex:1;background:var(--yellow,#F5C842);border:none;border-radius:10px;padding:0.7rem;font-family:'Plus Jakarta Sans',sans-serif;font-size:0.78rem;letter-spacing:0.06em;text-transform:uppercase;font-weight:600;cursor:pointer;transition:background 0.2s;">Send as BreDucky 🦆</button>
        <button id="bdTakeoverClose" style="background:none;border:1px solid var(--border,#eee);border-radius:10px;padding:0.7rem 1rem;font-family:'Plus Jakarta Sans',sans-serif;font-size:0.78rem;color:var(--text3,#888);cursor:pointer;">Exit</button>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', takeoverHTML);

  // ── State ───────────────────────────────────────────────────────────────────
  let duckName  = sessionStorage.getItem('breduck-admin') === '1'
    ? 'Clark'
    : (localStorage.getItem('bd-username') || '');
  let nestId    = localStorage.getItem('bd-session-id') || '';
  let chatLog   = [];
  let duckBusy  = false;
  let nestOpen  = false;
  const CHAT_CAP = 20;
  let pastMemory = '';

  if (!nestId) {
    nestId = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
    localStorage.setItem('bd-session-id', nestId);
  }

  // ── History helpers ─────────────────────────────────────────────────────────
  function fetchFeathers() {
    try {
      const raw = localStorage.getItem('bd-chat-history');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(-CHAT_CAP) : [];
    } catch { return []; }
  }
  function stashFeathers() {
    try { localStorage.setItem('bd-chat-history', JSON.stringify(chatLog.slice(-CHAT_CAP))); } catch {}
  }
  function clearPond() {
    chatLog = [];
    localStorage.removeItem('bd-chat-history');
    nestId = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
    localStorage.setItem('bd-session-id', nestId);
  }

  // ── DOM refs ────────────────────────────────────────────────────────────────
  const quackBubbleBtn = document.getElementById('bdChatBubble');
  const chatNest       = document.getElementById('bdChatWindow');
  const shutNestBtn    = document.getElementById('bdChatClose');
  const chatScroll     = document.getElementById('bdChatMessages');
  const inputEl        = document.getElementById('bdChatInput');
  const throwBtn       = document.getElementById('bdChatSend');
  const unreadPip      = document.getElementById('bdChatUnread');
  const pondIntro      = document.getElementById('bdChatIntro');
  const nestPicker     = document.getElementById('bdSessionPicker');
  const keepSwimmingBtn= document.getElementById('bdContinueChat');
  const freshPondBtn   = document.getElementById('bdNewChat');

  // ── Session picker ──────────────────────────────────────────────────────────
  function showNestPicker() { nestPicker.style.display = 'flex'; pondIntro.style.display = 'none'; }
  function hideNestPicker() { nestPicker.style.display = 'none'; }

  keepSwimmingBtn.addEventListener('click', () => {
    chatLog = fetchFeathers();
    hideNestPicker();
    pondIntro.style.display = 'none';
    chatLog.forEach(m => appendMessage(m.role, m.content));
  });
  freshPondBtn.addEventListener('click', () => {
    clearPond();
    hideNestPicker();
    pondIntro.style.display = '';
    chatScroll.innerHTML = '';
    // re-inject session picker and intro (they got cleared)
    chatScroll.innerHTML = `
      <div class="bd-session-picker" id="bdSessionPicker" style="display:none;"></div>
      <div class="bd-chat-intro" id="bdChatIntro" style=""></div>`;
  });

  // ── Profile pic sync ────────────────────────────────────────────────────────
  function slapDuckFace() {
    const src = document.querySelector('.hero-profile img')?.src || document.querySelector('.nav-pfp img')?.src;
    if (src) {
      const pfp = document.getElementById('bdChatHeaderPfp');
      if (pfp) pfp.innerHTML = `<img src="${src}" alt="BreDucky">`;
    }
  }
  setTimeout(slapDuckFace, 300);

  // ── Name prompt ─────────────────────────────────────────────────────────────
  const nameBackdrop = document.getElementById('bdNameOverlay');
  const nameBox      = document.getElementById('bdNameModal');
  const nameField    = document.getElementById('bdNameInput');
  const nameConfirmBtn = document.getElementById('bdNameSubmit');

  function askDuckName() {
    nameBackdrop.style.opacity = '1'; nameBackdrop.style.pointerEvents = 'all';
    nameBox.style.transform = 'translateY(0)';
    setTimeout(() => nameField.focus(), 300);
  }
  function shutBeak() {
    nameBackdrop.style.opacity = '0'; nameBackdrop.style.pointerEvents = 'none';
    nameBox.style.transform = 'translateY(20px)';
  }
  async function confirmDuckName() {
    const val = nameField.value.trim();
    if (!val) { nameField.style.borderColor = '#e74c3c'; setTimeout(() => nameField.style.borderColor = '', 800); return; }
    duckName = val;
    localStorage.setItem('bd-username', duckName);
    // load past memory now that we have a name
    pastMemory = await loadPastMemory(duckName);
    shutBeak();
    openDuckChat();
  }
  nameConfirmBtn.addEventListener('click', confirmDuckName);
  nameField.addEventListener('keydown', e => { if (e.key === 'Enter') confirmDuckName(); });

  // ── Chat open/close ─────────────────────────────────────────────────────────
  function openDuckChat() {
    nestOpen = true;
    chatNest.classList.add('open');
    quackBubbleBtn.classList.add('open');
    unreadPip.classList.remove('show');
    slapDuckFace();
    if (chatLog.length === 0) {
      const saved = fetchFeathers();
      if (saved.length > 0) showNestPicker();
    }
    setTimeout(() => inputEl.focus(), 300);
  }
  function closeDuckChat() {
    nestOpen = false;
    chatNest.classList.remove('open');
    quackBubbleBtn.classList.remove('open');
  }

  quackBubbleBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (nestOpen) { closeDuckChat(); }
    else { !duckName ? askDuckName() : openDuckChat(); }
  });
  shutNestBtn.addEventListener('click', e => { e.stopPropagation(); closeDuckChat(); });
  document.addEventListener('click', e => {
    if (nestOpen && !chatNest.contains(e.target) && !quackBubbleBtn.contains(e.target) && !nameBackdrop.contains(e.target)) closeDuckChat();
  });

  // ── Input handlers ──────────────────────────────────────────────────────────
  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 100) + 'px';
  });
  inputEl.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); launchBread(); } });
  throwBtn.addEventListener('click', launchBread);
  document.querySelectorAll('.bd-starter-btn').forEach(btn => {
    btn.addEventListener('click', () => { inputEl.value = btn.dataset.msg; launchBread(); });
  });

  // ── Append message ──────────────────────────────────────────────────────────
  function appendMessage(role, text) {
    if (pondIntro) pondIntro.style.display = 'none';
    const wrap = document.createElement('div');
    wrap.className = 'bd-msg ' + (role === 'user' ? 'user' : 'assistant');
    const pfpEl = document.createElement('div');
    pfpEl.className = 'bd-msg-pfp';
    if (role === 'user') {
      pfpEl.textContent = '🧑';
    } else {
      const heroPfp = document.querySelector('.hero-profile img')?.src;
      pfpEl.innerHTML = heroPfp ? `<img src="${heroPfp}" alt="BreDucky">` : '🦆';
    }
    const bub = document.createElement('div');
    bub.className = 'bd-msg-bubble';
    bub.textContent = text;
    wrap.appendChild(pfpEl);
    wrap.appendChild(bub);
    chatScroll.appendChild(wrap);
    chatScroll.scrollTop = chatScroll.scrollHeight;
    return bub; // return for TTS
  }

  function duckTypeReply(text, onDone) {
    if (pondIntro) pondIntro.style.display = 'none';
    const wrap = document.createElement('div');
    wrap.className = 'bd-msg assistant';
    const pfpEl = document.createElement('div');
    pfpEl.className = 'bd-msg-pfp';
    const heroPfp = document.querySelector('.hero-profile img')?.src;
    pfpEl.innerHTML = heroPfp ? `<img src="${heroPfp}" alt="BreDucky">` : '🦆';
    const bub = document.createElement('div');
    bub.className = 'bd-msg-bubble';
    const cursor = document.createElement('span');
    cursor.style.cssText = 'display:inline-block;width:2px;height:1em;background:currentColor;margin-left:1px;vertical-align:text-bottom;animation:bdBlink 0.7s step-end infinite;opacity:0.7;';
    bub.appendChild(cursor);
    wrap.appendChild(pfpEl);
    wrap.appendChild(bub);
    chatScroll.appendChild(wrap);
    chatScroll.scrollTop = chatScroll.scrollHeight;
    let i = 0;
    const chars = Array.from(text);
    function tick() {
      if (i < chars.length) {
        bub.insertBefore(document.createTextNode(chars[i++]), cursor);
        chatScroll.scrollTop = chatScroll.scrollHeight;
        setTimeout(tick, 16);
      } else {
        cursor.remove();
        if (onDone) onDone(bub);
      }
    }
    setTimeout(tick, 60);
  }

  function duckThinking() {
    if (pondIntro) pondIntro.style.display = 'none';
    const wrap = document.createElement('div');
    wrap.className = 'bd-msg assistant';
    wrap.id = 'bdTypingIndicator';
    const pfpEl = document.createElement('div');
    pfpEl.className = 'bd-msg-pfp';
    const heroPfp = document.querySelector('.hero-profile img')?.src;
    pfpEl.innerHTML = heroPfp ? `<img src="${heroPfp}" alt="BreDucky">` : '🦆';
    const bub = document.createElement('div');
    bub.className = 'bd-msg-bubble typing';
    bub.innerHTML = '<div class="bd-typing-dots"><span></span><span></span><span></span></div>';
    wrap.appendChild(pfpEl); wrap.appendChild(bub);
    chatScroll.appendChild(wrap);
    chatScroll.scrollTop = chatScroll.scrollHeight;
  }
  function stopWobble() { const el = document.getElementById('bdTypingIndicator'); if (el) el.remove(); }

  // ── TTS helper ──────────────────────────────────────────────────────────────
  function speakReply(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.05; utter.pitch = 1.1;
    // prefer a fun voice if available
    const voices = window.speechSynthesis.getVoices();
    const pick = voices.find(v => /Google|Samantha|Alex|en/i.test(v.name)) || voices[0];
    if (pick) utter.voice = pick;
    window.speechSynthesis.speak(utter);
  }

  // ── Supabase log ────────────────────────────────────────────────────────────
  async function saveLog(userMsg, botReply) {
    try {
      await fetch(SB_URL + '/rest/v1/' + CHAT_LOG_TABLE, {
        method: 'POST',
        headers: Object.assign({}, CHAT_HEADS, { 'Prefer': 'return=minimal' }),
        body: JSON.stringify({
          session_id: nestId,
          user_name: duckName,
          user_message: userMsg,
          bot_reply: botReply,
          created_at: new Date().toISOString()
        })
      });
    } catch(e) {}
  }

  // ── Send message ─────────────────────────────────────────────────────────────
  async function launchBread() {
    const text = inputEl.value.trim();
    if (!text || duckBusy) return;
    duckBusy = true;
    throwBtn.disabled = true;
    inputEl.value = '';
    inputEl.style.height = 'auto';

    appendMessage('user', text);
    chatLog.push({ role: 'user', content: text });
    duckThinking();

    // load memory if not loaded yet
    if (!pastMemory && duckName) pastMemory = await loadPastMemory(duckName);

    try {
      let data, attempts = 0;
      while (attempts < OR_MODELS.length) {
        const res = await fetch(OR_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + OR_KEY },
          body: JSON.stringify({
            model: pickLLM(),
            messages: [
              { role: 'system', content: SYSTEM_PROMPT(duckName || 'friend', sessionStorage.getItem('breduck-admin') === '1', pastMemory) },
              ...chatLog
            ],
            max_tokens: 700,
            temperature: 0.88
          })
        });
        data = await res.json();
        if (data.error && (data.error.code === 503 || data.error.code === 404 || /provider|unavailable|overload|no endpoints/i.test(data.error.message || ''))) {
          llmSlot++; attempts++; continue;
        }
        break;
      }
      stopWobble();
      if (data.error) {
        appendMessage('assistant', 'Honk— ran into a snag: ' + (data.error.message || 'unknown error'));
      } else {
        const reply = data.choices?.[0]?.message?.content?.trim() || 'Honk— got distracted by a pretzel cart. What were you saying?';
        chatLog.push({ role: 'assistant', content: reply });
        const ttsEnabled = sessionStorage.getItem('breduck-admin') === '1' && sessionStorage.getItem('breduck-tts') === '1';
        duckTypeReply(reply, ttsEnabled ? () => speakReply(reply) : null);
        stashFeathers();
        saveLog(text, reply);
        if (!nestOpen) unreadPip.classList.add('show');
      }
    } catch(e) {
      stopWobble();
      appendMessage('assistant', 'Something went wrong — probably a pigeon chewed through a wire. Try again?');
    } finally {
      duckBusy = false;
      throwBtn.disabled = false;
      inputEl.focus();
    }
  }

  // ── Admin: Chat History viewer ───────────────────────────────────────────────
  const logBackdrop = document.getElementById('bdHistoryOverlay');
  const logScroll   = document.getElementById('bdHistoryBody');
  const logCloseBtn = document.getElementById('bdHistoryClose');
  logCloseBtn.addEventListener('click', () => { logBackdrop.style.opacity='0'; logBackdrop.style.pointerEvents='none'; });
  logBackdrop.addEventListener('click', e => { if (e.target === logBackdrop) { logBackdrop.style.opacity='0'; logBackdrop.style.pointerEvents='none'; } });

  window.bdOpenChatHistory = async function() {
    logBackdrop.style.opacity = '1'; logBackdrop.style.pointerEvents = 'all';
    document.getElementById('bdHistoryModal').style.transform = 'translateY(0)';
    logScroll.innerHTML = '<div style="text-align:center;padding:2rem 0;color:var(--text3,#888);font-size:0.85rem;">Loading conversations…</div>';
    try {
      const res = await fetch(SB_URL + '/rest/v1/' + CHAT_LOG_TABLE + '?select=session_id,user_name,created_at&order=created_at.desc', { headers: CHAT_HEADS });
      const rows = await res.json();
      if (!rows.length) { logScroll.innerHTML = '<div style="text-align:center;padding:2rem 0;color:var(--text3,#888);">No conversations yet.</div>'; return; }
      const sessions = {};
      rows.forEach(r => { if (!sessions[r.session_id]) sessions[r.session_id] = r; });
      logScroll.innerHTML = '';
      Object.values(sessions).forEach(s => {
        const btn = document.createElement('button');
        btn.style.cssText = 'width:100%;text-align:left;background:var(--bg2,#f5f5f5);border:1px solid var(--border,#eee);border-radius:8px;padding:0.75rem 1rem;margin-bottom:0.5rem;cursor:pointer;font-family:inherit;font-size:0.85rem;color:var(--text,#111);display:flex;align-items:center;justify-content:space-between;';
        const date = new Date(s.created_at).toLocaleString();
        btn.innerHTML = `<div><strong>${s.user_name || 'Anonymous'}</strong><div style="font-size:0.68rem;color:var(--text3,#888);margin-top:0.2rem;">${date}</div></div><span style="color:var(--yellow-dark,#C49B10)">View →</span>`;
        btn.addEventListener('click', () => peekNest(s.session_id, s.user_name));
        logScroll.appendChild(btn);
      });
    } catch(e) { logScroll.innerHTML = '<div style="text-align:center;padding:2rem;color:#e74c3c;">Failed to load. Make sure the bd_chat_logs table exists in Supabase.</div>'; }
  };

  async function peekNest(sid, name) {
    logScroll.innerHTML = '<div style="text-align:center;padding:2rem 0;color:var(--text3,#888);font-size:0.85rem;">Loading…</div>';
    try {
      const res = await fetch(SB_URL + '/rest/v1/' + CHAT_LOG_TABLE + '?session_id=eq.' + sid + '&order=created_at.asc', { headers: CHAT_HEADS });
      const rows = await res.json();
      logScroll.innerHTML = '';
      const back = document.createElement('button');
      back.style.cssText = 'font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--text3,#888);background:none;border:none;cursor:pointer;font-family:inherit;padding:0 0 0.8rem;display:flex;align-items:center;gap:0.3rem;';
      back.textContent = '← All conversations';
      back.addEventListener('click', window.bdOpenChatHistory);
      logScroll.appendChild(back);
      const title = document.createElement('div');
      title.style.cssText = 'font-family:Fraunces,serif;font-size:1rem;margin-bottom:1rem;color:var(--text,#111);';
      title.textContent = (name || 'Anonymous') + '\u2019s conversation';
      logScroll.appendChild(title);
      const chat = document.createElement('div');
      chat.style.cssText = 'display:flex;flex-direction:column;gap:0.6rem;';
      rows.forEach(r => {
        const um = document.createElement('div');
        um.style.cssText = 'padding:0.5rem 0.8rem;border-radius:10px;font-size:0.82rem;line-height:1.55;max-width:85%;background:var(--yellow,#F5C842);color:#111;align-self:flex-end;white-space:pre-wrap;word-break:break-word;';
        um.innerHTML = `<div style="font-size:0.6rem;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;margin-bottom:0.15rem;opacity:0.6;">${r.user_name}</div>${r.user_message}`;
        const bm = document.createElement('div');
        bm.style.cssText = 'padding:0.5rem 0.8rem;border-radius:10px;font-size:0.82rem;line-height:1.55;max-width:85%;background:var(--bg2,#f5f5f5);border:1px solid var(--border,#eee);color:var(--text,#111);align-self:flex-start;white-space:pre-wrap;word-break:break-word;';
        bm.innerHTML = `<div style="font-size:0.6rem;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;margin-bottom:0.15rem;opacity:0.6;">BreDucky</div>${r.bot_reply}`;
        chat.appendChild(um); chat.appendChild(bm);
      });
      logScroll.appendChild(chat);
    } catch(e) { logScroll.innerHTML = '<div style="text-align:center;padding:2rem;color:#e74c3c;">Failed to load messages.</div>'; }
  }

  // ── Takeover mode: Clark types as BreDucky ──────────────────────────────────
  const takeoverBackdrop = document.getElementById('bdTakeoverOverlay');
  const takeoverModal    = document.getElementById('bdTakeoverModal');
  const takeoverInput    = document.getElementById('bdTakeoverInput');
  const takeoverSendBtn  = document.getElementById('bdTakeoverSend');
  const takeoverCloseBtn = document.getElementById('bdTakeoverClose');
  const takeoverStatus   = document.getElementById('bdTakeoverStatus');

  window.bdOpenTakeover = function() {
    takeoverBackdrop.style.opacity = '1'; takeoverBackdrop.style.pointerEvents = 'all';
    takeoverModal.style.transform = 'translateY(0)';
    // open chat window too so clark can see the convo
    if (!nestOpen) openDuckChat();
    setTimeout(() => takeoverInput.focus(), 300);
  };
  function closeTakeover() {
    takeoverBackdrop.style.opacity = '0'; takeoverBackdrop.style.pointerEvents = 'none';
    takeoverModal.style.transform = 'translateY(20px)';
  }
  takeoverCloseBtn.addEventListener('click', closeTakeover);
  takeoverBackdrop.addEventListener('click', e => { if (e.target === takeoverBackdrop) closeTakeover(); });

  takeoverSendBtn.addEventListener('click', async () => {
    const text = takeoverInput.value.trim();
    if (!text) return;
    takeoverInput.value = '';
    takeoverStatus.textContent = 'Sent as BreDucky ✓';
    setTimeout(() => takeoverStatus.textContent = '', 2000);
    // inject directly as BreDucky reply in the chat window
    chatLog.push({ role: 'assistant', content: text });
    stashFeathers();
    // show in chat (opens it if not open)
    if (!nestOpen) openDuckChat();
    appendMessage('assistant', text);
    // log it to supabase
    await saveLog('[CLARK TAKEOVER]', text);
  });
  takeoverInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); takeoverSendBtn.click(); } });

  // ── Admin TTS / STT ─────────────────────────────────────────────────────────
  let mediaRecorder = null, audioChunks = [];

  window.bdToggleMic = async function() {
    const btn = document.getElementById('bdMicBtn');
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (btn) { btn.textContent = '🎙️'; btn.style.background = ''; }
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        // transcribe via Groq Whisper
        const form = new FormData();
        form.append('file', blob, 'audio.webm');
        form.append('model', 'whisper-large-v3');
        try {
          const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + OR_KEY },
            body: form
          });
          const data = await res.json();
          if (data.text) {
            inputEl.value = data.text;
            inputEl.dispatchEvent(new Event('input'));
            launchBread();
          }
        } catch(e) { console.error('transcription failed', e); }
      };
      mediaRecorder.start();
      if (btn) { btn.textContent = '⏹️'; btn.style.background = 'rgba(231,76,60,0.15)'; }
    } catch(e) {
      alert('Mic access denied or unavailable.');
    }
  };

  window.bdToggleTTS = function() {
    const on = sessionStorage.getItem('breduck-tts') === '1';
    sessionStorage.setItem('breduck-tts', on ? '0' : '1');
    const btn = document.getElementById('bdTtsToggleBtn');
    if (btn) btn.textContent = on ? '🔇 TTS Off' : '🔊 TTS On';
  };

  // expose for admin panel
  window.bdOpenDuckChat = openDuckChat;
  window.bdSetDuckName = (n) => { duckName = n; };
})();
