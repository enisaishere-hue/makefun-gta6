// Port Meridian, the city of Neon Harbor: a seeded road grid, the blocks between
// the roads, their buildings, parks and parking lots, the harbor to the south, and
// the traffic loops cars drive around. Named places are fixed, so missions and the
// minimap always mean the same corners.
import { AVENUES, PALETTE, ROAD_W, STREETS, WATER_TOP, WORLD } from './config.js';

export const PLACES = {
  plaza: { x: 1520, y: 900, label: 'Meridian Plaza' },
  pier: { x: 1280, y: 1660, label: 'Old Pier' },
  garage: { x: 2000, y: 700, label: "Ray's Garage" },
  market: { x: 560, y: 1100, label: 'Sunset Market' },
  safehouse: { x: 2240, y: 300, label: 'Safehouse' },
  diner: { x: 800, y: 1500, label: 'Neon Diner' },
  lighthouse: { x: 2320, y: 1640, label: 'Lighthouse Point' },
  hospital: { x: 1280, y: 300, label: 'Meridian General' },
  northLot: { x: 1760, y: 300, label: 'North Lot' },
  park: { x: 560, y: 500, label: 'Palm Park' },
};

// A traffic loop is the rectangle of road around one block, driven clockwise or not.
function blockLoops() {
  const loops = [];
  const xs = [0, ...AVENUES, WORLD.width];
  const ys = [0, ...STREETS, WATER_TOP];
  for (let bx = 0; bx < xs.length - 1; bx += 1) {
    for (let by = 0; by < ys.length - 1; by += 1) {
      const x0 = xs[bx] + ROAD_W / 2;
      const x1 = xs[bx + 1] - ROAD_W / 2;
      const y0 = ys[by] + ROAD_W / 2;
      const y1 = ys[by + 1] - ROAD_W / 2;
      if (x1 - x0 < 120 || y1 - y0 < 120) continue;
      loops.push([
        { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 },
      ]);
    }
  }
  return loops;
}

function buildBlocks(random) {
  const blocks = [];
  const xs = [0, ...AVENUES, WORLD.width];
  const ys = [0, ...STREETS, WATER_TOP];
  for (let bx = 0; bx < xs.length - 1; bx += 1) {
    for (let by = 0; by < ys.length - 1; by += 1) {
      const x0 = xs[bx] + ROAD_W / 2 + 14;
      const x1 = xs[bx + 1] - ROAD_W / 2 - 14;
      const y0 = ys[by] + ROAD_W / 2 + 14;
      const y1 = ys[by + 1] - ROAD_W / 2 - 14;
      const w = x1 - x0;
      const h = y1 - y0;
      if (w < 100 || h < 100) continue;
      // The park block and the plaza stay open; the rest get buildings.
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const isPark = Math.abs(cx - 560) < 60 && Math.abs(cy - 500) < 60;
      const isPlaza = Math.abs(cx - 1520) < 60 && Math.abs(cy - 900) < 60;
      const block = { x: x0, y: y0, w, h, kind: isPark ? 'park' : isPlaza ? 'plaza' : 'city', buildings: [], trees: [] };
      if (block.kind === 'park') {
        for (let i = 0; i < 14; i += 1) {
          block.trees.push({ x: x0 + random.range(20, w - 20), y: y0 + random.range(20, h - 20), r: random.range(9, 15) });
        }
      } else if (block.kind === 'city') {
        const cols = w > 300 ? 2 : 1;
        const rows = h > 260 ? 2 : 1;
        const cw = w / cols;
        const ch = h / rows;
        for (let cx = 0; cx < cols; cx += 1) {
          for (let cy = 0; cy < rows; cy += 1) {
            if (random.chance(0.18)) continue; // an empty lot breaks the skyline up
            const bw = cw * random.range(0.55, 0.8);
            const bh = ch * random.range(0.55, 0.8);
            const color = random.pick(PALETTE.building);
            const roof = random.pick(PALETTE.roof);
            block.buildings.push({
              x: x0 + cx * cw + (cw - bw) / 2,
              y: y0 + cy * ch + (ch - bh) / 2,
              w: bw,
              h: bh,
              color,
              roof,
              floors: random.int(2, 6),
            });
          }
        }
      }
      blocks.push(block);
    }
  }
  return blocks;
}

export function createCity(random) {
  const city = {
    blocks: buildBlocks(random),
    loops: blockLoops(),
    trees: [],
    lamps: [],
  };
  // Palm trees along the harbor promenade and lamps along every avenue.
  for (let x = 120; x < WORLD.width; x += 140) {
    city.trees.push({ x, y: WATER_TOP - 70, r: 12 });
  }
  for (const ax of AVENUES) {
    for (let y = 120; y < WATER_TOP; y += 260) {
      city.lamps.push({ x: ax - ROAD_W / 2 - 6, y });
      city.lamps.push({ x: ax + ROAD_W / 2 + 6, y: y + 130 });
    }
  }
  return city;
}

// True when a point is on a road (drivable), on water, or inside a building.
export function onRoad(x, y) {
  if (y >= WATER_TOP) return false;
  for (const ax of AVENUES) if (Math.abs(x - ax) <= ROAD_W / 2) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) <= ROAD_W / 2) return true;
  return false;
}

export function inWater(x, y) {
  return y >= WATER_TOP;
}

export function buildingAt(city, x, y) {
  for (const block of city.blocks) {
    for (const b of block.buildings) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
  }
  return null;
}

// Push a circle out of every building it overlaps; returns true when it moved.
export function collideBuildings(city, body, radius) {
  let hit = false;
  for (const block of city.blocks) {
    for (const b of block.buildings) {
      const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
      const dx = body.x - cx;
      const dy = body.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < radius * radius) {
        const d = Math.sqrt(d2) || 0.001;
        const push = radius - d;
        body.x += (dx / d) * push;
        body.y += (dy / d) * push;
        hit = true;
      }
    }
  }
  return hit;
}

// A point on the nearest road, for spawning cars and police.
export function nearestRoadPoint(x, y) {
  let best = { x: AVENUES[0], y };
  let bestD = Infinity;
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
