/**
 * محرّك رسم الفيديو الترويجي (Canvas 2D خالص، بلا React).
 * يرسم خطاً زمنياً من المشاهد: مقدمة → 4K → آلاف القنوات → تفعيل فوري → دعوة للإجراء.
 * الألوان تأتي من الرموز الدلالية المحلولة (لا hex هنا)، فالمكوّن لا يعرف الثيم.
 */

export interface PromoFeature {
  /** نص كبير قصير (مثال: "4K"). */
  headline: string;
  /** وصف السطر الثاني. */
  caption: string;
  /** أيقونة مرسومة بالكود. */
  icon: "uhd" | "channels" | "bolt";
}

export interface PromoScript {
  brand: string;
  title: string;
  tagline: string;
  features: [PromoFeature, PromoFeature, PromoFeature];
  ctaLabel: string;
  /** يُعرض مع العدّاد في مشهد القنوات. */
  channelsCount: number;
}

export interface PromoPalette {
  primary: string;
  secondary: string;
  accent: string;
  ink: string;
  onBrand: string;
  surface: string;
  /** نص فوق لون التمييز (رمز --badge-text). */
  badgeText: string;
  fontFamily: string;
}

/**
 * قاعدة الفيلم: أسود سينمائي ثابت يُعامل كـ"صورة" لا كسطح واجهة، حتى يبقى التوهّج
 * النيوني ثابتاً في الوضعين الفاتح والداكن. كل ما عداه من الرموز.
 */
const FILM_BASE = "#06070d";
const FILM_BASE_RGB = "6,7,13";

export const PROMO_DURATION_MS = 16000;

/** حدود المشاهد بالمللي ثانية (ثابتة، مجموعها = PROMO_DURATION_MS). */
export const SCENES = {
  intro: [0, 3600],
  uhd: [3600, 6800],
  channels: [6800, 10000],
  bolt: [10000, 12800],
  cta: [12800, 16000],
} as const;
export type SceneKey = keyof typeof SCENES;

export function sceneAt(ms: number): SceneKey {
  const t = ((ms % PROMO_DURATION_MS) + PROMO_DURATION_MS) % PROMO_DURATION_MS;
  for (const k of Object.keys(SCENES) as SceneKey[]) {
    const [a, b] = SCENES[k];
    if (t >= a && t < b) return k;
  }
  return "cta";
}

/* ---------- أدوات رياضية ---------- */
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const outExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const outBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const inOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** يحوّل لون rgb()/rgba() محلول من المتصفح إلى نفس اللون بشفافية جديدة. */
export function withAlpha(color: string, alpha: number): string {
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (!m) return color;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean);
  const [r, g, b] = parts;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ---------- جسيمات حتمية (بلا عشوائية بين الإطارات) ---------- */
interface Particle {
  x: number;
  y: number;
  z: number;
  s: number;
  hue: 0 | 1 | 2;
}
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 0xffffffff;
  };
}
const rand = seeded(20240907);
const PARTICLES: Particle[] = Array.from({ length: 180 }, () => ({
  x: rand() * 2 - 1,
  y: rand() * 2 - 1,
  z: rand(),
  s: 0.6 + rand() * 1.8,
  hue: (Math.floor(rand() * 3) as 0 | 1 | 2),
}));

/* ---------- أشكال مساعدة ---------- */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

interface Frame {
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  /** وحدة قياس نسبية (أصغر ضلع / 100). */
  u: number;
  t: number;
  pal: PromoPalette;
  script: PromoScript;
}

function font(f: Frame, weight: number, size: number) {
  return `${weight} ${Math.round(size)}px ${f.pal.fontFamily}`;
}

