# AAA Upgrade Plan — First Fantasy

## Vision
Transform the current functional prototype into a polished, AAA-quality action-RPG with premium visual design, advanced rendering, deep gameplay systems, and professional polish — all while maintaining the modular architecture.

## Design Principles (from gpt-taste + high-end-visual-design)
- **Variance Mandate:** Never default to the same layout/pattern twice
- **Double-Bezel Architecture:** Nested containers for haptic depth
- **Fluid Motion:** Custom cubic-bezier, GSAP ScrollTrigger, magnetic hover physics
- **Macro Whitespace:** `py-24` to `py-40` section spacing
- **GPU-Safe Animation:** Transform/opacity only, no layout thrashing
- **Premium Typography:** Geist/Clash Display/Outfit — NEVER Inter
- **AIDA Structure:** Nav → Hero → Bento → GSAP Desire → Action Footer

---

## Task 1: Premium UI/UX Overhaul
**Skills:** gpt-taste, high-end-visual-design, ui-ux-pro-max

### Deliverables:
1. **New Title Screen** — Cinematic hero with:
   - Ultra-wide H1 container (`max-w-6xl`), 2-line max
   - Radial mesh gradient background + CSS film grain
   - Double-bezel "Start Game" CTA with nested arrow icon
   - Staggered entrance animation (translate-y-16 → 0, blur-md → 0)
   - Floating glass pill nav (detached from top)

2. **In-Game HUD Redesign** — Double-bezel cards:
   - HP bar: Outer shell (subtle border/blur) + Inner core (gradient fill)
   - Score/Wave: Typography-first, editorial luxury style
   - Damage numbers: GSAP scrub reveal, magnetic physics

3. **Game Over Screen** — Asymmetrical bento layout:
   - Large serif "GAME OVER" with inline micro-image
   - Stats cards in gapless dense grid (`grid-flow-dense`)
   - Restart CTA with button-in-button pattern

4. **Pause/Settings Modal** — Fluid island nav morph:
   - Hamburger → X fluid rotation
   - Staggered mask reveal for menu items
   - Glass overlay (`backdrop-blur-3xl`)

### Technical Stack:
- Pure CSS/JS (no React) — use CSS custom properties for theming
- GSAP for scroll-triggered animations
- CSS `grid-auto-flow: dense` for bento grids
- Custom cubic-bezier: `cubic-bezier(0.32, 0.72, 0, 1)`

---

## Task 2: Advanced Three.js Rendering
**Skills:** industrial-brutalist-ui (for technical depth), imagegen-frontend-web (for visual reference)

### Deliverables:
1. **Post-Processing Pipeline** (EffectComposer):
   - Bloom pass (selective glow on gems, sword, enemy eyes)
   - SSAO for depth perception
   - Film grain shader (subtle, fixed overlay)
   - Vignette + color grading (day/night LUTs)
   - FXAA/TXAA anti-aliasing

2. **Custom Shaders**:
   - **Water/Slime shader** for enemies: animated noise displacement, fresnel rim, emissive pulse
   - **Gem shader**: chromatic aberration, rotating caustics, pulse on proximity
   - **Sword trail shader**: ribbon geometry with fade
   - **Ground shader**: triplanar mapping, subtle normal detail

3. **Advanced Particle System** (GPU instanced):
   - 10k+ particles via InstancedBufferGeometry
   - Compute shader simulation (or CPU fallback)
   - Types: slime death burst, gem pickup sparkles, sword swing trails, footstep dust
   - Lifetime, gravity, turbulence, color gradients

4. **Lighting & Atmosphere**:
   - Cascaded shadow maps (CSM) for sun
   - Volumetric fog (ray-marched)
   - Dynamic time-of-day with smooth LUT transitions
   - Screen-space reflections (SSR) for puddles/wet ground

5. **Performance**:
   - Frustum culling + LOD groups
   - InstancedMesh for trees, grass, enemies
   - Texture atlasing (single bind)
   - Target: 60fps on integrated graphics

---

