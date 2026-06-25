/**
 * AeroCAD — Aerospace Conceptual CAD Tool
 * script.js: Three.js 3D engine, NACA math, parametric geometry,
 *            mass properties, STL export, and backend API integration.
 *
 * Coordinate convention (world space):
 *   X+ = right (span direction)
 *   Y+ = up   (vertical / dihedral lift)
 *   Z+ = aft  (tail direction, nose at -Z)
 */

import * as THREE from 'three';
import { OrbitControls }  from 'three/addons/controls/OrbitControls.js';
import { STLExporter }    from 'three/addons/exporters/STLExporter.js';

// ─────────────────────────────────────────────────────────────────────────────
// 1. CONSTANTS & STATE
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = 'http://localhost:8000';

const MATERIALS = {
  aluminum:    { name: 'Aluminum 7075',        density: 2810, color: 0xb0b8c8 },
  titanium:    { name: 'Titanium Grade 5',     density: 4430, color: 0x8b8a7a },
  carbonFiber: { name: 'Carbon Fiber Composite', density: 1600, color: 0x2a2e38 },
};

/** Live parametric state — single source of truth */
let p = {
  naca:              '2412',
  wingspan:          10,
  chord:             2,
  taperRatio:        1.0,
  sweep:             15,
  dihedral:          5,
  twistAngle:        0,
  fuseLength:        8,
  fuseDiam:          1.2,
  noseConeSharpness: 2,
  material:          'aluminum',
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. THREE.JS SCENE GLOBALS
// ─────────────────────────────────────────────────────────────────────────────

let scene, camera, renderer, controls;
let wingMeshLeft, wingMeshRight, fuseMesh, cogMarker;
let gridHelper;
let sceneGroup;           // parent group for all geometry
let wireframeMode = false;

const wingMat  = new THREE.MeshPhongMaterial({ side: THREE.DoubleSide, shininess: 80 });
const fuseMat  = new THREE.MeshPhongMaterial({ side: THREE.DoubleSide, shininess: 120 });
const cogMat   = new THREE.MeshBasicMaterial({ color: 0xffab00, wireframe: true });

// ─────────────────────────────────────────────────────────────────────────────
// 3. NACA 4-DIGIT AIRFOIL ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute thickness, camber, and slope at normalized chord position x ∈ [0,1].
 * Returns { yt, yc, dyc_dx, theta } — all normalized (divide by chord to get real coords).
 */
function nasoCalc(x, M, P, t) {
  // NACA 4-digit thickness distribution (open trailing edge)
  const yt = (t / 0.2) * (
     0.2969 * Math.sqrt(Math.max(x, 0))
   - 0.1260 * x
   - 0.3516 * x * x
   + 0.2843 * x * x * x
   - 0.1015 * x * x * x * x
  );

  let yc, dyc_dx;
  if (M === 0 || P === 0) {
    yc = 0; dyc_dx = 0;
  } else if (x < P) {
    yc      = (M / (P * P))           * (2 * P * x - x * x);
    dyc_dx  = (2 * M / (P * P))       * (P - x);
  } else {
    yc      = (M / ((1 - P) * (1 - P))) * (1 - 2 * P + 2 * P * x - x * x);
    dyc_dx  = (2 * M / ((1 - P) * (1 - P))) * (P - x);
  }

  const theta = Math.atan(dyc_dx);
  return { yt, yc, theta };
}

/**
 * Generate full closed airfoil contour for a NACA 4-digit code.
 * Returns an array of {nx, ny} normalized points tracing:
 *   upper surface LE → TE, then lower surface TE → LE (closed loop).
 * @param {string} code  e.g. '2412'
 * @param {number} N     number of points per surface
 */
function generateNACAContour(code, N = 60) {
  const raw = code.replace(/\s/g, '').padStart(4, '0');
  const M = parseInt(raw[0]) / 100;           // max camber
  const P = parseInt(raw[1]) / 10;            // position of max camber
  const t = parseInt(raw.slice(2)) / 100;     // max thickness

  const upper = [];
  const lower = [];

  for (let i = 0; i <= N; i++) {
    // Cosine spacing — denser near LE for accuracy
    const beta = (i / N) * Math.PI;
    const x    = (1 - Math.cos(beta)) / 2;
    const { yt, yc, theta } = nasoCalc(x, M, P, t);

    upper.push({ nx: x - yt * Math.sin(theta), ny: yc + yt * Math.cos(theta) });
    lower.push({ nx: x + yt * Math.sin(theta), ny: yc - yt * Math.cos(theta) });
  }

  // Full contour: upper (LE→TE) then lower reversed (TE→LE), skip duplicate endpoints
  const contour = [...upper];
  for (let i = lower.length - 2; i >= 1; i--) {
    contour.push(lower[i]);
  }
  return contour; // closed polygon, first ≈ last ≈ TE
}

/**
 * Calculate approximate cross-sectional area of the airfoil using the
 * shoelace formula on the normalized contour, multiplied by chord².
 */
function airfoilArea(contour, chord) {
  let area = 0;
  const n = contour.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += contour[i].nx * contour[j].ny;
    area -= contour[j].nx * contour[i].ny;
  }
  return Math.abs(area) / 2 * chord * chord;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. GEOMETRY BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a single half-wing BufferGeometry from the airfoil contour.
 * @param {Object} params  - current parametric state
 * @param {number} side    - +1 = right wing, -1 = left wing
 */
function buildHalfWingGeometry(params, side) {
  const contour = generateNACAContour(params.naca, 55);
  const nPts    = contour.length;

  const halfSpan      = params.wingspan / 2;
  const rootChord     = params.chord;
  const tipChord      = rootChord * params.taperRatio;
  const sweepOffset   = halfSpan * Math.tan(params.sweep * Math.PI / 180);
  const dihedralDY    = halfSpan * Math.tan(params.dihedral * Math.PI / 180);
  const twistRad      = params.twistAngle * Math.PI / 180;

  // LE position: place quarter-chord at X=0 along fuselage
  const rootLE_Z = -rootChord * 0.25;
  const tipLE_Z  = rootLE_Z + sweepOffset;   // sweep shifts tip LE aft (+Z)

  const positions = [];
  const indices   = [];

  // Helper: push a vertex in world space
  // Root profile: at X = 0, chord in Z, thickness in Y
  const pushRoot = ({ nx, ny }) => {
    positions.push(
      0,                         // X (span position)
      ny * rootChord,            // Y (thickness)
      nx * rootChord + rootLE_Z  // Z (chord position)
    );
  };

  // Tip profile: at X = halfSpan * side, with dihedral, sweep, and geometric twist.
  // True 2D rotation of the cross-section around the quarter-chord (normalized 0.25).
  const pushTip = ({ nx, ny }) => {
    const pivotX = 0.25;                        // quarter-chord pivot (normalized)
    const effTwist = twistRad * side;           // washout: left/right symmetric
    const cosT = Math.cos(effTwist);
    const sinT = Math.sin(effTwist);
    // Translate so pivot is at origin, rotate in the chord-thickness (XY) plane, translate back
    const dx  = nx - pivotX;
    const nxR = dx * cosT - ny * sinT + pivotX; // rotated chord position
    const nyR = dx * sinT + ny * cosT;           // rotated thickness position
    positions.push(
      halfSpan * side,
      nyR * tipChord + dihedralDY * Math.abs(side),
      nxR * tipChord + tipLE_Z
    );
  };

  // Root vertices: indices 0 … nPts-1
  for (const pt of contour) pushRoot(pt);
  // Tip  vertices: indices nPts … 2*nPts-1
  for (const pt of contour) pushTip(pt);

  // Build triangle strip between root and tip edges (including closing segment).
  // nPts vertices form a closed loop; connect i → (i+1) % nPts for all i.
  for (let i = 0; i < nPts; i++) {
    const r0 = i,             r1 = (i + 1) % nPts;
    const t0 = nPts + i,      t1 = nPts + (i + 1) % nPts;
    if (side > 0) {
      indices.push(r0, r1, t0);
      indices.push(r1, t1, t0);
    } else {
      indices.push(r0, t0, r1);
      indices.push(r1, t0, t1);
    }
  }

  // Cap the root face — fan triangulation from centroid (all nPts segments, closed).
  const rootSumX = contour.reduce((s, q) => s + q.nx, 0) / nPts;
  const rootSumY = contour.reduce((s, q) => s + q.ny, 0) / nPts;
  const centerIdx = positions.length / 3;
  positions.push(0, rootSumY * rootChord, rootSumX * rootChord + rootLE_Z);
  for (let i = 0; i < nPts; i++) {
    const i1 = (i + 1) % nPts;
    if (side > 0) {
      indices.push(centerIdx, i1, i);
    } else {
      indices.push(centerIdx, i, i1);
    }
  }

  // Cap the tip face — fan triangulation from tip centroid (all nPts segments, closed).
  const tipSumX = contour.reduce((s, q) => s + q.nx, 0) / nPts;
  const tipSumY = contour.reduce((s, q) => s + q.ny, 0) / nPts;
  const tipCenterIdx = positions.length / 3;
  positions.push(halfSpan * side, tipSumY * tipChord + dihedralDY * Math.abs(side), tipSumX * tipChord + tipLE_Z);
  for (let i = 0; i < nPts; i++) {
    const i1 = (i + 1) % nPts;
    if (side > 0) {
      indices.push(tipCenterIdx, nPts + i, nPts + i1);
    } else {
      indices.push(tipCenterIdx, nPts + i1, nPts + i);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Build fuselage geometry using LatheGeometry (body of revolution around Y),
 * then rotate the mesh to align with the Z axis.
 * Nose tip at Z = -fuseLength/2, tail at Z = +fuseLength/2.
 */
function buildFuselageGeometry(params) {
  const R        = params.fuseDiam / 2;
  const L        = params.fuseLength;
  const S        = Math.max(0.5, params.noseConeSharpness); // fineness ratio
  const noseLen  = R * 2 * S;  // nose cone length = diameter × fineness

  const lathePoints = [];

  // Nose tip at local Y = 0
  lathePoints.push(new THREE.Vector2(0, 0));

  // Nose cone profile — ogive (power-law: r = R * (y/noseLen)^0.5 → rounded
  // sharpness 0.5 = very blunt, 5 = very sharp
  const NosePts = 24;
  for (let i = 1; i <= NosePts; i++) {
    const t = i / NosePts;
    const y = t * noseLen;
    // Exponent: 1/fineness → higher fineness = sharper tip shape
    const exponent = 0.5 + 0.3 * (S - 0.5);
    const r = R * Math.pow(t, 1 / exponent);
    lathePoints.push(new THREE.Vector2(r, y));
  }

  // Transition shoulder
  lathePoints.push(new THREE.Vector2(R, noseLen + 0.001));

  // Straight cylindrical body
  const bodyEnd = L - R * 0.4;  // slight tail taper starts here
  lathePoints.push(new THREE.Vector2(R, bodyEnd));

  // Tail taper (boat-tail)
  const TailPts = 8;
  for (let i = 1; i <= TailPts; i++) {
    const t = i / TailPts;
    const y = bodyEnd + t * (L - bodyEnd);
    const r = R * (1 - 0.3 * t);   // taper to 70% radius
    lathePoints.push(new THREE.Vector2(r, y));
  }

  return new THREE.LatheGeometry(lathePoints, 48);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. MASS PROPERTIES CALCULATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate volume, mass, and CoG for the current parametric state.
 * Returns { wingVolume, fuseVolume, totalMass, wingMass, fuseMass, cog, wingArea, AR }
 */
function calculateMassProperties() {
  const mat  = MATERIALS[p.material];
  const rho  = mat.density;  // kg/m³

  // ── Wing ──
  const contour     = generateNACAContour(p.naca, 60);
  const rootArea    = airfoilArea(contour, p.chord);
  const tipArea     = airfoilArea(contour, p.chord * p.taperRatio);
  // Trapezoidal rule for volume along span
  const halfSpan    = p.wingspan / 2;
  // Cross-section area varies linearly with chord (area ∝ chord²)
  const wingVolume  = 2 * (rootArea + tipArea) / 2 * halfSpan;

  // Wing planform area (trapezoidal rule): S = (rootChord + tipChord)/2 × span
  const avgChord  = (p.chord + p.chord * p.taperRatio) / 2;
  const wingArea  = avgChord * p.wingspan;
  const AR        = (p.wingspan * p.wingspan) / wingArea;

  const wingMass  = wingVolume * rho;

  // ── Fuselage ──
  // Volume decomposed to match the LatheGeometry profile exactly:
  //   nose ogive: y in [0, noseLen]
  //   cylinder body: y in [noseLen, bodyEnd]   (bodyEnd = L - tailLen)
  //   tail frustum: y in [bodyEnd, L]
  const R        = p.fuseDiam / 2;
  const noseLen  = R * 2 * p.noseConeSharpness;
  const tailLen  = R * 0.4;
  const bodyEnd  = p.fuseLength - tailLen;
  const bodyLen  = Math.max(0, bodyEnd - noseLen);
  // Nose ogive ≈ half-ellipsoid: V = (2/3) π R² h
  const noseVol  = (2 / 3) * Math.PI * R * R * Math.min(noseLen, p.fuseLength);
  // Straight cylinder (between nose shoulder and tail taper start)
  const cylVol   = Math.PI * R * R * bodyLen;
  // Tail frustum taper from R to 0.7*R
  const R2       = R * 0.7;
  const tailVol  = (Math.PI * tailLen / 3) * (R * R + R * R2 + R2 * R2);
  const fuseVolume = noseVol + cylVol + tailVol;
  const fuseMass   = fuseVolume * rho;

  const totalMass = wingMass + fuseMass;

  // ── Center of Gravity ──
  // Wing CoG: at 40% chord from LE, at mid-span, mid-dihedral
  const rootLE_Z  = -p.chord * 0.25;
  const sweepOff  = halfSpan * Math.tan(p.sweep * Math.PI / 180);
  const tipLE_Z   = rootLE_Z + sweepOff;
  const avgLE_Z   = (rootLE_Z + tipLE_Z) / 2;
  const avgChordZ = (p.chord + p.chord * p.taperRatio) / 2;
  const wingCoG_Z = avgLE_Z + 0.4 * avgChordZ;
  const wingCoG_Y = halfSpan * Math.tan(p.dihedral * Math.PI / 180) * 0.5;
  const wingCoG   = new THREE.Vector3(0, wingCoG_Y, wingCoG_Z);

  // Fuselage CoG: at ~42% of total length from nose, centred in Y/X
  const fuseCoG_Z = -p.fuseLength / 2 + 0.42 * p.fuseLength;
  const fuseCoG   = new THREE.Vector3(0, 0, fuseCoG_Z);

  // Weighted average
  const cog = new THREE.Vector3(
    (wingCoG.x * wingMass + fuseCoG.x * fuseMass) / totalMass,
    (wingCoG.y * wingMass + fuseCoG.y * fuseMass) / totalMass,
    (wingCoG.z * wingMass + fuseCoG.z * fuseMass) / totalMass
  );

  return { wingVolume, fuseVolume, totalMass, wingMass, fuseMass, cog, wingArea, AR };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. THREE.JS SCENE INITIALISATION
// ─────────────────────────────────────────────────────────────────────────────

function initScene() {
  const canvas = document.getElementById('viewport');

  // ── Renderer ──
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
  renderer.toneMapping       = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.setClearColor(0x0d0d12, 1);

  // ── Scene ──
  scene      = new THREE.Scene();
  scene.fog  = new THREE.FogExp2(0x0d0d12, 0.008);
  sceneGroup = new THREE.Group();
  scene.add(sceneGroup);

  // ── Camera ──
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 2000);
  camera.position.set(18, 9, 22);
  camera.lookAt(0, 0, 0);

  // ── OrbitControls ──
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping    = true;
  controls.dampingFactor    = 0.07;
  controls.screenSpacePanning = true;
  controls.minDistance      = 0.5;
  controls.maxDistance      = 500;
  controls.target.set(0, 0, 0);
  controls.update();

  // ── Lighting ──
  const ambient = new THREE.AmbientLight(0x1a2240, 0.6);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff5e0, 1.4);
  sun.position.set(30, 50, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  scene.add(sun);

  const fillLight = new THREE.DirectionalLight(0x0055aa, 0.5);
  fillLight.position.set(-20, -10, -30);
  scene.add(fillLight);

  const rimLight = new THREE.PointLight(0x00e5ff, 0.8, 120);
  rimLight.position.set(-15, 20, -10);
  scene.add(rimLight);

  // ── Grid ──
  rebuildGrid(60);

  // ── Axes Helper ──
  const axes = new THREE.AxesHelper(5);
  scene.add(axes);

  // ── CoG Marker (sphere wireframe) ──
  const cogGeo = new THREE.SphereGeometry(0.18, 16, 12);
  cogMarker    = new THREE.Mesh(cogGeo, cogMat);
  scene.add(cogMarker);

  // ── Window resize ──
  window.addEventListener('resize', onResize);
}

function rebuildGrid(size) {
  if (gridHelper) scene.remove(gridHelper);
  gridHelper = new THREE.GridHelper(size, size / 2, 0x1a1a2e, 0x1a1a2e);
  gridHelper.material.opacity    = 0.6;
  gridHelper.material.transparent = true;
  gridHelper.position.y = -2;
  scene.add(gridHelper);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. GEOMETRY UPDATE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Dispose old geometry + remove mesh from scene group, return mesh ref. */
function disposeMesh(mesh) {
  if (!mesh) return null;
  if (mesh.geometry) mesh.geometry.dispose();
  sceneGroup.remove(mesh);
  return null;
}

/** Update wing geometry based on current state p. */
function updateWing() {
  console.log('[CAD] Updating wing — NACA', p.naca, '| span', p.wingspan, 'm | chord', p.chord, 'm');

  wingMeshLeft  = disposeMesh(wingMeshLeft);
  wingMeshRight = disposeMesh(wingMeshRight);

  applyMaterialColor();

  const geoRight = buildHalfWingGeometry(p, +1);
  const geoLeft  = buildHalfWingGeometry(p, -1);

  wingMeshRight = new THREE.Mesh(geoRight, wingMat);
  wingMeshLeft  = new THREE.Mesh(geoLeft,  wingMat);

  wingMeshRight.castShadow    = true;
  wingMeshRight.receiveShadow = true;
  wingMeshLeft.castShadow     = true;
  wingMeshLeft.receiveShadow  = true;

  sceneGroup.add(wingMeshRight, wingMeshLeft);
  updateTelemetry();
}

/** Update fuselage geometry based on current state p. */
function updateFuselage() {
  console.log('[CAD] Updating fuselage — L', p.fuseLength, 'm | D', p.fuseDiam, 'm | nose', p.noseConeSharpness);

  fuseMesh = disposeMesh(fuseMesh);

  applyMaterialColor();

  const geo = buildFuselageGeometry(p);
  fuseMesh  = new THREE.Mesh(geo, fuseMat);

  // LatheGeometry is around Y; rotate so fuselage aligns with Z axis (nose in -Z).
  fuseMesh.rotation.x = Math.PI / 2;

  // After rotation, local Y (length) becomes world +Z.
  // nose tip (local y=0) → world z=0 after rotation.
  // Translate so nose is at z = -L/2 (centred).
  fuseMesh.position.z = -p.fuseLength / 2;

  fuseMesh.castShadow    = true;
  fuseMesh.receiveShadow = true;

  sceneGroup.add(fuseMesh);
  updateTelemetry();
}

/** Move CoG sphere to calculated CoG position. */
function updateCoG() {
  const mp = calculateMassProperties();
  cogMarker.position.copy(mp.cog);
}

/** Recalculate and display all telemetry values. */
function updateTelemetry() {
  const mp = calculateMassProperties();
  updateCoG();

  const fmt = (v, dec = 2) => isFinite(v) ? v.toFixed(dec) : '—';

  document.getElementById('t-mass').textContent     = fmt(mp.totalMass, 1);
  document.getElementById('t-wingmass').textContent  = fmt(mp.wingMass,  1);
  document.getElementById('t-fusemass').textContent  = fmt(mp.fuseMass,  1);
  document.getElementById('t-wingvol').textContent   = fmt(mp.wingVolume, 3);
  document.getElementById('t-fusevol').textContent   = fmt(mp.fuseVolume, 3);
  document.getElementById('t-wingarea').textContent  = fmt(mp.wingArea,  2);
  document.getElementById('t-ar').textContent        = fmt(mp.AR, 2);
  document.getElementById('t-cog').textContent       =
    `${fmt(mp.cog.x,1)}, ${fmt(mp.cog.y,1)}, ${fmt(mp.cog.z,1)}`;
}

/** Apply material color to wing and fuselage meshes. */
function applyMaterialColor() {
  const matInfo = MATERIALS[p.material];
  wingMat.color.setHex(matInfo.color);
  fuseMat.color.setHex(matInfo.color);
  wingMat.wireframe = wireframeMode;
  fuseMat.wireframe = wireframeMode;
}

/** Full rebuild of all geometry. */
function rebuildAll() {
  updateWing();
  updateFuselage();
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. STL EXPORT
// ─────────────────────────────────────────────────────────────────────────────

function exportSTL() {
  const exporter    = new STLExporter();
  const exportGroup = new THREE.Group();

  // Only export visible solid meshes
  const toExport = [wingMeshLeft, wingMeshRight, fuseMesh].filter(Boolean);
  toExport.forEach(m => {
    const clone = m.clone();
    clone.updateMatrixWorld(true);
    exportGroup.add(clone);
  });
  exportGroup.updateMatrixWorld(true);

  const stlString = exporter.parse(exportGroup, { binary: false });
  const blob      = new Blob([stlString], { type: 'text/plain' });
  const url       = URL.createObjectURL(blob);
  const a         = document.createElement('a');
  a.href          = url;
  a.download      = `aerocad_${p.naca}_${p.wingspan}m.stl`;
  a.click();
  URL.revokeObjectURL(url);
  console.log('[CAD] STL exported');
  showToast('STL exported successfully!');
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. BACKEND API
// ─────────────────────────────────────────────────────────────────────────────

/** Pulse the connection dot and text based on backend reachability. */
async function checkConnection() {
  const dot  = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  dot.className  = 'dot checking';
  text.textContent = 'Connecting…';
  try {
    const r = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(4000) });
    if (r.ok) {
      dot.className  = 'dot online';
      text.textContent = 'Connected';
      await refreshProjectList();
    } else throw new Error('not ok');
  } catch {
    dot.className  = 'dot offline';
    text.textContent = 'Offline (local mode)';
  }
}

/** Save current parameters to backend. */
async function saveProject() {
  const projectName = document.getElementById('projectNameInput').value.trim() || 'Unnamed';
  const payload = {
    projectName,
    geometry: { ...p },
    metadata: { savedAt: new Date().toISOString() },
  };
  try {
    const r = await fetch(`${API_BASE}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    console.log('[API] Saved project:', data.id);
    showToast(`Project "${projectName}" saved!`);
    await refreshProjectList();
  } catch (err) {
    console.error('[API] Save failed:', err);
    showToast('Save failed — is the backend running?');
  }
}

/** Refresh the project dropdown list. */
async function refreshProjectList() {
  try {
    const r    = await fetch(`${API_BASE}/api/projects`, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return;
    const list = await r.json();
    const sel  = document.getElementById('loadSelect');
    // Preserve current selection
    const prev = sel.value;
    sel.innerHTML = '<option value="">Load project…</option>';
    list.forEach(proj => {
      const opt    = document.createElement('option');
      opt.value    = proj.id;
      opt.textContent = proj.projectName;
      sel.appendChild(opt);
    });
    if (prev) sel.value = prev;
  } catch { /* offline */ }
}

/** Load selected project from backend and apply parameters. */
async function loadProject() {
  const id = document.getElementById('loadSelect').value;
  if (!id) { showToast('Select a project to load.'); return; }
  try {
    const r    = await fetch(`${API_BASE}/api/projects/${id}`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const geo  = data.geometry || {};

    // Apply all loaded params to state
    Object.keys(p).forEach(k => {
      if (geo[k] !== undefined) p[k] = geo[k];
    });

    document.getElementById('projectNameInput').value = data.projectName || '';
    syncUIFromState();
    rebuildAll();
    showToast(`Loaded "${data.projectName}"!`);
    console.log('[API] Loaded project:', id);
  } catch (err) {
    console.error('[API] Load failed:', err);
    showToast('Load failed — project not found or backend offline.');
  }
}

/** Delete selected project from backend. */
async function deleteProject() {
  const id = document.getElementById('loadSelect').value;
  if (!id) { showToast('Select a project to delete.'); return; }
  try {
    const r = await fetch(`${API_BASE}/api/projects/${id}`, { method: 'DELETE', signal: AbortSignal.timeout(4000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    showToast('Project deleted.');
    await refreshProjectList();
  } catch (err) {
    console.error('[API] Delete failed:', err);
    showToast('Delete failed.');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. UI EVENT LISTENERS & SYNC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wire a slider + number input pair to a state key and rebuild callback.
 * Both inputs stay in sync. On change, the state is updated and rebuild() called.
 */
function bindSliderPair(sliderId, numId, stateKey, rebuild = rebuildAll) {
  const slider = document.getElementById(sliderId);
  const num    = document.getElementById(numId);
  if (!slider || !num) return;

  const update = (val) => {
    const v = parseFloat(val);
    if (!isFinite(v)) return;
    p[stateKey] = v;
    console.log(`[UI] ${stateKey} = ${v}`);
    rebuild();
  };

  slider.addEventListener('input', () => {
    num.value = slider.value;
    update(slider.value);
  });
  num.addEventListener('change', () => {
    slider.value = num.value;
    update(num.value);
  });
}

/** Apply current state p back into all UI controls. */
function syncUIFromState() {
  const setSlider = (sid, nid, val) => {
    const s = document.getElementById(sid);
    const n = document.getElementById(nid);
    if (s) s.value = val;
    if (n) n.value = val;
  };
  setSlider('wingspanSlider',  'wingspanNum',  p.wingspan);
  setSlider('chordSlider',     'chordNum',     p.chord);
  setSlider('taperSlider',     'taperNum',     p.taperRatio);
  setSlider('sweepSlider',     'sweepNum',     p.sweep);
  setSlider('dihedralSlider',  'dihedralNum',  p.dihedral);
  setSlider('twistSlider',     'twistNum',     p.twistAngle);
  setSlider('fuseLengthSlider','fuseLengthNum',p.fuseLength);
  setSlider('fuseDiamSlider',  'fuseDiamNum',  p.fuseDiam);
  setSlider('noseSharpSlider', 'noseSharpNum', p.noseConeSharpness);
  document.getElementById('nacaInput').value   = p.naca;
  document.getElementById('materialSelect').value = p.material;
}

function setupUI() {
  // ── Slider pairs ──
  bindSliderPair('wingspanSlider',  'wingspanNum',  'wingspan',          updateWing);
  bindSliderPair('chordSlider',     'chordNum',     'chord',             updateWing);
  bindSliderPair('taperSlider',     'taperNum',     'taperRatio',        updateWing);
  bindSliderPair('sweepSlider',     'sweepNum',     'sweep',             updateWing);
  bindSliderPair('dihedralSlider',  'dihedralNum',  'dihedral',          updateWing);
  bindSliderPair('twistSlider',     'twistNum',     'twistAngle',        updateWing);
  bindSliderPair('fuseLengthSlider','fuseLengthNum','fuseLength',        updateFuselage);
  bindSliderPair('fuseDiamSlider',  'fuseDiamNum',  'fuseDiam',          updateFuselage);
  bindSliderPair('noseSharpSlider', 'noseSharpNum', 'noseConeSharpness', updateFuselage);

  // ── NACA input ──
  const nacaApplyBtn = document.getElementById('nacaApplyBtn');
  const nacaInput    = document.getElementById('nacaInput');
  const applyNaca = () => {
    const raw = nacaInput.value.trim();
    if (!/^\d{4}$/.test(raw)) {
      showToast('NACA code must be exactly 4 digits (e.g. 2412)');
      return;
    }
    p.naca = raw;
    console.log('[UI] NACA =', raw);
    updateWing();
  };
  nacaApplyBtn.addEventListener('click', applyNaca);
  nacaInput.addEventListener('keydown', e => { if (e.key === 'Enter') applyNaca(); });

  // ── Material ──
  document.getElementById('materialSelect').addEventListener('change', e => {
    p.material = e.target.value;
    console.log('[UI] material =', p.material);
    applyMaterialColor();
    updateTelemetry();
  });

  // ── Opacity ──
  document.getElementById('opacitySlider').addEventListener('input', e => {
    const o = parseFloat(e.target.value);
    wingMat.transparent = o < 1;
    wingMat.opacity     = o;
    fuseMat.transparent = o < 1;
    fuseMat.opacity     = o;
  });

  // ── Grid size ──
  const gridSlider = document.getElementById('gridSlider');
  const gridNum    = document.getElementById('gridNum');
  const updateGrid = (val) => {
    const v = parseInt(val);
    if (isFinite(v)) rebuildGrid(v);
  };
  gridSlider.addEventListener('input', () => { gridNum.value = gridSlider.value; updateGrid(gridSlider.value); });
  gridNum.addEventListener('change',   () => { gridSlider.value = gridNum.value; updateGrid(gridNum.value); });

  // ── Toolbar buttons ──
  document.getElementById('saveBtn').addEventListener('click', saveProject);
  document.getElementById('loadBtn').addEventListener('click', loadProject);
  document.getElementById('deleteBtn').addEventListener('click', deleteProject);
  document.getElementById('exportBtn').addEventListener('click', exportSTL);

  // ── Frame All ──
  document.getElementById('frameBtn').addEventListener('click', () => {
    const box = new THREE.Box3().setFromObject(sceneGroup);
    if (box.isEmpty()) return;
    const center = new THREE.Vector3();
    const size   = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const dist   = maxDim / (2 * Math.tan((camera.fov / 2) * Math.PI / 180)) * 1.5;
    camera.position.set(center.x + dist * 0.6, center.y + dist * 0.4, center.z + dist * 0.8);
    camera.lookAt(center);
    controls.target.copy(center);
    controls.update();
  });

  // ── Wireframe Toggle ──
  document.getElementById('wireframeToggle').addEventListener('click', function () {
    wireframeMode = !wireframeMode;
    wingMat.wireframe = wireframeMode;
    fuseMat.wireframe = wireframeMode;
    this.textContent  = wireframeMode ? 'Solid' : 'Wireframe';
    this.style.color  = wireframeMode ? 'var(--accent)' : '';
  });

  // ── Assembly Tree visibility toggles ──
  document.querySelectorAll('.tree-item').forEach(item => {
    const visBtn = item.querySelector('.tree-vis');
    if (!visBtn) return;
    visBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const part = item.dataset.part;
      let mesh;
      if (part === 'fuselage')   mesh = fuseMesh;
      if (part === 'wing-left')  mesh = wingMeshLeft;
      if (part === 'wing-right') mesh = wingMeshRight;
      if (part === 'cog')        mesh = cogMarker;
      if (!mesh) return;
      mesh.visible = !mesh.visible;
      item.classList.toggle('hidden', !mesh.visible);
    });
    // Click row to select (highlight) in tree
    item.addEventListener('click', () => {
      document.querySelectorAll('.tree-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
    });
  });

  // ── Keyboard shortcuts ──
  window.addEventListener('keydown', e => {
    // F = frame all
    if (e.key === 'f' || e.key === 'F') document.getElementById('frameBtn').click();
    // W = wireframe
    if (e.key === 'w' || e.key === 'W') document.getElementById('wireframeToggle').click();
    // S + Ctrl = save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveProject(); }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. TOAST NOTIFICATION
// ─────────────────────────────────────────────────────────────────────────────

let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. ANIMATION LOOP
// ─────────────────────────────────────────────────────────────────────────────

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. BOOTSTRAP
// ─────────────────────────────────────────────────────────────────────────────

(function main() {
  initScene();
  setupUI();
  rebuildAll();
  animate();

  // Check backend connectivity and load project list
  checkConnection();
  // Re-check every 15 seconds
  setInterval(checkConnection, 15_000);

  console.log('[CAD] AeroCAD initialised — Three.js r160');
})();
