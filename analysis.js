// ============================================================
// AeroForge CAD — Analysis Engine
// VLM Aerodynamics, FEA, Propulsion, Orbital, Flight Performance
// ============================================================

import { CONST, isa, PROPELLANTS } from './data.js'

// ── Math Utilities ────────────────────────────────────────────
const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2]
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
const norm = a => Math.sqrt(dot(a, a))
const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]]
const add = (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]]
const scale = (a, s) => [a[0]*s, a[1]*s, a[2]*s]
const normalize = a => { const n = norm(a); return n < 1e-10 ? [0,0,0] : scale(a, 1/n) }

// Gauss elimination for Ax = b
function gaussElim(A, b) {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let maxRow = col
    for (let row = col+1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row
    }
    ;[M[col], M[maxRow]] = [M[maxRow], M[col]]
    const div = M[col][col]
    if (Math.abs(div) < 1e-14) continue
    for (let j = col; j <= n; j++) M[col][j] /= div
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = M[row][col]
      for (let j = col; j <= n; j++) M[row][j] -= factor * M[col][j]
    }
  }
  return M.map(row => row[n])
}

// ── ISA Atmosphere (re-export convenience) ────────────────────
export { isa }

// ── Vortex Lattice Method (VLM) Aerodynamics ─────────────────
// Wing definition: { span, rootChord, tipChord, sweep, dihedral, twist }
// Returns: CL, CDi, Cm, spanLoading, Cp, e, CLalpha, neutPoint
export function vlmAnalysis({ wing, alpha, beta = 0, mach = 0, alt = 0 }) {
  const atm = isa(alt)
  const { span, rootChord, tipChord, sweep, dihedral, twist = 0 } = wing
  const Nc = 8   // chordwise panels
  const Ns = 16  // spanwise panels

  const alphaRad = alpha * Math.PI / 180
  const sweepRad = sweep * Math.PI / 180
  const dihedralRad = dihedral * Math.PI / 180

  // Build panel geometry
  const panels = []
  for (let j = 0; j < Ns; j++) {
    const y0 = -span/2 + j     * span / Ns
    const y1 = -span/2 + (j+1) * span / Ns
    const ym = (y0 + y1) / 2
    const yFrac = (ym + span/2) / span
    const chord = rootChord + (tipChord - rootChord) * Math.abs(2*yFrac - 1) // simplified taper
    const twistLocal = twist * Math.abs(2*yFrac - 1)
    const sweepOffset = Math.tan(sweepRad) * Math.abs(ym)
    const zOffset = Math.tan(dihedralRad) * Math.abs(ym)

    for (let i = 0; i < Nc; i++) {
      const x0 = i     * chord / Nc + sweepOffset
      const x1 = (i+1) * chord / Nc + sweepOffset
      const xm = (x0 + x1) / 2
      // Panel corners [LE, TE, quarter-chord, collocation point]
      const z0 = zOffset
      // Collocation point at 3/4 chord of panel
      const xcp = x0 + 0.75 * (x1 - x0)
      // Normal in local wing plane (accounting for dihedral and twist)
      const twistR = (alphaRad + twistLocal * Math.PI / 180)
      panels.push({
        i, j,
        cp: [xcp, ym, z0],
        ql: [x0 + 0.25*(x1-x0), ym, z0],   // quarter chord (horseshoe vertex)
        y0, y1, chord,
        nx: -Math.sin(twistR) * Math.cos(dihedralRad),
        ny: 0,
        nz: Math.cos(twistR) * Math.cos(dihedralRad),
        area: chord / Nc * (y1 - y0),
      })
    }
  }

  const N = panels.length
  // Build AIC (Aerodynamic Influence Coefficient) matrix
  const AIC = Array.from({ length: N }, () => new Array(N).fill(0))
  const rhs = new Array(N).fill(0)

  // Freestream velocity
  const V = [Math.cos(alphaRad), 0, Math.sin(alphaRad)]

  for (let k = 0; k < N; k++) {
    const { cp, nx, ny, nz } = panels[k]
    // Normal velocity due to freestream (RHS = -V·n)
    rhs[k] = -(V[0]*nx + V[1]*ny + V[2]*nz)

    // Induced velocity from each horseshoe vortex j on cp of panel k
    for (let m = 0; m < N; m++) {
      const { ql: P, y0, y1 } = panels[m]
      const c = P  // 1/4 chord strip of horseshoe
      // Simplified: use Biot-Savart for bound and trailing vortex filaments
      // Bound vortex from (c, y0, z_y0) to (c, y1, z_y1)
      const A = [c[0], y0, P[2]]
      const B = [c[0], y1, P[2]]
      const AP = sub(cp, A)
      const BP = sub(cp, B)
      const AB = sub(B, A)
      const c1 = cross(AP, AB)
      const c1n = dot(c1, c1)
      const vel = c1n > 1e-10 ? scale(c1, (dot(AP, AB)/norm(AP) - dot(BP, AB)/norm(BP)) / (4*Math.PI*c1n)) : [0,0,0]
      // Trailing vortices (simplified: semi-infinite lines in x direction)
      // From A trailing upstream and B trailing upstream
      const trailA = biotSavartSemiInfinite(cp, A, [-1,0,0])
      const trailB = biotSavartSemiInfinite(cp, B, [-1,0,0])
      const w = add(add(vel, trailA), scale(trailB, -1))
      AIC[k][m] = w[0]*nx + w[1]*ny + w[2]*nz
    }
  }

  // Solve for circulations Γ
  const Gamma = gaussElim(AIC, rhs)

  // Compute forces
  const Sref = span * (rootChord + tipChord) / 2
  let L = 0, Di = 0, Cm = 0
  const spanLoading = new Array(Ns).fill(0)
  const Cp = new Array(N)

  for (let k = 0; k < N; k++) {
    const { j, y0, y1, chord, area } = panels[k]
    const dy = y1 - y0
    const dL = CONST.rho0 * 1 * Gamma[k] * dy  // ρV·Γ·dy (V=1, normalized)
    L += dL
    spanLoading[j] += Gamma[k]
    const Cl_local = 2 * Gamma[k] / chord
    Cp[k] = -2 * Gamma[k]   // simplified Cp
    // Induced drag: Di = -ρ·V·Γ·sin(αi)·dy (simplified using downwash)
    Di += 0.05 * Math.abs(dL) * Math.abs(alphaRad)  // simplified
    Cm += dL * panels[k].cp[0]
  }

  const q = 0.5 * CONST.rho0 * 1  // q = 0.5ρV² with V=1
  const CL = 2 * L / (Sref)
  const CDi = 2 * Di / Sref
  const CMy = Cm / (Sref * (rootChord + tipChord) / 2)

  // Oswald efficiency
  const AR = span**2 / Sref
  const e = CL**2 / (Math.PI * AR * CDi + 1e-10)

  // Compressibility correction (Prandtl-Glauert)
  const beta_pg = mach < 0.7 ? Math.sqrt(1 - mach**2) : 1
  const CL_corr = CL / beta_pg
  const CLalpha = CL_corr / (alphaRad + 1e-6)

  // Skin friction (flat plate Cf)
  const Re = CONST.rho0 * 1 * (rootChord + tipChord)/2 / CONST.mu0
  const Cf = 0.074 / (Re > 1e6 ? Re**0.2 : Math.sqrt(Re))
  const CDfric = 2 * Cf * 1.2   // both sides
  const CDtotal = CDi + CDfric

  // Neutral point (simplified: ~25% of MAC for thin wing)
  const neutPoint = 0.25 + 1/(Math.PI * AR * CLalpha + 1e-6) * (0.5)

  // Stability derivatives (simplified)
  const CMalpha = CMy / (alphaRad + 1e-6)
  const derivatives = {
    CLalpha, CDalpha: CDtotal / (alphaRad + 0.01),
    Cmalpha: CMalpha, CLq: 4.0, Cmq: -12.0,
    CYbeta: -0.15, Clbeta: -0.08, Cnbeta: 0.06,
    Clp: -0.5, Cnp: -0.025, Clr: 0.12, Cnr: -0.12,
    CYdeltaR: 0.18, CndeltaA: -0.02,
    staticMargin: neutPoint - 0.35,
  }

  return {
    CL: CL_corr, CDi, CDfric, CDtotal, CMy,
    e: Math.min(Math.max(e, 0), 1), CLalpha, neutPoint,
    AR, Sref, mach, alt,
    spanLoading: spanLoading.map((g, j) => ({
      y: (-span/2 + (j+0.5)*span/Ns) / (span/2),
      Clc: g * 2,
    })),
    panelCp: Cp,
    derivatives,
    atm,
  }
}

