// ============================================================
// AeroForge CAD — Data Layer
// Materials DB, Aerospace Components, Physical Constants, ISA
// ============================================================

// ── Physical Constants ────────────────────────────────────────
export const CONST = {
  g0: 9.80665,          // m/s² standard gravity
  R_air: 287.058,       // J/(kg·K) specific gas constant air
  gamma: 1.4,           // ratio of specific heats air
  rho0: 1.225,          // kg/m³ sea-level density ISA
  T0: 288.15,           // K sea-level temperature ISA
  P0: 101325,           // Pa sea-level pressure ISA
  mu0: 1.789e-5,        // Pa·s dynamic viscosity
  R_earth: 6371000,     // m Earth radius
  GM: 3.986004418e14,   // m³/s² Earth gravitational parameter
  J2: 1.08263e-3,       // J2 oblateness coefficient
  c: 299792458,         // m/s speed of light
  sigma_sb: 5.67e-8,    // W/(m²·K⁴) Stefan-Boltzmann
}

// ── ISA Atmosphere Model (86 km) ─────────────────────────────
export function isa(altM) {
  const h = Math.max(0, altM)
  // Layers: [base_alt, base_temp, lapse_rate, base_pressure]
  const layers = [
    [0,      288.15, -0.0065, 101325],
    [11000,  216.65,  0,      22632.1],
    [20000,  216.65,  0.001,  5474.89],
    [32000,  228.65,  0.0028, 868.019],
    [47000,  270.65,  0,      110.906],
    [51000,  270.65, -0.0028, 66.9389],
    [71000,  214.65, -0.002,  3.95642],
    [86000,  186.87,  0,      0.3734],
  ]
  let layer = layers[0]
  for (const l of layers) { if (h >= l[0]) layer = l; else break }
  const [hb, Tb, lr, Pb] = layer
  const dh = h - hb
  let T, P
  if (Math.abs(lr) < 1e-10) {
    T = Tb
    P = Pb * Math.exp(-CONST.g0 * dh / (CONST.R_air * Tb))
  } else {
    T = Tb + lr * dh
    P = Pb * Math.pow(T / Tb, -CONST.g0 / (lr * CONST.R_air))
  }
  const rho = P / (CONST.R_air * T)
  const a   = Math.sqrt(CONST.gamma * CONST.R_air * T)
  const mu  = 1.458e-6 * T**1.5 / (T + 110.4)
  const nu  = mu / rho
  return { T, P, rho, a, mu, nu, h }
}

