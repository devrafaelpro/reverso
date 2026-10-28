import { NAMES } from './names.js';
import * as A from './audio.js';
import { check, maskName } from './match.js';

// ============ utilidades ============
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const vibrate = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch {} };
const SITE = location.origin;

const store = {
  get(k, d) { try { const v = localStorage.getItem('rv_' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('rv_' + k, JSON.stringify(v)); } catch {} },
};

const CATS = {
  musica: '🎤 Música', futebol: '⚽ Futebol', esporte: '🏅 Esportes',
  tv: '📺 TV & Cinema', internet: '📱 Internet', personagens: '🧸 Personagens',
};

const LEVELS = [
  [0, 'Ouvido de Lata'], [60, 'Aprendiz do Avesso'], [150, 'Desvirador'], [300, 'Caçador de Sílabas'],
  [500, 'Decifrador'], [800, 'Ouvido Biônico'], [1200, 'Mestre do Reverso'], [1700, 'Lenda Invertida'],
  [2400, 'Gênio do Avesso'], [3300, 'OSREVER SUPREMO'],
];

const ROUNDS = 10, DAILY_ROUNDS = 5, MAX_TRIES = 3;
const PTS_REVERSE = 10, PTS_RECORDED = 6, HINT_COST = 3, MAX_COMBO = 5;

function rng(seed) { // mulberry32
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
function shuffle(arr, rand = Math.random) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function todayKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function dayNumber() { const a = new Date(2026, 9, 1), b = new Date(); b.setHours(0, 0, 0, 0); return Math.round((b - a) / 864e5) + 1; }

function toast(msg, ms = 2200) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), ms);
}

function show(id) {
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  window.scrollTo(0, 0);
}
function openModal(id) { $('#m-' + id).classList.add('show'); if (id === 'stats') renderStats(); }
$$('[data-open]').forEach(b => b.addEventListener('click', () => { A.sfx.tap(); openModal(b.dataset.open); }));
$$('.modal').forEach(m => m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close]')) m.classList.remove('show'); }));

// ============ níveis / estatísticas ============
let stats = store.get('stats', { xp: 0, games: 0, best: 0, hits: 0, total: 0, revOnly: 0, bestStreak: 0 });
function levelOf(xp) {
  let i = 0; while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1][0]) i++;
  const cur = LEVELS[i][0], next = LEVELS[i + 1] ? LEVELS[i + 1][0] : null;
  return { n: i + 1, title: LEVELS[i][1], cur, next, pct: next ? (xp - cur) / (next - cur) : 1 };
}
function renderLevel() {
  const L = levelOf(stats.xp);
  $('#lvl-num').textContent = L.n;
  $('#lvl-title').textContent = L.title;
  $('#lvl-bar').style.width = (L.pct * 100).toFixed(1) + '%';
  $('#lvl-xp').textContent = L.next ? `${stats.xp} / ${L.next} XP` : `${stats.xp} XP · nível máximo!`;
}
function renderStats() {
  const acc = stats.total ? Math.round(stats.hits / stats.total * 100) : 0;
  const ds = store.get('dailyStreak', { count: 0 });
  const items = [
    [stats.games, 'partidas'], [stats.best, 'recorde'], [acc + '%', 'acertos'],
    [stats.revOnly, 'só no reverso'], [stats.bestStreak, 'maior sequência'], [ds.count, 'dias seguidos'],
  ];
  $('#stats-grid').innerHTML = items.map(([v, l]) => `<div class="stat"><b>${v}</b><small>${l}</small></div>`).join('');
  const L = levelOf(stats.xp);
  $('#titles').innerHTML = LEVELS.map(([xp, t], i) =>
    `<div class="${i < L.n ? 'got' : ''} ${i === L.n - 1 ? 'cur' : ''}"><span>${i + 1}. ${t}</span><span>${i < L.n ? '✓' : xp + ' XP'}</span></div>`).join('');
}

