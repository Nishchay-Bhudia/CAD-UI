import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';

// ─── Renderer / Scene / Camera ────────────────────────────────────────────────
const canvas = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0f14);
scene.fog = new THREE.FogExp2(0x0d0f14, 0.004);

const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 2000);
camera.position.set(30, 14, 48);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 1;
controls.maxDistance = 600;

// ─── Lighting ─────────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0x1a2040, 1.4));

const sun = new THREE.DirectionalLight(0xffffff, 2.8);
sun.position.set(40, 60, 30);
sun.castShadow = true;
Object.assign(sun.shadow, { mapSize: new THREE.Vector2(2048, 2048) });
Object.assign(sun.shadow.camera, { left: -100, right: 100, top: 80, bottom: -80, near: 0.1, far: 300 });
scene.add(sun);

const fill = new THREE.DirectionalLight(0x0044ff, 0.6);
fill.position.set(-30, 10, -20);
scene.add(fill);

const rim = new THREE.PointLight(0x00e5ff, 1.5, 200);
rim.position.set(-10, 30, -10);
scene.add(rim);

// Grid + Axes
const grid = new THREE.GridHelper(300, 60, 0x1a2040, 0x141820);
scene.add(grid);
const axes = new THREE.AxesHelper(10);
axes.position.set(-70, 0.02, -70);
scene.add(axes);

// ─── Materials Config ──────────────────────────────────────────────────────────
const MAT_PROPS = {
  aluminum:  { density: 2810,  color: 0x8ab4d4, roughness: 0.20, metalness: 0.90 },
  titanium:  { density: 4430,  color: 0xa0a8b0, roughness: 0.30, metalness: 0.85 },
  carbon:    { density: 1600,  color: 0x2a2d35, roughness: 0.55, metalness: 0.10 },
  steel:     { density: 7850,  color: 0x888888, roughness: 0.35, metalness: 0.92 },
  inconel:   { density: 8190,  color: 0x7a6f6a, roughness: 0.28, metalness: 0.88 },
  magnesium: { density: 1770,  color: 0xb8c0a0, roughness: 0.40, metalness: 0.70 },
};
const MAT_NAMES = {
  aluminum:'Al 7075', titanium:'Ti Gr.5', carbon:'CFRP',
  steel:'St 4340', inconel:'IN 718', magnesium:'Mg AZ31',
};

// Mesh material factory
function makeMat(key, { transparent = false, opacity = 1, wireframe = false } = {}) {
  const p = MAT_PROPS[key] || MAT_PROPS.aluminum;
  return new THREE.MeshStandardMaterial({
    color: p.color, roughness: p.roughness, metalness: p.metalness,
    transparent, opacity, wireframe, depthWrite: !transparent,
  });
}
const canopyMat = new THREE.MeshPhysicalMaterial({
  color: 0x88ccff, roughness: 0.05, metalness: 0, transmission: 0.82,
  transparent: true, opacity: 0.35, envMapIntensity: 1.5, side: THREE.DoubleSide,
});

// ─── State ─────────────────────────────────────────────────────────────────────
const state = {
  // Fuselage
  fuseLength: 20, fuseDiameter: 2.5, fuseNose: 2, fuseTaper: 0.4,
  // Canopy
  canopyShow: true, canopyLength: 3, canopyWidth: 1.4, canopyHeight: 0.9,
  // Main wings
  nacaCode: '2412', wingSpan: 30, wingChord: 3.5, wingTaper: 0.45,
  wingSweep: 25, wingDihedral: 5, wingPos: 38,
  // Winglets
  wingletsShow: false, wingletHeight: 2, wingletCant: 75, wingletSweep: 35,
  // H-Stab
  hstabSpan: 8, hstabChord: 1.5, hstabSweep: 30, hstabDihedral: 3,
  // V-Stab
  vstabHeight: 4, vstabChord: 2.5, vstabSweep: 40, vstabTaper: 0.35,
  // Engines
  engineCount: 2, enginePos: 'underwing',
  engineDiameter: 1.2, engineLength: 4, engineSpanPos: 35,
  // Landing gear
  gearShow: true, gearType: 'tricycle', gearStrut: 1.2, gearRadius: 0.4,
  // Material & view
  material: 'aluminum', viewMode: 'solid',
};

// Mesh registry for visibility and view-mode toggling
const meshGroups = {
  fuselage: [], canopy: [], wings: [], winglets: [],
  hstab: [], vstab: [], engines: [], gear: [], cog: [],
};

function registerMesh(key, mesh) {
  meshGroups[key].push(mesh);
  scene.add(mesh);
}

function disposeMeshGroup(key) {
  for (const m of meshGroups[key]) {
    m.geometry?.dispose();
    if (Array.isArray(m.material)) m.material.forEach(x => x.dispose());
    else m.material?.dispose();
    scene.remove(m);
  }
  meshGroups[key] = [];
}

// Visibility map (true = visible)
const visibility = {
  fuselage: true, canopy: true, wings: true, winglets: true,
  hstab: true, vstab: true, engines: true, gear: true, cog: true,
};

// ─── NACA 4-Digit Profile ─────────────────────────────────────────────────────
function nacaPoints(code, n = 64) {
  const m = parseInt(code[0]) / 100;
  const p = parseInt(code[1]) / 10;
  const t = parseInt(code.slice(2)) / 100;
  const up = [], lo = [];
  for (let i = 0; i <= n; i++) {
    const x = i / n;
    const yt = (t / 0.2) * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x ** 2 + 0.2843 * x ** 3 - 0.1015 * x ** 4);
    let yc = 0, dy = 0;
    if (p > 0) {
      if (x < p) { yc = (m / p ** 2) * (2 * p * x - x ** 2); dy = (2 * m / p ** 2) * (p - x); }
      else        { yc = (m / (1 - p) ** 2) * (1 - 2 * p + 2 * p * x - x ** 2); dy = (2 * m / (1 - p) ** 2) * (p - x); }
    }
    const theta = Math.atan(dy);
    up.push(new THREE.Vector2(x - yt * Math.sin(theta), yc + yt * Math.cos(theta)));
    lo.push(new THREE.Vector2(x + yt * Math.sin(theta), yc - yt * Math.cos(theta)));
  }
  return [...up, ...lo.reverse()];
}

