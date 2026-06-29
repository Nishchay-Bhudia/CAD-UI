// ============================================================
// AeroForge CAD — Main Application UI
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts'
import ThreeViewport from './three-viewport.jsx'
import { useStore } from './store.js'
import {
  MATERIALS, COMPONENT_CATEGORIES, SHORTCUTS, PROPELLANTS, isa, nacaContour
} from './data.js'
import {
  vlmAnalysis, vlmPolar, feaBeam, buildCantileverStructure,
  rocketNozzle, tsiolkovsky, deltaVBudget, nozzleContour, turbojetCycle,
  keplerOrbit, hohmannTransfer, planeChange, j2Precession, groundTrack, reentry,
  flightPerformance, massProperties, clt,
} from './analysis.js'

// ── Icons (inline SVG, no extra deps) ─────────────────────────
const Icon = ({ d, size=16, className='' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
)
const icons = {
  file:    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6',
  folder:  'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
  save:    'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z M17 21v-8H7v8 M7 3v5h8',
  cube:    'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
  settings:'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  plus:    'M12 5v14 M5 12h14',
  trash:   'M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  eye:     'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  eyeOff:  'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94 M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19 M1 1l22 22',
  zap:     'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  wind:    'M9.59 4.59A2 2 0 1 1 11 8H2 M12.42 15.42A2 2 0 1 0 14 19H2 M16 4h2a2 2 0 0 1 0 4h-2 M16 20h-2a2 2 0 0 1-2-2v-2',
  activity:'M22 12h-4l-3 9L9 3l-3 9H2',
  globe:   'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M2 12h20 M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
  layers:  'M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5',
  atom:    'M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M20.19 5a10 10 0 0 0-8.49-3c-.55.1-1.09.25-1.6.44M3.81 19c2.23 2.33 5.3 3.5 8.49 3 .55-.1 1.09-.25 1.6-.44 M2.75 9C1.5 12.5 2.5 16.5 5 19',
  x:       'M18 6L6 18 M6 6l12 12',
  check:   'M20 6L9 17l-5-5',
  chevronR:'M9 18l6-6-6-6',
  chevronD:'M6 9l6 6 6-6',
  copy:    'M20 9V7a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-2 M15 3H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5',
  info:    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 16v-4 M12 8h.01',
  moon:    'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  sun:     'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2 M12 20v2 M4.93 4.93l1.41 1.41 M17.66 17.66l1.41 1.41 M2 12h2 M20 12h2 M4.93 19.07l1.41-1.41 M17.66 6.34l1.41-1.41',
  user:    'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  menu:    'M3 12h18 M3 6h18 M3 18h18',
  download:'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
  upload:  'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12',
  refresh: 'M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0 1 14.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  rocket:  'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0 M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5',
  plane:   'M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19.5 2.5S18 1 16.5 2.5L13 6 4.8 4.2l2 2L9 9l-2.5.5L5 12l3 .5.5 3L11 14l.5 2.5L14 15l.5-2.5L16 11l2.8 8.2z',
}

// ── Utility ───────────────────────────────────────────────────
const fmt = (v, dec=3) => typeof v === 'number' && isFinite(v) ? v.toFixed(dec) : '—'
const fmtSci = (v) => typeof v === 'number' && isFinite(v) ? v.toExponential(3) : '—'
const fmtBig = (v) => {
  if (!isFinite(v)) return '—'
  if (Math.abs(v) >= 1e9) return (v/1e9).toFixed(2) + 'G'
  if (Math.abs(v) >= 1e6) return (v/1e6).toFixed(2) + 'M'
  if (Math.abs(v) >= 1e3) return (v/1e3).toFixed(2) + 'k'
  return v.toFixed(3)
}

// ── Small reusable UI ─────────────────────────────────────────
function PropRow({ label, value, unit, children }) {
  return (
    <div className="prop-row">
      <span className="prop-label">{label}</span>
      {children || <span className="prop-value"><span className="result-val">{value}</span>{unit && <span className="result-unit">{unit}</span>}</span>}
    </div>
  )
}

function Section({ title, children, defaultOpen=true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="section">
      <div className="section-title flex items-center justify-between cursor-pointer" onClick={() => setOpen(v => !v)}>
        <span>{title}</span>
        <Icon d={open ? icons.chevronD : icons.chevronR} size={12} />
      </div>
      {open && children}
    </div>
  )
}

function ResultCard({ label, value, unit, color='brand' }) {
  return (
    <div className="result-card">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div>
        <span className={`result-val text-${color === 'brand' ? 'sky-400' : color === 'green' ? 'green-400' : color === 'orange' ? 'yellow-400' : 'red-400'}`}>{value}</span>
        {unit && <span className="result-unit">{unit}</span>}
      </div>
    </div>
  )
}

function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex border-b border-slate-800 overflow-x-auto">
      {tabs.map(t => (
        <button key={t.id} className={`tab-btn ${active === t.id ? 'active' : ''}`} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

function NumInput({ value, onChange, min, max, step=0.001, className='prop-input' }) {
  return (
    <input type="number" className={className} value={value} min={min} max={max} step={step}
      onChange={e => onChange(parseFloat(e.target.value) || 0)} />
  )
}

function SelectInput({ value, onChange, options, className='prop-select' }) {
  return (
    <select className={className} value={value} onChange={e => onChange(e.target.value)}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

// ── Toolbar ───────────────────────────────────────────────────
function Toolbar() {
  const { addFeature, setAnalysisMode, analysisMode, openDialog, setSketcherActive, sketcherActive, viewMode, setViewMode } = useStore()

  const groups = [
    {
      label: 'Sketch', items: [
        { id: 'sketch', icon: icons.layers, label: 'Sketch', action: () => setSketcherActive(!sketcherActive), active: sketcherActive },
      ]
    },
    {
      label: '3D Features', items: [
        { id: 'pad',     icon: icons.cube,   label: 'Pad',    action: () => addFeature('box', 'Box', { width:1,height:1,depth:1 }) },
        { id: 'revolve', icon: icons.refresh, label: 'Revolve', action: () => addFeature('cylinder', 'Cylinder', { radius:0.5,height:2,segs:32 }) },
        { id: 'sphere',  icon: icons.atom,   label: 'Sphere', action: () => addFeature('sphere', 'Sphere', { radius:0.5 }) },
        { id: 'torus',   icon: icons.refresh, label: 'Torus',  action: () => addFeature('torus', 'Torus', { R:1,r:0.3,segs:32 }) },
      ]
    },
    {
      label: 'Aero', items: [
        { id: 'wing',   icon: icons.plane,  label: 'Wing',   action: () => addFeature('naca4-airfoil', 'NACA Wing', { series:'2412',span:10,rootChord:1.5,taper:0.5,sweep:15,dihedral:5,twist:-2 }) },
        { id: 'fuse',   icon: icons.rocket, label: 'Fuselage', action: () => addFeature('fuselage', 'Fuselage', { length:30,maxDiameter:4,noseLR:2.5,tailUpsweep:8 }) },
        { id: 'nose',   icon: icons.rocket, label: 'Nose',   action: () => addFeature('nose-cone', 'Nose Cone', { diameter:1.2,length:2.5,profile:'ogive' }) },
        { id: 'nozzle', icon: icons.zap,    label: 'Nozzle', action: () => addFeature('nozzle', 'Nozzle', { throatDiam:0.3,exitDiam:1.2,divergLen:1.0 }) },
      ]
    },
    {
      label: 'Struct', items: [
        { id: 'spar',   icon: icons.layers, label: 'Spar',   action: () => addFeature('wing-spar', 'Spar', { section:'I-beam',height:0.25,length:8 }) },
        { id: 'rib',    icon: icons.layers, label: 'Rib',    action: () => addFeature('wing-rib', 'Rib', { chord:2,series:'2412' }) },
        { id: 'frame',  icon: icons.layers, label: 'Frame',  action: () => addFeature('fuselage-frame', 'Frame', { diameter:4 }) },
      ]
    },
    {
      label: 'View', items: [
        { id: 'shaded', icon: icons.cube,   label: 'Shaded', action: () => setViewMode('shaded'), active: viewMode==='shaded' },
        { id: 'shade-e',icon: icons.cube,   label: 'S+Edge', action: () => setViewMode('shaded-edges'), active: viewMode==='shaded-edges' },
        { id: 'wire',   icon: icons.layers, label: 'Wire',   action: () => setViewMode('wireframe'), active: viewMode==='wireframe' },
        { id: 'xray',   icon: icons.eye,    label: 'X-Ray',  action: () => setViewMode('xray'), active: viewMode==='xray' },
      ]
    },
    {
      label: 'Analyze', items: [
        { id: 'vlm',  icon: icons.wind,     label: 'Aero',   action: () => setAnalysisMode('vlm'),  active: analysisMode==='vlm'  },
        { id: 'fea',  icon: icons.activity, label: 'FEA',    action: () => setAnalysisMode('fea'),  active: analysisMode==='fea'  },
        { id: 'prop', icon: icons.rocket,   label: 'Prop',   action: () => setAnalysisMode('propulsion'), active: analysisMode==='propulsion' },
        { id: 'orb',  icon: icons.globe,    label: 'Orbit',  action: () => setAnalysisMode('orbital'), active: analysisMode==='orbital' },
        { id: 'perf', icon: icons.zap,      label: 'Perf',   action: () => setAnalysisMode('performance'), active: analysisMode==='performance' },
        { id: 'mass', icon: icons.atom,     label: 'Mass',   action: () => setAnalysisMode('mass'), active: analysisMode==='mass' },
        { id: 'atm',  icon: icons.wind,     label: 'Atmos',  action: () => setAnalysisMode('atmosphere'), active: analysisMode==='atmosphere' },
        { id: 'clt',  icon: icons.layers,   label: 'CLT',    action: () => setAnalysisMode('clt'), active: analysisMode==='clt' },
      ]
    },
    {
      label: 'Tools', items: [
        { id: 'comp', icon: icons.folder,   label: 'Library',action: () => openDialog('component-lib') },
        { id: 'bom',  icon: icons.file,     label: 'BOM',    action: () => openDialog('bom') },
        { id: 'export',icon: icons.download, label: 'Export', action: () => openDialog('export') },
        { id: 'keys', icon: icons.info,     label: 'Keys',   action: () => openDialog('shortcuts') },
      ]
    },
  ]

  return (
    <div className="flex-shrink-0 flex items-center gap-1 px-3 py-1 bg-surface-900 border-b border-slate-800 overflow-x-auto">
      {groups.map((grp, gi) => (
        <div key={gi} className="flex items-center gap-0.5">
          {gi > 0 && <div className="w-px h-8 bg-slate-800 mx-1" />}
          {grp.items.map(item => (
            <button key={item.id} className={`toolbar-btn ${item.active ? 'active' : ''}`}
              onClick={item.action} title={item.label}>
              <Icon d={item.icon} size={14} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Feature Tree ──────────────────────────────────────────────
function FeatureTree() {
  const { features, selectedId, hoveredId, selectFeature, toggleFeatureVisible, removeFeature, duplicateFeature, renameFeature, moveFeatureUp, moveFeatureDown } = useStore()
  const [renaming, setRenaming] = useState(null)
  const [renameVal, setRenameVal] = useState('')

  const typeIcon = (type) => {
    if (type.includes('wing') || type.includes('stab') || type.includes('canard') || type.includes('aileron')) return '🛩'
    if (type.includes('fuselage') || type.includes('fuse')) return '✈'
    if (type.includes('nozzle') || type.includes('rocket') || type.includes('engine')) return '🚀'
    if (type.includes('nose') || type.includes('fairing')) return '▲'
    if (type.includes('spar') || type.includes('rib') || type.includes('frame') || type.includes('stringer')) return '⊟'
    if (type.includes('solar') || type.includes('satellite') || type.includes('antenna') || type.includes('heat')) return '🛰'
    if (type.includes('gear') || type.includes('oleo') || type.includes('wheel')) return '⚙'
    if (type === 'box') return '□'
    if (type === 'sphere') return '○'
    if (type === 'cylinder') return '◎'
    if (type === 'cone') return '△'
    if (type === 'torus') return '◯'
    return '◆'
  }

  const doRename = (id, name) => { renameFeature(id, name || features.find(f=>f.id===id)?.name || 'Feature'); setRenaming(null) }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="panel-header">
        <Icon d={icons.layers} size={11} />
        Feature Tree
        <span className="ml-auto badge badge-blue">{features.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {features.length === 0 && (
          <div className="text-center text-slate-600 text-xs py-8 px-4">
            <div className="text-2xl mb-2">✈</div>
            Add components using the toolbar or Library button
          </div>
        )}
        {features.map((f, idx) => (
          <div key={f.id}
            className={`tree-item ${selectedId === f.id ? 'selected' : ''} ${hoveredId === f.id ? 'bg-slate-800' : ''} group`}
            onClick={() => selectFeature(f.id)}
            onDoubleClick={() => { setRenaming(f.id); setRenameVal(f.name) }}>
            <span className="text-xs opacity-60 w-4">{typeIcon(f.type)}</span>
            {renaming === f.id
              ? <input autoFocus className="prop-input text-xs flex-1" value={renameVal}
                  onChange={e => setRenameVal(e.target.value)}
                  onBlur={() => doRename(f.id, renameVal)}
                  onKeyDown={e => { if (e.key==='Enter') doRename(f.id, renameVal); if (e.key==='Escape') setRenaming(null) }}
                  onClick={e => e.stopPropagation()} />
              : <span className="flex-1 truncate text-xs">{f.name}</span>
            }
            <div className="hidden group-hover:flex items-center gap-1 ml-1">
              <button className="text-slate-600 hover:text-slate-400 p-0.5" title="Move up"
                onClick={e => { e.stopPropagation(); moveFeatureUp(f.id) }}>↑</button>
              <button className="text-slate-600 hover:text-slate-400 p-0.5" title="Move down"
                onClick={e => { e.stopPropagation(); moveFeatureDown(f.id) }}>↓</button>
              <button className="text-slate-600 hover:text-slate-400 p-0.5" title={f.visible ? 'Hide' : 'Show'}
                onClick={e => { e.stopPropagation(); toggleFeatureVisible(f.id) }}>
                <Icon d={f.visible ? icons.eye : icons.eyeOff} size={11} />
              </button>
              <button className="text-slate-600 hover:text-slate-400 p-0.5" title="Duplicate"
                onClick={e => { e.stopPropagation(); duplicateFeature(f.id) }}>
                <Icon d={icons.copy} size={11} />
              </button>
              <button className="text-slate-600 hover:text-red-400 p-0.5" title="Delete"
                onClick={e => { e.stopPropagation(); removeFeature(f.id) }}>
                <Icon d={icons.trash} size={11} />
              </button>
            </div>
            {!f.visible && <span className="text-slate-700 text-xs">hidden</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Properties Panel ─────────────────────────────────────────
function PropertiesPanel() {
  const { getSelectedFeature, getSelectedMaterial, updateFeatureParams, updateFeatureMaterial } = useStore()
  const feature = getSelectedFeature()
  const material = getSelectedMaterial()

  if (!feature) return (
    <div className="p-4 text-center text-slate-600 text-xs">
      <div className="text-4xl mb-3">◆</div>
      Select a feature to edit its properties
    </div>
  )

  const cat = Object.values(COMPONENT_CATEGORIES).flat().find(c => c.id === feature.type)
  const paramDefs = cat?.params || {}

  return (
    <div className="overflow-y-auto h-full p-3">
      <Section title="Properties">
        <div className="mb-2">
          <div className="text-xs text-slate-500 mb-1">Type</div>
          <span className="badge badge-blue">{feature.type}</span>
        </div>
        {Object.entries(paramDefs).map(([key, def]) => (
          <div key={key} className="prop-row">
            <span className="prop-label text-xs">{def.label}</span>
            {def.type === 'select' ? (
              <SelectInput value={feature.params[key] ?? def.default}
                onChange={v => updateFeatureParams(feature.id, { [key]: v })}
                options={def.options || []} />
            ) : def.type === 'number' ? (
              <NumInput value={feature.params[key] ?? def.default}
                min={def.min} max={def.max}
                onChange={v => updateFeatureParams(feature.id, { [key]: v })} />
            ) : (
              <input className="prop-input" type="text"
                value={feature.params[key] ?? def.default}
                onChange={e => updateFeatureParams(feature.id, { [key]: e.target.value })} />
            )}
          </div>
        ))}
        {Object.keys(paramDefs).length === 0 && (
          Object.entries(feature.params).map(([k, v]) => (
            <div key={k} className="prop-row">
              <span className="prop-label text-xs">{k}</span>
              <input className="prop-input" value={v}
                onChange={e => updateFeatureParams(feature.id, { [k]: parseFloat(e.target.value) || e.target.value })} />
            </div>
          ))
        )}
      </Section>

      <Section title="Material">
        <div className="prop-row">
          <span className="prop-label">Material</span>
          <select className="prop-select" value={feature.materialKey}
            onChange={e => updateFeatureMaterial(feature.id, e.target.value)}>
            {Object.entries(MATERIALS).map(([k, m]) => (
              <option key={k} value={k}>[{m.category}] {m.name}</option>
            ))}
          </select>
        </div>
        {material && (
          <div className="mt-2 space-y-1">
            <PropRow label="Density" value={material.density} unit="kg/m³" />
            <PropRow label="Young's Mod" value={material.E} unit="GPa" />
            <PropRow label="Yield Str" value={material.Sy} unit="MPa" />
            <PropRow label="UTS" value={material.Su} unit="MPa" />
            <PropRow label="Poisson's ν" value={material.nu} />
            <PropRow label="CTE" value={material.CTE} unit="×10⁻⁶/°C" />
            <PropRow label="Fracture KIc" value={material.KIc} unit="MPa√m" />
            <PropRow label="Elongation" value={material.elongation} unit="%" />
            <PropRow label="Tmax" value={material.Tmax} unit="°C" />
            <div className="text-xs text-slate-600 mt-2 italic">{material.desc}</div>
          </div>
        )}
      </Section>
    </div>
  )
}

// ── Materials Panel ───────────────────────────────────────────
function MaterialsPanel() {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState('2024-T3')
  const [category, setCategory] = useState('All')
  const categories = ['All', ...new Set(Object.values(MATERIALS).map(m => m.category))]
  const filtered = Object.entries(MATERIALS).filter(([k, m]) =>
    (category === 'All' || m.category === category) &&
    (k.toLowerCase().includes(search.toLowerCase()) || m.name.toLowerCase().includes(search.toLowerCase()))
  )
  const mat = MATERIALS[selected]

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b border-slate-800 space-y-2">
        <input className="prop-input w-full" placeholder="Search materials…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="prop-select w-full" value={category} onChange={e => setCategory(e.target.value)}>
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-1/2 border-r border-slate-800 overflow-y-auto">
          {filtered.map(([k, m]) => (
            <div key={k} className={`tree-item ${selected === k ? 'selected' : ''}`} onClick={() => setSelected(k)}>
              <span className="text-xs font-medium truncate">{m.name}</span>
            </div>
          ))}
        </div>
        <div className="w-1/2 overflow-y-auto p-2 space-y-1 text-xs">
          {mat && <>
            <div className="badge badge-purple mb-2">{mat.category}</div>
            <div className="text-slate-400 italic mb-3">{mat.desc}</div>
            {[
              ['ρ', 'density', 'kg/m³'], ['E', 'E', 'GPa'], ['G', 'G', 'GPa'], ['ν', 'nu', ''],
              ['σy', 'Sy', 'MPa'], ['σu', 'Su', 'MPa'], ['τ', 'tau', 'MPa'],
              ['KIc', 'KIc', 'MPa√m'], ['ε', 'elongation', '%'], ['α', 'CTE', '×10⁻⁶/°C'],
              ['k', 'k', 'W/m·K'], ['Cp', 'Cp', 'J/kg·K'], ['Tm', 'Tm', '°C'], ['Tmax', 'Tmax', '°C'],
              ['Cost', 'cost', '$/kg'],
            ].map(([sym, key, unit]) => (
              <div key={key} className="flex justify-between">
                <span className="text-slate-500">{sym}</span>
                <span className="mono text-sky-400">{mat[key] ?? '—'}<span className="text-slate-600 ml-1">{unit}</span></span>
              </div>
            ))}
            {mat.isComposite && <>
              <div className="mt-2 text-slate-500 font-semibold">Ply Properties</div>
              {[['E₁',mat.E,'GPa'],['E₂',mat.E2,'GPa'],['G₁₂',mat.G12,'GPa'],['ν₁₂',mat.nu12,''],
                ['XT',mat.XT,'MPa'],['XC',mat.XC,'MPa'],['YT',mat.YT,'MPa'],['YC',mat.YC,'MPa'],['S',mat.S,'MPa']].map(([l,v,u])=>(
                <div key={l} className="flex justify-between">
                  <span className="text-slate-500">{l}</span>
                  <span className="mono text-sky-400">{v ?? '—'}<span className="text-slate-600 ml-1">{u}</span></span>
                </div>
              ))}
            </>}
            <div className="mt-3 grid-2">
              <div className="result-card">
                <div className="text-xs text-slate-500">Specific Strength</div>
                <div className="result-val">{mat.Su && mat.density ? fmt(mat.Su*1e6/mat.density/1e3) : '—'}</div>
                <div className="text-xs text-slate-600">kN·m/kg</div>
              </div>
              <div className="result-card">
                <div className="text-xs text-slate-500">Specific Stiffness</div>
                <div className="result-val">{mat.E && mat.density ? fmt(mat.E*1e9/mat.density/1e6) : '—'}</div>
                <div className="text-xs text-slate-600">MN·m/kg</div>
              </div>
            </div>
          </>}
        </div>
      </div>
    </div>
  )
}

// ── BOM Panel ─────────────────────────────────────────────────
function BOMPanel() {
  const { getBOM } = useStore()
  const bom = getBOM()
  const exportCSV = () => {
    const hdr = 'Item,Name,Type,Material,Mass (kg),Volume (m³),Visible'
    const rows = bom.map(r => `${r.item},"${r.name}","${r.type}","${r.material}",${r.mass.toFixed(4)},${r.volume.toFixed(6)},${r.visible}`)
    const blob = new Blob([[hdr, ...rows].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'bom.csv'; a.click()
  }
  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <Icon d={icons.file} size={11} />
        Bill of Materials
        <button className="ml-auto btn btn-ghost text-xs py-0.5 px-2" onClick={exportCSV}>Export CSV</button>
      </div>
      <div className="overflow-auto flex-1">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-surface-800">
            <tr>{['#','Name','Type','Material','Mass','Vol'].map(h=><th key={h} className="text-left p-2 text-slate-500 border-b border-slate-800">{h}</th>)}</tr>
          </thead>
          <tbody>
            {bom.map(r=>(
              <tr key={r.item} className="border-b border-slate-900 hover:bg-slate-900">
                <td className="p-2 text-slate-500">{r.item}</td>
                <td className="p-2 font-medium">{r.name}</td>
                <td className="p-2 text-slate-500">{r.type}</td>
                <td className="p-2"><span className="badge badge-blue">{r.material}</span></td>
                <td className="p-2 mono">{r.mass.toFixed(2)} kg</td>
                <td className="p-2 mono">{r.volume.toFixed(4)} m³</td>
              </tr>
            ))}
            {bom.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-slate-600">No components in model</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="p-2 border-t border-slate-800 text-xs text-slate-500 flex justify-between">
        <span>{bom.length} items</span>
        <span>Total mass: <span className="text-sky-400 mono">{bom.reduce((s,r)=>s+r.mass,0).toFixed(2)} kg</span></span>
      </div>
    </div>
  )
}

// ── Analysis Panels ───────────────────────────────────────────
function VLMPanel() {
  const { vlmConfig, updateVlmConfig, analysisResults, setAnalysisResults, setAnalysisRunning, analysisRunning } = useStore()
  const [tab, setTab] = useState('config')
  const results = analysisResults.vlm

  const runAnalysis = () => {
    setAnalysisRunning(true)
    setTimeout(() => {
      const polar = vlmPolar({ wing: vlmConfig.wing, alphaRange: [vlmConfig.alphaMin, vlmConfig.alphaMax], nAlpha: vlmConfig.nAlpha, mach: vlmConfig.mach, alt: vlmConfig.alt })
      const point = vlmAnalysis({ wing: vlmConfig.wing, alpha: vlmConfig.alpha, mach: vlmConfig.mach, alt: vlmConfig.alt })
      setAnalysisResults('vlm', { polar, point })
      setAnalysisRunning(false)
    }, 100)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="panel-header">
        <Icon d={icons.wind} size={11} />
        VLM Aerodynamic Analysis
        {results && <span className="ml-auto badge badge-green">Done</span>}
      </div>
      <Tabs tabs={[{id:'config',label:'Config'},{id:'results',label:'Results'},{id:'polar',label:'Polar'},{id:'span',label:'Span Load'},{id:'deriv',label:'Derivatives'}]}
        active={tab} onChange={setTab} />
      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'config' && (
          <div className="space-y-3">
            <Section title="Wing Geometry">
              {[['Span (m)','span',0.1,200],['Root Chord (m)','rootChord',0.01,30],['Tip Chord (m)','tipChord',0.01,20],
                ['Sweep (°)','sweep',-45,75],['Dihedral (°)','dihedral',-20,30],['Twist (°)','twist',-10,10]].map(([l,k,mn,mx])=>(
                <PropRow key={k} label={l}>
                  <NumInput value={vlmConfig.wing[k]??0} min={mn} max={mx} onChange={v=>updateVlmConfig({wing:{...vlmConfig.wing,[k]:v}})} />
                </PropRow>
              ))}
            </Section>
            <Section title="Flight Conditions">
              {[['Alpha (°)','alpha',-20,30],['Mach','mach',0,2],['Altitude (m)','alt',0,80000]].map(([l,k,mn,mx])=>(
                <PropRow key={k} label={l}>
                  <NumInput value={vlmConfig[k]??0} min={mn} max={mx} onChange={v=>updateVlmConfig({[k]:v})} />
                </PropRow>
              ))}
            </Section>
            <Section title="Polar Sweep">
              {[['Alpha Min (°)','alphaMin',-20,10],['Alpha Max (°)','alphaMax',5,40],['N Points','nAlpha',5,30]].map(([l,k,mn,mx])=>(
                <PropRow key={k} label={l}>
                  <NumInput value={vlmConfig[k]??0} min={mn} max={mx} onChange={v=>updateVlmConfig({[k]:v})} />
                </PropRow>
              ))}
            </Section>
            <button className="btn btn-primary w-full" onClick={runAnalysis} disabled={analysisRunning}>
              {analysisRunning ? <span className="spin inline-block mr-2">↻</span> : null}
              {analysisRunning ? 'Running VLM…' : 'Run VLM Analysis'}
            </button>
          </div>
        )}
        {tab === 'results' && results?.point && (
          <div className="space-y-2">
            <div className="grid-2 gap-2">
              {[
                ['CL','CL','','green'],['CD total','CDtotal','',''],['CD induced','CDi','',''],['CD friction','CDfric','',''],
                ['Cm','CMy','',''],['L/D','LD','','green'],['AR','AR','',''],['Oswald e','e','',''],
                ['CL_α','CLalpha','/rad',''],['Neutral Pt','neutPoint','%MAC',''],['Sref','Sref','m²',''],
              ].map(([l,k,u,col])=>(
                <div key={k} className="result-card">
                  <div className="text-xs text-slate-500">{l}</div>
                  <div className={`result-val ${col==='green'?'text-green-400':''}`}>{fmt(results.point[k]||results.point.derivatives?.[k],4)}</div>
                  {u && <div className="text-xs text-slate-600">{u}</div>}
                </div>
              ))}
            </div>
            {results.point.atm && (
              <Section title="Atmosphere (at altitude)">
                <PropRow label="T" value={fmt(results.point.atm.T)} unit="K" />
                <PropRow label="P" value={fmt(results.point.atm.P/1000)} unit="kPa" />
                <PropRow label="ρ" value={fmt(results.point.atm.rho)} unit="kg/m³" />
                <PropRow label="a" value={fmt(results.point.atm.a)} unit="m/s" />
                <PropRow label="Mach" value={fmt(vlmConfig.mach)} />
              </Section>
            )}
          </div>
        )}
        {tab === 'polar' && results?.polar && (
          <div>
            <div className="text-xs text-slate-500 mb-2">CL vs CD (drag polar)</div>
            <ResponsiveContainer width="100%" height={200}>
              <ScatterChart>
                <CartesianGrid stroke="#1e2535" strokeDasharray="3 3" />
                <XAxis dataKey="CDtotal" name="CD" type="number" stroke="#64748b" tick={{fontSize:10}} label={{value:'CD',position:'bottom',fill:'#64748b',fontSize:11}} />
                <YAxis dataKey="CL" name="CL" stroke="#64748b" tick={{fontSize:10}} label={{value:'CL',angle:-90,position:'left',fill:'#64748b',fontSize:11}} />
                <Tooltip formatter={(v) => fmt(v)} contentStyle={{background:'#0f1117',border:'1px solid #1e2535'}} />
                <Scatter data={results.polar} fill="#38bdf8" />
              </ScatterChart>
            </ResponsiveContainer>
            <div className="text-xs text-slate-500 mt-3 mb-2">CL vs α</div>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={results.polar}>
                <CartesianGrid stroke="#1e2535" />
                <XAxis dataKey="alpha" stroke="#64748b" tick={{fontSize:10}} />
                <YAxis stroke="#64748b" tick={{fontSize:10}} />
                <Tooltip contentStyle={{background:'#0f1117',border:'1px solid #1e2535'}} />
                <Line type="monotone" dataKey="CL" stroke="#38bdf8" dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <div className="text-xs text-slate-500 mt-3 mb-2">L/D vs α</div>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={results.polar}>
                <CartesianGrid stroke="#1e2535" />
                <XAxis dataKey="alpha" stroke="#64748b" tick={{fontSize:10}} />
                <YAxis stroke="#64748b" tick={{fontSize:10}} />
                <Tooltip contentStyle={{background:'#0f1117',border:'1px solid #1e2535'}} />
                <Line type="monotone" dataKey="LD" stroke="#22c55e" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {tab === 'span' && results?.point?.spanLoading && (
          <div>
            <div className="text-xs text-slate-500 mb-2">Span loading Cl·c vs y/b</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={results.point.spanLoading}>
                <CartesianGrid stroke="#1e2535" />
                <XAxis dataKey="y" stroke="#64748b" tick={{fontSize:10}} tickFormatter={v=>fmt(v,2)} />
                <YAxis stroke="#64748b" tick={{fontSize:10}} />
                <Tooltip contentStyle={{background:'#0f1117',border:'1px solid #1e2535'}} />
                <Bar dataKey="Clc" fill="#38bdf8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {tab === 'deriv' && results?.point?.derivatives && (
          <div className="space-y-1 text-xs">
            {Object.entries(results.point.derivatives).map(([k,v])=>(
              <div key={k} className="flex justify-between border-b border-slate-900 py-1">
                <span className="text-slate-500 mono">{k}</span>
                <span className="text-sky-400 mono">{fmt(v,5)}</span>
              </div>
            ))}
          </div>
        )}
        {!results && tab !== 'config' && <div className="text-center text-slate-600 text-xs pt-8">Run analysis first</div>}
      </div>
    </div>
  )
}

function FEAPanel() {
  const { feaConfig, updateFeaConfig, analysisResults, setAnalysisResults, analysisRunning, setAnalysisRunning } = useStore()
  const [tab, setTab] = useState('config')
  const results = analysisResults.fea
  const mat = MATERIALS[feaConfig.material]

  const run = () => {
    setAnalysisRunning(true)
    setTimeout(() => {
      const struct = buildCantileverStructure(feaConfig.length, feaConfig.nElements, mat || MATERIALS['Ti-6Al-4V'])
      struct.loads[0].value = -Math.abs(feaConfig.tipLoad)
      const res = feaBeam(struct)
      setAnalysisResults('fea', { ...res, nodes: struct.nodes, elements: struct.elements })
      setAnalysisRunning(false)
    }, 100)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="panel-header"><Icon d={icons.activity} size={11} />FEA Structural Analysis{results && <span className="ml-auto badge badge-green">Done</span>}</div>
      <Tabs tabs={[{id:'config',label:'Config'},{id:'results',label:'Results'},{id:'stress',label:'Stress'},{id:'mode',label:'Deform'}]} active={tab} onChange={setTab} />
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {tab === 'config' && <>
          <Section title="Structure">
            <PropRow label="Length (m)"><NumInput value={feaConfig.length} min={0.1} max={100} onChange={v=>updateFeaConfig({length:v})} /></PropRow>
            <PropRow label="Elements"><NumInput value={feaConfig.nElements} min={2} max={50} onChange={v=>updateFeaConfig({nElements:v})} /></PropRow>
            <PropRow label="Tip Load (N)"><NumInput value={feaConfig.tipLoad} min={0} max={1e7} onChange={v=>updateFeaConfig({tipLoad:v})} /></PropRow>
          </Section>
          <Section title="Material">
            <select className="prop-select w-full" value={feaConfig.material} onChange={e=>updateFeaConfig({material:e.target.value})}>
              {Object.entries(MATERIALS).map(([k,m])=><option key={k} value={k}>{m.name}</option>)}
            </select>
            {mat && <div className="mt-2 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-slate-500">E</span><span className="mono text-sky-400">{mat.E} GPa</span></div>
              <div className="flex justify-between"><span className="text-slate-500">σy</span><span className="mono text-sky-400">{mat.Sy} MPa</span></div>
            </div>}
          </Section>
          <button className="btn btn-primary w-full" onClick={run} disabled={analysisRunning}>
            {analysisRunning?'Running FEA…':'Run FEA'}
          </button>
        </>}
        {tab === 'results' && results && (
          <div className="space-y-2">
            <div className="grid-2 gap-2">
              <ResultCard label="Max Displacement" value={fmtSci(results.maxDisp)} unit="m" color="orange" />
              <ResultCard label="Max Von Mises σ" value={fmtBig(results.maxStress)} unit="Pa" color="orange" />
              <ResultCard label="Min Safety Factor" value={fmt(Math.min(...results.stresses.map(s=>s.SF)),2)} unit="" color="green" />
              <ResultCard label="Elements" value={results.elements?.length||0} />
            </div>
            <Section title="Element Stresses">
              {results.stresses?.map((s,i) => (
                <div key={i} className="text-xs border-b border-slate-900 py-1 flex gap-4">
                  <span className="text-slate-500">El {i+1}</span>
                  <span>σ_vm: <span className={`mono ${s.SF<1.5?'text-red-400':s.SF<2?'text-yellow-400':'text-sky-400'}`}>{fmtBig(s.sigma_vm)} Pa</span></span>
                  <span>SF: <span className={`mono ${s.SF<1.5?'text-red-400':'text-green-400'}`}>{fmt(s.SF,2)}</span></span>
                </div>
              ))}
            </Section>
          </div>
        )}
        {tab === 'stress' && results?.stresses && (
          <div>
            <div className="text-xs text-slate-500 mb-2">Von Mises stress per element (MPa)</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={results.stresses.map((s,i)=>({el:i+1, vm: s.sigma_vm/1e6, SF: Math.min(s.SF,10)}))}>
                <CartesianGrid stroke="#1e2535" />
                <XAxis dataKey="el" stroke="#64748b" tick={{fontSize:10}} />
                <YAxis stroke="#64748b" tick={{fontSize:10}} />
                <Tooltip contentStyle={{background:'#0f1117',border:'1px solid #1e2535'}} formatter={v=>fmt(v,3)} />
                <Bar dataKey="vm" fill="#f59e0b" name="σ_vm (MPa)" />
              </BarChart>
            </ResponsiveContainer>
            <div className="text-xs text-slate-500 mt-3 mb-2">Safety factor per element</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={results.stresses.map((s,i)=>({el:i+1, SF:Math.min(s.SF,10)}))}>
                <CartesianGrid stroke="#1e2535" />
                <XAxis dataKey="el" stroke="#64748b" tick={{fontSize:10}} />
                <YAxis stroke="#64748b" tick={{fontSize:10}} />
                <ReferenceLine y={1.5} stroke="#ef4444" strokeDasharray="4 4" />
                <Tooltip contentStyle={{background:'#0f1117',border:'1px solid #1e2535'}} formatter={v=>fmt(v,2)} />
                <Bar dataKey="SF" fill="#22c55e" name="Safety Factor" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-2 text-xs text-red-400">— Red line: SF = 1.5 (design minimum)</div>
          </div>
        )}
        {tab === 'mode' && results && (
          <div>
            <div className="text-xs text-slate-500 mb-2">Nodal displacement magnitude</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={results.nodes?.map((n,i)=>({x:n.x, u: Math.abs(results.displacements[i*6+2]||0)*1000}))}>
                <CartesianGrid stroke="#1e2535" />
                <XAxis dataKey="x" stroke="#64748b" tick={{fontSize:10}} label={{value:'x (m)',position:'bottom',fill:'#64748b',fontSize:10}} />
                <YAxis stroke="#64748b" tick={{fontSize:10}} label={{value:'uz (mm)',angle:-90,position:'left',fill:'#64748b',fontSize:10}} />
                <Tooltip contentStyle={{background:'#0f1117',border:'1px solid #1e2535'}} formatter={v=>fmt(v,4)} />
                <Line type="monotone" dataKey="u" stroke="#38bdf8" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {!results && tab !== 'config' && <div className="text-center text-slate-600 text-xs pt-8">Run FEA first</div>}
      </div>
    </div>
  )
}

function PropulsionPanel() {
  const { propConfig, updatePropConfig, addPropStage, removePropStage, updatePropStage, analysisResults, setAnalysisResults, setAnalysisRunning, analysisRunning } = useStore()
  const [tab, setTab] = useState('nozzle')
  const results = analysisResults.propulsion

  const run = () => {
    setAnalysisRunning(true)
    setTimeout(() => {
      const nozzle = rocketNozzle({ Pc: propConfig.Pc, Pe: 101325, Tc: propConfig.Tc, At: propConfig.At, gamma: propConfig.gamma, molarMass: propConfig.molarMass })
      const dv = deltaVBudget(propConfig.stages)
      const contour = nozzleContour({ Rt: Math.sqrt(propConfig.At/Math.PI), Re: Math.sqrt(nozzle.Ae/Math.PI) })
      const turbjet = turbojetCycle({ T0: 288.15, P0: 101325, mach: 0.85, OPR: 30, TET: 1600 })
      setAnalysisResults('propulsion', { nozzle, dv, contour, turbjet })
      setAnalysisRunning(false)
    }, 80)
  }

  const propData = PROPELLANTS[propConfig.propellant] || PROPELLANTS['LOX/LH2']

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="panel-header"><Icon d={icons.rocket} size={11} />Propulsion Analysis{results && <span className="ml-auto badge badge-green">Done</span>}</div>
      <Tabs tabs={[{id:'nozzle',label:'Nozzle'},{id:'stage',label:'ΔV Budget'},{id:'results',label:'Results'},{id:'contour',label:'Contour'},{id:'jet',label:'Turbojet'}]} active={tab} onChange={setTab} />
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {tab === 'nozzle' && <>
          <Section title="Rocket Engine">
            <PropRow label="Propellant">
              <select className="prop-select" value={propConfig.propellant} onChange={e=>updatePropConfig({propellant:e.target.value})}>
                {Object.keys(PROPELLANTS).map(k=><option key={k}>{k}</option>)}
              </select>
            </PropRow>
            {propData && <div className="text-xs text-slate-500 italic mb-2">{propData.desc} · Isp≈{propData.Isp}s</div>}
            {[['Chamber Pres (MPa)','Pc',1e6,0.5e6,30e6],['Chamber Temp (K)','Tc',1,500,5000],['Throat Area (m²)','At',0.001,0.001,10],
              ['Gamma','gamma',0.01,1.1,1.6],['Molar Mass','molarMass',0.1,2,50]].map(([l,k,s,mn,mx])=>(
              <PropRow key={k} label={l}>
                <NumInput value={propConfig[k]} step={s} min={mn} max={mx} onChange={v=>updatePropConfig({[k]:v})} />
              </PropRow>
            ))}
          </Section>
          <button className="btn btn-primary w-full" onClick={run} disabled={analysisRunning}>{analysisRunning?'Running…':'Run Analysis'}</button>
        </>}
        {tab === 'stage' && <>
          <Section title="ΔV Budget — Multistage Rocket">
            {propConfig.stages.map((st,i)=>(
              <div key={i} className="result-card mb-2">
                <div className="flex justify-between mb-2">
                  <span className="text-xs font-semibold text-sky-400">{st.name}</span>
                  <button className="text-red-400 text-xs" onClick={()=>removePropStage(i)}>✕</button>
                </div>
                {[['Isp (s)','Isp',10,700],['Wet Mass (kg)','mWet',1,1e7],['Dry Mass (kg)','mDry',1,1e6]].map(([l,k,mn,mx])=>(
                  <PropRow key={k} label={l}>
                    <NumInput value={st[k]} min={mn} max={mx} onChange={v=>updatePropStage(i,k,v)} />
                  </PropRow>
                ))}
                <PropRow label="ΔV" value={fmt(st.Isp * 9.80665 * Math.log(st.mWet/st.mDry))} unit="m/s" />
              </div>
            ))}
            <button className="btn btn-ghost w-full" onClick={addPropStage}>+ Add Stage</button>
            <button className="btn btn-primary w-full mt-2" onClick={run} disabled={analysisRunning}>Calculate</button>
          </Section>
        </>}
        {tab === 'results' && results && <>
          <Section title="Nozzle Results">
            <div className="grid-2 gap-2">
              {[['Exit Mach','Me',''],['Exit Vel','Ve','m/s'],['Thrust','FkN','kN'],['Isp','Isp','s'],
                ['C*','cstar','m/s'],['CF','CF',''],['Ae/At','AeAt',''],['Ae','Ae','m²'],['ṁ','mDot','kg/s'],].map(([l,k,u])=>(
                <div key={k} className="result-card">
                  <div className="text-xs text-slate-500">{l}</div>
                  <div className="result-val">{fmt(results.nozzle[k],3)}</div>
                  {u && <div className="text-xs text-slate-600">{u}</div>}
                </div>
              ))}
            </div>
          </Section>
          {results.dv && <Section title="ΔV Budget">
            {results.dv.stages.map((s,i)=>(
              <div key={i} className="text-xs flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">{s.name}</span>
                <span className="mono text-sky-400">{fmt(s.dV)} m/s</span>
              </div>
            ))}
            <PropRow label="Total ΔV" value={fmt(results.dv.totalDV)} unit="m/s" />
          </Section>}
        </>}
        {tab === 'contour' && results?.contour && (
          <div>
            <div className="text-xs text-slate-500 mb-2">Nozzle Contour (parabolic bell approximation)</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={[...results.contour.map(p=>({x:p.x,r:p.r})), ...results.contour.slice().reverse().map(p=>({x:p.x,r:-p.r}))]}>
                <CartesianGrid stroke="#1e2535" />
                <XAxis dataKey="x" stroke="#64748b" tick={{fontSize:10}} label={{value:'x (m)',position:'bottom',fill:'#64748b',fontSize:10}} />
                <YAxis stroke="#64748b" tick={{fontSize:10}} label={{value:'r (m)',angle:-90,position:'left',fill:'#64748b',fontSize:10}} />
                <Tooltip contentStyle={{background:'#0f1117',border:'1px solid #1e2535'}} formatter={v=>fmt(v,4)} />
                <Line type="monotone" dataKey="r" stroke="#38bdf8" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {tab === 'jet' && results?.turbjet && (
          <div className="space-y-2">
            <div className="text-xs text-slate-500 mb-2">Turbojet Cycle (M=0.85, OPR=30, TET=1600K)</div>
            {Object.entries(results.turbjet).map(([k,v])=>typeof v==='number' && (
              <div key={k} className="flex justify-between text-xs border-b border-slate-900 py-1">
                <span className="text-slate-500">{k}</span>
                <span className="mono text-sky-400">{fmt(v,4)}</span>
              </div>
            ))}
          </div>
        )}
        {!results && tab !== 'nozzle' && tab !== 'stage' && <div className="text-center text-slate-600 text-xs pt-8">Run analysis first</div>}
      </div>
    </div>
  )
}

function OrbitalPanel() {
  const { orbitalConfig, updateOrbitalConfig, analysisResults, setAnalysisResults, setAnalysisRunning, analysisRunning } = useStore()
  const [tab, setTab] = useState('config')
  const results = analysisResults.orbital

  const run = () => {
    setAnalysisRunning(true)
    setTimeout(() => {
      const orbit = keplerOrbit(orbitalConfig)
      const track = groundTrack({ ...orbitalConfig, nRevs: orbitalConfig.nRevs })
      const hoho = hohmannTransfer({ r1: orbitalConfig.a, r2: orbitalConfig.a * 2 })
      const j2   = j2Precession(orbitalConfig)
      const reentryData = reentry({ m: 6000, CD: 1.2, A: 12, v0: 7800, gamma0Deg: -2, h0: 120000 })
      setAnalysisResults('orbital', { orbit, track, hoho, j2, reentryData })
      setAnalysisRunning(false)
    }, 150)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="panel-header"><Icon d={icons.globe} size={11} />Orbital Mechanics{results && <span className="ml-auto badge badge-green">Done</span>}</div>
      <Tabs tabs={[{id:'config',label:'Orbit'},{id:'results',label:'State'},{id:'track',label:'Ground Track'},{id:'maneuver',label:'ΔV'},{id:'reentry',label:'Re-entry'}]} active={tab} onChange={setTab} />
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {tab === 'config' && <>
          <Section title="Keplerian Elements">
            {[['Semi-major axis (m)','a',1e3,6.4e6,1e9],['Eccentricity','e',0.0001,0,0.99],
              ['Inclination (°)','i',0.1,0,180],['RAAN (°)','raan',0.1,0,360],
              ['Arg of Perigee (°)','w',0.1,0,360],['True Anomaly (°)','nu',0.1,0,360],
              ['Ground Track Revs','nRevs',1,1,20]].map(([l,k,s,mn,mx])=>(
              <PropRow key={k} label={l}>
                <NumInput value={orbitalConfig[k]} step={s} min={mn} max={mx} onChange={v=>updateOrbitalConfig({[k]:v})} />
              </PropRow>
            ))}
          </Section>
          <div className="result-card text-xs">
            <div className="text-slate-500 mb-1">Orbit altitude</div>
            <div className="result-val">{fmt((orbitalConfig.a - 6371000)/1000)} km</div>
          </div>
          <button className="btn btn-primary w-full" onClick={run} disabled={analysisRunning}>{analysisRunning?'Computing…':'Run Orbital Analysis'}</button>
        </>}
        {tab === 'results' && results?.orbit && (
          <div className="space-y-2">
            <div className="grid-2 gap-2">
              {[['r (km)','r',v=>fmt(v/1000)],['Alt (km)','alt',v=>fmt(v/1000)],
                ['Velocity (m/s)','v',v=>fmt(v)],['Period (min)','T',v=>fmt(v/60)],].map(([l,k,fn])=>(
                <div key={k} className="result-card">
                  <div className="text-xs text-slate-500">{l}</div>
                  <div className="result-val">{fn(results.orbit[k])}</div>
                </div>
              ))}
            </div>
            <Section title="J2 Precession">
              <PropRow label="RAAN drift" value={fmt(results.j2?.raanDotDeg,4)} unit="°/day" />
              <PropRow label="ω drift" value={fmt(results.j2?.wDotDeg,4)} unit="°/day" />
            </Section>
            <Section title="ECI State Vector">
              <PropRow label="r" value={`[${results.orbit.pos.map(v=>fmt(v/1000,1)).join(', ')}]`} unit="km" />
              <PropRow label="v" value={`[${results.orbit.vel.map(v=>fmt(v,1)).join(', ')}]`} unit="m/s" />
            </Section>
          </div>
        )}
        {tab === 'track' && results?.track && (
          <div>
            <div className="text-xs text-slate-500 mb-2">Ground track (lat/lon)</div>
            <div className="relative bg-surface-800 rounded" style={{height:200, overflow:'hidden'}}>
              <svg width="100%" height="200" viewBox="-180 -90 360 180" preserveAspectRatio="none">
                <rect x="-180" y="-90" width="360" height="180" fill="#0f1117" />
                {/* Simple world outline grid */}
                {[-120,-60,0,60,120].map(x=><line key={x} x1={x} y1="-90" x2={x} y2="90" stroke="#1e2535" strokeWidth="0.5" />)}
                {[-60,-30,0,30,60].map(y=><line key={y} x1="-180" y1={-y} x2="180" y2={-y} stroke="#1e2535" strokeWidth="0.5" />)}
                <polyline
                  points={results.track.map((p,i) => {
                    const prev = results.track[i-1]
                    if (prev && Math.abs(p.lon - prev.lon) > 90) return null
                    return `${p.lon},${-p.lat}`
                  }).filter(Boolean).join(' ')}
                  fill="none" stroke="#38bdf8" strokeWidth="1" opacity="0.8" />
                {results.track.filter((_,i)=>i%20===0).map((p,i)=>(
                  <circle key={i} cx={p.lon} cy={-p.lat} r="1.5" fill="#38bdf8" />
                ))}
              </svg>
            </div>
            <div className="text-xs text-slate-500 mt-2">{results.track.length} points · {orbitalConfig.nRevs} revolutions</div>
          </div>
        )}
        {tab === 'maneuver' && results?.hoho && (
          <div className="space-y-3">
            <div className="result-card">
              <div className="text-xs text-slate-500 mb-2">Hohmann Transfer (current orbit → 2× altitude)</div>
              <div className="grid-2 gap-2">
                {[['ΔV₁','dv1','m/s'],['ΔV₂','dv2','m/s'],['ΔV total','dvTotal','m/s'],['Transfer time','tTransfer','s']].map(([l,k,u])=>(
                  <div key={k} className="result-card">
                    <div className="text-xs text-slate-500">{l}</div>
                    <div className="result-val">{fmt(results.hoho[k])}</div>
                    <div className="text-xs text-slate-600">{u}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="result-card">
              <div className="text-xs text-slate-500 mb-1">Plane change ΔV (30°) at current orbit</div>
              <div className="result-val">{fmt(planeChange({v: results.orbit?.v||7800, angle: 30}))} m/s</div>
            </div>
          </div>
        )}
        {tab === 'reentry' && results?.reentryData && (
          <div>
            <div className="text-xs text-slate-500 mb-2">Ballistic re-entry profile</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={results.reentryData}>
                <CartesianGrid stroke="#1e2535" />
                <XAxis dataKey="t" stroke="#64748b" tick={{fontSize:9}} label={{value:'t (s)',position:'bottom',fill:'#64748b',fontSize:10}} />
                <YAxis stroke="#64748b" tick={{fontSize:9}} />
                <Tooltip contentStyle={{background:'#0f1117',border:'1px solid #1e2535'}} formatter={v=>fmt(v,2)} />
                <Line type="monotone" dataKey="h" stroke="#38bdf8" dot={false} name="Alt (km)" />
                <Line type="monotone" dataKey="mach" stroke="#f59e0b" dot={false} name="Mach" />
              </LineChart>
            </ResponsiveContainer>
            <div className="text-xs text-slate-500 mt-2 mb-2">Peak heat rate vs time (MW/m²)</div>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={results.reentryData}>
                <CartesianGrid stroke="#1e2535" />
                <XAxis dataKey="t" stroke="#64748b" tick={{fontSize:9}} />
                <YAxis stroke="#64748b" tick={{fontSize:9}} />
                <Tooltip contentStyle={{background:'#0f1117',border:'1px solid #1e2535'}} formatter={v=>fmt(v,3)} />
                <Line type="monotone" dataKey="qDot" stroke="#ef4444" dot={false} name="q̇ (MW/m²)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {!results && tab !== 'config' && <div className="text-center text-slate-600 text-xs pt-8">Run orbital analysis first</div>}
      </div>
    </div>
  )
}

function PerformancePanel() {
  const { perfConfig, updatePerfConfig, analysisResults, setAnalysisResults, setAnalysisRunning, analysisRunning } = useStore()
  const [tab, setTab] = useState('config')
  const results = analysisResults.performance

  const run = () => {
    setAnalysisRunning(true)
    setTimeout(()=>{
      const res = flightPerformance(perfConfig)
      setAnalysisResults('performance', res)
      setAnalysisRunning(false)
    }, 60)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="panel-header"><Icon d={icons.zap} size={11} />Flight Performance{results && <span className="ml-auto badge badge-green">Done</span>}</div>
      <Tabs tabs={[{id:'config',label:'Config'},{id:'results',label:'Results'},{id:'vn',label:'V-n Diagram'}]} active={tab} onChange={setTab} />
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {tab === 'config' && <>
          <Section title="Aircraft Parameters">
            {[['Weight W (N)','W',100,100,1e8],['Wing Area S (m²)','S',0.1,1,2000],
              ['CD0 (parasite drag)','CD0',0.001,0.001,0.2],['Oswald e','e',0.01,0.3,1.0],
              ['Aspect Ratio','AR',0.1,1,30],['CLmax','CLmax',0.01,0.5,4],
              ['Max Thrust (N)','Tmax',100,10,1e8],['Analysis Alt (m)','alt',100,0,40000]].map(([l,k,s,mn,mx])=>(
              <PropRow key={k} label={l}>
                <NumInput value={perfConfig[k]} step={s} min={mn} max={mx} onChange={v=>updatePerfConfig({[k]:v})} />
              </PropRow>
            ))}
          </Section>
          <button className="btn btn-primary w-full" onClick={run} disabled={analysisRunning}>{analysisRunning?'…':'Calculate Performance'}</button>
        </>}
        {tab === 'results' && results && (
          <div className="space-y-2">
            <div className="grid-2 gap-2">
              {[['V_md','V_md','m/s'],['V_stall','V_s','m/s'],['(L/D)max','LD_max',''],
                ['Best climb RC','RC_max','m/s'],['Glide ratio','glide',''],
                ['K (induced)','K',''],['V_stall (kt)','stallSpeedKt','kt'],['V_md (kt)','V_mdKt','kt']].map(([l,k,u])=>(
                <div key={k} className="result-card">
                  <div className="text-xs text-slate-500">{l}</div>
                  <div className="result-val">{fmt(results[k],2)}</div>
                  {u && <div className="text-xs text-slate-600">{u}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === 'vn' && results?.V_n && (
          <div>
            <div className="text-xs text-slate-500 mb-2">V-n Diagram (structural & aerodynamic limits)</div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={results.V_n}>
                <CartesianGrid stroke="#1e2535" />
                <XAxis dataKey="V" stroke="#64748b" tick={{fontSize:9}} label={{value:'V (m/s)',position:'bottom',fill:'#64748b',fontSize:10}} />
                <YAxis stroke="#64748b" tick={{fontSize:9}} label={{value:'Load Factor n',angle:-90,position:'left',fill:'#64748b',fontSize:10}} />
                <Tooltip contentStyle={{background:'#0f1117',border:'1px solid #1e2535'}} formatter={v=>fmt(v,2)} />
                <ReferenceLine y={0} stroke="#64748b" />
                <ReferenceLine y={3.8} stroke="#f59e0b" strokeDasharray="4 4" label={{value:'n=3.8',fill:'#f59e0b',fontSize:9}} />
                <Line type="monotone" dataKey="n_pos" stroke="#38bdf8" dot={false} name="Max n+" />
                <Line type="monotone" dataKey="n_neg" stroke="#ef4444" dot={false} name="Min n−" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {!results && tab !== 'config' && <div className="text-center text-slate-600 text-xs pt-8">Calculate first</div>}
      </div>
    </div>
  )
}

function AtmospherePanel() {
  const { atmosConfig, updateAtmosConfig } = useStore()
  const [results, setResults] = useState(null)

  const compute = () => {
    const pts = Array.from({length: atmosConfig.nPts}, (_, i) => {
      const h = atmosConfig.altMin + i * (atmosConfig.altMax - atmosConfig.altMin) / (atmosConfig.nPts - 1)
      const atm = isa(h)
      return { h: h/1000, T: atm.T, P: atm.P/1000, rho: atm.rho, a: atm.a, mu: atm.mu*1e5 }
    })
    setResults(pts)
  }

  useEffect(() => { compute() }, [])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="panel-header"><Icon d={icons.wind} size={11} />ISA Atmosphere Model</div>
      <div className="p-3 border-b border-slate-800 space-y-2">
        {[['Alt min (m)','altMin',0,0,80000],['Alt max (m)','altMax',1000,1000,86000],['Points','nPts',1,10,200]].map(([l,k,s,mn,mx])=>(
          <PropRow key={k} label={l}>
            <NumInput value={atmosConfig[k]} step={s} min={mn} max={mx} onChange={v=>{ updateAtmosConfig({[k]:v}); setTimeout(compute,50) }} />
          </PropRow>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {results && <>
          <div className="text-xs text-slate-500 mb-1">Temperature vs Altitude</div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={results} layout="vertical">
              <CartesianGrid stroke="#1e2535" />
              <XAxis type="number" dataKey="T" stroke="#64748b" tick={{fontSize:9}} label={{value:'T (K)',position:'bottom',fill:'#64748b',fontSize:10}} />
              <YAxis type="number" dataKey="h" stroke="#64748b" tick={{fontSize:9}} label={{value:'h (km)',angle:-90,position:'left',fill:'#64748b',fontSize:10}} />
              <Tooltip contentStyle={{background:'#0f1117',border:'1px solid #1e2535'}} formatter={v=>fmt(v,2)} />
              <Line type="monotone" dataKey="T" stroke="#f59e0b" dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="text-xs text-slate-500 mt-2 mb-1">Density vs Altitude</div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={results} layout="vertical">
              <CartesianGrid stroke="#1e2535" />
              <XAxis type="number" dataKey="rho" stroke="#64748b" tick={{fontSize:9}} />
              <YAxis type="number" dataKey="h" stroke="#64748b" tick={{fontSize:9}} />
              <Tooltip contentStyle={{background:'#0f1117',border:'1px solid #1e2535'}} formatter={v=>fmt(v,4)} />
              <Line type="monotone" dataKey="rho" stroke="#38bdf8" dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="text-xs text-slate-500 mt-2 mb-1">Speed of sound vs Altitude</div>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={results} layout="vertical">
              <CartesianGrid stroke="#1e2535" />
              <XAxis type="number" dataKey="a" stroke="#64748b" tick={{fontSize:9}} label={{value:'a (m/s)',position:'bottom',fill:'#64748b',fontSize:10}} />
              <YAxis type="number" dataKey="h" stroke="#64748b" tick={{fontSize:9}} />
              <Tooltip contentStyle={{background:'#0f1117',border:'1px solid #1e2535'}} formatter={v=>fmt(v,2)} />
              <Line type="monotone" dataKey="a" stroke="#a78bfa" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </>}
      </div>
    </div>
  )
}

function MassPanel() {
  const { features } = useStore()
  const [fuelFrac, setFuelFrac] = useState(0.3)
  const bodies = features.map((f, i) => {
    const mat = MATERIALS[f.materialKey]
    const rho = mat?.density || 2700
    const vol = f.volume || 0.01 + i * 0.005
    const mass = rho * vol
    return { name: f.name, mass, cx: i*0.5, cy: 0, cz: 0, Ixx: mass*0.1, Iyy: mass*0.1, Izz: mass*0.1 }
  })
  if (bodies.length === 0) bodies.push({ name: 'Empty', mass: 0.001, cx:0, cy:0, cz:0, Ixx:0,Iyy:0,Izz:0 })
  const props = massProperties(bodies)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="panel-header"><Icon d={icons.atom} size={11} />Mass Properties</div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <Section title="Mass Summary">
          <div className="grid-2 gap-2">
            <div className="result-card"><div className="text-xs text-slate-500">Total Mass</div><div className="result-val">{fmt(props.totalMass,2)}</div><div className="text-xs text-slate-600">kg</div></div>
            <div className="result-card"><div className="text-xs text-slate-500">CG — x</div><div className="result-val">{fmt(props.cg[0],3)}</div><div className="text-xs text-slate-600">m</div></div>
            <div className="result-card"><div className="text-xs text-slate-500">CG — y</div><div className="result-val">{fmt(props.cg[1],3)}</div><div className="text-xs text-slate-600">m</div></div>
            <div className="result-card"><div className="text-xs text-slate-500">CG — z</div><div className="result-val">{fmt(props.cg[2],3)}</div><div className="text-xs text-slate-600">m</div></div>
          </div>
        </Section>
        <Section title="Inertia Tensor (kg·m²)">
          <div className="mono text-xs text-slate-400 space-y-1">
            <div>[  Ixx={fmt(props.Ixx,2)}  Ixy={fmt(props.Ixy,2)}  Ixz={fmt(props.Ixz,2)}  ]</div>
            <div>[  Ixy={fmt(props.Ixy,2)}  Iyy={fmt(props.Iyy,2)}  Iyz={fmt(props.Iyz,2)}  ]</div>
            <div>[  Ixz={fmt(props.Ixz,2)}  Iyz={fmt(props.Iyz,2)}  Izz={fmt(props.Izz,2)}  ]</div>
          </div>
        </Section>
        <Section title="Propellant CG Shift">
          <PropRow label="Fuel fraction">
            <input type="range" min={0} max={1} step={0.01} value={fuelFrac} onChange={e=>setFuelFrac(+e.target.value)} className="w-full" />
          </PropRow>
          <PropRow label="Fuel fraction" value={fmt(fuelFrac,2)} />
          <PropRow label="Fuel mass" value={fmt(props.totalMass * fuelFrac, 1)} unit="kg" />
        </Section>
        <Section title="Weight Breakdown">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={bodies.map((b,i)=>({name: b.name.slice(0,10), mass: b.mass}))}>
              <CartesianGrid stroke="#1e2535" />
              <XAxis dataKey="name" stroke="#64748b" tick={{fontSize:9}} />
              <YAxis stroke="#64748b" tick={{fontSize:9}} />
              <Tooltip contentStyle={{background:'#0f1117',border:'1px solid #1e2535'}} formatter={v=>fmt(v,2)} />
              <Bar dataKey="mass" fill="#38bdf8" />
            </BarChart>
          </ResponsiveContainer>
        </Section>
      </div>
    </div>
  )
}

function CLTPanel() {
  const { cltConfig, updateCltConfig, addCltPly, removeCltPly, updateCltPly } = useStore()
  const [results, setResults] = useState(null)
  const mat = MATERIALS[cltConfig.material]

  const compute = () => {
    if (!mat || !mat.isComposite) return
    const r = clt(cltConfig.plies, { E1: mat.E, E2: mat.E2, G12: mat.G12, nu12: mat.nu12 })
    setResults(r)
  }

  const fmtMatrix = (M) => M.map(row => row.map(v=>v.toFixed(2).padStart(12)).join(' ')).join('\n')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="panel-header"><Icon d={icons.layers} size={11} />Classical Laminate Theory (CLT)</div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <Section title="Material">
          <select className="prop-select w-full" value={cltConfig.material} onChange={e=>updateCltConfig({material:e.target.value})}>
            {Object.entries(MATERIALS).filter(([,m])=>m.isComposite).map(([k,m])=><option key={k} value={k}>{m.name}</option>)}
          </select>
          {mat && <div className="text-xs text-slate-500 mt-1 italic">{mat.desc}</div>}
        </Section>
        <Section title="Layup Editor">
          <div className="text-xs text-slate-500 mb-2">Double-click angle to edit. Drag to reorder.</div>
          {cltConfig.plies.map((ply, i) => (
            <div key={i} className="flex items-center gap-2 mb-1">
              <span className="text-xs text-slate-500 w-6">{i+1}</span>
              <input type="number" className="prop-input w-20" value={ply.angle_deg} min={-90} max={90} step={5}
                onChange={e=>updateCltPly(i,'angle_deg',e.target.value)} placeholder="Angle" />
              <span className="text-xs text-slate-600">°</span>
              <input type="number" className="prop-input w-24" value={ply.thickness*1000} min={0.05} max={5} step={0.025}
                onChange={e=>updateCltPly(i,'thickness',e.target.value/1000)} placeholder="t (mm)" />
              <span className="text-xs text-slate-600">mm</span>
              <button className="text-red-400 text-xs ml-auto" onClick={()=>removeCltPly(i)}>✕</button>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <button className="btn btn-ghost text-xs" onClick={addCltPly}>+ Ply</button>
            <button className="btn btn-primary text-xs" onClick={compute}>Compute ABD</button>
          </div>
        </Section>
        {results && <>
          <Section title="A Matrix (in-plane stiffness, N/m)">
            <pre className="mono text-xs text-sky-400 bg-surface-800 p-2 rounded overflow-x-auto">{fmtMatrix(results.A)}</pre>
          </Section>
          <Section title="B Matrix (coupling, N)">
            <pre className="mono text-xs text-slate-400 bg-surface-800 p-2 rounded overflow-x-auto">{fmtMatrix(results.B)}</pre>
          </Section>
          <Section title="D Matrix (bending stiffness, N·m)">
            <pre className="mono text-xs text-a78bfa bg-surface-800 p-2 rounded overflow-x-auto" style={{color:'#a78bfa'}}>{fmtMatrix(results.D)}</pre>
          </Section>
          <div className="result-card">
            <div className="text-xs text-slate-500 mb-1">Total laminate thickness</div>
            <div className="result-val">{fmt(cltConfig.plies.reduce((s,p)=>s+p.thickness,0)*1000,3)} mm</div>
          </div>
        </>}
      </div>
    </div>
  )
}

// ── Analysis Panel Router ─────────────────────────────────────
function AnalysisPanel() {
  const { analysisMode } = useStore()
  switch(analysisMode) {
    case 'vlm': return <VLMPanel />
    case 'fea': return <FEAPanel />
    case 'propulsion': return <PropulsionPanel />
    case 'orbital': return <OrbitalPanel />
    case 'performance': return <PerformancePanel />
    case 'mass': return <MassPanel />
    case 'atmosphere': return <AtmospherePanel />
    case 'clt': return <CLTPanel />
    default: return (
      <div className="p-6 text-center text-slate-600">
        <div className="text-5xl mb-4">📡</div>
        <div className="text-sm font-medium text-slate-500 mb-2">Analysis Suite</div>
        <div className="text-xs space-y-1">
          <div>Click an analysis tool in the toolbar:</div>
          <div className="text-sky-600">Aero · FEA · Prop · Orbit · Perf · Mass · Atmos · CLT</div>
        </div>
      </div>
    )
  }
}

// ── Component Library Dialog ──────────────────────────────────
function ComponentLibraryDialog({ onClose }) {
  const { addFeature } = useStore()
  const [cat, setCat] = useState('Aerodynamic Surfaces')
  const [params, setParams] = useState({})
  const [selectedComp, setSelectedComp] = useState(null)

  const selectComp = (comp) => {
    setSelectedComp(comp)
    const defaults = {}
    Object.entries(comp.params).forEach(([k, d]) => { defaults[k] = d.default })
    setParams(defaults)
  }

  const addToModel = () => {
    if (!selectedComp) return
    addFeature(selectedComp.id, selectedComp.name, params)
    onClose()
  }

  return (
    <div className="dialog-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="dialog fade-in" style={{minWidth:700,maxHeight:'85vh'}}>
        <div className="dialog-header">
          <span>Aerospace Component Library</span>
          <button className="btn btn-ghost py-0.5 px-2" onClick={onClose}><Icon d={icons.x} size={14} /></button>
        </div>
        <div className="dialog-body flex gap-4" style={{height:520}}>
          {/* Categories */}
          <div className="w-48 border-r border-slate-800 pr-3 overflow-y-auto">
            {Object.keys(COMPONENT_CATEGORIES).map(c=>(
              <button key={c} className={`w-full text-left tree-item ${cat===c?'selected':''}`} onClick={()=>{setCat(c);setSelectedComp(null)}}>
                <span className="text-xs">{c}</span>
              </button>
            ))}
          </div>
          {/* Components list */}
          <div className="w-52 border-r border-slate-800 pr-3 overflow-y-auto">
            {(COMPONENT_CATEGORIES[cat]||[]).map(comp=>(
              <button key={comp.id} className={`w-full text-left tree-item ${selectedComp?.id===comp.id?'selected':''}`} onClick={()=>selectComp(comp)}>
                <span className="text-xs">{comp.name}</span>
              </button>
            ))}
          </div>
          {/* Params */}
          <div className="flex-1 overflow-y-auto">
            {selectedComp ? (
              <div>
                <div className="text-sm font-semibold mb-3 text-sky-400">{selectedComp.name}</div>
                {Object.entries(selectedComp.params).map(([key, def]) => (
                  <div key={key} className="prop-row mb-2">
                    <span className="prop-label text-xs">{def.label}</span>
                    {def.type === 'select' ? (
                      <SelectInput value={params[key]??def.default} onChange={v=>setParams(p=>({...p,[key]:v}))} options={def.options||[]} />
                    ) : def.type === 'number' ? (
                      <NumInput value={params[key]??def.default} min={def.min} max={def.max}
                        onChange={v=>setParams(p=>({...p,[key]:v}))} />
                    ) : (
                      <input className="prop-input" value={params[key]??def.default}
                        onChange={e=>setParams(p=>({...p,[key]:e.target.value}))} />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-slate-600 text-xs pt-12">Select a component to configure</div>
            )}
          </div>
        </div>
        <div className="dialog-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={addToModel} disabled={!selectedComp}>
            <Icon d={icons.plus} size={14} /> Add to Model
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Export Dialog ─────────────────────────────────────────────
function ExportDialog({ onClose }) {
  const { modelName, features } = useStore()
  const [format, setFormat] = useState('aeroforge')

  const exportModel = () => {
    const data = { name: modelName, features, exportedAt: new Date().toISOString() }
    let content, filename, type
    switch(format) {
      case 'aeroforge':
        content = JSON.stringify(data, null, 2)
        filename = `${modelName}.aeroforge`
        type = 'application/json'
        break
      case 'csv':
        const rows = features.map(f => `"${f.name}","${f.type}","${f.materialKey}",${f.mass||0}`)
        content = 'Name,Type,Material,Mass\n' + rows.join('\n')
        filename = `${modelName}.csv`
        type = 'text/csv'
        break
      default:
        content = JSON.stringify(data)
        filename = `${modelName}.json`
        type = 'application/json'
    }
    const blob = new Blob([content], {type})
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click()
    onClose()
  }

  const formats = [
    {id:'aeroforge',label:'.aeroforge (Native)',desc:'Full parametric model with feature tree'},
    {id:'csv',label:'.csv (BOM)',desc:'Bill of materials with mass properties'},
    {id:'json',label:'.json (Data)',desc:'Raw feature data in JSON format'},
  ]

  return (
    <div className="dialog-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="dialog fade-in">
        <div className="dialog-header">Export Model<button className="btn btn-ghost py-0.5 px-2" onClick={onClose}><Icon d={icons.x} size={14} /></button></div>
        <div className="dialog-body">
          <div className="text-xs text-slate-500 mb-3">Model: <span className="text-sky-400">{modelName}</span> · {features.length} features</div>
          <div className="space-y-2">
            {formats.map(f=>(
              <label key={f.id} className={`result-card flex items-start gap-3 cursor-pointer ${format===f.id?'border-sky-700':''}`}>
                <input type="radio" className="mt-0.5" checked={format===f.id} onChange={()=>setFormat(f.id)} />
                <div><div className="text-xs font-medium">{f.label}</div><div className="text-xs text-slate-500">{f.desc}</div></div>
              </label>
            ))}
          </div>
          <div className="mt-4 text-xs text-slate-600">
            STEP/IGES/STL/OBJ/glTF export requires OpenCASCADE kernel (Phase 2 roadmap)
          </div>
        </div>
        <div className="dialog-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={exportModel}><Icon d={icons.download} size={14} />Export</button>
        </div>
      </div>
    </div>
  )
}

// ── Shortcuts Dialog ──────────────────────────────────────────
function ShortcutsDialog({ onClose }) {
  const [search, setSearch] = useState('')
  const filtered = SHORTCUTS.filter(s => s.desc.toLowerCase().includes(search.toLowerCase()) || s.keys.toLowerCase().includes(search.toLowerCase()))
  return (
    <div className="dialog-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="dialog fade-in">
        <div className="dialog-header">Keyboard Shortcuts<button className="btn btn-ghost py-0.5 px-2" onClick={onClose}><Icon d={icons.x} size={14} /></button></div>
        <div className="dialog-body">
          <input className="prop-input w-full mb-3" placeholder="Search shortcuts…" value={search} onChange={e=>setSearch(e.target.value)} />
          <div className="grid-2 gap-2">
            {filtered.map(s=>(
              <div key={s.keys} className="flex items-center justify-between result-card">
                <span className="text-xs text-slate-400">{s.desc}</span>
                <kbd className="mono text-xs bg-surface-700 border border-slate-700 px-2 py-0.5 rounded text-sky-400">{s.keys}</kbd>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Auth Dialog ───────────────────────────────────────────────
function AuthDialog({ onClose }) {
  const { login } = useStore()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')

  const submit = () => {
    login({ name: name || email.split('@')[0], email })
    onClose()
  }

  return (
    <div className="dialog-overlay">
      <div className="dialog fade-in" style={{maxWidth:400,minWidth:380}}>
        <div className="dialog-header">
          <span>✈ AeroForge CAD</span>
          <button className="btn btn-ghost py-0.5 px-2" onClick={onClose}><Icon d={icons.x} size={14} /></button>
        </div>
        <div className="dialog-body">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🛸</div>
            <div className="text-lg font-bold text-sky-400">Welcome to AeroForge</div>
            <div className="text-xs text-slate-500">Industry-grade aerospace CAD in your browser</div>
          </div>
          <Tabs tabs={[{id:'login',label:'Sign In'},{id:'signup',label:'Sign Up'}]} active={mode} onChange={setMode} />
          <div className="mt-4 space-y-3">
            {mode === 'signup' && (
              <input className="prop-input w-full" placeholder="Full name" value={name} onChange={e=>setName(e.target.value)} />
            )}
            <input className="prop-input w-full" type="email" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)} />
            <input className="prop-input w-full" type="password" placeholder="Password" />
            <button className="btn btn-primary w-full" onClick={submit}>{mode==='login'?'Sign In':'Create Account'}</button>
            <div className="text-center text-xs text-slate-600">— or continue with —</div>
            <div className="flex gap-2">
              <button className="btn btn-ghost flex-1" onClick={submit}>Google</button>
              <button className="btn btn-ghost flex-1" onClick={submit}>GitHub</button>
            </div>
            <button className="w-full text-center text-xs text-slate-500 hover:text-slate-300 mt-2" onClick={submit}>
              Continue without account (local only)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Right Panel Router ────────────────────────────────────────
function RightPanel() {
  const { activeRightPanel, setActiveRightPanel, analysisMode } = useStore()
  const tabs = [
    { id: 'properties', label: 'Props' },
    { id: 'materials', label: 'Materials' },
    { id: 'analysis', label: 'Analysis' },
    { id: 'bom', label: 'BOM' },
  ]

  useEffect(() => {
    if (analysisMode) setActiveRightPanel('analysis')
  }, [analysisMode])

  return (
    <div className="flex flex-col h-full overflow-hidden panel" style={{width:320,minWidth:260,maxWidth:420}}>
      <Tabs tabs={tabs} active={activeRightPanel} onChange={setActiveRightPanel} />
      <div className="flex-1 overflow-hidden">
        {activeRightPanel === 'properties' && <PropertiesPanel />}
        {activeRightPanel === 'materials' && <MaterialsPanel />}
        {activeRightPanel === 'analysis' && <AnalysisPanel />}
        {activeRightPanel === 'bom' && <BOMPanel />}
      </div>
    </div>
  )
}

// ── View Controls Overlay ──────────────────────────────────────
function ViewCube() {
  const { setCameraPreset } = useStore()
  const faces = [
    {label:'ISO',preset:'iso'},{label:'TOP',preset:'top'},{label:'FRT',preset:'front'},{label:'RGT',preset:'right'},
  ]
  return (
    <div className="absolute top-3 right-3 z-10">
      <div className="grid grid-cols-2 gap-1">
        {faces.map(f=>(
          <button key={f.preset}
            className="text-xs bg-surface-800 border border-slate-700 hover:border-sky-600 hover:text-sky-400 rounded px-2 py-1 text-slate-500 transition-all"
            onClick={()=>setCameraPreset(f.preset)}>{f.label}</button>
        ))}
      </div>
    </div>
  )
}

function SectionPlaneControls() {
  const { showSectionPlane, toggleSectionPlane, sectionPlaneAxis, sectionPlaneOffset, setSectionPlane } = useStore()
  if (!showSectionPlane) return null
  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 bg-surface-900 border border-slate-700 rounded-lg p-2 flex items-center gap-3">
      <span className="text-xs text-slate-500">Section:</span>
      {['x','y','z'].map(ax=>(
        <button key={ax} className={`text-xs px-2 py-0.5 rounded ${sectionPlaneAxis===ax?'text-sky-400 border-sky-700 border':'text-slate-500 border border-slate-700'}`}
          onClick={()=>setSectionPlane(ax, sectionPlaneOffset)}>{ax.toUpperCase()}</button>
      ))}
      <input type="range" min={-20} max={20} step={0.5} value={sectionPlaneOffset}
        onChange={e=>setSectionPlane(sectionPlaneAxis, +e.target.value)} className="w-24" />
      <span className="mono text-xs text-sky-400">{sectionPlaneOffset.toFixed(1)} m</span>
      <button className="text-red-400 text-xs" onClick={toggleSectionPlane}>✕</button>
    </div>
  )
}

// ── Menubar ───────────────────────────────────────────────────
function Menubar() {
  const { modelName, setModelName, user, setAuthModal, theme, toggleTheme, newModel, saveModel, openDialog, toggleSectionPlane, toggleGrid, toggleAxes, showGrid, showAxes, isDirty, models, loadModel, units, setUnits, setCameraPreset } = useStore()
  const [activeMenu, setActiveMenu] = useState(null)
  const [editingName, setEditingName] = useState(false)

  const menus = {
    File: [
      { label: 'New Model', keys: 'Ctrl+N', action: newModel },
      { label: 'Save', keys: 'Ctrl+S', action: saveModel },
      { label: 'Saved Models', items: models.map(m=>({ label: m.name, action: ()=>loadModel(m) })) },
      null,
      { label: 'Import…', action: ()=>openDialog('import') },
      { label: 'Export…', keys: 'Ctrl+E', action: ()=>openDialog('export') },
    ],
    Edit: [
      { label: 'Undo', keys: 'Ctrl+Z', action: ()=>{} },
      { label: 'Redo', keys: 'Ctrl+Y', action: ()=>{} },
      null,
      { label: 'Select All', keys: 'Ctrl+A', action: ()=>{} },
      { label: 'Delete Selected', keys: 'Del', action: ()=>{} },
    ],
    View: [
      { label: 'Front View', keys: '1', action: ()=>setCameraPreset('front') },
      { label: 'Top View', keys: '2', action: ()=>setCameraPreset('top') },
      { label: 'Right View', keys: '3', action: ()=>setCameraPreset('right') },
      { label: 'Isometric', keys: '4', action: ()=>setCameraPreset('iso') },
      null,
      { label: `${showGrid?'Hide':'Show'} Grid`, keys: 'G', action: toggleGrid },
      { label: `${showAxes?'Hide':'Show'} Axes`, action: toggleAxes },
      { label: 'Section Plane', action: toggleSectionPlane },
    ],
    Tools: [
      { label: 'Component Library', action: ()=>openDialog('component-lib') },
      { label: 'BOM', action: ()=>openDialog('bom') },
      { label: 'Materials Database', action: ()=>{} },
      null,
      { label: 'Units: SI (m,kg,N)', action: ()=>setUnits('SI') },
      { label: 'Units: Imperial (ft,lbf)', action: ()=>setUnits('Imperial') },
    ],
    Analyze: [
      { label: 'VLM Aerodynamics', action: ()=>useStore.getState().setAnalysisMode('vlm') },
      { label: 'Structural FEA', action: ()=>useStore.getState().setAnalysisMode('fea') },
      { label: 'Propulsion', action: ()=>useStore.getState().setAnalysisMode('propulsion') },
      { label: 'Orbital Mechanics', action: ()=>useStore.getState().setAnalysisMode('orbital') },
      { label: 'Flight Performance', action: ()=>useStore.getState().setAnalysisMode('performance') },
      { label: 'Mass Properties', action: ()=>useStore.getState().setAnalysisMode('mass') },
      { label: 'ISA Atmosphere', action: ()=>useStore.getState().setAnalysisMode('atmosphere') },
      { label: 'Composite CLT', action: ()=>useStore.getState().setAnalysisMode('clt') },
    ],
    Help: [
      { label: 'Keyboard Shortcuts', keys: 'Ctrl+K', action: ()=>openDialog('shortcuts') },
      { label: 'About AeroForge', action: ()=>openDialog('about') },
    ],
  }

  useEffect(() => {
    const close = () => setActiveMenu(null)
    if (activeMenu) window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [activeMenu])

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if ((e.ctrlKey||e.metaKey) && e.key === 's') { e.preventDefault(); saveModel() }
      if ((e.ctrlKey||e.metaKey) && e.key === 'n') { e.preventDefault(); newModel() }
      if ((e.ctrlKey||e.metaKey) && e.key === 'k') { e.preventDefault(); openDialog('shortcuts') }
      if ((e.ctrlKey||e.metaKey) && e.key === 'e') { e.preventDefault(); openDialog('export') }
      if (e.key === 'g' || e.key === 'G') toggleGrid()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [saveModel, newModel, openDialog, toggleGrid])

  return (
    <div className="flex items-center h-10 bg-surface-950 border-b border-slate-800 flex-shrink-0 px-3 gap-4 select-none">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-1">
        <span className="text-sky-400 font-bold text-sm tracking-wider">✈ AEROFORGE</span>
        <span className="badge badge-blue text-xs">CAD</span>
      </div>
      {/* Menu items */}
      {Object.entries(menus).map(([name, items]) => (
        <div key={name} className="relative">
          <button
            className={`text-xs px-2 py-1 rounded hover:bg-surface-700 transition-colors ${activeMenu===name?'bg-surface-700 text-sky-400':'text-slate-400'}`}
            onClick={e=>{ e.stopPropagation(); setActiveMenu(activeMenu===name?null:name) }}>
            {name}
          </button>
          {activeMenu === name && (
            <div className="absolute left-0 top-full mt-1 bg-surface-900 border border-slate-700 rounded-lg shadow-xl z-50 py-1 min-w-48" onClick={e=>e.stopPropagation()}>
              {items.map((item, i) => item === null ? (
                <div key={i} className="border-t border-slate-800 my-1" />
              ) : item.items ? (
                <div key={i}>
                  <div className="text-xs text-slate-600 px-3 py-1">{item.label}</div>
                  {item.items.map((sub,j) => (
                    <button key={j} className="w-full text-left text-xs px-4 py-1.5 hover:bg-surface-700 text-slate-400"
                      onClick={()=>{ sub.action(); setActiveMenu(null) }}>{sub.label}</button>
                  ))}
                </div>
              ) : (
                <button key={i} className="w-full text-left text-xs px-3 py-1.5 hover:bg-surface-700 text-slate-300 flex justify-between items-center"
                  onClick={()=>{ item.action?.(); setActiveMenu(null) }}>
                  <span>{item.label}</span>
                  {item.keys && <span className="text-slate-600 mono text-xs">{item.keys}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      {/* Model name */}
      <div className="flex-1 flex justify-center">
        {editingName ? (
          <input autoFocus className="prop-input text-center text-sm w-64" value={modelName}
            onChange={e=>setModelName(e.target.value)}
            onBlur={()=>setEditingName(false)}
            onKeyDown={e=>{ if(e.key==='Enter'||e.key==='Escape') setEditingName(false) }} />
        ) : (
          <button className="text-sm text-slate-300 hover:text-sky-400 transition-colors" onDoubleClick={()=>setEditingName(true)}>
            {modelName}{isDirty && <span className="text-orange-400 ml-1">●</span>}
          </button>
        )}
      </div>
      {/* Right controls */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-600 mono">{units}</span>
        <button className="btn btn-ghost text-xs py-1" onClick={toggleTheme}>
          <Icon d={theme==='dark'?icons.sun:icons.moon} size={13} />
        </button>
        {user ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{user.name}</span>
            <button className="btn btn-ghost py-1 px-2 text-xs" onClick={()=>useStore.getState().logout()}>Logout</button>
          </div>
        ) : (
          <button className="btn btn-primary py-1 px-3 text-xs" onClick={()=>openDialog('auth')}>
            <Icon d={icons.user} size={12} />Sign In
          </button>
        )}
      </div>
    </div>
  )
}

// ── Status Bar ────────────────────────────────────────────────
function StatusBar() {
  const { statusMode, statusSelection, statusCoords, statusUnits, features, viewMode, showGrid, analysisRunning } = useStore()
  return (
    <div className="status-bar flex-shrink-0">
      <div className="status-item">
        <div className="status-dot" style={{background: analysisRunning ? '#f59e0b' : '#22c55e'}} />
        <span className={analysisRunning ? 'text-yellow-500' : ''}>{analysisRunning ? 'Running Analysis…' : statusMode}</span>
      </div>
      <div className="status-item"><span className="text-slate-600">│</span>{statusSelection}</div>
      <div className="status-item"><span className="text-slate-600">│</span>
        <span className="mono">{statusCoords.map(v=>v.toFixed(2)).join(', ')}</span>
      </div>
      <div className="status-item ml-auto">
        <span className="badge badge-blue">{viewMode}</span>
        {showGrid && <span className="badge badge-purple ml-1">grid</span>}
        <span className="text-slate-600 ml-2">{features.length} features</span>
        <span className="text-slate-600 ml-2">SI</span>
      </div>
    </div>
  )
}

// ── Sketcher Overlay ──────────────────────────────────────────
function SketcherOverlay() {
  const { sketcherActive, setSketcherActive, sketchPlane, setSketchPlane } = useStore()
  if (!sketcherActive) return null
  return (
    <div className="absolute inset-0 z-20 pointer-events-none">
      <div className="absolute top-0 left-0 right-0 flex justify-center pt-3 pointer-events-auto">
        <div className="bg-surface-900 border border-sky-700 rounded-lg px-4 py-2 flex items-center gap-4 shadow-lg glow-blue">
          <span className="text-sky-400 text-sm font-semibold">✏ Sketch Mode</span>
          <div className="flex gap-1">
            {['XY','XZ','YZ'].map(p=>(
              <button key={p} className={`text-xs px-3 py-1 rounded ${sketchPlane===p?'bg-sky-700 text-white':'text-slate-500 hover:text-slate-300'}`}
                onClick={()=>setSketchPlane(p)}>{p}</button>
            ))}
          </div>
          <div className="flex gap-1">
            {['Line','Circle','Arc','Spline','Rect'].map(t=>(
              <button key={t} className="text-xs px-2 py-1 rounded text-slate-500 hover:bg-surface-700 hover:text-slate-300">{t}</button>
            ))}
          </div>
          <button className="btn btn-ghost text-xs" onClick={()=>setSketcherActive(false)}>Exit Sketch</button>
        </div>
      </div>
      {/* Grid overlay for sketch */}
      <div className="absolute inset-0" style={{background:'repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(30,37,53,0.4) 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(30,37,53,0.4) 40px)'}}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-xs text-slate-700">Sketch plane: {sketchPlane}</div>
        </div>
      </div>
    </div>
  )
}

function AnalysisModeIndicator() {
  const analysisMode = useStore(s => s.analysisMode)
  if (!analysisMode) return null
  return (
    <div className="absolute top-3 left-3 z-10">
      <span className="badge badge-blue">Analysis: {analysisMode}</span>
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────
export default function App() {
  const { activeDialog, closeDialog, setStatus, theme, authModal } = useStore()
  const [coords, setCoords] = useState([0,0,0])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const handleCoordsChange = useCallback((c) => {
    setCoords(c)
    setStatus(null, null, c)
  }, [setStatus])

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-surface-950 text-slate-200" style={{fontSize:13}}>
      {/* Menubar */}
      <Menubar />
      {/* Toolbar */}
      <Toolbar />
      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — Feature Tree */}
        <div className="panel" style={{width:260,minWidth:200,maxWidth:360,flexShrink:0}}>
          <FeatureTree />
        </div>
        {/* Center — 3D Viewport */}
        <div className="flex-1 relative overflow-hidden">
          <ThreeViewport onCoordsChange={handleCoordsChange} />
          <ViewCube />
          <SketcherOverlay />
          <SectionPlaneControls />
          {/* Viewport overlay — analysis mode indicator */}
          <AnalysisModeIndicator />
        </div>
        {/* Right panel */}
        <RightPanel />
      </div>
      {/* Status bar */}
      <StatusBar />

      {/* Dialogs */}
      {activeDialog === 'component-lib' && <ComponentLibraryDialog onClose={closeDialog} />}
      {activeDialog === 'export' && <ExportDialog onClose={closeDialog} />}
      {activeDialog === 'shortcuts' && <ShortcutsDialog onClose={closeDialog} />}
      {activeDialog === 'auth' && <AuthDialog onClose={closeDialog} />}
      {activeDialog === 'about' && (
        <div className="dialog-overlay" onClick={closeDialog}>
          <div className="dialog fade-in" style={{maxWidth:420}}>
            <div className="dialog-header">About AeroForge CAD<button className="btn btn-ghost py-0.5 px-2" onClick={closeDialog}><Icon d={icons.x} size={14}/></button></div>
            <div className="dialog-body text-center">
              <div className="text-5xl mb-4">✈</div>
              <div className="text-xl font-bold text-sky-400 mb-1">AeroForge CAD</div>
              <div className="text-xs text-slate-400 mb-4">Browser-based aerospace engineering platform</div>
              <div className="text-xs text-slate-500 space-y-1">
                <div>React + Three.js · Zustand · Recharts</div>
                <div>VLM Aerodynamics · FEA Solver · Orbital Mechanics</div>
                <div>100+ Materials · 50+ Parametric Components</div>
                <div className="mt-3 text-slate-600">Deploy on Vercel · Run in any browser</div>
              </div>
            </div>
            <div className="dialog-footer"><button className="btn btn-primary" onClick={closeDialog}>Close</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
