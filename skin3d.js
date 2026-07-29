// Minimális, saját WebGL-alapú Minecraft-skin 3D előnézet - külső könyvtár
// nélkül (a CSP script-src 'self'-je amúgy sem engedne CDN-es three.js-t).
// Az alap réteget ÉS a második (overlay) réteget is rajzolja - kalap, zakó,
// ujjak, nadrág -, az overlay dobozok kicsit nagyobbra méretezve (lásd PAD),
// hogy ne z-fighteljenek az alap réteggel ott, ahol a textúra átlátszatlan.
//
// ÚJ (a felhasználó kérésére): ha van feltöltött köpenye a játékosnak, azt a
// SAJÁT, KÜLÖN textúrájával (a köpeny sose ugyanaz a kép, mint a skin) egy
// MÁSODIK geometriaként/draw call-ként rajzoljuk ki, UGYANAZZAL a forgó
// MVP-mátrixszal, hogy a testtel együtt forogjon - nincs többé külön, lapos
// 2D köpeny-előnézet, a köpeny MINDIG a skin 3D-modelljén jelenik meg (vagy
// sehol, ha nincs feltöltve). A fragment shader alpha-discard-ja (lásd
// FRAG_SRC) a köpenyre is vonatkozik, tehát egy átlátszó pixel a köpeny-
// textúrában itt is átlátszó marad - UGYANAZ az elv, mint amit a SolarClient
// (ld. MixinCapeFeatureRenderer.java, RenderLayer.getEntityCutout()) az
// éles, in-game renderben is használ.

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
    void main() {
      vec4 c = texture2D(uTex, vUV);
      if (c.a < 0.05) discard;
      gl_FragColor = c;
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

  // Egy doboz (fej/törzs/kar/láb) UV-koordinátái a szabványos Minecraft
  // skin-elrendezés szerint (egy UV-origóból az összes lap levezethető).
  function boxUvFaces(u, v, w, h, d) {
    return {
      top:    [u + d, v, w, d],
      bottom: [u + d + w, v, w, d],
      // JAVÍTVA: a "right"/"left" UV-régiók fel voltak cserélve a geometriával -
      // a textúra "right" (a karakter TÉNYLEGES jobb oldala) a +X (nézőnek jobbra
      // eső) dobozlapra került, holott szemből nézve a karakter jobb oldala a
      // néző BAL oldalán látszik (ugyanaz a szabály, amit a kar/láb elhelyezése
      // már eddig is helyesen követett - ld. buildGeometry "jobb kar" megjegyzése).
      // Emiatt a fej mindkét oldala (haj/fül-mintázat) tükrözve jelent meg.
      right:  [u + d + w, v + d, d, h],
      front:  [u + d, v + d, w, h],
      left:   [u, v + d, d, h],
      back:   [u + d + w + d, v + d, w, h]
    };
  }

  // A "pad" a geometria méretét (a doboz tényleges kirajzolt élhosszát) növeli
  // meg egy kicsit, DE a textúra-UV mintavételezés az EREDETI (nem-paddelt)
  // w/h/d alapján történik - enélkül a nagyobb doboz a textúrán is nagyobb,
  // szomszédos régiót mintázna, ami rossz/csúszó textúrázást adna.
  // ÚJ: "uvScale" - HD (64-nél szélesebb) skineknél a textúra-régiók (UV-
  // origó ÉS a lap-méretek is) ennyiszer nagyobbak PIXELBEN, mint a
  // "sztenderd" 64-alapú elrendezésben (2 egy 128 széles HD skinnél, stb.) -
  // a 3D geometria (w/h/d világ-egységben) ETTŐL FÜGGETLENÜL változatlan
  // marad, hiszen a modell alakja nem nő attól, hogy a skin-kép felbontása
  // nagyobb. Enélkül egy HD skinnél a UV-régió mérete (w/h/d) nem lett
  // felskálázva a nagyobb texW/texH-hoz képest, ezért a fej/test/kar/láb
  // mindegyike csak a textúra bal-felső NEGYEDÉT mintázta volna (rossz,
  // "összecsúszott" előnézetet adva).
  function addBox(positions, uvs, indices, cx, cy, cz, w, h, d, uvOrigin, texW, texH, pad = 0, uvScale = 1) {
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
      const [u, v, fw, fh] = faces[name];
      // JAVÍTVA (2. kör): a puszta vízszintes tükrözés csak részben javította az
      // állnál (front-bottom él) látszó hibát - a "bottom" lap valójában 180
      // fokkal van elforgatva a textúrán a többi laphoz képest (mindkét
      // tengelyen tükrözve), nem csak vízszintesen.
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
    // A "modern" (64 magas) formátumban a bal kar/láb KÜLÖN UV-régiót kap a
    // jobbtól, és van teljes overlay (zakó/ujjak/nadrág) réteg is; a régi 64x32
    // formátumban a bal oldal a jobb oldal TÜKRE, és csak a fej kap kalap-overlayt.
    // ÚJ: HD skin (64-nél szélesebb kép) esetén a valódi UV-régiók ennyi-
    // szeresei a sztenderd 64-alapú elrendezésnek - ld. addBox uvScale
    // paraméterének megjegyzését.
    const uvScale = texW / 64;
    // "modern" (64x64-szerű, teljes overlay-réteggel) vs "legacy" (64x32-szerű,
    // csak fej-overlayjel) - a HD-arányos ellenőrzés (texH > texW/2, nem a
    // korábbi, csak a sztenderd méretre helyes "texH >= 64") ugyanígy
    // megkülönbözteti a kettőt bármilyen felbontásban.
    const modern = texH > texW / 2;
    const PAD = 0.4;

    // Alap réteg
    addBox(positions, uvs, indices, 0, 10, 0, 8, 8, 8, [0, 0], texW, texH, 0, uvScale); // fej
    addBox(positions, uvs, indices, 0, 0, 0, 8, 12, 4, [16, 16], texW, texH, 0, uvScale); // törzs
    addBox(positions, uvs, indices, -(4 + armW / 2), 0, 0, armW, 12, 4, [40, 16], texW, texH, 0, uvScale); // jobb kar
    // JAVÍTVA: korábban itt is [40,16]-ot (a jobb kar UV-ját) használtuk, azaz a
    // bal kart a jobb kar textúrájával tükrözve rajzoltuk ki - modern formátumban
    // a bal karnak saját, külön UV-régiója van ([32,48]).
    addBox(positions, uvs, indices, (4 + armW / 2), 0, 0, armW, 12, 4, modern ? [32, 48] : [40, 16], texW, texH, 0, uvScale); // bal kar
    addBox(positions, uvs, indices, -2, -12, 0, 4, 12, 4, [0, 16], texW, texH, 0, uvScale); // jobb láb
    // JAVÍTVA: ugyanaz a hiba, mint a karnál - a bal lábnak modern formátumban
    // saját UV-régiója van ([16,48]), nem a jobb láb tükrözése.
    addBox(positions, uvs, indices, 2, -12, 0, 4, 12, 4, modern ? [16, 48] : [0, 16], texW, texH, 0, uvScale); // bal láb

    // Overlay réteg (kalap/zakó/ujjak/nadrág) - a base-nél kicsit nagyobb (PAD)
    // dobozok, hogy ne z-fighteljenek, és csak ott látszódjanak, ahol a textúra
    // nem átlátszó (lásd a fragment shader alpha-discard-ját).
    addBox(positions, uvs, indices, 0, 10, 0, 8, 8, 8, [32, 0], texW, texH, PAD, uvScale); // fej overlay (kalap) - mindkét formátumban létezik
    if (modern) {
      addBox(positions, uvs, indices, 0, 0, 0, 8, 12, 4, [16, 32], texW, texH, PAD, uvScale); // törzs overlay (zakó)
      addBox(positions, uvs, indices, -(4 + armW / 2), 0, 0, armW, 12, 4, [40, 32], texW, texH, PAD, uvScale); // jobb kar overlay
      addBox(positions, uvs, indices, (4 + armW / 2), 0, 0, armW, 12, 4, [48, 48], texW, texH, PAD, uvScale); // bal kar overlay
      addBox(positions, uvs, indices, -2, -12, 0, 4, 12, 4, [0, 32], texW, texH, PAD, uvScale); // jobb láb overlay
      addBox(positions, uvs, indices, 2, -12, 0, 4, 12, 4, [0, 48], texW, texH, PAD, uvScale); // bal láb overlay
    }
    return { positions, uvs, indices };
  }

  // A köpeny geometriája - EGYETLEN, vékony (1 mély) doboz, a törzs MÖGÖTT,
  // a vállaktól kicsit lejjebb-combközépig lógva, a vanilla Minecraft
  // PlayerEntityModel "cloak" ModelPart-jának méretarányait követve (10 széles,
  // 16 magas, 1 mély - decompilálással igazolt, ld. MixinCapeFeatureRenderer.java
  // megjegyzését). A w/h/d ÉRTÉKEKNEK pontosan ezeknek kell maradniuk (nem csak
  // a vizuális méretnek), mert az addBox ugyanezekből a méretekből vezeti le a
  // köpeny-textúra UV-régióinak MÉRETÉT is - a sztenderd köpeny-sablon (0,0
  // UV-origóból) pontosan egy 10x16x1-es doboz szabványos "kicsomagolását"
  // követi, ugyanúgy, mint bármelyik testrész.
  function buildCapeGeometry(texW, texH) {
    const positions = [], uvs = [], indices = [];
    const uvScale = texW / 64;
    addBox(positions, uvs, indices, 0, -2, -2.5, 10, 16, 1, [0, 0], texW, texH, 0, uvScale);
    return { positions, uvs, indices };
  }

  // ── Minimális 4x4 mátrix segédek (perspektíva + forgatás) ──
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

  // Egy geometria (positions/uvs/indices) feltöltése GL-pufferekbe + egy
  // textúra létrehozása egy Image-ből - a testhez ÉS a köpenyhez is
  // ugyanezzel a segédfüggvénnyel (csak más geometria/kép a bemenete).
  function createDrawable(gl, geometry, img) {
    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.positions), gl.STATIC_DRAW);

    const uvBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.uvs), gl.STATIC_DRAW);

    const idxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geometry.indices), gl.STATIC_DRAW);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    return { posBuf, uvBuf, idxBuf, tex, indexCount: geometry.indices.length };
  }

  // Egy adott canvason indít (vagy újraindít) egy forgó 3D előnézetet a
  // megadott kép (skin texture) alapján - ÚJ: opcionálisan egy KÜLÖN köpeny-
  // képpel is (capeImg), ami a testtel EGYÜTT, ugyanazzal a forgó mátrixszal
  // rajzolódik ki egy második draw call-lal. Visszaad egy leállító függvényt.
  function start(canvas, img, slim, capeImg) {
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
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE); // egyszerűbb, mint a lap-sorrendeket pontosan kiszámolni
    gl.clearColor(0, 0, 0, 0);

    let angle = 0.6;
    let dragging = false, lastX = 0, pitch = -0.15;

    function onDown(e) { dragging = true; lastX = e.clientX; }
    function onMove(e) {
      if (!dragging) return;
      angle += (e.clientX - lastX) * 0.01;
      lastX = e.clientX;
    }
    function onUp() { dragging = false; }
    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    let stopped = false;
    function frame() {
      if (stopped) return;
      if (!dragging) angle += 0.006;

      const w = canvas.width, h = canvas.height;
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const proj = perspective(Math.PI / 5, w / h, 1, 100);
      const view = multiply(translate(0, -2, -46), rotateX(pitch));
      const model = rotateY(angle);
      const mvp = multiply(proj, multiply(view, model));
      gl.uniformMatrix4fv(uMVP, false, mvp);
      drawDrawable(body);
      if (cape) drawDrawable(cape);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    return () => {
      stopped = true;
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      // JAVÍTVA: a frame() leállítása (stopped=true) MEGÁLLÍTJA az újrarajzolást,
      // de az UTOLJÁRA kirajzolt kép a WebGL vászon pufferében marad, amíg valami
      // ténylegesen ki nem törli - a hívó oldali "canvas.width = canvas.width"
      // trükk erre a célra NEM megbízható (Chromium bizonyos esetekben nem
      // veszi észre/hajtja végre a puffer-resetet, ha az érték változatlan
      // marad), ezért itt, KÖZVETLENÜL a WebGL kontextuson töröljük a tartalmat,
      // mielőtt visszaadnánk az irányítást - így a visszaállítás/fiókváltás után
      // sosem ragadhat ott a régi skin képe.
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    };
  }

  return { start };
})();