function nacaShape(code, chord) {
  const pts = nacaPoints(code, 64);
  const s = new THREE.Shape();
  s.moveTo(pts[0].x * chord, pts[0].y * chord);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i].x * chord, pts[i].y * chord);
  s.closePath();
  return s;
}

// Generic swept+tapered wing-slab builder → returns [geoR, geoL]
function buildWingSlab({ shape, chord, tipChordRatio, halfSpan, sweep, dihedral, nacaCode, offset = new THREE.Vector3() }) {
  const tipChord = chord * tipChordRatio;
  const sweepRad = THREE.MathUtils.degToRad(sweep);
  const dihedralRad = THREE.MathUtils.degToRad(dihedral);
  const sweepOff = halfSpan * Math.tan(sweepRad);
  const dihedralRise = halfSpan * Math.tan(dihedralRad);

  const shp = shape || nacaShape(nacaCode, chord);
  const geo = new THREE.ExtrudeGeometry(shp, { steps: 1, depth: halfSpan, bevelEnabled: false });
  geo.rotateX(Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = Math.max(0, y) / halfSpan;
    // Taper (scale X toward tip)
    const xOrig = pos.getX(i);
    const scale = 1 - t * (1 - tipChordRatio);
    pos.setX(i, xOrig * scale + t * sweepOff - (chord - chord * scale) * 0.5);
    pos.setY(i, y);
    pos.setZ(i, pos.getZ(i) + t * dihedralRise);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.translate(-chord / 2, 0, 0);

  // Mirror for port
  const geoL = geo.clone();
  const posL = geoL.attributes.position;
  for (let i = 0; i < posL.count; i++) posL.setY(i, -posL.getY(i));
  posL.needsUpdate = true;
  geoL.computeVertexNormals();

  return [geo, geoL];
}

// ─── Component Builders ────────────────────────────────────────────────────────

function buildFuselage() {
  disposeMeshGroup('fuselage');
  const { fuseLength: L, fuseDiameter, fuseNose, fuseTaper } = state;
  const r = fuseDiameter / 2;
  const noseFrac = 0.18, tailFrac = 0.25;
  const noseLen = L * noseFrac, bodyLen = L * (1 - noseFrac - tailFrac), tailLen = L * tailFrac;

  const pts = [];
  // Nose
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    pts.push(new THREE.Vector2(r * Math.pow(t, 1 / fuseNose), -L / 2 + noseLen * t));
  }
  // Body
  for (let i = 1; i <= 12; i++) {
    const t = i / 12;
    pts.push(new THREE.Vector2(r * (1 - 0.04 * t * t), -L / 2 + noseLen + bodyLen * t));
  }
  // Tail taper
  const tailR = r * fuseTaper;
  for (let i = 1; i <= 16; i++) {
    const t = i / 16;
    const rad = r * (1 - 0.04) * (1 - t) + tailR * t;
    pts.push(new THREE.Vector2(rad, -L / 2 + noseLen + bodyLen + tailLen * t));
  }

  const geo = new THREE.LatheGeometry(pts, 36);
  geo.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geo, makeMat(state.material));
  mesh.castShadow = mesh.receiveShadow = true;
  registerMesh('fuselage', mesh);
  console.log(`[AeroCAD] Fuselage L=${L}m D=${fuseDiameter}m`);
}

function buildCanopy() {
  disposeMeshGroup('canopy');
  if (!state.canopyShow) return;
  const { fuseLength: L, fuseDiameter, canopyLength: cL, canopyWidth: cW, canopyHeight: cH } = state;
  const r = fuseDiameter / 2;
  const xStart = -L / 2 + L * 0.14;

  // Ellipsoid canopy via LatheGeometry profile then scale
  const pts = [];
  const segs = 18;
  for (let i = 0; i <= segs; i++) {
    const a = (Math.PI * i) / segs;
    pts.push(new THREE.Vector2(Math.sin(a), Math.cos(a)));
  }
  const geo = new THREE.LatheGeometry(pts, 24);
  geo.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geo, canopyMat.clone());
  mesh.scale.set(cW / 2, cH, cL / 2);
  mesh.position.set(xStart + cL / 2, r + cH * 0.4, 0);
  mesh.castShadow = true;
  registerMesh('canopy', mesh);
}

function buildWings() {
  disposeMeshGroup('wings');
  const { nacaCode, wingSpan, wingChord, wingTaper, wingSweep, wingDihedral, wingPos, fuseLength: L } = state;
  const halfSpan = wingSpan / 2;
  const xPos = -L / 2 + L * (wingPos / 100);

  const [geoR, geoL] = buildWingSlab({
    chord: wingChord, tipChordRatio: wingTaper,
    halfSpan, sweep: wingSweep, dihedral: wingDihedral,
    nacaCode,
  });

  const matR = makeMat(state.material), matL = makeMat(state.material);
  const mR = new THREE.Mesh(geoR, matR);
  const mL = new THREE.Mesh(geoL, matL);
  mR.position.x = mL.position.x = xPos;
  mR.castShadow = mL.castShadow = true;
  registerMesh('wings', mR);
  registerMesh('wings', mL);
  console.log(`[AeroCAD] Wings NACA=${nacaCode} span=${wingSpan}m chord=${wingChord}m sweep=${wingSweep}°`);
}

