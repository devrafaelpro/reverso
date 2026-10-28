// Ranking do Reverso — função serverless da Vercel + Upstash Redis (REST, sem dependências).
// GET  /api/rank?board=day|week|all&id=<id>   → top 50 + sua posição
// POST /api/rank  {id, token, name, xp, gained, daily} → registra/atualiza o jogador
import { createHash } from 'node:crypto';

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(cmds) {
  const r = await fetch(`${URL_}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error('redis ' + r.status);
  return (await r.json()).map(x => x.result);
}

// Datas no fuso de Brasília
function brDate(d = new Date()) {
  return new Date(d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
}
function dayKey() {
  const d = brDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function weekKey() {
  const d = brDate(); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); // quinta-feira da semana ISO
  const w1 = new Date(d.getFullYear(), 0, 4);
  const wk = 1 + Math.round(((d - w1) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${wk}`;
}
const KEYS = { day: () => `lb:day:${dayKey()}`, week: () => `lb:week:${weekKey()}`, all: () => 'lb:all' };

const BAD = ['porra', 'caralho', 'buceta', 'puta', 'viado', 'fdp', 'merda', 'cu ', 'pinto', 'rola', 'piroca', 'nazi', 'hitler', 'macaco', 'xota', 'boquete'];
function cleanName(s) {
  let n = String(s || '').replace(/[<>"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  const low = (n.toLowerCase() + ' ').normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (n.length < 2 || BAD.some(b => low.includes(b))) return null;
  return n;
}
const sha = (s) => createHash('sha256').update(String(s)).digest('hex');
const okId = (s) => typeof s === 'string' && /^[a-zA-Z0-9-]{8,40}$/.test(s);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!URL_ || !TOKEN) return res.status(500).json({ error: 'ranking não configurado' });
  try {
    if (req.method === 'GET') {
      const board = KEYS[req.query.board] ? req.query.board : 'week';
      const key = KEYS[board]();
      const id = okId(req.query.id) ? req.query.id : null;
      const cmds = [['ZREVRANGE', key, 0, 49, 'WITHSCORES'], ['ZCARD', key]];
      if (id) cmds.push(['ZREVRANK', key, id], ['ZSCORE', key, id]);
      const [flat, total, myRank, myScore] = await redis(cmds);
      const ids = []; const scores = [];
      for (let i = 0; i < flat.length; i += 2) { ids.push(flat[i]); scores.push(Number(flat[i + 1])); }
      const names = ids.length ? (await redis([['HMGET', 'names', ...ids]]))[0] : [];
      return res.status(200).json({
        board, total,
        top: ids.map((pid, i) => ({ name: names[i] || '???', score: scores[i], me: pid === id })),
        me: myRank == null ? null : { rank: myRank + 1, score: Number(myScore) },
      });
    }

    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      if (!okId(b.id) || typeof b.token !== 'string' || b.token.length < 16) return res.status(400).json({ error: 'id inválido' });
      const name = cleanName(b.name);
      if (!name) return res.status(400).json({ error: 'nome', msg: 'Escolha outro nome (2 a 16 letras, sem palavrão).' });

      const [stored, oldAll] = await redis([['HGET', 'tokens', b.id], ['ZSCORE', 'lb:all', b.id]]);
      if (stored && stored !== sha(b.token)) return res.status(403).json({ error: 'token' });

      const cmds = [['HSET', 'names', b.id, name]];
      if (!stored) cmds.push(['HSET', 'tokens', b.id, sha(b.token)]);
      // limites simples contra trapaça: valores fora do possível são ignorados
      const xp = Math.floor(Number(b.xp));
      if (xp >= 0 && (oldAll == null ? xp <= 6000 : xp <= Number(oldAll) + 600)) cmds.push(['ZADD', 'lb:all', 'GT', xp, b.id]);
      const gained = Math.floor(Number(b.gained));
      if (gained > 0 && gained <= 1500) {
        const wk = KEYS.week();
        cmds.push(['ZINCRBY', wk, gained, b.id], ['EXPIRE', wk, 60 * 60 * 24 * 21]);
      }
      const daily = Math.floor(Number(b.daily));
      if (daily > 0 && daily <= 130) {
        const dk = KEYS.day();
        cmds.push(['ZADD', dk, 'GT', daily, b.id], ['EXPIRE', dk, 60 * 60 * 24 * 4]);
      }
      await redis(cmds);
      return res.status(200).json({ ok: true, name });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'falha' });
  }
}
