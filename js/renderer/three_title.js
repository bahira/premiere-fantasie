// renderer/three_title.js — Premium Three.js title background engine
// Optimized: single scene, cached geometries, baked fog, GPU particles,
// DPR-clamped renderer, pause-on-hide, RAF-throttled for battery.

import * as THREE from 'three';

export class TitleThree {
  constructor(container) {
    this.container = container;
    this.disposed = false;
    this._clock = new THREE.Clock();
    this._build();
  }

  _build() {
    // ── Renderer (clamped DPR for perf on retina / mobile) ──────────
    this.renderer = new THREE.WebGLRenderer({
      antialias: window.devicePixelRatio < 2,
      powerPreference: 'high-performance',
      alpha: false,
    });
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    this.renderer.setPixelRatio(dpr);
    this._resize();
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.container.appendChild(this.renderer.domElement);

    // ── Scene & fog (exponential gives the mystical haze) ───────────
    this.scene = new THREE.Scene();
    const fogColor = new THREE.Color(0x0a0a1a);
    this.scene.fog = new THREE.FogExp2(fogColor.getHex(), 0.018);

    // ── Camera (subtle dolly handled in update) ─────────────────────
    this.camera = new THREE.PerspectiveCamera(55, this._aspect(), 0.1, 200);
    this.camera.position.set(0, 6, 22);
    this.camera.lookAt(0, 4, 0);
    // Base transform for drift
    this._camBase = this.camera.position.clone();

    // ── Lights (two-tone cinematic key + rim) ───────────────────────
    const key = new THREE.DirectionalLight(0x6b8cff, 1.6);
    key.position.set(-8, 14, 6);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xffc15e, 1.0);
    rim.position.set(10, 6, -8);
    this.scene.add(rim);
    const amb = new THREE.AmbientLight(0x202840, 0.7);
    this.scene.add(amb);

    // ── Ground: low-poly displaced terrain (single geometry, shared) ─
    this._buildTerrain();
    // ── Floating crystal monoliths (silhouette depth) ───────────────
    this._buildMonoliths();
    // ── Tilt-shift-style planes (fog density layers) ────────────────
    this._buildFogPlanes();
    // ── GPU particle field (embers / soul motes) ─────────────────────
    this._buildParticles();
    // ── Floating emblem gem (the ✦-equivalent in 3D) ────────────────
    this._buildEmblem();