// ── Materials Database ────────────────────────────────────────
// Properties: density(kg/m³), E(GPa), G(GPa), nu, Sy(MPa), Su(MPa), Sc(MPa),
//             tau(MPa), CTE(1e-6/°C), k(W/m·K), Cp(J/kg·K), Tm(°C),
//             KIc(MPa√m), elongation(%), cost($/kg)
export const MATERIALS = {
  // ── Aluminum Alloys ──────────────────────────────────────────
  '2024-T3': {
    category: 'Aluminum Alloy', name: '2024-T3',
    density: 2780, E: 73.1, G: 28, nu: 0.33,
    Sy: 345, Su: 483, Sc: 345, tau: 283,
    CTE: 23.2, k: 121, Cp: 875, Tm: 638, Tmax: 150,
    KIc: 34, elongation: 18, cost: 4.5,
    desc: 'High-strength aircraft structural alloy, fatigue-resistant',
  },
  '2024-T4': {
    category: 'Aluminum Alloy', name: '2024-T4',
    density: 2780, E: 73.1, G: 28, nu: 0.33,
    Sy: 324, Su: 469, Sc: 290, tau: 276,
    CTE: 23.2, k: 121, Cp: 875, Tm: 638, Tmax: 150,
    KIc: 37, elongation: 20, cost: 4.5,
    desc: 'Solution heat-treated, good formability',
  },
  '6061-T6': {
    category: 'Aluminum Alloy', name: '6061-T6',
    density: 2700, E: 68.9, G: 26, nu: 0.33,
    Sy: 276, Su: 310, Sc: 276, tau: 207,
    CTE: 23.6, k: 167, Cp: 896, Tm: 652, Tmax: 150,
    KIc: 29, elongation: 12, cost: 3.2,
    desc: 'Versatile general-purpose alloy, excellent corrosion resistance',
  },
  '7075-T6': {
    category: 'Aluminum Alloy', name: '7075-T6',
    density: 2810, E: 71.7, G: 26.9, nu: 0.33,
    Sy: 503, Su: 572, Sc: 503, tau: 331,
    CTE: 23.6, k: 130, Cp: 960, Tm: 635, Tmax: 130,
    KIc: 29, elongation: 11, cost: 6.8,
    desc: 'Highest-strength aluminum, used in primary aircraft structure',
  },
  '7050-T7451': {
    category: 'Aluminum Alloy', name: '7050-T7451',
    density: 2830, E: 71.7, G: 26.9, nu: 0.33,
    Sy: 469, Su: 524, Sc: 469, tau: 303,
    CTE: 23.5, k: 157, Cp: 960, Tm: 635, Tmax: 130,
    KIc: 33, elongation: 13, cost: 8.5,
    desc: 'Improved stress-corrosion resistance vs 7075',
  },
  '2219-T87': {
    category: 'Aluminum Alloy', name: '2219-T87',
    density: 2840, E: 73.8, G: 28, nu: 0.33,
    Sy: 393, Su: 476, Sc: 393, tau: 262,
    CTE: 22.3, k: 116, Cp: 864, Tm: 643, Tmax: 300,
    KIc: 36, elongation: 10, cost: 9.0,
    desc: 'Cryogenic use (LH2 tanks), weldable, Space Shuttle ET alloy',
  },
  // ── Titanium Alloys ──────────────────────────────────────────
  'Ti-6Al-4V': {
    category: 'Titanium Alloy', name: 'Ti-6Al-4V',
    density: 4430, E: 113.8, G: 44, nu: 0.34,
    Sy: 880, Su: 950, Sc: 880, tau: 550,
    CTE: 8.6, k: 7.2, Cp: 560, Tm: 1660, Tmax: 315,
    KIc: 75, elongation: 14, cost: 35,
    desc: 'Workhorse aerospace titanium, excellent strength-to-weight',
  },
  'Ti-3Al-2.5V': {
    category: 'Titanium Alloy', name: 'Ti-3Al-2.5V',
    density: 4480, E: 103, G: 39, nu: 0.33,
    Sy: 620, Su: 690, Sc: 620, tau: 400,
    CTE: 9.5, k: 8.0, Cp: 540, Tm: 1660, Tmax: 260,
    KIc: 66, elongation: 18, cost: 28,
    desc: 'Tubing and hydraulic lines, good cold formability',
  },
  'Ti-6Al-2Sn-4Zr-2Mo': {
    category: 'Titanium Alloy', name: 'Ti-6242',
    density: 4540, E: 114, G: 44, nu: 0.33,
    Sy: 1000, Su: 1100, Sc: 1000, tau: 620,
    CTE: 8.4, k: 6.4, Cp: 540, Tm: 1650, Tmax: 540,
    KIc: 61, elongation: 10, cost: 55,
    desc: 'High-temperature compressor discs and blades',
  },
  // ── Steel Alloys ─────────────────────────────────────────────
  '4130': {
    category: 'Steel Alloy', name: 'AISI 4130',
    density: 7850, E: 205, G: 80, nu: 0.29,
    Sy: 435, Su: 670, Sc: 435, tau: 386,
    CTE: 12.3, k: 42.7, Cp: 477, Tm: 1450, Tmax: 400,
    KIc: 90, elongation: 25, cost: 2.5,
    desc: 'Chrome-moly steel, aircraft tubing, engine mounts',
  },
  '4340': {
    category: 'Steel Alloy', name: 'AISI 4340',
    density: 7850, E: 205, G: 80, nu: 0.29,
    Sy: 1033, Su: 1110, Sc: 1033, tau: 634,
    CTE: 12.3, k: 44.5, Cp: 477, Tm: 1450, Tmax: 400,
    KIc: 50, elongation: 12, cost: 3.2,
    desc: 'High-strength landing gear and structural steel',
  },
  '17-4PH': {
    category: 'Steel Alloy', name: '17-4PH (H900)',
    density: 7780, E: 197, G: 77, nu: 0.27,
    Sy: 1172, Su: 1310, Sc: 1172, tau: 760,
    CTE: 10.8, k: 17.9, Cp: 460, Tm: 1400, Tmax: 315,
    KIc: 55, elongation: 10, cost: 8.5,
    desc: 'Precipitation-hardening stainless, corrosion resistant',
  },
  '300M': {
    category: 'Steel Alloy', name: '300M',
    density: 7850, E: 207, G: 80, nu: 0.29,
    Sy: 1655, Su: 1931, Sc: 1655, tau: 1100,
    CTE: 12.0, k: 37, Cp: 460, Tm: 1450, Tmax: 300,
    KIc: 60, elongation: 8, cost: 15,
    desc: 'Ultra-high-strength steel for landing gear',
  },
  // ── Nickel Superalloys ───────────────────────────────────────
  'Inconel 718': {
    category: 'Nickel Superalloy', name: 'Inconel 718',
    density: 8190, E: 200, G: 77, nu: 0.29,
    Sy: 1034, Su: 1241, Sc: 1034, tau: 717,
    CTE: 13.0, k: 11.4, Cp: 435, Tm: 1336, Tmax: 650,
    KIc: 105, elongation: 12, cost: 65,
    desc: 'Most widely used superalloy, turbine discs and casings',
  },
  'Inconel 625': {
    category: 'Nickel Superalloy', name: 'Inconel 625',
    density: 8440, E: 208, G: 79, nu: 0.31,
    Sy: 517, Su: 930, Sc: 517, tau: 540,
    CTE: 12.8, k: 9.8, Cp: 410, Tm: 1350, Tmax: 980,
    KIc: 85, elongation: 42, cost: 55,
    desc: 'Excellent corrosion resistance, rocket thrust chambers',
  },
  'Waspaloy': {
    category: 'Nickel Superalloy', name: 'Waspaloy',
    density: 8200, E: 213, G: 82, nu: 0.30,
    Sy: 795, Su: 1275, Sc: 795, tau: 724,
    CTE: 12.7, k: 11.6, Cp: 397, Tm: 1330, Tmax: 870,
    KIc: 68, elongation: 25, cost: 80,
    desc: 'High-temperature turbine discs and blades',
  },
  'Haynes 188': {
    category: 'Nickel Superalloy', name: 'Haynes 188',
    density: 9130, E: 232, G: 90, nu: 0.30,
    Sy: 455, Su: 960, Sc: 455, tau: 555,
    CTE: 15.6, k: 11.9, Cp: 398, Tm: 1330, Tmax: 1080,
    KIc: 70, elongation: 48, cost: 95,
    desc: 'Combustor liners, highest oxidation resistance',
  },
  // ── CFRP Composites ──────────────────────────────────────────
  'IM7/8552': {
    category: 'CFRP', name: 'IM7/8552 (UD)',
    density: 1570, E: 165, G: 4.5, nu: 0.30,
    Sy: 2724, Su: 2724, Sc: 1690, tau: 142,
    CTE: -0.9, k: 4.1, Cp: 900, Tm: 370, Tmax: 150,
    KIc: 60, elongation: 1.7, cost: 120,
    E2: 8.7, G12: 4.5, nu12: 0.30, XT: 2724, XC: 1690, YT: 61, YC: 290, S: 142,
    desc: 'Intermediate-modulus UD tape, primary structure (Boeing 787)',
    isComposite: true,
  },
  'T700/M21': {
    category: 'CFRP', name: 'T700/M21 (UD)',
    density: 1590, E: 127, G: 4.2, nu: 0.30,
    Sy: 2233, Su: 2233, Sc: 1350, tau: 110,
    CTE: -0.3, k: 3.8, Cp: 900, Tm: 190, Tmax: 120,
    KIc: 50, elongation: 1.8, cost: 85,
    E2: 8.4, G12: 4.2, nu12: 0.30, XT: 2233, XC: 1350, YT: 57, YC: 270, S: 110,
    desc: 'Airbus primary structure material (A350)',
    isComposite: true,
  },
  'AS4/3501-6': {
    category: 'CFRP', name: 'AS4/3501-6 (UD)',
    density: 1550, E: 138, G: 7.1, nu: 0.30,
    Sy: 2068, Su: 2068, Sc: 1344, tau: 96,
    CTE: -0.3, k: 6.8, Cp: 945, Tm: 177, Tmax: 121,
    KIc: 45, elongation: 1.5, cost: 70,
    E2: 8.96, G12: 7.1, nu12: 0.30, XT: 2068, XC: 1344, YT: 47, YC: 262, S: 96,
    desc: 'Standard aerospace UD prepreg',
    isComposite: true,
  },
  'IM7/8552 Quasi': {
    category: 'CFRP', name: 'IM7/8552 (Quasi-isotropic 0/45/90)',
    density: 1570, E: 54, G: 20.8, nu: 0.30,
    Sy: 600, Su: 600, Sc: 500, tau: 85,
    CTE: 3.5, k: 3.2, Cp: 900, Tm: 370, Tmax: 150,
    KIc: 38, elongation: 1.0, cost: 120,
    desc: 'Quasi-isotropic laminate [0/±45/90]s', isComposite: true,
  },
  // ── GFRP ────────────────────────────────────────────────────
  'E-glass/Epoxy': {
    category: 'GFRP', name: 'E-glass/Epoxy (UD)',
    density: 2000, E: 45, G: 5.5, nu: 0.29,
    Sy: 1020, Su: 1020, Sc: 620, tau: 60,
    CTE: 8.6, k: 0.35, Cp: 900, Tm: 200, Tmax: 80,
    KIc: 20, elongation: 2.3, cost: 12,
    E2: 12, G12: 5.5, nu12: 0.29, XT: 1020, XC: 620, YT: 40, YC: 140, S: 60,
    desc: 'Low-cost glass fiber composite, fairings and secondary structure',
    isComposite: true,
  },
  'S-glass/Epoxy': {
    category: 'GFRP', name: 'S-glass/Epoxy (UD)',
    density: 1990, E: 55, G: 6.9, nu: 0.28,
    Sy: 1620, Su: 1620, Sc: 690, tau: 70,
    CTE: 6.0, k: 0.35, Cp: 840, Tm: 200, Tmax: 80,
    KIc: 25, elongation: 2.9, cost: 25,
    desc: 'Higher strength glass fiber, pressure vessels, ballistic armor',
    isComposite: true,
  },
  // ── Aramid ──────────────────────────────────────────────────
  'Kevlar 49/Epoxy': {
    category: 'Aramid Composite', name: 'Kevlar 49/Epoxy (UD)',
    density: 1380, E: 76, G: 2.1, nu: 0.34,
    Sy: 1379, Su: 1379, Sc: 275, tau: 44,
    CTE: -2.0, k: 0.04, Cp: 1420, Tm: 500, Tmax: 180,
    KIc: 15, elongation: 1.8, cost: 45,
    desc: 'Impact/ballistic resistance, pressure vessels, fairings',
    isComposite: true,
  },
  // ── CMC ─────────────────────────────────────────────────────
  'SiC/SiC': {
    category: 'Ceramic Matrix Composite', name: 'SiC/SiC',
    density: 2750, E: 250, G: 105, nu: 0.20,
    Sy: 400, Su: 400, Sc: 700, tau: 50,
    CTE: 4.5, k: 15, Cp: 750, Tm: 2700, Tmax: 1200,
    KIc: 20, elongation: 0.3, cost: 2500,
    desc: 'Hot section components, CMC turbine blades, re-entry',
  },
  // ── TPS Ceramics ────────────────────────────────────────────
  'LI-900 HRSI': {
    category: 'TPS Ceramic', name: 'LI-900 HRSI Tile',
    density: 144, E: 0.055, G: 0.022, nu: 0.25,
    Sy: 0.27, Su: 0.27, Sc: 0.27, tau: 0.1,
    CTE: 0.45, k: 0.064, Cp: 628, Tm: 1650, Tmax: 1260,
    KIc: 0.3, elongation: 0.001, cost: 15000,
    desc: 'Space Shuttle lower-surface thermal protection tiles',
  },
  // ── Polymers ────────────────────────────────────────────────
  'PEEK': {
    category: 'Polymer', name: 'PEEK',
    density: 1320, E: 3.6, G: 1.3, nu: 0.39,
    Sy: 91, Su: 100, Sc: 118, tau: 50,
    CTE: 47, k: 0.29, Cp: 1340, Tm: 343, Tmax: 260,
    KIc: 3.5, elongation: 50, cost: 95,
    desc: 'High-performance thermoplastic, brackets and bushings',
  },
  'Ultem 9085': {
    category: 'Polymer', name: 'Ultem 9085 (PEI)',
    density: 1340, E: 2.5, G: 0.9, nu: 0.40,
    Sy: 71, Su: 71, Sc: 110, tau: 41,
    CTE: 56, k: 0.22, Cp: 1130, Tm: 217, Tmax: 170,
    KIc: 2.2, elongation: 4, cost: 180,
    desc: 'FAA-approved aerospace FDM polymer, interior components',
  },
  // ── Beryllium ───────────────────────────────────────────────
  'Be-38Al': {
    category: 'Beryllium Alloy', name: 'Beryllium-Aluminum (Lockalloy)',
    density: 2090, E: 193, G: 76, nu: 0.17,
    Sy: 195, Su: 255, Sc: 195, tau: 140,
    CTE: 13.9, k: 210, Cp: 1633, Tm: 1065, Tmax: 250,
    KIc: 18, elongation: 3, cost: 800,
    desc: 'Ultra-light, high-stiffness optical bench structures',
  },
  // ── Magnesium ───────────────────────────────────────────────
  'AZ31': {
    category: 'Magnesium Alloy', name: 'AZ31B',
    density: 1770, E: 45, G: 17, nu: 0.35,
    Sy: 220, Su: 290, Sc: 220, tau: 140,
    CTE: 26.0, k: 96, Cp: 1050, Tm: 630, Tmax: 120,
    KIc: 18, elongation: 21, cost: 5.5,
    desc: 'Lightest structural metal, helicopter gearboxes',
  },
  // ── Custom ──────────────────────────────────────────────────
  'Custom': {
    category: 'Custom', name: 'Custom Material',
    density: 2700, E: 70, G: 26, nu: 0.33,
    Sy: 250, Su: 300, Sc: 250, tau: 175,
    CTE: 23, k: 150, Cp: 900, Tm: 600, Tmax: 150,
    KIc: 25, elongation: 15, cost: 10,
    desc: 'User-defined material — edit all properties',
  },
}