function buildWinglets() {
  disposeMeshGroup('winglets');
  if (!state.wingletsShow) return;
  const { wingSpan, wingChord, wingTaper, wingSweep, wingDihedral, wingPos,
          wingletHeight, wingletCant, wingletSweep, nacaCode, fuseLength: L } = state;
  const halfSpan = wingSpan / 2;
  const xPos = -L / 2 + L * (wingPos / 100);
  const sweepRad = THREE.MathUtils.degToRad(wingSweep);
  const dihedralRad = THREE.MathUtils.degToRad(wingDihedral);
  const tipChord = wingChord * wingTaper;
  const tipX = xPos + halfSpan * Math.tan(sweepRad) - (wingChord - tipChord) * 0.5 * wingTaper;
  const tipY = halfSpan;
  const tipZ = halfSpan * Math.tan(dihedralRad);

  const cantRad = THREE.MathUtils.degToRad(wingletCant);
  const wlSweepRad = THREE.MathUtils.degToRad(wingletSweep);

  const pts = nacaPoints(nacaCode, 40);
  const wlShape = new THREE.Shape();
  wlShape.moveTo(pts[0].x * tipChord, pts[0].y * tipChord);
  for (let i = 1; i < pts.length; i++) wlShape.lineTo(pts[i].x * tipChord, pts[i].y * tipChord);
  wlShape.closePath();

  const h = wingletHeight;
  const geoR = new THREE.ExtrudeGeometry(wlShape, { steps: 1, depth: h, bevelEnabled: false });
  geoR.rotateX(Math.PI / 2);
  // Cant: rotate around X axis
  geoR.rotateZ(-(Math.PI / 2 - cantRad));
  // Apply sweep along height
  const pos = geoR.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = Math.max(0, y) / h;
    pos.setX(i, pos.getX(i) + t * h * Math.tan(wlSweepRad));
  }
  pos.needsUpdate = true;
  geoR.computeVertexNormals();
  geoR.translate(-tipChord / 2, 0, 0);

  const geoL = geoR.clone();
  const posL = geoL.attributes.position;
  for (let i = 0; i < posL.count; i++) posL.setZ(i, -posL.getZ(i));
  posL.needsUpdate = true;
  geoL.computeVertexNormals();

  const mR = new THREE.Mesh(geoR, makeMat(state.material));
  const mL = new THREE.Mesh(geoL, makeMat(state.material));
  mR.position.set(tipX, tipY, tipZ);
  mL.position.set(tipX, -tipY, tipZ);
  mR.castShadow = mL.castShadow = true;
  registerMesh('winglets', mR);
  registerMesh('winglets', mL);
}

function buildHStab() {
  disposeMeshGroup('hstab');
  const { fuseLength: L, hstabSpan, hstabChord, hstabSweep, hstabDihedral } = state;
  const xPos = L / 2 - L * 0.06;
  const [geoR, geoL] = buildWingSlab({
    chord: hstabChord, tipChordRatio: 0.5,
    halfSpan: hstabSpan / 2, sweep: hstabSweep, dihedral: hstabDihedral,
    nacaCode: '0012',
  });
  const mR = new THREE.Mesh(geoR, makeMat(state.material));
  const mL = new THREE.Mesh(geoL, makeMat(state.material));
  mR.position.x = mL.position.x = xPos;
  mR.castShadow = mL.castShadow = true;
  registerMesh('hstab', mR);
  registerMesh('hstab', mL);
  console.log(`[AeroCAD] H-Stab span=${hstabSpan}m chord=${hstabChord}m`);
}

