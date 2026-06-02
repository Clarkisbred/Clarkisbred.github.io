(function() {
  function applyPfp() {
    const heroPfp = document.querySelector('.hero-profile img');
    if (!heroPfp) return;
    const src = heroPfp.src;
    ['nav-pfp-img','drawer-pfp-img','footer-pfp-img'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.src = src;
    });
  }
  const heroImg = document.querySelector('.hero-profile img');
  if (heroImg && heroImg.complete) {
    applyPfp();
  } else if (heroImg) {
    heroImg.addEventListener('load', applyPfp);
    setTimeout(applyPfp, 0);
  }
})();
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobile-menu');
const mobileClose = document.getElementById('mobile-close');
const menuBackdrop = document.getElementById('menu-backdrop');
const mobileLinks = document.querySelectorAll('.mobile-link');
function openMenu() {
  mobileMenu.classList.add('open');
  menuBackdrop.classList.add('open');
  hamburger.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeMenu() {
  mobileMenu.classList.remove('open');
  menuBackdrop.classList.remove('open');
  hamburger.classList.remove('open');
  document.body.style.overflow = '';
}
hamburger.addEventListener('click', openMenu);
mobileClose.addEventListener('click', closeMenu);
menuBackdrop.addEventListener('click', closeMenu); mobileLinks.forEach(l => l.addEventListener('click', closeMenu));

const html = document.documentElement;
const toggle = document.getElementById('theme-toggle');
const ball = document.getElementById('toggle-ball');
const label = document.getElementById('theme-label');
const saved = localStorage.getItem('breduck-theme') || 'light';
applyTheme(saved);

function applyTheme(t) {
  html.setAttribute('data-theme', t);
  ball.textContent = t === 'dark' ? '🌙' : '☀️';
  label.textContent = t === 'dark' ? 'Dark' : 'Light';
  localStorage.setItem('breduck-theme', t);
}
toggle.addEventListener('click', () => {
  applyTheme(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});

const reveals = document.querySelectorAll('.reveal');
const obs = new IntersectionObserver(entries => {
  entries.forEach((e,i) => { if(e.isIntersecting) setTimeout(()=>e.target.classList.add('visible'), i*80); });
}, { threshold: 0.12 });
reveals.forEach(el => obs.observe(el));

const CHANNEL_ID = 'UCEQodoKAeqa4ZrIjZ-BYN0g';
const YT_RSS = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

function getCaption(index) {
  if (index === 0) return { text: '🦆 Latest', cls: 'caption-latest' };
  if (index === 1) return { text: '🔥 Most Viewed', cls: 'caption-popular' };
  const labels = ['Try This One', 'Check It Out', 'Worth Watching', 'Give It a Go', 'More from Me'];
  return { text: labels[index - 2] || 'Watch More', cls: 'caption-default' };
}

function makeVideoCard(videoId, title, date, link, index) {
  const thumbBase = `https://img.youtube.com/vi/${videoId}`;
  const caption = getCaption(index);
  const displayTitle = title || 'Watch on YouTube ↗';
  const wrap = document.createElement('div');
  wrap.className = 'video-card';
  wrap.dataset.index = index;
  wrap.innerHTML = `
    <span class="video-caption ${caption.cls}">${caption.text}</span>
    <a href="${link}" target="_blank" rel="noopener" class="video-card-inner">
      <div class="video-thumb">
        <img src="${thumbBase}/hqdefault.jpg" alt="${displayTitle}" loading="lazy"
             onerror="this.src='${thumbBase}/mqdefault.jpg'">
        <div class="play-overlay">
          <div class="play-btn">
            <svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21" fill="#111"/></svg>
          </div>
        </div>
      </div>
      <div class="video-info">
        <div class="video-title">${displayTitle}</div>
        <div class="video-meta">${date}</div>
      </div>
    </a>`;
  return wrap;
}

function parseXMLItems(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const entries = [...doc.querySelectorAll('entry')];
  return entries.slice(0, 8).map(entry => {
    const videoId = entry.querySelector('videoId')?.textContent
      || entry.querySelector('id')?.textContent?.split(':').pop() || '';
    const title = entry.querySelector('title')?.textContent || 'BreDuck Video';
    const published = entry.querySelector('published')?.textContent || '';
    const link = entry.querySelector('link')?.getAttribute('href')
      || `https://www.youtube.com/watch?v=${videoId}`;
    const date = published
      ? new Date(published).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' })
      : '';
    return { videoId, title, date, link };
  }).filter(v => v.videoId);
}

async function tryRss2json() {
  const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(YT_RSS)}&count=8`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== 'ok' || !data.items?.length) throw new Error('rss2json failed');
  return data.items.map(v => ({
    videoId: v.link.split('v=')[1]?.split('&')[0] || '',
    title: v.title,
    date: new Date(v.pubDate).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }),
    link: v.link,
  })).filter(v => v.videoId);
}
async function tryAllOrigins() {
  const url = `https://api.allorigins.win/get?url=${encodeURIComponent(YT_RSS)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.contents) throw new Error('allorigins failed');
  return parseXMLItems(data.contents);
}
async function tryCorsProxy() {
  const url = `https://corsproxy.io/?${encodeURIComponent(YT_RSS)}`;
  const res = await fetch(url);
  const text = await res.text();
  if (!text.includes('<entry>')) throw new Error('corsproxy failed');
  return parseXMLItems(text);
}
async function getLatestVideoIdsFromPage() {
  try {
    const url = `https://corsproxy.io/?${encodeURIComponent('https://www.youtube.com/@BreDuck/videos')}`;
    const res = await fetch(url);
    const html = await res.text();
    const matches = [...html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)];
    const seen = new Set(); const ids = [];
    for (const m of matches) {
      if (!seen.has(m[1]) && ids.length < 8) { seen.add(m[1]); ids.push({ videoId: m[1], title: '', date: '', link: `https://www.youtube.com/watch?v=${m[1]}` }); }
    }
    return ids;
  } catch(e) { return []; }
}

