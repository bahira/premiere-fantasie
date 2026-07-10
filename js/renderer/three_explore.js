// renderer/three_explore.js — Low-poly 3D character for field/explore mode
// Optimized: shared cached geometries, single character group, no per-frame
// allocations, DPR-clamped renderer, externally driven rAF (field.js calls
// update() + render()). Falls back gracefully (caller catches WebGL errors).

import * as THREE from 'three';
import { CHARACTERS } from '../data/characters.js';

export class ExploreThree {
  constructor(container, options = {}) {
    this.container = container || document.body;
    this.options = options;
    this.disposed = false;
    this.char = null;
    this._walkPhase = 0;
    this._facing = 0;
    // Reusable scratch vectors (no per-frame allocation)
    this._camPos = new THREE.Vector3();
    this._camTarget = new THREE.Vector3();
    this._desired = new THREE.Vector3();
    this._tmp = new THREE.Vector3();

    this._worldScale = options.scale || 0.12;
    this._build();
  }

  _build() {
    // ── Renderer (DPR clamped to 1.5 for perf) ──────────────────────
    this.renderer = new THREE.WebGLRenderer({
      antialias: window.devicePixelRatio < 2,
      powerPreference: 'high-performance',
      alpha: false,
    });
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer.setPixelRatio(dpr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    const cvs = this.renderer.domElement;
    cvs.className = 'explore-3d-canvas';
    this.container.appendChild(cvs);
    this._resize();

    // ── Scene + exponential fog (matches title mood) ────────────────
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a1a);
    this.scene.fog = new THREE.FogExp2(0x0a0a1a, 0.03);

    // ── Camera (chase cam, follows behind character) ────────────────
    this.camera = new THREE.PerspectiveCamera(50, this._aspect(), 0.1, 400);
    this.camera.position.set(0, 7, 12);
    this.camera.lookAt(0, 2, 0);

    // ── Lights: hemisphere fill + directional key (cel-ish) ─────────
    const hemi = new THREE.HemisphereLight(0xbcd0ff, 0x2a1f3a, 0.9);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xfff0d0, 1.3);
    dir.position.set(-6, 12, 8);
    this.scene.add(dir);

    // ── Ground: low-poly displaced flat-ish terrain ─────────────────
    this._buildGround();

    // ── Cache shared geometries (reused across characters) ──────────
    this._geo = {
      body: new THREE.CapsuleGeometry(0.45, 1.1, 4, 8),
      head: new THREE.IcosahedronGeometry(0.42, 0),
      limb: new THREE.BoxGeometry(0.28, 1.0, 0.28),
      arm: new THREE.BoxGeometry(0.22, 0.85, 0.22),
      weapon: new THREE.BoxGeometry(0.12, 1.4, 0.12),
    };

