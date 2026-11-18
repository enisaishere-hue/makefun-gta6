// Neon Harbor — tuning constants and shared palette.
// One clear job: every number the rest of the game agrees on lives here.
export const WORLD_W = 2560;
export const WORLD_H = 1920;
export const ROAD_W = 96;
export const AVENUES = [320, 800, 1280, 1760, 2240];
export const STREETS = [320, 720, 1120, 1520];
export const START_CASH = 40;
export const DEBT_TOTAL = 12000;
export const MAX_WANTED = 5;
export const BUSTED_FINE = 150;
export const WASTED_FINE = 100;

export const PLAYER = {
  radius: 13,
  walkSpeed: 170,
  sprintSpeed: 265,
  maxHealth: 100,
  pistolDamage: 34,
  pistolAmmo: 12,
  pistolReserve: 48,
  punchDamage: 12,
  fireCooldown: 0.22,
  reloadTime: 1.1,
};

export const CAR = {
  accel: 420,
  reverseAccel: 260,
  maxSpeed: 520,
  maxReverse: 160,
  steerRate: 2.6,
  grip: 3.2,
  drag: 0.55,
  offroadDrag: 1.6,
  maxHealth: 100,
  radius: 15,
};

export const PALETTE = {
  grass: '#2e6b34',
  grassDark: '#27592d',
  road: '#33373d',
  roadLine: '#e8c93a',
  sidewalk: '#8a8f96',
  water: '#1d5f8a',
  waterDeep: '#14486b',
  sand: '#c9b078',
  buildingRoof: ['#7a4a3a', '#4a5a7a', '#6a6a72', '#8a6a3a', '#5a7a5a', '#7a3a5a', '#3a6a6a'],
  buildingEdge: '#22242a',
  downtownGlow: '#ff9a3c',
  carColors: ['#c0392b', '#2980b9', '#f1c40f', '#7f8c8d', '#8e44ad', '#16a085', '#e67e22', '#ecf0f1', '#ff6b9d', '#2ecc71', '#34495e', '#d35400', '#1abc9c', '#f5d76e'],
  playerJacket: '#e74c3c',
  copBlue: '#2c4a8a',
  copCar: '#e8e8e8',
};

export const MISSION_PAY = [300, 450, 700, 1200, 1500, 1200, 6650];
export const MISSION_NAMES = [
  'First Delivery',
  'Borrowed Wheels',
  'Heat Run',
  'Harbor Kings',
  "Kings' Payback",
  'Night Shift',
  'The Last Score',
];

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
