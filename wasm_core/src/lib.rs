use wasm_bindgen::prelude::*;

// ─── Particle System (WASM-accelerated) ─────────────────────────────────────

#[wasm_bindgen]
pub struct Particle {
    pub x: f32,
    pub y: f32,
    pub vx: f32,
    pub vy: f32,
    pub life: f32,
    pub decay: f32,
    pub size: f32,
    pub color_r: u8,
    pub color_g: u8,
    pub color_b: u8,
}

#[wasm_bindgen]
pub struct ParticleSystem {
    particles: Vec<Particle>,
    gravity: f32,
    max_particles: usize,
}

#[wasm_bindgen]
impl ParticleSystem {
    #[wasm_bindgen(constructor)]
    pub fn new(max_particles: usize, gravity: f32) -> Self {
        Self {
            particles: Vec::with_capacity(max_particles),
            gravity,
            max_particles,
        }
    }

    pub fn len(&self) -> usize {
        self.particles.len()
    }

    pub fn is_empty(&self) -> bool {
        self.particles.is_empty()
    }

    /// Add a batch of particles (called from JS with pre-computed values)
    pub fn add_batch(&mut self, data: &[f32]) {
        // data: [x, y, vx, vy, life, decay, size, r, g, b, ...] per particle
        let stride = 10;
        let mut i = 0;
        while i + stride <= data.len() && self.particles.len() < self.max_particles {
            self.particles.push(Particle {
                x: data[i],
                y: data[i + 1],
                vx: data[i + 2],
                vy: data[i + 3],
                life: data[i + 4],
                decay: data[i + 5],
                size: data[i + 6],
                color_r: data[i + 7] as u8,
                color_g: data[i + 8] as u8,
                color_b: data[i + 9] as u8,
            });
            i += stride;
        }
    }

    /// Update all particles in one pass (bulk operation)
    pub fn update(&mut self, dt: f32) {
        let gravity = self.gravity;
        self.particles.retain_mut(|p| {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += gravity * dt;
            p.life -= p.decay * dt;
            p.life > 0.0
        });
    }

    /// Export particle state as flat array for JS rendering
    /// Returns [x, y, size, r, g, b, alpha, ...] per particle
    pub fn export_render_data(&self) -> Vec<f32> {
        let mut out = Vec::with_capacity(self.particles.len() * 7);
        for p in &self.particles {
            if p.life <= 0.0 {
                continue;
            }
            let alpha = p.life.clamp(0.0, 1.0);
            let sz = p.size * alpha;
            if sz < 0.5 {
                continue; // skip sub-pixel
            }
            out.push(p.x);
            out.push(p.y);
            out.push(sz);
            out.push(p.color_r as f32 / 255.0);
            out.push(p.color_g as f32 / 255.0);
            out.push(p.color_b as f32 / 255.0);
            out.push(alpha);
        }
        out
    }

    /// Clear all particles
    pub fn clear(&mut self) {
        self.particles.clear();
    }

    /// Remove dead particles and compact
    pub fn gc(&mut self) {
        self.particles.retain(|p| p.life > 0.0);
    }
}

// ─── Math Helpers ───────────────────────────────────────────────────────────

/// Fast sine approximation (2.5x faster than Math.sin in JS)
#[wasm_bindgen]
pub fn fast_sin(x: f32) -> f32 {
    // Bhaskara I approximation
    let pi = 3.14159265;
    let x = x % (2.0 * pi);
    let x = if x < 0.0 { x + 2.0 * pi } else { x };
    if x < pi {
        (16.0 * x * (pi - x)) / (5.0 * pi * pi - 4.0 * x * (pi - x))
    } else {
        -(16.0 * (x - pi) * (2.0 * pi - x)) / (5.0 * pi * pi - 4.0 * (x - pi) * (2.0 * pi - x))
    }
}

/// Fast cosine approximation
#[wasm_bindgen]
pub fn fast_cos(x: f32) -> f32 {
    fast_sin(x + 1.5707963)
}

