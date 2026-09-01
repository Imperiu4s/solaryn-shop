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
    // JAVÍTVA: a doboz-kicsomagolás "front" UV-régiója (1,1-11,17) a doboz
    // BELSŐ, a törzshöz simuló lapjára esne (a köpeny hátrébb, -Z felé lóg,
    // tehát a törzs felőli lap van elöl a nevezéktan szerint), miközben a
    // NÉZŐ felé (a karakter háta felől) néző, ténylegesen látható lap a
    // "back" nevű - ez pont fordítva van, mint amit a köpeny-készítők
    // (és a valódi Minecraft-köpenyek) várnak: a tényleges mintázat a
    // sablon (1,1-11,17) régiójában van, ami emiatt sose látszott (helyette
    // az általában üres/sima (12,1-22,17) régió jelent meg minden köpenyen).
    // Élesben (szinkron rAF-fel, kézi kamera-forgatással) igazolt teszttel:
    // 180°-os forgatás után (a köpeny látható oldalát nézve) a "back" UV
    // jelent meg, nem a "front" - ezért itt a kettőt felcseréljük.
    addBox(positions, uvs, indices, 0, -2, -2.5, 10, 16, 1, [0, 0], texW, texH, 0, uvScale, { front: 'back', back: 'front' });
    return { positions, uvs, indices };
  }

  // ══════════════════════════════════════════════════════════════════════
  // KOZMETIKAI KIEGÉSZÍTŐK (ld. SolarBackend src/cosmetics.js)
  // ══════════════════════════════════════════════════════════════════════
  // A kiegészítő - a testrészekkel ELLENTÉTBEN - nem a szabványos skin-doboz-
  // kicsomagolást használja, hanem LAPONKÉNTI, tetszőleges UV-t (Blockbench-
  // export), ezért nem az addBox()-szal épül, hanem saját úton.
  //
  // A TRANSZFORMÁCIÓ PONTOSAN ugyanaz, mint amit a SolarClient végez
  // (ld. CosmeticRenderer.java) - ez nem véletlen, hanem a funkció LÉNYEGE:
  // az admin ezen az előnézeten húzogatva állítja be azokat az eltolás-
  // értékeket, amik in-game érvényesülnek. Ha a kettő eltérne, az eszköz
  // használhatatlan lenne.
  //
  // A levezetés (a vanilla modell-tér és ez az előnézeti tér között):
  //   preview = (model_x, 6 - model_y, -model_z)
  // Ellenőrizve a fejjel (vanilla doboz y -8..0 -> előnézet 6..14, ahol a fej
  // középpontja 10) és a törzzsel (vanilla y 0..12 -> előnézet 6..-6, közép 0).
  //
  // A csont-pivotok a vanilla BipedEntityModel-ből (ModelTransform.pivot):
  const COSMETIC_PIVOTS = {
    head:      [0, 0, 0],
    body:      [0, 0, 0],
    back:      [0, 0, 0],
    tail:      [0, 0, 0],
    left_arm:  [5, 2, 0],
    right_arm: [-5, 2, 0]
  };

  // Egy pont elforgatása a megadott tengely körül, az ADOTT (szerzői) térben.
  // Azért itt, a flip ELŐTT forgatunk az EREDETI szöggel, mert ez matematikailag
  // azonos azzal, amit a kliens csinál (ott a flip miatt konjugált szöggel
  // forgat: S·R·S), viszont sokkal egyszerűbb és kevésbé hibázható.
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

  /**
   * Geometria egy kiegészítő-modellből.
   * @param model a backend /api/cosmetics/model/:slug válasza
   * @param slot  melyik csonthoz kötődik (a pivotot ez adja)
   * @param opts  { standalone: true } esetén a csont-pivot és az eltolás
   *              KIMARAD, és a modell a saját közepére kerül - ez a kártyákon
   *              látható, önálló "így néz ki a kiegészítő" előnézethez kell.
   */
  function buildCosmeticGeometry(model, slot, opts) {
    const positions = [], uvs = [], indices = [];
    const standalone = !!(opts && opts.standalone);

    const t = model.transform || {};
    const off = Array.isArray(t.offset) && t.offset.length === 3 ? t.offset : [0, 0, 0];
    const mScale = typeof t.scale === 'number' && t.scale > 0 ? t.scale : 1;
    const itemSpace = t.itemModelSpace !== false;

    // AZ UV-TÉR MÉRETE - ld. a kliens CosmeticModel.parse() azonos, részletes
    // megjegyzését. Röviden: a vanilla blokk-/item-modellekben a lap-UV-k
    // MINDIG 0..16 térben vannak, a textúra felbontásától függetlenül; a
    // "texture_size" csak entitás-modelleknél jelent tényleges UV-teret.
    // A vásárolt csomagokban ez a mező elavultan marad benne, és ha elhisszük,
    // a textúrának csak egy töredékét mintázzuk (mérve: a Volt Wingsnél 49%,
    // a Butterfly Wingsnél 19%) - ettől tűnt "hiányosnak" a textúra.
    let texW, texH;
    if (itemSpace) {
      texW = 16; texH = 16;
    } else {
      const texSize = Array.isArray(model.texture_size) && model.texture_size.length === 2
        ? model.texture_size : [64, 64];
      texW = texSize[0] > 0 ? texSize[0] : 64;
      texH = texSize[1] > 0 ? texSize[1] : 64;
    }
    const pivot = COSMETIC_PIVOTS[slot] || [0, 0, 0];

    const f = itemSpace ? -1 : 1;

    // Szerzői térből az előnézeti térbe - ld. a fenti levezetést.
    function toPreview(v) {
      const sx = v[0] * mScale * f;
      const sy = v[1] * mScale * f;
      const sz = v[2] * mScale;
      if (standalone) return [sx, -sy, -sz];
      return [
        pivot[0] - off[0] + sx,
        6 - (pivot[1] - off[1] + sy),
        -(pivot[2] + off[2] + sz)
      ];
    }

    const FACE_DIRS = ['north', 'south', 'east', 'west', 'up', 'down'];

    for (const el of (model.elements || [])) {
      if (!Array.isArray(el.from) || !Array.isArray(el.to)) continue;
      const inf = typeof el.inflate === 'number' ? el.inflate : 0;
      const x1 = Math.min(el.from[0], el.to[0]) - inf, x2 = Math.max(el.from[0], el.to[0]) + inf;
      const y1 = Math.min(el.from[1], el.to[1]) - inf, y2 = Math.max(el.from[1], el.to[1]) + inf;
      const z1 = Math.min(el.from[2], el.to[2]) - inf, z2 = Math.max(el.from[2], el.to[2]) + inf;

      // A 8 sarok a SZERZŐI térben, majd (ha kell) elforgatva.
      function corner(x, y, z) {
        let p = [x, y, z];
        if (el.rotation && typeof el.rotation.angle === 'number' && el.rotation.angle !== 0
            && Array.isArray(el.rotation.origin)) {
          p = rotatePoint(p, el.rotation.origin, el.rotation.axis, el.rotation.angle);
        }
        return toPreview(p);
      }

      // A lapok sarkai a SZERZŐI tér irányai szerint (a "north" a -Z felé néz).
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
        const base = positions.length / 3;
        const pts = quads[dir];
        // A UV-sarkok sorrendje a fenti sarok-sorrendhez igazodik.
        // A LAP-FORGATÁS (Blockbench "rotation" a face-en, 90/180/270) itt
        // ugyanúgy alkalmazódik, mint a kliensben (ld. CosmeticModel.Face):
        // a vanilla ELLENTÉTES körüljárással indexel és ott a forgatás
        // hozzáadódik, ezért a mi körüljárásunkban kivonni kell. Enélkül a
        // vásárolt csomagok lapjainak jó része (a Volt Wingsnél 39%-a)
        // elfordult mintával jelenne meg.
        const baseU = [u1, u2, u2, u1];
        const baseV = [v1, v1, v2, v2];
        const steps = ((((face.rotation | 0) / 90) % 4) + 4) % 4;
        const uvC = [];
        for (let i = 0; i < 4; i++) {
          const src = ((i - steps) % 4 + 4) % 4;
          uvC.push([baseU[src] / texW, baseV[src] / texH]);
        }
        for (let i = 0; i < 4; i++) {
          positions.push(pts[i][0], pts[i][1], pts[i][2]);
          uvs.push(uvC[i][0], uvC[i][1]);
        }
        indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }

    return { positions, uvs, indices };
  }

  // Egy önálló geometria befoglaló dobozának közepe + mérete - a kártyákon
  // látható, önálló kiegészítő-előnézet ebből számolja ki, mekkorára kell
  // nagyítani, hogy kitöltse a vásznat (egy pici gyűrű és egy hatalmas szárny
  // különben ugyanakkora vásznon egyaránt használhatatlan lenne).
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
  function scaleMat(s) {
    return new Float32Array([s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1]);
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
  /**
   * @param cosmetics (nem kötelező) [{ model, slot, img }] - kozmetikai
   *        kiegészítők, amiket a testtel EGYÜTT, ugyanazzal a forgó
   *        mátrixszal rajzolunk ki, mindegyiket a SAJÁT textúrájával
   *        (külön draw call-lal, ugyanaz a minta, mint a köpenynél).
   * @param onCosmeticDrag (nem kötelező) az admin illesztő-szerkesztőhöz:
   *        ha meg van adva, a vásznon való húzás NEM a kamerát forgatja,
   *        hanem ezt hívja (dx, dy) képpont-eltéréssel - a hívó ebből
   *        számol eltolás-értéket. A kamerát ilyenkor a jobb gomb/Shift
   *        forgatja.
   */
  function start(canvas, img, slim, capeImg, cosmetics, onCosmeticDrag) {
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

    // A kiegészítők - mindegyik SAJÁT geometriával és SAJÁT textúrával
    // (ellentétben a testrészekkel, amik egyetlen skin-képet osztanak).
    let cosmeticDrawables = [];

    function buildCosmetics(list) {
      // A régi puffereket/textúrákat KÖTELEZŐ felszabadítani: a szerkesztőben
      // ez másodpercenként sokszor lefut (minden húzás-mozdulatnál), és
      // enélkül percek alatt elfogyna a GPU-memória.
      for (const d of cosmeticDrawables) {
        gl.deleteBuffer(d.posBuf); gl.deleteBuffer(d.uvBuf); gl.deleteBuffer(d.idxBuf);
        gl.deleteTexture(d.tex);
      }
      cosmeticDrawables = [];
      for (const c of (list || [])) {
        if (!c || !c.model || !c.img) continue;
        try {
          const g = buildCosmeticGeometry(c.model, c.slot);
          if (g.indices.length) cosmeticDrawables.push(createDrawable(gl, g, c.img));
        } catch (e) {
          // Egy hibás modell ne akassza meg a teljes előnézetet - a többi
          // (és maga a karakter) így is megjelenik.
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
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE); // egyszerűbb, mint a lap-sorrendeket pontosan kiszámolni
    gl.clearColor(0, 0, 0, 0);

    let angle = 0.6;
    let dragging = false, lastX = 0, lastY = 0, pitch = -0.15;
    let camDistance = 46;

    // Az ILLESZTŐ-SZERKESZTŐ módban (onCosmeticDrag megadva) a vezérlés
    // Blockbench-szerű: a BAL gombos húzás FORGAT, mert egy 3D nézetben
    // mindenki ezt várja. A kiegészítő mozgatása a Shift (vagy a jobb gomb)
    // alatt van - szándékosan a ritkábban használt gesztuson, hiszen
    // forgatni sokkal többször kell, mint pozicionálni.
    let mode = 'rotate';

    function onDown(e) {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      mode = (onCosmeticDrag && (e.shiftKey || e.button === 2)) ? 'move' : 'rotate';
      if (mode === 'move') e.preventDefault();
    }
    function onMove(e) {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      if (mode === 'move') {
        // A kamera aktuális Y-forgása és távolsága is átadódik, hogy a hívó a
        // KÉPERNYŐN látott irányba, a nagyításhoz igazított léptékkel tudja
        // mozgatni a modellt.
        onCosmeticDrag(dx, dy, angle, camDistance);
      } else {
        angle += dx * 0.01;
        // Pálya-forgatás függőlegesen is (fentről/lentről is meg lehessen
        // nézni), a pólusoknál megállítva, hogy ne fordulhasson át fejre.
        pitch = Math.max(-1.3, Math.min(1.3, pitch + dy * 0.01));
      }
    }
    function onUp() { dragging = false; }

    // Görgő = nagyítás. SZÁNDÉKOSAN CSAK a szerkesztőben: a főoldal és a
    // játékos-kereső skin-előnézetén a görgőnek az OLDALT kell görgetnie,
    // ott egy nagyítás csak zavaró, nem kért viselkedés lenne.
    function onWheel(e) {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.12 : 1 / 1.12;
      camDistance = Math.max(12, Math.min(160, camDistance * factor));
    }
    canvas.addEventListener('mousedown', onDown);
    if (onCosmeticDrag) {
      canvas.addEventListener('contextmenu', preventCtx);
      canvas.addEventListener('wheel', onWheel, { passive: false });
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    function preventCtx(e) { e.preventDefault(); }

    let stopped = false;
    // Az illesztő-szerkesztőben a magától forgás zavaró lenne (a felhasználó
    // épp pozicionál) - ott csak kézzel forog.
    const autoSpin = !onCosmeticDrag;

    function frame() {
      if (stopped) return;
      if (!dragging && autoSpin) angle += 0.006;

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
      for (const c of cosmeticDrawables) drawDrawable(c);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    // A visszatérési érték egy LEÁLLÍTÓ FÜGGVÉNY (visszafelé kompatibilis a
    // korábbi hívókkal), amire rá van akasztva egy updateCosmetics() metódus.
    //
    // MIÉRT KELL EZ: az illesztő-szerkesztőben a húzás minden mozdulatánál
    // változik a geometria. Ha ilyenkor az EGÉSZ előnézetet újraindítanánk,
    // a start() közben eltávolított/újra felrakott egér-figyelők elvágnák a
    // folyamatban lévő húzást (a "dragging" állapot az elhagyott példány
    // closure-jében maradna) - ez élesben ki is derült: az első mozdulat után
    // a modell nem követte tovább az egeret. Ezért csak a KIEGÉSZÍTŐK
    // pufferei épülnek újra, a GL-kontextus és a figyelők érintetlenek.
    const stop = () => {
      stopped = true;
      canvas.removeEventListener('mousedown', onDown);
      if (onCosmeticDrag) {
        canvas.removeEventListener('wheel', onWheel);
        canvas.removeEventListener('contextmenu', preventCtx);
      }
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

    stop.updateCosmetics = (list) => {
      if (stopped) return;
      buildCosmetics(list);
    };

    return stop;
  }

  /**
   * ÖNÁLLÓ kiegészítő-előnézet - csak maga a modell, a karakter nélkül,
   * automatikusan a vászonhoz méretezve és a saját közepe körül forogva.
   * Ez a kiegészítő-kártyák "bélyegképe": a nyers textúra helyett a
   * TÉNYLEGES 3D alak látszik, a saját textúrájával.
   */
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

    const aPos = gl.getAttribLocation(program, 'aPos');
    const aUV = gl.getAttribLocation(program, 'aUV');
    gl.enableVertexAttribArray(aPos);
    gl.enableVertexAttribArray(aUV);

    const drawable = createDrawable(gl, geometry, img);
    const bounds = geometryBounds(geometry);
    // 22 egység a "referencia" méret (nagyjából egy teljes karakter magassága
    // ebben a térben) - ehhez arányosítjuk a modellt, hogy kicsi és nagy
    // kiegészítő is kitöltse a vásznat.
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
      // Középre igazítás -> méretezés -> forgatás (jobbról balra olvasva).
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

  // ── Bélyegkép-renderelő (kártyákhoz) ──────────────────────────────────
  // MIÉRT EGY MEGOSZTOTT KONTEXTUS, ÉS NEM KÁRTYÁNKÉNT EGY ÉLŐ VÁSZON:
  // a böngészők durván 16 egyidejű WebGL-kontextusnál elkezdik a legrégebbieket
  // eldobni - egy 20 kiegészítőt tartalmazó katalógusnál a kártyák egy része
  // egyszerűen üresen maradna, ráadásul 20 párhuzamos animációs hurok
  // feleslegesen pörgetné a GPU-t. Ehelyett EGY, rejtett kontextusban
  // rajzolunk ki minden modellt egyszer, és a kész képet tesszük ki
  // <img>-ként - tetszőleges számú kártyánál működik, és nem fogyaszt semmit,
  // miután elkészült.
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

  /**
   * Egy kiegészítő 3D bélyegképe PNG data URL-ként (vagy null, ha nem megy).
   * Enyhén elforgatott, "termékfotó" nézet - így a lapos (sík) modellek is
   * térbelinek látszanak, nem egyetlen vonalnak.
   */
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

    // A GL-erőforrások azonnali felszabadítása - egy nagy katalógusnál
    // különben minden bélyegkép után ott maradna 3 puffer és egy textúra.
    gl.deleteBuffer(d.posBuf); gl.deleteBuffer(d.uvBuf); gl.deleteBuffer(d.idxBuf);
    gl.deleteTexture(d.tex);

    return url;
  }

  // ── Alapértelmezett ("Steve") skin ────────────────────────────────────
  // Rajzolva, nem beágyazott base64: egy 64x64-es skin-kép kézzel kitöltve
  // sokkal kisebb, mint a képfájl, és a CSP-vel sincs dolga. Nem pixelre
  // pontos Mojang-Steve, de a célnak (referencia-karakter, amin a kiegészítő
  // elhelyezését meg lehet ítélni) pontosan megfelel.
  let steveImagePromise = null;
  function getSteveImage() {
    if (steveImagePromise) return steveImagePromise;
    steveImagePromise = new Promise((resolve) => {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 64;
      const g = c.getContext('2d');
      g.clearRect(0, 0, 64, 64);

      const SKIN = '#b0805a', SKIN_D = '#a0714e', HAIR = '#3f2a19', HAIR_D = '#33200f';
      const EYE_W = '#ffffff', EYE_B = '#3b5dc9', MOUTH = '#7b4f36';
      const SHIRT = '#3aa0a8', SHIRT_D = '#2c8189', PANTS = '#3b3f8f', SHOE = '#4a3a2a';

      function r(x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }

      // Fej (8,8) arc, körülötte a többi lap
      r(0, 8, 32, 8, SKIN_D);          // fej oldalai/hátulja alapszín
      r(8, 8, 8, 8, SKIN);             // arc
      r(0, 0, 32, 8, HAIR_D);          // fejtető sáv
      r(8, 0, 8, 8, HAIR);             // tető
      r(8, 8, 8, 3, HAIR);             // haj-frufru az arcon
      r(0, 8, 8, 3, HAIR_D); r(16, 8, 8, 3, HAIR_D); r(24, 8, 8, 3, HAIR_D);
      r(9, 12, 2, 2, EYE_W); r(10, 12, 1, 2, EYE_B);
      r(13, 12, 2, 2, EYE_W); r(13, 12, 1, 2, EYE_B);
      r(11, 15, 2, 1, MOUTH);

      // Törzs
      r(16, 20, 24, 12, SHIRT_D);
      r(20, 20, 8, 12, SHIRT);         // mellkas
      r(20, 16, 8, 4, SHIRT_D);        // váll (felső lap)

      // Jobb kar
      r(40, 20, 16, 12, SKIN_D);
      r(44, 20, 4, 12, SKIN);
      r(44, 16, 4, 4, SHIRT_D);
      r(40, 20, 16, 4, SHIRT_D);       // rövid ujj

      // Bal kar
      r(32, 52, 16, 12, SKIN_D);
      r(36, 52, 4, 12, SKIN);
      r(36, 48, 4, 4, SHIRT_D);
      r(32, 52, 16, 4, SHIRT_D);

      // Jobb láb
      r(0, 20, 16, 12, PANTS);
      r(0, 28, 16, 4, SHOE);
      // Bal láb
      r(16, 52, 16, 12, PANTS);
      r(16, 60, 16, 4, SHOE);

      const img = new Image();
      img.onload = () => resolve(img);
      img.src = c.toDataURL('image/png');
    });
    return steveImagePromise;
  }

  return {
    start,
    startCosmetic,
    buildCosmeticGeometry,
    renderCosmeticThumbnail,
    getSteveImage,
    COSMETIC_PIVOTS
  };
})();
