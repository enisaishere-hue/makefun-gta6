// Keyboard and pointer input. Held keys give a steering vector; one-shot presses
// (confirm, pause, enter car, punch, reload, mute) are queued as bit flags and taken
// once by the loop, so a press between two frames is never lost or counted twice.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_RELOAD = 16;
export const ACTION_MUTE = 32;

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  Space: 'brake',
};

export function createInput(canvas) {
  const keys = { up: false, down: false, left: false, right: false, sprint: false, brake: false };
  let actions = 0;
  let aimConverter = null;
  let mouse = { x: 0, y: 0, down: false, clicked: false };

  window.addEventListener('keydown', (event) => {
    const name = KEYMAP[event.code];
    if (name) {
      keys[name] = true;
      event.preventDefault();
      return;
    }
    if (event.repeat) return;
    if (event.code === 'Enter') actions |= ACTION_CONFIRM;
    else if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    else if (event.code === 'KeyE') actions |= ACTION_ENTER;
    else if (event.code === 'KeyF') actions |= ACTION_PUNCH;
    else if (event.code === 'KeyR') actions |= ACTION_RELOAD;
    else if (event.code === 'KeyM') actions |= ACTION_MUTE;
  });
  window.addEventListener('keyup', (event) => {
    const name = KEYMAP[event.code];
    if (name) keys[name] = false;
  });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(keys)) keys[k] = false;
    mouse.down = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
    mouse.down = true;
    mouse.clicked = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
  });

  return {
    keys,
    mouse,
    // The renderer registers a screen->world converter so aiming follows the mouse.
    setAimConverter(fn) {
      aimConverter = fn;
    },
    aimAngle(p) {
      if (!aimConverter) return p.angle;
      const w = aimConverter(mouse.x, mouse.y);
      return Math.atan2(w.y - p.y, w.x - p.x);
    },
    // Steering: -1 left, 1 right; throttle: -1 brake/reverse, 1 forward.
    steer() {
      return (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    },
    throttle() {
      return (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
    },
    moveX() {
      return (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    },
    moveY() {
      return (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    },
    takeMouseClick() {
      const c = mouse.clicked;
      mouse.clicked = false;
      return c;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
