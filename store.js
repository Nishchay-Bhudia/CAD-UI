// ============================================================
// AeroForge CAD — Zustand State Store (with persistence)
// ============================================================

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'
import { MATERIALS } from './data.js'

const defaultWing = { span: 10, rootChord: 1.5, tipChord: 0.75, sweep: 15, dihedral: 5, twist: -2 }

const makeId = () => Math.random().toString(36).slice(2, 9)

const defaultFeature = (type, name, params = {}) => ({
  id: makeId(),
  type,
  name,
  params,
  materialKey: '2024-T3',
  visible: true,
  selected: false,
  locked: false,
  children: [],
  mass: 0,
  volume: 0,
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
})

export const useStore = create(
  persist(
    immer((set, get) => ({
      // ── Auth / User ─────────────────────────────────────
      user: null,
      authModal: false,

      // ── Model State ──────────────────────────────────────
      modelName: 'Untitled Model',
      modelId: makeId(),
      isDirty: false,
      models: [],

      // ── Feature Tree ────────────────────────────────────
      features: [],
      selectedId: null,
      hoveredId: null,

      // ── Assembly ─────────────────────────────────────────
      assembly: {
        mates: [],
        exploded: false,
        explodeDistance: 2,
      },

      // ── Viewport State ───────────────────────────────────
      viewMode: 'shaded-edges',
      cameraPreset: 'iso',
      showGrid: true,
      showAxes: true,
      showSectionPlane: false,
      sectionPlaneAxis: 'x',
      sectionPlaneOffset: 0,
      renderQuality: 0.7,
      showShadows: true,
      showAO: false,
      background: 'gradient',
      showMeasure: false,

      // ── Sketcher ─────────────────────────────────────────
      sketcherActive: false,
      sketchPlane: 'XY',
      sketchEntities: [],
      sketchConstraints: [],
      sketchSolved: false,

      // ── Panels ───────────────────────────────────────────
      activeRightPanel: 'properties',
      leftPanelWidth: 260,
      rightPanelWidth: 300,

      // ── Analysis State ───────────────────────────────────
      analysisMode: null,
      analysisResults: {},
      analysisRunning: false,
      vlmConfig: {
        wing: defaultWing,
        alpha: 5, alphaMin: -4, alphaMax: 16, nAlpha: 11,
        mach: 0.2, alt: 3000, beta: 0,
      },
      feaConfig: {
        length: 5, nElements: 10, material: 'Ti-6Al-4V',
        tipLoad: 1000, includeGravity: true, showDeformed: true, scaleDeformed: 100,
      },
      propConfig: {
        Pc: 20e6, Pe: 101325, Tc: 3600, At: 0.07, gamma: 1.3, molarMass: 20,
        propellant: 'LOX/LH2',
        stages: [
          { name: 'Stage 1', Isp: 310, mWet: 400000, mDry: 22000 },
          { name: 'Stage 2', Isp: 450, mWet: 100000, mDry: 8000 },
        ],
      },
      orbitalConfig: {
        a: 6771000, e: 0.001, i: 51.6, raan: 0, w: 0, nu: 0, nRevs: 5,
      },
      perfConfig: {
        W: 80000, S: 120, CD0: 0.025, e: 0.85, AR: 9.0, CLmax: 2.1, Tmax: 120000, alt: 0,
      },
      atmosConfig: { altMin: 0, altMax: 86000, nPts: 50 },
      cltConfig: {
        plies: [
          { angle_deg: 0,   thickness: 0.000125 },
          { angle_deg: 45,  thickness: 0.000125 },
          { angle_deg: -45, thickness: 0.000125 },
          { angle_deg: 90,  thickness: 0.000125 },
          { angle_deg: 90,  thickness: 0.000125 },
          { angle_deg: -45, thickness: 0.000125 },
          { angle_deg: 45,  thickness: 0.000125 },
          { angle_deg: 0,   thickness: 0.000125 },
        ],
        material: 'IM7/8552',
      },

      // ── Theme ────────────────────────────────────────────
      theme: 'dark',

      // ── Dialogs / Modals ─────────────────────────────────
      activeDialog: null,
      dialogData: null,

      // ── History (undo/redo) ───────────────────────────────
      history: [],
      historyIndex: -1,

      // ── Status Bar ───────────────────────────────────────
      statusMode: 'Select',
      statusSelection: 'Nothing selected',
      statusCoords: [0, 0, 0],
      statusUnits: 'SI (m, kg, N)',

      // ── Units ────────────────────────────────────────────
      units: 'SI',

      // ── ── ACTIONS ── ──────────────────────────────────────

      // Auth
      login: (user) => set(s => { s.user = user; s.authModal = false }),
      logout: () => set(s => { s.user = null }),
      setAuthModal: (v) => set(s => { s.authModal = v }),

      // Model
      setModelName: (name) => set(s => { s.modelName = name; s.isDirty = true }),
      newModel: () => set(s => {
        s.features = []; s.selectedId = null; s.analysisResults = {}
        s.modelName = 'Untitled Model'; s.modelId = makeId(); s.isDirty = false
      }),
      saveModel: () => set(s => {
        const snapshot = {
          id: s.modelId, name: s.modelName,
          features: JSON.parse(JSON.stringify(s.features)),
          savedAt: new Date().toISOString(),
        }
        const idx = s.models.findIndex(m => m.id === s.modelId)
        if (idx >= 0) s.models[idx] = snapshot; else s.models.push(snapshot)
        s.isDirty = false
      }),
      loadModel: (model) => set(s => {
        s.features = (model.features || []).map(f => ({
          ...defaultFeature(f.type, f.name, f.params),
          ...f,
          position: f.position || [0,0,0],
          rotation: f.rotation || [0,0,0],
          scale:    f.scale    || [1,1,1],
        }))
        s.modelName = model.name; s.modelId = model.id || makeId()
        s.selectedId = null; s.isDirty = false
      }),

      // Feature Tree
      addFeature: (type, name, params = {}) => set(s => {
        const f = defaultFeature(type, name, params)
        s.features.push(f); s.selectedId = f.id; s.isDirty = true
      }),
      removeFeature: (id) => set(s => {
        s.features = s.features.filter(f => f.id !== id)
        if (s.selectedId === id) s.selectedId = null
        s.isDirty = true
      }),
      updateFeatureParams: (id, params) => set(s => {
        const f = s.features.find(f => f.id === id)
        if (f) { Object.assign(f.params, params); s.isDirty = true }
      }),
      updateFeatureMaterial: (id, materialKey) => set(s => {
        const f = s.features.find(f => f.id === id)
        if (f) { f.materialKey = materialKey; s.isDirty = true }
      }),
      updateFeatureTransform: (id, field, axis, value) => set(s => {
        const f = s.features.find(f => f.id === id)
        if (f) {
          if (!f[field]) f[field] = field === 'scale' ? [1,1,1] : [0,0,0]
          f[field][axis] = parseFloat(value) || 0
          s.isDirty = true
        }
      }),
      toggleFeatureVisible: (id) => set(s => {
        const f = s.features.find(f => f.id === id)
        if (f) f.visible = !f.visible
      }),
      selectFeature: (id) => set(s => { s.selectedId = id }),
      hoverFeature: (id) => set(s => { s.hoveredId = id }),
      moveFeatureUp: (id) => set(s => {
        const i = s.features.findIndex(f => f.id === id)
        if (i > 0) [s.features[i-1], s.features[i]] = [s.features[i], s.features[i-1]]
      }),
      moveFeatureDown: (id) => set(s => {
        const i = s.features.findIndex(f => f.id === id)
        if (i < s.features.length-1) [s.features[i], s.features[i+1]] = [s.features[i+1], s.features[i]]
      }),
      renameFeature: (id, name) => set(s => {
        const f = s.features.find(f => f.id === id)
        if (f) { f.name = name; s.isDirty = true }
      }),
      duplicateFeature: (id) => set(s => {
        const f = s.features.find(f => f.id === id)
        if (f) {
          const copy = { ...JSON.parse(JSON.stringify(f)), id: makeId(), name: f.name + ' (copy)' }
          copy.position = [f.position[0]+0.5, f.position[1], f.position[2]+0.5]
          const i = s.features.findIndex(f => f.id === id)
          s.features.splice(i+1, 0, copy); s.selectedId = copy.id
        }
      }),

      // Sketcher
      setSketcherActive: (v) => set(s => { s.sketcherActive = v }),
      setSketchPlane: (plane) => set(s => { s.sketchPlane = plane }),
      addSketchEntity: (entity) => set(s => { s.sketchEntities.push(entity) }),
      clearSketch: () => set(s => { s.sketchEntities = []; s.sketchConstraints = [] }),

      // Viewport
      setViewMode: (m) => set(s => { s.viewMode = m }),
      setCameraPreset: (p) => set(s => { s.cameraPreset = p }),
      toggleGrid: () => set(s => { s.showGrid = !s.showGrid }),
      toggleAxes: () => set(s => { s.showAxes = !s.showAxes }),
      toggleSectionPlane: () => set(s => { s.showSectionPlane = !s.showSectionPlane }),
      setSectionPlane: (axis, offset) => set(s => { s.sectionPlaneAxis = axis; s.sectionPlaneOffset = offset }),
      setBackground: (bg) => set(s => { s.background = bg }),
      setRenderQuality: (q) => set(s => { s.renderQuality = q }),

      // Panels
      setActiveRightPanel: (p) => set(s => { s.activeRightPanel = p }),

      // Analysis
      setAnalysisMode: (m) => set(s => { s.analysisMode = m; if (m) s.activeRightPanel = 'analysis' }),
      setAnalysisRunning: (v) => set(s => { s.analysisRunning = v }),
      setAnalysisResults: (key, results) => set(s => { s.analysisResults[key] = results }),
      clearAnalysisResults: () => set(s => { s.analysisResults = {} }),
      updateVlmConfig: (cfg) => set(s => { Object.assign(s.vlmConfig, cfg) }),
      updateFeaConfig: (cfg) => set(s => { Object.assign(s.feaConfig, cfg) }),
      updatePropConfig: (cfg) => set(s => { Object.assign(s.propConfig, cfg) }),
      updateOrbitalConfig: (cfg) => set(s => { Object.assign(s.orbitalConfig, cfg) }),
      updatePerfConfig: (cfg) => set(s => { Object.assign(s.perfConfig, cfg) }),
      updateAtmosConfig: (cfg) => set(s => { Object.assign(s.atmosConfig, cfg) }),
      updateCltConfig: (cfg) => set(s => { Object.assign(s.cltConfig, cfg) }),
      addPropStage: () => set(s => {
        s.propConfig.stages.push({ name: `Stage ${s.propConfig.stages.length+1}`, Isp: 350, mWet: 50000, mDry: 5000 })
      }),
      removePropStage: (i) => set(s => { s.propConfig.stages.splice(i, 1) }),
      updatePropStage: (i, field, value) => set(s => { s.propConfig.stages[i][field] = value }),
      addCltPly: () => set(s => { s.cltConfig.plies.push({ angle_deg: 0, thickness: 0.000125 }) }),
      removeCltPly: (i) => set(s => { s.cltConfig.plies.splice(i, 1) }),
      updateCltPly: (i, field, value) => set(s => { s.cltConfig.plies[i][field] = parseFloat(value) }),

      // Theme
      toggleTheme: () => set(s => {
        s.theme = s.theme === 'dark' ? 'light' : 'dark'
        document.documentElement.setAttribute('data-theme', s.theme)
      }),

      // Dialogs
      openDialog: (name, data = null) => set(s => { s.activeDialog = name; s.dialogData = data }),
      closeDialog: () => set(s => { s.activeDialog = null; s.dialogData = null }),

      // Status
      setStatus: (mode, selection, coords) => set(s => {
        if (mode) s.statusMode = mode
        if (selection) s.statusSelection = selection
        if (coords) s.statusCoords = coords
      }),

      // Units
      setUnits: (u) => set(s => { s.units = u }),

      // Computed helpers
      getSelectedFeature: () => {
        const s = get()
        return s.features.find(f => f.id === s.selectedId) || null
      },
      getSelectedMaterial: () => {
        const s = get()
        const f = s.features.find(f => f.id === s.selectedId)
        return f ? (MATERIALS[f.materialKey] || MATERIALS['2024-T3']) : null
      },
      getTotalMass: () => {
        return get().features.reduce((sum, f) => sum + (f.mass || 0), 0)
      },
      getBOM: () => {
        return get().features.map((f, i) => ({
          item: i + 1, name: f.name, type: f.type,
          material: f.materialKey, visible: f.visible,
          mass: f.mass || 0, volume: f.volume || 0,
        }))
      },
    })),
    {
      name: 'aeroforge-v1',
      partialize: (s) => ({
        user: s.user,
        theme: s.theme,
        models: s.models,
        features: s.features,
        modelName: s.modelName,
        modelId: s.modelId,
        units: s.units,
      }),
    }
  )
)