let carouselIndex = 0;
let carouselItems = [];

function updateCarousel(animate = true) {
  const track = document.getElementById('carousel-track');
  const cards = [...track.querySelectorAll('.video-card')];
  const dots = [...document.querySelectorAll('.carousel-dot')];
  const total = cards.length;

  cards.forEach((card, i) => {
    card.classList.remove('active', 'adjacent');
    if (i === carouselIndex) card.classList.add('active');
    else if (Math.abs(i - carouselIndex) === 1) card.classList.add('adjacent');
  });
  dots.forEach((dot, i) => dot.classList.toggle('active', i === carouselIndex));

    const activeCard = cards[carouselIndex];
  if (activeCard) {
    const outer = track.parentElement;
    const outerW = outer.offsetWidth;
    const cardW = activeCard.offsetWidth;
    const cardLeft = activeCard.offsetLeft;
    const scrollTarget = cardLeft - (outerW / 2) + (cardW / 2);
    if (animate) {
      track.style.transition = 'transform 0.5s cubic-bezier(0.77,0,0.18,1)';
    } else {
      track.style.transition = 'none';
    }
    track.style.transform = `translateX(${-scrollTarget}px)`;
  }

    document.getElementById('carousel-prev').disabled = carouselIndex === 0;
  document.getElementById('carousel-next').disabled = carouselIndex === total - 1;
}

function buildDots(count) {
  const dotsEl = document.getElementById('carousel-dots');
  dotsEl.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const dot = document.createElement('button');
    dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('aria-label', `Go to video ${i+1}`);
    dot.addEventListener('click', () => { carouselIndex = i; updateCarousel(); });
    dotsEl.appendChild(dot);
  }
}

async function loadVideos() {
  const track = document.getElementById('carousel-track');
  const loading = document.getElementById('loading-msg');
  loading.textContent = 'Loading videos…';

  let items = null;
  for (const attempt of [tryRss2json, tryAllOrigins, tryCorsProxy]) {
    try { items = await attempt(); if (items?.length) break; } catch(e) {}
  }
  if (!items?.length) items = await getLatestVideoIdsFromPage();

  if (items && items.length > 0) {
    loading.remove();
    carouselItems = items;
    items.forEach((v, i) => {
      track.appendChild(makeVideoCard(v.videoId, v.title, v.date, v.link, i));
    });
    buildDots(items.length);
        setTimeout(() => updateCarousel(false), 50);
  } else {
    loading.innerHTML = `<div style="padding:2rem;text-align:center">
      <div style="font-size:3rem;margin-bottom:1rem">🦆</div>
      <p style="font-family:'Fraunces',serif;font-size:1.1rem;color:var(--text);margin-bottom:.5rem">The ducks are shy today.</p>
      <a href="https://www.youtube.com/@BreDuck/videos" target="_blank"
         style="font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--yellow-dark);border-bottom:1px solid;text-decoration:none">
        Watch on YouTube ↗
      </a></div>`;
  }
}