// ── NACA Airfoil Generator ────────────────────────────────────
export function nacaAirfoil(code, nPoints = 100) {
  const t = parseInt(code.slice(-2)) / 100
  const m = parseInt(code[0]) / 100
  const p = parseInt(code[1]) / 10
  const pts = []
  for (let i = 0; i <= nPoints; i++) {
    const x = (1 - Math.cos(Math.PI * i / nPoints)) / 2
    const yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * x**2 + 0.2843 * x**3 - 0.1015 * x**4)
    let yc, dyc
    if (x < p && p > 0) {
      yc  = m / p**2 * (2 * p * x - x**2)
      dyc = 2 * m / p**2 * (p - x)
    } else {
      yc  = m / (1 - p)**2 * (1 - 2 * p + 2 * p * x - x**2)
      dyc = 2 * m / (1 - p)**2 * (p - x)
    }
    const theta = Math.atan(dyc)
    pts.push({
      xu: x - yt * Math.sin(theta),
      yu: yc + yt * Math.cos(theta),
      xl: x + yt * Math.sin(theta),
      yl: yc - yt * Math.cos(theta),
    })
  }
  return pts
}

// Flatten NACA points to upper+lower contour array [x,y]
export function nacaContour(code, n = 50) {
  const pts = nacaAirfoil(code, n)
  const upper = pts.map(p => [p.xu, p.yu])
  const lower = pts.slice(1, -1).reverse().map(p => [p.xl, p.yl])
  return [...upper, ...lower]
}

