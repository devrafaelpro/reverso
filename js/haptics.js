// Vibração: Android usa navigator.vibrate; iPhone (iOS 18+) usa o truque do <input switch>,
// que dispara o "toque" do sistema. Só funciona dentro de um toque do usuário.
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let on = true, label = null;

function iosTick() {
  if (!label) {
    const input = document.createElement('input');
    input.type = 'checkbox'; input.setAttribute('switch', ''); input.id = 'haptic-switch';
    input.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:0;height:0';
    label = document.createElement('label');
    label.htmlFor = 'haptic-switch'; label.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:0;height:0';
    document.body.append(input, label);
  }
  label.click();
}

const PATTERNS = { tap: 8, rec: 20, ok: [25, 60, 40], bad: [60, 40, 60], warm: 30, win: [30, 50, 30, 50, 80], star: 35 };

export function haptic(kind = 'tap') {
  if (!on) return;
  const p = PATTERNS[kind] ?? 10;
  try {
    if (navigator.vibrate) navigator.vibrate(p);
    else if (isIOS) {
      const n = Array.isArray(p) ? Math.ceil(p.length / 2) : 1;
      iosTick();
      for (let i = 1; i < n; i++) setTimeout(iosTick, i * 110);
    }
  } catch {}
}
export function setHaptics(v) { on = v; }
export const canVibrate = () => !!navigator.vibrate || isIOS;