function buildVStab() {
  disposeMeshGroup('vstab');
  const { fuseLength: L, fuseDiameter, vstabHeight, vstabChord, vstabSweep, vstabTaper } = state;
  const r = fuseDiameter / 2;
  const xPos = L / 2 - L * 0.08;

  const pts = nacaPoints('0012', 40);
  const vshape = new THREE.Shape();
  vshape.moveTo(pts[0].x * vstabChord, pts[0].y * vstabChord);
  for (let i = 1; i < pts.length; i++) vshape.lineTo(pts[i].x * vstabChord, pts[i].y * vstabChord);
  vshape.closePath();

  const tipChord = vstabChord * vstabTaper;
  const sweepRad = THREE.MathUtils.degToRad(vstabSweep);
  const geo = new THREE.ExtrudeGeometry(vshape, { steps: 1, depth: vstabHeight, bevelEnabled: false });

  // Extrude is along Z, re-orient to Y (vertical)
  geo.rotateX(Math.PI / 2);
  geo.rotateZ(Math.PI / 2);

  // Apply sweep + taper via vertex transform
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    const t = Math.max(0, z) / vstabHeight;
    const scaleX = 1 - t * (1 - vstabTaper);
    const xOrig = pos.getX(i);
    pos.setX(i, xOrig * scaleX + t * vstabHeight * Math.tan(sweepRad) - (vstabChord - vstabChord * scaleX) * 0.5);
    pos.setZ(i, z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.translate(-vstabChord / 2, 0, 0);

  const mesh = new THREE.Mesh(geo, makeMat(state.material));
  mesh.position.set(xPos, r, 0);
  mesh.castShadow = true;
  registerMesh('vstab', mesh);
  console.log(`[AeroCAD] V-Stab h=${vstabHeight}m chord=${vstabChord}m`);
}

function buildEngines() {
  disposeMeshGroup('engines');
  const { engineCount: count, enginePos: pos, engineDiameter: diam, engineLength: elen,
          engineSpanPos: spanPct, wingSpan, wingChord, wingSweep, wingDihedral, wingPos,
          fuseLength: L, fuseDiameter } = state;
  if (count === 0) return;

  const r = diam / 2;
  const nR = fuseDiameter / 2;
  const halfSpan = wingSpan / 2;
  const sweepRad = THREE.MathUtils.degToRad(wingSweep);
  const dihedralRad = THREE.MathUtils.degToRad(wingDihedral);
  const wingX = -L / 2 + L * (wingPos / 100);

  // Build a single nacelle group (body + intake + nozzle)
  function makeNacelle() {
    const group = new THREE.Group();

    // Body
    const bodyGeo = new THREE.CylinderGeometry(r * 0.9, r * 0.85, elen * 0.8, 24, 1);
    bodyGeo.rotateX(Math.PI / 2);
    const bodyMesh = new THREE.Mesh(bodyGeo, makeMat(state.material));
    group.add(bodyMesh);

    // Intake ring (fan face)
    const intakeGeo = new THREE.TorusGeometry(r, r * 0.08, 12, 32);
    intakeGeo.rotateX(Math.PI / 2);
    const intakeMesh = new THREE.Mesh(intakeGeo, new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.3, metalness: 0.95 }));
    intakeMesh.position.z = -elen * 0.4;
    group.add(intakeMesh);

    // Intake lip
    const lipGeo = new THREE.CylinderGeometry(r * 1.05, r * 0.9, elen * 0.08, 24);
    lipGeo.rotateX(Math.PI / 2);
    const lipMesh = new THREE.Mesh(lipGeo, makeMat(state.material));
    lipMesh.position.z = -elen * 0.4;
    group.add(lipMesh);

    // Fan disk (inside)
    const fanGeo = new THREE.CylinderGeometry(r * 0.88, r * 0.88, 0.04, 24);
    fanGeo.rotateX(Math.PI / 2);
    const fanMesh = new THREE.Mesh(fanGeo, new THREE.MeshStandardMaterial({ color: 0x445566, roughness: 0.2, metalness: 0.9 }));
    fanMesh.position.z = -elen * 0.38;
    group.add(fanMesh);

    // Nozzle
    const nozzleGeo = new THREE.CylinderGeometry(r * 0.6, r * 0.85, elen * 0.2, 20, 1);
    nozzleGeo.rotateX(Math.PI / 2);
    const nozzleMesh = new THREE.Mesh(nozzleGeo, makeMat(state.material));
    nozzleMesh.position.z = elen * 0.5;
    group.add(nozzleMesh);

    // Pylon (underwing only)
    if (pos === 'underwing') {
      const pylonGeo = new THREE.BoxGeometry(0.15, 0.7, elen * 0.5);
      const pylonMesh = new THREE.Mesh(pylonGeo, makeMat(state.material));
      pylonMesh.position.y = 0.45;
      group.add(pylonMesh);
    }

    return group;
  }

  // Position nacelles
  function getPositions() {
    const positions = [];
    if (pos === 'underwing') {
      const spanFracs = count === 4 ? [0.3, 0.55] : count === 1 ? [0] : [spanPct / 100];
      const counts = count === 4 ? 2 : count === 1 ? 1 : 1;
      const side = count === 1 ? [0] : [-1, 1];
      for (const frac of spanFracs) {
        for (const s of side) {
          const y = s * halfSpan * frac;
          const absY = Math.abs(y);
          const t = absY / halfSpan;
          const x = wingX + absY * Math.tan(sweepRad);
          const z = -r * 1.4 - absY * Math.tan(dihedralRad) * 0.8;
          positions.push(new THREE.Vector3(x, y, z));
        }
      }
    } else if (pos === 'rear') {
      const offsets = count === 1 ? [0] : count === 2 ? [-nR * 1.6, nR * 1.6] : [-nR * 2.5, -nR * 0.8, nR * 0.8, nR * 2.5];
      for (const yo of offsets.slice(0, count)) {
        positions.push(new THREE.Vector3(L / 2 - elen * 0.8, yo, nR * 0.4));
      }
    } else if (pos === 'top') {
      const offsets = count === 1 ? [0] : count === 2 ? [-r * 1.2, r * 1.2] : [-r * 2.5, -r * 0.8, r * 0.8, r * 2.5];
      for (const yo of offsets.slice(0, count)) {
        positions.push(new THREE.Vector3(L / 2 - elen, yo, nR + r * 0.8));
      }
    } else if (pos === 'nose') {
      // Prop engine at nose
      positions.push(new THREE.Vector3(-L / 2 - elen * 0.4, 0, 0));
    }
    return positions;
  }

  for (const p3 of getPositions()) {
    const nacelle = makeNacelle();
    nacelle.position.copy(p3);
    scene.add(nacelle);
    // Register all children
    nacelle.children.forEach(c => { c.userData.groupKey = 'engines'; });
    meshGroups.engines.push(nacelle);
  }

  console.log(`[AeroCAD] Engines count=${count} pos=${pos}`);
}