// ── Aerospace Component Library ───────────────────────────────
export const COMPONENT_CATEGORIES = {
  'Aerodynamic Surfaces': [
    {
      id: 'naca4-airfoil', name: 'NACA 4-Digit Wing',
      params: {
        series: { label: 'NACA Series', type: 'text', default: '2412' },
        span:   { label: 'Span (m)',    type: 'number', default: 10, min: 0.1, max: 100 },
        chord:  { label: 'Root Chord (m)', type: 'number', default: 1.5, min: 0.01, max: 20 },
        taper:  { label: 'Taper Ratio', type: 'number', default: 0.5, min: 0.1, max: 1 },
        sweep:  { label: 'LE Sweep (°)', type: 'number', default: 15, min: -45, max: 70 },
        dihedral: { label: 'Dihedral (°)', type: 'number', default: 5, min: -15, max: 25 },
        twist:  { label: 'Washout (°)', type: 'number', default: -2, min: -8, max: 8 },
        incidence: { label: 'Incidence (°)', type: 'number', default: 2, min: -5, max: 10 },
      },
    },
    {
      id: 'delta-wing', name: 'Delta Wing',
      params: {
        rootChord: { label: 'Root Chord (m)', type: 'number', default: 8, min: 0.5, max: 30 },
        apex:      { label: 'Apex Angle (°)', type: 'number', default: 60, min: 20, max: 85 },
        series:    { label: 'NACA Series', type: 'text', default: '0006' },
      },
    },
    {
      id: 'swept-wing', name: 'Swept Wing',
      params: {
        semiSpan:  { label: 'Semi-span (m)', type: 'number', default: 15, min: 0.5, max: 80 },
        rootChord: { label: 'Root Chord (m)', type: 'number', default: 6, min: 0.1, max: 25 },
        tipChord:  { label: 'Tip Chord (m)',  type: 'number', default: 2, min: 0.1, max: 15 },
        sweep:     { label: 'LE Sweep (°)', type: 'number', default: 35, min: 0, max: 70 },
        dihedral:  { label: 'Dihedral (°)', type: 'number', default: 7, min: -15, max: 20 },
      },
    },
    {
      id: 'horiz-stab', name: 'Horizontal Stabilizer',
      params: {
        span:  { label: 'Span (m)', type: 'number', default: 6, min: 0.5, max: 30 },
        chord: { label: 'Root Chord (m)', type: 'number', default: 2, min: 0.1, max: 10 },
        sweep: { label: 'Sweep (°)', type: 'number', default: 30, min: 0, max: 55 },
        elevatorRatio: { label: 'Elevator Chord Ratio', type: 'number', default: 0.35, min: 0.1, max: 0.6 },
      },
    },
    {
      id: 'vert-stab', name: 'Vertical Stabilizer',
      params: {
        height: { label: 'Height (m)', type: 'number', default: 4, min: 0.2, max: 20 },
        chord:  { label: 'Root Chord (m)', type: 'number', default: 3, min: 0.1, max: 15 },
        sweep:  { label: 'LE Sweep (°)', type: 'number', default: 40, min: 0, max: 65 },
        rudderRatio: { label: 'Rudder Chord Ratio', type: 'number', default: 0.30, min: 0.1, max: 0.55 },
      },
    },
    {
      id: 'winglet', name: 'Winglet',
      params: {
        height:   { label: 'Height (m)', type: 'number', default: 2.5, min: 0.1, max: 8 },
        cant:     { label: 'Cant Angle (°)', type: 'number', default: 65, min: 20, max: 90 },
        toe:      { label: 'Toe Angle (°)', type: 'number', default: -2, min: -10, max: 5 },
        series:   { label: 'NACA Series', type: 'text', default: '2412' },
      },
    },
    {
      id: 'canard', name: 'Canard',
      params: {
        span:  { label: 'Span (m)', type: 'number', default: 4, min: 0.3, max: 15 },
        chord: { label: 'Root Chord (m)', type: 'number', default: 1.5, min: 0.1, max: 8 },
        sweep: { label: 'Sweep (°)', type: 'number', default: 35, min: 0, max: 65 },
      },
    },
  ],
  'Control Surfaces': [
    {
      id: 'aileron', name: 'Aileron',
      params: {
        spanFraction: { label: 'Span Fraction (inboard-outboard)', type: 'text', default: '0.6-0.95' },
        chordRatio:   { label: 'Chord Ratio', type: 'number', default: 0.25, min: 0.1, max: 0.45 },
        deflection:   { label: 'Max Deflection (°)', type: 'number', default: 25, min: 5, max: 45 },
      },
    },
    {
      id: 'fowler-flap', name: 'Fowler Flap',
      params: {
        spanFraction: { label: 'Span Fraction', type: 'text', default: '0.1-0.6' },
        chordRatio:   { label: 'Chord Ratio', type: 'number', default: 0.30, min: 0.15, max: 0.50 },
        deflection:   { label: 'Max Deflection (°)', type: 'number', default: 40, min: 10, max: 60 },
      },
    },
    {
      id: 'slat', name: 'Leading Edge Slat',
      params: {
        spanFraction: { label: 'Span Fraction', type: 'text', default: '0.05-0.85' },
        chordRatio:   { label: 'Chord Ratio', type: 'number', default: 0.15, min: 0.05, max: 0.30 },
        deflection:   { label: 'Max Deflection (°)', type: 'number', default: 25, min: 5, max: 35 },
      },
    },
    {
      id: 'spoiler', name: 'Spoiler/Speed Brake',
      params: {
        spanFraction: { label: 'Span Fraction', type: 'text', default: '0.35-0.65' },
        chordRatio:   { label: 'Chord Ratio', type: 'number', default: 0.20, min: 0.05, max: 0.40 },
        deflection:   { label: 'Max Deflection (°)', type: 'number', default: 60, min: 10, max: 90 },
      },
    },
    {
      id: 'elevator', name: 'Elevator',
      params: {
        chordRatio: { label: 'Chord Ratio', type: 'number', default: 0.35, min: 0.15, max: 0.55 },
        deflection: { label: 'Max Deflection (°)', type: 'number', default: 30, min: 5, max: 45 },
      },
    },
    {
      id: 'rudder', name: 'Rudder',
      params: {
        chordRatio: { label: 'Chord Ratio', type: 'number', default: 0.30, min: 0.15, max: 0.50 },
        deflection: { label: 'Max Deflection (°)', type: 'number', default: 35, min: 5, max: 50 },
      },
    },
  ],
  'Fuselage & Body': [
    {
      id: 'fuselage', name: 'Parametric Fuselage',
      params: {
        length:      { label: 'Length (m)', type: 'number', default: 30, min: 1, max: 100 },
        maxDiameter: { label: 'Max Diameter (m)', type: 'number', default: 4, min: 0.1, max: 10 },
        noseLR:      { label: 'Nose Fineness Ratio', type: 'number', default: 2.5, min: 1, max: 5 },
        tailUpsweep: { label: 'Tail Upsweep (°)', type: 'number', default: 8, min: 0, max: 20 },
        crossSection: { label: 'Cross-section', type: 'select', default: 'circular', options: ['circular', 'oval', 'rectangular-rounded'] },
      },
    },
    {
      id: 'nose-cone', name: 'Nose Cone',
      params: {
        diameter: { label: 'Base Diameter (m)', type: 'number', default: 1.2, min: 0.05, max: 6 },
        length:   { label: 'Length (m)', type: 'number', default: 2.5, min: 0.1, max: 12 },
        profile:  { label: 'Profile', type: 'select', default: 'ogive', options: ['ogive', 'parabolic', 'von-karman', 'haack', 'conical', 'blunt'] },
      },
    },
    {
      id: 'sears-haack', name: 'Sears-Haack Body',
      params: {
        length:    { label: 'Length (m)', type: 'number', default: 20, min: 1, max: 60 },
        maxRadius: { label: 'Max Radius (m)', type: 'number', default: 1.5, min: 0.05, max: 5 },
      },
    },
    {
      id: 'pressure-vessel', name: 'Pressure Vessel',
      params: {
        radius:  { label: 'Radius (m)', type: 'number', default: 0.5, min: 0.05, max: 5 },
        length:  { label: 'Cylinder Length (m)', type: 'number', default: 2, min: 0, max: 20 },
        domeType: { label: 'Dome Type', type: 'select', default: 'hemispherical', options: ['hemispherical', 'elliptical', 'torispherical', 'flat'] },
      },
    },
    {
      id: 'fairing', name: 'Payload Fairing',
      params: {
        diameter: { label: 'Diameter (m)', type: 'number', default: 5.4, min: 0.3, max: 10 },
        length:   { label: 'Length (m)', type: 'number', default: 13.8, min: 1, max: 30 },
        noseType: { label: 'Nose Type', type: 'select', default: 'ogive', options: ['ogive', 'conical', 'biconic'] },
      },
    },
  ],
  'Propulsion': [
    {
      id: 'turbofan-nacelle', name: 'Turbofan Nacelle',
      params: {
        fanDiameter:  { label: 'Fan Diameter (m)', type: 'number', default: 2.8, min: 0.3, max: 5 },
        inletDiam:    { label: 'Inlet Diameter (m)', type: 'number', default: 2.5, min: 0.3, max: 5 },
        length:       { label: 'Length (m)', type: 'number', default: 4.5, min: 0.5, max: 10 },
        bpr:          { label: 'Bypass Ratio', type: 'number', default: 12, min: 0, max: 25 },
      },
    },
    {
      id: 'rocket-engine', name: 'Liquid Rocket Engine',
      params: {
        thrust:      { label: 'Thrust (kN)', type: 'number', default: 1000, min: 0.1, max: 10000 },
        chamberPres: { label: 'Chamber Pressure (MPa)', type: 'number', default: 20, min: 0.5, max: 30 },
        expRatio:    { label: 'Expansion Ratio (Ae/At)', type: 'number', default: 77.5, min: 2, max: 400 },
        isp:         { label: 'Isp (s)', type: 'number', default: 450, min: 100, max: 500 },
        propellant:  { label: 'Propellant', type: 'select', default: 'LOX/LH2', options: ['LOX/LH2','LOX/RP-1','N2O4/UDMH','N2O/HTPB','LOX/CH4'] },
      },
    },
    {
      id: 'solid-rocket', name: 'Solid Rocket Motor',
      params: {
        diameter: { label: 'Outer Diameter (m)', type: 'number', default: 1.85, min: 0.05, max: 4 },
        length:   { label: 'Length (m)', type: 'number', default: 26.8, min: 0.2, max: 40 },
        grain:    { label: 'Grain Config', type: 'select', default: 'BATES', options: ['BATES','star','finocyl','wagon-wheel'] },
      },
    },
    {
      id: 'nozzle', name: 'De Laval Nozzle',
      params: {
        throatDiam: { label: 'Throat Diameter (m)', type: 'number', default: 0.3, min: 0.01, max: 3 },
        exitDiam:   { label: 'Exit Diameter (m)',   type: 'number', default: 1.2, min: 0.02, max: 6 },
        halfAngle:  { label: 'Divergence Half-angle (°)', type: 'number', default: 15, min: 5, max: 30 },
        convergLen: { label: 'Convergent Length (m)', type: 'number', default: 0.3, min: 0.01, max: 2 },
        divergLen:  { label: 'Divergent Length (m)', type: 'number', default: 1.0, min: 0.05, max: 5 },
      },
    },
    {
      id: 'aerospike', name: 'Annular Aerospike',
      params: {
        baseRadius: { label: 'Base Radius (m)', type: 'number', default: 0.8, min: 0.05, max: 3 },
        length:     { label: 'Spike Length (m)', type: 'number', default: 1.2, min: 0.05, max: 5 },
        expRatio:   { label: 'Expansion Ratio', type: 'number', default: 25, min: 5, max: 100 },
      },
    },
    {
      id: 'ramjet-inlet', name: 'Ramjet Inlet',
      params: {
        captureArea: { label: 'Capture Area (m²)', type: 'number', default: 0.5, min: 0.01, max: 10 },
        rampAngle:   { label: 'Ramp Angle (°)', type: 'number', default: 12, min: 5, max: 25 },
        type:        { label: 'Inlet Type', type: 'select', default: 'pitot', options: ['pitot','single-cone','2D-ramp','axisymmetric'] },
      },
    },
  ],
  'Structural Components': [
    {
      id: 'wing-spar', name: 'Wing Spar',
      params: {
        section:   { label: 'Section', type: 'select', default: 'I-beam', options: ['I-beam','C-section','box-spar','H-section'] },
        height:    { label: 'Height (m)', type: 'number', default: 0.25, min: 0.01, max: 2 },
        length:    { label: 'Length (m)', type: 'number', default: 8, min: 0.1, max: 50 },
        flangeW:   { label: 'Flange Width (m)', type: 'number', default: 0.08, min: 0.005, max: 0.5 },
        webThk:    { label: 'Web Thickness (m)', type: 'number', default: 0.006, min: 0.001, max: 0.05 },
        flangeThk: { label: 'Flange Thickness (m)', type: 'number', default: 0.012, min: 0.001, max: 0.05 },
        chordPos:  { label: 'Chord Position (%)', type: 'number', default: 25, min: 5, max: 70 },
      },
    },
    {
      id: 'wing-rib', name: 'Wing Rib',
      params: {
        series:       { label: 'Airfoil', type: 'text', default: '2412' },
        chord:        { label: 'Chord (m)', type: 'number', default: 2, min: 0.1, max: 15 },
        thickness:    { label: 'Rib Thickness (m)', type: 'number', default: 0.003, min: 0.001, max: 0.02 },
        cutouts:      { label: 'Lightening Cutouts', type: 'number', default: 3, min: 0, max: 8 },
        lightFactor:  { label: 'Lightening %', type: 'number', default: 40, min: 0, max: 70 },
      },
    },
    {
      id: 'fuselage-frame', name: 'Fuselage Frame',
      params: {
        diameter:   { label: 'Diameter (m)', type: 'number', default: 4, min: 0.3, max: 10 },
        frameHeight:{ label: 'Frame Height (m)', type: 'number', default: 0.08, min: 0.01, max: 0.5 },
        thickness:  { label: 'Wall Thickness (m)', type: 'number', default: 0.004, min: 0.001, max: 0.02 },
        cutouts:    { label: 'Door/Window Cutouts', type: 'number', default: 2, min: 0, max: 6 },
      },
    },
    {
      id: 'stringer', name: 'Fuselage Stringer',
      params: {
        section: { label: 'Section', type: 'select', default: 'Z', options: ['Z','L','T','hat','J'] },
        length:  { label: 'Length (m)', type: 'number', default: 5, min: 0.1, max: 30 },
        height:  { label: 'Height (m)', type: 'number', default: 0.04, min: 0.005, max: 0.2 },
        thickness: { label: 'Thickness (m)', type: 'number', default: 0.002, min: 0.001, max: 0.01 },
      },
    },
    {
      id: 'fastener', name: 'Fastener',
      params: {
        type:   { label: 'Type', type: 'select', default: 'rivet', options: ['rivet','bolt','screw','lockbolt'] },
        diam:   { label: 'Nominal Diameter (mm)', type: 'number', default: 5, min: 2, max: 25 },
        length: { label: 'Length (mm)', type: 'number', default: 20, min: 5, max: 80 },
        head:   { label: 'Head Type', type: 'select', default: 'countersunk', options: ['countersunk','protruding','pan','dome','hex'] },
      },
    },
    {
      id: 'shear-web', name: 'Shear Web',
      params: {
        height:    { label: 'Height (m)', type: 'number', default: 0.3, min: 0.01, max: 3 },
        length:    { label: 'Length (m)', type: 'number', default: 2, min: 0.1, max: 20 },
        thickness: { label: 'Thickness (m)', type: 'number', default: 0.003, min: 0.001, max: 0.02 },
      },
    },
  ],
  'Landing Gear': [
    {
      id: 'oleo-strut', name: 'Oleo-Pneumatic Strut',
      params: {
        stroke:  { label: 'Stroke (m)', type: 'number', default: 0.45, min: 0.05, max: 1.5 },
        pistonD: { label: 'Piston Diameter (m)', type: 'number', default: 0.12, min: 0.02, max: 0.5 },
        cylD:    { label: 'Cylinder Diameter (m)', type: 'number', default: 0.18, min: 0.03, max: 0.8 },
        length:  { label: 'Extended Length (m)', type: 'number', default: 1.2, min: 0.1, max: 4 },
      },
    },
    {
      id: 'wheel-tire', name: 'Wheel & Tire',
      params: {
        outerDiam: { label: 'Outer Diameter (m)', type: 'number', default: 1.0, min: 0.1, max: 2 },
        width:     { label: 'Width (m)', type: 'number', default: 0.35, min: 0.05, max: 0.8 },
        rimDiam:   { label: 'Rim Diameter (m)', type: 'number', default: 0.5, min: 0.1, max: 1.2 },
        ply:       { label: 'Ply Rating', type: 'number', default: 14, min: 4, max: 32 },
      },
    },
    {
      id: 'gear-assembly', name: 'Main Gear Assembly (Tricycle)',
      params: {
        trackWidth:   { label: 'Track Width (m)', type: 'number', default: 8, min: 1, max: 30 },
        wheelbase:    { label: 'Wheelbase (m)', type: 'number', default: 12, min: 1, max: 40 },
        strutHeight:  { label: 'Strut Height (m)', type: 'number', default: 1.4, min: 0.2, max: 5 },
        bogie:        { label: 'Bogie Wheels', type: 'number', default: 2, min: 1, max: 6 },
        retractDir:   { label: 'Retract Direction', type: 'select', default: 'inboard', options: ['inboard','aft','forward'] },
      },
    },
  ],
  'Spacecraft': [
    {
      id: 'solar-panel', name: 'Solar Panel Array',
      params: {
        panelCount: { label: 'Panel Count', type: 'number', default: 4, min: 1, max: 20 },
        panelWidth: { label: 'Panel Width (m)', type: 'number', default: 2, min: 0.1, max: 10 },
        panelLength:{ label: 'Panel Length (m)', type: 'number', default: 3, min: 0.1, max: 15 },
        efficiency: { label: 'Cell Efficiency (%)', type: 'number', default: 30, min: 5, max: 45 },
        type:       { label: 'Type', type: 'select', default: 'rigid', options: ['rigid','flexible','concentrator'] },
      },
    },
    {
      id: 'satellite-bus', name: 'Spacecraft Bus',
      params: {
        width:   { label: 'Width (m)', type: 'number', default: 1.5, min: 0.1, max: 5 },
        depth:   { label: 'Depth (m)', type: 'number', default: 1.5, min: 0.1, max: 5 },
        height:  { label: 'Height (m)', type: 'number', default: 2, min: 0.1, max: 6 },
        decks:   { label: 'Internal Decks', type: 'number', default: 3, min: 1, max: 8 },
      },
    },
    {
      id: 'dish-antenna', name: 'Parabolic Dish Antenna',
      params: {
        diameter: { label: 'Diameter (m)', type: 'number', default: 3.5, min: 0.1, max: 70 },
        fOverD:   { label: 'f/D Ratio', type: 'number', default: 0.4, min: 0.2, max: 1.0 },
        freq:     { label: 'Design Frequency (GHz)', type: 'number', default: 8, min: 0.1, max: 100 },
      },
    },
    {
      id: 'heat-shield', name: 'Ablative Heat Shield',
      params: {
        diameter:   { label: 'Diameter (m)', type: 'number', default: 4.5, min: 0.3, max: 12 },
        rNose:      { label: 'Nose Radius (m)', type: 'number', default: 1.0, min: 0.05, max: 5 },
        thickness:  { label: 'TPS Thickness (m)', type: 'number', default: 0.07, min: 0.005, max: 0.5 },
        material:   { label: 'TPS Material', type: 'select', default: 'PICA', options: ['PICA','SLA-561V','Phenolic','AVCOAT'] },
      },
    },
    {
      id: 'propellant-tank', name: 'Propellant Tank',
      params: {
        type:     { label: 'Tank Type', type: 'select', default: 'cylindrical', options: ['spherical','cylindrical','toroidal','conformal'] },
        radius:   { label: 'Radius (m)', type: 'number', default: 0.8, min: 0.05, max: 4 },
        length:   { label: 'Cylinder Length (m)', type: 'number', default: 2, min: 0, max: 20 },
        propellant:{ label: 'Propellant', type: 'select', default: 'LOX', options: ['LOX','LH2','RP-1','MMH','N2H4','N2O4','Xenon'] },
        ullage:   { label: 'Ullage (%)', type: 'number', default: 3, min: 1, max: 15 },
      },
    },
    {
      id: 'reaction-wheel', name: 'Reaction Wheel',
      params: {
        diameter:  { label: 'Wheel Diameter (m)', type: 'number', default: 0.3, min: 0.02, max: 1 },
        thickness: { label: 'Thickness (m)', type: 'number', default: 0.06, min: 0.01, max: 0.3 },
        maxSpeed:  { label: 'Max Speed (RPM)', type: 'number', default: 6000, min: 100, max: 20000 },
      },
    },
    {
      id: 'radiator', name: 'Thermal Radiator',
      params: {
        width:       { label: 'Width (m)', type: 'number', default: 2, min: 0.1, max: 10 },
        length:      { label: 'Length (m)', type: 'number', default: 5, min: 0.1, max: 20 },
        emissivity:  { label: 'Emissivity', type: 'number', default: 0.90, min: 0.1, max: 0.99 },
        absorptivity:{ label: 'Solar Absorptivity', type: 'number', default: 0.08, min: 0.01, max: 0.99 },
        coating:     { label: 'Coating', type: 'select', default: 'OSR', options: ['OSR','white-paint','silverized-tape','black'] },
      },
    },
  ],
  'Primitives': [
    {
      id: 'box', name: 'Box',
      params: {
        width:  { label: 'Width (m)',  type: 'number', default: 1, min: 0.001, max: 100 },
        height: { label: 'Height (m)', type: 'number', default: 1, min: 0.001, max: 100 },
        depth:  { label: 'Depth (m)',  type: 'number', default: 1, min: 0.001, max: 100 },
      },
    },
    {
      id: 'cylinder', name: 'Cylinder',
      params: {
        radius: { label: 'Radius (m)',  type: 'number', default: 0.5, min: 0.001, max: 50 },
        height: { label: 'Height (m)', type: 'number', default: 2,   min: 0.001, max: 100 },
        segs:   { label: 'Segments',   type: 'number', default: 32,  min: 6,     max: 128 },
      },
    },
    {
      id: 'sphere', name: 'Sphere',
      params: {
        radius: { label: 'Radius (m)', type: 'number', default: 0.5, min: 0.001, max: 50 },
        widthSegs: { label: 'Width Segments', type: 'number', default: 32, min: 8, max: 128 },
        heightSegs: { label: 'Height Segments', type: 'number', default: 16, min: 4, max: 64 },
      },
    },
    {
      id: 'cone', name: 'Cone',
      params: {
        bottomR: { label: 'Base Radius (m)', type: 'number', default: 0.5, min: 0, max: 50 },
        topR:    { label: 'Top Radius (m)',  type: 'number', default: 0,   min: 0, max: 50 },
        height:  { label: 'Height (m)',      type: 'number', default: 1,   min: 0.001, max: 100 },
        segs:    { label: 'Segments',        type: 'number', default: 32,  min: 4, max: 128 },
      },
    },
    {
      id: 'torus', name: 'Torus',
      params: {
        R:    { label: 'Major Radius (m)', type: 'number', default: 1,   min: 0.01, max: 50 },
        r:    { label: 'Minor Radius (m)', type: 'number', default: 0.3, min: 0.001, max: 10 },
        segs: { label: 'Tubular Segments', type: 'number', default: 32,  min: 6, max: 128 },
      },
    },
  ],
}