function biotSavartSemiInfinite(p, A, dir) {
  const r = sub(p, A)
  const c = cross(dir, r)
  const cn = dot(c, c)
  if (cn < 1e-12) return [0,0,0]
  const d = norm(r) - dot(normalize(dir), r)
  return scale(c, (1 + d/(norm(r)+1e-10)) / (4*Math.PI*cn))
}

// Full polar sweep
export function vlmPolar({ wing, alphaRange = [-4, 16], nAlpha = 11, mach = 0, alt = 0 }) {
  const alphas = Array.from({ length: nAlpha }, (_, i) => alphaRange[0] + i * (alphaRange[1] - alphaRange[0]) / (nAlpha - 1))
  return alphas.map(alpha => {
    const r = vlmAnalysis({ wing, alpha, mach, alt })
    return { alpha, CL: r.CL, CDtotal: r.CDtotal, CM: r.CMy, LD: r.CL / (r.CDtotal + 1e-6) }
  })
}

// ── FEA Solver (Euler-Bernoulli Beam) ─────────────────────────
// nodes: [{x,y,z}], elements: [{n1,n2, E, A, Iy, Iz, J, G}]
// bcs: [{node, dof: 0-5, value}]   (dof: 0=ux,1=uy,2=uz,3=rx,4=ry,5=rz)
// loads: [{node, dof, value}]
// Returns: {displacements, reactions, stresses, frequencies}
export function feaBeam({ nodes, elements, boundaryConditions, loads, material }) {
  const nDOF = nodes.length * 6
  const K = Array.from({ length: nDOF }, () => new Float64Array(nDOF))
  const F = new Float64Array(nDOF)

  // Assemble global stiffness
  for (const el of elements) {
    const { n1, n2 } = el
    const E  = material?.E  * 1e9  || el.E  || 70e9
    const A  = el.A  || 0.01
    const Iy = el.Iy || 8.33e-6
    const Iz = el.Iz || 8.33e-6
    const G  = material?.G  * 1e9  || el.G  || 26e9
    const J  = el.J  || 1.667e-5

    const p1 = nodes[n1], p2 = nodes[n2]
    const dx = p2.x - p1.x, dy = p2.y - p1.y, dz = p2.z - p1.z
    const L  = Math.sqrt(dx**2 + dy**2 + dz**2)
    if (L < 1e-10) continue

    // Local element stiffness (12x12) for 3D Euler-Bernoulli beam
    const ke = localBeamStiffness(E, G, A, Iy, Iz, J, L)

    // Transformation matrix (3D orientation)
    const T = beamTransform(dx/L, dy/L, dz/L)

    // Transform to global: KG = T^T * ke * T
    const KG = matMul(matMul(transpose(T), ke), T)

    // Assemble into global K
    const dofs = [n1*6, n1*6+1, n1*6+2, n1*6+3, n1*6+4, n1*6+5,
                  n2*6, n2*6+1, n2*6+2, n2*6+3, n2*6+4, n2*6+5]
    for (let i = 0; i < 12; i++) {
      for (let j = 0; j < 12; j++) {
        K[dofs[i]][dofs[j]] += KG[i][j]
      }
    }
  }

  // Apply loads
  for (const ld of loads) {
    F[ld.node * 6 + ld.dof] += ld.value
  }

  // Apply boundary conditions (penalty method)
  const PENALTY = 1e30
  const freeDofs = []
  for (const bc of boundaryConditions) {
    const idx = bc.node * 6 + bc.dof
    K[idx][idx] += PENALTY
    F[idx] += PENALTY * (bc.value || 0)
  }

  // Mark free DOFs
  const constrained = new Set(boundaryConditions.map(bc => bc.node*6 + bc.dof))
  for (let i = 0; i < nDOF; i++) { if (!constrained.has(i)) freeDofs.push(i) }

  // Extract reduced system
  const nFree = freeDofs.length
  if (nFree === 0) return { displacements: new Float64Array(nDOF), reactions: [], stresses: [], maxDisp: 0 }
  const Kred = Array.from({ length: nFree }, (_, i) => freeDofs.map(j => K[freeDofs[i]][j]))
  const Fred = freeDofs.map(i => F[i])

  // Solve
  const Ured = gaussElim(Kred, Fred)

  // Assemble full displacement vector
  const U = new Float64Array(nDOF)
  freeDofs.forEach((di, i) => { U[di] = Ured[i] })

  // Compute element stresses
  const stresses = elements.map(el => {
    const { n1, n2 } = el
    const E = material?.E * 1e9 || el.E || 70e9
    const A = el.A || 0.01
    const p1 = nodes[n1], p2 = nodes[n2]
    const dx = p2.x - p1.x, dy = p2.y - p1.y, dz = p2.z - p1.z
    const L = Math.sqrt(dx**2 + dy**2 + dz**2) || 1
    const axialStrain = (U[n2*6] - U[n1*6]) / L
    const sigma_axial = E * axialStrain
    const Iy = el.Iy || 8.33e-6, c = el.c || 0.05
    const M = E * Iy * (U[n2*6+4] - U[n1*6+4]) / L
    const sigma_bending = M * c / (Iy + 1e-20)
    const sigma_vm = Math.abs(sigma_axial) + Math.abs(sigma_bending)
    const Sy = material?.Sy * 1e6 || el.Sy || 270e6
    return { n1, n2, sigma_axial, sigma_bending, sigma_vm, SF: Sy / (sigma_vm + 1e-6) }
  })

  const maxDisp = Math.max(...Array.from(U).map(Math.abs))
  const maxStress = Math.max(...stresses.map(s => s.sigma_vm))

  // Reactions at BC nodes
  const reactions = boundaryConditions.map(bc => {
    const idx = bc.node * 6 + bc.dof
    let f = 0
    for (let j = 0; j < nDOF; j++) f += K[idx][j] * U[j]
    return { ...bc, reaction: f - F[idx] }
  })

  return { displacements: U, reactions, stresses, maxDisp, maxStress }
}

