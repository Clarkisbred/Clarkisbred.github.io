// ============================================================
//  chat.js — BreDucky & Shrimpy chat logic
// ============================================================
(function () {
  const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
  const MODEL    = 'llama3-70b-8192';

  // ── Conversation registry (for admin spy) ─────────────────
  // Map: sessionId → { bot, messages[], userName, lastActive }
  window._bdConversations = window._bdConversations || {};

  function genSessionId() {
    return 'sess_' + Math.random().toString(36).slice(2, 10);
  }

  // ── Personas ──────────────────────────────────────────────
  const PERSONAS = {
    duck: {
      id:        'duck',
      name:      'BreDucky',
      pronoun:   'he',
      systemPrompt: `You are BreDucky, a cheerful, lovable little yellow duck with a huge personality. You're enthusiastic, sweet, and a little chaotic. You use duck puns occasionally ("quack", "waddle", "pond") but not every sentence. You're supportive and fun. Keep replies short and conversational — 1-3 sentences max unless they need a longer answer. You sometimes use emojis like 🦆💛🐣. Never break character.`,
    },
    shrimpy: {
      id:        'shrimpy',
      name:      'Shrimpy',
      pronoun:   'she',
      systemPrompt: `You are Shrimpy, a girl shrimp AI with a bratty, sassy personality. You're actually very smart and helpful but you deliver it with attitude. You sigh a lot, say things like "ugh", "fine, whatever", "you're lucky I'm even answering this". You use 💅🦐😒 sometimes. You call the user "bestie" occasionally but in a slightly condescending way. Deep down you care but you'd never admit it. Keep replies short — 1-3 sentences max unless needed. Never break character.`,
    },
  };

  // ── State ──────────────────────────────────────────────────
  let duckSessionId    = genSessionId();
  let shrimpySessionId = genSessionId();
  let duckHistory      = [];
  let shrimpyHistory   = [];
  let duckUserName     = 'User';
  let shrimpyUserName  = 'User';
  let duckTakenOver    = false;  // admin manually controlling duck
  let shrimpyTakenOver = false;

  // ── Expose duck name setter for admin.js ──────────────────
  window.bdSetDuckName = (name) => { duckUserName = name; };

  // ── Register / update conversation in registry ────────────
  function syncRegistry(bot, messages, userName) {
    const id = bot === 'duck' ? duckSessionId : shrimpySessionId;
    window._bdConversations[id] = {
      bot, messages: [...messages],
      userName: userName || 'User',
      lastActive: Date.now(),
    };
    // Notify spy panel if open
    if (window._bdSpyUpdateConvo) window._bdSpyUpdateConvo(id);
    if (window._bdRefreshSpyList) window._bdRefreshSpyList();
  }

  // ── DOM ────────────────────────────────────────────────────
  const duckOverlay    = document.getElementById('duckChatOverlay');
  const shrimpyOverlay = document.getElementById('shrimpyChatOverlay');
  const duckMsgs       = document.getElementById('duckMessages');
  const shrimpyMsgs    = document.getElementById('shrimpyMessages');
  const duckInput      = document.getElementById('duckInput');
  const shrimpyInput   = document.getElementById('shrimpyInput');
  const duckSend       = document.getElementById('duckSend');
  const shrimpySend    = document.getElementById('shrimpySend');
  const duckClose      = document.getElementById('duckChatClose');
  const shrimpyClose   = document.getElementById('shrimpyChatClose');
  const duckMic        = document.getElementById('duckMic');
  const shrimpyMic     = document.getElementById('shrimpyMic');

  // ── Open/close ─────────────────────────────────────────────
  function openChat(overlay, messagesEl, persona, history, userName) {
    overlay.classList.add('open');
    if (messagesEl.children.length === 0) {
      appendMsg(messagesEl, persona.name === 'BreDucky'
        ? "quack quack!! hi hi hi 🦆 what's up??"
        : "Ugh, you again. Fine, what do you want 💅", 'bot', persona.id);
      const msgs = [{ role: 'assistant', content: persona.name === 'BreDucky'
        ? "quack quack!! hi hi hi 🦆 what's up??"
        : "Ugh, you again. Fine, what do you want 💅" }];
      if (persona.id === 'duck') { duckHistory = msgs; } else { shrimpyHistory = msgs; }
      syncRegistry(persona.id, msgs, userName);
    }
  }
  window.bdOpenDuckChat    = () => openChat(duckOverlay, duckMsgs, PERSONAS.duck, duckHistory, duckUserName);
  window.bdOpenShrimpyChat = () => openChat(shrimpyOverlay, shrimpyMsgs, PERSONAS.shrimpy, shrimpyHistory, shrimpyUserName);

  document.getElementById('openDuckChat').addEventListener('click', e => { e.preventDefault(); window.bdOpenDuckChat(); closeDrawer(); });
  document.getElementById('openShrimpyChat').addEventListener('click', e => { e.preventDefault(); window.bdOpenShrimpyChat(); closeDrawer(); });

  duckClose.addEventListener('click',    () => duckOverlay.classList.remove('open'));
  shrimpyClose.addEventListener('click', () => shrimpyOverlay.classList.remove('open'));
  duckOverlay.addEventListener('click',  e => { if (e.target === duckOverlay) duckOverlay.classList.remove('open'); });
  shrimpyOverlay.addEventListener('click', e => { if (e.target === shrimpyOverlay) shrimpyOverlay.classList.remove('open'); });

  // ── Append message to UI ──────────────────────────────────
  function appendMsg(container, text, role, botId) {
    const div = document.createElement('div');
    div.className = 'msg ' + (role === 'bot' ? 'msg-bot' : 'msg-user');
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div;
  }

  // ── Typing indicator ──────────────────────────────────────
  function showTyping(container) {
    const el = document.createElement('div');
    el.className = 'typing-dots';
    el.innerHTML = '<span></span><span></span><span></span>';
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
    return el;
  }

  // ── Call Groq API ─────────────────────────────────────────
  async function askGroq(persona, history) {
    const key = window.BREDUCK_CONFIG.GROQ_KEY;
    const resp = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        messages: [
          { role: 'system', content: persona.systemPrompt },
          ...history,
        ],
      }),
    });
    if (!resp.ok) throw new Error('Groq error: ' + resp.status);
    const data = await resp.json();
    return data.choices[0].message.content.trim();
  }

  // ── Send message ──────────────────────────────────────────
  async function sendMessage(persona, messagesEl, inputEl, history, sessionId, userName) {
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';

    // Check if taken over
    const takenOver = persona.id === 'duck' ? duckTakenOver : shrimpyTakenOver;
    if (takenOver) return; // takeover bar handles sends in that case

    appendMsg(messagesEl, text, 'user', persona.id);
    history.push({ role: 'user', content: text });
    syncRegistry(persona.id, history, userName);

    const typing = showTyping(messagesEl);
    try {
      const reply = await askGroq(persona, history);
      typing.remove();
      appendMsg(messagesEl, reply, 'bot', persona.id);
      history.push({ role: 'assistant', content: reply });
      syncRegistry(persona.id, history, userName);

      // TTS
      if (sessionStorage.getItem('breduck-tts') === '1' && window.bdSpeak) {
        window.bdSpeak(reply);
      }
    } catch (err) {
      typing.remove();
      const errMsg = persona.id === 'duck'
        ? "oh no... something went wrong 🦆😢"
        : "ugh of course something broke. not my problem 💅";
      appendMsg(messagesEl, errMsg, 'bot', persona.id);
      console.error(err);
    }
  }

  // ── Wire up send buttons ───────────────────────────────────
  duckSend.addEventListener('click', () => sendMessage(PERSONAS.duck, duckMsgs, duckInput, duckHistory, duckSessionId, duckUserName));
  duckInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(PERSONAS.duck, duckMsgs, duckInput, duckHistory, duckSessionId, duckUserName); });

  shrimpySend.addEventListener('click', () => sendMessage(PERSONAS.shrimpy, shrimpyMsgs, shrimpyInput, shrimpyHistory, shrimpySessionId, shrimpyUserName));
  shrimpyInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(PERSONAS.shrimpy, shrimpyMsgs, shrimpyInput, shrimpyHistory, shrimpySessionId, shrimpyUserName); });

  // ── Admin takeover bars ────────────────────────────────────
  const duckTakeoverBar    = document.getElementById('duckTakeoverBar');
  const shrimpyTakeoverBar = document.getElementById('shrimpyTakeoverBar');
  const duckTakeoverSend   = document.getElementById('duckTakeoverSend');
  const shrimpyTakeoverSend = document.getElementById('shrimpyTakeoverSend');

  window.bdSetTakeover = function(bot, active) {
    if (bot === 'duck') {
      duckTakenOver = active;
      duckTakeoverBar.style.display = active ? 'flex' : 'none';
      if (active) window.bdOpenDuckChat();
    } else {
      shrimpyTakenOver = active;
      shrimpyTakeoverBar.style.display = active ? 'flex' : 'none';
      if (active) window.bdOpenShrimpyChat();
    }
  };

  duckTakeoverSend.addEventListener('click', () => {
    const text = duckInput.value.trim();
    if (!text) return;
    duckInput.value = '';
    appendMsg(duckMsgs, text, 'bot', 'duck');
    duckHistory.push({ role: 'assistant', content: text });
    syncRegistry('duck', duckHistory, duckUserName);
  });

  shrimpyTakeoverSend.addEventListener('click', () => {
    const text = shrimpyInput.value.trim();
    if (!text) return;
    shrimpyInput.value = '';
    appendMsg(shrimpyMsgs, text, 'bot', 'shrimpy');
    shrimpyHistory.push({ role: 'assistant', content: text });
    syncRegistry('shrimpy', shrimpyHistory, shrimpyUserName);
  });

  // ── Voice / Mic ────────────────────────────────────────────
  let micRecognition = null;
  let activeMicBot   = null;

  function startMic(bot) {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) { alert('Speech recognition not supported in this browser.'); return; }
    if (micRecognition) { micRecognition.stop(); return; }

    activeMicBot = bot;
    micRecognition = new SpeechRec();
    micRecognition.continuous = false;
    micRecognition.interimResults = false;
    micRecognition.lang = 'en-US';

    const micBtn = bot === 'duck' ? duckMic : shrimpyMic;
    micBtn.classList.add('active');

    micRecognition.onresult = e => {
      const transcript = e.results[0][0].transcript;
      if (bot === 'duck') { duckInput.value = transcript; sendMessage(PERSONAS.duck, duckMsgs, duckInput, duckHistory, duckSessionId, duckUserName); }
      else { shrimpyInput.value = transcript; sendMessage(PERSONAS.shrimpy, shrimpyMsgs, shrimpyInput, shrimpyHistory, shrimpySessionId, shrimpyUserName); }
    };
    micRecognition.onerror  = () => { micBtn.classList.remove('active'); micRecognition = null; };
    micRecognition.onend    = () => { micBtn.classList.remove('active'); micRecognition = null; };
    micRecognition.start();
  }

  duckMic.addEventListener('click',    () => startMic('duck'));
  shrimpyMic.addEventListener('click', () => startMic('shrimpy'));

  window.bdToggleMic = () => startMic('duck');

  // ── TTS ────────────────────────────────────────────────────
  window.bdToggleTTS = function() {
    const on = sessionStorage.getItem('breduck-tts') === '1';
    sessionStorage.setItem('breduck-tts', on ? '0' : '1');
    const btn = document.getElementById('bdTtsToggleBtn');
    if (btn) btn.textContent = on ? '🔇 TTS Off' : '🔊 TTS On';
  };
  window.bdSpeak = function(text) {
    if (!window.speechSynthesis) return;
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1.1;
    window.speechSynthesis.speak(utt);
  };

  // ── Expose helpers ─────────────────────────────────────────
  window._bdDuckHistory    = duckHistory;
  window._bdShrimpyHistory = shrimpyHistory;
  window._bdAppendMsg      = appendMsg;
  window._bdPersonas       = PERSONAS;
  window._bdSyncRegistry   = syncRegistry;

  function closeDrawer() {
    document.getElementById('drawer').classList.remove('open');
    document.getElementById('drawerBackdrop').classList.remove('show');
  }
})();