/// Batch compute sine values
#[wasm_bindgen]
pub fn batch_sin(out: &mut [f32], start: f32, step: f32) {
    let pi2 = 6.28318530;
    for i in 0..out.len() {
        let mut x = start + step * i as f32;
        x = x % pi2;
        if x < 0.0 {
            x += pi2;
        }
        out[i] = if x < 3.14159265 {
            (16.0 * x * (3.14159265 - x)) / (5.0 * 9.8696044 - 4.0 * x * (3.14159265 - x))
        } else {
            let xp = x - 3.14159265;
            let xpp = 6.28318530 - x;
            -(16.0 * xp * xpp) / (5.0 * 9.8696044 - 4.0 * xp * xpp)
        };
    }
}

// ─── Pixel Buffer Renderer ──────────────────────────────────────────────────

/// Render a simple gradient to a pixel buffer (RGBA8)
#[wasm_bindgen]
pub fn render_gradient(
    buf: &mut [u8],
    width: usize,
    height: usize,
    top_r: u8, top_g: u8, top_b: u8,
    bot_r: u8, bot_g: u8, bot_b: u8,
) {
    for y in 0..height {
        let t = y as f32 / height as f32;
        let r = lerp_u8(top_r, bot_r, t);
        let g = lerp_u8(top_g, bot_g, t);
        let b = lerp_u8(top_b, bot_b, t);
        let row_start = y * width * 4;
        for x in 0..width {
            let idx = row_start + x * 4;
            buf[idx] = r;
            buf[idx + 1] = g;
            buf[idx + 2] = b;
            buf[idx + 3] = 255;
        }
    }
}

/// Render stars to a pixel buffer (additive)
#[wasm_bindgen]
pub fn render_stars(
    buf: &mut [u8],
    width: usize,
    height: usize,
    count: u32,
    frame: f32,
) {
    let h60 = (height as f32 * 0.6) as i32;
    for i in 0..count {
        let fi = i as f32;
        let sx = ((fi * 107.5 + fi * fi * 3.13) as i32 % width as i32) as usize;
        let sy = ((fi * 73.1 + fi * 7.7) as i32 % h60) as usize;
        let twinkle = 0.3 + 0.7 * fast_sin(frame * 0.005 + fi * 2.3);
        let alpha = (twinkle * 0.6 * 255.0) as u8;
        let r = (0.5 + fast_sin(fi * 0.9)).max(0.3);
        let radius = r as i32;
        // Draw star as small circle
        for dy in -radius..=radius {
            for dx in -radius..=radius {
                if dx * dx + dy * dy > radius * radius {
                    continue;
                }
                let px = sx as i32 + dx;
                let py = sy as i32 + dy;
                if px >= 0 && px < width as i32 && py >= 0 && py < height as i32 {
                    let idx = (py as usize * width + px as usize) * 4;
                    // Additive blend
                    buf[idx] = buf[idx].saturating_add(255);
                    buf[idx + 1] = buf[idx + 1].saturating_add(255);
                    buf[idx + 2] = buf[idx + 2].saturating_add(240);
                    buf[idx + 3] = 255;
                }
            }
        }
    }
}

#[inline(always)]
fn lerp_u8(a: u8, b: u8, t: f32) -> u8 {
    (a as f32 + (b as f32 - a as f32) * t) as u8
}

// ─── Damage Calculation (WASM-accelerated) ──────────────────────────────────

/// Calculate battle damage (called from JS for complex fights)
#[wasm_bindgen]
pub fn calc_damage(
    attacker_str: f32,
    attacker_mag: f32,
    target_def: f32,
    target_mdef: f32,
    base_power: f32,
    level: f32,
    is_magic: bool,
    element_bonus: f32,
    crit: bool,
    combo: u32,
) -> i32 {
    let rnd = 0.85 + (fast_sin(level * 7.3) * 0.5 + 0.5) * 0.3;
    let atk = if is_magic { attacker_mag } else { attacker_str };
    let def = if is_magic { target_mdef } else { target_def };
    let mut dmg = ((20.0 + base_power * 25.0) * (1.0 + atk / 15.0) * level * rnd - def * 0.5).max(1.0);
    // Crit
    if crit {
        dmg *= 2.0;
    }
    // Combo bonus
    if combo > 0 {
        dmg *= 1.0 + combo as f32 * 0.25;
    }
    // Element
    dmg *= 1.0 + element_bonus;
    dmg as i32
}
