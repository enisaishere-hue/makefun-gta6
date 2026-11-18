// Neon Harbor — the city of Port Meridian: road grid, building blocks,
// districts, the harbor in the south and the north parking lot.
// One clear job: build the map once from a seed and answer collision questions.
import { WORLD_W, WORLD_H, ROAD_W, AVENUES, STREETS, PALETTE } from './config.js';
import { mulberry32, pick, range, intRange, chance } from './rng.js';

export function buildCity(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const lots = [];
  const parks = [];

  // Fill every block between roads with buildings, leaving gaps for lots/parks.
  for (let ax = 0; ax <= AVENUES.length; ax++) {
    const x0 = ax === 0 ? 48 : AVENUES[ax - 1] + ROAD_W / 2 + 14;
    const x1 = ax === AVENUES.length ? WORLD_W - 48 : AVENUES[ax] - ROAD_W / 2 - 14;
    for (let sy = 0; sy <= STREETS.length; sy++) {
      const y0 = sy === 0 ? 48 : STREETS[sy - 1] + ROAD_W / 2 + 14;
      const y1 = sy === STREETS.length ? WORLD_H - 48 : STREETS[sy] - ROAD_W / 2 - 14;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      // The south strip below the last street is the harbor, not buildings.
      if (sy === STREETS.length && y0 > 1560) continue;
      const roll = rng();
      if (roll < 0.14) { parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }); continue; }
      if (roll < 0.24) { lots.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }); continue; }
      // Split a block into 1-4 buildings.
      const cols = (x1 - x0) > 300 ? 2 : 1;
      const rows = (y1 - y0) > 260 ? 2 : 1;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const bw = (x1 - x0) / cols, bh = (y1 - y0) / rows;
          const bx = x0 + c * bw + 8, by = y0 + r * bh + 8;
          buildings.push({
            x: bx, y: by, w: bw - 16, h: bh - 16,
            color: pick(rng, PALETTE.buildingRoof),
            tall: chance(rng, 0.3),
            lit: chance(rng, 0.55),
          });
        }
      }
    }
  }

  // Harbor: water along the south edge with two piers and warehouses.
  const harbor = {
    water: { x: 0, y: 1780, w: WORLD_W, h: 140 },
    piers: [
      { x: 420, y: 1700, w: 60, h: 120 },
      { x: 1500, y: 1700, w: 60, h: 120 },
    ],
    warehouses: [
      { x: 700, y: 1600, w: 220, h: 90, color: '#5a4a3a' },
      { x: 1100, y: 1600, w: 220, h: 90, color: '#4a5a6a' },
      { x: 1980, y: 1600, w: 220, h: 90, color: '#6a4a5a' },
    ],
  };
  for (const wh of harbor.warehouses) buildings.push({ ...wh, tall: false, lit: true });

  // North lot: the open parking lot where the Comet S waits (top-left block).
  const northLot = { x: 96, y: 96, w: 200, h: 150 };
  lots.push(northLot);

  // Downtown: the blocks around the central crossing glow at night.
  const downtown = { x: 1050, y: 500, w: 460, h: 440 };

  // Hospital (respawn) and garage (Delia's drop) fixed landmarks.
  const hospital = { x: 2080, y: 1280, w: 130, h: 110, color: '#e8e8e8' };
  buildings.push({ ...hospital, tall: false, lit: true });
  const garage = { x: 620, y: 1240, w: 150, h: 100, color: '#3a5a4a' };
  buildings.push({ ...garage, tall: false, lit: true });

  return { buildings, lots, parks, harbor, northLot, downtown, hospital, garage, seed };
}

// Is a point on a road (within the road band, including intersections)?
export function onRoad(x, y) {
  for (const ax of AVENUES) if (Math.abs(x - ax) <= ROAD_W / 2) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) <= ROAD_W / 2) return true;
  return false;
}

// Nearest road centerline point to (x, y) — used to keep traffic on roads.
export function nearestRoadPoint(x, y) {
  let best = null, bestD = Infinity;
  for (const ax of AVENUES) {
    const d = Math.abs(x - ax);
    if (d < bestD) { bestD = d; best = { x: ax, y }; }
  }
  for (const sy of STREETS) {
    const d = Math.abs(y - sy);
    if (d < bestD) { bestD = d; best = { x, y: sy }; }
  }
  return best;
}

function circleHitsRect(cx, cy, r, rect) {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

// Push a circle (x, y, radius) out of every solid rect; returns corrected {x, y}.
export function collideCircle(city, x, y, r) {
  for (const b of city.buildings) {
    if (circleHitsRect(x, y, r, b)) {
      const nx = Math.max(b.x, Math.min(x, b.x + b.w));
      const ny = Math.max(b.y, Math.min(y, b.y + b.h));
      let dx = x - nx, dy = y - ny;
      const d = Math.hypot(dx, dy) || 0.001;
      if (d < 0.01) { // center inside the rect: push out along the smallest axis
        const left = x - b.x, right = b.x + b.w - x;
        const top = y - b.y, bottom = b.y + b.h - y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = b.x - r;
        else if (m === right) x = b.x + b.w + r;
        else if (m === top) y = b.y - r;
        else y = b.y + b.h + r;
      } else {
        x = nx + (dx / d) * r;
        y = ny + (dy / d) * r;
      }
    }
  }
  x = Math.max(r, Math.min(WORLD_W - r, x));
  y = Math.max(r, Math.min(WORLD_H - r, y));
  return { x, y };
}

// True if a circle overlaps any building (bullets and line-of-sight use this).
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (circleHitsRect(x, y, r, b)) return true;
  }
  return false;
}

// A random point on a road at least `minDist` from (px, py) — police spawns.
export function roadPointFar(rng, px, py, minDist) {
  for (let tries = 0; tries < 40; tries++) {
    let x, y;
    if (rng() < 0.5) { x = pick(rng, AVENUES) + range(rng, -20, 20); y = range(rng, 80, WORLD_H - 80); }
    else { y = pick(rng, STREETS) + range(rng, -20, 20); x = range(rng, 80, WORLD_W - 80); }
    if (Math.hypot(x - px, y - py) >= minDist) return { x, y };
  }
  return { x: 1280, y: 320 };
}

export function districtAt(city, x, y) {
  if (y >= 1560) return 'Harbor';
  if (x >= city.downtown.x && x <= city.downtown.x + city.downtown.w &&
      y >= city.downtown.y && y <= city.downtown.y + city.downtown.h) return 'Downtown';
  if (y < 480) return 'Northside';
  if (x < 700) return 'Old Town';
  if (x > 1900) return 'East End';
  return 'Midtown';
}