## Task 3: Gameplay Systems Upgrade
**Skills:** subagent-driven-development (for independent system work)

### Deliverables:
1. **Combat System 2.0**:
   - Combo system: light → light → heavy (3-hit chain)
   - Perfect parry window (0.2s) → counterattack
   - Hit pause (frame freeze) on impact
   - Screen shake + chromatic aberration on hit
   - Knockback physics with mass-based resolution

2. **Enemy AI Overhaul**:
   - **Slime**: Current behavior + split on death (2 mini slimes)
   - **Archer**: Ranged, strafing, predictive aim
   - **Brute**: Slow, high HP, charge attack (telegraphed)
   - **Boss**: Multi-phase, arena mechanics, unique patterns
   - Behavior trees (not hardcoded if/else)

3. **Progression & Loot**:
   - XP/Level system with stat allocation (STR/DEX/VIT/INT)
   - Equipment slots: Weapon, Armor, Accessory×2
   - Rarity tiers: Common → Legendary (color-coded)
   - Procedural affixes: +%dmg, +HP, on-hit effects
   - Gem currency for upgrades

4. **Wave System 2.0**:
   - Elite enemies (gold name, modifier: burning, poison, shield)
   - Mini-boss every 5 waves
   - Dynamic difficulty scaling
   - Wave clear bonuses (time, no-hit, speed)

---

## Task 4: Audio System
**Skills:** (web audio expertise)

### Deliverables:
1. **Web Audio API Engine**:
   - AudioContext with gain/master/compressor nodes
   - Spatial audio (PannerNode) for 3D positioning
   - Dynamic music layers (calm → tension → combat)
   - Crossfade transitions between layers

2. **Sound Effects** (procedural/synthesized — no external files):
   - Sword swings: filtered noise + pitch envelope
   - Hit impacts: sine sweep + noise burst
   - Enemy death: downward pitch glide
   - Gem pickup: ascending arpeggio
   - Footsteps: granular synthesis (surface-based)
   - UI: subtle clicks, whooshes, confirms

3. **Adaptive Music**:
   - 4-layer stem system: Bass, Harmony, Melody, Percussion
   - Intensity parameter (0-1) controls layer volumes/filters
   - Seamless transitions via scheduled gain ramps

---

## Task 5: Polish & Effects
**Skills:** gpt-taste (motion choreography), high-end-visual-design (haptic aesthetics)

### Deliverables:
1. **Screen Juice**:
   - Screen shake (trauma-based, decays exponentially)
   - Chromatic aberration on heavy hits
   - Time dilation (slow-mo) on kill/crit
   - Hit flash (additive white overlay, 2 frames)

2. **Transitions**:
   - Title → Game: Iris wipe / radial expand from center
   - Game → Game Over: Radial collapse to death point
   - Wave clear: Pulse ring + slow-mo + "WAVE CLEAR" text reveal

3. **UI Polish**:
   - Tooltip system (delayed, follows cursor, smart positioning)
   - Floating combat text: GSAP physics (arc + fade)
   - Damage numbers: Crit = larger, gold, screen shake
   - HP bar: Smooth lerp, critical pulse (<30%)

4. **Accessibility**:
   - Reduced motion toggle (disables non-essential animation)
   - High contrast mode
   - Key remapping
   - Screen reader labels

---

## Integration Checklist
- [ ] All modules load via ES modules (importmap)
- [ ] No CORS/MIME issues (server serves correct types)
- [ ] 60fps target on mid-range hardware
- [ ] Memory stable over 30min playtest
- [ ] No console errors/warnings
- [ ] Mobile touch controls (virtual joystick + attack button)
- [ ] Save/load (localStorage for progression)

---

## Success Metrics
- **Visual:** Passes high-end-visual-design pre-output checklist
- **Motion:** All transitions use custom cubic-bezier, 60fps sustained
- **Gameplay:** 10+ min session without bugs, clear progression feel
- **Audio:** No cracks/pops, spatial audio works, music adapts
- **Code:** Modular, <200 LOC/file maintained, TypeScript-ready JSDoc