// ============ logo animado ============
(function logo() {
  const word = 'REVERSO', el = $('#logo');
  el.innerHTML = [...word].map(c => `<span>${c}</span>`).join('');
  const spans = [...el.children];
  let reversed = false;
  setInterval(async () => {
    if (!$('#s-home').classList.contains('active')) return;
    reversed = !reversed;
    const target = reversed ? [...word].reverse().join('') : word;
    for (let i = 0; i < spans.length; i++) {
      const s = spans[i];
      s.classList.add('flip');
      setTimeout(() => { s.textContent = target[i]; s.classList.remove('flip'); }, 250);
      await sleep(70);
    }
  }, 3600);
})();

// ============ categorias ============
let cats = store.get('cats', Object.keys(CATS));
function renderCats() {
  $('#cats').innerHTML = Object.entries(CATS).map(([k, v]) =>
    `<button class="cat ${cats.includes(k) ? 'on' : ''}" data-cat="${k}">${v}</button>`).join('');
}
$('#cats').addEventListener('click', (e) => {
  const b = e.target.closest('.cat'); if (!b) return;
  A.sfx.tap();
  const k = b.dataset.cat;
  cats = cats.includes(k) ? cats.filter(c => c !== k) : [...cats, k];
  if (!cats.length) { cats = [k]; toast('Escolha pelo menos uma categoria'); }
  store.set('cats', cats); renderCats();
});

// ============ som ============
let soundOn = store.get('sound', true);
function renderSound() { $('#btn-sound').textContent = soundOn ? '🔊' : '🔇'; A.setSfx(soundOn); }
$('#btn-sound').addEventListener('click', () => { soundOn = !soundOn; store.set('sound', soundOn); renderSound(); A.sfx.tap(); });

// ============ gravação reutilizável ============
const recorder = new A.Recorder();
function recUI({ btn, canvas, hint, maxSec = 7, onDone }) {
  let levels = [], busy = false;
  const ring = btn.querySelector('.ring circle');
  const draw = () => {
    if (!recorder.active) return;
    const n = A.barCount(canvas);
    const pk = levels.slice(-n);
    while (pk.length < n) pk.unshift(0.04);
    A.drawWave(canvas, pk, 1, ['#fb7185', '#f43f5e', '#e11d48']);
    if (ring) ring.style.strokeDashoffset = 289 * (1 - Math.min(1, recorder.elapsed() / maxSec));
    requestAnimationFrame(draw);
  };
  async function finish() {
    if (!recorder.active) return;
    const buf = recorder.stop();
    btn.classList.remove('rec');
    A.sfx.recOff();
    if (!buf) { hint.textContent = 'Não deu pra ouvir nada 🤔 Tenta de novo, mais perto do microfone.'; A.drawWave(canvas, null); return; }
    onDone(buf);
  }
  btn.addEventListener('click', async () => {
    A.unlock();
    if (recorder.active) return finish();
    if (busy) return;
    busy = true;
    try {
      levels = [];
      await recorder.start({ maxSec, onLevel: (v) => levels.push(Math.min(1, v * 6 + 0.04)), onAutoStop: finish });
      A.sfx.recOn(); vibrate(20);
      btn.classList.add('rec');
      hint.textContent = 'Gravando... toque de novo para parar';
      draw();
    } catch (err) {
      console.error(err);
      hint.textContent = '🎙️ Precisamos do microfone! Libere a permissão nas configurações do navegador.';
      toast('Microfone bloqueado');
    } finally { busy = false; }
  });
  return { finish };
}

// ============ JOGO ============
const G = { mode: 'classic', items: [], idx: 0, score: 0, streak: 0, results: [], r: null, slow: false };

function pickClassic() {
  const pool = NAMES.filter(n => cats.includes(n.c));
  const seen = new Set(store.get('seen', []));
  let fresh = pool.filter(n => !seen.has(n.id));
  if (fresh.length < ROUNDS) { store.set('seen', []); fresh = pool; }
  return shuffle(fresh).slice(0, ROUNDS);
}
function pickDaily() {
  return shuffle(NAMES, rng(hash('reverso-' + todayKey()))).slice(0, DAILY_ROUNDS);
}

