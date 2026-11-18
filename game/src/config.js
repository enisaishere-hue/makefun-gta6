// Tuning and world constants for Neon Harbor, an original open-world crime game.
// Everything here is invented: the city Port Meridian, its people and its story are
// this game's own, with nothing taken from any commercial game.
export const STEP = 1 / 60;
export const WORLD = { width: 2560, height: 1920 };
export const SAVE_KEY = 'neon-harbor-save-v1';
export const BEST_KEY = 'neon-harbor-best-v1';

// Avenues (vertical roads) and streets (horizontal roads), each 96 px wide.
export const AVENUES = [320, 800, 1280, 1760, 2240];
export const STREETS = [300, 700, 1100, 1500];
export const ROAD_W = 96;
export const WATER_TOP = 1700; // the harbor: water south of this line

export const PLAYER = {
  radius: 13,
  walkSpeed: 210,
  sprintSpeed: 320,
  health: 100,
  punchDamage: 25,
  pistolDamage: 34,
  pistolAmmo: 12,
  pistolRange: 420,
};

export const CAR = {
  length: 54,
  width: 26,
  maxSpeed: 560,
  accel: 420,
  brake: 700,
  reverseMax: 180,
  turnRate: 2.6,
  health: 100,
};

export const WANTED = {
  decayDelay: 18, // seconds without a crime before stars start falling
  decayPeriod: 9, // seconds per star lost while unseen
  maxStars: 5,
  copCarPerStar: 1,
  footCopPerStar: 1,
};

// Sun-soaked coastal palette: warm sand, terracotta, teal and palm green.
export const PALETTE = {
  grass: '#7fae62',
  sand: '#d9c08a',
  asphalt: '#3a3f4a',
  asphaltDark: '#33373f',
  sidewalk: '#9a938a',
  lane: '#e8d44d',
  water: '#2e7f9e',
  waterDeep: '#256b87',
  building: ['#c96f4a', '#d9a05b', '#7fa8a0', '#b5533c', '#8a6f9e', '#5b7fa6', '#a8895f', '#4f8a6d'],
  roof: ['#8a4a34', '#6b5a44', '#4a6b66', '#7a3a30', '#5a4a72', '#3f5a78', '#7a6248', '#3a6b52'],
  car: ['#d94f3d', '#3d7fd9', '#e8c33d', '#e8e8e8', '#2b2b33', '#7fc94f', '#d97fb0', '#f08a2e'],
  copCar: '#2b4fd9',
  pedShirt: ['#e86a6a', '#6aa8e8', '#e8d06a', '#8ae86a', '#c96ae8', '#e8a06a', '#6ae8d8'],
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// Keyboard + mouse controls shown on the title screen and the HUD.
export const CONTROLS = [
  ['W A S D', 'Move / drive'],
  ['Mouse', 'Aim, click to shoot'],
  ['E', 'Enter / exit car'],
  ['F', 'Punch'],
  ['R', 'Reload pistol'],
  ['Shift', 'Sprint'],
  ['Space', 'Handbrake'],
  ['P / Esc', 'Pause'],
  ['M', 'Mute'],
];
