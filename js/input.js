// input.js — Keyboard & mouse input manager
export class InputManager {
  constructor() {
    this.keys = {};
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this._enterQueue = false;
    this._clickQueue = false;

    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Enter' || e.key === 'Enter') {
        this._enterQueue = true;
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('mousemove', (e) => {
      this.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    });
    window.addEventListener('mousedown', () => {
      this.mouseDown = true;
      this._clickQueue = true;
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
  }

  get moveX() {
    let x = 0;
    if (this.keys['ArrowLeft'] || this.keys['KeyA']) x -= 1;
    if (this.keys['ArrowRight'] || this.keys['KeyD']) x += 1;
    return x;
  }

  get moveY() {
    let y = 0;
    if (this.keys['ArrowUp'] || this.keys['KeyW']) y -= 1;
    if (this.keys['ArrowDown'] || this.keys['KeyS']) y += 1;
    return y;
  }

  consumeEnter() {
    if (this._enterQueue) { this._enterQueue = false; return true; }
    if (this._clickQueue) { this._clickQueue = false; return true; }
    return false;
  }
}