async function startGame(mode) {
  A.unlock();
  if (mode === 'daily') {
    const d = store.get('daily', null);
    if (d && d.day === todayKey()) { showDailyDone(d); return; }
  }
  G.mode = mode;
  G.items = mode === 'daily' ? pickDaily() : pickClassic();
  G.idx = 0; G.score = 0; G.streak = 0; G.results = [];
  $('#score').textContent = '0';
  $('#dots').innerHTML = G.items.map(() => '<i></i>').join('');
  show('s-game');
  loadRound();
}

function worth() {
  const r = G.r;
  return Math.max(1, (r.recorded ? PTS_RECORDED : PTS_REVERSE) - (r.hint ? HINT_COST : 0));
}
function renderWorth() {
  const w = worth(), el = $('#worth');
  el.textContent = `Vale ${w} pts`;
  el.classList.toggle('mid', w < PTS_REVERSE && w >= 5);
  el.classList.toggle('low', w < 5);
  const s = $('#streak');
  if (G.streak >= 1) { s.classList.remove('hidden'); s.textContent = `🔥 ${G.streak} · +${Math.min(G.streak, MAX_COMBO)}`; }
  else s.classList.add('hidden');
}
function renderTries() {
  $('#tries').innerHTML = Array.from({ length: MAX_TRIES }, (_, i) => `<i class="${i < MAX_TRIES - G.r.tries ? 'used' : ''}"></i>`).join('');
}

async function loadRound() {
  const item = G.items[G.idx];
  G.r = { item, tries: MAX_TRIES, hint: false, recorded: false, plays: 0, done: false, rev: null, orig: null, me: null, meRaw: null };
  $$('#dots i').forEach((d, i) => d.classList.toggle('cur', i === G.idx));
  $('#cat-chip').textContent = CATS[item.c];
  $('#guess').value = ''; $('#guess').classList.remove('shake', 'warm');
  $('#hint-text').textContent = '';
  $('#btn-hint').disabled = false;
  $('#plays-note').textContent = 'toque para ouvir';
  $('#rec-hint').textContent = 'Toque no microfone e repita o som estranho';
  $('#me-controls').classList.add('hidden');
  $('#play-rev').classList.add('pulse');
  renderWorth(); renderTries();
  A.drawWave($('#wave-rev'), null); A.drawWave($('#wave-me'), null);
  try {
    const orig = await A.load(`/audio/${item.id}.mp3`);
    if (G.r.item !== item) return;
    G.r.orig = orig; G.r.rev = A.reverse(orig);
    G.r.revPk = A.peaks(G.r.rev, A.barCount($('#wave-rev')));
    A.drawWave($('#wave-rev'), G.r.revPk, 0);
  } catch (e) { console.error(e); toast('Erro ao carregar o áudio. Verifique a internet.'); }
  // pré-carrega o próximo
  const nx = G.items[G.idx + 1]; if (nx) A.load(`/audio/${nx.id}.mp3`).catch(() => {});
}

async function playRev() {
  const r = G.r; if (!r || !r.rev) return;
  A.unlock();
  const btn = $('#play-rev');
  btn.classList.remove('pulse'); btn.classList.add('playing'); btn.firstElementChild.textContent = '■';
  r.plays++;
  $('#plays-note').textContent = `ouviu ${r.plays}x`;
  await A.play(r.rev, { rate: G.slow ? 0.72 : 1, onProgress: p => A.drawWave($('#wave-rev'), r.revPk, p) });
  btn.classList.remove('playing'); btn.firstElementChild.textContent = '▶';
}
$('#play-rev').addEventListener('click', () => {
  if ($('#play-rev').classList.contains('playing')) { A.stop(); return; }
  playRev();
});
$('#btn-slow').addEventListener('click', (e) => {
  G.slow = !G.slow; e.currentTarget.classList.toggle('on', G.slow); A.sfx.tap();
});

