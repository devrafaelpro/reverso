// Compara o chute com o nome: ignora acentos, maiúsculas, pontuação e aceita pequenos erros.

export function norm(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

const tolerance = (len) => len <= 3 ? 0 : len <= 5 ? 1 : len <= 9 ? 2 : 3;

// Retorna 'yes' | 'warm' | 'no'
export function check(guess, item) {
  const g = norm(guess);
  if (!g) return 'no';
  const gc = g.replace(/ /g, '');
  const cands = [item.n, ...(item.a || [])].map(norm);
  let best = Infinity, bestLen = 1;
  for (const c of cands) {
    const cc = c.replace(/ /g, '');
    if (g === c || gc === cc) return 'yes';
    // chute contém o nome inteiro ("acho que é neymar")
    if (cc.length >= 4 && (' ' + g + ' ').includes(' ' + c + ' ')) return 'yes';
    const d = lev(gc, cc);
    if (d <= tolerance(cc.length)) return 'yes';
    if (d / cc.length < best / bestLen) { best = d; bestLen = cc.length; }
  }
  // Acertou o sobrenome/primeiro nome do nome principal (palavra com 5+ letras)?
  const words = norm(item.n).split(' ').filter(w => w.length >= 5);
  if (words.some(w => g.split(' ').some(x => lev(x, w) <= tolerance(w.length) - 1 && x.length >= 4))) return 'warm';
  if (best / bestLen <= 0.45) return 'warm';
  return 'no';
}

// "Caetano Veloso" -> "C _ _ _ _ _ _   V _ _ _ _ _"
export function maskName(name) {
  return name.split(' ').map(w => [...w].map((ch, i) => i === 0 ? ch.toUpperCase() : /[\p{L}\d]/u.test(ch) ? '_' : ch).join(' ')).join('   ');
}