function localBeamStiffness(E, G, A, Iy, Iz, J, L) {
  const L2 = L*L, L3 = L2*L
  const EAL = E*A/L, EIy2 = 12*E*Iy/L3, EIy1 = 6*E*Iy/L2, EIy3 = 4*E*Iy/L, EIy4 = 2*E*Iy/L
  const EIz2 = 12*E*Iz/L3, EIz1 = 6*E*Iz/L2, EIz3 = 4*E*Iz/L, EIz4 = 2*E*Iz/L
  const GJL = G*J/L
  const K = Array.from({length:12}, () => new Array(12).fill(0))
  // Axial (u1, u7)
  K[0][0]=EAL; K[0][6]=-EAL; K[6][0]=-EAL; K[6][6]=EAL
  // Torsion (r1, r7)
  K[3][3]=GJL; K[3][9]=-GJL; K[9][3]=-GJL; K[9][9]=GJL
  // Bending about z (v, ry)
  K[1][1]=EIz2; K[1][5]=EIz1; K[1][7]=-EIz2; K[1][11]=EIz1
  K[5][1]=EIz1; K[5][5]=EIz3; K[5][7]=-EIz1; K[5][11]=EIz4
  K[7][1]=-EIz2; K[7][5]=-EIz1; K[7][7]=EIz2; K[7][11]=-EIz1
  K[11][1]=EIz1; K[11][5]=EIz4; K[11][7]=-EIz1; K[11][11]=EIz3
  // Bending about y (w, rz)
  K[2][2]=EIy2; K[2][4]=-EIy1; K[2][8]=-EIy2; K[2][10]=-EIy1
  K[4][2]=-EIy1; K[4][4]=EIy3; K[4][8]=EIy1; K[4][10]=EIy4
  K[8][2]=-EIy2; K[8][4]=EIy1; K[8][8]=EIy2; K[8][10]=EIy1
  K[10][2]=-EIy1; K[10][4]=EIy4; K[10][8]=EIy1; K[10][10]=EIy3
  return K
}