async function playMe() {
  const r = G.r; if (!r.me) return;
  await A.play(r.me, { onProgress: p => A.drawWave($('#wave-me'), r.mePk, p, ['#34d399', '#22d3ee', '#a78bfa']) });
}
recUI({
  btn: $('#rec-btn'), canvas: $('#wave-me'), hint: $('#rec-hint'),
  onDone: (buf) => {
    const r = G.r; if (r.done) return;
    r.meRaw = buf; r.me = A.reverse(buf);
    r.mePk = A.peaks(r.me, A.barCount($('#wave-me')));
    if (!r.recorded) { r.recorded = true; renderWorth(); }
    $('#rec-hint').textContent = 'Esse é você desvirado! Reconheceu? 👀';
    $('#me-controls').classList.remove('hidden');
    playMe();
  },
});
$('#play-me').addEventListener('click', playMe);
$('#play-me-raw').addEventListener('click', () => {
  const r = G.r; if (!r.meRaw) return;
  const pk = A.peaks(r.meRaw, A.barCount($('#wave-me')));
  A.play(r.meRaw, { onProgress: p => A.drawWave($('#wave-me'), pk, p, ['#fb7185', '#f43f5e']) });
});

$('#guess-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const r = G.r; if (!r || r.done) return;
  const input = $('#guess'), val = input.value.trim();
  if (!val) { input.focus(); return; }
  const res = check(val, r.item);
  input.classList.remove('shake', 'warm'); void input.offsetWidth;
  if (res === 'yes') return finishRound(true);
  if (res === 'warm') {
    input.classList.add('warm'); A.sfx.warm(); vibrate(30);
    toast('🔥 Tá quente! Tenta o nome completo'); return;
  }
  r.tries--; renderTries();
  input.classList.add('shake'); A.sfx.wrong(); vibrate([40, 40, 40]);
  if (r.tries <= 0) return finishRound(false);
  input.select();
  toast(r.recorded ? `Não é... ${r.tries} chute${r.tries > 1 ? 's' : ''} restante${r.tries > 1 ? 's' : ''}` : `Não é! Tenta gravar e desvirar 🎙️`);
});

$('#btn-hint').addEventListener('click', () => {
  const r = G.r; if (r.done || r.hint) return;
  r.hint = true; A.sfx.tap();
  $('#hint-text').textContent = maskName(r.item.n);
  $('#btn-hint').disabled = true;
  renderWorth();
});
$('#btn-skip').addEventListener('click', () => { if (!G.r.done) finishRound(false); });

let quitArmed = 0;
$('#btn-quit').addEventListener('click', () => {
  if (Date.now() - quitArmed < 2500) { A.stop(); if (recorder.active) recorder.stop(); show('s-home'); refreshHome(); return; }
  quitArmed = Date.now(); toast('Toque de novo no ✕ para sair');
});

async function finishRound(ok) {
  const r = G.r; r.done = true;
  if (recorder.active) recorder.stop(), $('#rec-btn').classList.remove('rec');
  A.stop();
  $('#guess').blur();
  let pts = 0, kind = 'x';
  if (ok) {
    G.streak++;
    pts = worth() + Math.min(G.streak - 1, MAX_COMBO);
    kind = r.hint ? 'o' : r.recorded ? 'y' : 'g';
    stats.bestStreak = Math.max(stats.bestStreak, G.streak);
  } else G.streak = 0;
  G.score += pts;
  G.results.push({ id: r.item.id, n: r.item.n, kind, pts });
  const dot = $$('#dots i')[G.idx]; dot.classList.remove('cur'); dot.classList.add(kind);
  $('#score').textContent = G.score;
  if (pts) { const sp = $('.score-pill'); sp.classList.remove('bump'); void sp.offsetWidth; sp.classList.add('bump'); }

  const praise = kind === 'g' ? ['Ouvido absoluto!', 'Que ouvido!', 'Monstro!', 'Sem gravar?! 🤯'] : ['Acertou!', 'Mandou bem!', 'Boa!', 'É isso!'];
  $('#rv-emoji').textContent = ok ? (kind === 'g' ? '🤯' : '🎉') : '😵';
  $('#rv-title').textContent = ok ? praise[Math.floor(Math.random() * praise.length)] : 'Era...';
  $('#rv-name').textContent = r.item.n;
  const pe = $('#rv-points');
  pe.textContent = ok ? `+${pts} pts${G.streak > 1 ? ` · 🔥${G.streak}` : ''}` : '+0 pts';
  pe.classList.toggle('zero', !ok);
  $('#rv-next-label').textContent = G.idx + 1 < G.items.length ? 'Próximo' : 'Ver resultado';
  $('#reveal').classList.add('show');
  if (ok) { A.sfx.correct(); vibrate([30, 50, 30]); confetti(kind === 'g' ? 140 : 70); }
  else { A.sfx.reveal(); vibrate(60); }
  await sleep(ok ? 650 : 450);
  if (r.orig && $('#reveal').classList.contains('show')) A.play(r.orig);
}
$('#rv-orig').addEventListener('click', () => G.r.orig && A.play(G.r.orig));
$('#rv-rev').addEventListener('click', () => G.r.rev && A.play(G.r.rev));
$('#rv-next').addEventListener('click', () => {
  A.stop(); A.sfx.tap();
  $('#reveal').classList.remove('show');
  G.idx++;
  if (G.idx < G.items.length) loadRound(); else endGame();
});

