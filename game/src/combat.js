// Combat: the pistol, the punch, and the bullets between them. Shooting is a
// crime, so every shot is also a decision about the wanted level.
import { PLAYER } from './config.js';
import { dist } from './random.js';

export function makeBullets() {
  return [];
}

export function fireBullet(bullets, x, y, angle, fromPlayer) {
  bullets.push({
    x, y,
    vx: Math.cos(angle) * 900,
    vy: Math.sin(angle) * 900,
    life: 0.6,
    fromPlayer,
    damage: PLAYER.pistolDamage,
  });
}

export function stepBullets(bullets, dt, city, targets, onHit) {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead) {
      // A wall stops a bullet.
      const { buildingAt } = city;
      if (buildingAt && buildingAt(b.x, b.y)) dead = true;
    }
    if (!dead) {
      for (const t of targets) {
        if (t.dead || t.health === undefined) continue;
        if (dist(b.x, b.y, t.x, t.y) < (t.radius || 16)) {
          t.health -= b.damage;
          onHit(t, b);
          dead = true;
          break;
        }
      }
    }
    if (dead) bullets.splice(i, 1);
  }
}

// A punch: short range, a wide arc in front of the player.
export function punchHits(px, py, angle, targets, range, damage, onHit) {
  let hitAny = false;
  for (const t of targets) {
    if (t.dead) continue;
    const d = dist(px, py, t.x, t.y);
    if (d > range + (t.radius || 16)) continue;
    const want = Math.atan2(t.y - py, t.x - px);
    let diff = Math.abs(want - angle) % (Math.PI * 2);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff > 1.1) continue;
    t.health -= damage;
    onHit(t);
    hitAny = true;
  }
  return hitAny;
}