function buildLandingGear() {
  disposeMeshGroup('gear');
  if (!state.gearShow) return;
  const { fuseLength: L, fuseDiameter, gearType, gearStrut: strutLen, gearRadius: wRadius } = state;
  const r = fuseDiameter / 2;
  const strutR = wRadius * 0.12;
  const strutMat = new THREE.MeshStandardMaterial({ color: 0x445566, roughness: 0.4, metalness: 0.85 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.85, metalness: 0.1 });
  const hubMat   = new THREE.MeshStandardMaterial({ color: 0x667788, roughness: 0.3, metalness: 0.9 });

  function makeStrut(x, y, isMain = false) {
    const g = new THREE.Group();
    // Strut cylinder
    const sg = new THREE.CylinderGeometry(strutR, strutR * 0.8, strutLen, 10);
    const sm = new THREE.Mesh(sg, strutMat);
    sm.position.z = -strutLen / 2;
    sm.rotation.x = Math.PI / 2;
    g.add(sm);
    // Axle
    const axleLen = isMain ? wRadius * 0.6 : 0;
    if (isMain) {
      const ag = new THREE.CylinderGeometry(strutR * 0.6, strutR * 0.6, wRadius * 0.6, 8);
      const am = new THREE.Mesh(ag, strutMat);
      am.rotation.z = Math.PI / 2;
      am.position.set(0, 0, -(strutLen + wRadius));
      g.add(am);
    }
    // Wheels
    const wheelPositions = isMain ? [-axleLen / 2, axleLen / 2] : [0];
    for (const wy of wheelPositions) {
      const wg = new THREE.TorusGeometry(wRadius, wRadius * 0.32, 12, 28);
      const wm = new THREE.Mesh(wg, wheelMat);
      wm.rotation.y = Math.PI / 2;
      wm.position.set(isMain ? wy : 0, 0, -(strutLen + wRadius));
      g.add(wm);
      // Hub cap
      const hg = new THREE.CylinderGeometry(wRadius * 0.45, wRadius * 0.45, wRadius * 0.1, 16);
      const hm = new THREE.Mesh(hg, hubMat);
      hm.rotation.z = Math.PI / 2;
      hm.position.set(isMain ? wy + wRadius * 0.05 : 0, 0, -(strutLen + wRadius));
      g.add(hm);
    }
    g.position.set(x, y, r);
    return g;
  }

  if (gearType === 'tricycle') {
    const noseGear = makeStrut(-L / 2 + L * 0.12, 0, false);
    const mainR    = makeStrut(L * (-0.5 + (state.wingPos / 100)) + L * 0.02,  fuseDiameter * 0.6, true);
    const mainL    = makeStrut(L * (-0.5 + (state.wingPos / 100)) + L * 0.02, -fuseDiameter * 0.6, true);
    for (const g of [noseGear, mainR, mainL]) {
      scene.add(g);
      meshGroups.gear.push(g);
    }
  } else if (gearType === 'taildragger') {
    const mainR = makeStrut(-L / 2 + L * 0.25,  fuseDiameter * 0.55, true);
    const mainL = makeStrut(-L / 2 + L * 0.25, -fuseDiameter * 0.55, true);
    const tailG = makeStrut(L / 2 - L * 0.06, 0, false);
    for (const g of [mainR, mainL, tailG]) {
      scene.add(g);
      meshGroups.gear.push(g);
    }
  } else { // tandem
    const front = makeStrut(-L / 2 + L * 0.2, 0, false);
    const rear  = makeStrut( L / 2 - L * 0.2, 0, false);
    const stabR = makeStrut( 0, fuseDiameter * 0.5, false);
    const stabL = makeStrut( 0, -fuseDiameter * 0.5, false);
    for (const g of [front, rear, stabR, stabL]) {
      scene.add(g);
      meshGroups.gear.push(g);
    }
  }
  console.log(`[AeroCAD] Gear type=${gearType}`);
}

function buildCoG() {
  disposeMeshGroup('cog');
  const cogX = computeCoGPosition();
  const geo = new THREE.SphereGeometry(0.38, 16, 16);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffab00, emissive: 0xffab00, emissiveIntensity: 0.7, roughness: 0.3, metalness: 0.4 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(cogX, 0, 0);
  registerMesh('cog', mesh);
  return cogX;
}

function computeCoGPosition() {
  // Weighted CoG by component mass * centroid X
  const { fuseLength: L, wingPos, hstabSpan, hstabChord, vstabHeight, vstabChord } = state;
  const wingX  = -L / 2 + L * (wingPos / 100) + (state.wingChord / 2);
  const fuseX  = 0;
  const hstabX = L / 2 - L * 0.1;
  const vstabX = L / 2 - L * 0.12;

  const fuseMass   = Math.PI * (state.fuseDiameter / 2) ** 2 * L * 0.18;
  const wingMass   = state.wingChord * state.wingSpan * 0.08;
  const hstabMass  = hstabChord * hstabSpan * 0.04;
  const vstabMass  = vstabChord * vstabHeight * 0.04;

  const totalMass = fuseMass + wingMass + hstabMass + vstabMass;
  const cogX = (fuseMass * fuseX + wingMass * wingX + hstabMass * hstabX + vstabMass * vstabX) / totalMass;
  return cogX;
}

// ─── Full Scene Rebuild ───────────────────────────────────────────────────────
function rebuildScene() {
  buildFuselage();
  buildCanopy();
  buildWings();
  buildWinglets();
  buildHStab();
  buildVStab();
  buildEngines();
  buildLandingGear();
  buildCoG();
  applyViewMode();
  applyVisibility();
  updateTelemetry();
}