/** نص مع توهّج نيون: طبقتان (توهّج عريض ثم حاد). */
function glowText(f: Frame, text: string, x: number, y: number, size: number, color: string, glow: string, opts: { weight?: number; blur?: number; alpha?: number; scale?: number } = {}) {
  const { ctx } = f;
  const { weight = 700, blur = size * 0.6, alpha = 1, scale = 1 } = opts;
  if (alpha <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  ctx.font = font(f, weight, size);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.direction = "rtl";
  ctx.shadowColor = glow;
  ctx.shadowBlur = blur;
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.shadowBlur = 0;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** كشف حاد للعنوان: يبدأ مشوّشاً ومكبّراً ثم "يركّز" مع مسح من اليمين. */
function focusInText(f: Frame, text: string, x: number, y: number, size: number, color: string, glow: string, p: number, weight = 700) {
  if (p <= 0) return;
  const { ctx } = f;
  const e = outExpo(p);
  ctx.save();
  ctx.font = font(f, weight, size);
  const w = ctx.measureText(text).width * 1.1;
  // مسح من اليمين إلى اليسار (RTL-first).
  const revealW = w * Math.min(1, e * 1.25);
  ctx.beginPath();
  ctx.rect(x + w / 2 - revealW, y - size, revealW, size * 2);
  ctx.clip();
  glowText(f, text, x, y, size, color, glow, { weight, blur: lerp(size * 1.4, size * 0.35, e), alpha: Math.min(1, p * 3), scale: lerp(1.18, 1, e) });
  ctx.restore();
}

/* ---------- الخلفية ---------- */
function drawBackdrop(f: Frame, backdrop?: Backdrop) {
  const { ctx, W, H, t, pal } = f;
  // سماء عميقة بلون اللوحة الداكنة للمتجر ممزوجاً بلون العلامة.
  const g = ctx.createRadialGradient(W * 0.5, H * 0.35, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.8);
  g.addColorStop(0, withAlpha(pal.primary, 0.28));
  g.addColorStop(0.45, withAlpha(pal.secondary, 0.14));
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = FILM_BASE;
  ctx.fillRect(0, 0, W, H);
  if (backdrop) {
    // فيديو/صورة خلفية اختيارية تحت المؤثرات مع تعتيم يحفظ قراءة النص.
    ctx.save();
    const bw = backdrop.width;
    const bh = backdrop.height;
    if (bw > 0 && bh > 0) {
      const k = Math.max(W / bw, H / bh);
      ctx.globalAlpha = 0.45;
      ctx.drawImage(backdrop.source, (W - bw * k) / 2, (H - bh * k) / 2, bw * k, bh * k);
    }
    ctx.restore();
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // هالات متحركة (orbs).
  const orbs = [
    { c: pal.primary, x: 0.2 + Math.sin(t / 3900) * 0.08, y: 0.3 + Math.cos(t / 3100) * 0.08, r: 0.55 },
    { c: pal.secondary, x: 0.8 + Math.cos(t / 4300) * 0.07, y: 0.7 + Math.sin(t / 3500) * 0.07, r: 0.5 },
    { c: pal.accent, x: 0.5 + Math.sin(t / 5200) * 0.15, y: 0.95, r: 0.35 },
  ];
  for (const o of orbs) {
    const r = Math.max(W, H) * o.r;
    const og = ctx.createRadialGradient(W * o.x, H * o.y, 0, W * o.x, H * o.y, r);
    og.addColorStop(0, withAlpha(o.c, 0.22));
    og.addColorStop(1, withAlpha(o.c, 0));
    ctx.fillStyle = og;
    ctx.fillRect(0, 0, W, H);
  }

  // أرضية شبكية منظورية تتحرك نحو الكاميرا.
  ctx.save();
  ctx.strokeStyle = withAlpha(pal.primary, 0.16);
  ctx.lineWidth = 1;
  const horizon = H * 0.62;
  const rows = 14;
  const offset = (t / 900) % 1;
  for (let i = 0; i <= rows; i++) {
    const k = (i + offset) / rows;
    const y = horizon + Math.pow(k, 2.2) * (H - horizon);
    ctx.globalAlpha = k * 0.9;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.6;
  for (let i = -8; i <= 8; i++) {
    ctx.beginPath();
    ctx.moveTo(W / 2 + i * W * 0.045, horizon);
    ctx.lineTo(W / 2 + i * W * 0.28, H);
    ctx.stroke();
  }
  // تلاشٍ علوي فوق الأفق كي لا تشوّش الشبكة النص.
  const fade = ctx.createLinearGradient(0, horizon, 0, H);
  fade.addColorStop(0, `rgba(${FILM_BASE_RGB},1)`);
  fade.addColorStop(0.35, `rgba(${FILM_BASE_RGB},0)`);
  ctx.globalAlpha = 1;
  ctx.fillStyle = fade;
  ctx.fillRect(0, horizon, W, H - horizon);
  ctx.restore();
}

function drawParticles(f: Frame, warp: number) {
  const { ctx, W, H, t, pal } = f;
  const cx = W / 2;
  const cy = H / 2;
  const hues = [pal.primary, pal.secondary, pal.accent];
  ctx.save();
  for (const p of PARTICLES) {
    // العمق يتناقص مع الزمن → الجسيم يقترب من الكاميرا (warp).
    const z = ((p.z - (t / 1000) * (0.05 + warp * 0.35)) % 1 + 1) % 1;
    const k = 1 / (0.15 + z * 1.6);
    const x = cx + p.x * cx * k;
    const y = cy + p.y * cy * k;
    if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
    const size = p.s * k * 0.9;
    const a = (1 - z) * 0.9;
    ctx.fillStyle = withAlpha(hues[p.hue], a);
    if (warp > 0.2) {
      // خطوط سرعة في المشاهد السريعة.
      const len = size * 6 * warp;
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy) || 1;
      ctx.strokeStyle = withAlpha(hues[p.hue], a * 0.8);
      ctx.lineWidth = Math.max(0.6, size * 0.5);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - (dx / d) * len, y - (dy / d) * len);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** شريط ضوئي مائل يمسح الشاشة. */
function drawSweep(f: Frame, p: number, color: string) {
  if (p <= 0 || p >= 1) return;
  const { ctx, W, H } = f;
  const x = lerp(-W * 0.4, W * 1.4, inOut(p));
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const g = ctx.createLinearGradient(x - W * 0.25, 0, x + W * 0.25, 0);
  g.addColorStop(0, withAlpha(color, 0));
  g.addColorStop(0.5, withAlpha(color, 0.35));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.transform(1, 0, -0.35, 1, 0, 0);
  ctx.fillRect(x - W * 0.3, -H, W * 0.6, H * 3);
  ctx.restore();
}

/* ---------- أيقونات مرسومة بالكود ---------- */
function drawIcon(f: Frame, icon: PromoFeature["icon"], x: number, y: number, size: number, color: string, glow: string, pulse: number) {
  const { ctx } = f;
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = glow;
  ctx.shadowBlur = size * (0.5 + pulse * 0.6);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = size * 0.12;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (icon === "uhd") {
    roundRect(ctx, -size / 2, -size * 0.36, size, size * 0.72, size * 0.12);
    ctx.stroke();
    ctx.font = `800 ${Math.round(size * 0.36)}px ${f.pal.fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.direction = "ltr";
    ctx.fillText("4K", 0, 0);
  } else if (icon === "channels") {
    const cell = size / 3.6;
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) {
        const on = (r * 3 + c + Math.floor(pulse * 9)) % 9 < 6;
        ctx.globalAlpha = on ? 1 : 0.35;
        roundRect(ctx, -size / 2 + c * (cell * 1.2), -size / 2 + r * (cell * 1.2), cell, cell, cell * 0.25);
        ctx.fill();
      }
  } else {
    ctx.beginPath();
    ctx.moveTo(size * 0.12, -size / 2);
    ctx.lineTo(-size * 0.3, size * 0.08);
    ctx.lineTo(-size * 0.02, size * 0.08);
    ctx.lineTo(-size * 0.12, size / 2);
    ctx.lineTo(size * 0.3, -size * 0.1);
    ctx.lineTo(size * 0.02, -size * 0.1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** شريحة ميزة متوهّجة (زجاجية بحدود نيون). */
function drawChip(f: Frame, feat: PromoFeature, x: number, y: number, w: number, h: number, color: string, p: number, pulse: number) {
  if (p <= 0) return;
  const { ctx, pal } = f;
  const e = outBack(clamp01(p));
  ctx.save();
  ctx.globalAlpha = Math.min(1, p * 2);
  ctx.translate(x, y + (1 - e) * h * 0.6);
  ctx.scale(lerp(0.85, 1, e), lerp(0.85, 1, e));
  // خلفية زجاجية.
  roundRect(ctx, -w / 2, -h / 2, w, h, h * 0.3);
  ctx.fillStyle = withAlpha(pal.surface, 0.09);
  ctx.fill();
  // حدّ نيون.
  ctx.shadowColor = withAlpha(color, 0.9);
  ctx.shadowBlur = h * (0.35 + pulse * 0.5);
  ctx.strokeStyle = withAlpha(color, 0.85);
  ctx.lineWidth = Math.max(1.5, h * 0.035);
  ctx.stroke();
  ctx.shadowBlur = 0;
  // الأيقونة على اليمين (RTL) ثم النصان.
  const iconSize = h * 0.5;
  drawIcon(f, feat.icon, w / 2 - h * 0.55, 0, iconSize, color, withAlpha(color, 0.8), pulse);
  ctx.font = font(f, 800, h * 0.36);
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.direction = "rtl";
  ctx.fillStyle = pal.onBrand;
  ctx.fillText(feat.headline, w / 2 - h * 1.1, -h * 0.17);
  ctx.font = font(f, 500, h * 0.22);
  ctx.fillStyle = withAlpha(pal.onBrand, 0.8);
  ctx.fillText(feat.caption, w / 2 - h * 1.1, h * 0.2);
  ctx.restore();
}

/** مستطيل دعوة الإجراء بإحداثيات نسبية (0..1) — يُستخدم لمطابقة رابط DOM فوق الكانفاس. */
export function ctaRect(aspect: "landscape" | "portrait") {
  return aspect === "portrait" ? { x: 0.14, y: 0.72, w: 0.72, h: 0.075 } : { x: 0.31, y: 0.71, w: 0.38, h: 0.12 };
}

function drawCta(f: Frame, p: number, aspect: "landscape" | "portrait") {
  if (p <= 0) return;
  const { ctx, W, H, t, pal, script } = f;
  const r = ctaRect(aspect);
  const x = W * (r.x + r.w / 2);
  const y = H * (r.y + r.h / 2);
  const w = W * r.w;
  const h = H * r.h;
  const e = outBack(clamp01(p));
  const pulse = 0.5 + 0.5 * Math.sin(t / 260);
  ctx.save();
  ctx.globalAlpha = Math.min(1, p * 2.5);
  ctx.translate(x, y);
  ctx.scale(lerp(0.7, 1, e) * (1 + pulse * 0.015), lerp(0.7, 1, e) * (1 + pulse * 0.015));
  // هالة خارجية نابضة.
  ctx.shadowColor = withAlpha(pal.primary, 0.9);
  ctx.shadowBlur = h * (0.6 + pulse * 0.6);
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, pal.primary);
  g.addColorStop(1, pal.secondary);
  roundRect(ctx, -w / 2, -h / 2, w, h, h);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowBlur = 0;
  // لمعة تمرّ على الزر.
  ctx.save();
  roundRect(ctx, -w / 2, -h / 2, w, h, h);
  ctx.clip();
  const sx = lerp(-w, w, ((t / 1400) % 1));
  const sg = ctx.createLinearGradient(sx - w * 0.2, 0, sx + w * 0.2, 0);
  sg.addColorStop(0, "rgba(255,255,255,0)");
  sg.addColorStop(0.5, "rgba(255,255,255,0.35)");
  sg.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sg;
  ctx.transform(1, 0, -0.4, 1, 0, 0);
  ctx.fillRect(sx - w * 0.3, -h, w * 0.6, h * 2);
  ctx.restore();
  ctx.font = font(f, 700, h * 0.42);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.direction = "rtl";
  ctx.fillStyle = pal.onBrand;
  ctx.fillText(script.ctaLabel, 0, 0);
  ctx.restore();
}

/* ---------- المشاهد ---------- */
function sceneIntro(f: Frame, t: number) {
  const { W, H, u, pal, script } = f;
  const [a, b] = SCENES.intro;
  const p = seg(t, a, b);
  drawParticles(f, lerp(0.9, 0.1, outExpo(p)));
  drawSweep(f, seg(t, a + 300, a + 1500), pal.accent);
  // الشارة العلوية (اسم المتجر).
  glowText(f, script.brand, W / 2, H * 0.3, u * 4.2, withAlpha(pal.onBrand, 0.85), withAlpha(pal.accent, 0.8), { weight: 600, alpha: seg(t, a + 200, a + 900), blur: u * 2 });
  focusInText(f, script.title, W / 2, H * 0.45, u * 9.5, pal.onBrand, withAlpha(pal.primary, 1), seg(t, a + 600, a + 2000), 800);
  glowText(f, script.tagline, W / 2, H * 0.58, u * 3.6, withAlpha(pal.onBrand, 0.9), withAlpha(pal.secondary, 0.9), { weight: 500, alpha: seg(t, a + 1600, a + 2400), blur: u * 1.5 });
  // خط تحت العنوان يمتدّ من اليمين.
  const lw = W * 0.4 * outExpo(seg(t, a + 1500, a + 2500));
  const { ctx } = f;
  ctx.save();
  const lg = ctx.createLinearGradient(W / 2 + W * 0.2, 0, W / 2 - W * 0.2, 0);
  lg.addColorStop(0, withAlpha(pal.accent, 0));
  lg.addColorStop(0.3, pal.accent);
  lg.addColorStop(0.7, pal.primary);
  lg.addColorStop(1, withAlpha(pal.primary, 0));
  ctx.fillStyle = lg;
  ctx.shadowColor = withAlpha(pal.primary, 0.9);
  ctx.shadowBlur = u * 1.5;
  ctx.fillRect(W / 2 + W * 0.2 - lw, H * 0.525, lw, Math.max(2, u * 0.35));
  ctx.restore();
}

function sceneUhd(f: Frame, t: number) {
  const { ctx, W, H, u, pal, script } = f;
  const [a, b] = SCENES.uhd;
  const p = seg(t, a, b);
  drawParticles(f, 0.15);
  const feat = script.features[0];
  const e = outExpo(seg(t, a, a + 900));
  // "4K" ضخم بانحراف لوني (chromatic aberration) يتلاشى عند التركيز.
  const size = u * (26 - 6 * (H > W ? 1 : 0));
  const y = H * 0.42;
  const shift = (1 - e) * u * 2.5;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.font = font(f, 900, size);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.direction = "ltr";
  ctx.globalAlpha = Math.min(1, seg(t, a, a + 300) * 1);
  ctx.fillStyle = withAlpha(pal.primary, 0.9);
  ctx.fillText(feat.headline, W / 2 - shift, y);
  ctx.fillStyle = withAlpha(pal.accent, 0.9);
  ctx.fillText(feat.headline, W / 2 + shift, y);
  ctx.restore();
  glowText(f, feat.headline, W / 2, y, size, pal.onBrand, withAlpha(pal.primary, 1), { weight: 900, blur: u * (2 + Math.sin(t / 200) * 0.8), alpha: e, scale: lerp(1.3, 1, e) });
  // شريط "ULTRA HD" وفوقه الوصف.
  const bw = u * 30;
  const bh = u * 5.2;
  const be = outBack(seg(t, a + 700, a + 1400));
  ctx.save();
  ctx.globalAlpha = clamp01(be);
  ctx.translate(W / 2, H * 0.6);
  ctx.scale(lerp(0.6, 1, be), 1);
  roundRect(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2);
  ctx.fillStyle = withAlpha(pal.accent, 0.95);
  ctx.shadowColor = withAlpha(pal.accent, 0.9);
  ctx.shadowBlur = u * 2;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.font = font(f, 800, bh * 0.5);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.direction = "ltr";
  ctx.fillStyle = pal.badgeText;
  ctx.fillText("ULTRA HD · HDR", 0, 0);
  ctx.restore();
  glowText(f, feat.caption, W / 2, H * 0.72, u * 4.2, withAlpha(pal.onBrand, 0.95), withAlpha(pal.secondary, 0.9), { weight: 600, alpha: seg(t, a + 1200, a + 1900), blur: u * 1.5 });
  // خطوط مسح أفقية تعطي إحساس الشاشة.
  ctx.save();
  ctx.globalAlpha = 0.06 * (1 - p * 0.5);
  ctx.fillStyle = pal.onBrand;
  for (let yy = 0; yy < H; yy += 4) ctx.fillRect(0, yy, W, 1);
  ctx.restore();
}

function sceneChannels(f: Frame, t: number) {
  const { ctx, W, H, u, pal, script } = f;
  const [a] = SCENES.channels;
  drawParticles(f, 0.35);
  const feat = script.features[1];
  // بلاطات قنوات تطير من العمق إلى الشاشة.
  const portrait = H > W;
  const cols = portrait ? 4 : 7;
  const rows = portrait ? 5 : 3;
  const tileW = W / (cols + 1);
  const tileH = tileW * 0.62;
  const gridW = cols * tileW * 1.08;
  const hues = [pal.primary, pal.secondary, pal.accent];
  const ox = (W - gridW) / 2 + tileW * 0.04;
  const oy = H * (portrait ? 0.06 : 0.08);
  ctx.save();
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const delay = a + 100 + ((i * 7919) % (rows * cols)) * (1100 / (rows * cols));
      const pp = outExpo(seg(t, delay, delay + 700));
      if (pp <= 0) continue;
      const cx = ox + c * tileW * 1.08 + tileW / 2;
      const cy = oy + r * tileH * 1.15 + tileH / 2;
      const scale = lerp(3.5, 1, pp);
      const alpha = pp * (0.55 + 0.45 * Math.sin((t + i * 220) / 420) ** 2);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      roundRect(ctx, -tileW / 2, -tileH / 2, tileW, tileH, tileH * 0.18);
      const tg = ctx.createLinearGradient(-tileW / 2, -tileH / 2, tileW / 2, tileH / 2);
      tg.addColorStop(0, withAlpha(hues[i % 3], 0.55));
      tg.addColorStop(1, withAlpha(hues[(i + 1) % 3], 0.2));
      ctx.fillStyle = tg;
      ctx.fill();
      ctx.strokeStyle = withAlpha(pal.onBrand, 0.25);
      ctx.lineWidth = 1;
      ctx.stroke();
      // "شعار" قناة مجرّد: شريط + نقطة.
      ctx.fillStyle = withAlpha(pal.onBrand, 0.85);
      ctx.beginPath();
      ctx.arc(tileW * 0.3, -tileH * 0.15, tileH * 0.12, 0, Math.PI * 2);
      ctx.fill();
      roundRect(ctx, -tileW * 0.35, tileH * 0.12, tileW * 0.5, tileH * 0.1, tileH * 0.05);
      ctx.fill();
      ctx.restore();
    }
  ctx.restore();
  // تعتيم أسفل الشبكة ليبرز العدّاد.
  const fg = ctx.createLinearGradient(0, H * 0.45, 0, H * 0.75);
  fg.addColorStop(0, `rgba(${FILM_BASE_RGB},0)`);
  fg.addColorStop(1, `rgba(${FILM_BASE_RGB},0.92)`);
  ctx.fillStyle = fg;
  ctx.fillRect(0, H * 0.45, W, H * 0.55);
  // العدّاد.
  const cp = outExpo(seg(t, a + 500, a + 2200));
  const n = Math.round(script.channelsCount * cp);
  const label = `+${n.toLocaleString("en-US")}`;
  glowText(f, label, W / 2, H * 0.68, u * 14, pal.onBrand, withAlpha(pal.accent, 1), { weight: 900, blur: u * 2.5, alpha: seg(t, a + 400, a + 800) });
  glowText(f, feat.headline, W / 2, H * 0.8, u * 5.5, pal.onBrand, withAlpha(pal.primary, 0.9), { weight: 800, alpha: seg(t, a + 900, a + 1500), blur: u * 1.5 });
  glowText(f, feat.caption, W / 2, H * 0.88, u * 3.4, withAlpha(pal.onBrand, 0.85), withAlpha(pal.secondary, 0.8), { weight: 500, alpha: seg(t, a + 1400, a + 2000), blur: u });

}

function sceneBolt(f: Frame, t: number) {
  const { ctx, W, H, u, pal, script } = f;
  const [a] = SCENES.bolt;
  drawParticles(f, 1);
  drawSweep(f, seg(t, a + 100, a + 900), pal.primary);
  const feat = script.features[2];
  // وميض عند دخول الصاعقة.
  const flash = 1 - outExpo(seg(t, a, a + 500));
  if (flash > 0) {
    ctx.save();
    ctx.globalAlpha = flash * 0.7;
    ctx.fillStyle = pal.onBrand;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  const e = outBack(seg(t, a + 100, a + 800));
  const pulse = 0.5 + 0.5 * Math.sin(t / 120);
  ctx.save();
  ctx.globalAlpha = clamp01(e);
  ctx.translate(W / 2, H * 0.36);
  ctx.scale(lerp(0.2, 1, e), lerp(0.2, 1, e));
  // حلقات صدمة تتوسّع.
  for (let i = 0; i < 3; i++) {
    const rp = ((t - a) / 900 + i / 3) % 1;
    ctx.beginPath();
    ctx.arc(0, 0, u * (6 + rp * 22), 0, Math.PI * 2);
    ctx.strokeStyle = withAlpha(pal.accent, (1 - rp) * 0.6);
    ctx.lineWidth = Math.max(1, u * 0.4 * (1 - rp));
    ctx.stroke();
  }
  drawIcon(f, "bolt", 0, 0, u * 16, pal.accent, withAlpha(pal.accent, 1), pulse);
  ctx.restore();
  focusInText(f, feat.headline, W / 2, H * 0.6, u * 7.5, pal.onBrand, withAlpha(pal.accent, 1), seg(t, a + 500, a + 1400), 800);
  glowText(f, feat.caption, W / 2, H * 0.71, u * 3.6, withAlpha(pal.onBrand, 0.9), withAlpha(pal.primary, 0.9), { weight: 500, alpha: seg(t, a + 1200, a + 1800), blur: u });
  // شريط تقدّم "تفعيل" يمتلئ بسرعة.
  const bw = W * 0.5;
  const bh = Math.max(6, u * 1.2);
  const bp = outExpo(seg(t, a + 1300, a + 2400));
  ctx.save();
  ctx.globalAlpha = seg(t, a + 1200, a + 1500);
  roundRect(ctx, W / 2 - bw / 2, H * 0.8 - bh / 2, bw, bh, bh);
  ctx.fillStyle = withAlpha(pal.onBrand, 0.15);
  ctx.fill();
  const fw = bw * bp;
  roundRect(ctx, W / 2 + bw / 2 - fw, H * 0.8 - bh / 2, fw, bh, bh);
  const pg = ctx.createLinearGradient(W / 2 + bw / 2, 0, W / 2 - bw / 2, 0);
  pg.addColorStop(0, pal.accent);
  pg.addColorStop(1, pal.primary);
  ctx.fillStyle = pg;
  ctx.shadowColor = withAlpha(pal.accent, 0.9);
  ctx.shadowBlur = u * 1.5;
  ctx.fill();
  ctx.restore();
  glowText(f, bp >= 1 ? "تم التفعيل ✓" : `${Math.round(bp * 100)}%`, W / 2, H * 0.87, u * 3.2, pal.onBrand, withAlpha(pal.accent, 0.9), { weight: 700, alpha: seg(t, a + 1300, a + 1600), blur: u });

}

function sceneCta(f: Frame, t: number, aspect: "landscape" | "portrait") {
  const { W, H, u, pal, script } = f;
  const [a] = SCENES.cta;
  drawParticles(f, 0.12);
  drawSweep(f, seg(t, a + 1800, a + 3000), pal.secondary);
  focusInText(f, script.title, W / 2, H * (aspect === "portrait" ? 0.18 : 0.2), u * 7.5, pal.onBrand, withAlpha(pal.primary, 1), seg(t, a, a + 900), 800);
  const hues = [pal.primary, pal.accent, pal.secondary];
  const chipH = u * (aspect === "portrait" ? 13.5 : 12);
  const chipW = aspect === "portrait" ? W * 0.84 : W * 0.29;
  script.features.forEach((feat, i) => {
    const pulse = 0.5 + 0.5 * Math.sin(t / 300 + i * 2);
    const x = aspect === "portrait" ? W / 2 : W * (0.82 - i * 0.32);
    const y = aspect === "portrait" ? H * (0.32 + i * 0.125) : H * 0.47;
    drawChip(f, feat, x, y, chipW, chipH, hues[i], seg(t, a + 500 + i * 220, a + 1100 + i * 220), pulse);
  });
  drawCta(f, seg(t, a + 1300, a + 1900), aspect);
  glowText(f, script.tagline, W / 2, H * (aspect === "portrait" ? 0.86 : 0.9), u * 3, withAlpha(pal.onBrand, 0.75), withAlpha(pal.secondary, 0.6), { weight: 500, alpha: seg(t, a + 1800, a + 2300), blur: u * 0.8 });
}

/** انتقال بين المشاهد: تعتيم قصير + ومضة. */
function drawTransitions(f: Frame, t: number) {
  const { ctx, W, H, pal } = f;
  const edges = [SCENES.uhd[0], SCENES.channels[0], SCENES.bolt[0], SCENES.cta[0]];
  for (const e of edges) {
    const d = Math.abs(t - e);
    if (d < 220) {
      ctx.save();
      ctx.globalAlpha = (1 - d / 220) * 0.9;
      ctx.fillStyle = FILM_BASE;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }
  // ومضة عند بداية الحلقة.
  if (t < 400) {
    ctx.save();
    ctx.globalAlpha = (1 - t / 400) * 0.5;
    ctx.fillStyle = pal.primary;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

/** إطار حواف سينمائي + تحبيب خفيف. */
function drawVignette(f: Frame) {
  const { ctx, W, H } = f;
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

export interface Backdrop {
  source: CanvasImageSource;
  width: number;
  height: number;
}

export interface RenderOptions {
  aspect: "landscape" | "portrait";
  /** إطار فيديو/صورة خلفية اختياري يُرسم تحت المؤثرات. */
  backdrop?: Backdrop;
}

/** يرسم إطاراً كاملاً عند الزمن t (مللي ثانية داخل الحلقة). */
export function renderFrame(ctx: CanvasRenderingContext2D, W: number, H: number, timeMs: number, pal: PromoPalette, script: PromoScript, opts: RenderOptions) {
  const t = ((timeMs % PROMO_DURATION_MS) + PROMO_DURATION_MS) % PROMO_DURATION_MS;
  const f: Frame = { ctx, W, H, u: Math.min(W, H) / 100, t, pal, script };
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  drawBackdrop(f, opts.backdrop);
  const scene = sceneAt(t);
  if (scene === "intro") sceneIntro(f, t);
  else if (scene === "uhd") sceneUhd(f, t);
  else if (scene === "channels") sceneChannels(f, t);
  else if (scene === "bolt") sceneBolt(f, t);
  else sceneCta(f, t, opts.aspect);
  drawVignette(f);
  drawTransitions(f, t);
  ctx.restore();
}