    // ── Event wiring ────────────────────────────────────────────────
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize, { passive: true });
  }

  _aspect() {
    return window.innerWidth / window.innerHeight;
  }

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    if (this.camera) {
      this.camera.aspect = this._aspect();
      this.camera.updateProjectionMatrix();
    }
  }

  _buildGround() {
    const geo = new THREE.PlaneGeometry(400, 400, 48, 48);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      // Very low amplitude so it stays flat-ish but reads as low-poly
      const h = Math.sin(x * 0.12) * Math.cos(z * 0.14) * 0.4
              + Math.sin(x * 0.05 + z * 0.06) * 0.6;
      pos.setY(i, h);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      color: 0x16203a,
      roughness: 1.0,
      metalness: 0.0,
      flatShading: true,
    });
    this.ground = new THREE.Mesh(geo, mat);
    this.ground.position.y = 0;
    this.scene.add(this.ground);

    // Subtle gold grid wire overlay (cheap, low opacity)
    const wireGeo = new THREE.PlaneGeometry(400, 400, 32, 32);
    wireGeo.rotateX(-Math.PI / 2);
    const wp = wireGeo.attributes.position;
    for (let i = 0; i < wp.count; i++) wp.setY(i, pos.getY(i % pos.count) + 0.05);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xf1c40f, wireframe: true, transparent: true, opacity: 0.04,
    });
    this.groundWire = new THREE.Mesh(wireGeo, wireMat);
    this.scene.add(this.groundWire);
  }

  // ─── Character building ────────────────────────────────────────────
  setCharacter(charId) {
    const def = CHARACTERS[charId] || CHARACTERS.zidane;
    const baseColor = new THREE.Color(def.color);

    // Dispose previous character materials + group (keep cached geometries)
    this._disposeCharacter();

    const group = new THREE.Group();
    // Shared material factory: flatShading + emissive rim for cel feel.
    const mkMat = (color, emi = 0.25) => new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      emissive: new THREE.Color(color).multiplyScalar(emi),
      emissiveIntensity: 0.35,
      roughness: 0.7,
      metalness: 0.1,
      flatShading: true,
    });

    const bodyColor = baseColor.clone();
    const skinColor = new THREE.Color(0xf2c9a0);
    const darkColor = baseColor.clone().multiplyScalar(0.6);

    // Body (capsule)
    const body = new THREE.Mesh(this._geo.body, mkMat(bodyColor, 0.2));
    body.position.y = 1.4;
    group.add(body);

    // Head (icosahedron)
    const head = new THREE.Mesh(this._geo.head, mkMat(skinColor, 0.15));
    head.position.y = 2.5;
    group.add(head);

    // Arms (boxes) — pivot at shoulder so we can swing them
    const armL = new THREE.Mesh(this._geo.arm, mkMat(bodyColor, 0.2));
    armL.position.set(-0.55, 1.8, 0);
    const shoulderL = new THREE.Group();
    shoulderL.position.set(-0.55, 2.1, 0);
    armL.position.set(0, -0.42, 0);
    shoulderL.add(armL);
    group.add(shoulderL);

    const armR = new THREE.Mesh(this._geo.arm, mkMat(bodyColor, 0.2));
    const shoulderR = new THREE.Group();
    shoulderR.position.set(0.55, 2.1, 0);
    armR.position.set(0, -0.42, 0);
    shoulderR.add(armR);
    group.add(shoulderR);

    // Weapon (box) attached to right hand
    const weapon = new THREE.Mesh(this._geo.weapon, mkMat(0xdfe6f0, 0.3));
    weapon.position.set(0, -0.9, 0.18);
    shoulderR.add(weapon);

    // Legs (boxes) — pivot at hip for walk swing
    const legL = new THREE.Mesh(this._geo.limb, mkMat(darkColor, 0.15));
    const hipL = new THREE.Group();
    hipL.position.set(-0.22, 0.85, 0);
    legL.position.set(0, -0.5, 0);
    hipL.add(legL);
    group.add(hipL);

    const legR = new THREE.Mesh(this._geo.limb, mkMat(darkColor, 0.15));
    const hipR = new THREE.Group();
    hipR.position.set(0.22, 0.85, 0);
    legR.position.set(0, -0.5, 0);
    hipR.add(legR);
    group.add(hipR);

    // Ground shadow blob (cheap, no lighting cost)
    const shadowGeo = new THREE.CircleGeometry(0.7, 16);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false,
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.position.y = 0.02;
    group.add(shadow);

    // Keep references for animation
    this._parts = { group, body, head, shoulderL, shoulderR, armL, armR, weapon, hipL, hipR, shadow };
    this.char = group;
    this.scene.add(group);
  }

  _disposeCharacter() {
    if (!this.char) return;
    this.char.traverse((o) => { if (o.material) o.material.dispose(); });
    this.scene.remove(this.char);
    this.char = null;
    this._parts = null;
  }

  // ─── Per-frame update ──────────────────────────────────────────────
  // input: { x, y, moveX, moveY }
  //   x,y     -> authoritative world position (from fieldMap), optional
  //   moveX/Y -> normalized movement direction (-1..1) for facing + anim
  update(dt, input) {
    if (!this.char || this.disposed) return;
    const p = this._parts;
    const ix = (input && input.x) || 0;
    const iy = (input && input.y) || 0;
    const mx = (input && input.moveX) || 0;
    const my = (input && input.moveY) || 0;
    const moving = (mx !== 0 || my !== 0);

    // Snap world position if provided (map->world mapping lives in caller)
    if (input && input.x !== undefined) {
      this.char.position.x = ix;
      this.char.position.z = iy;
    }

    // Facing: smooth-rotate toward movement direction
    if (moving) {
      const target = Math.atan2(mx, my);
      let diff = target - this._facing;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this._facing += diff * Math.min(1, dt * 12);
      this.char.rotation.y = this._facing;
    }

    // Walk bob: legs swing, arms counter-swing, body bobs
    if (moving) this._walkPhase += dt * 9;
    const sw = Math.sin(this._walkPhase) * (moving ? 0.6 : 0);
    const swA = Math.sin(this._walkPhase + Math.PI) * (moving ? 0.5 : 0);
    p.hipL.rotation.x = sw;
    p.hipR.rotation.x = -sw;
    p.shoulderL.rotation.x = swA;
    p.shoulderR.rotation.x = -swA;
    const bob = Math.abs(Math.sin(this._walkPhase)) * (moving ? 0.12 : 0);
    p.body.position.y = 1.4 + bob;
    p.head.position.y = 2.5 + bob;
    p.shadow.scale.setScalar(1 - bob * 0.5);

    // ── Chase camera: offset behind character, smoothly follow ──────
    const offX = Math.sin(this._facing) * -8;
    const offZ = Math.cos(this._facing) * -8;
    this._desired.set(
      this.char.position.x + offX,
      7,
      this.char.position.z + offZ
    );
    this._camPos.copy(this.camera.position);
    this._camPos.lerp(this._desired, Math.min(1, dt * 4));
    this.camera.position.copy(this._camPos);

    this._camTarget.set(
      this.char.position.x,
      this.char.position.y + 2,
      this.char.position.z
    );
    this.camera.lookAt(this._camTarget);
  }

  render() {
    if (this.disposed) return;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener('resize', this._onResize);
    this._disposeCharacter();
    // Dispose cached geometries + ground
    for (const k in this._geo) this._geo[k].dispose();
    if (this.ground) { this.ground.geometry.dispose(); this.ground.material.dispose(); }
    if (this.groundWire) { this.groundWire.geometry.dispose(); this.groundWire.material.dispose(); }
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