function beamTransform(lx, ly, lz) {
  // Build 12x12 transformation matrix
  const T = Array.from({length:12}, () => new Array(12).fill(0))
  // Local x = element axis
  let mx = [lx, ly, lz]
  let my = Math.abs(lx) < 0.99 ? normalize(cross(mx, [1,0,0])) : normalize(cross(mx, [0,1,0]))
  let mz = cross(mx, my)
  my = normalize(my); mz = normalize(mz)
  const R = [[mx[0],mx[1],mx[2]],[my[0],my[1],my[2]],[mz[0],mz[1],mz[2]]]
  for (let b = 0; b < 4; b++) {
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      T[b*3+i][b*3+j] = R[i][j]
    }
  }
  return T
}

function matMul(A, B) {
  const m=A.length, n=B[0].length, k=B.length
  const C = Array.from({length:m}, () => new Array(n).fill(0))
  for (let i=0;i<m;i++) for (let j=0;j<n;j++) for (let l=0;l<k;l++) C[i][j]+=A[i][l]*B[l][j]
  return C
}
function transpose(A) { return A[0].map((_,j) => A.map(r=>r[j])) }

// Build a simple cantilever test structure
export function buildCantileverStructure(length = 5, nEl = 10, material = { E: 70, G: 26, Sy: 276 }) {
  const nodes = Array.from({length: nEl+1}, (_, i) => ({ x: i*length/nEl, y: 0, z: 0 }))
  const elements = Array.from({length: nEl}, (_, i) => ({
    n1: i, n2: i+1,
    E: material.E * 1e9, G: material.G * 1e9,
    A: 0.01, Iy: 8.33e-6, Iz: 8.33e-6, J: 1.667e-5, c: 0.05, Sy: material.Sy * 1e6,
  }))
  const boundaryConditions = [0,1,2,3,4,5].map(dof => ({ node: 0, dof, value: 0 }))
  const loads = [{ node: nEl, dof: 2, value: -1000 }]  // 1kN tip load
  return { nodes, elements, boundaryConditions, loads }
}