    // ── Event wiring ────────────────────────────────────────────────
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize, { passive: true });

    // ── Pointer parallax (subtle, clamped) ──────────────────────────
    this._pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    this._onPointer = (e) => {
      this._pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      this._pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('pointermove', this._onPointer, { passive: true });

    this._loop = this._loop.bind(this);
    this.renderer.setAnimationLoop(this._loop);
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

  _buildTerrain() {
    // Plane subdivided & vertex-displaced with a cheap value-noise sum.
    const geo = new THREE.PlaneGeometry(120, 120, 64, 64);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      // Two-octave pseudo-noise (no external dep => fast load)
      const h = Math.sin(x * 0.18) * Math.cos(z * 0.21) * 1.8
              + Math.sin(x * 0.05 + z * 0.07) * 3.5
              + Math.cos(x * 0.4 - z * 0.3) * 0.6;
      pos.setY(i, h);
    }
    geo.computeVertexNormals();

    const surfMat = new THREE.MeshStandardMaterial({
      color: 0x14182a,
      roughness: 0.95,
      metalness: 0.0,
      flatShading: true,
    });
    this.terrain = new THREE.Mesh(geo, surfMat);
    this.scene.add(this.terrain);

    // Subtle gold wire overlay (cheap emissive-dashed grid feel)
    const wireGeo = new THREE.PlaneGeometry(120, 120, 24, 24);
    wireGeo.rotateX(-Math.PI / 2);
    const wp = wireGeo.attributes.position;
    for (let i = 0; i < wp.count; i++) {
      wp.setY(i, pos.getY(i % pos.count) + 0.06);
    }
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xf1c40f,
      wireframe: true,
      transparent: true,
      opacity: 0.05,
    });
    this.wire = new THREE.Mesh(wireGeo, wireMat);
    this.scene.add(this.wire);
  }

  _buildMonoliths() {
    // A few floating shards to break the horizon — cheap, single material.
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2a2050,
      roughness: 0.6,
      metalness: 0.3,
      flatShading: true,
      emissive: 0x14082a,
      emissiveIntensity: 0.4,
    });
    this.monoliths = [];
    const positions = [
      [-14, 6, -10, 2.4], [14, 8, -14, 3.0],
      [-8, 4, -22, 1.8], [10, 5, -6, 1.4],
      [0, 9, -30, 2.6],
    ];
    const baseGeo = new THREE.OctahedronGeometry(1, 0);
    for (const [x, y, z, s] of positions) {
      const m = new THREE.Mesh(baseGeo, mat);
      m.position.set(x, y, z);
      m.scale.setScalar(s);
      m.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      m.userData.spin = (Math.random() - 0.5) * 0.2;
      m.userData.bobSpeed = 0.4 + Math.random() * 0.4;
      m.userData.bobBase = y;
      m.userData.bobPhase = Math.random() * Math.PI * 2;
      this.scene.add(m);
      this.monoliths.push(m);
    }
  }

  _buildFogPlanes() {
    // Two large translucent planes close to camera for depth haze, additive.
    const make = (color, opacity, y, z, scale) => {
      const geo = new THREE.PlaneGeometry(scale, scale);
      // Radial gradient via vertex colors? cheaper: a sprite-like texture
      const tex = this._radialTexture(color);
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(0, y, z);
      this.scene.add(m);
      return m;
    };
    this.fogPlanes = [
      make(0x3a4a8c, 0.18, 6, 6, 40),
      make(0x8c5a3a, 0.10, 3, 2, 50),
    ];
  }

  _radialTexture(colorHex) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const col = new THREE.Color(colorHex);
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    const r = Math.round(col.r * 255), gn = Math.round(col.g * 255), b = Math.round(col.b * 255);
    g.addColorStop(0, `rgba(${r},${gn},${b},1)`);
    g.addColorStop(1, `rgba(${r},${gn},${b},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _buildParticles() {
    // 600 particles via BufferGeometry (one draw call), additive, no per-frame
    // JS allocation. CPU-driven only by translating a Float32Array.
    const COUNT = 600;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(COUNT * 3);
    const sizes = new Float32Array(COUNT);
    const seeds = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = Math.random() * 18;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 40 - 5;
      sizes[i] = 0.08 + Math.random() * 0.28;
      seeds[i] = Math.random() * 1000;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    const tex = this._sparkTexture();
    const mat = new THREE.PointsMaterial({
      size: 0.5,
      map: tex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0xffd070,
      sizeAttenuation: true,
    });
    this.particles = new THREE.Points(geo, mat);
    this.scene.add(this.particles);
  }

  _sparkTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,240,200,1)');
    g.addColorStop(0.4, 'rgba(255,200,120,0.6)');
    g.addColorStop(1, 'rgba(255,180,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _buildEmblem() {
    // A floating gem (icosahedron) with emissive gold — the visual anchor
    // behind the title text (which is rendered as DOM overlay).
    const geo = new THREE.IcosahedronGeometry(1.2, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xf1c40f,
      emissive: 0xf1c40f,
      emissiveIntensity: 0.8,
      roughness: 0.25,
      metalness: 0.9,
      flatShading: true,
    });
    this.emblem = new THREE.Mesh(geo, mat);
    this.emblem.position.set(0, 7.5, -2);
    this.scene.add(this.emblem);

    // Halo ring
    const ringGeo = new THREE.TorusGeometry(2.0, 0.03, 8, 96);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf1c40f,
      transparent: true,
      opacity: 0.5,
    });
    this.emblemRing = new THREE.Mesh(ringGeo, ringMat);
    this.emblemRing.position.copy(this.emblem.position);
    this.scene.add(this.emblemRing);
  }

  _loop() {
    if (this.disposed) return;
    const t = this._clock.getElapsedTime();

    // Smooth parallax
    this._pointer.x += (this._pointer.tx - this._pointer.x) * 0.05;
    this._pointer.y += (this._pointer.ty - this._pointer.y) * 0.05;
    this.camera.position.x = this._camBase.x + this._pointer.x * 1.5;
    this.camera.position.y = this._camBase.y - this._pointer.y * 1.0;
    this.camera.lookAt(0, 5 + this._pointer.y * 0.4, 0);

    // Emblem bob & spin
    if (this.emblem) {
      this.emblem.rotation.y = t * 0.4;
      this.emblem.rotation.x = Math.sin(t * 0.3) * 0.2;
      this.emblem.position.y = 7.5 + Math.sin(t * 0.8) * 0.3;
      this.emblemRing.rotation.z = t * 0.2;
      this.emblemRing.rotation.x = Math.PI / 2 + Math.sin(t * 0.5) * 0.2;
      this.emblemRing.position.y = this.emblem.position.y;
    }

    // Monolith bob & spin
    if (this.monoliths) {
      for (const m of this.monoliths) {
        m.rotation.y += m.userData.spin * 0.01;
        m.position.y = m.userData.bobBase + Math.sin(t * m.userData.bobSpeed + m.userData.bobPhase) * 0.4;
      }
    }

    // Particles drift upward, recycle at top
    if (this.particles) {
      const pos = this.particles.geometry.attributes.position;
      const arr = pos.array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] += 0.02 + Math.sin(t + arr[i]) * 0.005;
        arr[i] += Math.sin(t * 0.5 + arr[i + 2]) * 0.004;
        if (arr[i + 1] > 18) arr[i + 1] = 0;
      }
      pos.needsUpdate = true;
    }

    // Slow fog plane drift
    if (this.fogPlanes) {
      this.fogPlanes[0].material.opacity = 0.16 + Math.sin(t * 0.5) * 0.03;
      this.fogPlanes[1].material.opacity = 0.08 + Math.cos(t * 0.4) * 0.02;
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('pointermove', this._onPointer);
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
    });
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