// ── Standard Propellant Data ──────────────────────────────────
export const PROPELLANTS = {
  'LOX/LH2':    { Isp: 450, Tc: 3315, cstar: 2386, OF: 6.0,  rho: 287,  desc: 'Highest Isp, cryogenic' },
  'LOX/RP-1':   { Isp: 360, Tc: 3675, cstar: 1793, OF: 2.77, rho: 1018, desc: 'Dense, storable, Falcon 9' },
  'LOX/CH4':    { Isp: 380, Tc: 3534, cstar: 1860, OF: 3.55, rho: 828,  desc: 'Raptor engine, Starship' },
  'N2O4/UDMH':  { Isp: 315, Tc: 3150, cstar: 1720, OF: 2.6,  rho: 1200, desc: 'Storable, hypergolic' },
  'N2O4/MMH':   { Isp: 318, Tc: 3250, cstar: 1750, OF: 2.15, rho: 1140, desc: 'Storable, hypergolic' },
  'N2O/HTPB':   { Isp: 250, Tc: 2800, cstar: 1530, OF: 8.0,  rho: 1300, desc: 'Hybrid, low cost' },
  'N2O/HDPE':   { Isp: 240, Tc: 2700, cstar: 1500, OF: 7.5,  rho: 1250, desc: 'Hybrid rocket' },
  'HTPB':       { Isp: 260, Tc: 3200, cstar: 1560, OF: 2.2,  rho: 1750, desc: 'Solid propellant' },
  'APCP-std':   { Isp: 242, Tc: 3200, cstar: 1550, OF: 2.3,  rho: 1750, desc: 'Standard APCP solid' },
}