// ── Propulsion Analysis ───────────────────────────────────────
// Rocket nozzle isentropic analysis
export function rocketNozzle({ Pc, Pe = 101325, Tc, At, gamma = 1.3, molarMass = 20 }) {
  const R = 8314 / molarMass  // J/(kg·K)
  const gm1 = gamma - 1
  const gp1 = gamma + 1
  // Area ratio vs Mach (exit)
  // Solve Ae/At = (1/Me) * ((2/gp1)*(1+gm1/2*Me²))^((gp1)/(2*gm1)) numerically
  let Me = 2.0  // initial guess
  for (let iter = 0; iter < 50; iter++) {
    const f = (2/gp1) * (1 + gm1/2 * Me**2)
    const AeAt = (1/Me) * Math.pow(f, gp1/(2*gm1))
    const dAeAt_dMe = AeAt * (-1/Me + (gm1*Me)/(1+gm1/2*Me**2))
    const rhs = At_exit ? At_exit / At : AeAt
    Me -= (AeAt - (At_exit ? At_exit / At : AeAt)) / (dAeAt_dMe + 1e-10)
  }
  // With known Pc/Pe ratio, find Me
  const PcPe = Pc / Pe
  // Pe/P0 = (1 + gm1/2 * Me²)^(-g/gm1)
  // Solve: (1+gm1/2*Me²)^(g/gm1) = PcPe
  Me = Math.sqrt(2/gm1 * (Math.pow(PcPe, gm1/gamma) - 1))
  if (isNaN(Me) || Me < 1) Me = 2.0

  const Te = Tc / (1 + gm1/2 * Me**2)
  const Ve = Me * Math.sqrt(gamma * R * Te)
  const AeAt = (1/Me) * Math.pow((2/gp1)*(1+gm1/2*Me**2), gp1/(2*gm1))
  const Ae = At * AeAt
  const rhoE = Pe / (R * Te)
  const mDot = rhoE * Ve * Ae
  const F = mDot * Ve + (Pe - 101325) * Ae
  const cstar = Pc * At / mDot
  const CF = F / (Pc * At)
  const Isp = F / (mDot * CONST.g0)

  return {
    Me, Te, Ve, AeAt, Ae, mDot,
    F, Isp, cstar, CF,
    FkN: F / 1000,
  }
}

// Tsiolkovsky rocket equation
export function tsiolkovsky({ Isp, m0, mf }) {
  const Ve = Isp * CONST.g0
  const dV = Ve * Math.log(m0 / mf)
  const propMass = m0 - mf
  const massRatio = m0 / mf
  return { dV, Ve, propMass, massRatio }
}

// Multistage delta-V budget
export function deltaVBudget(stages) {
  let totalDV = 0
  const results = stages.map(({ name, Isp, mWet, mDry }) => {
    const dV = Isp * CONST.g0 * Math.log(mWet / mDry)
    totalDV += dV
    return { name, dV, Isp, mWet, mDry, propMass: mWet - mDry, massRatio: mWet/mDry }
  })
  return { stages: results, totalDV }
}

// Nozzle contour (bell/parabolic approximation)
export function nozzleContour({ Rt, Re, L_frac = 0.8, nPts = 30 }) {
  // Rao (approximate) parabolic bell nozzle
  // Entry angle ~35°, exit angle depends on expansion
  const Ln = L_frac * (Math.sqrt(Re/Rt) - 1) * Rt / Math.tan(15 * Math.PI/180)
  const pts = []
  for (let i = 0; i <= nPts; i++) {
    const t = i / nPts
    const x = t * Ln
    const r = Rt + (Re - Rt) * (3*t**2 - 2*t**3)   // smooth Hermite interpolation
    pts.push({ x, r })
  }
  return pts
}

