/* @ts-self-types="./ff_wasm_core.d.ts" */

export class Particle {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ParticleFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_particle_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get color_b() {
        const ret = wasm.__wbg_get_particle_color_b(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get color_g() {
        const ret = wasm.__wbg_get_particle_color_g(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get color_r() {
        const ret = wasm.__wbg_get_particle_color_r(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get decay() {
        const ret = wasm.__wbg_get_particle_decay(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get life() {
        const ret = wasm.__wbg_get_particle_life(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get size() {
        const ret = wasm.__wbg_get_particle_size(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get vx() {
        const ret = wasm.__wbg_get_particle_vx(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get vy() {
        const ret = wasm.__wbg_get_particle_vy(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get x() {
        const ret = wasm.__wbg_get_particle_x(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get y() {
        const ret = wasm.__wbg_get_particle_y(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set color_b(arg0) {
        wasm.__wbg_set_particle_color_b(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set color_g(arg0) {
        wasm.__wbg_set_particle_color_g(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set color_r(arg0) {
        wasm.__wbg_set_particle_color_r(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set decay(arg0) {
        wasm.__wbg_set_particle_decay(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set life(arg0) {
        wasm.__wbg_set_particle_life(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set size(arg0) {
        wasm.__wbg_set_particle_size(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set vx(arg0) {
        wasm.__wbg_set_particle_vx(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set vy(arg0) {
        wasm.__wbg_set_particle_vy(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set x(arg0) {
        wasm.__wbg_set_particle_x(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set y(arg0) {
        wasm.__wbg_set_particle_y(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) Particle.prototype[Symbol.dispose] = Particle.prototype.free;

export class ParticleSystem {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ParticleSystemFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_particlesystem_free(ptr, 0);
    }
    /**
     * Add a batch of particles (called from JS with pre-computed values)
     * @param {Float32Array} data
     */
    add_batch(data) {
        const ptr0 = passArrayF32ToWasm0(data, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.particlesystem_add_batch(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * Clear all particles
     */
    clear() {
        wasm.particlesystem_clear(this.__wbg_ptr);
    }
    /**
     * Export particle state as flat array for JS rendering
     * Returns [x, y, size, r, g, b, alpha, ...] per particle
     * @returns {Float32Array}
     */
    export_render_data() {
        const ret = wasm.particlesystem_export_render_data(this.__wbg_ptr);
        var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * Remove dead particles and compact
     */
    gc() {
        wasm.particlesystem_gc(this.__wbg_ptr);
    }
    /**
     * @returns {boolean}
     */
    is_empty() {
        const ret = wasm.particlesystem_is_empty(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    len() {
        const ret = wasm.particlesystem_len(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} max_particles
     * @param {number} gravity
     */
    constructor(max_particles, gravity) {
        const ret = wasm.particlesystem_new(max_particles, gravity);
        this.__wbg_ptr = ret;
        ParticleSystemFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Update all particles in one pass (bulk operation)
     * @param {number} dt
     */
    update(dt) {
        wasm.particlesystem_update(this.__wbg_ptr, dt);
    }
}
if (Symbol.dispose) ParticleSystem.prototype[Symbol.dispose] = ParticleSystem.prototype.free;

/**
 * Batch compute sine values
 * @param {Float32Array} out
 * @param {number} start
 * @param {number} step
 */
export function batch_sin(out, start, step) {
    var ptr0 = passArrayF32ToWasm0(out, wasm.__wbindgen_malloc);
    var len0 = WASM_VECTOR_LEN;
    wasm.batch_sin(ptr0, len0, out, start, step);
}

/**
 * Calculate battle damage (called from JS for complex fights)
 * @param {number} attacker_str
 * @param {number} attacker_mag
 * @param {number} target_def
 * @param {number} target_mdef
 * @param {number} base_power
 * @param {number} level
 * @param {boolean} is_magic
 * @param {number} element_bonus
 * @param {boolean} crit
 * @param {number} combo
 * @returns {number}
 */
export function calc_damage(attacker_str, attacker_mag, target_def, target_mdef, base_power, level, is_magic, element_bonus, crit, combo) {
    const ret = wasm.calc_damage(attacker_str, attacker_mag, target_def, target_mdef, base_power, level, is_magic, element_bonus, crit, combo);
    return ret;
}

/**
 * Fast cosine approximation
 * @param {number} x
 * @returns {number}
 */
export function fast_cos(x) {
    const ret = wasm.fast_cos(x);
    return ret;
}

/**
 * Fast sine approximation (2.5x faster than Math.sin in JS)
 * @param {number} x
 * @returns {number}
 */
export function fast_sin(x) {
    const ret = wasm.fast_sin(x);
    return ret;
}

/**
 * Render a simple gradient to a pixel buffer (RGBA8)
 * @param {Uint8Array} buf
 * @param {number} width
 * @param {number} height
 * @param {number} top_r
 * @param {number} top_g
 * @param {number} top_b
 * @param {number} bot_r
 * @param {number} bot_g
 * @param {number} bot_b
 */
export function render_gradient(buf, width, height, top_r, top_g, top_b, bot_r, bot_g, bot_b) {
    var ptr0 = passArray8ToWasm0(buf, wasm.__wbindgen_malloc);
    var len0 = WASM_VECTOR_LEN;
    wasm.render_gradient(ptr0, len0, buf, width, height, top_r, top_g, top_b, bot_r, bot_g, bot_b);
}

/**
 * Render stars to a pixel buffer (additive)
 * @param {Uint8Array} buf
 * @param {number} width
 * @param {number} height
 * @param {number} count
 * @param {number} frame
 */
export function render_stars(buf, width, height, count, frame) {
    var ptr0 = passArray8ToWasm0(buf, wasm.__wbindgen_malloc);
    var len0 = WASM_VECTOR_LEN;
    wasm.render_stars(ptr0, len0, buf, width, height, count, frame);
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_copy_to_typed_array_4db0cbe2cc60dbee: function(arg0, arg1, arg2) {
            new Uint8Array(arg2.buffer, arg2.byteOffset, arg2.byteLength).set(getArrayU8FromWasm0(arg0, arg1));
        },
        __wbg___wbindgen_throw_344f42d3211c4765: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./ff_wasm_core_bg.js": import0,
    };
}

const ParticleFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_particle_free(ptr, 1));
const ParticleSystemFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_particlesystem_free(ptr, 1));

function getArrayF32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedFloat32ArrayMemory0 = null;
function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayF32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getFloat32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedFloat32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('ff_wasm_core_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