// ============ RESULTADO ============
const EMO = { g: '🟢', y: '🟡', o: '🟠', x: '❌' };
function endGame() {
  const max = G.items.length * PTS_REVERSE;
  const pct = G.score / max;
  const stars = pct >= 0.8 ? 3 : pct >= 0.5 ? 2 : pct >= 0.2 ? 1 : 0;
  const hits = G.results.filter(r => r.kind !== 'x').length;

  const before = levelOf(stats.xp).n;
  stats.xp += G.score; stats.games++; stats.best = Math.max(stats.best, G.score);
  stats.hits += hits; stats.total += G.results.length;
  stats.revOnly += G.results.filter(r => r.kind === 'g').length;
  store.set('stats', stats);
  const seen = store.get('seen', []); store.set('seen', [...seen, ...G.items.map(i => i.id)].slice(-120));

  if (G.mode === 'daily') {
    const day = todayKey();
    store.set('daily', { day, score: G.score, results: G.results });
    const ds = store.get('dailyStreak', { last: null, count: 0 });
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yk = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
    if (ds.last !== day) { ds.count = ds.last === yk ? ds.count + 1 : 1; ds.last = day; store.set('dailyStreak', ds); }
  }
  renderResults({ mode: G.mode, score: G.score, results: G.results, stars, hits, xp: G.score, levelUp: levelOf(stats.xp).n > before });
}

function renderResults({ mode, score, results, stars, hits, xp, levelUp }) {
  $('#res-kicker').textContent = mode === 'daily' ? `DESAFIO DO DIA #${dayNumber()}` : 'FIM DE JOGO';
  $('#res-score').textContent = '0';
  $('#res-stars').innerHTML = [0, 1, 2].map(i => `<span style="animation-delay:${0.3 + i * 0.25}s">${i < stars ? '⭐' : '☆'}</span>`).join('');
  const msgs = ['Seu ouvido tá de cabeça pra baixo 😅', 'Tá pegando o jeito!', 'Mandou muito bem! 👏', 'Ouvido de outro planeta! 🛸'];
  $('#res-msg').textContent = `${hits}/${results.length} acertos · ${msgs[stars]}`;
  $('#res-grid').textContent = results.map(r => EMO[r.kind]).join('');
  $('#res-xp').textContent = levelUp ? `⬆️ SUBIU DE NÍVEL! Agora: ${levelOf(stats.xp).title}` : (xp != null ? `+${xp} XP · ${levelOf(stats.xp).title}` : '');
  $('#res-list').innerHTML = results.map(r =>
    `<li><span>${EMO[r.kind]}</span><span>${r.n}</span><em>${r.pts ? '+' + r.pts : ''}</em><button data-play="${r.id}" aria-label="Ouvir">🔊</button></li>`).join('');
  $('#btn-again').textContent = mode === 'daily' ? '▶ Modo normal' : '🔄 Jogar de novo';
  G.lastShare = { mode, score, results };
  show('s-results');
  // conta os pontos subindo
  const t0 = performance.now(), dur = 900;
  const step = (t) => { const k = Math.min(1, (t - t0) / dur); $('#res-score').textContent = Math.round(score * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
  if (stars >= 2) { A.sfx.win(); confetti(200); }
}
$('#res-list').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-play]'); if (!b) return;
  try { A.play(await A.load(`/audio/${b.dataset.play}.mp3`)); } catch {}
});