document.getElementById('carousel-prev').addEventListener('click', () => {
  if (carouselIndex > 0) { carouselIndex--; updateCarousel(); }
});
document.getElementById('carousel-next').addEventListener('click', () => {
  const cards = document.querySelectorAll('.video-card');
  if (carouselIndex < cards.length - 1) { carouselIndex++; updateCarousel(); }
});

const carouselOuter = document.querySelector('.carousel-track-outer');
let scrollCooldown = false;

carouselOuter.addEventListener('wheel', e => {
  e.preventDefault(); // stop page from scrolling
  if (scrollCooldown) return;

  const cards = document.querySelectorAll('.video-card');
  if (e.deltaY > 0 || e.deltaX > 0) {
    if (carouselIndex < cards.length - 1) { carouselIndex++; updateCarousel(); }
  } else {
    if (carouselIndex > 0) { carouselIndex--; updateCarousel(); }
  }

    scrollCooldown = true;
  setTimeout(() => { scrollCooldown = false; }, 420);
}, { passive: false }); 
let touchStartX = 0;
let touchStartIndex = 0;
let isDragging = false;

const track = document.getElementById('carousel-track');

track.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  touchStartIndex = carouselIndex;
  isDragging = true;
  track.style.transition = 'none';
}, { passive: true });

track.addEventListener('touchmove', e => {
  if (!isDragging) return;
  const cards = [...track.querySelectorAll('.video-card')];
  if (!cards.length) return;
  const diff = touchStartX - e.touches[0].clientX;
  const activeCard = cards[touchStartIndex];
  if (activeCard) {
    const outer = track.parentElement;
    const outerW = outer.offsetWidth;
    const cardLeft = activeCard.offsetLeft;
    const baseOffset = cardLeft - (outerW / 2) + (activeCard.offsetWidth / 2);
    track.style.transform = `translateX(${-(baseOffset + diff)}px)`;
  }
}, { passive: true });

track.addEventListener('touchend', e => {
  if (!isDragging) return;
  isDragging = false;
  track.style.transition = '';
  const diff = touchStartX - e.changedTouches[0].clientX;
  const cards = document.querySelectorAll('.video-card');
  if (Math.abs(diff) > 50) {
    if (diff > 0 && carouselIndex < cards.length - 1) carouselIndex++;
    else if (diff < 0 && carouselIndex > 0) carouselIndex--;
  }
  updateCarousel();
}, { passive: true });

document.addEventListener('keydown', e => {
  const section = document.getElementById('videos');
  const rect = section.getBoundingClientRect();
  if (rect.top < window.innerHeight && rect.bottom > 0) {
    const cards = document.querySelectorAll('.video-card');
    if (e.key === 'ArrowRight' && carouselIndex < cards.length - 1) { carouselIndex++; updateCarousel(); }
    if (e.key === 'ArrowLeft' && carouselIndex > 0) { carouselIndex--; updateCarousel(); }
  }
});

loadVideos();

