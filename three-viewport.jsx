// ============================================================
// AeroForge CAD — Three.js 3D Viewport
// ============================================================

import { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { useStore } from './store.js'
import { nacaContour } from './data.js'

// ── Geometry Builders ─────────────────────────────────────────
function buildNACAWing(params) {
  const { series='2412', span=10, rootChord=1.5, taper=0.5, sweep=15, dihedral=5 } = params
  const tipChord = rootChord * taper
  const sweepRad = sweep * Math.PI / 180
  const dihRad   = dihedral * Math.PI / 180
  const N = 40  // spanwise stations
  const points = []
  const indices = []
  const contour = nacaContour(series, 30)
  for (let j = 0; j <= N; j++) {
    const t = j / N
    const y = t * span / 2
    const chord = rootChord + (tipChord - rootChord) * t
    const xOff  = Math.tan(sweepRad) * y
    const zOff  = Math.tan(dihRad) * y
    for (const [cx, cy] of contour) {
      points.push(xOff + cx * chord, zOff + cy * chord, y)
    }
  }
  // Build faces between station strips
  const nC = contour.length
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < nC - 1; i++) {
      const a = j * nC + i, b = j * nC + i + 1
      const c = (j+1) * nC + i, d = (j+1) * nC + i + 1
      indices.push(a, b, d, a, d, c)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  // Mirror for full wingspan
  const pts2 = []
  for (let i = 0; i < points.length; i += 3) {
    pts2.push(points[i], points[i+1], -points[i+2])
  }
  const geo2 = new THREE.BufferGeometry()
  geo2.setAttribute('position', new THREE.Float32BufferAttribute(pts2, 3))
  geo2.setIndex([...indices])
  geo2.computeVertexNormals()
  return [geo, geo2]
}

function buildFuselage(params) {
  const { length=30, maxDiameter=4, noseLR=2.5, tailUpsweep=8 } = params
  const R = maxDiameter / 2
  const nL = 50, nC = 32
  const noseLen = Math.min(R * noseLR, length * 0.35)
  const tailLen = length * 0.3
  const cylLen  = length - noseLen - tailLen
  const pts = [], idx = []
  const tailUpsR = tailUpsweep * Math.PI / 180
  for (let i = 0; i <= nL; i++) {
    const t = i / nL
    const x = t * length
    let r, yOff = 0
    if (x < noseLen) {
      const nt = x / noseLen
      r = R * Math.sin(nt * Math.PI/2)
    } else if (x < noseLen + cylLen) {
      r = R
    } else {
      const tt = (x - noseLen - cylLen) / tailLen
      r = R * (1 - 0.9 * tt)
      yOff = Math.sin(tt * Math.PI/2) * tailLen * 0.15 * Math.sin(tailUpsR)
    }
    for (let j = 0; j <= nC; j++) {
      const a = j / nC * Math.PI * 2
      pts.push(x - length/2, r * Math.sin(a) + yOff, r * Math.cos(a))
    }
  }
  const nCp1 = nC + 1
  for (let i = 0; i < nL; i++) {
    for (let j = 0; j < nC; j++) {
      const a = i * nCp1 + j, b = a + 1
      const c = (i+1) * nCp1 + j, d = c + 1
      idx.push(a,b,d, a,d,c)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

function buildNoseCone(params) {
  const { diameter=1.2, length=2.5, profile='ogive' } = params
  const R = diameter / 2
  const N = 40, nC = 32
  const pts = [], idx = []
  for (let i = 0; i <= N; i++) {
    const t = i / N
    let r
    if (profile === 'ogive') r = R * Math.sqrt(1 - (1-t)**2)
    else if (profile === 'conical') r = R * t
    else if (profile === 'parabolic') r = R * (2*t - t**2)
    else if (profile === 'von-karman') r = R * Math.sqrt(Math.acos(1-2*t)/Math.PI - Math.sin(2*Math.acos(1-2*t))/(2*Math.PI))
    else r = R * t
    for (let j = 0; j <= nC; j++) {
      const a = j / nC * Math.PI * 2
      pts.push(t * length, r * Math.sin(a), r * Math.cos(a))
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < nC; j++) {
    const a=i*(nC+1)+j, b=a+1, c=(i+1)*(nC+1)+j, d=c+1
    idx.push(a,b,d, a,d,c)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

function buildNozzle(params) {
  const { throatDiam=0.3, exitDiam=1.2, halfAngle=15, convergLen=0.3, divergLen=1.0 } = params
  const Rt = throatDiam/2, Re = exitDiam/2
  const nC = 32, nL = 20
  const pts = [], idx = []
  // Convergent section (inlet radius 2*Rt to throat)
  for (let i = 0; i <= nL; i++) {
    const t = i/nL
    const r = 2*Rt - (2*Rt-Rt)*Math.sin(t*Math.PI/2)
    const x = -convergLen * (1 - t)
    for (let j = 0; j <= nC; j++) {
      const a = j/nC*Math.PI*2
      pts.push(x, r*Math.sin(a), r*Math.cos(a))
    }
  }
  // Divergent section (throat to exit)
  for (let i = 0; i <= nL; i++) {
    const t = i/nL
    const r = Rt + (Re-Rt)*(3*t**2 - 2*t**3)
    const x = t * divergLen
    for (let j = 0; j <= nC; j++) {
      const a = j/nC*Math.PI*2
      pts.push(x, r*Math.sin(a), r*Math.cos(a))
    }
  }
  const totalSlices = 2*nL + 2
  const nCp1 = nC+1
  for (let i = 0; i < totalSlices-1; i++) for (let j = 0; j < nC; j++) {
    const a=i*nCp1+j, b=a+1, c=(i+1)*nCp1+j, d=c+1
    idx.push(a,b,d, a,d,c)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

function buildSolarPanel(params) {
  const { panelCount=4, panelWidth=2, panelLength=3 } = params
  const group = new THREE.Group()
  for (let i = 0; i < panelCount; i++) {
    const geo = new THREE.BoxGeometry(panelLength, 0.02, panelWidth)
    const mesh = new THREE.Mesh(geo)
    mesh.position.x = i * (panelLength + 0.2)
    group.add(mesh)
    const frame = new THREE.EdgesGeometry(geo)
    const eMesh = new THREE.LineSegments(frame, new THREE.LineBasicMaterial({ color: 0x445566 }))
    eMesh.position.copy(mesh.position)
    group.add(eMesh)
  }
  return group
}

function buildFromFeature(feature) {
  const { type, params } = feature
  try {
    switch (type) {
      case 'naca4-airfoil': {
        const [g1, g2] = buildNACAWing(params)
        return [g1, g2]
      }
      case 'delta-wing': {
        const apex = params.apex || 60
        const root = params.rootChord || 8
        const span = root * Math.tan((90-apex/2)*Math.PI/180)
        return buildNACAWing({ ...params, span, taper: 0.05, sweep: 90-apex/2, dihedral: 0 })
      }
      case 'swept-wing': {
        return buildNACAWing({ ...params, rootChord: params.rootChord||6, taper: (params.tipChord||2)/(params.rootChord||6), series: '2312' })
      }
      case 'horiz-stab':
      case 'canard':
        return buildNACAWing({ ...params, series: '0012', taper: 0.5 })
      case 'winglet': {
        const geo = buildNACAWing({ ...params, span: params.height||2.5, rootChord: 0.8, taper: 0.4, sweep: 30, dihedral: 0 })
        return geo
      }
      case 'fuselage': return buildFuselage(params)
      case 'nose-cone': return buildNoseCone(params)
      case 'sears-haack': {
        const { length=20, maxRadius=1.5 } = params
        const nC=32, nL=50, pts=[], idx=[]
        for (let i=0;i<=nL;i++) {
          const x = i/nL * length
          const s = x / length
          const r = maxRadius * Math.pow(1 - (2*s-1)**2, 0.75)
          for (let j=0;j<=nC;j++) {
            const a = j/nC*Math.PI*2
            pts.push(x-length/2, r*Math.sin(a), r*Math.cos(a))
          }
        }
        for (let i=0;i<nL;i++) for (let j=0;j<nC;j++) {
          const a=i*(nC+1)+j, b=a+1, c=(i+1)*(nC+1)+j, d=c+1
          idx.push(a,b,d,a,d,c)
        }
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
        geo.setIndex(idx); geo.computeVertexNormals()
        return geo
      }
      case 'fairing': return buildNoseCone({ diameter: params.diameter||5.4, length: params.length||13.8, profile: 'ogive' })
      case 'pressure-vessel': {
        const { radius=0.5, length: L=2 } = params
        return new THREE.CylinderGeometry(radius, radius, L, 32, 1, false)
      }
      case 'turbofan-nacelle': {
        const { fanDiameter=2.8, length=4.5 } = params
        const R = fanDiameter / 2
        return new THREE.CylinderGeometry(R * 0.95, R, length, 32)
      }
      case 'rocket-engine': {
        const { thrust=1000 } = params
        const R = Math.pow(thrust/1000, 0.33) * 0.5
        return buildNozzle({ throatDiam: R*0.4, exitDiam: R*1.5, divergLen: R*3 })
      }
      case 'solid-rocket': {
        const { diameter=1.85, length=26.8 } = params
        return new THREE.CylinderGeometry(diameter/2, diameter/2, length, 32)
      }
      case 'nozzle': return buildNozzle(params)
      case 'aerospike': {
        const { baseRadius=0.8, length=1.2 } = params
        return new THREE.CylinderGeometry(0.05, baseRadius, length, 32)
      }
      case 'ramjet-inlet': {
        const { captureArea=0.5 } = params
        const R = Math.sqrt(captureArea/Math.PI)
        return new THREE.CylinderGeometry(R, R*1.3, R*4, 32)
      }
      case 'wing-spar': {
        const { height=0.25, length=8 } = params
        return new THREE.BoxGeometry(length, height, height*0.4)
      }
      case 'wing-rib': {
        const { chord=2 } = params
        const pts = nacaContour('2412', 40)
        const shape = new THREE.Shape(pts.map(([x,y]) => new THREE.Vector2(x*chord - chord/2, y*chord)))
        const geo = new THREE.ShapeGeometry(shape)
        return geo
      }
      case 'fuselage-frame': {
        const { diameter=4 } = params
        const geo = new THREE.TorusGeometry(diameter/2, diameter*0.02, 8, 64)
        return geo
      }
      case 'stringer': {
        const { length=5, height=0.04 } = params
        return new THREE.BoxGeometry(length, height, height*0.8)
      }
      case 'shear-web': {
        const { height=0.3, length=2, thickness=0.003 } = params
        return new THREE.BoxGeometry(length, height, thickness)
      }
      case 'oleo-strut': {
        const { length=1.2, cylD=0.18 } = params
        return new THREE.CylinderGeometry(cylD/2, cylD/2*0.8, length, 16)
      }
      case 'wheel-tire': {
        const { outerDiam=1.0, width=0.35 } = params
        return new THREE.TorusGeometry(outerDiam/2 - width/2, width/2, 12, 32)
      }
      case 'gear-assembly': {
        const geo = new THREE.CylinderGeometry(0.5, 0.5, params.strutHeight||1.4, 8)
        return geo
      }
      case 'solar-panel': return buildSolarPanel(params)
      case 'satellite-bus': {
        const { width=1.5, depth=1.5, height=2 } = params
        return new THREE.BoxGeometry(width, height, depth)
      }
      case 'dish-antenna': {
        const { diameter=3.5, fOverD=0.4 } = params
        const R = diameter/2, nR=20, nA=32, pts=[], idx=[]
        for (let i=0;i<=nR;i++) {
          const r = R * i/nR
          const z = r**2 / (4 * fOverD * R)
          for (let j=0;j<=nA;j++) {
            const a = j/nA*Math.PI*2
            pts.push(r*Math.cos(a), r*Math.sin(a), z)
          }
        }
        for (let i=0;i<nR;i++) for (let j=0;j<nA;j++) {
          const a=i*(nA+1)+j, b=a+1, c=(i+1)*(nA+1)+j, d=c+1
          idx.push(a,b,d, a,d,c)
        }
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
        geo.setIndex(idx); geo.computeVertexNormals()
        return geo
      }
      case 'heat-shield': {
        const { diameter=4.5, rNose=1.0 } = params
        return new THREE.SphereGeometry(diameter/2, 32, 16, 0, Math.PI*2, 0, Math.PI/2)
      }
      case 'propellant-tank': {
        const { radius=0.8, length=2 } = params
        return new THREE.CylinderGeometry(radius, radius, length+radius*2, 32)
      }
      case 'reaction-wheel': {
        const { diameter=0.3, thickness=0.06 } = params
        return new THREE.CylinderGeometry(diameter/2, diameter/2, thickness, 32)
      }
      case 'radiator': {
        const { width=2, length=5 } = params
        return new THREE.BoxGeometry(length, 0.01, width)
      }
      case 'box': {
        const { width=1, height=1, depth=1 } = params
        return new THREE.BoxGeometry(width, height, depth)
      }
      case 'cylinder': {
        const { radius=0.5, height=2, segs=32 } = params
        return new THREE.CylinderGeometry(radius, radius, height, segs)
      }
      case 'sphere': {
        const { radius=0.5, widthSegs=32, heightSegs=16 } = params
        return new THREE.SphereGeometry(radius, widthSegs, heightSegs)
      }
      case 'cone': {
        const { bottomR=0.5, topR=0, height=1, segs=32 } = params
        return new THREE.CylinderGeometry(topR, bottomR, height, segs)
      }
      case 'torus': {
        const { R=1, r=0.3, segs=32 } = params
        return new THREE.TorusGeometry(R, r, 12, segs)
      }
      default: return new THREE.BoxGeometry(1, 1, 1)
    }
  } catch (e) {
    console.warn('Geometry build error:', e)
    return new THREE.BoxGeometry(0.5, 0.5, 0.5)
  }
}

// ── Material Helpers ─────────────────────────────────────────
const MATERIAL_COLORS = {
  'Aluminum Alloy': 0xb0b8c8, 'Titanium Alloy': 0x8899aa, 'Steel Alloy': 0x778899,
  'Nickel Superalloy': 0xddbb88, 'CFRP': 0x222233, 'GFRP': 0xddeeff,
  'Aramid Composite': 0xffe0aa, 'Ceramic Matrix Composite': 0x778866,
  'TPS Ceramic': 0xaaaaaa, 'Polymer': 0xeeddcc, 'Beryllium Alloy': 0xccddaa,
  'Magnesium Alloy': 0xccddcc, 'Custom': 0xaabbcc,
}
import { MATERIALS } from './data.js'

function getMeshColor(materialKey, viewMode, selected, hovered) {
  if (selected) return 0x38bdf8
  if (hovered) return 0x7dd3fc
  const mat = MATERIALS[materialKey]
  const base = mat ? (MATERIAL_COLORS[mat.category] || 0x3a7fbf) : 0x3a7fbf
  return base
}

// ── Viewport Component ────────────────────────────────────────
export default function ThreeViewport({ onCoordsChange }) {
  const canvasRef = useRef(null)
  const sceneRef  = useRef(null)
  const rendRef   = useRef(null)
  const camRef    = useRef(null)
  const raycasterRef = useRef(new THREE.Raycaster())
  const meshMapRef = useRef({})  // featureId -> mesh/group
  const animRef   = useRef(null)
  const mouseRef  = useRef({ x: 0, y: 0, isDown: false, button: 0, lastX: 0, lastY: 0 })
  const sphericalRef = useRef({ theta: Math.PI/4, phi: Math.PI/3, radius: 30 })

  const {
    features, selectedId, hoveredId, viewMode, showGrid, showAxes,
    showSectionPlane, sectionPlaneAxis, sectionPlaneOffset,
    background, cameraPreset, renderQuality,
    selectFeature, hoverFeature, setStatus, analysisResults,
  } = useStore()

  // ── Init ───────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio * renderQuality, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0
    rendRef.current = renderer

    const scene = new THREE.Scene()
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.01, 10000)
    camera.position.set(20, 15, 25)
    camera.lookAt(0, 0, 0)
    camRef.current = camera

    // Lighting
    const ambient = new THREE.AmbientLight(0x404060, 0.8)
    scene.add(ambient)
    const sun = new THREE.DirectionalLight(0xffffff, 1.2)
    sun.position.set(20, 40, 20)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.near = 0.5
    sun.shadow.camera.far = 500
    sun.shadow.camera.left = -50
    sun.shadow.camera.right = 50
    sun.shadow.camera.top = 50
    sun.shadow.camera.bottom = -50
    scene.add(sun)
    const fill = new THREE.DirectionalLight(0x6080aa, 0.4)
    fill.position.set(-20, -10, -20)
    scene.add(fill)
    const rim = new THREE.DirectionalLight(0x8090b0, 0.2)
    rim.position.set(0, -20, 10)
    scene.add(rim)

    // Grid
    const gridHelper = new THREE.GridHelper(100, 100, 0x1e3050, 0x1e2535)
    gridHelper.name = '__grid'
    scene.add(gridHelper)

    // Axes
    const axes = new THREE.AxesHelper(8)
    axes.name = '__axes'
    scene.add(axes)

    // Section plane visual
    const sectionGeo = new THREE.PlaneGeometry(100, 100)
    const sectionMat = new THREE.MeshBasicMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.08, side: THREE.DoubleSide })
    const sectionMesh = new THREE.Mesh(sectionGeo, sectionMat)
    sectionMesh.name = '__section'
    sectionMesh.visible = false
    scene.add(sectionMesh)

    // Resize observer
    const ro = new ResizeObserver(() => {
      const w = canvas.clientWidth, h = canvas.clientHeight
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    })
    ro.observe(canvas)

    // Render loop
    let running = true
    const animate = () => {
      if (!running) return
      animRef.current = requestAnimationFrame(animate)
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      running = false
      cancelAnimationFrame(animRef.current)
      ro.disconnect()
      renderer.dispose()
    }
  }, [])

  // ── Sync features → meshes ───────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    // Remove old meshes
    Object.keys(meshMapRef.current).forEach(id => {
      const obj = meshMapRef.current[id]
      if (obj) scene.remove(obj)
    })
    meshMapRef.current = {}

    features.forEach(feature => {
      if (!feature.visible) return
      const color = getMeshColor(feature.materialKey, viewMode, feature.id === selectedId, feature.id === hoveredId)
      let mesh

      if (feature.type === 'solar-panel') {
        const grp = new THREE.Group()
        const sub = buildSolarPanel(feature.params)
        grp.add(sub)
        mesh = grp
      } else {
        const geoResult = buildFromFeature(feature)
        if (Array.isArray(geoResult)) {
          const grp = new THREE.Group()
          geoResult.forEach(geo => {
            if (geo.isBufferGeometry) grp.add(buildMesh(geo, color, viewMode))
            else grp.add(geo)  // Three geometry object already
          })
          mesh = grp
        } else if (geoResult && geoResult.isBufferGeometry) {
          mesh = buildMesh(geoResult, color, viewMode)
        } else if (geoResult && geoResult.isGroup) {
          mesh = geoResult
        } else {
          const geo = new THREE.BoxGeometry(1, 1, 1)
          mesh = buildMesh(geo, color, viewMode)
        }
      }
      mesh.userData.featureId = feature.id
      mesh.castShadow = true
      mesh.receiveShadow = true
      scene.add(mesh)
      meshMapRef.current[feature.id] = mesh
    })
  }, [features, selectedId, hoveredId, viewMode])

  function buildMesh(geo, color, viewMode) {
    let mat
    const isWire = viewMode === 'wireframe'
    const isXray = viewMode === 'xray'
    if (isWire) {
      mat = new THREE.MeshBasicMaterial({ color, wireframe: true })
    } else if (isXray) {
      mat = new THREE.MeshPhongMaterial({ color, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
    } else {
      mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.4,
        metalness: 0.6,
        envMapIntensity: 0.5,
      })
    }
    const mesh = new THREE.Mesh(geo, mat)
    if (viewMode === 'shaded-edges' || viewMode === 'hidden-line') {
      const edges = new THREE.EdgesGeometry(geo, 15)
      const lineMat = new THREE.LineBasicMaterial({ color: 0x1e3050, linewidth: 1 })
      const lines = new THREE.LineSegments(edges, lineMat)
      mesh.add(lines)
    }
    return mesh
  }

  // ── Viewport effects ──────────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    const grid = scene.getObjectByName('__grid')
    const axes = scene.getObjectByName('__axes')
    if (grid) grid.visible = showGrid
    if (axes) axes.visible = showAxes
  }, [showGrid, showAxes])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    const section = scene.getObjectByName('__section')
    if (section) {
      section.visible = showSectionPlane
      section.position.set(
        sectionPlaneAxis === 'x' ? sectionPlaneOffset : 0,
        sectionPlaneAxis === 'y' ? sectionPlaneOffset : 0,
        sectionPlaneAxis === 'z' ? sectionPlaneOffset : 0,
      )
      section.rotation.set(
        sectionPlaneAxis === 'x' ? 0 : sectionPlaneAxis === 'y' ? Math.PI/2 : 0,
        sectionPlaneAxis === 'z' ? Math.PI/2 : 0,
        0,
      )
    }
  }, [showSectionPlane, sectionPlaneAxis, sectionPlaneOffset])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    switch (background) {
      case 'gradient':
        scene.background = new THREE.Color(0x0a0c10); break
      case 'solid':
        scene.background = new THREE.Color(0x161b25); break
      default:
        scene.background = new THREE.Color(0x0a0c10)
    }
  }, [background])

  // Camera presets
  useEffect(() => {
    const cam = camRef.current
    if (!cam) return
    const presets = {
      front: [0, 0, 30],
      top:   [0, 30, 0],
      right: [30, 0, 0],
      iso:   [20, 15, 25],
    }
    const pos = presets[cameraPreset] || presets.iso
    cam.position.set(...pos)
    cam.lookAt(0, 0, 0)
  }, [cameraPreset])

  // ── Mouse orbit controls ──────────────────────────────────────
  const handleMouseDown = useCallback((e) => {
    mouseRef.current = { ...mouseRef.current, isDown: true, button: e.button, lastX: e.clientX, lastY: e.clientY }
  }, [])

  const handleMouseMove = useCallback((e) => {
    const mouse = mouseRef.current
    const sph = sphericalRef.current
    const cam = camRef.current

    // Track coords on canvas for status bar
    const rect = canvasRef.current?.getBoundingClientRect()
    if (rect) {
      const nx = (e.clientX - rect.left) / rect.width * 2 - 1
      const ny = -(e.clientY - rect.top) / rect.height * 2 + 1
      if (onCoordsChange) onCoordsChange([nx * 20, ny * 20, 0])
    }

    if (!mouse.isDown) {
      // Hover detection
      const canvas = canvasRef.current
      if (!canvas || !sceneRef.current || !camRef.current) return
      const r = canvas.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width * 2 - 1
      const y = -((e.clientY - r.top) / r.height) * 2 + 1
      raycasterRef.current.setFromCamera({ x, y }, camRef.current)
      const meshes = Object.values(meshMapRef.current).flatMap(o => {
        const objs = []
        o.traverse(c => { if (c.isMesh) objs.push(c) })
        return objs
      })
      const hits = raycasterRef.current.intersectObjects(meshes)
      if (hits.length > 0) {
        let obj = hits[0].object
        while (obj.parent && !obj.userData.featureId && obj.parent !== sceneRef.current) obj = obj.parent
        hoverFeature(obj.userData.featureId || null)
      } else {
        hoverFeature(null)
      }
      return
    }

    const dx = e.clientX - mouse.lastX
    const dy = e.clientY - mouse.lastY
    mouseRef.current.lastX = e.clientX
    mouseRef.current.lastY = e.clientY

    if (mouse.button === 0 || mouse.button === 2) {
      // Orbit
      sph.theta -= dx * 0.008
      sph.phi   = Math.max(0.05, Math.min(Math.PI - 0.05, sph.phi + dy * 0.008))
      sphericalRef.current = sph
    } else if (mouse.button === 1) {
      // Pan
      const camDir = new THREE.Vector3()
      cam.getWorldDirection(camDir)
      const right = new THREE.Vector3().crossVectors(camDir, cam.up).normalize()
      const up    = new THREE.Vector3().crossVectors(right, camDir).normalize()
      const speed = sph.radius * 0.001
      cam.position.addScaledVector(right, -dx * speed)
      cam.position.addScaledVector(up, dy * speed)
    }

    // Update camera from spherical
    if (mouse.button === 0 || mouse.button === 2) {
      const target = new THREE.Vector3()
      // We need to track target, simplified: use scene center
      cam.position.set(
        sph.radius * Math.sin(sph.phi) * Math.sin(sph.theta),
        sph.radius * Math.cos(sph.phi),
        sph.radius * Math.sin(sph.phi) * Math.cos(sph.theta),
      )
      cam.lookAt(0, 0, 0)
    }
  }, [hoverFeature, onCoordsChange])

  const handleMouseUp = useCallback(() => {
    mouseRef.current.isDown = false
  }, [])

  const handleClick = useCallback((e) => {
    if (Math.abs(e.clientX - mouseRef.current.lastX) > 5) return  // was a drag
    const canvas = canvasRef.current
    if (!canvas || !sceneRef.current || !camRef.current) return
    const r = canvas.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width * 2 - 1
    const y = -((e.clientY - r.top) / r.height) * 2 + 1
    raycasterRef.current.setFromCamera({ x, y }, camRef.current)
    const meshes = Object.values(meshMapRef.current).flatMap(o => {
      const objs = []
      o.traverse(c => { if (c.isMesh) objs.push(c) })
      return objs
    })
    const hits = raycasterRef.current.intersectObjects(meshes)
    if (hits.length > 0) {
      let obj = hits[0].object
      while (obj.parent && !obj.userData.featureId && obj.parent !== sceneRef.current) obj = obj.parent
      const fid = obj.userData.featureId
      if (fid) {
        selectFeature(fid)
        setStatus('Select', `Feature selected`, null)
      }
    } else {
      selectFeature(null)
      setStatus('Select', 'Nothing selected', null)
    }
  }, [selectFeature, setStatus])

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const sph = sphericalRef.current
    sph.radius = Math.max(1, Math.min(500, sph.radius * (1 + e.deltaY * 0.001)))
    const cam = camRef.current
    cam.position.set(
      sph.radius * Math.sin(sph.phi) * Math.sin(sph.theta),
      sph.radius * Math.cos(sph.phi),
      sph.radius * Math.sin(sph.phi) * Math.cos(sph.theta),
    )
    cam.lookAt(0, 0, 0)
  }, [])

  const handleContextMenu = useCallback((e) => e.preventDefault(), [])

  // Keyboard zoom shortcuts (F = fit)
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return
      if (e.key === 'f' || e.key === 'F') {
        sphericalRef.current.radius = 30
        const cam = camRef.current
        const sph = sphericalRef.current
        cam.position.set(
          sph.radius * Math.sin(sph.phi) * Math.sin(sph.theta),
          sph.radius * Math.cos(sph.phi),
          sph.radius * Math.sin(sph.phi) * Math.cos(sph.theta),
        )
        cam.lookAt(0, 0, 0)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="viewport-canvas"
      style={{ display: 'block', width: '100%', height: '100%', outline: 'none', cursor: 'crosshair' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
      onWheel={handleWheel}
      onContextMenu={handleContextMenu}
    />
  )
}
