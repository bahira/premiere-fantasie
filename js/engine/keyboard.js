// engine/keyboard.js — Auto-detect AZERTY/QWERTY + key remapping
// Detects keyboard layout on first keypress, remaps WASD/arrow keys accordingly

const LAYOUT_MAPS = {
  qwerty: {
    z: 'w', q: 'a', s: 's', d: 'd', // WASD (physical positions)
    w: 'z', a: 'q', // ZQSD -> WASD mapping
    arrows: { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' },
  },
  azerty: {
    z: 'w', q: 'a', s: 's', d: 'd', // Physical WASD position = ZQSD on AZERTY
    w: 'z', a: 'q', // Logical mapping
    arrows: { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' },
  },
};

// Key labels per layout for UI display
const KEY_LABELS = {
  qwerty: { up: 'W', down: 'S', left: 'A', right: 'D', menu: 'M', confirm: 'Enter', cancel: 'Escape' },
  azerty: { up: 'Z', down: 'S', left: 'Q', right: 'D', menu: 'É', confirm: 'Entrée', cancel: 'Échap' },
};

class KeyboardManager {
  constructor() {
    this.layout = null;        // 'qwerty' or 'azerty'
    this._detected = false;
    this._listeners = new Map();
    this._held = new Set();
    this._justPressed = new Set();
    this._justReleased = new Set();

    // Bind detection listener
    this._detectHandler = (e) => this._detectLayout(e);
    window.addEventListener('keydown', this._detectHandler, { once: false, capture: true });
  }

  // ─── Layout Detection ─────────────────────────────────────────────────

  _detectLayout(e) {
    if (this._detected) return;

    const key = e.key.toLowerCase();
    // Detection heuristic: on AZERTY, pressing physical WASD positions produces Z/Q/S/D
    // We use the 'key' property which gives the character produced
    if (key === 'z' || key === 'w' || key === 'a' || key === 'q') {
      // If pressing physical W position gives 'z' -> AZERTY
      // If pressing physical W position gives 'w' -> QWERTY
      if (key === 'z') {
        this.layout = 'azerty';
      } else if (key === 'w') {
        this.layout = 'qwerty';
      } else if (key === 'q') {
        // Physical A position: 'q' on AZERTY, 'a' on QWERTY
        this.layout = 'azerty';
      } else if (key === 'a') {
        this.layout = 'qwerty';
      }
      this._detected = true;
      console.log(`[Keyboard] Layout detected: ${this.layout.toUpperCase()}`);
      window.removeEventListener('keydown', this._detectHandler, { capture: true });
    }
  }

  // ─── Key Mapping ──────────────────────────────────────────────────────

  /** Get the logical action for a physical key */
  mapKey(e) {
    const key = e.key;
    // Arrow keys always map the same
    if (key.startsWith('Arrow')) {
      const dir = key.replace('Arrow', '').toLowerCase();
      return dir;
    }
    // Letter keys depend on layout
    if (!this.layout) return key.toLowerCase();
    const k = key.toLowerCase();
    if (this.layout === 'azerty') {
      // AZERTY: physical Z/W -> 'z' maps to 'w' (up), physical A/Q -> 'q' maps to 'a' (left)
      if (k === 'z') return 'w'; // up
      if (k === 'q') return 'a'; // left
      if (k === 'w') return 'z'; // swapped
      if (k === 'a') return 'q'; // swapped
    }
    // QWERTY: no remapping needed for WASD
    return k;
  }

  /** Get display label for an action */
  getLabel(action) {
    const layout = this.layout || 'qwerty';
    return KEY_LABELS[layout][action] || action;
  }

  // ─── Input State ──────────────────────────────────────────────────────

  /** Call once per frame to update justPressed/justReleased */
  update() {
    this._justPressed.clear();
    this._justReleased.clear();
  }

  /** Check if a key is held */
  isHeld(action) {
    return this._held.has(action);
  }

  /** Check if a key was just pressed this frame */
  justPressed(action) {
    return this._justPressed.has(action);
  }

  /** Get held direction as {x, y} */
  getDirection() {
    let x = 0, y = 0;
    if (this._held.has('left') || this._held.has('a')) x -= 1;
    if (this._held.has('right') || this._held.has('d')) x += 1;
    if (this._held.has('up') || this._held.has('w')) y -= 1;
    if (this._held.has('down') || this._held.has('s')) y += 1;
    return { x, y };
  }

  /** Bind a key to an action */
  on(action, callback) {
    if (!this._listeners.has(action)) this._listeners.set(action, []);
    this._listeners.get(action).push(callback);
  }

  off(action, callback) {
    const list = this._listeners.get(action);
    if (list) {
      const idx = list.indexOf(callback);
      if (idx >= 0) list.splice(idx, 1);
    }
  }

  /** Start listening for keydown/keyup */
  start() {
    this._keydownHandler = (e) => {
      const action = this.mapKey(e);
      if (!this._held.has(action)) {
        this._held.add(action);
        this._justPressed.add(action);
      }
      // Fire listeners
      const listeners = this._listeners.get(action);
      if (listeners) listeners.forEach(fn => fn(action, true));
      // Also fire wildcard
      const wild = this._listeners.get('*');
      if (wild) wild.forEach(fn => fn(action, true));
    };

    this._keyupHandler = (e) => {
      const action = this.mapKey(e);
      this._held.delete(action);
      this._justReleased.add(action);
      const listeners = this._listeners.get(action);
      if (listeners) listeners.forEach(fn => fn(action, false));
    };

    window.addEventListener('keydown', this._keydownHandler);
    window.addEventListener('keyup', this._keyupHandler);
  }

  stop() {
    if (this._keydownHandler) window.removeEventListener('keydown', this._keydownHandler);
    if (this._keyupHandler) window.removeEventListener('keyup', this._keyupHandler);
    this._held.clear();
    this._justPressed.clear();
    this._justReleased.clear();
  }
}

export const keyboard = new KeyboardManager();
export { KEY_LABELS };