// Air-breathing engine cycle (turbojet)
export function turbojetCycle({ T0, P0, mach, BPR = 0, OPR = 30, TET = 1600, etaC = 0.87, etaT = 0.90, etaJ = 0.98 }) {
  const gamma = CONST.gamma
  const Cp = 1005  // J/(kg·K) for air
  const T_ram = T0 * (1 + (gamma-1)/2 * mach**2)
  const P_ram = P0 * (T_ram/T0)**(gamma/(gamma-1))
  const T_comp = T_ram * (1 + (OPR**((gamma-1)/gamma) - 1) / etaC)
  const P_comp = P0 * OPR
  const T_burner = TET  // Turbine Entry Temperature
  const fuel_air = Cp * (T_burner - T_comp) / (43e6)  // assuming 43MJ/kg fuel LHV
  const T_turb = T_burner * (1 - etaT * (1 - 1/OPR**((gamma-1)/gamma)))
  const Ve = Math.sqrt(2 * Cp * (T_turb - T0) * etaJ)
  const Vi = mach * Math.sqrt(gamma * CONST.R_air * T0)
  const TSFC = fuel_air / ((Ve - Vi) / CONST.g0)
  const thermalEff = (Ve**2 - Vi**2) / (2 * fuel_air * 43e6)
  const propEff = 2 * Vi / (Ve + Vi)
  const overallEff = thermalEff * propEff
  return {
    T0, P0, T_ram, P_ram, T_comp, P_comp, TET, T_turb, Ve, Vi,
    fuel_air, TSFC: TSFC*1e6, thermalEff, propEff, overallEff,
    specificThrust: Ve - Vi, BPR,
  }
}

// ── Orbital Mechanics ─────────────────────────────────────────
const GM = CONST.GM
const Re = CONST.R_earth

export function keplerOrbit({ a, e, i, raan, w, nu }) {
  // a: semi-major axis (m), e: eccentricity, i/raan/w/nu: angles (deg)
  const ir = i * Math.PI/180, rr = raan * Math.PI/180
  const wr = w * Math.PI/180, nr = nu * Math.PI/180
  const p = a * (1 - e**2)
  const r = p / (1 + e * Math.cos(nr))
  // ECI position in orbital plane then rotate
  const x_op = r * Math.cos(nr)
  const y_op = r * Math.sin(nr)
  // Velocity
  const h = Math.sqrt(GM * p)
  const vx_op = -GM/h * Math.sin(nr)
  const vy_op = GM/h * (e + Math.cos(nr))
  // Rotation matrices (Rz(-raan) Rx(-i) Rz(-w))
  const pos = rotECI([x_op, y_op, 0], ir, rr, wr)
  const vel = rotECI([vx_op, vy_op, 0], ir, rr, wr)
  const T = 2 * Math.PI * Math.sqrt(a**3 / GM)
  const alt = r - Re
  const v = norm(vel)
  return { pos, vel, r, alt, v, T, p, a, e, i, raan, w, nu }
}

function rotECI([xo, yo, zo], i, raan, w) {
  // Full rotation: R3(-raan) * R1(-i) * R3(-w) * [xo,yo,zo]
  const cw=Math.cos(w), sw=Math.sin(w), ci=Math.cos(i), si=Math.sin(i), cr=Math.cos(raan), sr=Math.sin(raan)
  const x1=cw*xo-sw*yo, y1=sw*xo+cw*yo, z1=zo
  const x2=x1, y2=ci*y1-si*z1, z2=si*y1+ci*z1
  const x3=cr*x2-sr*y2, y3=sr*x2+cr*y2, z3=z2
  return [x3, y3, z3]
}

export function hohmannTransfer({ r1, r2 }) {
  // r1, r2 in meters from Earth center
  const v1 = Math.sqrt(GM/r1)
  const v2 = Math.sqrt(GM/r2)
  const at  = (r1 + r2) / 2
  const vt1 = Math.sqrt(GM * (2/r1 - 1/at))
  const vt2 = Math.sqrt(GM * (2/r2 - 1/at))
  const dv1 = vt1 - v1
  const dv2 = v2  - vt2
  const tTransfer = Math.PI * Math.sqrt(at**3 / GM)
  return { dv1, dv2, dvTotal: dv1+dv2, tTransfer, at, v1, v2, vt1, vt2 }
}

export function planeChange({ v, angle }) {
  return 2 * v * Math.sin(angle * Math.PI / 360)
}

export function j2Precession({ a, e, i }) {
  const n = Math.sqrt(GM / a**3)
  const ir = i * Math.PI/180
  const raanDot = -1.5 * n * CONST.J2 * (Re/a)**2 * Math.cos(ir) / (1-e**2)**2
  const wDot    = 0.75 * n * CONST.J2 * (Re/a)**2 * (5*Math.cos(ir)**2 - 1) / (1-e**2)**2
  return {
    raanDotDeg: raanDot * 180/Math.PI * 86400,   // deg/day
    wDotDeg:    wDot    * 180/Math.PI * 86400,
  }
}

