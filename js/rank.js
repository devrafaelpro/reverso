// Cliente do ranking online. Perfil fica salvo no aparelho (id + token secreto).
const KEY = 'rv_profile';
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } }
function save(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {} }
function rid(n) {
  const a = new Uint8Array(n); crypto.getRandomValues(a);
  return [...a].map(b => b.toString(16).padStart(2, '0')).join('');
}

let profile = load();
if (!profile) { profile = { id: rid(12), token: rid(24), name: '', pending: 0, pendingDaily: 0 }; save(profile); }

export const getName = () => profile.name;
export const myId = () => profile.id;

// Pontos ganhos antes de ter nome (ou sem internet) ficam guardados e vão no próximo envio.
export function addPending(gained, daily) {
  profile.pending = (profile.pending || 0) + (gained || 0);
  if (daily) profile.pendingDaily = Math.max(profile.pendingDaily || 0, daily);
  save(profile);
}

export async function sync(xp, nameOverride) {
  const name = nameOverride ?? profile.name;
  if (!name) return { ok: false, reason: 'sem-nome' };
  const body = { id: profile.id, token: profile.token, name, xp, gained: profile.pending || 0, daily: profile.pendingDaily || 0 };
  try {
    const r = await fetch('/api/rank', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, reason: j.error, msg: j.msg };
    profile.name = j.name; profile.pending = 0; profile.pendingDaily = 0; save(profile);
    return { ok: true };
  } catch { return { ok: false, reason: 'rede' }; }
}

export async function board(which) {
  const r = await fetch(`/api/rank?board=${which}&id=${profile.id}`);
  if (!r.ok) throw new Error('ranking ' + r.status);
  return r.json();
}
