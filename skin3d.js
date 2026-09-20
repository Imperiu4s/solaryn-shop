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
  // A "uTint" az AURA részecskéihez kell: azok a kiegészítő textúrájának egy
  // pontját mintázzák, és a színüket/áttetszőségüket ez a szorzó adja (a
  // kliens ugyanezt vertex-színnel teszi). Minden más rajzolásnál (1,1,1,1),
  // tehát a meglévő megjelenés bitre változatlan.
  //
  // Az alfa-vágás a részecskéknél KI van kapcsolva (uAlphaCut = 0): egy
  // elhalványuló részecske éppen a kis alfánál lenne a legfontosabb, a
  // geometriánál viszont a vágás kell, hogy a szárnyak átlátszó része ne
  // takarjon.
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
    right_arm: [-5, 2, 0],
    // A KÉZBEN tartott kiegészítő ugyanahhoz a csonthoz (jobb kar) kötődik,
    // mint a "right_arm", de a KÉZFEJNÉL, nem a vállnál - ezért a kar teljes
    // hosszával (12 egység) lejjebb van a forgáspontja. A kliens ugyanezt az
    // eltolást alkalmazza (ld. MixinCosmeticFeature "main_hand" ágát).
    main_hand: [-5, 10, 0]
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

  /** 6u^5-15u^4+10u^3 - a 0 és 1 pontban az ELSŐ és a MÁSODIK deriváltja is 0. */
  function smootherStep(u) {
    return u * u * u * (u * (u * 6 - 15) + 10);
  }

  function animWave(wave, turns) {
    if (wave === 'flap') {
      // ASZIMMETRIKUS CSAPÁS: a ciklus első harmada a lecsapás (1 -> -1), a
      // maradék a visszaemelkedés. Egy szinusz oda-vissza ugyanolyan gyors, és
      // épp ettől néz ki egy szárnycsapás "billegő lapnak".
      //
      // JAVÍTVA (élesben visszajelzett hiba: "egy bizonyos ponton az animáció
      // közben mintha visszaugrana"): a két szakasz KORÁBBAN koszinusz volt.
      // Ott a SEBESSÉG valóban nulla a fordulópontokon, a GYORSULÁS viszont
      // (pi/0,34)^2 = 85,4-ről (pi/0,66)^2 = 22,7-re ugrott, vagyis 3,8-
      // szorosára - mérve a csúcsgyorsulás 36,7%-a, PONTOSAN a ciklus
      // 34,0%-ánál. Egy ekkora gyorsulás-ugrás a szemnek megrándulás.
      //
      // Az ÖTÖDFOKÚ simítás (smootherstep) első ÉS második deriváltja is nulla
      // a két végén, ezért a szakaszhatárokon a sebesség és a gyorsulás is
      // nulla MINDKÉT oldalról: a mozgás C2-folytonos (mérve 36,7% -> 0,02%).
      // Az aszimmetria (34% lecsapás) és a +-1 szélsőértékek változatlanok.
      // A kliens CosmeticAnim.wave()-je szóról szóra ugyanez.
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


  // ── AURA AZ ELŐNÉZETBEN ───────────────────────────────────────────────
  //
  // A kliens CosmeticAura osztályának párja. A matematika SZÓRÓL SZÓRA
  // ugyanaz - ez nem kényelmi kérdés: amit az admin itt beállít, annak
  // in-game ugyanúgy kell kinéznie, különben a szerkesztő félrevezet.
  //
  // ÁLLAPOTMENTES részecskék: mindegyiket a sorszámából és az időből
  // számoljuk zárt alakban, pont mint a kliensben (ld. ott a részletes
  // indoklást). Így itt sincs se listakezelés, se képkocka-függés.
  const AURA_MAX_PARTICLES = 96;

  /**
   * Az aura-TÍPUSOK (presetek). Ezeket a BACKEND küldi (ld. ott az
   * auraTypeList() indoklását arról, miért ott élnek), az app.js pedig a
   * katalógus betöltésekor átadja ide. Amíg üres, az előnézet egyszerűen nem
   * rajzol aurát - a geometria ettől még látszik.
   */
  let auraPresets = [];
  function setAuraPresets(list) {
    auraPresets = Array.isArray(list) ? list : [];
  }

  /** A kliens CosmeticAura.rand()-jával AZONOS keverő. */
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

  /**
   * A TÁROLT aura-beállítás (típus + felülírások) feloldása a teljes
   * paraméterkészletté - a backend resolveAura()-jának párja.
   *
   * MIÉRT KELL ITT IS: a szerkesztőben MENTÉS ELŐTT is látni kell az
   * eredményt, tehát nem várhatunk a szerver által feloldott válaszra. A
   * PRESETEK viszont NEM itt élnek: azokat a backend küldi (ld. ott az
   * auraTypeList() indoklását), ez a függvény csak összeolvasztja őket a
   * felülírásokkal - így a típusok forrása egyetlen helyen marad.
   */
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
    return out;
  }

  /**
   * Egy részecske állapota az adott időpillanatban, a kiegészítő SZERZŐI
   * terében. A kliens renderAura()-jának számításaival azonos.
   *
   * @returns {null} ha a részecske ebben a pillanatban láthatatlan
   */
  function auraParticle(aura, i, count, time, center, halfExtent) {
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
      // A SZERZŐI térben: a "rise" a játékos szemszögéből felfelé mutat, ami
      // itt a +Y (az előnézetben nincs a kliens tükrözése).
      x: center[0] + auraRandSigned(i, cycle, 0) * halfExtent[0] + dx,
      y: center[1] + auraRandSigned(i, cycle, 1) * halfExtent[1] + up,
      z: center[2] + auraRandSigned(i, cycle, 2) * halfExtent[2] + dz,
      size,
      spin: aura.spin * age * (auraRand(i, cycle, 8) < 0.5 ? -1 : 1),
      r: (ca[0] + (cb[0] - ca[0]) * t) * flick,
      g: (ca[1] + (cb[1] - ca[1]) * t) * flick,
      b: (ca[2] + (cb[2] - ca[2]) * t) * flick,
      a: alpha,
      faceSeed: auraRand(i, cycle, 9)
    };
  }

  // ── Hullám-sávok (a kliens CosmeticWave.Bands párja) ────────────────
  // MIÉRT SÁVOK: a hullám mostantól CSÚCSONKÉNT deformál, nem kockánként
  // forgat (ld. waveElementPositions). Csúcsonként három szög szinuszát
  // kiszámolni képkockánként túl drága lenne, ezért a 0..1 távolságot
  // WAVE_BANDS egyenletes sávra osztjuk, sávonként EGYSZER építünk egy 3x3-as
  // forgatómátrixot, és a csúcs csak kiválasztja a sávját. A kliens
  // pontosan ugyanezt teszi, ugyanennyi sávval - ha itt más lenne, a
  // szerkesztőben beállított mozgás in-game máshogy nézne ki.
  const WAVE_BANDS = 64;

  // ── VARRAT-ELHALVÁNYÍTÁS (a kliens CosmeticWave SEAM_FADE-jének párja) ──
  // A forgáspont túloldalán lévő csúcsok a deformációt TÜKRÖZVE kapják
  // (M·D·M, ld. makeBands().apply) - ettől csap a jobb+bal szárnypár EGYÜTT.
  // A két oldal a varratnál (d = 0) viszont csak akkor ér össze, ha ott a
  // deformáció ÉPP AZONOSSÁG; falloff < 1 mellett marad egy távolság-
  // FÜGGETLEN kitérés-maradék (amp * (1 - falloff)), ami a varrat két oldalán
  // ellentétes irányba hat, és felszakítja a modellt. Mérve a "Szárnycsapás"
  // kész mozgáson: 0,59 modell-egység, a lecsapás alján (a ciklus 33,6%-a) -
  // ez az "egy bizonyos ponton mintha visszaugrana a textúra" tünet.
  //
  // Ha a geometria ÁTNYÚLIK a forgásponton, a varrat körül simán nullába
  // visszük a szakadást okozó komponenseket. A szárnyhegy kitérése és a félút
  // változatlan marad, a két szárnyfél szimmetrikus marad; egyoldalas
  // kiegészítőnél a fade ki van kapcsolva, ott semmi nem változik.
  const SEAM_FADE = 0.2;
  function seamFactor(d) {
    if (d >= SEAM_FADE) return 1;
    const t = d / SEAM_FADE;
    return t * t * (3 - 2 * t);
  }

  // Munkapufferek - a modul élettartamára, hogy képkockánként ne keletkezzen
  // szemét (a bélyegkép-generálás és az élő előnézet is ezt hívja).
  //
  // KÉT KÜLÖN KÉSZLET kell egyszerre: a RÉSZ hulláma a szerzői térben
  // dolgozik (a tükrözést a rész mátrixa végzi később), a TELJES KIEGÉSZÍTŐ
  // hulláma viszont már a modell-térben, a részek illesztése UTÁN - ld.
  // waveElementPositions(). Ugyanez a felosztás a kliensben is (WAVE_BANDS
  // és ASSEMBLY_BANDS a CosmeticRendererben).

  /** M = Rz * Ry * Rx, soronként a megadott eltolásra. A kliens buildZYX-e. */
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

  /**
   * Egy sávkészlet (a kliens CosmeticWave.Bands osztályának párja).
   *
   * @param unit  1 = szerzői tér (a rész saját hulláma), 1/16 = modell-tér
   *              (a teljes kiegészítő hulláma, a részek illesztése után)
   * @param f     +1 entitás-modellnél, -1 Blockbench item-modellnél; modell-
   *              térben ez negálja az X/Y körüli forgást és az X/Y eltolást,
   *              szerzői térben mindig 1 (ott a tükrözést a mátrix végzi)
   */
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
          // A varrat-elhalványítás CSAK azokat a komponenseket viszi nullába,
          // amelyek ténylegesen felszakítanák a modellt: a mirrorAxis-ra
          // MERŐLEGES tengelyek körüli forgást és a mirrorAxis MENTI eltolást
          // (ezek váltanak előjelet a tükrözésnél). A mirrorAxis körüli
          // forgás, a többi eltolás és a nagyítás a varrat két oldalán is
          // azonos, ezért érintetlen marad - tőlük marad "életben" a tő.
          // A kliens CosmeticWave.Bands.build()-je szóról szóra ugyanez.
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
      /**
       * @param d ELŐJELES távolság: a negatív érték azt jelenti, hogy a csúcs
       *          a forgáspont TÚLOLDALÁN van, és a deformációt tükrözve kell
       *          alkalmazni.
       *
       * MIÉRT TÜKRÖZÜNK: a távolság mindig abszolút érték, tehát a kitérés
       * NAGYSÁGA eddig is szimmetrikus volt a forgáspont két oldalán - az
       * IRÁNYA viszont nem (egy Z körüli forgatás a +X oldalt felfelé, a -X
       * oldalt lefelé viszi). Egy jobb+bal szárnypáron ez libikókát csinált,
       * nem szárnycsapást. A tükrözés (v' = M·(R·(M·v) + t)) ezt teszi
       * helyre. Ugyanez a kliensben: CosmeticWave.Bands.mirrorAxis.
       */
      apply(d, x, y, z, out, o) {
        const mirror = d < 0;
        if (mirror) d = -d;

        // SÁVOK KÖZTI ÁTMENET (nem a legközelebbi sávra kerekítünk).
        //
        // MIÉRT: a sáv a 0..1 távolságot WAVE_BANDS lépcsőre osztja. Amíg a
        // szomszédos sávok szöge alig tér el, a kerekítés láthatatlan - de a
        // KÉSÉS (spread) pont azt csinálja, hogy a fázis végigfusson a
        // részen: spread = 720-nál két teljes ciklus fér a szárny hosszába,
        // vagyis sávonként ~11 fok fáziskülönbség, ami 40 fokos kitérésnél
        // már ~8 fokos SZÖGLÉPCSŐ két szomszédos sáv között. Ez a szárnyon
        // jól látható, szegmensekre törő "redőnyhatás" volt - pont az, amit
        // egy jó kliens sima, folytonos hajlásként mutat.
        //
        // A két szomszédos sáv EREDMÉNYÉT interpoláljuk, nem a mátrixaikat:
        // két forgatás lineáris keverése nem forgatás (nem lenne ortogonális),
        // a transzformált PONTOK keverése viszont a két körívpont húrján
        // marad. A húr és az ív eltérése sávonként ~r*(1-cos(dszög/2)) - a
        // fenti szélső esetben is a modell-egység ezredrésze, vagyis
        // láthatatlan, cserébe a felület minden távolságon folytonos.
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
  // Csúcsonkénti köztes eredmény (rész-animáció után, illesztés után).
  const tmpA = new Float32Array(3);
  const tmpB = new Float32Array(3);

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

  /**
   * A hullám 0..1-es távolság-skálája, a forgáspont KÉT OLDALÁRA KÜLÖN.
   *
   * MIÉRT OLDALANKÉNT, ÉS NEM EGY KÖZÖS SKÁLÁVAL (élesben visszajelzett hiba:
   * "az egyik szárny sokkal jobban mozog, mint a másik"): a kitérés a
   * távolsággal nő (ld. evalAnim falloff/spread), a távolság pedig eddig a
   * forgásponttól mért LEGNAGYOBB kitéréssel volt normálva - EGYETLEN,
   * mindkét oldalra közös osztóval. Ha a forgáspont nem pont a két szárny
   * közé esik (márpedig ritkán esik oda pontosan: a modell a szerzői térben
   * el van tolva, és az admin is kézzel állítja), akkor a távolabbi szárny
   * hegye 1-es távolságot kap, a közelebbié viszont csak pl. 0,4-et - és
   * ugyanaz a beállítás az egyik szárnyat két és félszer nagyobbra lendíti.
   *
   * Oldalanként normálva MINDKÉT szárnyhegy 1-es távolságú lesz, tehát a
   * kitérésük is egyforma - a forgáspont pontos helyétől függetlenül. A
   * forgáspont ezzel azt szabályozza, HOL csuklik a szárny, nem azt, hogy
   * melyik oldal mozog jobban. (A tükrözést továbbra is az előjel adja, ld.
   * makeBands().apply.)
   *
   * @param signedValues előjeles távolságok a forgásponttól (a hullám
   *                     tengelye mentén), a KOCKAKÖZÉPPONTOKÉ
   * @returns {(signed: number) => number} az előjeles, 0..1-re normált arányt
   *          adó függvény (tetszőleges - akár csúcs-szintű - távolságra)
   */
  function makeSideNormalizer(signedValues) {
    let maxNeg = 0, maxPos = 0;
    for (const s of signedValues) {
      if (s < 0) { if (-s > maxNeg) maxNeg = -s; }
      else if (s > maxPos) maxPos = s;
    }
    // Ha MINDEN kocka a forgásponttal egy síkban van, nincs mihez
    // viszonyítani - ilyenkor mindegyik "teljes" távolságú, ami épp a merev
    // viselkedést adja vissza (ugyanaz a döntés, mint a közös skálás
    // változatban volt).
    const degenerate = maxNeg === 0 && maxPos === 0;
    const normalize = (signed) => {
      if (degenerate) return 1;
      const denom = signed < 0 ? maxNeg : maxPos;
      // Az az oldal, amelyiken NINCS geometria (egyetlen szárny, farok), nem
      // kaphat 1-et pusztán attól, hogy nullával osztanánk.
      if (denom <= 0) return 0;
      const ratio = Math.min(1, Math.abs(signed) / denom);
      return signed < 0 ? -ratio : ratio;
    };
    // Van-e geometria a forgáspont MINDKÉT oldalán, vagyis történik-e
    // egyáltalán tükrözés. Ez a VARRAT-ELHALVÁNYÍTÁS kapcsolója (ld.
    // seamFactor), és a kliens SideScale.straddles() párja.
    normalize.straddles = maxNeg > 0 && maxPos > 0;
    return normalize;
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

      // A CSÚCSOK 0..1-re normált távolsága a forgásponttól, a hullám
      // tengelye mentén - EBBŐL jön a hajlás és a késés (ld. evalAnim).
      //
      // JAVÍTVA: korábban ez KOCKÁNKÉNT egyetlen érték volt, és a kocka merev
      // testként fordult el vele. Egy szárny így nem hajlott, hanem néhány
      // egymáshoz képest elfordult lap láncává TÖRT, a kockahatárokon
      // szétnyíló résekkel. Csúcsonként viszont a szomszédos kockák
      // illeszkedő csúcsai UGYANAZT a szöget kapják (azonos a távolságuk),
      // ezért a felület folytonos marad. A kliens ugyanígy működik.
      //
      // A normalizálás a CSÚCSOK legnagyobb távolságával történik (ld.
      // makeSideNormalizer): a kockaközéppontokkal egy 10 egység SZÉLES
      // szárny-kocka fele kilógna a levágott tartományba, ott a hullám
      // befagyna, és a határon megtörne a felület. A skála a forgáspont KÉT
      // OLDALÁRA KÜLÖN készül.
      let elementDistance = null;
      let vertexDistance = null;
      let waveAxis = 0;
      // Átnyúlik-e a rész a forgásponton - a varrat-elhalványítás kapcsolója.
      let waveStraddles = false;
      if (wave && elementRanges.length) {
        const axis = animAlongAxis(anim, raw.elements);
        // A SKÁLA a csúcsokból, az ELEMENT-értékek a kockaközéppontokból: a
        // normálvektorok a kocka közepének szögével fordulnak, de ugyanabban
        // a skálában kell lenniük, mint a csúcsoknak.
        const signedVerts = [];
        for (let i = 0; i < positions.length / 3; i++) signedVerts.push(positions[i * 3 + axis] - animPivot[axis]);
        const normalize = makeSideNormalizer(signedVerts);
        elementDistance = elementRanges.map((r) => normalize(r.center[axis] - animPivot[axis]));
        waveAxis = axis;
        waveStraddles = normalize.straddles;
        // ELŐJELES: a negatív érték a forgáspont túloldalát jelenti, ahol a
        // deformációt tükrözve alkalmazzuk (ld. makeBands().apply).
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
    const bonePivot = COSMETIC_PIVOTS[slot] || [0, 0, 0];
    const assemblyAnim = (t.anim && typeof t.anim === 'object') ? t.anim : null;

    // A TELJES kiegészítőre rakott hullám CSÚCSONKÉNTI távolságai, MINDEN
    // RÉSZEN ÁT, egyetlen közös skálán.
    //
    // JAVÍTVA (élesben visszajelzett hiba: "van, amit nem lehet a teljes
    // kiegészítőre rárakni... csak a fele mozog"): a kiegészítő-szintű
    // animáció eredetileg mindig 1-es távolsággal futott, tehát a "Hajlás" és
    // a "Késés" ott némán hatástalan volt; az admin felület ezért kényszerűen
    // át is tette a mozgást az ELSŐ részre - innen jött a "csak a fele mozog".
    //
    // Mostantól a teljes kiegészítő pontosan úgy viselkedik, mint EGYETLEN
    // nagy rész: a távolságot a kiegészítő egészén mérjük (a részek saját
    // illesztésén átvive), és a deformáció csúcsonként történik. Egy jobb+bal
    // szárnyból álló kiegészítőnél a test közepére tett forgásponttól
    // mindkét szárnyhegy 1-es távolságot kap, tehát a KÉT SZÁRNY EGYÜTT,
    // szimmetrikusan csap. Ugyanez a kliensben: CosmeticModel.assemblyVertexDistance.
    const assemblyPivot0 = (assemblyAnim && Array.isArray(assemblyAnim.pivot) && assemblyAnim.pivot.length === 3)
      ? assemblyAnim.pivot : allCenter;
    const assemblyWave = animIsWave(assemblyAnim) && parts.length > 0;
    let assemblyWaveAxis = 0;
    let assemblyWaveStraddles = false;
    if (assemblyWave) {
      const AXIS = { x: 0, y: 1, z: 2 };
      // A részek illesztése SZERZŐI térben (a mátrix modell-térben dolgozik,
      // ezért oda-vissza váltunk: a2m visz be, a 16*f hoz vissza).
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

      // Normalizálás a CSÚCSOK legnagyobb távolságával, a forgáspont KÉT
      // OLDALÁRA KÜLÖN (ld. makeSideNormalizer) - ez az a pont, ahol a
      // "jobb+bal szárny" esetnél eldől, hogy a két szárny egyformán csap-e.
      // A kockaközéppontokkal a szárny külső fele a levágott tartományba
      // esne, és ott megtörne a felület (ld. a kliens SideScale-jét).
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
      // AURA: a nyers (tárolt) beállítás, plusz a kibocsátáshoz szükséges
      // befoglaló doboz és néhány textúra-minta. A feloldás (preset +
      // felülírások) a rajzoláskor történik, hogy a szerkesztőben MENTÉS
      // ELŐTT is látszódjon a változás.
      aura: (t.aura && typeof t.aura === 'object') ? t.aura : null,
      auraCenter: allCenter,
      // Ráhagyással, mint a kliensben: a részecskék ne pontosan a felületről
      // induljanak.
      auraHalfExtent: Number.isFinite(allMin[0])
        ? [(allMax[0] - allMin[0]) / 2 + 1, (allMax[1] - allMin[1]) / 2 + 1, (allMax[2] - allMin[2]) / 2 + 1]
        : [1, 1, 1],
      // A részecske a kiegészítő SAJÁT textúrájának egy pontját mintázza
      // (mint a kliensben) - néhány UV-minta a lapok közepéről.
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

    let m2p = scaleMat3(16, -16, -16);
    if (!built.standalone) {
      const bp = built.bonePivot;
      m2p = multiply(translate(bp[0], 6 - bp[1], -bp[2]), m2p);
    }

    // HULLÁMZÓ TELJES KIEGÉSZÍTŐ: a részek illesztése, a részek animációja és
    // a kiegészítő hulláma MIND a csúcsokon történt már (ld.
    // waveElementPositions), és az eredmény MODELL-térben van - ezért itt
    // csak a kiegészítő illesztése + a modell->előnézet váltás marad.
    if (built.assemblyWave) {
      return multiply(m2p, placementMatrix(a.offset, a.scale, a.rotation, a.center, f));
    }

    let m = placementMatrix(a.offset, a.scale, a.rotation, a.center, f);
    const aAnim = animMatrix(a.anim, a.animPivot, f, timeSec, 1);
    if (aAnim) m = multiply(m, aAnim);

    m = multiply(m, placementMatrix(part.offset, part.scale, part.rotation, part.center, f));
    const pAnim = skipPartAnim ? null : animMatrix(part.anim, part.animPivot, f, timeSec, 1);
    if (pAnim) m = multiply(m, pAnim);

    // szerzői tér -> kliens modell-tér
    const a2m = scaleMat3(f / 16, f / 16, 1 / 16);
    return multiply(m2p, multiply(m, a2m));
  }

  /**
   * Az AURA mátrixa: a kiegészítő EGÉSZÉNEK illesztése (és merev animációja),
   * a részek saját illesztése NÉLKÜL - a részecske-felhő a teljes
   * kiegészítőt veszi körül, nem az egyes részeit. Pontosan ezen a ponton
   * rajzol a kliens is (ld. CosmeticRenderer.renderAura()).
   */
  function cosmeticAuraMatrix(built, timeSec) {
    const f = built.f;
    const a = built.assembly;
    let m2p = scaleMat3(16, -16, -16);
    if (!built.standalone) {
      const bp = built.bonePivot;
      m2p = multiply(translate(bp[0], 6 - bp[1], -bp[2]), m2p);
    }
    let m = placementMatrix(a.offset, a.scale, a.rotation, a.center, f);
    // A HULLÁMZÓ kiegészítő-animáció a csúcsokon hat, nem mátrixként - az
    // aurára ezért (mint a kliensben) csak a merev rész vonatkozik.
    if (!built.assemblyWave) {
      const aAnim = animMatrix(a.anim, a.animPivot, f, timeSec, 1);
      if (aAnim) m = multiply(m, aAnim);
    }
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
    const partWaving = !!part.vertexDistance;

    if (partWaving) partBands.build(part.anim, timeSec, part.animPivot, 1, 1, part.waveAxis, part.waveStraddles);

    // ── EGYSZERŰ ESET: csak a RÉSZ hullámzik ──────────────────────────
    // A kimenet SZERZŐI térben marad; a rész illesztését és a kiegészítőét
    // a cosmeticPartMatrix() mátrixa végzi, ahogy eddig.
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

    // ── A TELJES KIEGÉSZÍTŐ HULLÁMZIK ────────────────────────────────
    // Ilyenkor a kimenet MODELL-térben van, és a csúcsok végigmennek a
    // teljes láncon: rész-animáció -> rész-illesztés -> kiegészítő-hullám.
    // A rész illesztését azért kell itt elvégezni, mert a kiegészítő hulláma
    // csúcsonként változik - a mátrixveremre rakva a rész illesztése UTÁNA
    // hatna, ami rossz sorrend. Ld. a kliens CosmeticRenderer
    // renderAssemblyWave() metódusát: szó szerint ugyanez.
    const a = built.assembly;
    const f = built.f;
    assemblyBands.build(a.anim, timeSec, a.animPivot, 1 / 16, f, built.assemblyWaveAxis, built.assemblyWaveStraddles);

    // rész-illesztés (+ a rész MEREV animációja, ha van) egyetlen mátrixba
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
      // pm alkalmazása (oszlopfolytonos 4x4, ld. transformPoint) - kézzel
      // kiírva, hogy csúcsonként ne keletkezzen egy eldobható tömb.
      const x = tmpA[0], y = tmpA[1], z = tmpA[2];
      tmpB[0] = pm[0] * x + pm[4] * y + pm[8] * z + pm[12];
      tmpB[1] = pm[1] * x + pm[5] * y + pm[9] * z + pm[13];
      tmpB[2] = pm[2] * x + pm[6] * y + pm[10] * z + pm[14];
      assemblyBands.apply(avd[v], tmpB[0], tmpB[1], tmpB[2], out, i);
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
      const needsDeform = part.wave || built.assemblyWave;
      const m = cosmeticPartMatrix(built, i, 0, needsDeform);
      // Hullámzó résznél a nulla időpont állását vesszük - a bélyegképnek és
      // az automatikus illesztésnek egy állókép kell, de az is a TÉNYLEGES
      // alakot mutassa, ne a deformálatlant.
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
   * @param opts (nem kötelező) { wheelZoom, pinchZoom } - ld. onWheel().
   *
   * A visszaadott leállító-függvényen NAGYÍTÁS-vezérlők is vannak
   * (zoomBy/setZoomLevel/getZoomLevel/resetView) - ezeken keresztül tud egy
   * oldal saját +/- gombot vagy csúszkát adni a nézethez, anélkül hogy
   * ismernie kellene a kamera belső egységeit.
   */
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
    // Az aura-színezés alapállapota: semleges szorzó + a megszokott
    // alfa-vágás. Enélkül a uniformok nullák lennének, és minden
    // rajzolás fekete/áttetsző lenne.
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
            if (!auraTex) auraTex = d.tex;
            d.built = built;
            d.partIndex = i;
            // A csúcsokat akkor is képkockánként újra kell számolni, ha nem
            // a RÉSZ, hanem a TELJES KIEGÉSZÍTŐ hullámzik - ld.
            // waveElementPositions() második ágát.
            d.wave = !!(part.wave || built.assemblyWave);
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
    const uTint = gl.getUniformLocation(program, 'uTint');
    const uAlphaCut = gl.getUniformLocation(program, 'uAlphaCut');
    // Az aura részecskéi a KIEGÉSZÍTŐ textúráját mintázzák - az első
    // kiegészítő textúrája (a részek úgyis közös textúrán osztoznak).
    let auraTex = null;

    // ── AURA: a részecske-felhő kirajzolása ─────────────────────────────
    //
    // Részecskénként EGY draw call. A kliensben ez elfogadhatatlan lenne (ott
    // több tucat viselő is lehet a képernyőn), egy előnézetben viszont
    // legfeljebb néhány tucat hívás képkockánként - cserébe nem kell
    // vertex-szín-puffer, elég a "uTint" uniform.
    //
    // A részecske ugyanaz a kis KOCKA, mint a kliensben, és a kiegészítő
    // saját textúrájának egy pontját mintázza.
    const auraCubeVerts = new Float32Array(72);   // 6 lap x 4 csúcs x 3
    const auraCubeUVs = new Float32Array(48);     // 6 lap x 4 csúcs x 2
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

    // A kocka 8 sarka és a hat lap - ugyanaz a sarok-indexelés, mint a
    // kliens solaryn$cube()-jában (bit0 = z, bit1 = y, bit2 = x).
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

      // Az aura a kiegészítő EGÉSZÉT veszi körül - a részek illesztése nélkül.
      const auraMvp = multiply(mvp, cosmeticAuraMatrix(built, timeSec));
      gl.uniformMatrix4fv(uMVP, false, auraMvp);
      // A részecskéknél NINCS alfa-vágás: az elhalványulás épp a kis alfánál
      // a lényeg (ld. a fragment shader megjegyzését).
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

      // Vissza az alapállapotba, különben a KÖVETKEZŐ képkocka geometriája is
      // színezve és vágás nélkül rajzolódna.
      gl.uniform4f(uTint, 1, 1, 1, 1);
      gl.uniform1f(uAlphaCut, 0.05);
    }

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

    // A nagyítás határai. A 46 (a kezdőérték) az egész alak, a 14 a fej
    // nagyjából képernyőt kitöltő közelije - ennél közelebb már a kamera
    // belevágna a modellbe.
    const CAM_NEAR = 14, CAM_FAR = 120;
    function setCamDistance(v) {
      camDistance = Math.max(CAM_NEAR, Math.min(CAM_FAR, v));
    }

    // Görgő = nagyítás. A SZERKESZTŐBEN mindig; a sima előnézeteken viszont
    // csak akkor, ha a hívó kifejezetten kéri (opts.wheelZoom) - a főoldal és
    // a játékos-kereső skin-előnézetén a görgőnek az OLDALT kell görgetnie,
    // ott egy magától nagyító vászon csak elkapná a görgetést.
    //
    // Ahol be van kapcsolva, ott is CSAK módosítóbillentyűvel (Ctrl/Cmd)
    // nagyít: enélkül az oldal görgetése akadna el, valahányszor az egér
    // átfut az előnézet fölött. A módosító nélküli görgőt továbbengedjük az
    // oldalnak. A gombok/csúszka (ld. lent zoomBy) módosító nélkül is
    // elérhetővé teszik ugyanezt.
    const wheelNeedsModifier = !onCosmeticDrag;
    function onWheel(e) {
      if (wheelNeedsModifier && !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.12 : 1 / 1.12;
      setCamDistance(camDistance * factor);
    }

    // Érintéses csípés-nagyítás. Két ujj: nagyítás, egy ujj: forgatás -
    // ugyanaz, mint amit egy térképen mindenki vár.
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
      // Az aurát a geometria UTÁN rajzoljuk, kiegészítőnként EGYSZER (nem
      // részenként) - a "drawnAura" ezért figyeli, melyik "built"-et
      // intéztük már el ebben a képkockában.
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
      if (onCosmeticDrag) canvas.removeEventListener('contextmenu', preventCtx);
      if (zoomable) {
        canvas.removeEventListener('wheel', onWheel);
        canvas.removeEventListener('touchstart', onTouchStart);
        canvas.removeEventListener('touchmove', onTouchMove);
        canvas.removeEventListener('touchend', onTouchEnd);
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

    // ── Nagyítás-vezérlők a hívónak (gombok, csúszka) ──────────────────
    // A "szint" 0..1 arány, NEM a kamera távolsága: így az oldal egy sima
    // csúszkát tud kitenni anélkül, hogy tudnia kellene, a 14 a közeli és a
    // 120 a távoli - és ha ezek a határok itt változnak, az oldalon semmit
    // nem kell hozzáigazítani.
    const DEFAULT_CAM = camDistance;
    stop.zoomBy = (factor) => { setCamDistance(camDistance / factor); return stop.getZoomLevel(); };
    stop.getZoomLevel = () => (CAM_FAR - camDistance) / (CAM_FAR - CAM_NEAR);
    stop.setZoomLevel = (t) => {
      setCamDistance(CAM_FAR - Math.max(0, Math.min(1, t)) * (CAM_FAR - CAM_NEAR));
    };
    stop.resetView = () => { camDistance = DEFAULT_CAM; angle = 0.6; pitch = -0.15; };

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
    // Az aura-színezés alapállapota: semleges szorzó + a megszokott
    // alfa-vágás. Enélkül a uniformok nullák lennének, és minden
    // rajzolás fekete/áttetsző lenne.
    gl.uniform4f(gl.getUniformLocation(program, 'uTint'), 1, 1, 1, 1);
    gl.uniform1f(gl.getUniformLocation(program, 'uAlphaCut'), 0.05);

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
      // Az aura-színezés alapállapota: semleges szorzó + a megszokott
      // alfa-vágás. Enélkül a uniformok nullák lennének, és minden
      // rajzolás fekete/áttetsző lenne.
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
    setAuraPresets,
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