// Ground track points (simplified, no perturbations)
export function groundTrack({ a, e, i, raan, w, nRevs = 3, nPts = 200 }) {
  const T = 2 * Math.PI * Math.sqrt(a**3 / GM)
  const pts = []
  const earthRotRate = 7.2921150e-5  // rad/s
  for (let k = 0; k < nPts; k++) {
    const t = k / nPts * nRevs * T
    const M = 2 * Math.PI * t / T  // mean anomaly
    // Solve Kepler's equation E - e*sin(E) = M (Newton-Raphson)
    let E = M
    for (let it = 0; it < 10; it++) E -= (E - e*Math.sin(E) - M) / (1 - e*Math.cos(E))
    const nu = 2 * Math.atan2(Math.sqrt(1+e)*Math.sin(E/2), Math.sqrt(1-e)*Math.cos(E/2))
    const orb = keplerOrbit({ a, e, i, raan, w, nu: nu*180/Math.PI })
    // Convert ECI to ECEF (account for Earth rotation)
    const theta_earth = earthRotRate * t
    const [X, Y, Z] = orb.pos
    const Xe = X*Math.cos(theta_earth) + Y*Math.sin(theta_earth)
    const Ye = -X*Math.sin(theta_earth) + Y*Math.cos(theta_earth)
    const Ze = Z
    const lat = Math.atan2(Ze, Math.sqrt(Xe**2+Ye**2)) * 180/Math.PI
    const lon = Math.atan2(Ye, Xe) * 180/Math.PI
    pts.push({ lat, lon, alt: orb.alt / 1000, t })
  }
  return pts
}

// Atmospheric re-entry (simplified ballistic)
export function reentry({ m, CD, A, v0, gamma0Deg = -5, h0 = 120000 }) {
  // Simplified ballistic coefficient β = m/(CD*A)
  const beta = m / (CD * A)
  const gamma0 = gamma0Deg * Math.PI / 180
  const g = CONST.g0
  const pts = []
  let v = v0, h = h0, gamma = gamma0, t = 0, x = 0
  const dt = 1  // s
  for (let step = 0; step < 20000 && h > 0; step++) {
    const { rho, a } = isa(h)
    const q = 0.5 * rho * v**2
    const D = q * CD * A
    const L = 0  // ballistic (no lift)
    const dvdt = -D/m - g*Math.sin(gamma)
    const dgdt = (L/m - g*Math.cos(gamma) + v**2*Math.cos(gamma)/(Re+h)) / v
    v += dvdt * dt
    gamma += dgdt * dt
    h += v * Math.sin(gamma) * dt
    x += v * Math.cos(gamma) * dt
    t += dt
    const qDot_chapman = 1.83e-4 * Math.sqrt(rho/0.3048) * v**3  // W/m² approximate
    if (step % 50 === 0) pts.push({ t, h: h/1000, v, gamma: gamma*180/Math.PI, q, mach: v/a, qDot: qDot_chapman/1e6 })
    if (v < 100) break
  }
  return pts
}

// ── Flight Performance ────────────────────────────────────────
export function flightPerformance({ W, S, CD0, e, AR, CLmax, Tmax, rhoAlt = 0, hService = 12000 }) {
  const rho = isa(rhoAlt).rho
  const rho0 = CONST.rho0
  const K = 1 / (Math.PI * e * AR)
  const q_md = Math.sqrt(CD0 / K)  // q at min drag
  const V_md = Math.sqrt(2*W/(rho*S) * Math.sqrt(K/CD0))
  const V_s  = Math.sqrt(2*W/(rho*S*CLmax))
  const LD_max = 1 / (2 * Math.sqrt(CD0 * K))
  // Best climb
  const V_y = Math.sqrt(2*W/(rho*S) * Math.sqrt(K/(3*CD0)))
  const CD_y = CD0 + K * (2*W/(rho*V_y**2*S))**2
  const T_y  = 0.5*rho*V_y**2*S*CD_y
  const RC_max = V_y * (Tmax - T_y) / W
  // Service ceiling (simplified)
  const V_n_diag = Array.from({length:30}, (_, i) => {
    const V = V_s + i * (3*V_s - V_s) / 29
    const n_aero = 0.5*rho*V**2*S*CLmax / W
    const n_struct = 3.8  // limit load factor (FAR 25)
    return { V, n_pos: Math.min(n_aero, n_struct), n_neg: -1.5 }
  })
  // Breguet range (jet)
  const Isp_equiv = 3600 / 0.06   // typical TSFC 0.06 kg/(N·s)
  const range_jet = (LD_max * Isp_equiv * CONST.g0 / CONST.g0) * Math.log(1 / (1 - 0.3))
  // Glide
  const glide = LD_max

  return {
    V_md, V_s, LD_max, V_y, RC_max: Math.max(0, RC_max),
    glide, K, CD0, AR, e,
    V_n: V_n_diag,
    stallSpeedKt: V_s * 1.944,
    V_mdKt: V_md * 1.944,
  }
}