// ─── Telemetry ────────────────────────────────────────────────────────────────
function updateTelemetry() {
  const { fuseLength: L, fuseDiameter, wingSpan, wingChord, wingTaper,
          hstabSpan, hstabChord, vstabHeight, vstabChord, material } = state;
  const mp = MAT_PROPS[material] || MAT_PROPS.aluminum;
  const r = fuseDiameter / 2;

  // Volumes (shell approximation)
  const fuseVol = (Math.PI * r * r * L * 0.82) * 0.06; // shell fraction
  const meanChord = wingChord * (1 + wingTaper) / 2;
  const t = parseInt(state.nacaCode.slice(2)) / 100;
  const airfoilArea = t * 0.68 * meanChord * meanChord;
  const wingVol = airfoilArea * wingSpan * 0.25;
  const hstabVol = 0.12 * hstabChord * hstabSpan * 0.015;
  const vstabVol  = 0.12 * vstabChord * vstabHeight * 0.015;
  const totalVol  = fuseVol + wingVol + hstabVol + vstabVol;

  // Mass (g/cm³ × cm³ → g → kg)
  const massKg = (totalVol * 1e6 * mp.density) / 1000;

  // Wing reference area (trapezoidal)
  const sRef = 0.5 * (wingChord + wingChord * wingTaper) * wingSpan;

  // H-tail area
  const sHT = hstabChord * hstabSpan * 0.75;

  // Wetted area approximation
  const swetFuse  = Math.PI * fuseDiameter * L * 0.85;
  const swetWings = 2 * sRef * 2.04;
  const swetHstab = 2 * sHT * 2.04;
  const swetVstab = 2 * vstabChord * vstabHeight * 0.75 * 2.04;
  const swetTotal = swetFuse + swetWings + swetHstab + swetVstab;

  // Aerodynamic ratios
  const AR      = (wingSpan * wingSpan) / sRef;
  const wingLoad = massKg / sRef;
  const fineness = L / fuseDiameter;

  // Static margin (simplified, % MAC)
  const cogX  = computeCoGPosition();
  const acX   = -L / 2 + L * (state.wingPos / 100) + meanChord * 0.25;
  const SM    = ((acX - cogX) / meanChord) * 100;

  // Update DOM
  set('t-mass',      massKg.toFixed(0));
  set('t-wing-area', sRef.toFixed(1));
  set('t-wing-load', wingLoad.toFixed(1));
  set('t-ar',        AR.toFixed(2));
  set('t-fineness',  fineness.toFixed(1));
  set('t-wetted',    swetTotal.toFixed(0));
  set('t-cog',       cogX.toFixed(2));
  set('t-sm',        SM.toFixed(1));
  set('t-total-vol', totalVol.toFixed(2));
  set('t-material',  MAT_NAMES[material] || material);
}

function set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ─── View Mode ────────────────────────────────────────────────────────────────
function applyViewMode() {
  const mode = state.viewMode;
  for (const [key, meshes] of Object.entries(meshGroups)) {
    for (const m of meshes) {
      applyModeToObject(m, mode, key);
    }
  }
}

function applyModeToObject(obj, mode, key) {
  if (obj.isGroup) {
    obj.traverse(child => { if (child.isMesh) applyModeToMesh(child, mode, key); });
  } else if (obj.isMesh) {
    applyModeToMesh(obj, mode, key);
  }
}

function applyModeToMesh(mesh, mode, key) {
  // Don't overwrite the glass canopy material
  if (key === 'cog') return;
  if (key === 'canopy') {
    mesh.material.wireframe = mode === 'wireframe';
    mesh.material.opacity   = mode === 'xray' ? 0.15 : 0.35;
    return;
  }
  if (mode === 'solid') {
    mesh.material.wireframe    = false;
    mesh.material.transparent  = false;
    mesh.material.opacity      = 1;
    mesh.material.depthWrite   = true;
  } else if (mode === 'wireframe') {
    mesh.material.wireframe    = true;
    mesh.material.transparent  = false;
    mesh.material.opacity      = 1;
  } else if (mode === 'xray') {
    mesh.material.wireframe    = false;
    mesh.material.transparent  = true;
    mesh.material.opacity      = 0.22;
    mesh.material.depthWrite   = false;
  }
}

// ─── Visibility Toggles ───────────────────────────────────────────────────────
function applyVisibility() {
  for (const [key, meshes] of Object.entries(meshGroups)) {
    const vis = visibility[key] !== false;
    for (const m of meshes) m.visible = vis;
  }
}

function toggleVisibility(key) {
  visibility[key] = !visibility[key];
  applyVisibility();
  // Update toggle icon
  const toggle = document.querySelector(`.vis-toggle[data-target="${key}"]`);
  if (toggle) toggle.classList.toggle('off', !visibility[key]);
}

// Assembly tree visibility toggles
document.querySelectorAll('.vis-toggle').forEach(btn => {
  btn.addEventListener('click', e => {
    e.stopPropagation();
    toggleVisibility(btn.dataset.target);
  });
});

// Assembly tree active state
document.querySelectorAll('.tree-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.tree-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
  });
});

// Collapse sidebars
document.getElementById('left-collapse').addEventListener('click', () =>
  document.getElementById('left-sidebar').classList.toggle('collapsed'));
document.getElementById('right-collapse').addEventListener('click', () =>
  document.getElementById('right-sidebar').classList.toggle('collapsed'));

// ─── View Mode Buttons ────────────────────────────────────────────────────────
document.querySelectorAll('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.viewMode = btn.dataset.mode;
    applyViewMode();
  });
});

// ─── Camera Presets ───────────────────────────────────────────────────────────
const CAM_PRESETS = {
  iso:   { pos: [30, 14, 48],   target: [0, 0, 0] },
  top:   { pos: [0, 80, 0.01],  target: [0, 0, 0] },
  front: { pos: [-80, 0, 0],    target: [0, 0, 0] },
  side:  { pos: [0, 2, 70],     target: [0, 0, 0] },
  rear:  { pos: [80, 4, 0],     target: [0, 0, 0] },
};

document.querySelectorAll('.cam-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const p = CAM_PRESETS[btn.dataset.cam];
    if (!p) return;
    camera.position.set(...p.pos);
    controls.target.set(...p.target);
    controls.update();
  });
});

// ─── Slider/Input Binding ─────────────────────────────────────────────────────
function bindSlider(sliderId, numId, stateKey, onChanged) {
  const sl = document.getElementById(sliderId);
  const nm = document.getElementById(numId);
  if (!sl || !nm) return;

  function sync(val) {
    const v = parseFloat(val);
    state[stateKey] = v;
    sl.value = v; nm.value = v;
    updateTrack(sl);
    onChanged();
  }
  sl.addEventListener('input', () => sync(sl.value));
  nm.addEventListener('change', () => {
    const clamped = Math.min(parseFloat(nm.max), Math.max(parseFloat(nm.min), parseFloat(nm.value)));
    sync(clamped);
  });
  updateTrack(sl);
}