function showDailyDone(d) {
  const hits = d.results.filter(r => r.kind !== 'x').length;
  const pct = d.score / (d.results.length * PTS_REVERSE);
  renderResults({ mode: 'daily', score: d.score, results: d.results, stars: pct >= 0.8 ? 3 : pct >= 0.5 ? 2 : pct >= 0.2 ? 1 : 0, hits, xp: null });
  toast('Você já jogou o desafio de hoje! Volte amanhã 📅', 3000);
}

$('#btn-share').addEventListener('click', async () => {
  const s = G.lastShare; if (!s) return;
  const grid = s.results.map(r => EMO[r.kind]).join('');
  const head = s.mode === 'daily' ? `🔁 REVERSO · Desafio #${dayNumber()}` : '🔁 REVERSO';
  const text = `${head}\nFiz ${s.score} pts adivinhando famosos AO CONTRÁRIO 🙃\n${grid}\nDuvido você me bater 👇`;
  try {
    if (navigator.share) await navigator.share({ title: 'Reverso', text, url: SITE });
    else { await navigator.clipboard.writeText(text + '\n' + SITE); toast('Copiado! Cola no grupo 😎'); }
  } catch {}
});
$('#btn-again').addEventListener('click', () => startGame('classic'));
$('#btn-home').addEventListener('click', () => { show('s-home'); refreshHome(); });

// ============ MODO FESTA ============
const P = { round: 1, orig: null, rev: null, me: null, hits: 0, misses: 0 };
function partyStep(n) { ['p1', 'p2', 'p3'].forEach((id, i) => $('#' + id).classList.toggle('hidden', i !== n - 1)); }
function partyReset() {
  P.orig = P.rev = P.me = null;
  $('#party-round').textContent = P.round;
  $('#party-secret').value = '';
  $('#p1-done').classList.add('hidden');
  $('#p1-hint').textContent = 'Toque para gravar';
  $('#p2-hint').textContent = 'Grave imitando o som';
  $('#p2-me-controls').classList.add('hidden');
  partyStep(1);
  requestAnimationFrame(() => { A.drawWave($('#p1-wave'), null); });
}
function partyTally() { $('#party-tally').textContent = `Placar: ✅ ${P.hits} · ❌ ${P.misses}`; }
$('#btn-party').addEventListener('click', () => { A.unlock(); A.sfx.tap(); P.round = 1; P.hits = P.misses = 0; show('s-party'); partyReset(); });
$('#party-quit').addEventListener('click', () => { A.stop(); if (recorder.active) recorder.stop(); show('s-home'); refreshHome(); });

recUI({
  btn: $('#p1-rec'), canvas: $('#p1-wave'), hint: $('#p1-hint'), maxSec: 6,
  onDone: (buf) => {
    P.orig = buf; P.rev = A.reverse(buf);
    P.pk = A.peaks(P.rev, A.barCount($('#p1-wave')));
    A.drawWave($('#p1-wave'), P.pk, 0);
    $('#p1-hint').textContent = 'Gravado! Pode regravar se quiser.';
    $('#p1-done').classList.remove('hidden');
  },
});
$('#p1-listen').addEventListener('click', () => P.rev && A.play(P.rev, { onProgress: p => A.drawWave($('#p1-wave'), P.pk, p) }));
$('#p1-next').addEventListener('click', () => {
  A.stop(); A.sfx.tap(); partyStep(2);
  requestAnimationFrame(() => {
    P.pk2 = A.peaks(P.rev, A.barCount($('#p2-wave')));
    A.drawWave($('#p2-wave'), P.pk2, 0); A.drawWave($('#p2-me-wave'), null);
  });
});
$('#p2-play').addEventListener('click', async () => {
  const b = $('#p2-play'); b.firstElementChild.textContent = '■';
  await A.play(P.rev, { onProgress: p => A.drawWave($('#p2-wave'), P.pk2, p) });
  b.firstElementChild.textContent = '▶';
});
const playP2Me = () => P.me && A.play(P.me, { onProgress: p => A.drawWave($('#p2-me-wave'), P.mePk, p, ['#34d399', '#22d3ee', '#a78bfa']) });
recUI({
  btn: $('#p2-rec'), canvas: $('#p2-me-wave'), hint: $('#p2-hint'),
  onDone: (buf) => {
    P.me = A.reverse(buf); P.mePk = A.peaks(P.me, A.barCount($('#p2-me-wave')));
    $('#p2-hint').textContent = 'Você desvirado! Chuta em voz alta 🗣️';
    $('#p2-me-controls').classList.remove('hidden');
    playP2Me();
  },
});
$('#p2-play-me').addEventListener('click', playP2Me);
$('#p2-reveal').addEventListener('click', () => {
  A.stop(); A.sfx.reveal();
  const secret = $('#party-secret').value.trim();
  $('#p3-name').textContent = secret || '🤫 Falem aí!';
  partyStep(3); partyTally();
  setTimeout(() => P.orig && A.play(P.orig), 400);
});
$('#p3-replay').addEventListener('click', () => P.orig && A.play(P.orig));
$('#p3-ok').addEventListener('click', () => { P.hits++; A.sfx.correct(); confetti(90); P.round++; setTimeout(partyReset, 700); partyTally(); });
$('#p3-no').addEventListener('click', () => { P.misses++; A.sfx.wrong(); P.round++; partyReset(); partyTally(); });