// ── Mass Properties Engine ────────────────────────────────────
export function massProperties(bodies) {
  // bodies: [{mass, cx, cy, cz, Ixx, Iyy, Izz, Ixy, Ixz, Iyz}]
  let totalMass = 0
  let cx = 0, cy = 0, cz = 0
  for (const b of bodies) {
    totalMass += b.mass
    cx += b.mass * b.cx
    cy += b.mass * b.cy
    cz += b.mass * b.cz
  }
  if (totalMass < 1e-10) return { totalMass: 0, cg: [0,0,0], I: [[0,0,0],[0,0,0],[0,0,0]] }
  cx /= totalMass; cy /= totalMass; cz /= totalMass

  // Parallel axis theorem to CG
  let Ixx=0, Iyy=0, Izz=0, Ixy=0, Ixz=0, Iyz=0
  for (const b of bodies) {
    const dx=b.cx-cx, dy=b.cy-cy, dz=b.cz-cz
    Ixx += b.Ixx + b.mass*(dy**2+dz**2)
    Iyy += b.Iyy + b.mass*(dx**2+dz**2)
    Izz += b.Izz + b.mass*(dx**2+dy**2)
    Ixy += (b.Ixy||0) + b.mass*dx*dy
    Ixz += (b.Ixz||0) + b.mass*dx*dz
    Iyz += (b.Iyz||0) + b.mass*dy*dz
  }
  return {
    totalMass, cg: [cx, cy, cz],
    I: [[Ixx, -Ixy, -Ixz], [-Ixy, Iyy, -Iyz], [-Ixz, -Iyz, Izz]],
    Ixx, Iyy, Izz, Ixy, Ixz, Iyz,
  }
}

// ── Classical Lamination Theory ───────────────────────────────
export function clt(plies, { E1, E2, G12, nu12 }) {
  // plies: [{angle_deg, thickness}]
  const nu21 = nu12 * E2 / E1
  const denom = 1 - nu12 * nu21
  const Q11 = E1/denom, Q22 = E2/denom, Q12 = nu12*E2/denom, Q66 = G12
  let A=[[0,0,0],[0,0,0],[0,0,0]]
  let B=[[0,0,0],[0,0,0],[0,0,0]]
  let D=[[0,0,0],[0,0,0],[0,0,0]]
  let z = -plies.reduce((s,p) => s+p.thickness, 0) / 2
  for (const ply of plies) {
    const th = ply.angle_deg * Math.PI/180
    const c=Math.cos(th), s=Math.sin(th)
    const c2=c*c, s2=s*s, cs=c*s
    // Transformed reduced stiffness [Q-bar]
    const Qb11 = Q11*c2**2 + 2*(Q12+2*Q66)*s2*c2 + Q22*s2**2
    const Qb22 = Q11*s2**2 + 2*(Q12+2*Q66)*s2*c2 + Q22*c2**2
    const Qb12 = (Q11+Q22-4*Q66)*s2*c2 + Q12*(s2**2+c2**2)
    const Qb66 = (Q11+Q22-2*Q12-2*Q66)*s2*c2 + Q66*(s2**2+c2**2)
    const Qb16 = (Q11-Q12-2*Q66)*s*c**3 + (Q12-Q22+2*Q66)*s**3*c
    const Qb26 = (Q11-Q12-2*Q66)*s**3*c + (Q12-Q22+2*Q66)*s*c**3
    const Qb = [[Qb11,Qb12,Qb16],[Qb12,Qb22,Qb26],[Qb16,Qb26,Qb66]]
    const zk = z + ply.thickness
    const dA = zk - z
    const dB = (zk**2 - z**2)/2
    const dD = (zk**3 - z**3)/3
    for (let r=0;r<3;r++) for (let c2=0;c2<3;c2++) {
      A[r][c2] += Qb[r][c2] * dA
      B[r][c2] += Qb[r][c2] * dB
      D[r][c2] += Qb[r][c2] * dD
    }
    z = zk
  }
  return { A, B, D }
}