function updateTrack(sl) {
  const pct = ((parseFloat(sl.value) - parseFloat(sl.min)) / (parseFloat(sl.max) - parseFloat(sl.min))) * 100;
  sl.style.setProperty('--progress', `${pct}%`);
}

function bindToggle(id, stateKey, onChanged) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('change', () => { state[stateKey] = el.checked; onChanged(); });
}

function bindSelect(id, stateKey, onChanged) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('change', () => { state[stateKey] = el.value; onChanged(); });
}

function syncUIFromState() {
  const pairs = [
    ['fuse-length','fuse-length-num','fuseLength'],
    ['fuse-diameter','fuse-diameter-num','fuseDiameter'],
    ['fuse-nose','fuse-nose-num','fuseNose'],
    ['fuse-taper','fuse-taper-num','fuseTaper'],
    ['canopy-length','canopy-length-num','canopyLength'],
    ['canopy-width','canopy-width-num','canopyWidth'],
    ['canopy-height','canopy-height-num','canopyHeight'],
    ['wing-span','wing-span-num','wingSpan'],
    ['wing-chord','wing-chord-num','wingChord'],
    ['wing-taper','wing-taper-num','wingTaper'],
    ['wing-sweep','wing-sweep-num','wingSweep'],
    ['wing-dihedral','wing-dihedral-num','wingDihedral'],
    ['wing-pos','wing-pos-num','wingPos'],
    ['winglet-height','winglet-height-num','wingletHeight'],
    ['winglet-cant','winglet-cant-num','wingletCant'],
    ['winglet-sweep','winglet-sweep-num','wingletSweep'],
    ['hstab-span','hstab-span-num','hstabSpan'],
    ['hstab-chord','hstab-chord-num','hstabChord'],
    ['hstab-sweep','hstab-sweep-num','hstabSweep'],
    ['hstab-dihedral','hstab-dihedral-num','hstabDihedral'],
    ['vstab-height','vstab-height-num','vstabHeight'],
    ['vstab-chord','vstab-chord-num','vstabChord'],
    ['vstab-sweep','vstab-sweep-num','vstabSweep'],
    ['vstab-taper','vstab-taper-num','vstabTaper'],
    ['engine-diameter','engine-diameter-num','engineDiameter'],
    ['engine-length','engine-length-num','engineLength'],
    ['engine-spanpos','engine-spanpos-num','engineSpanPos'],
    ['gear-strut','gear-strut-num','gearStrut'],
    ['gear-radius','gear-radius-num','gearRadius'],
  ];
  pairs.forEach(([slId, numId, key]) => {
    const sl = document.getElementById(slId), nm = document.getElementById(numId);
    if (sl) { sl.value = state[key]; updateTrack(sl); }
    if (nm) nm.value = state[key];
  });
  const nacaEl = document.getElementById('naca-code');
  if (nacaEl) nacaEl.value = state.nacaCode;
  const matEl = document.getElementById('material-select');
  if (matEl) matEl.value = state.material;
  const canopyEl = document.getElementById('canopy-show');
  if (canopyEl) canopyEl.checked = state.canopyShow;
  const wingletsEl = document.getElementById('winglets-show');
  if (wingletsEl) wingletsEl.checked = state.wingletsShow;
  const gearEl = document.getElementById('gear-show');
  if (gearEl) gearEl.checked = state.gearShow;
  const engCountEl = document.getElementById('engine-count');
  if (engCountEl) engCountEl.value = state.engineCount;
  const engPosEl = document.getElementById('engine-pos');
  if (engPosEl) engPosEl.value = state.enginePos;
  const gearTypeEl = document.getElementById('gear-type');
  if (gearTypeEl) gearTypeEl.value = state.gearType;
}

// ─── Wire All Controls ────────────────────────────────────────────────────────
function bindAll() {
  // Fuselage
  bindSlider('fuse-length','fuse-length-num','fuseLength', rebuildScene);
  bindSlider('fuse-diameter','fuse-diameter-num','fuseDiameter', rebuildScene);
  bindSlider('fuse-nose','fuse-nose-num','fuseNose', rebuildScene);
  bindSlider('fuse-taper','fuse-taper-num','fuseTaper', rebuildScene);

  // Canopy
  bindToggle('canopy-show','canopyShow', rebuildScene);
  bindSlider('canopy-length','canopy-length-num','canopyLength', rebuildScene);
  bindSlider('canopy-width','canopy-width-num','canopyWidth', rebuildScene);
  bindSlider('canopy-height','canopy-height-num','canopyHeight', rebuildScene);

  // Wings
  bindSlider('wing-span','wing-span-num','wingSpan', rebuildScene);
  bindSlider('wing-chord','wing-chord-num','wingChord', rebuildScene);
  bindSlider('wing-taper','wing-taper-num','wingTaper', rebuildScene);
  bindSlider('wing-sweep','wing-sweep-num','wingSweep', rebuildScene);
  bindSlider('wing-dihedral','wing-dihedral-num','wingDihedral', rebuildScene);
  bindSlider('wing-pos','wing-pos-num','wingPos', rebuildScene);

  document.getElementById('btn-apply-naca').addEventListener('click', () => {
    const code = document.getElementById('naca-code').value.trim();
    if (/^\d{4}$/.test(code)) {
      state.nacaCode = code;
      buildWings(); buildWinglets();
      updateTelemetry();
      console.log(`[AeroCAD] NACA=${code}`);
    } else showNotification('Invalid NACA code — 4 digits required (e.g. 2412)', 'error');
  });

  // Winglets
  bindToggle('winglets-show','wingletsShow', rebuildScene);
  bindSlider('winglet-height','winglet-height-num','wingletHeight', rebuildScene);
  bindSlider('winglet-cant','winglet-cant-num','wingletCant', rebuildScene);
  bindSlider('winglet-sweep','winglet-sweep-num','wingletSweep', rebuildScene);

  // H-Stab
  bindSlider('hstab-span','hstab-span-num','hstabSpan', rebuildScene);
  bindSlider('hstab-chord','hstab-chord-num','hstabChord', rebuildScene);
  bindSlider('hstab-sweep','hstab-sweep-num','hstabSweep', rebuildScene);
  bindSlider('hstab-dihedral','hstab-dihedral-num','hstabDihedral', rebuildScene);

  // V-Stab
  bindSlider('vstab-height','vstab-height-num','vstabHeight', rebuildScene);
  bindSlider('vstab-chord','vstab-chord-num','vstabChord', rebuildScene);
  bindSlider('vstab-sweep','vstab-sweep-num','vstabSweep', rebuildScene);
  bindSlider('vstab-taper','vstab-taper-num','vstabTaper', rebuildScene);

  // Engines
  bindSelect('engine-count','engineCount', () => { state.engineCount = parseInt(document.getElementById('engine-count').value); rebuildScene(); });
  bindSelect('engine-pos','enginePos', rebuildScene);
  bindSlider('engine-diameter','engine-diameter-num','engineDiameter', rebuildScene);
  bindSlider('engine-length','engine-length-num','engineLength', rebuildScene);
  bindSlider('engine-spanpos','engine-spanpos-num','engineSpanPos', rebuildScene);

  // Landing gear
  bindToggle('gear-show','gearShow', rebuildScene);
  bindSelect('gear-type','gearType', rebuildScene);
  bindSlider('gear-strut','gear-strut-num','gearStrut', rebuildScene);
  bindSlider('gear-radius','gear-radius-num','gearRadius', rebuildScene);

  // Material
  document.getElementById('material-select').addEventListener('change', e => {
    state.material = e.target.value;
    rebuildScene();
    console.log(`[AeroCAD] Material=${e.target.value}`);
  });
}

