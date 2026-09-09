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

  // ── KIEGÉSZÍTŐK: RÉSZEK ÉS ANIMÁCIÓ ──────────────────────────────────
  //
  // MIÉRT MÁTRIX-LÁNC, ÉS NEM (mint korábban) ELŐRE KISZÁMOLT ELŐNÉZETI
  // KOORDINÁTÁK: az animáció képkockánként változik, tehát a geometriát nem
  // lehet egyszer, véglegesen a helyére számolni. A csúcsok ezért a SZERZŐI
  // (Blockbench-) térben maradnak, és képkockánként egyetlen 4x4-es mátrix
  // viszi őket a helyükre.
  //
  // A LÁNC PONTOSAN A KLIENSÉT KÖVETI (SolarClient CosmeticRenderer): ez nem
  // kényelmi kérdés, hanem követelmény - amit az admin itt beállít, annak
  // in-game UGYANOTT kell megjelennie. Ezért nem "hasonló" matek van itt,
  // hanem ugyanazoknak a translate/scale/rotate hívásoknak a mátrix-alakja,
  // ugyanabban a sorrendben, ugyanazokkal az előjelekkel:
  //
  //   szerzői pont
  //     -> A2M          szerzői -> kliens modell-tér: diag(f, f, 1) / 16
  //     -> illesztés és animáció (kiegészítő szint, majd rész szint)
  //     -> M2P          kliens modell-tér -> előnézeti tér
  //
  // Az M2P levezetése (a régi toPreview()-ból, azzal bitre egyezően):
  //   x_e = csont_x + 16*x_m ; y_e = (6 - csont_y) - 16*y_m ; z_e = -csont_z - 16*z_m
  // azaz  M2P = eltolás(csont_x, 6-csont_y, -csont_z) * diag(16, -16, -16).

  function rotateZ(angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
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

  // ── Animáció-kiértékelés ────────────────────────────────────────────
  // A képletek SZÓ SZERINT a kliens CosmeticAnim-jéé (Java) - ha itt más
  // hullámalak vagy más fázis-képlet lenne, a szerkesztőben beállított mozgás
  // in-game máshogy nézne ki.
  const FLAP_DOWN_FRACTION = 0.34;

  function animWave(wave, turns) {
    if (wave === 'flap') {
      // ASZIMMETRIKUS CSAPÁS: a ciklus első harmada a lecsapás (1 -> -1), a
      // maradék a visszaemelkedés. Mindkét szakasz koszinusz, ezért a
      // fordulópontokon a sebesség nulla - az illesztés szakadásmentes.
      // Egy szinusz oda-vissza ugyanolyan gyors, és épp ettől néz ki egy
      // szárnycsapás "billegő lapnak".
      const t = turns - Math.floor(turns);
      if (t < FLAP_DOWN_FRACTION) return Math.cos(Math.PI * (t / FLAP_DOWN_FRACTION));
      return Math.cos(Math.PI + Math.PI * ((t - FLAP_DOWN_FRACTION) / (1 - FLAP_DOWN_FRACTION)));
    }
    if (wave === 'tri') {
      const x = turns + 0.25;
      return 4 * Math.abs(x - Math.floor(x + 0.5)) - 1;
    }
    if (wave === 'saw') return 2 * (turns - Math.floor(turns)) - 1;
    if (wave === 'pulse') return (turns - Math.floor(turns)) < 0.5 ? 1 : -1;
    return Math.sin(turns * 2 * Math.PI);
  }

  // Az ELŐNÉZETBEN minden reakció TELJESEN aktív (1.0). Szándékos: az admin a
  // beállított LEGNAGYOBB kitérést akarja látni, nem egy álló figuráét - a
  // "csak repülés közben csapkodjon" sáv különben mozdulatlannak látszana, és
  // az admin azt hinné, elrontotta.
  function animReact() { return 1; }

  /**
   * Egy animáció kiértékelése a megadott TÁVOLSÁG-ARÁNYNÁL (0..1 a
   * forgásponttól). A képletek SZÓ SZERINT a kliens CosmeticAnim-jéé - ha itt
   * más lenne, a szerkesztőben beállított mozgás in-game máshogy nézne ki.
   *
   * A HULLÁM két hozzájárulása (ld. a kliens hosszabb magyarázatát):
   *   falloff - a kitérés a tőnél közel nulla, a hegynél a legnagyobb
   *   spread  - a hegy késve követi a tövet, a mozgás végigfut a részen
   */
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

  // Egy szint (kiegészítő vagy rész) STATIKUS illesztése, a kliens
  // modell-terében. Ugyanaz a sorrend, mint a kliensben: eltolás -> méret ->
  // forgatás a befoglaló doboz középpontja körül.
  function placementMatrix(offset, scale, rotation, center, f) {
    let m = translate(-offset[0] / 16, -offset[1] / 16, offset[2] / 16);
    if (scale !== 1) m = multiply(m, scaleMat(scale));
    if (rotation[0] || rotation[1] || rotation[2]) {
      const cx = center[0] * f / 16, cy = center[1] * f / 16, cz = center[2] / 16;
      // Az előjelek a tükrözésből következnek (S = diag(-1,-1,1) melletti
      // S*R*S konjugálás az X/Y forgást negálja, a Z-t nem) - ugyanaz a
      // szabály, mint a kliensben, levezetve, nem próbálgatva.
      const rx = (f < 0 ? -rotation[0] : rotation[0]) * Math.PI / 180;
      const ry = (f < 0 ? -rotation[1] : rotation[1]) * Math.PI / 180;
      const rz = rotation[2] * Math.PI / 180;
      m = multiply(m, translate(cx, cy, cz));
      // A sorrend Rz*Ry*Rx, tehát a csúcsra ELŐSZÖR az X hat - pontosan úgy,
      // ahogy a kliens egymás utáni multiply(Z), multiply(Y), multiply(X)
      // hívásai.
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

  /** Igaz, ha bármelyik sáv kockánként eltérő eredményt ad (nem merev test). */
  function animIsWave(anim) {
    if (!anim || !Array.isArray(anim.tracks)) return false;
    return anim.tracks.some((t) => t && ((Number(t.falloff) || 0) !== 0 || (Number(t.spread) || 0) !== 0));
  }

  /** A hullám távolság-tengelye: a sáv választása, vagy "auto" (a leghosszabb kiterjedés). */
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

  // Egy pont elforgatása a megadott tengely körül, az ADOTT (szerzői) térben -
  // a KOCKÁK saját forgatásához (az bele van sütve a geometriába, mert
  // statikus).
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
   * Egy kiegészítő ELŐKÉSZÍTÉSE rajzolásra: részenként egy-egy geometria a
   * SZERZŐI térben, plusz minden adat, amiből képkockánként a mátrix számol.
   *
   * @param model a backend /api/cosmetics/model/:slug válasza (a régi,
   *              "parts" nélküli alak is működik - az egyetlen résznek számít)
   * @param slot  melyik csonthoz kötődik (a csont-pivotot ez adja)
   * @param opts  { standalone: true } esetén a csont-pivot és az eltolások
   *              KIMARADNAK, és a modell a saját közepére kerül - ez a
   *              kártyákon látható, önálló előnézethez kell.
   */
  function buildCosmeticParts(model, slot, opts) {
    const standalone = !!(opts && opts.standalone);

    // A kiegészítő-szintű illesztés: az ÚJ válaszban "assembly", a régiben
    // "transform". Ha van assembly, az az elsődleges - a "transform" ott már
    // az ELSŐ rész illesztését is tartalmazza (a régi kliensek kedvéért),
    // tehát itt hibás lenne.
    const t = (model.assembly && typeof model.assembly === 'object') ? model.assembly : (model.transform || {});
    const off = Array.isArray(t.offset) && t.offset.length === 3 ? t.offset : [0, 0, 0];
    const mScale = typeof t.scale === 'number' && t.scale > 0 ? t.scale : 1;
    const rot = Array.isArray(t.rotation) && t.rotation.length === 3 ? t.rotation : [0, 0, 0];
    const itemSpace = t.itemModelSpace !== false;
    const f = itemSpace ? -1 : 1;

    // AZ UV-TÉR MÉRETE - ld. a kliens CosmeticModel.parse() azonos, részletes
    // megjegyzését. Röviden: a vanilla blokk-/item-modellekben a lap-UV-k
    // MINDIG 0..16 térben vannak, a textúra felbontásától függetlenül; a
    // "texture_size" csak entitás-modelleknél jelent tényleges UV-teret.
    // A vásárolt csomagokban ez a mező elavultan marad benne, és ha elhisszük,
    // a textúrának csak egy töredékét mintázzuk (mérve: a Volt Wingsnél 49%,
    // a Butterfly Wingsnél 19%) - ettől tűnt "hiányosnak" a textúra.
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
      // KOCKÁNKÉNTI csúcs-tartomány. Hullámzó animációnál minden kocka MÁS
      // szöggel áll, tehát képkockánként külön kell transzformálni őket -
      // ehhez kell tudni, hol kezdődik és hol ér véget egy kocka a közös
      // csúcstömbben.
      const elementRanges = [];

      for (const el of (raw.elements || [])) {
        if (!Array.isArray(el.from) || !Array.isArray(el.to)) continue;
        const rangeStart = positions.length;
        const inf = typeof el.inflate === 'number' ? el.inflate : 0;
        const x1 = Math.min(el.from[0], el.to[0]) - inf, x2 = Math.max(el.from[0], el.to[0]) + inf;
        const y1 = Math.min(el.from[1], el.to[1]) - inf, y2 = Math.max(el.from[1], el.to[1]) + inf;
        const z1 = Math.min(el.from[2], el.to[2]) - inf, z2 = Math.max(el.from[2], el.to[2]) + inf;

        // A 8 sarok a SZERZŐI térben, a kocka saját forgatásával (az statikus,
        // ezért bele lehet sütni a geometriába).
        function corner(x, y, z) {
          let pt = [x, y, z];
          if (el.rotation && typeof el.rotation.angle === 'number' && el.rotation.angle !== 0
              && Array.isArray(el.rotation.origin)) {
            pt = rotatePoint(pt, el.rotation.origin, el.rotation.axis, el.rotation.angle);
          }
          return pt;
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
          // A LAP-FORGATÁS (Blockbench "rotation" a face-en, 90/180/270)
          // ugyanúgy alkalmazódik, mint a kliensben (ld. CosmeticModel.Face):
          // a vanilla ELLENTÉTES körüljárással indexel és ott a forgatás
          // hozzáadódik, ezért a mi körüljárásunkban kivonni kell. Enélkül a
          // vásárolt csomagok lapjainak jó része (a Volt Wingsnél 39%-a)
          // elfordult mintával jelenne meg.
          const baseU = [u1, u2, u2, u1];
          const baseV = [v1, v1, v2, v2];
          const steps = ((((face.rotation | 0) / 90) % 4) + 4) % 4;
          for (let i = 0; i < 4; i++) {
            const src = ((i - steps) % 4 + 4) % 4;
            positions.push(pts[i][0], pts[i][1], pts[i][2]);
            uvs.push(baseU[src] / texW, baseV[src] / texH);
          }
          indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
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

      // A kockák 0..1-re normált távolsága a forgásponttól, a hullám
      // tengelye mentén - EBBŐL jön a hajlás és a késés (ld. evalAnim).
      let elementDistance = null;
      if (wave && elementRanges.length) {
        const axis = animAlongAxis(anim, raw.elements);
        const raws = elementRanges.map((r) => Math.abs(r.center[axis] - animPivot[axis]));
        const maxDist = raws.reduce((a, b) => Math.max(a, b), 0);
        // Ha minden kocka a forgásponttal egy síkban van, nincs mihez
        // viszonyítani - ilyenkor mindegyik "teljes" távolságú, ami épp a
        // merev viselkedést adja vissza.
        elementDistance = raws.map((d) => (maxDist > 0 ? d / maxDist : 1));
      }

      parts.push({
        positions, uvs, indices,
        offset: partOffset, rotation: partRotation, scale: partScale,
        center,
        anim,
        animPivot,
        wave,
        elementRanges,
        elementDistance
      });
    }

    const allCenter = Number.isFinite(allMin[0])
      ? [(allMin[0] + allMax[0]) / 2, (allMin[1] + allMax[1]) / 2, (allMin[2] + allMax[2]) / 2]
      : [0, 0, 0];
    const bonePivot = COSMETIC_PIVOTS[slot] || [0, 0, 0];
    const assemblyAnim = (t.anim && typeof t.anim === 'object') ? t.anim : null;

    return {
      parts,
      standalone,
      f,
      assembly: {
        offset: standalone ? [0, 0, 0] : off,
        scale: mScale,
        rotation: rot,
        center: allCenter,
        anim: assemblyAnim,
        animPivot: (assemblyAnim && Array.isArray(assemblyAnim.pivot) && assemblyAnim.pivot.length === 3)
          ? assemblyAnim.pivot : allCenter
      },
      bonePivot
    };
  }

  /**
   * Egy rész teljes szerzői-térből-előnézeti-térbe mátrixa az adott időpontban.
   *
   * @param skipPartAnim HULLÁMZÓ résznél igaz: a rész animációja ilyenkor
   *        KOCKÁNKÉNT, a csúcsokon érvényesül (ld. waveElementPositions), mert
   *        egyetlen mátrix nem tud kockánként eltérő szöget adni.
   */
  function cosmeticPartMatrix(built, index, timeSec, skipPartAnim) {
    const f = built.f;
    const a = built.assembly;
    const part = built.parts[index];

    let m = placementMatrix(a.offset, a.scale, a.rotation, a.center, f);
    // A kiegészítő-szintű animáció SZÁNDÉKOSAN merev (a teljes összeállításra
    // hat egyben) - ugyanaz a szabály, mint a kliensben.
    const aAnim = animMatrix(a.anim, a.animPivot, f, timeSec, 1);
    if (aAnim) m = multiply(m, aAnim);

    m = multiply(m, placementMatrix(part.offset, part.scale, part.rotation, part.center, f));
    const pAnim = skipPartAnim ? null : animMatrix(part.anim, part.animPivot, f, timeSec, 1);
    if (pAnim) m = multiply(m, pAnim);

    // kliens modell-tér -> előnézeti tér
    let m2p = scaleMat3(16, -16, -16);
    if (!built.standalone) {
      const bp = built.bonePivot;
      m2p = multiply(translate(bp[0], 6 - bp[1], -bp[2]), m2p);
    }
    // szerzői tér -> kliens modell-tér
    const a2m = scaleMat3(f / 16, f / 16, 1 / 16);
    return multiply(m2p, multiply(m, a2m));
  }

  /**
   * A HULLÁM kirajzolása: kockánként más szög.
   *
   * MIÉRT A PROCESSZORON, ÉS NEM KOCKÁNKÉNTI RAJZOLÁSSAL: kockánként külön
   * draw call egy 256 kockás szárnynál képkockánként 256 hívás lenne, ami a
   * böngészőben nagyságrendekkel drágább, mint egyszer végigmenni a
   * csúcsokon. Így marad EGY draw call: a csúcsokat itt mozgatjuk a helyükre,
   * és a puffert egyben töltjük fel újra.
   *
   * A forgatás a SZERZŐI térben, a forgáspont körül történik - ugyanúgy, mint
   * a kliensben; a szerzői térből az előnézetibe a rész mátrixa visz.
   *
   * @param out előre lefoglalt Float32Array (a hívó tartja életben)
   */
  function waveElementPositions(built, index, timeSec, out) {
    const part = built.parts[index];
    const src = part.positions;
    const pivot = part.animPivot;

    for (let e = 0; e < part.elementRanges.length; e++) {
      const range = part.elementRanges[e];
      const a = evalAnim(part.anim, timeSec, part.elementDistance[e]);
      const hasRot = a.rot[0] || a.rot[1] || a.rot[2];

      if (!hasRot && a.scale === 1 && !a.trans[0] && !a.trans[1] && !a.trans[2]) {
        for (let i = range.start; i < range.end; i++) out[i] = src[i];
        continue;
      }

      // A sorrend a kliensével egyezik: X, majd Y, majd Z, a forgáspont körül.
      const cx = Math.cos(a.rot[0] * Math.PI / 180), sx = Math.sin(a.rot[0] * Math.PI / 180);
      const cy = Math.cos(a.rot[1] * Math.PI / 180), sy = Math.sin(a.rot[1] * Math.PI / 180);
      const cz = Math.cos(a.rot[2] * Math.PI / 180), sz = Math.sin(a.rot[2] * Math.PI / 180);

      for (let i = range.start; i < range.end; i += 3) {
        let x = (src[i] - pivot[0]) * a.scale;
        let y = (src[i + 1] - pivot[1]) * a.scale;
        let z = (src[i + 2] - pivot[2]) * a.scale;
        let ty = y * cx - z * sx, tz = y * sx + z * cx;   // X
        y = ty; z = tz;
        let tx = x * cy + z * sy; tz = -x * sy + z * cy;  // Y
        x = tx; z = tz;
        tx = x * cz - y * sz; ty = x * sz + y * cz;       // Z
        x = tx; y = ty;
        out[i]     = x + pivot[0] + a.trans[0];
        out[i + 1] = y + pivot[1] + a.trans[1];
        out[i + 2] = z + pivot[2] + a.trans[2];
      }
    }
    return out;
  }

  /**
   * VISSZAFELÉ KOMPATIBILIS burkoló: egyetlen, ELŐNÉZETI térbe számolt
   * geometria (az animáció nulla időpontjában). A bélyegképeknek és az
   * automatikus illesztésnek (app.js autoFitCosmetic) ez kell - ott nincs
   * képkockánkénti újraszámolás.
   */
  function buildCosmeticGeometry(model, slot, opts) {
    const built = buildCosmeticParts(model, slot, opts);
    const positions = [], uvs = [], indices = [];
    for (let i = 0; i < built.parts.length; i++) {
      const part = built.parts[i];
      const m = cosmeticPartMatrix(built, i, 0, part.wave);
      // Hullámzó résznél a nulla időpont állását vesszük - a bélyegképnek és
      // az automatikus illesztésnek egy állókép kell, de az is a TÉNYLEGES
      // alakot mutassa, ne a deformálatlant.
      const src = part.wave
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
  // ÚJ paraméter: sharedTex. Egy TÖBB RÉSZBŐL álló kiegészítő minden része
  // UGYANAZON a textúralapon osztozik - részenként külön GL-textúrát
  // létrehozni ugyanabból a képből tiszta pazarlás lenne (és egy nagyobb
  // katalógusnál mérhető memória).
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
      // enélkül percek alatt elfogyna a GPU-memória. A textúrát csak az a
      // rész szabadítja fel, AMELYIK létrehozta (ownsTexture) - a többi rész
      // ugyanazt használja.
      for (const d of cosmeticDrawables) {
        gl.deleteBuffer(d.posBuf); gl.deleteBuffer(d.uvBuf); gl.deleteBuffer(d.idxBuf);
        if (d.ownsTexture) gl.deleteTexture(d.tex);
      }
      cosmeticDrawables = [];
      for (const c of (list || [])) {
        if (!c || !c.model || !c.img) continue;
        try {
          // RÉSZENKÉNT külön rajzolás: minden résznek saját (képkockánként
          // újraszámolt) mátrixa van, mert saját animációja lehet.
          const built = buildCosmeticParts(c.model, c.slot);
          let sharedTex = null;
          for (let i = 0; i < built.parts.length; i++) {
            const part = built.parts[i];
            if (!part.indices.length) continue;
            const d = createDrawable(gl, part, c.img, sharedTex);
            if (!sharedTex) sharedTex = d.tex;
            d.built = built;
            d.partIndex = i;
            d.wave = !!part.wave;
            // Hullámzó résznél képkockánként új csúcspozíciók kellenek (a
            // kockák eltérő szöggel állnak) - a puffert DYNAMIC_DRAW-ként
            // hozzuk létre, és egy előre lefoglalt tömbbe számolunk, hogy
            // képkockánként ne keletkezzen szemét.
            if (d.wave) {
              d.scratch = new Float32Array(part.positions.length);
              gl.bindBuffer(gl.ARRAY_BUFFER, d.posBuf);
              gl.bufferData(gl.ARRAY_BUFFER, d.scratch, gl.DYNAMIC_DRAW);
            }
            cosmeticDrawables.push(d);
          }
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
      // A szerkesztő három gesztusa. A Ctrl SZÁNDÉKOSAN a forgatásé: az
      // eltolás (Shift/jobb gomb) a régebbi, megszokott gesztus, azt nem
      // mozgatjuk el a felhasználó alól.
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
        // A kamera aktuális Y-forgása és távolsága is átadódik, hogy a hívó a
        // KÉPERNYŐN látott irányba, a nagyításhoz igazított léptékkel tudja
        // mozgatni a modellt. Az 5. paraméter mondja meg, MELYIK gesztus ez
        // ('move' = eltolás, 'rotate' = a kiegészítő forgatása) - új
        // paraméterként, hogy a régi hívók (akik csak 4-et vesznek át)
        // változtatás nélkül működjenek tovább.
        onCosmeticDrag(dx, dy, angle, camDistance, mode === 'move' ? 'move' : 'rotate');
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
      // A kiegészítő-részek SAJÁT mátrixot kapnak (illesztés + animáció) -
      // ezért itt minden résznél újra beállítjuk az uMVP-t.
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
    buildCosmeticParts,
    cosmeticPartMatrix,
    waveElementPositions,
    animAlongAxis,
    renderCosmeticThumbnail,
    getSteveImage,
    COSMETIC_PIVOTS
  };
})();
