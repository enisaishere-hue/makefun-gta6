// Neon Harbor — the day/night cycle: the clock starts at dusk, night falls
// as it runs, and the city goes dark while its windows, signs and the
// player's headlights glow. Daylight is untouched; only the dark is drawn.
export function nightFactor(clockMin) {
  const h = (((clockMin / 60) % 24) + 24) % 24;
  if (h >= 6 && h < 18) return 0;      // full daylight
  if (h >= 18 && h < 21) return (h - 18) / 3; // dusk settles in
  if (h >= 21 || h < 5) return 1;      // deep night
  return 1 - (h - 5);                  // dawn breaks 05:00-06:00
}

export function drawNight(ctx, S) {
  const f = nightFactor(S.clockMin);
  if (f <= 0.01) return;
  const cam = S.cam;
  // A cold wash over the whole view.
  ctx.fillStyle = 'rgba(6, 10, 34, ' + (0.55 * f).toFixed(3) + ')';
  ctx.fillRect(0, 0, 1280, 720);
  // Warm light pools where the city stays awake: downtown, the garage,
  // the hospital, and the harbor warehouses.
  ctx.globalCompositeOperation = 'lighter';
  const glow = (wx, wy, radius, color, alpha) => {
    const x = wx - cam.x, y = wy - cam.y;
    if (x < -radius || y < -radius || x > 1280 + radius || y > 720 + radius) return;
    const g = ctx.createRadialGradient(x, y, 8, x, y, radius);
    g.addColorStop(0, color.replace('A', (alpha * f).toFixed(3)));
    g.addColorStop(1, color.replace('A', '0'));
    ctx.fillStyle = g;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  };
  glow(1280, 720, 420, 'rgba(255, 154, 60, A)', 0.30);
  glow(700, 1290, 220, 'rgba(255, 214, 106, A)', 0.22);
  glow(2145, 1335, 220, 'rgba(180, 220, 255, A)', 0.20);
  glow(1100, 1650, 260, 'rgba(255, 154, 60, A)', 0.20);
  glow(800, 720, 180, 'rgba(255, 214, 106, A)', 0.16);
  // Headlights: a cone of warm light ahead of the player's car.
  const p = S.player;
  if (p.inCar) {
    const car = p.inCar;
    const x = car.x - cam.x, y = car.y - cam.y;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(car.angle);
    const beam = ctx.createLinearGradient(24, 0, 340, 0);
    beam.addColorStop(0, 'rgba(255, 240, 180, ' + (0.30 * f).toFixed(3) + ')');
    beam.addColorStop(1, 'rgba(255, 240, 180, 0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(24, -8);
    ctx.lineTo(340, -70);
    ctx.lineTo(340, 70);
    ctx.lineTo(24, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';
}