// ─── API ──────────────────────────────────────────────────────────────────────
const API = '/api';

async function checkHealth() {
  try {
    const r = await fetch(`${API}/healthz`);
    const ok = r.ok;
    document.getElementById('status-dot').className = 'status-dot ' + (ok ? 'online' : 'offline');
    document.getElementById('status-label').textContent = ok ? 'Online' : 'Offline';
  } catch {
    document.getElementById('status-dot').className = 'status-dot offline';
    document.getElementById('status-label').textContent = 'Offline';
  }
}

async function loadProjectList() {
  try {
    const r = await fetch(`${API}/projects`);
    if (!r.ok) return;
    const list = await r.json();
    const sel = document.getElementById('project-load-select');
    sel.innerHTML = '<option value="">Load Project...</option>';
    list.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id; opt.textContent = p.projectName;
      sel.appendChild(opt);
    });
  } catch (e) { console.warn('[AeroCAD] Project list error:', e.message); }
}

document.getElementById('btn-save').addEventListener('click', async () => {
  const name = document.getElementById('project-name-input').value.trim() || 'Untitled';
  const payload = { projectName: name, geometry: { ...state } };
  try {
    const r = await fetch(`${API}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const saved = await r.json();
    showNotification(`Saved "${name}" (${saved.id.slice(0,8)}…)`, 'success');
    await loadProjectList();
    console.log('[AeroCAD] Saved:', saved.id);
  } catch (e) {
    showNotification(`Save failed: ${e.message}`, 'error');
  }
});

document.getElementById('btn-load').addEventListener('click', async () => {
  const id = document.getElementById('project-load-select').value;
  if (!id) { showNotification('Select a project to load', 'error'); return; }
  try {
    const r = await fetch(`${API}/projects/${id}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const project = await r.json();
    const g = project.geometry;
    // Merge geometry into state
    for (const key of Object.keys(state)) {
      if (g[key] !== undefined) state[key] = g[key];
    }
    syncUIFromState();
    rebuildScene();
    document.getElementById('project-name-input').value = project.projectName;
    showNotification(`Loaded "${project.projectName}"`, 'success');
    console.log('[AeroCAD] Loaded:', id);
  } catch (e) {
    showNotification(`Load failed: ${e.message}`, 'error');
  }
});

// ─── Export STL ───────────────────────────────────────────────────────────────
document.getElementById('btn-export').addEventListener('click', () => {
  const exporter = new STLExporter();
  const group = new THREE.Group();

  for (const [key, meshes] of Object.entries(meshGroups)) {
    if (key === 'cog') continue;
    for (const m of meshes) {
      if (m.isGroup) {
        m.traverse(child => { if (child.isMesh) group.add(child.clone()); });
      } else if (m.isMesh) {
        group.add(m.clone());
      }
    }
  }

  const stl = exporter.parse(group, { binary: false });
  const blob = new Blob([stl], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aerocad_${document.getElementById('project-name-input').value || 'export'}.stl`;
  a.click();
  URL.revokeObjectURL(url);
  showNotification('STL exported', 'success');
  console.log('[AeroCAD] STL exported');
});

// ─── Screenshot PNG ───────────────────────────────────────────────────────────
document.getElementById('btn-screenshot').addEventListener('click', () => {
  renderer.render(scene, camera);
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aerocad_${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Screenshot saved as PNG', 'success');
  });
});

// ─── Notification ─────────────────────────────────────────────────────────────
let notifTimer = null;
function showNotification(msg, type = 'info') {
  const el = document.getElementById('notification');
  el.textContent = msg;
  el.className = `notification ${type}`;
  clearTimeout(notifTimer);
  notifTimer = setTimeout(() => el.classList.add('hidden'), 3500);
}

// ─── Resize ───────────────────────────────────────────────────────────────────
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
onResize();

// ─── Render Loop ──────────────────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
bindAll();
rebuildScene();
checkHealth();
loadProjectList();
setInterval(checkHealth, 10000);
animate();
