const SkinPreview = (() => {
  const VERT_SRC = `
    attribute vec3 aPos;
    attribute vec2 aUV;
    uniform mat4 uMVP;
    varying vec2 vUV;
    void main() {
      gl_Position = uMVP * vec4(aPos, 1.0);
      vUV = aUV;
    }
  `;
  const FRAG_SRC = `
    precision mediump float;
    varying vec2 vUV;
    uniform sampler2D uTex;
    uniform vec4 uTint;
    uniform float uAlphaCut;
    void main() {
      vec4 c = texture2D(uTex, vUV);
      if (c.a < uAlphaCut) discard;
      gl_FragColor = vec4(c.rgb * uTint.rgb, c.a * uTint.a);
    }
  `;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error('Shader hiba: ' + gl.getShaderInfoLog(s));
    }
    return s;
  }

  function boxUvFaces(u, v, w, h, d) {
    return {
      top:    [u + d, v, w, d],
      bottom: [u + d + w, v, w, d],
      right:  [u + d + w, v + d, d, h],
      front:  [u + d, v + d, w, h],
      left:   [u, v + d, d, h],
      back:   [u + d + w + d, v + d, w, h]
    };
  }

  function addBox(positions, uvs, indices, cx, cy, cz, w, h, d, uvOrigin, texW, texH, pad = 0, uvScale = 1, uvFaceMap = null) {
    const hw = w / 2 + pad, hh = h / 2 + pad, hd = d / 2 + pad;
    const p = {
      '000': [cx - hw, cy - hh, cz - hd], '100': [cx + hw, cy - hh, cz - hd],
      '010': [cx - hw, cy + hh, cz - hd], '110': [cx + hw, cy + hh, cz - hd],
      '001': [cx - hw, cy - hh, cz + hd], '101': [cx + hw, cy - hh, cz + hd],
      '011': [cx - hw, cy + hh, cz + hd], '111': [cx + hw, cy + hh, cz + hd]
    };
    const faces = boxUvFaces(uvOrigin[0] * uvScale, uvOrigin[1] * uvScale, w * uvScale, h * uvScale, d * uvScale);
    const faceCorners = {
      front: [p['001'], p['101'], p['111'], p['011']],
      back: [p['100'], p['000'], p['010'], p['110']],
      right: [p['101'], p['100'], p['110'], p['111']],
      left: [p['000'], p['001'], p['011'], p['010']],
      top: [p['011'], p['111'], p['110'], p['010']],
      bottom: [p['000'], p['100'], p['101'], p['001']]
    };
    for (const name of Object.keys(faceCorners)) {
      const uvName = (uvFaceMap && uvFaceMap[name]) || name;
      const [u, v, fw, fh] = faces[uvName];
      const uvCorners = name === 'bottom' ? [
        [(u + fw) / texW, v / texH],
        [u / texW, v / texH],
        [u / texW, (v + fh) / texH],
        [(u + fw) / texW, (v + fh) / texH]
      ] : [
        [u / texW, (v + fh) / texH],
        [(u + fw) / texW, (v + fh) / texH],
        [(u + fw) / texW, v / texH],
        [u / texW, v / texH]
      ];
      const base = positions.length / 3;
      const corners = faceCorners[name];
      for (let i = 0; i < 4; i++) {
        positions.push(corners[i][0], corners[i][1], corners[i][2]);
        uvs.push(uvCorners[i][0], uvCorners[i][1]);
      }
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  function buildGeometry(slim, texW, texH) {
    const positions = [], uvs = [], indices = [];
    const armW = slim ? 3 : 4;
    const uvScale = texW / 64;
    const modern = texH > texW / 2;
    const PAD = 0.4;

    addBox(positions, uvs, indices, 0, 10, 0, 8, 8, 8, [0, 0], texW, texH, 0, uvScale);
    addBox(positions, uvs, indices, 0, 0, 0, 8, 12, 4, [16, 16], texW, texH, 0, uvScale);
    const armY = slim ? -ARM_SLIM_DROP : 0;
    addBox(positions, uvs, indices, -(4 + armW / 2), armY, 0, armW, 12, 4, [40, 16], texW, texH, 0, uvScale);
    addBox(positions, uvs, indices, (4 + armW / 2), armY, 0, armW, 12, 4, modern ? [32, 48] : [40, 16], texW, texH, 0, uvScale);
    addBox(positions, uvs, indices, -2, -12, 0, 4, 12, 4, [0, 16], texW, texH, 0, uvScale);
    addBox(positions, uvs, indices, 2, -12, 0, 4, 12, 4, modern ? [16, 48] : [0, 16], texW, texH, 0, uvScale);

    addBox(positions, uvs, indices, 0, 10, 0, 8, 8, 8, [32, 0], texW, texH, PAD, uvScale);
    if (modern) {
      addBox(positions, uvs, indices, 0, 0, 0, 8, 12, 4, [16, 32], texW, texH, PAD, uvScale);
      addBox(positions, uvs, indices, -(4 + armW / 2), armY, 0, armW, 12, 4, [40, 32], texW, texH, PAD, uvScale);
      addBox(positions, uvs, indices, (4 + armW / 2), armY, 0, armW, 12, 4, [48, 48], texW, texH, PAD, uvScale);
      addBox(positions, uvs, indices, -2, -12, 0, 4, 12, 4, [0, 32], texW, texH, PAD, uvScale);
      addBox(positions, uvs, indices, 2, -12, 0, 4, 12, 4, [0, 48], texW, texH, PAD, uvScale);
    }
    return { positions, uvs, indices };
  }

  function buildCapeGeometry(texW, texH) {
    const positions = [], uvs = [], indices = [];
    const uvScale = texW / 64;
    addBox(positions, uvs, indices, 0, -2, -2.5, 10, 16, 1, [0, 0], texW, texH, 0, uvScale, { front: 'back', back: 'front' });
    return { positions, uvs, indices };
  }

  const ARM_SLIM_DROP = 0.5;

  const ITEM_ARM_PITCH = -0.31415927;

  const HAND_OFFSET = 8;

  const COSMETIC_PIVOTS = {
    head:      [0, 0, 0],
    body:      [0, 0, 0],
    back:      [0, 0, 0],
    tail:      [0, 0, 0],
    left_arm:  [5, 2, 0],
    right_arm: [-5, 2, 0],
    main_hand: [-5, 10, 0]
  };

  function bonePivotFor(slot, slim) {
    const base = COSMETIC_PIVOTS[slot] || [0, 0, 0];
    if (!slim) return base;
    if (slot === 'left_arm' || slot === 'right_arm' || slot === 'main_hand') {
      return [base[0], base[1] + ARM_SLIM_DROP, base[2]];
    }
    return base;
  }

  function rotateZ(angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }
  function rotateX(angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
  }
  function scaleMat3(x, y, z) {
    return new Float32Array([x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]);
  }
  function transformPoint(m, x, y, z) {
    return [
      m[0] * x + m[4] * y + m[8] * z + m[12],
      m[1] * x + m[5] * y + m[9] * z + m[13],
      m[2] * x + m[6] * y + m[10] * z + m[14]
    ];
  }

  const FLAP_DOWN_FRACTION = 0.34;

  function smootherStep(u) {
    return u * u * u * (u * (u * 6 - 15) + 10);
  }

  function animWave(wave, turns) {
    if (wave === 'flap') {
      const t = turns - Math.floor(turns);
      if (t < FLAP_DOWN_FRACTION) return 1 - 2 * smootherStep(t / FLAP_DOWN_FRACTION);
      return -1 + 2 * smootherStep((t - FLAP_DOWN_FRACTION) / (1 - FLAP_DOWN_FRACTION));
    }
    if (wave === 'tri') {
      const x = turns + 0.25;
      return 4 * Math.abs(x - Math.floor(x + 0.5)) - 1;
    }
    if (wave === 'saw') return 2 * (turns - Math.floor(turns)) - 1;
    if (wave === 'pulse') return (turns - Math.floor(turns)) < 0.5 ? 1 : -1;
    return Math.sin(turns * 2 * Math.PI);
  }

  function animReact() { return 1; }

  function evalAnim(anim, timeSec, distance) {
    const out = { rot: [0, 0, 0], trans: [0, 0, 0], scale: 1 };
    if (!anim || !Array.isArray(anim.tracks)) return out;
    const d = typeof distance === 'number' ? distance : 1;
    const AXIS = { x: 0, y: 1, z: 2 };
    for (const t of anim.tracks) {
      if (!t || typeof t !== 'object') continue;
      const amp = Number(t.amp) || 0;
      const speed = Number(t.speed) || 0;
      if (!amp || !speed) continue;
      const falloff = Math.max(0, Math.min(1, Number(t.falloff) || 0));
      const spread = Number(t.spread) || 0;
      const turns = speed * timeSec + ((Number(t.phase) || 0) + spread * d) / 360;
      const ampScale = 1 - falloff + falloff * d;
      const value = amp * ampScale * animWave(t.wave, turns) * animReact(t.react);
      const axis = AXIS[t.axis] !== undefined ? AXIS[t.axis] : 0;
      if (t.type === 'rotate') out.rot[axis] += value;
      else if (t.type === 'translate') out.trans[axis] += value;
      else if (t.type === 'scale') out.scale *= Math.max(0.05, 1 + value);
    }
    return out;
  }

  function placementMatrix(offset, scale, rotation, center, f) {
    let m = translate(-offset[0] / 16, -offset[1] / 16, offset[2] / 16);
    if (scale !== 1) m = multiply(m, scaleMat(scale));
    if (rotation[0] || rotation[1] || rotation[2]) {
      const cx = center[0] * f / 16, cy = center[1] * f / 16, cz = center[2] / 16;
      const rx = (f < 0 ? -rotation[0] : rotation[0]) * Math.PI / 180;
      const ry = (f < 0 ? -rotation[1] : rotation[1]) * Math.PI / 180;
      const rz = rotation[2] * Math.PI / 180;
      m = multiply(m, translate(cx, cy, cz));
      m = multiply(m, rotateZ(rz));
      m = multiply(m, rotateY(ry));
      m = multiply(m, rotateX(rx));
      m = multiply(m, translate(-cx, -cy, -cz));
    }
    return m;
  }

  function animMatrix(anim, pivot, f, timeSec, distance) {
    if (!anim || !Array.isArray(anim.tracks) || !anim.tracks.length) return null;
    const a = evalAnim(anim, timeSec, distance);
    let m = null;
    if (a.trans[0] || a.trans[1] || a.trans[2]) {
      m = translate(a.trans[0] * f / 16, a.trans[1] * f / 16, a.trans[2] / 16);
    }
    const hasRot = a.rot[0] || a.rot[1] || a.rot[2];
    if (!hasRot && a.scale === 1) return m;

    const px = pivot[0] * f / 16, py = pivot[1] * f / 16, pz = pivot[2] / 16;
    let r = translate(px, py, pz);
    if (hasRot) {
      const rx = (f < 0 ? -a.rot[0] : a.rot[0]) * Math.PI / 180;
      const ry = (f < 0 ? -a.rot[1] : a.rot[1]) * Math.PI / 180;
      const rz = a.rot[2] * Math.PI / 180;
      r = multiply(r, rotateZ(rz));
      r = multiply(r, rotateY(ry));
      r = multiply(r, rotateX(rx));
    }
    if (a.scale !== 1) r = multiply(r, scaleMat(a.scale));
    r = multiply(r, translate(-px, -py, -pz));
    return m ? multiply(m, r) : r;
  }

  const AURA_MAX_PARTICLES = 96;

  let auraPresets = [];
  function setAuraPresets(list) {
    auraPresets = Array.isArray(list) ? list : [];
  }

  function auraRand(i, cycle, channel) {
    let h = (Math.imul(i, 374761393) + Math.imul(cycle, 668265263) + Math.imul(channel, 2147483647)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) | 0;
    h = (h ^ (h >>> 16)) | 0;
    return (h & 0x00FFFFFF) / 0x01000000;
  }
  function auraRandSigned(i, cycle, channel) { return auraRand(i, cycle, channel) * 2 - 1; }

  function hexToRgb(hex, fallback) {
    if (typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) return fallback;
    const v = parseInt(hex.slice(1), 16);
    return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
  }

  function resolveAura(stored, presets) {
    if (!stored || !stored.type || !Array.isArray(presets)) return null;
    const preset = presets.find((p) => p.id === stored.type);
    if (!preset) return null;
    const speed = Number.isFinite(stored.speed) ? stored.speed : 1;
    const out = Object.assign({}, preset);
    if (Number.isFinite(stored.rate)) out.rate = stored.rate;
    if (Number.isFinite(stored.size)) { out.sizeB = preset.sizeB * (stored.size / preset.size); out.size = stored.size; }
    if (Number.isFinite(stored.life)) out.life = stored.life;
    if (stored.colorA) out.colorA = stored.colorA;
    if (stored.colorB) out.colorB = stored.colorB;
    out.rise = preset.rise * speed;
    out.drift = preset.drift * speed;
    out.swirl = preset.swirl * speed;
    out.gravity = preset.gravity * speed;
    out.offsetX = Number.isFinite(stored.offsetX) ? stored.offsetX : 0;
    out.offsetY = Number.isFinite(stored.offsetY) ? stored.offsetY : 0;
    out.offsetZ = Number.isFinite(stored.offsetZ) ? stored.offsetZ : 0;
    out.extent = Number.isFinite(stored.extent) ? stored.extent : 1;
    return out;
  }

  function auraParticle(aura, i, count, time, center, halfExtent) {
    const ox = Number.isFinite(aura.offsetX) ? aura.offsetX : 0;
    const oy = Number.isFinite(aura.offsetY) ? aura.offsetY : 0;
    const oz = Number.isFinite(aura.offsetZ) ? aura.offsetZ : 0;
    const ext = Number.isFinite(aura.extent) ? aura.extent : 1;
    const phase = time / aura.life + i / count;
    const cycle = Math.floor(phase);
    const age = (phase - cycle) * aura.life;
    const t = age / aura.life;

    let dx = auraRandSigned(i, cycle, 3) * aura.drift * age;
    let dz = auraRandSigned(i, cycle, 4) * aura.drift * age;
    if (aura.swirl) {
      const ang = aura.swirl * age * 2 * Math.PI + auraRand(i, cycle, 5) * 6.2831853;
      const rad = 0.6 + auraRand(i, cycle, 6) * 1.4;
      dx += Math.cos(ang) * rad;
      dz += Math.sin(ang) * rad;
    }
    const up = aura.rise * age + 0.5 * aura.gravity * age * age;

    const size = aura.size + (aura.sizeB - aura.size) * t;
    if (size <= 0) return null;

    let flick = 1;
    if (aura.flicker > 0) {
      const fr = auraRand(i, cycle, 7);
      flick = 1 - aura.flicker * (0.5 + 0.5 * Math.sin(age * 18 + fr * 6.2831853));
    }
    const ca = hexToRgb(aura.colorA, [1, 1, 1]);
    const cb = hexToRgb(aura.colorB, ca);
    const alpha = (aura.alphaA + (aura.alphaB - aura.alphaA) * t);
    if (alpha <= 0.004) return null;

    return {
      x: center[0] + ox + auraRandSigned(i, cycle, 0) * halfExtent[0] * ext + dx,
      y: center[1] + oy + auraRandSigned(i, cycle, 1) * halfExtent[1] * ext + up,
      z: center[2] + oz + auraRandSigned(i, cycle, 2) * halfExtent[2] * ext + dz,
      size,
      spin: aura.spin * age * (auraRand(i, cycle, 8) < 0.5 ? -1 : 1),
      r: (ca[0] + (cb[0] - ca[0]) * t) * flick,
      g: (ca[1] + (cb[1] - ca[1]) * t) * flick,
      b: (ca[2] + (cb[2] - ca[2]) * t) * flick,
      a: alpha,
      faceSeed: auraRand(i, cycle, 9)
    };
  }

  const WAVE_BANDS = 64;

  const SEAM_FADE = 0.2;
  function seamFactor(d) {
    if (d >= SEAM_FADE) return 1;
    const t = d / SEAM_FADE;
    return t * t * (3 - 2 * t);
  }

  function bandMatrix(out, o, rx, ry, rz) {
    const cx = Math.cos(rx), sx = Math.sin(rx);
    const cy = Math.cos(ry), sy = Math.sin(ry);
    const cz = Math.cos(rz), sz = Math.sin(rz);
    out[o]     = cz * cy;
    out[o + 1] = cz * sy * sx - sz * cx;
    out[o + 2] = cz * sy * cx + sz * sx;
    out[o + 3] = sz * cy;
    out[o + 4] = sz * sy * sx + cz * cx;
    out[o + 5] = sz * sy * cx - cz * sx;
    out[o + 6] = -sy;
    out[o + 7] = cy * sx;
    out[o + 8] = cy * cx;
  }

  function makeBands() {
    const rot = new Float32Array((WAVE_BANDS + 1) * 9);
    const trans = new Float32Array((WAVE_BANDS + 1) * 3);
    const scl = new Float32Array(WAVE_BANDS + 1);
    let px = 0, py = 0, pz = 0, identity = true, mirrorAxis = 0;

    return {
      build(anim, timeSec, pivot, unit, f, axis, straddles) {
        mirrorAxis = axis | 0;
        px = pivot[0] * unit * f;
        py = pivot[1] * unit * f;
        pz = pivot[2] * unit;
        let any = false;
        for (let b = 0; b <= WAVE_BANDS; b++) {
          const d = b / WAVE_BANDS;
          const a = evalAnim(anim, timeSec, d);
          const k = (straddles && mirrorAxis >= 0 && mirrorAxis < 3) ? seamFactor(d) : 1;
          const kr = [k, k, k];
          const kt = [1, 1, 1];
          if (k !== 1) { kr[mirrorAxis] = 1; kt[mirrorAxis] = k; }
          const ro = b * 9, to = b * 3;
          trans[to] = a.trans[0] * kt[0] * unit * f;
          trans[to + 1] = a.trans[1] * kt[1] * unit * f;
          trans[to + 2] = a.trans[2] * kt[2] * unit;
          scl[b] = a.scale;
          const rx = a.rot[0] * kr[0] * Math.PI / 180 * f;
          const ry = a.rot[1] * kr[1] * Math.PI / 180 * f;
          const rz = a.rot[2] * kr[2] * Math.PI / 180;
          bandMatrix(rot, ro, rx, ry, rz);
          if (a.scale !== 1 || trans[to] || trans[to + 1] || trans[to + 2] || rx || ry || rz) any = true;
        }
        identity = !any;
        return any;
      },
      isIdentity() { return identity; },
      apply(d, x, y, z, out, o) {
        const mirror = d < 0;
        if (mirror) d = -d;

        let t = d * WAVE_BANDS;
        if (t < 0) t = 0; else if (t > WAVE_BANDS) t = WAVE_BANDS;
        let b0 = t | 0;
        if (b0 >= WAVE_BANDS) b0 = WAVE_BANDS - 1;
        const w = t - b0;

        let vx = x - px, vy = y - py, vz = z - pz;
        if (mirror) {
          if (mirrorAxis === 0) vx = -vx; else if (mirrorAxis === 1) vy = -vy; else vz = -vz;
        }

        let ro = b0 * 9, to = b0 * 3, sc = scl[b0];
        let sx = vx * sc, sy = vy * sc, sz = vz * sc;
        const ax = rot[ro]     * sx + rot[ro + 1] * sy + rot[ro + 2] * sz + trans[to];
        const ay = rot[ro + 3] * sx + rot[ro + 4] * sy + rot[ro + 5] * sz + trans[to + 1];
        const az = rot[ro + 6] * sx + rot[ro + 7] * sy + rot[ro + 8] * sz + trans[to + 2];

        ro += 9; to += 3; sc = scl[b0 + 1];
        sx = vx * sc; sy = vy * sc; sz = vz * sc;
        const bx = rot[ro]     * sx + rot[ro + 1] * sy + rot[ro + 2] * sz + trans[to];
        const by = rot[ro + 3] * sx + rot[ro + 4] * sy + rot[ro + 5] * sz + trans[to + 1];
        const bz = rot[ro + 6] * sx + rot[ro + 7] * sy + rot[ro + 8] * sz + trans[to + 2];

        let ox = ax + (bx - ax) * w;
        let oy = ay + (by - ay) * w;
        let oz = az + (bz - az) * w;
        if (mirror) {
          if (mirrorAxis === 0) ox = -ox; else if (mirrorAxis === 1) oy = -oy; else oz = -oz;
        }
        out[o] = px + ox; out[o + 1] = py + oy; out[o + 2] = pz + oz;
      }
    };
  }

  const partBands = makeBands();
  const assemblyBands = makeBands();
  const tmpA = new Float32Array(3);
  const tmpB = new Float32Array(3);

  function animIsWave(anim) {
    if (!anim || !Array.isArray(anim.tracks)) return false;
    return anim.tracks.some((t) => t && ((Number(t.falloff) || 0) !== 0 || (Number(t.spread) || 0) !== 0));
  }

  const WAVE_SEGMENT_LENGTH = 1.25;
  const WAVE_MAX_SEGMENTS = 12;

  function waveSegments(a, b) {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    return Math.max(1, Math.min(WAVE_MAX_SEGMENTS, Math.ceil(d / WAVE_SEGMENT_LENGTH - 1e-6)));
  }

  function pushQuad(positions, uvs, indices, pts, us, vs, tessellate) {
    const su = tessellate ? waveSegments(pts[0], pts[1]) : 1;
    const sv = tessellate ? waveSegments(pts[1], pts[2]) : 1;
    const base = positions.length / 3;
    for (let j = 0; j <= sv; j++) {
      const b = j / sv;
      for (let i = 0; i <= su; i++) {
        const a = i / su;
        const w0 = (1 - a) * (1 - b), w1 = a * (1 - b), w2 = a * b, w3 = (1 - a) * b;
        positions.push(
          pts[0][0] * w0 + pts[1][0] * w1 + pts[2][0] * w2 + pts[3][0] * w3,
          pts[0][1] * w0 + pts[1][1] * w1 + pts[2][1] * w2 + pts[3][1] * w3,
          pts[0][2] * w0 + pts[1][2] * w1 + pts[2][2] * w2 + pts[3][2] * w3
        );
        uvs.push(us[0] * w0 + us[1] * w1 + us[2] * w2 + us[3] * w3, vs[0] * w0 + vs[1] * w1 + vs[2] * w2 + vs[3] * w3);
      }
    }
    const row = su + 1;
    for (let j = 0; j < sv; j++) {
      for (let i = 0; i < su; i++) {
        const q = base + j * row + i;
        indices.push(q, q + 1, q + row + 1, q, q + row + 1, q + row);
      }
    }
  }

  function animAlongAxis(anim, elements) {
    const AXIS = { x: 0, y: 1, z: 2 };
    if (anim && Array.isArray(anim.tracks)) {
      for (const t of anim.tracks) {
        if (!t) continue;
        if ((Number(t.falloff) || 0) === 0 && (Number(t.spread) || 0) === 0) continue;
        if (AXIS[t.along] !== undefined) return AXIS[t.along];
        break;
      }
    }
    let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (const el of (elements || [])) {
      if (!Array.isArray(el.from) || !Array.isArray(el.to)) continue;
      for (let k = 0; k < 3; k++) {
        const c = (el.from[k] + el.to[k]) / 2;
        if (c < min[k]) min[k] = c;
        if (c > max[k]) max[k] = c;
      }
    }
    let axis = 0, best = max[0] - min[0];
    for (let k = 1; k < 3; k++) {
      const extent = max[k] - min[k];
      if (extent > best) { best = extent; axis = k; }
    }
    return Number.isFinite(best) ? axis : 0;
  }

  function boundsOf(elements) {
    let nx = Infinity, xx = -Infinity, ny = Infinity, xy = -Infinity, nz = Infinity, xz = -Infinity;
    for (const el of (elements || [])) {
      if (!Array.isArray(el.from) || !Array.isArray(el.to)) continue;
      nx = Math.min(nx, el.from[0], el.to[0]); xx = Math.max(xx, el.from[0], el.to[0]);
      ny = Math.min(ny, el.from[1], el.to[1]); xy = Math.max(xy, el.from[1], el.to[1]);
      nz = Math.min(nz, el.from[2], el.to[2]); xz = Math.max(xz, el.from[2], el.to[2]);
    }
    if (!Number.isFinite(nx)) return [0, 0, 0];
    return [(nx + xx) / 2, (ny + xy) / 2, (nz + xz) / 2];
  }

  function makeSideNormalizer(signedValues) {
    let maxNeg = 0, maxPos = 0;
    for (const s of signedValues) {
      if (s < 0) { if (-s > maxNeg) maxNeg = -s; }
      else if (s > maxPos) maxPos = s;
    }
    const degenerate = maxNeg === 0 && maxPos === 0;
    const normalize = (signed) => {
      if (degenerate) return 1;
      const denom = signed < 0 ? maxNeg : maxPos;
      if (denom <= 0) return 0;
      const ratio = Math.min(1, Math.abs(signed) / denom);
      return signed < 0 ? -ratio : ratio;
    };
    normalize.straddles = maxNeg > 0 && maxPos > 0;
    return normalize;
  }

  function elementRotationChain(el) {
    if (Array.isArray(el.rotations) && el.rotations.length) {
      const out = [];
      for (const r of el.rotations) {
        if (!r || !Array.isArray(r.angles) || !Array.isArray(r.origin)) continue;
        if (!r.angles[0] && !r.angles[1] && !r.angles[2]) continue;
        out.push(r);
      }
      if (out.length) return out;
    }
    if (el.rotation && typeof el.rotation.angle === 'number' && el.rotation.angle !== 0
        && Array.isArray(el.rotation.origin)) {
      const a = el.rotation.angle;
      return [{
        angles: el.rotation.axis === 'x' ? [a, 0, 0] : el.rotation.axis === 'y' ? [0, a, 0] : [0, 0, a],
        origin: el.rotation.origin
      }];
    }
    return null;
  }

  function applyRotationChain(point, chain) {
    let pt = point;
    for (const r of chain) {
      if (r.angles[0]) pt = rotatePoint(pt, r.origin, 'x', r.angles[0]);
      if (r.angles[1]) pt = rotatePoint(pt, r.origin, 'y', r.angles[1]);
      if (r.angles[2]) pt = rotatePoint(pt, r.origin, 'z', r.angles[2]);
    }
    return pt;
  }

  function rotatePoint(p, origin, axis, angleDeg) {
    const rad = angleDeg * Math.PI / 180;
    const c = Math.cos(rad), s = Math.sin(rad);
    const x = p[0] - origin[0], y = p[1] - origin[1], z = p[2] - origin[2];
    let rx, ry, rz;
    if (axis === 'x') { rx = x; ry = y * c - z * s; rz = y * s + z * c; }
    else if (axis === 'y') { rx = x * c + z * s; ry = y; rz = -x * s + z * c; }
    else { rx = x * c - y * s; ry = x * s + y * c; rz = z; }
    return [rx + origin[0], ry + origin[1], rz + origin[2]];
  }

  function buildCosmeticParts(model, slot, opts) {
    const standalone = !!(opts && opts.standalone);
    const keepOffset = !!(opts && opts.keepOffset);

    const t = (model.assembly && typeof model.assembly === 'object') ? model.assembly : (model.transform || {});
    const off = Array.isArray(t.offset) && t.offset.length === 3 ? t.offset : [0, 0, 0];
    const mScale = typeof t.scale === 'number' && t.scale > 0 ? t.scale : 1;
    const rot = Array.isArray(t.rotation) && t.rotation.length === 3 ? t.rotation : [0, 0, 0];
    const itemSpace = t.itemModelSpace !== false;
    const f = itemSpace ? -1 : 1;

    const rawParts = Array.isArray(model.parts) && model.parts.length
      ? model.parts
      : [{ elements: model.elements, texture_size: model.texture_size, transform: null, anim: null }];

    const parts = [];
    let allMin = [Infinity, Infinity, Infinity];
    let allMax = [-Infinity, -Infinity, -Infinity];

    for (const raw of rawParts) {
      let texW, texH;
      if (itemSpace) {
        texW = 16; texH = 16;
      } else {
        const ts = Array.isArray(raw.texture_size) && raw.texture_size.length === 2 ? raw.texture_size : [64, 64];
        texW = ts[0] > 0 ? ts[0] : 64;
        texH = ts[1] > 0 ? ts[1] : 64;
      }

      const positions = [], uvs = [], indices = [];
      const FACE_DIRS = ['north', 'south', 'east', 'west', 'up', 'down'];
      const elementRanges = [];
      const tessellate = animIsWave(raw.anim) || animIsWave(t.anim);

      for (const el of (raw.elements || [])) {
        if (!Array.isArray(el.from) || !Array.isArray(el.to)) continue;
        const rangeStart = positions.length;
        const inf = typeof el.inflate === 'number' ? el.inflate : 0;
        const x1 = Math.min(el.from[0], el.to[0]) - inf, x2 = Math.max(el.from[0], el.to[0]) + inf;
        const y1 = Math.min(el.from[1], el.to[1]) - inf, y2 = Math.max(el.from[1], el.to[1]) + inf;
        const z1 = Math.min(el.from[2], el.to[2]) - inf, z2 = Math.max(el.from[2], el.to[2]) + inf;

        const rotChain = elementRotationChain(el);
        function corner(x, y, z) {
          const pt = [x, y, z];
          return rotChain ? applyRotationChain(pt, rotChain) : pt;
        }

        const quads = {
          north: [corner(x2, y2, z1), corner(x1, y2, z1), corner(x1, y1, z1), corner(x2, y1, z1)],
          south: [corner(x1, y2, z2), corner(x2, y2, z2), corner(x2, y1, z2), corner(x1, y1, z2)],
          east:  [corner(x2, y2, z2), corner(x2, y2, z1), corner(x2, y1, z1), corner(x2, y1, z2)],
          west:  [corner(x1, y2, z1), corner(x1, y2, z2), corner(x1, y1, z2), corner(x1, y1, z1)],
          up:    [corner(x1, y2, z1), corner(x2, y2, z1), corner(x2, y2, z2), corner(x1, y2, z2)],
          down:  [corner(x1, y1, z2), corner(x2, y1, z2), corner(x2, y1, z1), corner(x1, y1, z1)]
        };

        for (const dir of FACE_DIRS) {
          const face = el.faces && el.faces[dir];
          if (!face || !Array.isArray(face.uv) || face.uv.length !== 4) continue;
          const [u1, v1, u2, v2] = face.uv;
          const pts = quads[dir];
          const baseU = [u1, u2, u2, u1];
          const baseV = [v1, v1, v2, v2];
          const steps = ((((face.rotation | 0) / 90) % 4) + 4) % 4;
          const us = [], vs = [];
          for (let i = 0; i < 4; i++) {
            const src = ((i - steps) % 4 + 4) % 4;
            us.push(baseU[src] / texW);
            vs.push(baseV[src] / texH);
          }
          pushQuad(positions, uvs, indices, pts, us, vs, tessellate);
        }

        if (positions.length > rangeStart) {
          elementRanges.push({
            start: rangeStart,
            end: positions.length,
            center: [(el.from[0] + el.to[0]) / 2, (el.from[1] + el.to[1]) / 2, (el.from[2] + el.to[2]) / 2]
          });
        }
      }

      if (!indices.length) continue;

      const pt = raw.transform || {};
      const partOffset = standalone ? [0, 0, 0]
        : (Array.isArray(pt.offset) && pt.offset.length === 3 ? pt.offset : [0, 0, 0]);
      const partRotation = Array.isArray(pt.rotation) && pt.rotation.length === 3 ? pt.rotation : [0, 0, 0];
      const partScale = typeof pt.scale === 'number' && pt.scale > 0 ? pt.scale : 1;
      const center = boundsOf(raw.elements);
      const anim = raw.anim && typeof raw.anim === 'object' ? raw.anim : null;

      for (const el of (raw.elements || [])) {
        if (!Array.isArray(el.from) || !Array.isArray(el.to)) continue;
        for (let k = 0; k < 3; k++) {
          allMin[k] = Math.min(allMin[k], el.from[k], el.to[k]);
          allMax[k] = Math.max(allMax[k], el.from[k], el.to[k]);
        }
      }

      const animPivot = (anim && Array.isArray(anim.pivot) && anim.pivot.length === 3) ? anim.pivot : center;
      const wave = animIsWave(anim);

      let elementDistance = null;
      let vertexDistance = null;
      let waveAxis = 0;
      let waveStraddles = false;
      if (wave && elementRanges.length) {
        const axis = animAlongAxis(anim, raw.elements);
        const signedVerts = [];
        for (let i = 0; i < positions.length / 3; i++) signedVerts.push(positions[i * 3 + axis] - animPivot[axis]);
        const normalize = makeSideNormalizer(signedVerts);
        elementDistance = elementRanges.map((r) => normalize(r.center[axis] - animPivot[axis]));
        waveAxis = axis;
        waveStraddles = normalize.straddles;
        vertexDistance = new Float32Array(positions.length / 3);
        for (let i = 0; i < vertexDistance.length; i++) {
          vertexDistance[i] = normalize(positions[i * 3 + axis] - animPivot[axis]);
        }
      }

      parts.push({
        positions, uvs, indices,
        offset: partOffset, rotation: partRotation, scale: partScale,
        center,
        anim,
        animPivot,
        wave,
        elementRanges,
        elementDistance,
        vertexDistance,
        waveAxis,
        waveStraddles
      });
    }

    const allCenter = Number.isFinite(allMin[0])
      ? [(allMin[0] + allMax[0]) / 2, (allMin[1] + allMax[1]) / 2, (allMin[2] + allMax[2]) / 2]
      : [0, 0, 0];
    const slim = !!(opts && opts.slim);
    const bonePivot = bonePivotFor(slot, slim);
    const assemblyAnim = (t.anim && typeof t.anim === 'object') ? t.anim : null;

    const assemblyPivot0 = (assemblyAnim && Array.isArray(assemblyAnim.pivot) && assemblyAnim.pivot.length === 3)
      ? assemblyAnim.pivot : allCenter;
    const assemblyWave = animIsWave(assemblyAnim) && parts.length > 0;
    let assemblyWaveAxis = 0;
    let assemblyWaveStraddles = false;
    if (assemblyWave) {
      const AXIS = { x: 0, y: 1, z: 2 };
      const a2mLocal = scaleMat3(f / 16, f / 16, 1 / 16);
      const toAuthor = [16 * f, 16 * f, 16];
      for (const p of parts) {
        p.placement = multiply(placementMatrix(p.offset, p.scale, p.rotation, p.center, f), a2mLocal);
      }
      const inAssembly = (p, x, y, z) => {
        const q = transformPoint(p.placement, x, y, z);
        return [q[0] * toAuthor[0], q[1] * toAuthor[1], q[2] * toAuthor[2]];
      };

      let axis = -1;
      for (const tr of (assemblyAnim.tracks || [])) {
        if (!tr) continue;
        if ((Number(tr.falloff) || 0) === 0 && (Number(tr.spread) || 0) === 0) continue;
        if (AXIS[tr.along] !== undefined) axis = AXIS[tr.along];
        break;
      }
      if (axis < 0) {
        const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
        for (const p of parts) for (const r of p.elementRanges) {
          const c = inAssembly(p, r.center[0], r.center[1], r.center[2]);
          for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], c[k]); mx[k] = Math.max(mx[k], c[k]); }
        }
        axis = 0;
        let best = mx[0] - mn[0];
        for (let k = 1; k < 3; k++) { if (mx[k] - mn[k] > best) { best = mx[k] - mn[k]; axis = k; } }
      }

      const signedVerts = [];
      for (const p of parts) {
        for (let i = 0; i < p.positions.length / 3; i++) {
          signedVerts.push(inAssembly(p, p.positions[i * 3], p.positions[i * 3 + 1], p.positions[i * 3 + 2])[axis] - assemblyPivot0[axis]);
        }
      }
      const normalize = makeSideNormalizer(signedVerts);
      assemblyWaveAxis = axis;
      assemblyWaveStraddles = normalize.straddles;
      for (const p of parts) {
        p.assemblyVertexDistance = new Float32Array(p.positions.length / 3);
        for (let i = 0; i < p.assemblyVertexDistance.length; i++) {
          const c = inAssembly(p, p.positions[i * 3], p.positions[i * 3 + 1], p.positions[i * 3 + 2]);
          p.assemblyVertexDistance[i] = normalize(c[axis] - assemblyPivot0[axis]);
        }
      }
    }

    return {
      parts,
      standalone,
      f,
      assemblyWave,
      assemblyWaveAxis,
      assemblyWaveStraddles,
      aura: (t.aura && typeof t.aura === 'object') ? t.aura : null,
      auraCenter: allCenter,
      auraHalfExtent: Number.isFinite(allMin[0])
        ? [(allMax[0] - allMin[0]) / 2 + 1, (allMax[1] - allMin[1]) / 2 + 1, (allMax[2] - allMin[2]) / 2 + 1]
        : [1, 1, 1],
      auraUVs: (() => {
        const out = [];
        for (const p of parts) {
          for (let i = 0; i + 5 < p.uvs.length && out.length < 48; i += 8) {
            out.push([(p.uvs[i] + p.uvs[i + 4]) / 2, (p.uvs[i + 1] + p.uvs[i + 5]) / 2]);
          }
          if (out.length >= 48) break;
        }
        return out;
      })(),
      assembly: {
        offset: (standalone && !keepOffset) ? [0, 0, 0] : off,
        scale: mScale,
        rotation: rot,
        center: allCenter,
        anim: assemblyAnim,
        animPivot: (assemblyAnim && Array.isArray(assemblyAnim.pivot) && assemblyAnim.pivot.length === 3)
          ? assemblyAnim.pivot : allCenter
      },
      bonePivot,
      slot,
    };
  }

  function boneToPreviewMatrix(built) {
    let m2p = scaleMat3(16, -16, -16);
    if (built.standalone) return m2p;
    const bp = built.bonePivot;
    if (built.slot === 'main_hand') {
      const shoulderY = bp[1] - HAND_OFFSET;
      m2p = multiply(translate(0, -HAND_OFFSET, 0), m2p);
      m2p = multiply(rotateX(ITEM_ARM_PITCH), m2p);
      m2p = multiply(translate(bp[0], 6 - shoulderY, -bp[2]), m2p);
      return m2p;
    }
    return multiply(translate(bp[0], 6 - bp[1], -bp[2]), m2p);
  }

  function cosmeticPartMatrix(built, index, timeSec, skipPartAnim) {
    const f = built.f;
    const a = built.assembly;
    const part = built.parts[index];

    const m2p = boneToPreviewMatrix(built);

    if (built.assemblyWave) {
      return multiply(m2p, placementMatrix(a.offset, a.scale, a.rotation, a.center, f));
    }

    let m = placementMatrix(a.offset, a.scale, a.rotation, a.center, f);
    const aAnim = animMatrix(a.anim, a.animPivot, f, timeSec, 1);
    if (aAnim) m = multiply(m, aAnim);

    m = multiply(m, placementMatrix(part.offset, part.scale, part.rotation, part.center, f));
    const pAnim = skipPartAnim ? null : animMatrix(part.anim, part.animPivot, f, timeSec, 1);
    if (pAnim) m = multiply(m, pAnim);

    const a2m = scaleMat3(f / 16, f / 16, 1 / 16);
    return multiply(m2p, multiply(m, a2m));
  }

  function cosmeticAuraMatrix(built, timeSec) {
    const f = built.f;
    const a = built.assembly;
    const m2p = boneToPreviewMatrix(built);
    let m = placementMatrix(a.offset, a.scale, a.rotation, a.center, f);
    if (!built.assemblyWave) {
      const aAnim = animMatrix(a.anim, a.animPivot, f, timeSec, 1);
      if (aAnim) m = multiply(m, aAnim);
    }
    const a2m = scaleMat3(f / 16, f / 16, 1 / 16);
    return multiply(m2p, multiply(m, a2m));
  }

  function waveElementPositions(built, index, timeSec, out) {
    const part = built.parts[index];
    const src = part.positions;
    const partWaving = !!part.vertexDistance;

    if (partWaving) partBands.build(part.anim, timeSec, part.animPivot, 1, 1, part.waveAxis, part.waveStraddles);

    if (!built.assemblyWave) {
      if (!partWaving || partBands.isIdentity()) {
        for (let i = 0; i < src.length; i++) out[i] = src[i];
        return out;
      }
      const vd = part.vertexDistance;
      for (let v = 0, i = 0; i < src.length; v++, i += 3) {
        partBands.apply(vd[v], src[i], src[i + 1], src[i + 2], out, i);
      }
      return out;
    }

    const a = built.assembly;
    const f = built.f;
    assemblyBands.build(a.anim, timeSec, a.animPivot, 1 / 16, f, built.assemblyWaveAxis, built.assemblyWaveStraddles);

    let pm = placementMatrix(part.offset, part.scale, part.rotation, part.center, f);
    if (!partWaving) {
      const pAnim = animMatrix(part.anim, part.animPivot, f, timeSec, 1);
      if (pAnim) pm = multiply(pm, pAnim);
    }
    pm = multiply(pm, scaleMat3(f / 16, f / 16, 1 / 16));

    const vd = part.vertexDistance;
    const avd = part.assemblyVertexDistance;
    for (let v = 0, i = 0; i < src.length; v++, i += 3) {
      if (partWaving && !partBands.isIdentity()) {
        partBands.apply(vd[v], src[i], src[i + 1], src[i + 2], tmpA, 0);
      } else {
        tmpA[0] = src[i]; tmpA[1] = src[i + 1]; tmpA[2] = src[i + 2];
      }
      const x = tmpA[0], y = tmpA[1], z = tmpA[2];
      tmpB[0] = pm[0] * x + pm[4] * y + pm[8] * z + pm[12];
      tmpB[1] = pm[1] * x + pm[5] * y + pm[9] * z + pm[13];
      tmpB[2] = pm[2] * x + pm[6] * y + pm[10] * z + pm[14];
      assemblyBands.apply(avd[v], tmpB[0], tmpB[1], tmpB[2], out, i);
    }
    return out;
  }

  function buildCosmeticGeometry(model, slot, opts) {
    const built = buildCosmeticParts(model, slot, opts);
    const positions = [], uvs = [], indices = [];
    for (let i = 0; i < built.parts.length; i++) {
      const part = built.parts[i];
      const needsDeform = part.wave || built.assemblyWave;
      const m = cosmeticPartMatrix(built, i, 0, needsDeform);
      const src = needsDeform
        ? waveElementPositions(built, i, 0, new Float32Array(part.positions.length))
        : part.positions;
      const base = positions.length / 3;
      for (let v = 0; v < src.length; v += 3) {
        const q = transformPoint(m, src[v], src[v + 1], src[v + 2]);
        positions.push(q[0], q[1], q[2]);
      }
      for (const u of part.uvs) uvs.push(u);
      for (const idx of part.indices) indices.push(base + idx);
    }
    return { positions, uvs, indices };
  }

  function geometryBounds(geometry) {
    const p = geometry.positions;
    if (!p.length) return { center: [0, 0, 0], size: 1 };
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < p.length; i += 3) {
      minX = Math.min(minX, p[i]); maxX = Math.max(maxX, p[i]);
      minY = Math.min(minY, p[i + 1]); maxY = Math.max(maxY, p[i + 1]);
      minZ = Math.min(minZ, p[i + 2]); maxZ = Math.max(maxZ, p[i + 2]);
    }
    return {
      center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
      size: Math.max(maxX - minX, maxY - minY, maxZ - minZ, 0.001)
    };
  }

  function perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0
    ]);
  }
  function multiply(a, b) {
    const out = new Float32Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        out[i * 4 + j] = a[0 * 4 + j] * b[i * 4 + 0] + a[1 * 4 + j] * b[i * 4 + 1] + a[2 * 4 + j] * b[i * 4 + 2] + a[3 * 4 + j] * b[i * 4 + 3];
      }
    }
    return out;
  }
  function rotateY(angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
  }
  function rotateX(angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
  }
  function translate(x, y, z) {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
  }
  function scaleMat(s) {
    return new Float32Array([s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1]);
  }

  function createDrawable(gl, geometry, img, sharedTex) {
    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.positions), gl.STATIC_DRAW);

    const uvBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.uvs), gl.STATIC_DRAW);

    const idxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geometry.indices), gl.STATIC_DRAW);

    let tex = sharedTex;
    if (!tex) {
      tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    return { posBuf, uvBuf, idxBuf, tex, ownsTexture: !sharedTex, indexCount: geometry.indices.length };
  }

  function start(canvas, img, slim, capeImg, cosmetics, onCosmeticDrag, opts) {
    const gl = canvas.getContext('webgl', { alpha: true, antialias: false });
    if (!gl) return () => {};

    const program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT_SRC));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Program hiba: ' + gl.getProgramInfoLog(program));
    }
    gl.useProgram(program);
    gl.uniform4f(gl.getUniformLocation(program, 'uTint'), 1, 1, 1, 1);
    gl.uniform1f(gl.getUniformLocation(program, 'uAlphaCut'), 0.05);

    const aPos = gl.getAttribLocation(program, 'aPos');
    const aUV = gl.getAttribLocation(program, 'aUV');
    gl.enableVertexAttribArray(aPos);
    gl.enableVertexAttribArray(aUV);

    const bodyGeometry = buildGeometry(!!slim, img.naturalWidth || img.width, img.naturalHeight || img.height);
    const body = createDrawable(gl, bodyGeometry, img);

    let cape = null;
    if (capeImg) {
      const capeGeometry = buildCapeGeometry(capeImg.naturalWidth || capeImg.width, capeImg.naturalHeight || capeImg.height);
      cape = createDrawable(gl, capeGeometry, capeImg);
    }

    let cosmeticDrawables = [];
    let auraTex = null;

    function buildCosmetics(list) {
      for (const d of cosmeticDrawables) {
        gl.deleteBuffer(d.posBuf); gl.deleteBuffer(d.uvBuf); gl.deleteBuffer(d.idxBuf);
        if (d.ownsTexture) gl.deleteTexture(d.tex);
      }
      cosmeticDrawables = [];
      for (const c of (list || [])) {
        if (!c || !c.model || !c.img) continue;
        try {
          const built = buildCosmeticParts(c.model, c.slot, { slim: !!slim });
          let sharedTex = null;
          for (let i = 0; i < built.parts.length; i++) {
            const part = built.parts[i];
            if (!part.indices.length) continue;
            const d = createDrawable(gl, part, c.img, sharedTex);
            if (!sharedTex) sharedTex = d.tex;
            if (!auraTex) auraTex = d.tex;
            d.built = built;
            d.partIndex = i;
            d.wave = !!(part.wave || built.assemblyWave);
            if (d.wave) {
              d.scratch = new Float32Array(part.positions.length);
              gl.bindBuffer(gl.ARRAY_BUFFER, d.posBuf);
              gl.bufferData(gl.ARRAY_BUFFER, d.scratch, gl.DYNAMIC_DRAW);
            }
            cosmeticDrawables.push(d);
          }
        } catch (e) {
          console.warn('[SkinPreview] Kiegészítő-geometria hiba:', e);
        }
      }
    }
    buildCosmetics(cosmetics);

    function drawDrawable(d) {
      gl.bindBuffer(gl.ARRAY_BUFFER, d.posBuf);
      gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, d.uvBuf);
      gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, d.idxBuf);
      gl.bindTexture(gl.TEXTURE_2D, d.tex);
      gl.drawElements(gl.TRIANGLES, d.indexCount, gl.UNSIGNED_SHORT, 0);
    }

    const uMVP = gl.getUniformLocation(program, 'uMVP');
    const uTint = gl.getUniformLocation(program, 'uTint');
    const uAlphaCut = gl.getUniformLocation(program, 'uAlphaCut');

    const auraCubeVerts = new Float32Array(72);
    const auraCubeUVs = new Float32Array(48);
    const auraCubeIdx = new Uint16Array(36);
    for (let f = 0; f < 6; f++) {
      const o = f * 4;
      auraCubeIdx.set([o, o + 1, o + 2, o, o + 2, o + 3], f * 6);
    }
    const auraPosBuf = gl.createBuffer();
    const auraUvBuf = gl.createBuffer();
    const auraIdxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, auraIdxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, auraCubeIdx, gl.STATIC_DRAW);

    const AURA_FACES = [
      [0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1],
      [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]
    ];

    function drawAura(built, mvp, timeSec) {
      const spec = resolveAura(built.aura, auraPresets);
      if (!spec || !built.auraUVs || !built.auraUVs.length) return;
      let count = Math.round(spec.rate * spec.life);
      if (count <= 0) return;
      if (count > AURA_MAX_PARTICLES) count = AURA_MAX_PARTICLES;

      const auraMvp = multiply(mvp, cosmeticAuraMatrix(built, timeSec));
      gl.uniformMatrix4fv(uMVP, false, auraMvp);
      gl.uniform1f(uAlphaCut, 0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, auraIdxBuf);
      gl.bindTexture(gl.TEXTURE_2D, auraTex);

      for (let i = 0; i < count; i++) {
        const p = auraParticle(spec, i, count, timeSec, built.auraCenter, built.auraHalfExtent);
        if (!p) continue;

        const s = p.size * 0.5;
        const cs = Math.cos(p.spin * 2 * Math.PI);
        const sn = Math.sin(p.spin * 2 * Math.PI);
        const xs = [], ys = [], zs = [];
        for (let sx = -1; sx <= 1; sx += 2) {
          for (let sy = -1; sy <= 1; sy += 2) {
            for (let sz = -1; sz <= 1; sz += 2) {
              const lx = sx * s, lz = sz * s;
              xs.push(p.x + lx * cs - lz * sn);
              ys.push(p.y + sy * s);
              zs.push(p.z + lx * sn + lz * cs);
            }
          }
        }
        const uv = built.auraUVs[Math.min(built.auraUVs.length - 1,
          Math.floor(p.faceSeed * built.auraUVs.length))];
        for (let f = 0; f < 6; f++) {
          const face = AURA_FACES[f];
          for (let k = 0; k < 4; k++) {
            const c = face[k];
            const o = (f * 4 + k) * 3;
            auraCubeVerts[o] = xs[c];
            auraCubeVerts[o + 1] = ys[c];
            auraCubeVerts[o + 2] = zs[c];
            const uo = (f * 4 + k) * 2;
            auraCubeUVs[uo] = uv[0];
            auraCubeUVs[uo + 1] = uv[1];
          }
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, auraPosBuf);
        gl.bufferData(gl.ARRAY_BUFFER, auraCubeVerts, gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, auraUvBuf);
        gl.bufferData(gl.ARRAY_BUFFER, auraCubeUVs, gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);

        gl.uniform4f(uTint, p.r, p.g, p.b, p.a);
        gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
      }

      gl.uniform4f(uTint, 1, 1, 1, 1);
      gl.uniform1f(uAlphaCut, 0.05);
    }

    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 0);

    let angle = 0.6;
    let dragging = false, lastX = 0, lastY = 0, pitch = -0.15;
    let camDistance = 46;

    let mode = 'rotate';

    function onDown(e) {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      mode = 'rotate';
      if (onCosmeticDrag) {
        if (e.ctrlKey || e.metaKey) mode = 'modelRotate';
        else if (e.shiftKey || e.button === 2) mode = 'move';
      }
      if (mode !== 'rotate') e.preventDefault();
    }
    function onMove(e) {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      if (mode === 'move' || mode === 'modelRotate') {
        onCosmeticDrag(dx, dy, angle, camDistance, mode === 'move' ? 'move' : 'rotate');
      } else {
        angle += dx * 0.01;
        pitch = Math.max(-1.3, Math.min(1.3, pitch + dy * 0.01));
      }
    }
    function onUp() { dragging = false; }

    const CAM_NEAR = 14, CAM_FAR = 120;
    function setCamDistance(v) {
      camDistance = Math.max(CAM_NEAR, Math.min(CAM_FAR, v));
    }

    const wheelNeedsModifier = !onCosmeticDrag;
    function onWheel(e) {
      if (wheelNeedsModifier && !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.12 : 1 / 1.12;
      setCamDistance(camDistance * factor);
    }

    let pinchStart = 0, pinchStartDistance = 0;
    function touchSpan(e) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      return Math.hypot(dx, dy);
    }
    function onTouchStart(e) {
      if (e.touches.length !== 2) return;
      pinchStart = touchSpan(e);
      pinchStartDistance = camDistance;
    }
    function onTouchMove(e) {
      if (e.touches.length !== 2 || pinchStart <= 0) return;
      e.preventDefault();
      setCamDistance(pinchStartDistance * (pinchStart / touchSpan(e)));
    }
    function onTouchEnd() { pinchStart = 0; }

    canvas.addEventListener('mousedown', onDown);
    const zoomable = !!onCosmeticDrag || !!(opts && opts.wheelZoom);
    if (onCosmeticDrag) canvas.addEventListener('contextmenu', preventCtx);
    if (zoomable) {
      canvas.addEventListener('wheel', onWheel, { passive: false });
      canvas.addEventListener('touchstart', onTouchStart, { passive: true });
      canvas.addEventListener('touchmove', onTouchMove, { passive: false });
      canvas.addEventListener('touchend', onTouchEnd);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    function preventCtx(e) { e.preventDefault(); }

    let stopped = false;
    let spinning = !onCosmeticDrag && !(opts && opts.spin === false);
    let lastFrameAt = 0;

    function frame(now) {
      if (stopped) return;
      const dt = lastFrameAt ? Math.min(0.1, (now - lastFrameAt) / 1000) : 1 / 60;
      lastFrameAt = now;
      if (!dragging && spinning) angle += 0.36 * dt;

      const w = canvas.width, h = canvas.height;
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const proj = perspective(Math.PI / 5, w / h, 1, 400);
      const view = multiply(translate(0, -2, -camDistance), rotateX(pitch));
      const model = rotateY(angle);
      const mvp = multiply(proj, multiply(view, model));
      gl.uniformMatrix4fv(uMVP, false, mvp);
      drawDrawable(body);
      if (cape) drawDrawable(cape);
      const animTime = (performance.now() % 3600000) / 1000;
      for (const c of cosmeticDrawables) {
        if (c.wave) {
          waveElementPositions(c.built, c.partIndex, animTime, c.scratch);
          gl.bindBuffer(gl.ARRAY_BUFFER, c.posBuf);
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, c.scratch);
        }
        gl.uniformMatrix4fv(uMVP, false,
          multiply(mvp, cosmeticPartMatrix(c.built, c.partIndex, animTime, c.wave)));
        drawDrawable(c);
      }
      if (auraPresets.length) {
        const drawnAura = new Set();
        for (const c of cosmeticDrawables) {
          if (!c.built.aura || drawnAura.has(c.built)) continue;
          drawnAura.add(c.built);
          drawAura(c.built, mvp, animTime);
        }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    const stop = () => {
      stopped = true;
      canvas.removeEventListener('mousedown', onDown);
      if (onCosmeticDrag) canvas.removeEventListener('contextmenu', preventCtx);
      if (zoomable) {
        canvas.removeEventListener('wheel', onWheel);
        canvas.removeEventListener('touchstart', onTouchStart);
        canvas.removeEventListener('touchmove', onTouchMove);
        canvas.removeEventListener('touchend', onTouchEnd);
      }
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    };

    stop.updateCosmetics = (list) => {
      if (stopped) return;
      buildCosmetics(list);
    };

    const DEFAULT_CAM = camDistance;
    stop.zoomBy = (factor) => { setCamDistance(camDistance / factor); return stop.getZoomLevel(); };
    stop.getZoomLevel = () => (CAM_FAR - camDistance) / (CAM_FAR - CAM_NEAR);
    stop.setZoomLevel = (t) => {
      setCamDistance(CAM_FAR - Math.max(0, Math.min(1, t)) * (CAM_FAR - CAM_NEAR));
    };
    stop.resetView = () => { camDistance = DEFAULT_CAM; angle = 0.6; pitch = -0.15; };
    stop.setSpin = (on) => { spinning = !!on && !onCosmeticDrag; };
    stop.isSpinning = () => spinning;

    return stop;
  }

  function startCosmetic(canvas, model, img) {
    const gl = canvas.getContext('webgl', { alpha: true, antialias: false });
    if (!gl) return () => {};

    let geometry;
    try {
      geometry = buildCosmeticGeometry(model, 'head', { standalone: true });
    } catch (e) {
      return () => {};
    }
    if (!geometry.indices.length) return () => {};

    const program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT_SRC));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return () => {};
    gl.useProgram(program);
    gl.uniform4f(gl.getUniformLocation(program, 'uTint'), 1, 1, 1, 1);
    gl.uniform1f(gl.getUniformLocation(program, 'uAlphaCut'), 0.05);

    const aPos = gl.getAttribLocation(program, 'aPos');
    const aUV = gl.getAttribLocation(program, 'aUV');
    gl.enableVertexAttribArray(aPos);
    gl.enableVertexAttribArray(aUV);

    const drawable = createDrawable(gl, geometry, img);
    const bounds = geometryBounds(geometry);
    const fit = 22 / bounds.size;

    const uMVP = gl.getUniformLocation(program, 'uMVP');
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 0);

    let angle = 0.5;
    let dragging = false, lastX = 0;
    function onDown(e) { dragging = true; lastX = e.clientX; }
    function onMove(e) { if (dragging) { angle += (e.clientX - lastX) * 0.01; lastX = e.clientX; } }
    function onUp() { dragging = false; }
    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    let stopped = false;
    function frame() {
      if (stopped) return;
      if (!dragging) angle += 0.01;
      const w = canvas.width, h = canvas.height;
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const proj = perspective(Math.PI / 5, w / h, 1, 200);
      const view = translate(0, 0, -60);
      const centering = translate(-bounds.center[0], -bounds.center[1], -bounds.center[2]);
      const modelMat = multiply(rotateY(angle), multiply(scaleMat(fit), centering));
      gl.uniformMatrix4fv(uMVP, false, multiply(proj, multiply(view, modelMat)));

      gl.bindBuffer(gl.ARRAY_BUFFER, drawable.posBuf);
      gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, drawable.uvBuf);
      gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, drawable.idxBuf);
      gl.bindTexture(gl.TEXTURE_2D, drawable.tex);
      gl.drawElements(gl.TRIANGLES, drawable.indexCount, gl.UNSIGNED_SHORT, 0);

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    return () => {
      stopped = true;
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    };
  }

  let sharedGl = null, sharedCanvas = null, sharedProgram = null, sharedAttribs = null;

  function ensureSharedContext(size) {
    if (!sharedCanvas) {
      sharedCanvas = document.createElement('canvas');
    }
    if (sharedCanvas.width !== size) {
      sharedCanvas.width = size;
      sharedCanvas.height = size;
      sharedGl = null;
    }
    if (!sharedGl) {
      sharedGl = sharedCanvas.getContext('webgl', { alpha: true, antialias: true, preserveDrawingBuffer: true });
      if (!sharedGl) return null;
      sharedProgram = sharedGl.createProgram();
      sharedGl.attachShader(sharedProgram, compile(sharedGl, sharedGl.VERTEX_SHADER, VERT_SRC));
      sharedGl.attachShader(sharedProgram, compile(sharedGl, sharedGl.FRAGMENT_SHADER, FRAG_SRC));
      sharedGl.linkProgram(sharedProgram);
      sharedGl.useProgram(sharedProgram);
      sharedGl.uniform4f(sharedGl.getUniformLocation(sharedProgram, 'uTint'), 1, 1, 1, 1);
      sharedGl.uniform1f(sharedGl.getUniformLocation(sharedProgram, 'uAlphaCut'), 0.05);
      sharedAttribs = {
        pos: sharedGl.getAttribLocation(sharedProgram, 'aPos'),
        uv: sharedGl.getAttribLocation(sharedProgram, 'aUV'),
        mvp: sharedGl.getUniformLocation(sharedProgram, 'uMVP')
      };
      sharedGl.enableVertexAttribArray(sharedAttribs.pos);
      sharedGl.enableVertexAttribArray(sharedAttribs.uv);
      sharedGl.enable(sharedGl.DEPTH_TEST);
      sharedGl.disable(sharedGl.CULL_FACE);
      sharedGl.clearColor(0, 0, 0, 0);
    }
    return sharedGl;
  }

  const RIG_SCALE = 1 / 16;

  function rigVec3(obj, key, fallback) {
    const a = obj && obj[key];
    if (!Array.isArray(a) || a.length !== 3) return fallback.slice();
    return [Number(a[0]) || 0, Number(a[1]) || 0, Number(a[2]) || 0];
  }

  function rigRotateVector(v, angles) {
    const rx = angles[0] * Math.PI / 180;
    const ry = angles[1] * Math.PI / 180;
    const rz = angles[2] * Math.PI / 180;
    let x = v[0], y = v[1], z = v[2];
    if (rx) {
      const c = Math.cos(rx), s = Math.sin(rx);
      const ny = y * c - z * s, nz = y * s + z * c;
      y = ny; z = nz;
    }
    if (ry) {
      const c = Math.cos(ry), s = Math.sin(ry);
      const nx = x * c + z * s, nz = -x * s + z * c;
      x = nx; z = nz;
    }
    if (rz) {
      const c = Math.cos(rz), s = Math.sin(rz);
      const nx = x * c - y * s, ny = x * s + y * c;
      x = nx; y = ny;
    }
    v[0] = x; v[1] = y; v[2] = z;
  }

  function rigFaceUv(u1, v1, u2, v2, rotationDegrees) {
    const su = [u1, u2, u2, u1];
    const sv = [v1, v1, v2, v2];
    const steps = (((rotationDegrees / 90) % 4) + 4) % 4;
    const out = [];
    for (let i = 0; i < 4; i++) {
      const src = (i + 4 - steps) % 4;
      out.push(su[src], sv[src]);
    }
    return out;
  }

  const RIG_CORNER = (x, y, z) => (x * 4 + y * 2 + z) * 3;
  const RIG_FACE_CORNERS = [
    [RIG_CORNER(1, 1, 0), RIG_CORNER(0, 1, 0), RIG_CORNER(0, 0, 0), RIG_CORNER(1, 0, 0)],
    [RIG_CORNER(0, 1, 1), RIG_CORNER(1, 1, 1), RIG_CORNER(1, 0, 1), RIG_CORNER(0, 0, 1)],
    [RIG_CORNER(1, 1, 1), RIG_CORNER(1, 1, 0), RIG_CORNER(1, 0, 0), RIG_CORNER(1, 0, 1)],
    [RIG_CORNER(0, 1, 0), RIG_CORNER(0, 1, 1), RIG_CORNER(0, 0, 1), RIG_CORNER(0, 0, 0)],
    [RIG_CORNER(0, 1, 0), RIG_CORNER(1, 1, 0), RIG_CORNER(1, 1, 1), RIG_CORNER(0, 1, 1)],
    [RIG_CORNER(0, 0, 1), RIG_CORNER(1, 0, 1), RIG_CORNER(1, 0, 0), RIG_CORNER(0, 0, 0)]
  ];
  const RIG_DIRS = ['north', 'south', 'east', 'west', 'up', 'down'];

  function rigParseCube(el, f, texW, texH) {
    const from = Array.isArray(el.from) && el.from.length === 3 ? el.from.map(Number) : null;
    const to = Array.isArray(el.to) && el.to.length === 3 ? el.to.map(Number) : null;
    if (!from || !to) return null;

    const inflate = Number(el.inflate) || 0;
    const x1 = Math.min(from[0], to[0]) - inflate, x2 = Math.max(from[0], to[0]) + inflate;
    const y1 = Math.min(from[1], to[1]) - inflate, y2 = Math.max(from[1], to[1]) + inflate;
    const z1 = Math.min(from[2], to[2]) - inflate, z2 = Math.max(from[2], to[2]) + inflate;

    let rotAngles = null, rotOrigin = null;
    if (el.rotation && typeof el.rotation === 'object'
      && Array.isArray(el.rotation.angles) && Array.isArray(el.rotation.origin)) {
      rotAngles = el.rotation.angles.map(Number);
      rotOrigin = el.rotation.origin.map(Number);
    }

    const corners = new Float32Array(24);
    for (let xi = 0; xi < 2; xi++) {
      for (let yi = 0; yi < 2; yi++) {
        for (let zi = 0; zi < 2; zi++) {
          const o = (xi * 4 + yi * 2 + zi) * 3;
          let px = xi === 0 ? x1 : x2;
          let py = yi === 0 ? y1 : y2;
          let pz = zi === 0 ? z1 : z2;
          if (rotAngles) {
            const v = [px - rotOrigin[0], py - rotOrigin[1], pz - rotOrigin[2]];
            rigRotateVector(v, rotAngles);
            px = v[0] + rotOrigin[0];
            py = v[1] + rotOrigin[1];
            pz = v[2] + rotOrigin[2];
          }
          corners[o] = px * RIG_SCALE * f;
          corners[o + 1] = py * RIG_SCALE * f;
          corners[o + 2] = pz * RIG_SCALE;
        }
      }
    }

    const faces = el.faces && typeof el.faces === 'object' ? el.faces : null;
    if (!faces) return null;

    const vertices = new Float32Array(72);
    const uvs = [];
    const present = [];
    for (let i = 0; i < 6; i++) {
      const face = faces[RIG_DIRS[i]];
      if (!face || !Array.isArray(face.uv) || face.uv.length !== 4) continue;
      const c = RIG_FACE_CORNERS[i];
      for (let k = 0; k < 4; k++) {
        const o = i * 12 + k * 3;
        vertices[o] = corners[c[k]];
        vertices[o + 1] = corners[c[k] + 1];
        vertices[o + 2] = corners[c[k] + 2];
      }
      uvs[i] = rigFaceUv(
        Number(face.uv[0]) / texW, Number(face.uv[1]) / texH,
        Number(face.uv[2]) / texW, Number(face.uv[3]) / texH,
        Number(face.rotation) || 0);
      present.push(i);
    }
    if (!present.length) return null;
    return { vertices, uvs, present };
  }

  function rigParseAnimations(raw, boneCount, f) {
    const out = [];
    if (!Array.isArray(raw)) return out;
    for (const a of raw) {
      if (!a || typeof a !== 'object') continue;
      const loop = typeof a.loop === 'string' ? a.loop : (a.loop === true ? 'loop' : 'once');
      const anim = {
        name: typeof a.name === 'string' ? a.name : '',
        loop: loop === 'loop',
        hold: loop === 'hold',
        length: Math.max(0.05, Number(a.length) || 1),
        tracks: []
      };
      for (const t of (Array.isArray(a.tracks) ? a.tracks : [])) {
        if (!t || typeof t !== 'object') continue;
        const bone = Number(t.bone);
        if (!Number.isInteger(bone) || bone < 0 || bone >= boneCount) continue;
        const channel = t.channel === 'position' ? 1 : (t.channel === 'scale' ? 2 : (t.channel === 'rotation' ? 0 : -1));
        if (channel < 0 || !Array.isArray(t.keys) || !t.keys.length) continue;

        const times = [], values = [], step = [], smooth = [];
        for (const k of t.keys) {
          if (!k || !Array.isArray(k.v) || k.v.length !== 3) continue;
          let vx = Number(k.v[0]) || 0, vy = Number(k.v[1]) || 0, vz = Number(k.v[2]) || 0;
          if (channel === 0 && f < 0) { vx = -vx; vy = -vy; }
          if (channel === 1) { vx *= RIG_SCALE * f; vy *= RIG_SCALE * f; vz *= RIG_SCALE; }
          times.push(Number(k.t) || 0);
          values.push(vx, vy, vz);
          step.push(k.i === 'step');
          smooth.push(k.i === 'smooth');
        }
        if (!times.length) continue;
        anim.tracks.push({ bone, channel, times, values, step, smooth });
      }
      if (!anim.tracks.length) continue;
      out.push(anim);
    }
    return out;
  }

  function parseMobRig(json) {
    if (!json || typeof json !== 'object' || !Array.isArray(json.bones) || !json.bones.length) return null;

    const assembly = json.assembly && typeof json.assembly === 'object' ? json.assembly : {};
    const itemModelSpace = assembly.itemModelSpace === undefined ? true : !!assembly.itemModelSpace;
    const f = itemModelSpace ? -1 : 1;

    const rawOffset = rigVec3(assembly, 'offset', [0, 0, 0]);
    const rawRotation = rigVec3(assembly, 'rotation', [0, 0, 0]);
    let assemblyScale = Number(assembly.scale);
    if (!(assemblyScale > 0)) assemblyScale = 1;

    const rig = {
      f,
      itemModelSpace,
      assemblyOffset: [rawOffset[0] * RIG_SCALE * f, rawOffset[1] * RIG_SCALE * f, rawOffset[2] * RIG_SCALE],
      assemblyRotation: f < 0 ? [-rawRotation[0], -rawRotation[1], rawRotation[2]] : rawRotation.slice(),
      assemblyScale,
      center: [0, 0, 0],
      aura: (assembly.aura && typeof assembly.aura === 'object') ? assembly.aura : null,
      bones: [],
      animations: []
    };

    let texW = 16, texH = 16;
    if (Array.isArray(json.texture_size) && json.texture_size.length === 2) {
      if (Number(json.texture_size[0]) > 0) texW = Number(json.texture_size[0]);
      if (Number(json.texture_size[1]) > 0) texH = Number(json.texture_size[1]);
    }

    let mnx = Infinity, mny = Infinity, mnz = Infinity;
    let mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;

    for (let i = 0; i < json.bones.length; i++) {
      const b = json.bones[i];
      if (!b || typeof b !== 'object') return null;
      let parent = Number.isInteger(b.parent) ? b.parent : -1;
      if (parent >= i || parent < -1) parent = -1;

      const pivot = rigVec3(b, 'pivot', [0, 0, 0]);
      const rest = rigVec3(b, 'rotation', [0, 0, 0]);
      const bone = {
        name: typeof b.name === 'string' ? b.name : ('bone' + i),
        parent,
        pivot: [pivot[0] * RIG_SCALE * f, pivot[1] * RIG_SCALE * f, pivot[2] * RIG_SCALE],
        rest: f < 0 ? [-rest[0], -rest[1], rest[2]] : rest.slice(),
        cubes: []
      };

      for (const c of (Array.isArray(b.cubes) ? b.cubes : [])) {
        const cube = rigParseCube(c, f, texW, texH);
        if (!cube) continue;
        bone.cubes.push(cube);
        for (let v = 0; v < 72; v += 3) {
          if (cube.vertices[v] < mnx) mnx = cube.vertices[v];
          if (cube.vertices[v] > mxx) mxx = cube.vertices[v];
          if (cube.vertices[v + 1] < mny) mny = cube.vertices[v + 1];
          if (cube.vertices[v + 1] > mxy) mxy = cube.vertices[v + 1];
          if (cube.vertices[v + 2] < mnz) mnz = cube.vertices[v + 2];
          if (cube.vertices[v + 2] > mxz) mxz = cube.vertices[v + 2];
        }
      }
      rig.bones.push(bone);
    }

    if (mnx <= mxx) {
      rig.center = [(mnx + mxx) / 2, (mny + mxy) / 2, (mnz + mxz) / 2];
    }
    rig.animations = rigParseAnimations(json.animations, rig.bones.length, f);
    return rig;
  }

  function rigMultiply(out, oo, a, ao, b, bo) {
    const tmp = RIG_TMP16;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) sum += a[ao + r * 4 + k] * b[bo + k * 4 + c];
        tmp[r * 4 + c] = sum;
      }
    }
    for (let i = 0; i < 16; i++) out[oo + i] = tmp[i];
  }
  const RIG_TMP16 = new Float32Array(16);

  function rigBuildLocal(out, pivot, rot, pos, scl) {
    const rx = rot[0] * Math.PI / 180, ry = rot[1] * Math.PI / 180, rz = rot[2] * Math.PI / 180;
    const cx = Math.cos(rx), sx = Math.sin(rx);
    const cy = Math.cos(ry), sy = Math.sin(ry);
    const cz = Math.cos(rz), sz = Math.sin(rz);

    let m00 = cz * cy;
    let m01 = cz * sy * sx - sz * cx;
    let m02 = cz * sy * cx + sz * sx;
    let m10 = sz * cy;
    let m11 = sz * sy * sx + cz * cx;
    let m12 = sz * sy * cx - cz * sx;
    let m20 = -sy;
    let m21 = cy * sx;
    let m22 = cy * cx;

    m00 *= scl[0]; m01 *= scl[1]; m02 *= scl[2];
    m10 *= scl[0]; m11 *= scl[1]; m12 *= scl[2];
    m20 *= scl[0]; m21 *= scl[1]; m22 *= scl[2];

    const tx = pivot[0] + pos[0];
    const ty = pivot[1] + pos[1];
    const tz = pivot[2] + pos[2];

    out[0] = m00; out[1] = m01; out[2] = m02;
    out[3] = tx - (m00 * pivot[0] + m01 * pivot[1] + m02 * pivot[2]);
    out[4] = m10; out[5] = m11; out[6] = m12;
    out[7] = ty - (m10 * pivot[0] + m11 * pivot[1] + m12 * pivot[2]);
    out[8] = m20; out[9] = m21; out[10] = m22;
    out[11] = tz - (m20 * pivot[0] + m21 * pivot[1] + m22 * pivot[2]);
    out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
  }

  function catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  }

  function rigSample(track, time, out, additive) {
    const n = track.times.length;
    let i = 0;
    while (i < n - 1 && track.times[i + 1] <= time) i++;

    let vx, vy, vz;
    if (n === 1 || time <= track.times[0]) {
      vx = track.values[0]; vy = track.values[1]; vz = track.values[2];
    } else if (time >= track.times[n - 1]) {
      vx = track.values[(n - 1) * 3];
      vy = track.values[(n - 1) * 3 + 1];
      vz = track.values[(n - 1) * 3 + 2];
    } else {
      const t0 = track.times[i], t1 = track.times[i + 1];
      const span = t1 - t0;
      const k = (span <= 0 || track.step[i]) ? 0 : (time - t0) / span;
      const v = track.values;
      if (k > 0 && track.smooth && (track.smooth[i] || track.smooth[i + 1])) {
        const a = Math.max(0, i - 1) * 3, b = i * 3, c = (i + 1) * 3, d = Math.min(n - 1, i + 2) * 3;
        vx = catmullRom(v[a], v[b], v[c], v[d], k);
        vy = catmullRom(v[a + 1], v[b + 1], v[c + 1], v[d + 1], k);
        vz = catmullRom(v[a + 2], v[b + 2], v[c + 2], v[d + 2], k);
      } else {
        vx = v[i * 3] + (v[(i + 1) * 3] - v[i * 3]) * k;
        vy = v[i * 3 + 1] + (v[(i + 1) * 3 + 1] - v[i * 3 + 1]) * k;
        vz = v[i * 3 + 2] + (v[(i + 1) * 3 + 2] - v[i * 3 + 2]) * k;
      }
    }

    if (additive) { out[0] += vx; out[1] += vy; out[2] += vz; }
    else { out[0] = vx; out[1] = vy; out[2] = vz; }
  }

  function mobRigBoneMatrices(rig, animIndex, timeSec, out) {
    const anim = (animIndex >= 0 && animIndex < rig.animations.length) ? rig.animations[animIndex] : null;
    let time = 0;
    if (anim) {
      if (anim.loop) {
        time = timeSec % anim.length;
        if (time < 0) time += anim.length;
      } else {
        time = Math.min(timeSec, anim.length);
      }
    }

    const local = RIG_LOCAL16;
    const rot = RIG_ROT3, pos = RIG_POS3, scl = RIG_SCL3;

    rigBuildLocal(RIG_ASSEMBLY16, rig.center, rig.assemblyRotation, rig.assemblyOffset,
      [rig.assemblyScale, rig.assemblyScale, rig.assemblyScale]);

    for (let i = 0; i < rig.bones.length; i++) {
      const bone = rig.bones[i];
      rot[0] = bone.rest[0]; rot[1] = bone.rest[1]; rot[2] = bone.rest[2];
      pos[0] = 0; pos[1] = 0; pos[2] = 0;
      scl[0] = 1; scl[1] = 1; scl[2] = 1;

      if (anim) {
        for (const track of anim.tracks) {
          if (track.bone !== i) continue;
          const target = track.channel === 0 ? rot : (track.channel === 1 ? pos : scl);
          rigSample(track, time, target, track.channel === 0);
        }
      }

      rigBuildLocal(local, bone.pivot, rot, pos, scl);
      if (bone.parent >= 0) rigMultiply(out, i * 16, out, bone.parent * 16, local, 0);
      else rigMultiply(out, i * 16, RIG_ASSEMBLY16, 0, local, 0);
    }
  }
  const RIG_LOCAL16 = new Float32Array(16);
  const RIG_ASSEMBLY16 = new Float32Array(16);
  const RIG_ROT3 = new Float32Array(3);
  const RIG_POS3 = new Float32Array(3);
  const RIG_SCL3 = new Float32Array(3);

  function buildMobRigGeometry(rig) {
    const positions = [], uvs = [], indices = [];
    const boneOf = [], srcOf = [];

    for (let b = 0; b < rig.bones.length; b++) {
      for (const cube of rig.bones[b].cubes) {
        for (const faceIndex of cube.present) {
          const base = positions.length / 3;
          for (let k = 0; k < 4; k++) {
            const o = faceIndex * 12 + k * 3;
            positions.push(cube.vertices[o], cube.vertices[o + 1], cube.vertices[o + 2]);
            uvs.push(cube.uvs[faceIndex][k * 2], cube.uvs[faceIndex][k * 2 + 1]);
            boneOf.push(b);
            srcOf.push(cube.vertices[o], cube.vertices[o + 1], cube.vertices[o + 2]);
          }
          indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
      }
    }
    return {
      positions, uvs, indices,
      boneOf: new Uint16Array(boneOf),
      srcOf: new Float32Array(srcOf)
    };
  }

  function fillMobRigPositions(geom, matrices, out) {
    const n = geom.boneOf.length;
    for (let i = 0; i < n; i++) {
      const mo = geom.boneOf[i] * 16;
      const o = i * 3;
      const x = geom.srcOf[o], y = geom.srcOf[o + 1], z = geom.srcOf[o + 2];
      out[o] = matrices[mo] * x + matrices[mo + 1] * y + matrices[mo + 2] * z + matrices[mo + 3];
      out[o + 1] = matrices[mo + 4] * x + matrices[mo + 5] * y + matrices[mo + 6] * z + matrices[mo + 7];
      out[o + 2] = matrices[mo + 8] * x + matrices[mo + 9] * y + matrices[mo + 10] * z + matrices[mo + 11];
    }
  }

  function startMob(canvas, opts) {
    const gl = canvas.getContext('webgl', { alpha: true, antialias: false });
    if (!gl) return () => {};
    opts = opts || {};

    const program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT_SRC));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return () => {};
    gl.useProgram(program);

    const uMVP = gl.getUniformLocation(program, 'uMVP');
    const uTint = gl.getUniformLocation(program, 'uTint');
    const uAlphaCut = gl.getUniformLocation(program, 'uAlphaCut');
    gl.uniform4f(uTint, 1, 1, 1, 1);
    gl.uniform1f(uAlphaCut, 0.05);

    const aPos = gl.getAttribLocation(program, 'aPos');
    const aUV = gl.getAttribLocation(program, 'aUV');
    gl.enableVertexAttribArray(aPos);
    gl.enableVertexAttribArray(aUV);

    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    const whiteTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, whiteTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([255, 255, 255, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    const BOX_FACES = [
      [0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1],
      [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]
    ];

    function boxGeometry(x0, y0, z0, x1, y1, z1) {
      const c = [
        [x0, y0, z0], [x0, y0, z1], [x0, y1, z0], [x0, y1, z1],
        [x1, y0, z0], [x1, y0, z1], [x1, y1, z0], [x1, y1, z1]
      ];
      const positions = [], uvs = [], indices = [];
      for (let f = 0; f < 6; f++) {
        const o = positions.length / 3;
        for (const idx of BOX_FACES[f]) positions.push(c[idx][0], c[idx][1], c[idx][2]);
        uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
        indices.push(o, o + 1, o + 2, o, o + 2, o + 3);
      }
      return { positions, uvs, indices };
    }

    function makeStatic(geom) {
      const posBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geom.positions), gl.STATIC_DRAW);
      const uvBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geom.uvs), gl.STATIC_DRAW);
      const idxBuf = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geom.indices), gl.STATIC_DRAW);
      return { posBuf, uvBuf, idxBuf, count: geom.indices.length };
    }

    function freeStatic(d) {
      if (!d) return;
      gl.deleteBuffer(d.posBuf); gl.deleteBuffer(d.uvBuf); gl.deleteBuffer(d.idxBuf);
    }

    function drawHelper(d, tint) {
      if (!d) return;
      gl.uniform4f(uTint, tint[0], tint[1], tint[2], tint[3]);
      gl.bindTexture(gl.TEXTURE_2D, whiteTex);
      gl.bindBuffer(gl.ARRAY_BUFFER, d.posBuf);
      gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, d.uvBuf);
      gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, d.idxBuf);
      gl.drawElements(gl.TRIANGLES, d.count, gl.UNSIGNED_SHORT, 0);
      gl.uniform4f(uTint, 1, 1, 1, 1);
    }

    const U = 16;

    const ground = makeStatic(boxGeometry(-3 * U, -0.4, -3 * U, 3 * U, 0, 3 * U));
    const PLAYER_HALF = 0.3 * U;
    const PLAYER_HEIGHT = 1.8 * U;
    let reference = null;
    let referenceX = 2.2 * U;
    function rebuildReference(x) {
      freeStatic(reference);
      referenceX = x;
      reference = makeStatic(boxGeometry(
        x - PLAYER_HALF, 0, -PLAYER_HALF, x + PLAYER_HALF, PLAYER_HEIGHT, PLAYER_HALF));
    }
    rebuildReference(referenceX);

    let hitboxDrawable = null;
    function rebuildHitbox(hitbox) {
      freeStatic(hitboxDrawable);
      hitboxDrawable = null;
      if (!hitbox || !(hitbox.width > 0) || !(hitbox.height > 0)) return;
      const hw = (hitbox.width / 2) * U;
      hitboxDrawable = makeStatic(boxGeometry(-hw, 0, -hw, hw, hitbox.height * U, hw));
    }

    let parts = [];
    let built = null;
    let modelHeight = 2 * U;

    let rig = null;
    let rigGeom = null;
    let rigDrawable = null;
    let rigMatrices = null;
    let rigScratch = null;
    let rigAnim = -1;
    let rigPlaying = false;
    let rigStartMs = 0;
    let rigPausedAt = 0;
    let flatBounds = null;
    let rigBounds = null;
    let rigAura = null;
    const EMPTY_PARTS = [];
    let sceneMin = [0, 0, 0];
    let sceneMax = [0, 2 * U, 0];

    function freeParts() {
      for (const d of parts) {
        gl.deleteBuffer(d.posBuf); gl.deleteBuffer(d.uvBuf); gl.deleteBuffer(d.idxBuf);
        if (d.ownsTexture) gl.deleteTexture(d.tex);
      }
      parts = [];
    }

    function buildModel(model, img) {
      freeParts();
      built = null;
      if (!model || !img) return;
      try {
        built = buildCosmeticParts(model, 'head', { standalone: true, keepOffset: true });
      } catch (e) {
        console.warn('[SkinPreview] Mob-geometria hiba:', e);
        return;
      }
      let sharedTex = null;
      let mn = [Infinity, Infinity, Infinity];
      let mx = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < built.parts.length; i++) {
        const part = built.parts[i];
        if (!part.indices.length) continue;
        const d = createDrawable(gl, part, img, sharedTex);
        if (!sharedTex) sharedTex = d.tex;
        d.built = built;
        d.partIndex = i;
        d.wave = !!(part.wave || built.assemblyWave);
        if (d.wave) {
          d.scratch = new Float32Array(part.positions.length);
          gl.bindBuffer(gl.ARRAY_BUFFER, d.posBuf);
          gl.bufferData(gl.ARRAY_BUFFER, d.scratch, gl.DYNAMIC_DRAW);
        }
        parts.push(d);
        const positions = d.wave
          ? (waveElementPositions(built, i, 0, d.scratch), d.scratch)
          : part.positions;
        const m = cosmeticPartMatrix(built, i, 0, d.wave);
        for (let v = 0; v < positions.length; v += 3) {
          const px = positions[v], py = positions[v + 1], pz = positions[v + 2];
          const wx = m[0] * px + m[4] * py + m[8] * pz + m[12];
          const wy = m[1] * px + m[5] * py + m[9] * pz + m[13];
          const wz = m[2] * px + m[6] * py + m[10] * pz + m[14];
          if (wx < mn[0]) mn[0] = wx; if (wx > mx[0]) mx[0] = wx;
          if (wy < mn[1]) mn[1] = wy; if (wy > mx[1]) mx[1] = wy;
          if (wz < mn[2]) mn[2] = wz; if (wz > mx[2]) mx[2] = wz;
        }
      }
      if (Number.isFinite(mn[0])) {
        flatBounds = { min: mn, max: mx };
        if (rigAnim < 0) applyBounds(flatBounds);
      }
    }

    function applyBounds(b) {
      if (!b) return;
      sceneMin = b.min;
      sceneMax = b.max;
      modelHeight = Math.max(b.max[1], 1);
      rebuildReference(b.max[0] + 0.25 * U + PLAYER_HALF);
    }

    function freeRigDrawable() {
      if (!rigDrawable) return;
      gl.deleteBuffer(rigDrawable.posBuf);
      gl.deleteBuffer(rigDrawable.uvBuf);
      gl.deleteBuffer(rigDrawable.idxBuf);
      if (rigDrawable.ownsTexture) gl.deleteTexture(rigDrawable.tex);
      rigDrawable = null;
    }

    function buildRig(rawRig, img) {
      freeRigDrawable();
      rig = null; rigGeom = null; rigMatrices = null; rigScratch = null; rigBounds = null;
      if (!rawRig || !img) return;
      try {
        rig = parseMobRig(rawRig);
      } catch (e) {
        console.warn('[SkinPreview] Csontváz-hiba:', e);
        rig = null;
      }
      if (!rig) return;

      rigGeom = buildMobRigGeometry(rig);
      if (!rigGeom.indices.length) { rig = null; rigGeom = null; return; }
      rigMatrices = new Float32Array(rig.bones.length * 16);
      rigScratch = new Float32Array(rigGeom.positions.length);

      rigDrawable = createDrawable(gl, rigGeom, img, null);
      gl.bindBuffer(gl.ARRAY_BUFFER, rigDrawable.posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, rigScratch, gl.DYNAMIC_DRAW);

      mobRigBoneMatrices(rig, -1, 0, rigMatrices);
      fillMobRigPositions(rigGeom, rigMatrices, rigScratch);
      const mn = [Infinity, Infinity, Infinity];
      const mx = [-Infinity, -Infinity, -Infinity];
      for (let v = 0; v < rigScratch.length; v += 3) {
        const wx = rigScratch[v] * U, wy = -rigScratch[v + 1] * U, wz = -rigScratch[v + 2] * U;
        if (wx < mn[0]) mn[0] = wx; if (wx > mx[0]) mx[0] = wx;
        if (wy < mn[1]) mn[1] = wy; if (wy > mx[1]) mx[1] = wy;
        if (wz < mn[2]) mn[2] = wz; if (wz > mx[2]) mx[2] = wz;
      }
      if (Number.isFinite(mn[0])) rigBounds = { min: mn, max: mx };

      rigAura = null;
      if (rig.aura) {
        let amn = [Infinity, Infinity, Infinity];
        let amx = [-Infinity, -Infinity, -Infinity];
        for (let v = 0; v < rigScratch.length; v += 3) {
          for (let k = 0; k < 3; k++) {
            const val = rigScratch[v + k];
            if (val < amn[k]) amn[k] = val;
            if (val > amx[k]) amx[k] = val;
          }
        }
        if (Number.isFinite(amn[0])) {
          const uvs = [];
          for (const bone of rig.bones) {
            for (const cube of bone.cubes) {
              for (const fi of cube.present) {
                if (uvs.length >= 48) break;
                const uv = cube.uvs[fi];
                uvs.push([(uv[0] + uv[4]) * 0.5, (uv[1] + uv[5]) * 0.5]);
              }
            }
          }
          const f = rig.f;
          if (uvs.length) {
            rigAura = {
              aura: rig.aura,
              center: [
                ((amn[0] + amx[0]) * 0.5) / (RIG_SCALE * f),
                ((amn[1] + amx[1]) * 0.5) / (RIG_SCALE * f),
                ((amn[2] + amx[2]) * 0.5) / RIG_SCALE
              ],
              half: [
                Math.abs((amx[0] - amn[0]) * 0.5 / (RIG_SCALE * f)) + 1,
                Math.abs((amx[1] - amn[1]) * 0.5 / (RIG_SCALE * f)) + 1,
                Math.abs((amx[2] - amn[2]) * 0.5 / RIG_SCALE) + 1
              ],
              uvs,
              matrix: scaleMat3(f, -f, -1)
            };
          }
        }
      }
    }

    const AURA_FACES = [
      [0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1],
      [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]
    ];
    const auraVerts = new Float32Array(72);
    const auraUVsBuf = new Float32Array(48);
    const auraIdx = new Uint16Array(36);
    for (let f = 0; f < 6; f++) {
      const o = f * 4;
      auraIdx.set([o, o + 1, o + 2, o, o + 2, o + 3], f * 6);
    }
    const auraPosBuf = gl.createBuffer();
    const auraUvBuf = gl.createBuffer();
    const auraIdxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, auraIdxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, auraIdx, gl.STATIC_DRAW);

    function drawMobAura(mvp, timeSec, source, tex) {
      if (!source || !tex) return;
      const spec = resolveAura(source.aura, auraPresets);
      if (!spec || !source.uvs || !source.uvs.length) return;
      let count = Math.round(spec.rate * spec.life);
      if (count <= 0) return;
      if (count > AURA_MAX_PARTICLES) count = AURA_MAX_PARTICLES;

      gl.uniformMatrix4fv(uMVP, false, multiply(mvp, source.matrix));
      gl.uniform1f(uAlphaCut, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, auraIdxBuf);
      gl.bindTexture(gl.TEXTURE_2D, tex);

      for (let i = 0; i < count; i++) {
        const pt = auraParticle(spec, i, count, timeSec, source.center, source.half);
        if (!pt) continue;
        const sz = pt.size * 0.5;
        const cs = Math.cos(pt.spin * 2 * Math.PI);
        const sn = Math.sin(pt.spin * 2 * Math.PI);
        const xs = [], ys = [], zs = [];
        for (let sx = -1; sx <= 1; sx += 2) {
          for (let sy = -1; sy <= 1; sy += 2) {
            for (let sz2 = -1; sz2 <= 1; sz2 += 2) {
              const lx = sx * sz, lz = sz2 * sz;
              xs.push(pt.x + lx * cs - lz * sn);
              ys.push(pt.y + sy * sz);
              zs.push(pt.z + lx * sn + lz * cs);
            }
          }
        }
        const uv = source.uvs[Math.min(source.uvs.length - 1,
          Math.floor(pt.faceSeed * source.uvs.length))];
        for (let fi = 0; fi < 6; fi++) {
          const face = AURA_FACES[fi];
          for (let k = 0; k < 4; k++) {
            const c = face[k];
            const o = (fi * 4 + k) * 3;
            auraVerts[o] = xs[c];
            auraVerts[o + 1] = ys[c];
            auraVerts[o + 2] = zs[c];
            const uo = (fi * 4 + k) * 2;
            auraUVsBuf[uo] = uv[0];
            auraUVsBuf[uo + 1] = uv[1];
          }
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, auraPosBuf);
        gl.bufferData(gl.ARRAY_BUFFER, auraVerts, gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, auraUvBuf);
        gl.bufferData(gl.ARRAY_BUFFER, auraUVsBuf, gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);
        gl.uniform4f(uTint, pt.r, pt.g, pt.b, pt.a);
        gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
      }

      gl.uniform4f(uTint, 1, 1, 1, 1);
      gl.uniform1f(uAlphaCut, 0.05);
    }

    buildModel(opts.model, opts.img);
    buildRig(opts.rig, opts.img);
    rebuildHitbox(opts.hitbox);

    let angle = 0.6, pitch = -0.15;
    const CAM_NEAR = 30, CAM_FAR = 320;
    let camDistance = 120;
    let dragging = false, lastX = 0, lastY = 0;

    function sceneCenterX() { return (sceneMin[0] + sceneMax[0]) / 2; }
    function sceneCenterZ() { return (sceneMin[2] + sceneMax[2]) / 2; }

    function fitCamera() {
      const halfHeight = Math.max(modelHeight, 1.8 * U) / 2;
      const cx = sceneCenterX(), cz = sceneCenterZ();
      const halfWidth = Math.max(
        Math.abs(sceneMax[0] - cx), Math.abs(cx - sceneMin[0]),
        Math.abs(referenceX + PLAYER_HALF - cx),
        Math.abs(sceneMax[2] - cz), Math.abs(cz - sceneMin[2]),
        1.5 * U);
      const canvasAspect = (canvas.width || 280) / (canvas.height || 340);
      const tan = Math.tan(Math.PI / 10);
      const byHeight = halfHeight / tan;
      const byWidth = halfWidth / (tan * canvasAspect);
      camDistance = Math.max(CAM_NEAR, Math.min(CAM_FAR, Math.max(byHeight, byWidth) * 1.3));
    }
    fitCamera();

    function onDown(e) { dragging = true; lastX = e.clientX; lastY = e.clientY; }
    function onMove(e) {
      if (!dragging) return;
      angle += (e.clientX - lastX) * 0.01;
      pitch = Math.max(-1.3, Math.min(1.3, pitch + (e.clientY - lastY) * 0.008));
      lastX = e.clientX; lastY = e.clientY;
    }
    function onUp() { dragging = false; }
    function onWheel(e) {
      e.preventDefault();
      camDistance = Math.max(CAM_NEAR, Math.min(CAM_FAR, camDistance * (e.deltaY > 0 ? 1.12 : 1 / 1.12)));
    }
    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    let stopped = false;
    function frame() {
      if (stopped) return;
      if (!dragging) angle += 0.006;

      const w = canvas.width, h = canvas.height;
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const proj = perspective(Math.PI / 5, w / h, 1, 600);
      const focus = Math.max(modelHeight, 1.8 * U) / 2;
      const view = multiply(translate(0, -focus, -camDistance), rotateX(pitch));
      const scene = multiply(rotateY(angle), translate(-sceneCenterX(), 0, -sceneCenterZ()));
      const mvp = multiply(proj, multiply(view, scene));

      gl.uniformMatrix4fv(uMVP, false, mvp);
      gl.uniform1f(uAlphaCut, 0);
      drawHelper(ground, [1, 1, 1, 0.07]);
      if (opts.reference !== false) drawHelper(reference, [0.35, 0.75, 1, 0.22]);
      gl.uniform1f(uAlphaCut, 0.05);

      const animTime = (performance.now() % 3600000) / 1000;

      const rigMode = !!(rigDrawable && rigAnim >= 0);
      if (rigMode) {
        const t = rigPlaying
          ? (performance.now() - rigStartMs) / 1000
          : rigPausedAt;
        mobRigBoneMatrices(rig, rigAnim, t, rigMatrices);
        fillMobRigPositions(rigGeom, rigMatrices, rigScratch);
        gl.bindBuffer(gl.ARRAY_BUFFER, rigDrawable.posBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, rigScratch);

        gl.uniformMatrix4fv(uMVP, false, multiply(mvp, scaleMat3(U, -U, -U)));
        gl.bindBuffer(gl.ARRAY_BUFFER, rigDrawable.posBuf);
        gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, rigDrawable.uvBuf);
        gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, rigDrawable.idxBuf);
        gl.bindTexture(gl.TEXTURE_2D, rigDrawable.tex);
        gl.drawElements(gl.TRIANGLES, rigDrawable.indexCount, gl.UNSIGNED_SHORT, 0);
      }

      for (const c of (rigMode ? EMPTY_PARTS : parts)) {
        if (c.wave) {
          waveElementPositions(c.built, c.partIndex, animTime, c.scratch);
          gl.bindBuffer(gl.ARRAY_BUFFER, c.posBuf);
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, c.scratch);
        }
        gl.uniformMatrix4fv(uMVP, false,
          multiply(mvp, cosmeticPartMatrix(c.built, c.partIndex, animTime, c.wave)));
        gl.bindBuffer(gl.ARRAY_BUFFER, c.posBuf);
        gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, c.uvBuf);
        gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, c.idxBuf);
        gl.bindTexture(gl.TEXTURE_2D, c.tex);
        gl.drawElements(gl.TRIANGLES, c.indexCount, gl.UNSIGNED_SHORT, 0);
      }

      if (rigMode) {
        drawMobAura(mvp, animTime, rigAura, rigDrawable.tex);
      } else if (built && built.aura && parts.length) {
        drawMobAura(mvp, animTime, {
          aura: built.aura,
          center: built.auraCenter,
          half: built.auraHalfExtent,
          uvs: built.auraUVs,
          matrix: cosmeticAuraMatrix(built, animTime)
        }, parts[0].tex);
      }

      if (hitboxDrawable) {
        gl.uniformMatrix4fv(uMVP, false, mvp);
        gl.depthMask(false);
        gl.uniform1f(uAlphaCut, 0);
        drawHelper(hitboxDrawable, [1, 0.78, 0.18, 0.16]);
        gl.uniform1f(uAlphaCut, 0.05);
        gl.depthMask(true);
      }

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    const stop = () => {
      stopped = true;
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      freeParts();
      freeRigDrawable();
      gl.deleteBuffer(auraPosBuf);
      gl.deleteBuffer(auraUvBuf);
      gl.deleteBuffer(auraIdxBuf);
      freeStatic(ground);
      freeStatic(reference);
      reference = null;
      freeStatic(hitboxDrawable);
      gl.deleteTexture(whiteTex);
      gl.deleteProgram(program);
    };

    stop.update = (next) => {
      if (!next) return;
      if (Object.prototype.hasOwnProperty.call(next, 'model')
        || Object.prototype.hasOwnProperty.call(next, 'img')) {
        opts.model = Object.prototype.hasOwnProperty.call(next, 'model') ? next.model : opts.model;
        opts.img = Object.prototype.hasOwnProperty.call(next, 'img') ? next.img : opts.img;
        buildModel(opts.model, opts.img);
        fitCamera();
      }
      if (Object.prototype.hasOwnProperty.call(next, 'hitbox')) rebuildHitbox(next.hitbox);
      if (Object.prototype.hasOwnProperty.call(next, 'rig')) {
        buildRig(next.rig, Object.prototype.hasOwnProperty.call(next, 'img') ? next.img : opts.img);
        if (rigAnim >= 0 && (!rig || rigAnim >= rig.animations.length)) stop.stopAnimation();
        else if (rigAnim >= 0) { applyBounds(rigBounds); fitCamera(); }
      }
    };

    stop.playAnimation = (index) => {
      if (!rig || !(index >= 0) || index >= rig.animations.length) return false;
      rigAnim = index;
      rigPlaying = true;
      rigStartMs = performance.now();
      rigPausedAt = 0;
      applyBounds(rigBounds || flatBounds);
      fitCamera();
      return true;
    };
    stop.pauseAnimation = () => {
      if (rigAnim < 0 || !rigPlaying) return;
      rigPausedAt = (performance.now() - rigStartMs) / 1000;
      rigPlaying = false;
    };
    stop.resumeAnimation = () => {
      if (rigAnim < 0 || rigPlaying) return;
      rigStartMs = performance.now() - rigPausedAt * 1000;
      rigPlaying = true;
    };
    stop.stopAnimation = () => {
      rigAnim = -1;
      rigPlaying = false;
      rigPausedAt = 0;
      applyBounds(flatBounds);
      fitCamera();
    };
    stop.currentAnimation = () => rigAnim;
    stop.hasRig = () => !!rig;
    stop.rigAnimationNames = () => (rig ? rig.animations.map((a) => a.name) : []);
    stop.resetView = () => { angle = 0.6; pitch = -0.15; fitCamera(); };
    stop.modelHeightBlocks = () => modelHeight / U;

    return stop;
  }

  function renderCosmeticThumbnail(model, img, size) {
    size = size || 160;
    const gl = ensureSharedContext(size);
    if (!gl) return null;

    let geometry;
    try {
      geometry = buildCosmeticGeometry(model, 'head', { standalone: true });
    } catch (e) {
      return null;
    }
    if (!geometry.indices.length) return null;

    const d = createDrawable(gl, geometry, img);
    const bounds = geometryBounds(geometry);
    const fit = 22 / bounds.size;

    gl.viewport(0, 0, size, size);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const proj = perspective(Math.PI / 5, 1, 1, 200);
    const view = multiply(translate(0, 0, -60), rotateX(-0.18));
    const centering = translate(-bounds.center[0], -bounds.center[1], -bounds.center[2]);
    const modelMat = multiply(rotateY(0.55), multiply(scaleMat(fit), centering));
    gl.uniformMatrix4fv(sharedAttribs.mvp, false, multiply(proj, multiply(view, modelMat)));

    gl.bindBuffer(gl.ARRAY_BUFFER, d.posBuf);
    gl.vertexAttribPointer(sharedAttribs.pos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, d.uvBuf);
    gl.vertexAttribPointer(sharedAttribs.uv, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, d.idxBuf);
    gl.bindTexture(gl.TEXTURE_2D, d.tex);
    gl.drawElements(gl.TRIANGLES, d.indexCount, gl.UNSIGNED_SHORT, 0);

    const url = sharedCanvas.toDataURL('image/png');

    gl.deleteBuffer(d.posBuf); gl.deleteBuffer(d.uvBuf); gl.deleteBuffer(d.idxBuf);
    gl.deleteTexture(d.tex);

    return url;
  }

  let steveImagePromise = null;
  function getSteveImage() {
    if (steveImagePromise) return steveImagePromise;
    steveImagePromise = new Promise((resolve) => {
      const asset = new Image();
      asset.onload = () => resolve(asset);
      asset.onerror = () => resolve(generatedSteveImage());
      asset.src = 'assets/default-skin.png?v=20260924';
    });
    return steveImagePromise;
  }

  function generatedSteveImage() {
    return new Promise((resolve) => {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 64;
      const g = c.getContext('2d');
      g.clearRect(0, 0, 64, 64);

      const SKIN = '#b0805a', SKIN_D = '#a0714e', HAIR = '#3f2a19', HAIR_D = '#33200f';
      const EYE_W = '#ffffff', EYE_B = '#3b5dc9', MOUTH = '#7b4f36';
      const SHIRT = '#3aa0a8', SHIRT_D = '#2c8189', PANTS = '#3b3f8f', SHOE = '#4a3a2a';

      function r(x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }

      r(0, 8, 32, 8, SKIN_D);
      r(8, 8, 8, 8, SKIN);
      r(0, 0, 32, 8, HAIR_D);
      r(8, 0, 8, 8, HAIR);
      r(8, 8, 8, 3, HAIR);
      r(0, 8, 8, 3, HAIR_D); r(16, 8, 8, 3, HAIR_D); r(24, 8, 8, 3, HAIR_D);
      r(9, 12, 2, 2, EYE_W); r(10, 12, 1, 2, EYE_B);
      r(13, 12, 2, 2, EYE_W); r(13, 12, 1, 2, EYE_B);
      r(11, 15, 2, 1, MOUTH);

      r(16, 20, 24, 12, SHIRT_D);
      r(20, 20, 8, 12, SHIRT);
      r(20, 16, 8, 4, SHIRT_D);

      r(40, 20, 16, 12, SKIN_D);
      r(44, 20, 4, 12, SKIN);
      r(44, 16, 4, 4, SHIRT_D);
      r(40, 20, 16, 4, SHIRT_D);

      r(32, 52, 16, 12, SKIN_D);
      r(36, 52, 4, 12, SKIN);
      r(36, 48, 4, 4, SHIRT_D);
      r(32, 52, 16, 4, SHIRT_D);

      r(0, 20, 16, 12, PANTS);
      r(0, 28, 16, 4, SHOE);
      r(16, 52, 16, 12, PANTS);
      r(16, 60, 16, 4, SHOE);

      const img = new Image();
      img.onload = () => resolve(img);
      img.src = c.toDataURL('image/png');
    });
  }

  return {
    start,
    startCosmetic,
    startMob,
    setAuraPresets,
    buildCosmeticGeometry,
    buildCosmeticParts,
    parseMobRig,
    buildMobRigGeometry,
    mobRigBoneMatrices,
    fillMobRigPositions,
    cosmeticPartMatrix,
    waveElementPositions,
    animAlongAxis,
    renderCosmeticThumbnail,
    getSteveImage,
    COSMETIC_PIVOTS
  };
})();