(function() {
  const HERO_IMG_SRC = document.querySelector('.hero-profile img')?.src || '';
  const FOUR_HOURS = 4 * 60 * 60 * 1000;
  const LAST_SEND_KEY = 'breduck-anon-last';

  const SUPABASE_URL  = window.BREDUCK_CONFIG.SUPABASE_URL;
  const SUPABASE_KEY  = window.BREDUCK_CONFIG.SUPABASE_KEY;

  const TABLE = 'anon_messages';

  const SEED = [
    "ducks are the most underrated animal on the planet, change my mind 🦆",
    "i found this channel at 3am and now i know too much about duck facts",
    "whoever feeds the ducks stale bread — reform is possible",
    "pond > ocean. fight me.",
    "the quack echo in empty parking lots is genuinely haunting",
    "if ducks had instagram they'd have more followers than me",
    "watching duck videos is my entire personality now and i'm fine with it",
  ];

  const HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json'
  };

  async function fetchMessages() {
    try {
      const url = SUPABASE_URL + '/rest/v1/' + TABLE
        + '?select=id,message,likes,created_at&order=created_at.asc&limit=100';
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) return SEED.map(m => ({ message: m }));
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return SEED.map(m => ({ message: m }));
      return data;
    } catch(e) {
      return SEED.map(m => ({ message: m }));
    }
  }

  async function updateLikeInDB(id, delta) {
    try {
      const getRes = await fetch(SUPABASE_URL + '/rest/v1/' + TABLE + '?id=eq.' + id + '&select=likes', { headers: HEADERS });
      const rows = await getRes.json();
      const current = (rows[0]?.likes) || 0;
      const newVal = Math.max(0, current + delta);
      await fetch(SUPABASE_URL + '/rest/v1/' + TABLE + '?id=eq.' + id, {
        method: 'PATCH',
        headers: Object.assign({}, HEADERS, { 'Prefer': 'return=minimal' }),
        body: JSON.stringify({ likes: newVal })
      });
    } catch(e) {}
  }

  async function insertMessage(text) {
    const url = SUPABASE_URL + '/rest/v1/' + TABLE;
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...HEADERS, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ message: text })
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('Supabase insert error:', res.status, err);
      throw new Error('insert failed: ' + err);
    }
    console.log('✅ Message saved to Supabase');
  }

  function getLastSend() {
    try { return parseInt(localStorage.getItem(LAST_SEND_KEY) || '0', 10); } catch(e) { return 0; }
  }
  function setLastSend(ts) {
    try { localStorage.setItem(LAST_SEND_KEY, String(ts)); } catch(e) {} 
  }

  let anonMessages = [];
  let anonIndex = 0;

  function escapeHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function makeAnonCard(msg, num, id, dbLikes, isTopLiked) {
    const cardKey  = 'liked-' + (id || num);
    const isLiked  = localStorage.getItem(cardKey) === '1';
    let likesCount = typeof dbLikes === 'number' ? dbLikes : 0;

    const card = document.createElement('div');
    card.className = 'anon-card' + (isTopLiked ? ' top-liked' : '');

    const pfpHtml = HERO_IMG_SRC
      ? `<img src="${HERO_IMG_SRC}" alt="Breduck pfp" loading="lazy">`
      : '<div style="width:100%;height:100%;background:var(--yellow-pale);display:flex;align-items:center;justify-content:center;font-size:1.2rem;">🦆</div>';

    const topBadge = isTopLiked ? '<span class="anon-top-badge">🏆 Top</span>' : '';

    card.innerHTML = `
      <div class="anon-card-label">Breduck's Anonymous #${num}${topBadge}</div>
      <div class="anon-card-msg">${escapeHtml(msg)}</div>
      <div class="anon-card-footer">
        <div class="anon-pfp">${pfpHtml}</div>
        <span class="anon-pfp-label">Breduck's Pond</span>
        <button class="anon-like-btn${isLiked ? ' liked' : ''}" aria-label="Like">
          <span class="like-heart">${isLiked ? '❤️' : '🤍'}</span>
          <span class="like-num">${likesCount > 0 ? likesCount : ''}</span>
        </button>
      </div>`;

    card.querySelector('.anon-like-btn').addEventListener('click', async e => {
      e.stopPropagation();
      const btn = e.currentTarget;
      const already = localStorage.getItem(cardKey) === '1';
      if (already) {
        likesCount = Math.max(0, likesCount - 1);
        localStorage.removeItem(cardKey);
        btn.classList.remove('liked');
        btn.querySelector('.like-heart').textContent = '🤍';
        if (id) updateLikeInDB(id, -1);
      } else {
        likesCount++;
        localStorage.setItem(cardKey, '1');
        btn.classList.add('liked');
        btn.querySelector('.like-heart').textContent = '❤️';
        if (id) updateLikeInDB(id, 1);
      }
      btn.querySelector('.like-num').textContent = likesCount > 0 ? likesCount : '';
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'anon-delete-btn';
    delBtn.textContent = '🗑';
    delBtn.title = 'Delete (admin only)';
    delBtn.addEventListener('click', async e => {
      e.stopPropagation();
      if (sessionStorage.getItem('breduck-admin') !== '1') return;
      if (!confirm('Delete this anonymous message?')) return;
      if (id) {
        try {
          await fetch(SUPABASE_URL + '/rest/v1/' + TABLE + '?id=eq.' + id, {
            method: 'DELETE', headers: HEADERS
          });
        } catch(err) { console.error('Delete failed:', err); }
      }
      await refreshMessages();
      anonIndex = Math.max(0, Math.min(anonIndex, anonMessages.length - 1));
      updateAnon();
    });
    const syncDel = () => {
      delBtn.style.display = sessionStorage.getItem('breduck-admin') === '1' ? 'flex' : 'none';
    };
    syncDel();
    const iv = setInterval(syncDel, 1000);
    new MutationObserver(() => { if (!document.contains(card)) clearInterval(iv); })
      .observe(document.body, { childList: true, subtree: true });
    card.appendChild(delBtn);
    return card;
  }

  function buildAnonDots(count) {
    const dotsEl = document.getElementById('anon-dots');
    dotsEl.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const dot = document.createElement('button');
      dot.className = 'anon-dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', 'Go to message ' + (i+1));
      dot.addEventListener('click', () => { anonIndex = i; updateAnon(); });
      dotsEl.appendChild(dot);
    }
  }

  function updateAnon(animate) {
    if (animate === undefined) animate = true;
    const track = document.getElementById('anon-track');
    const cards = [...track.querySelectorAll('.anon-card')];
    const dots  = [...document.querySelectorAll('.anon-dot')];
    if (!cards.length) return;
    cards.forEach((card, i) => {
      card.classList.remove('active', 'adjacent');
      if (i === anonIndex) card.classList.add('active');
      else if (Math.abs(i - anonIndex) === 1) card.classList.add('adjacent');
    });
    dots.forEach((dot, i) => dot.classList.toggle('active', i === anonIndex));
    const activeCard = cards[anonIndex];
    if (activeCard) {
      const outer = track.parentElement;
      const outerW = outer.offsetWidth;
      const scrollTarget = activeCard.offsetLeft - (outerW / 2) + (activeCard.offsetWidth / 2);
      track.style.transition = animate ? 'transform 0.5s cubic-bezier(0.77,0,0.18,1)' : 'none';
      track.style.transform = 'translateX(' + (-scrollTarget) + 'px)';
    }
  }

  function renderAnonCards(msgs) {
    const track = document.getElementById('anon-track');
    track.innerHTML = '';
    if (!msgs || !msgs.length) {
      track.innerHTML = '<div class="anon-empty">No messages yet. Be the first to quack anonymously 🦆</div>';
      document.getElementById('anon-dots').innerHTML = '';
      return;
    }
    // Find the top-liked card (only real DB messages with id)
    let topId = null, topLikes = 0;
    msgs.forEach(item => {
      if (typeof item === 'object' && item.id && typeof item.likes === 'number' && item.likes > topLikes) {
        topLikes = item.likes;
        topId = item.id;
      }
    });
    msgs.forEach((item, i) => {
      const msg      = typeof item === 'string' ? item : item.message;
      const id       = (typeof item === 'object' && item.id) ? item.id : null;
      const dbLikes  = (typeof item === 'object' && typeof item.likes === 'number') ? item.likes : 0;
      const isTop    = topId !== null && id === topId && topLikes > 0;
      track.appendChild(makeAnonCard(msg, i + 1, id, dbLikes, isTop));
    });
    buildAnonDots(msgs.length);
    anonIndex = Math.max(0, Math.min(anonIndex, msgs.length - 1));
    setTimeout(() => updateAnon(false), 40);
  }

  async function refreshMessages() {
    const msgs = await fetchMessages();
    anonMessages = msgs;
    renderAnonCards(msgs);
  }

  renderAnonCards(SEED.map(m => ({ message: m })));
  updateCooldownUI();

  function updateCooldownUI() {
    const last = getLastSend();
    const remaining = FOUR_HOURS - (Date.now() - last);
    const cooldownEl = document.getElementById('anon-cooldown');
    const sendBtn    = document.getElementById('anon-send-btn');
    const input      = document.getElementById('anon-input');
    if (remaining > 0) {
      const hrs  = Math.floor(remaining / 3600000);
      const mins = Math.ceil((remaining % 3600000) / 60000);
      cooldownEl.textContent = 'Next message in ' + (hrs > 0 ? hrs + 'h ' : '') + mins + 'm';
      sendBtn.style.opacity = '0.35';
      sendBtn.style.pointerEvents = 'none';
      input.disabled = true;
      input.placeholder = 'come back later to quack again…';
      setTimeout(updateCooldownUI, 30000);
    } else {
      cooldownEl.textContent = '';
      sendBtn.style.opacity = '';
      sendBtn.style.pointerEvents = '';
      input.disabled = false;
      input.placeholder = 'leave a message for the pond…';
    }
  }

  function showSentToast() {
    const existing = document.querySelector('.sent-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'sent-toast';
    toast.textContent = 'anonymous sent ✈';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2400);
  }

  async function doSend() {
    if (Date.now() - getLastSend() < FOUR_HOURS) return;
    const input = document.getElementById('anon-input');
    const btn   = document.getElementById('anon-send-btn');
    const text  = input.value.trim();
    if (!text) return;

        const svgEl = btn.querySelector('svg');
    svgEl.classList.remove('plane-flying');
    void svgEl.offsetWidth;
    svgEl.classList.add('plane-flying');
    setTimeout(() => svgEl.classList.remove('plane-flying'), 950);

    input.value = '';
    setLastSend(Date.now());
    updateCooldownUI();
    showSentToast();

    try {
      await insertMessage(text);
    } catch(e) {
      console.error('Send failed:', e);
            anonMessages.push({ message: text });
    }

    await refreshMessages();
    anonIndex = anonMessages.length - 1;
    updateAnon();
  }

  document.getElementById('anon-send-btn').addEventListener('click', doSend);
  document.getElementById('anon-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); doSend(); }
  });

  const anonOuter = document.querySelector('.anon-track-outer');
  let anonScrollCooldown = false;
  anonOuter.addEventListener('wheel', e => {
    e.preventDefault();
    if (anonScrollCooldown) return;
    const cards = document.querySelectorAll('.anon-card');
    if (e.deltaY > 0 || e.deltaX > 0) {
      if (anonIndex < cards.length - 1) { anonIndex++; updateAnon(); }
    } else {
      if (anonIndex > 0) { anonIndex--; updateAnon(); }
    }
    anonScrollCooldown = true;
    setTimeout(() => { anonScrollCooldown = false; }, 420);
  }, { passive: false });

  let anonTouchStartX = 0;
  let anonTouchStartIndex = 0;
  let anonDragging = false;
  const anonTrackEl = document.getElementById('anon-track');
  anonTrackEl.addEventListener('touchstart', e => {
    anonTouchStartX = e.touches[0].clientX;
    anonTouchStartIndex = anonIndex;
    anonDragging = true;
    anonTrackEl.style.transition = 'none';
  }, { passive: true });
  anonTrackEl.addEventListener('touchmove', e => {
    if (!anonDragging) return;
    const cards = [...anonTrackEl.querySelectorAll('.anon-card')];
    if (!cards.length) return;
    const diff = anonTouchStartX - e.touches[0].clientX;
    const activeCard = cards[anonTouchStartIndex];
    if (activeCard) {
      const outer = anonTrackEl.parentElement;
      const outerW = outer.offsetWidth;
      const baseOffset = activeCard.offsetLeft - (outerW/2) + (activeCard.offsetWidth/2);
      anonTrackEl.style.transform = 'translateX(' + (-(baseOffset + diff)) + 'px)';
    }
  }, { passive: true });
  anonTrackEl.addEventListener('touchend', e => {
    if (!anonDragging) return;
    anonDragging = false;
    anonTrackEl.style.transition = '';
    const diff = anonTouchStartX - e.changedTouches[0].clientX;
    const cards = document.querySelectorAll('.anon-card');
    if (Math.abs(diff) > 50) {
      if (diff > 0 && anonIndex < cards.length - 1) anonIndex++;
      else if (diff < 0 && anonIndex > 0) anonIndex--;
    }
    updateAnon();
  }, { passive: true });

  document.addEventListener('keydown', e => {
    const section = document.getElementById('anonymous');
    if (!section) return;
    const rect = section.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      const cards = document.querySelectorAll('.anon-card');
      if (e.key === 'ArrowRight' && anonIndex < cards.length - 1) { anonIndex++; updateAnon(); }
      if (e.key === 'ArrowLeft'  && anonIndex > 0)                 { anonIndex--; updateAnon(); }
    }
  });

    refreshMessages();
    setInterval(refreshMessages, 30000);
})();
