// Neon Harbor — smuggler's caches: eight glowing crates hidden around Port
// Meridian, on sidewalks and street corners. Each one pays $150 on the spot;
// finding all eight pays a $500 bonus. The HUD tracks how many are left.
import { mulberry32 } from './rng.js';
import { addFloater, spawnParticles } from './combat.js';

const CACHE_SPOTS = [
  { x: 368, y: 280 }, { x: 848, y: 600 }, { x: 1328, y: 280 }, { x: 1808, y: 1080 },
  { x: 368, y: 1000 }, { x: 2280, y: 600 }, { x: 1328, y: 1480 }, { x: 1808, y: 1560 },
];

export function makeCollectibles(seed) {
  const rng = mulberry32(seed ^ 0xcac4e);
  return {
    list: CACHE_SPOTS.map((s) => ({
      x: s.x + (rng() * 36 - 18),
      y: s.y + (rng() * 36 - 18),
      found: false,
      bob: rng() * 6,
    })),
    found: 0,
    total: CACHE_SPOTS.length,
    bonusPaid: false,
  };
}

export function updateCollectibles(c, S, dt) {
  const p = S.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  for (const k of c.list) {
    if (k.found) continue;
    k.bob += dt * 2.5;
    if (Math.hypot(k.x - px, k.y - py) < 34) {
      k.found = true;
      c.found += 1;
      p.cash += 150;
      S.earned += 150;
      addFloater(S.combat, k.x, k.y - 18, 'CACHE +$150', '#2ecc71');
      spawnParticles(S.combat, k.x, k.y, '#2ecc71', 10, 140);
      S.sfx.cash();
      if (c.found >= c.total && !c.bonusPaid) {
        c.bonusPaid = true;
        p.cash += 500;
        S.earned += 500;
        addFloater(S.combat, px, py - 34, 'ALL CACHES — BONUS +$500', '#ffd76a');
        S.sfx.missionDone();
      }
    }
  }
}

export function drawCollectibles(ctx, c, cam, time) {
  for (const k of c.list) {
    if (k.found) continue;
    const x = k.x - cam.x, y = k.y - cam.y + Math.sin(k.bob) * 3;
    if (x < -24 || y < -24 || x > 1304 || y > 744) continue;
    const pulse = 0.7 + Math.sin(time * 4 + k.bob) * 0.3;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = 0.35 * pulse;
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#27ae60';
    ctx.fillRect(-9, -9, 18, 18);
    ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 2;
    ctx.strokeRect(-9, -9, 18, 18);
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('?', x, y + 4);
    ctx.textAlign = 'left';
  }
}