// ============ HOME ============
function refreshHome() {
  renderLevel();
  const d = store.get('daily', null);
  const done = d && d.day === todayKey();
  $('#daily-sub').textContent = done ? `✅ Feito hoje · ${d.score} pts` : `#${dayNumber()} · igual pra todo mundo`;
}
$('#btn-play').addEventListener('click', () => { A.sfx.tap(); startGame('classic'); });
$('#btn-daily').addEventListener('click', () => { A.sfx.tap(); startGame('daily'); });

// ============ confete ============
const cv = $('#confetti'), cg = cv.getContext('2d');
let parts = [], confRunning = false;
function confetti(n = 100) {
  cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio;
  const colors = ['#8b5cf6', '#ec4899', '#f59e0b', '#22c55e', '#38bdf8', '#fff'];
  for (let i = 0; i < n; i++) parts.push({
    x: innerWidth / 2 + (Math.random() - 0.5) * 80, y: innerHeight * 0.55,
    vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 16 - 6, r: Math.random() * 6 + 4,
    c: colors[i % colors.length], a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4, life: 0,
  });
  if (!confRunning) { confRunning = true; requestAnimationFrame(confTick); }
}
function confTick() {
  const d = devicePixelRatio; cg.setTransform(d, 0, 0, d, 0, 0); cg.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter(p => p.life < 160 && p.y < innerHeight + 40);
  for (const p of parts) {
    p.life++; p.vy += 0.45; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.a += p.va;
    cg.save(); cg.translate(p.x, p.y); cg.rotate(p.a); cg.fillStyle = p.c;
    cg.globalAlpha = Math.max(0, 1 - p.life / 160); cg.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); cg.restore();
  }
  if (parts.length) requestAnimationFrame(confTick); else { confRunning = false; cg.clearRect(0, 0, innerWidth, innerHeight); }
}

// ============ instalação (PWA) ============
let deferredPrompt = null;
const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; $('#btn-install').classList.remove('hidden'); });
if (isIOS && !isStandalone) $('#btn-install').classList.remove('hidden');
$('#btn-install').addEventListener('click', async () => {
  if (deferredPrompt) { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $('#btn-install').classList.add('hidden'); }
  else if (isIOS) openModal('ios');
});
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));

// ============ início ============
renderCats(); renderSound(); refreshHome();
if (!store.get('seenHowto', false)) { store.set('seenHowto', true); setTimeout(() => openModal('howto'), 600); }
window.addEventListener('resize', () => {
  const r = G.r; if (r && r.rev && $('#s-game').classList.contains('active')) {
    r.revPk = A.peaks(r.rev, A.barCount($('#wave-rev'))); A.drawWave($('#wave-rev'), r.revPk, 0);
    if (r.me) { r.mePk = A.peaks(r.me, A.barCount($('#wave-me'))); A.drawWave($('#wave-me'), r.mePk, 1, ['#34d399', '#22d3ee', '#a78bfa']); }
  }
});