// ── Shortcut Definitions ──────────────────────────────────────
export const SHORTCUTS = [
  { keys: 'F', desc: 'Zoom to fit' },
  { keys: 'S', desc: 'Toggle sketch mode' },
  { keys: 'P', desc: 'Pad / Extrude' },
  { keys: 'O', desc: 'Pocket' },
  { keys: 'R', desc: 'Revolve' },
  { keys: 'L', desc: 'Loft' },
  { keys: 'M', desc: 'Mirror' },
  { keys: 'G', desc: 'Toggle grid' },
  { keys: 'Ctrl+Z', desc: 'Undo' },
  { keys: 'Ctrl+Y', desc: 'Redo' },
  { keys: 'Ctrl+S', desc: 'Save' },
  { keys: 'Ctrl+N', desc: 'New model' },
  { keys: 'Ctrl+O', desc: 'Open model' },
  { keys: 'Ctrl+E', desc: 'Export' },
  { keys: 'Del', desc: 'Delete selected feature' },
  { keys: 'Esc', desc: 'Cancel / deselect' },
  { keys: '1', desc: 'Front view' },
  { keys: '2', desc: 'Top view' },
  { keys: '3', desc: 'Right view' },
  { keys: '4', desc: 'Isometric view' },
  { keys: 'H', desc: 'Shaded mode' },
  { keys: 'W', desc: 'Wireframe mode' },
  { keys: 'X', desc: 'X-Ray mode' },
  { keys: 'Ctrl+K', desc: 'Shortcut overlay' },
  { keys: 'Ctrl+A', desc: 'Select all' },
  { keys: 'Space', desc: 'Toggle rotation lock' },
  { keys: 'Tab', desc: 'Cycle selection mode' },
  { keys: 'Shift+F', desc: 'Fit selected' },
  { keys: 'Alt+Q', desc: 'Analysis panel' },
  { keys: 'Alt+M', desc: 'Material panel' },
]
