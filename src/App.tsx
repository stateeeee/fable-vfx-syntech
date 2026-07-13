import React, { useState, useEffect, useRef } from 'react';
import {
  Layers,
  Play,
  RefreshCw,
  Sun,
  Moon,
  MoreHorizontal,
  Search,
  Cpu,
  Home as HomeIcon,
  Save as SaveIcon,
  Folder as FolderIcon,
  Sparkles as AiIcon,
  ChevronRight,
} from 'lucide-react';
import { ModuleConfig, ModuleId, ActiveTab, SignalSource } from './types';
import { EffectTelemetry, ParamSchema, ShellMessage } from './bridge/types';
import { EFFECTS_REGISTRY, hasRealEffect } from './effects-registry';
import VfxCanvas from './components/VfxCanvas';
import EffectHost from './components/EffectHost';
import ChainLab from './components/ChainLab';
import AiDirector from './components/AiDirector';
import NodalComposition, { CompEffect, EFFECT_META } from './components/NodalComposition';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

// explicit session snapshot for the SAVE nav action (decision #9: localStorage)
const SESSION_KEY = 'syntech.session';
const COMP_KEY = 'syntech.composition';
interface SavedSession { activeModule?: ModuleId; isDayMode?: boolean; savedAt?: number }
const readSession = (): SavedSession => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}') ?? {}; } catch { return {}; }
};

export default function App() {
  // App initialization & Stream engine active state
  const [isStreaming, setIsStreaming] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('PARAMETERS');
  const [activeModule, setActiveModule] = useState<ModuleId>(() => {
    const saved = readSession().activeModule;
    return saved && saved in EFFECTS_REGISTRY ? saved : 'blob_tracker';
  });
  const [signalSource, setSignalSource] = useState<SignalSource>('L_INPUT_CHANNEL_01');
  const [bufferSize, setBufferSize] = useState<number>(8192);
  const [globalSyncLocked, setGlobalSyncLocked] = useState(true);
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [isDayMode, setIsDayMode] = useState(() => !!readSession().isDayMode);

  // SAVE / PROJECTS nav actions (phase 6: placeholders become minimal features)
  const [savedFlash, setSavedFlash] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [chainPresetToOpen, setChainPresetToOpen] = useState<string | null>(null);
  const handleSaveSession = () => {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ activeModule, isDayMode, savedAt: Date.now() }));
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
    } catch { /* private mode */ }
  };
  const savedChains = (): Array<{ name: string; savedAt: number; enabled: string[] }> => {
    try {
      const raw = JSON.parse(localStorage.getItem('syntech.chainPresets') ?? '[]');
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  };

  // Real effect currently open full-terminal (null = dashboard/home view)
  const [openEffectId, setOpenEffectId] = useState<ModuleId | null>(null);
  // Ai Lab (native SynEngine): effects composed in series, phase 5 MVP
  const [chainOpen, setChainOpen] = useState(false);

  // ── COMPOSITION STATE (shared by the Nodal Composition + the AI Lab) ──
  // The effects present in the composition, each with its enabled flag.
  // Detaching a node's connection port simply toggles enabled. The AI Lab
  // opens with exactly this source + enabled chain (the Nodal Composition is
  // the dashboard shortcut into it).
  const [compEffects, setCompEffects] = useState<CompEffect[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COMP_KEY) ?? 'null');
      if (Array.isArray(saved)) {
        const cleaned = saved.filter((e) => e && typeof e.id === 'string' && e.id in EFFECTS_REGISTRY)
          .map((e) => ({ id: e.id as ModuleId, enabled: !!e.enabled }));
        if (cleaned.length) return cleaned;
      }
    } catch { /* ignore */ }
    return [{ id: 'blob_tracker', enabled: true }, { id: 'analog', enabled: true }];
  });
  useEffect(() => {
    try { localStorage.setItem(COMP_KEY, JSON.stringify(compEffects)); } catch { /* private mode */ }
  }, [compEffects]);

  // the enabled chain (in order) — what the AI Lab / brain graph consume
  const graphChain: ModuleId[] = compEffects.filter((e) => e.enabled).map((e) => e.id);

  const toggleCompEffect = (id: ModuleId) =>
    setCompEffects((prev) => prev.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e)));
  const addCompEffect = (id: ModuleId) =>
    setCompEffects((prev) => (prev.some((e) => e.id === id) ? prev.map((e) => (e.id === id ? { ...e, enabled: true } : e)) : [...prev, { id, enabled: true }]));
  const removeCompEffect = (id: ModuleId) =>
    setCompEffects((prev) => prev.filter((e) => e.id !== id));

  // Linking two hubs on the brain graph adds both to the composition (enabled)
  const handleChainLink = (from: ModuleId, to: ModuleId) => {
    if (from === to) return;
    setCompEffects((prev) => {
      let next = prev.slice();
      const ensure = (id: ModuleId) => {
        if (!next.some((e) => e.id === id)) next.push({ id, enabled: true });
        else next = next.map((e) => (e.id === id ? { ...e, enabled: true } : e));
      };
      ensure(from);
      ensure(to);
      return next;
    });
  };
  const clearChain = () => setCompEffects((prev) => prev.map((e) => ({ ...e, enabled: false })));

  // ── SHARED SOURCE VIDEO (video + audio): the INPUT node ──
  const [compSource, setCompSource] = useState<{ url: string; name: string } | null>(null);
  const sourceInputRef = useRef<HTMLInputElement | null>(null);
  const pickSource = () => sourceInputRef.current?.click();
  const onSourceFile = (file: File | null) => {
    if (!file) return;
    setCompSource((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return { url: URL.createObjectURL(file), name: file.name };
    });
  };
  useEffect(() => () => { if (compSource?.url) URL.revokeObjectURL(compSource.url); }, []); // eslint-disable-line

  const [effectTelemetry, setEffectTelemetry] = useState<EffectTelemetry | null>(null);

  // Sender registered by the open effect's bridge (param:set / preset:apply)
  const effectSendRef = React.useRef<((message: ShellMessage) => void) | null>(null);

  // Selects the module in the dashboard and, when a real effect build is
  // registered for it, opens it full-terminal (PLAN.md decision #1)
  const handleModuleOpen = (id: ModuleId) => {
    setActiveModule(id);
    if (hasRealEffect(id)) {
      setOpenEffectId(id);
    }
  };

  const handleEffectClose = () => {
    setOpenEffectId(null);
    setEffectTelemetry(null);
    effectSendRef.current = null;
  };

  const openLab = () => { handleEffectClose(); setChainOpen(true); };

  // The effect declared its real ParamSchema: swap the module's placeholder
  // parameters for the real ones so Gemini and the shell operate on truth.
  const handleEffectParams = (effectId: ModuleId, params: ParamSchema[]) => {
    if (params.length === 0) return;
    setModules((prev) =>
      prev.map((m) => {
        if (m.id !== effectId) return m;
        const parameters: ModuleConfig['parameters'] = {};
        for (const p of params) {
          if (p.type === 'number') {
            parameters[p.key] = {
              label: p.label,
              value: Number(p.value) || 0,
              min: p.min ?? 0,
              max: p.max ?? 100,
              step: p.step ?? 1,
              hint: p.aiHint,
            };
          } else if (p.type === 'boolean') {
            parameters[p.key] = {
              label: p.label,
              value: p.value ? 1 : 0,
              min: 0,
              max: 1,
              step: 1,
              hint: `(on/off switch) ${p.aiHint ?? ''}`.trim(),
            };
          }
        }
        return Object.keys(parameters).length > 0 ? { ...m, parameters } : m;
      })
    );
  };

  // Gemini Intelligence custom states
  const [activeGeminiMode, setActiveGeminiMode] = useState<'art_director' | 'agent' | 'optimizer' | null>(null);
  const [geminiPrompt, setGeminiPrompt] = useState('');
  const [geminiResponse, setGeminiResponse] = useState<string | null>(null);
  const [isProcessingGemini, setIsProcessingGemini] = useState(false);
  const [suggestedPreset, setSuggestedPreset] = useState<any | null>(null);

  // Apply a parameter preset suggested by Gemini AI
  const handleApplyPreset = (preset: any) => {
    if (!preset) return;
    setModules((prev) =>
      prev.map((m) => {
        if (m.id === activeModule) {
          const updatedParameters = { ...m.parameters };
          let updated = false;
          for (const key of Object.keys(preset)) {
            if (updatedParameters[key]) {
              updatedParameters[key] = { ...updatedParameters[key], value: Number(preset[key]) };
              updated = true;
            }
          }
          if (updated) return { ...m, parameters: updatedParameters };
        }
        return m;
      })
    );
    effectSendRef.current?.({ type: 'syntech:preset:apply', payload: { params: preset } });
  };

  // Dynamic ticking metrics
  const [frameCount, setFrameCount] = useState(84491820);
  const [uptimeSeconds, setUptimeSeconds] = useState(15132);
  const [simulatedLatency, setSimulatedLatency] = useState(1.2);
  const [fpsDisplay, setFpsDisplay] = useState(120);
  const frameCountRef = useRef(frameCount);
  frameCountRef.current = frameCount;

  // Modules setup with their reactive parameter configurations
  const [modules, setModules] = useState<ModuleConfig[]>([
    {
      id: 'blob_tracker',
      name: 'BLOB TRACKER',
      description: 'Organic vertex displacement and fluid dynamics mapping for cellular visual structures.',
      status: 'ACTIVE',
      parameters: {
        displacement: { label: 'VERTEX DISPLACEMENT', value: 0, min: 0, max: 100, step: 1 },
        fluidDynamics: { label: 'FLUID DYNAMICS', value: 0, min: 0, max: 100, step: 1 },
        cellSize: { label: 'CELLULAR DENSITY', value: 100, min: 0, max: 100, step: 1 },
      },
    },
    {
      id: 'analog',
      name: 'ANALOG',
      description: 'CRT emulation, horizontal sync jitter, and chromatic aberration simulation.',
      status: 'STANDBY',
      parameters: {
        crtEmulation: { label: 'CRT EMULATION', value: 60, min: 0, max: 100, step: 1 },
        syncJitter: { label: 'HORIZONTAL JITTER', value: 35, min: 0, max: 100, step: 1 },
        chromaticAberration: { label: 'CHROMATIC OFFSET', value: 45, min: 0, max: 100, step: 1 },
      },
    },
    {
      id: 'blob_reveal',
      name: 'BLOB REVEAL',
      description: 'Dynamic canvas revealing through negative mask expansion and light refraction.',
      status: 'STANDBY',
      parameters: {
        revealThreshold: { label: 'REVEAL THRESHOLD', value: 40, min: 0, max: 100, step: 1 },
        maskInversion: { label: 'MASK INVERSION', value: 20, min: 0, max: 100, step: 1 },
        edgeFeather: { label: 'EDGE FEATHER', value: 50, min: 0, max: 100, step: 1 },
      },
    },
    {
      id: 'bokeh',
      name: 'BOKEH',
      description: 'Out-of-focus circle aberration engine with depth layer rendering.',
      status: 'STANDBY',
      parameters: {
        depthOfField: { label: 'DEPTH OF FIELD', value: 70, min: 0, max: 100, step: 1 },
        bokehScale: { label: 'BOKEH RADIUS', value: 60, min: 0, max: 100, step: 1 },
        apertureShutter: { label: 'APERTURE SHAPE', value: 45, min: 0, max: 100, step: 1 },
      },
    },
    {
      id: 'anamorphic_lab',
      name: 'ANAMORPHIC LAB',
      description: 'Horizontal lens flare stretching and ultra-wide aspect distortion generator.',
      status: 'STANDBY',
      parameters: {
        streakIntensity: { label: 'STREAK INTENSITY', value: 50, min: 0, max: 100, step: 1 },
        flareStretching: { label: 'FLARE STRETCHING', value: 80, min: 0, max: 100, step: 1 },
        diffractionGrating: { label: 'DIFFRACTION GRATING', value: 30, min: 0, max: 100, step: 1 },
      },
    },
  ]);

  const currentModule = modules.find((m) => m.id === activeModule) || modules[0];

  // Handle ticking counters
  useEffect(() => {
    let frameTimer: number;
    let clockTimer: number;
    if (isStreaming) {
      frameTimer = window.setInterval(() => {
        setFrameCount((prev) => prev + Math.floor(Math.random() * 2) + 1);
      }, 16);
      clockTimer = window.setInterval(() => {
        setUptimeSeconds((prev) => prev + 1);
        setFpsDisplay(116 + Math.floor(Math.random() * 8));
        setSimulatedLatency((prev) => {
          const jitter = (Math.random() - 0.5) * 0.12;
          const base = bufferSize === 4896 ? 1.2 : bufferSize === 2048 ? 0.6 : 2.4;
          return Math.max(0.3, Math.min(5.0, Number((base + jitter).toFixed(1))));
        });
      }, 1000);
    }
    return () => {
      clearInterval(frameTimer);
      clearInterval(clockTimer);
    };
  }, [isStreaming, bufferSize]);

  const formatUptime = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return [hrs, mins, secs].map((n) => n.toString().padStart(2, '0')).join(':');
  };
  const formatFrames = (frames: number) => frames.toLocaleString('en-US');

  const toggleModuleStatus = (id: ModuleId, e: React.MouseEvent) => {
    e.stopPropagation();
    setModules((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: m.status === 'ACTIVE' ? 'STANDBY' : 'ACTIVE' } : m))
    );
  };

  const handleParameterChange = (moduleId: ModuleId, paramKey: string, newValue: number) => {
    setModules((prev) =>
      prev.map((m) =>
        m.id === moduleId
          ? { ...m, parameters: { ...m.parameters, [paramKey]: { ...m.parameters[paramKey], value: newValue } } }
          : m
      )
    );
  };

  const handleBufferSizeChange = (size: number) => setBufferSize(size);

  const isHome = !chainOpen && !openEffectId;

  // ── left-sidebar navigation (the real commands, re-skinned per reference) ──
  const navItems: Array<{ key: string; label: string; Icon: any; active: boolean; onClick: () => void; title?: string }> = [
    { key: 'home', label: 'Home', Icon: HomeIcon, active: isHome, onClick: () => { setChainOpen(false); handleEffectClose(); } },
    { key: 'save', label: savedFlash ? 'Saved' : 'Save', Icon: SaveIcon, active: savedFlash, onClick: handleSaveSession, title: 'Save the current session (module, theme) to this browser' },
    { key: 'projects', label: 'Projects', Icon: FolderIcon, active: projectsOpen, onClick: () => setProjectsOpen(true), title: 'Saved effect chains' },
    { key: 'ailab', label: 'AI Lab', Icon: AiIcon, active: chainOpen, onClick: openLab },
  ];

  const outputRes = compSource ? '1920x1080' : '1920x1080';

  return (
    <div className={`h-screen w-screen transition-colors duration-300 ${isDayMode ? 'bg-[#fcfbf9] text-neutral-900' : 'text-white space-vignette'} flex flex-col font-sans overflow-hidden`}>

      {/* hidden source picker (shared INPUT) */}
      <input
        ref={sourceInputRef}
        type="file"
        accept="video/*"
        data-testid="source-file"
        className="hidden"
        onChange={(e) => { onSourceFile(e.target.files?.[0] ?? null); e.currentTarget.value = ''; }}
      />

      {/* ═══════════════ TOP BAR ═══════════════ */}
      <header className={`h-12 shrink-0 flex items-center justify-between px-4 border-b relative z-30 ${isDayMode ? 'border-neutral-200 bg-[#f7f5f0]' : 'border-ink-700/60 bg-ink-950'}`}>
        <div className="flex items-center gap-3 w-56">
          <span className={`font-mono text-[10px] tracking-[0.2em] uppercase ${isDayMode ? 'text-neutral-500' : 'text-neutral-500'}`}>
            {chainOpen ? 'AI Lab' : openEffectId ? currentModule.name : 'Composer'}
          </span>
        </div>

        {/* centered wordmark */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none">
          <span className="font-display text-sm font-semibold tracking-tight">VFX <span className="text-gold-500">Syntech</span></span>
        </div>

        <div className="flex items-center gap-2.5 justify-end">
          {/* FPS pill */}
          <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-[10px] ${isDayMode ? 'bg-white border border-neutral-200 text-neutral-600' : 'bg-ink-850 border border-ink-700/70 text-neutral-300'}`}>
            <b className="text-gold-500">{fpsDisplay}</b> FPS
          </div>
          {/* GPU meter */}
          <div className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-[10px] ${isDayMode ? 'bg-white border border-neutral-200 text-neutral-500' : 'bg-ink-850 border border-ink-700/70 text-neutral-400'}`}>
            <span>GPU</span>
            <span className="flex items-end gap-[2px] h-3">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className="eq-bar w-[3px] bg-emerald-400 rounded-sm" style={{ height: '100%', animationDelay: `${i * 0.12}s` }} />
              ))}
            </span>
          </div>
          <button
            type="button"
            title={isStreaming ? 'Pause engine' : 'Resume engine'}
            onClick={() => setIsStreaming((v) => !v)}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${isDayMode ? 'hover:bg-neutral-200 text-neutral-500' : 'hover:bg-ink-800 text-neutral-400'} ${isStreaming ? '' : 'text-gold-500'}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isStreaming ? 'animate-spin [animation-duration:6s]' : ''}`} />
          </button>
          <button
            type="button"
            title="Toggle day / night"
            onClick={() => setIsDayMode((v) => !v)}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${isDayMode ? 'hover:bg-neutral-200 text-neutral-500' : 'hover:bg-ink-800 text-neutral-400'}`}
          >
            {isDayMode ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            data-testid="render-btn"
            onClick={openLab}
            title="Open the AI Lab to render"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gold-500 text-black font-bold text-[11px] tracking-wide hover:bg-gold-400 transition-colors cursor-pointer"
          >
            Render <Play className="w-3 h-3 fill-black" />
          </button>
          <button
            type="button"
            title="Save session"
            onClick={handleSaveSession}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${isDayMode ? 'hover:bg-neutral-200 text-neutral-500' : 'hover:bg-ink-800 text-neutral-400'}`}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* ═══════════════ LEFT SIDEBAR ═══════════════ */}
        <nav className={`w-[78px] shrink-0 flex flex-col items-center pt-5 pb-3 border-r transition-colors duration-300 ${isDayMode ? 'border-neutral-200 bg-[#f7f5f0]' : 'border-ink-700/60 bg-ink-950'} z-20`}>
          <div className="w-11 h-11 border-2 border-gold-500 rotate-45 flex items-center justify-center shrink-0 mb-7 rounded-[10px] bg-gold-500/5 shadow-[0_0_16px_rgba(224,180,81,0.2)]">
            <span className="text-gold-500 font-bold -rotate-45 text-xs tracking-wide">VS</span>
          </div>

          <ul className="flex flex-col gap-5 w-full items-center">
            {navItems.map(({ key, label, Icon, active, onClick, title }) => (
              <li key={key} className="w-full flex justify-center">
                <button
                  type="button"
                  data-testid={`nav-${key}`}
                  onClick={onClick}
                  title={title}
                  className={`group flex flex-col items-center gap-1.5 w-full cursor-pointer transition-colors ${active ? 'text-gold-500' : isDayMode ? 'text-neutral-500 hover:text-black' : 'text-neutral-500 hover:text-white'}`}
                >
                  <span className={`p-2 rounded-xl transition-colors ${active ? 'bg-gold-500/12 shadow-[0_0_12px_rgba(224,180,81,0.12)]' : 'group-hover:bg-white/5'}`}>
                    <Icon className="w-[18px] h-[18px]" />
                  </span>
                  <span className="text-[8.5px] uppercase tracking-[0.12em] font-medium">{label}</span>
                </button>
              </li>
            ))}
          </ul>

          {/* status block */}
          <div className={`mt-auto w-full px-2.5 pt-3 border-t ${isDayMode ? 'border-neutral-200' : 'border-ink-700/50'}`}>
            <div className="font-mono text-[7.5px] leading-[1.7] text-neutral-500 space-y-0.5">
              <div className="uppercase tracking-widest text-neutral-600">System</div>
              <div className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${isStreaming ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'}`} />
                <span className={isStreaming ? 'text-emerald-400' : 'text-neutral-500'}>{isStreaming ? 'Streaming' : 'Paused'}</span>
              </div>
              <div className="text-neutral-600">v4.2.5-stable</div>
              <div className="text-gold-500/80">{formatFrames(frameCount)}</div>
              <div className="text-neutral-600">Frames</div>
              <div className="pt-1 text-neutral-500">Up {formatUptime(uptimeSeconds)}</div>
              <div className="pt-1 uppercase tracking-[0.15em] text-gold-600/70">by STATE</div>
            </div>
          </div>
        </nav>

        {/* ═══════════════ MAIN CONTENT ═══════════════ */}
        <div className="flex-1 flex flex-col p-4 md:p-5 gap-4 overflow-hidden relative">

          {/* PROJECTS MODAL */}
          {projectsOpen && (
            <div
              className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
              data-testid="projects-modal"
              onClick={() => setProjectsOpen(false)}
            >
              <div
                className={`w-full max-w-md mx-4 rounded-xl border p-5 space-y-3 shadow-2xl ${isDayMode ? 'bg-[#fcfbf9] border-gold-500/40 text-neutral-900' : 'bg-ink-900 border-gold-500/30 text-white'}`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-extrabold tracking-[0.25em] text-gold-500 uppercase">Projects — Saved chains</span>
                  <button onClick={() => setProjectsOpen(false)} className="font-mono text-[11px] text-neutral-500 hover:text-gold-500 cursor-pointer">[CLOSE]</button>
                </div>
                {savedChains().length === 0 ? (
                  <p className={`font-mono text-[10px] leading-relaxed ${isDayMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                    No saved chains yet. Build one in the Ai Lab (or by linking nodes on the
                    brain graph) and save it as a preset — it will appear here.
                  </p>
                ) : (
                  <ul className="space-y-2 mt-4 max-h-[60vh] overflow-y-auto pr-2">
                    {savedChains().map((c) => (
                      <li
                        key={c.savedAt}
                        className={`flex items-center justify-between p-3 rounded border cursor-pointer group ${isDayMode ? 'border-neutral-200 hover:border-gold-500 hover:bg-gold-500/5' : 'border-ink-700 hover:border-gold-500/50 hover:bg-gold-500/10'}`}
                        onClick={() => { setChainPresetToOpen(c.name); setChainOpen(true); setProjectsOpen(false); }}
                      >
                        <div className="flex flex-col">
                          <span className="font-bold text-sm tracking-wide">{c.name}</span>
                          <span className="font-mono text-[9px] text-neutral-500">{new Date(c.savedAt).toLocaleString()} • {c.enabled.length} modules</span>
                        </div>
                        <div className={`p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ${isDayMode ? 'bg-neutral-200 text-neutral-700' : 'bg-ink-800 text-white'}`}>
                          <Play className="w-3 h-3" />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          <PanelGroup direction="horizontal" autoSaveId="syntech-main-horiz" className="flex-1 flex gap-4 overflow-hidden">

            {/* LEFT & CENTER COLUMN */}
            <Panel defaultSize={74} minSize={30} className="flex flex-col overflow-hidden">
              <PanelGroup direction="vertical" autoSaveId="syntech-main-vert" className="flex flex-col gap-4">

                {/* TOP: Hero (brain graph / video) OR AI Lab OR Effect */}
                <Panel defaultSize={62} minSize={20}>
                  <div className={`w-full h-full relative rounded-2xl border ${isDayMode ? 'border-neutral-200 bg-white' : 'border-ink-700/60 bg-ink-900'} overflow-hidden flex flex-col shadow-lg`}>
                    {chainOpen ? (
                      <ChainLab
                        isDayMode={isDayMode}
                        onBack={() => setChainOpen(false)}
                        initialChain={graphChain.length > 0 ? graphChain : undefined}
                        initialPreset={chainPresetToOpen || undefined}
                        initialSource={compSource}
                        onSourcePicked={(file) => onSourceFile(file)}
                      />
                    ) : openEffectId ? (
                      <EffectHost
                        module={modules.find((m) => m.id === openEffectId) || currentModule}
                        iframeSrc={EFFECTS_REGISTRY[openEffectId].iframeSrc!}
                        isDayMode={isDayMode}
                        onBack={handleEffectClose}
                        onTelemetry={setEffectTelemetry}
                        onParams={(params) => handleEffectParams(openEffectId, params)}
                        onSendReady={(send) => { effectSendRef.current = send; }}
                        onOpenAi={() => setIsAiDrawerOpen(true)}
                      />
                    ) : (
                      <>
                        {/* background: source video if chosen, else the brain graph */}
                        {compSource ? (
                          <video
                            key={compSource.url}
                            src={compSource.url}
                            autoPlay
                            muted
                            loop
                            playsInline
                            data-testid="hero-video"
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        ) : (
                          <VfxCanvas
                            modules={modules}
                            activeModule={activeModule}
                            setActiveModule={setActiveModule}
                            onModuleOpen={handleModuleOpen}
                            signalSource={signalSource}
                            isDayMode={isDayMode}
                            isStreaming={isStreaming}
                            onChainLink={(from, to) => handleChainLink(from, to)}
                            onChainOpen={openLab}
                            onChainClear={clearChain}
                            chain={graphChain}
                          />
                        )}

                        {/* legibility gradient */}
                        <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-black/70 via-black/25 to-transparent" />

                        {/* wordmark + subtitle + actions */}
                        <div className="absolute top-7 left-8 z-10 max-w-[70%]">
                          <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tighter text-white leading-[0.92] drop-shadow-2xl">VFX</h1>
                          <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tighter hero-gradient leading-[0.98] drop-shadow-2xl">SYNTECH</h1>
                          <p className="mt-3 text-[11px] md:text-[13px] tracking-[0.18em] font-medium text-neutral-200/90 drop-shadow-md">
                            AI-Powered. Node-Based. Limitless.
                          </p>
                          <div className="flex items-center gap-3 mt-5">
                            <button
                              type="button"
                              data-testid="new-project"
                              onClick={() => { setCompEffects([]); openLab(); }}
                              className="px-4 py-2 rounded-lg bg-gold-500 text-black font-bold text-[12px] tracking-wide hover:bg-gold-400 transition-colors cursor-pointer shadow-lg"
                            >
                              New Project
                            </button>
                            <button
                              type="button"
                              data-testid="open-studio"
                              onClick={openLab}
                              className="px-4 py-2 rounded-lg border border-white/25 bg-black/30 backdrop-blur-sm text-white font-semibold text-[12px] tracking-wide hover:border-gold-500/60 hover:text-gold-300 transition-colors cursor-pointer"
                            >
                              Open Studio
                            </button>
                          </div>
                        </div>

                        {/* active output card */}
                        <div className={`absolute bottom-5 right-5 z-10 rounded-lg border px-4 py-3 backdrop-blur-md ${isDayMode ? 'bg-white/80 border-neutral-200' : 'bg-black/45 border-gold-500/25'}`}>
                          <div className="font-mono text-[8px] uppercase tracking-[0.25em] text-gold-500/80">Active Output</div>
                          <div className={`font-semibold text-sm mt-0.5 ${isDayMode ? 'text-neutral-900' : 'text-white'}`}>Main Composition</div>
                          <div className="font-mono text-[9px] text-neutral-400 mt-0.5">{outputRes} · 60fps</div>
                        </div>
                      </>
                    )}
                  </div>
                </Panel>

                <PanelResizeHandle className="h-3 flex items-center justify-center cursor-row-resize group relative z-10 shrink-0">
                  <div className={`w-12 h-1.5 rounded-full transition-colors ${isDayMode ? 'bg-neutral-300 group-hover:bg-gold-500' : 'bg-ink-700 group-hover:bg-gold-500'}`} />
                </PanelResizeHandle>

                {/* BOTTOM: Nodal Composition + AI Director */}
                <Panel defaultSize={38} minSize={15}>
                  <PanelGroup direction="horizontal" autoSaveId="syntech-bottom-horiz" className="flex gap-4">
                    <Panel defaultSize={55} minSize={20}>
                      <NodalComposition
                        isDayMode={isDayMode}
                        effects={compEffects}
                        source={compSource ? { name: compSource.name } : null}
                        onToggleEffect={toggleCompEffect}
                        onAddEffect={addCompEffect}
                        onRemoveEffect={removeCompEffect}
                        onOpenLab={openLab}
                        onPickSource={pickSource}
                      />
                    </Panel>

                    <PanelResizeHandle className="w-3 flex items-center justify-center cursor-col-resize group shrink-0">
                      <div className={`w-1.5 h-12 rounded-full transition-colors ${isDayMode ? 'bg-neutral-300 group-hover:bg-gold-500' : 'bg-ink-700 group-hover:bg-gold-500'}`} />
                    </PanelResizeHandle>

                    <Panel defaultSize={45} minSize={20}>
                      <div className={`w-full h-full rounded-2xl border ${isDayMode ? 'border-neutral-200 bg-white' : 'border-ink-700/60 bg-ink-900'} flex flex-col relative shadow-lg overflow-hidden`}>
                        <AiDirector
                          isDayMode={isDayMode}
                          currentConfig={{
                            activeModule,
                            signalSource,
                            bufferSize,
                            parameters: modules.find((m) => m.id === activeModule)?.parameters || {},
                          }}
                          onApplyPreset={(preset) => effectSendRef.current?.({ type: 'syntech:preset:apply', payload: { params: preset } })}
                        />
                      </div>
                    </Panel>
                  </PanelGroup>
                </Panel>

              </PanelGroup>
            </Panel>

            <PanelResizeHandle className="w-3 flex items-center justify-center cursor-col-resize group shrink-0">
              <div className={`w-1.5 h-12 rounded-full transition-colors ${isDayMode ? 'bg-neutral-300 group-hover:bg-gold-500' : 'bg-ink-700 group-hover:bg-gold-500'}`} />
            </PanelResizeHandle>

            {/* RIGHT SIDEBAR: Effects Library */}
            <Panel defaultSize={26} minSize={16} maxSize={40}>
              <div className={`w-full h-full rounded-2xl border flex flex-col overflow-hidden shadow-lg ${isDayMode ? 'border-neutral-200 bg-[#fbfaf7]' : 'border-ink-700/60 bg-ink-900'}`}>
                <div className={`p-4 border-b flex items-center justify-between shrink-0 ${isDayMode ? 'border-neutral-200' : 'border-ink-700/50'}`}>
                  <h2 className="font-mono text-[10px] tracking-[0.22em] text-gold-500 uppercase font-bold flex items-center gap-2">
                    <Layers className="w-3 h-3" /> Effects Library
                  </h2>
                  <span className="text-[9px] font-mono text-neutral-500">83 Systems</span>
                </div>

                {/* Search box */}
                <div className={`px-4 py-3 border-b shrink-0 ${isDayMode ? 'border-neutral-200' : 'border-ink-700/50'}`}>
                  <div className={`w-full border rounded-lg p-2.5 flex items-center gap-2 ${isDayMode ? 'bg-black/5 border-neutral-200' : 'bg-black/40 border-ink-700/70'}`}>
                    <Search className="w-3.5 h-3.5 text-neutral-500" />
                    <span className="text-[10px] font-mono text-neutral-600">Search systems...</span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3.5 space-y-3 custom-scrollbar">
                  {modules.map((module, idx) => {
                    const active = activeModule === module.id;
                    const meta = EFFECT_META[module.id];
                    return (
                      <div
                        key={module.id}
                        data-testid={`effect-card-${module.id}`}
                        onClick={() => handleModuleOpen(module.id)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          active
                            ? isDayMode ? 'border-gold-500/50 bg-gold-500/5 shadow-md' : 'border-gold-500/45 bg-gold-500/[0.07] shadow-[0_0_15px_rgba(224,180,81,0.08)]'
                            : isDayMode ? 'border-neutral-200 bg-white hover:border-gold-500/30' : 'border-ink-700/60 bg-ink-850 hover:border-gold-500/30'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2.5">
                          <span className="font-mono text-[8px] text-gold-500 uppercase tracking-widest">
                            0{idx + 1} // {module.id.replace('_', ' ')}
                          </span>
                          <span
                            onClick={(e) => toggleModuleStatus(module.id, e)}
                            title="Toggle active / standby"
                            className={`text-[8px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded cursor-pointer ${
                              module.status === 'ACTIVE'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-neutral-500/15 text-neutral-400 border border-neutral-500/25'
                            }`}
                          >
                            {module.status === 'ACTIVE' ? 'Active' : 'Standby'}
                          </span>
                        </div>
                        <div className="flex gap-3">
                          <div className="w-12 h-12 shrink-0 rounded-md border border-white/5 overflow-hidden flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${meta.color}30, ${meta.color}08)` }}>
                            <span className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
                          </div>
                          <div className="flex flex-col gap-1 min-w-0">
                            <span className={`text-sm font-bold ${isDayMode ? 'text-neutral-900' : 'text-white'}`}>{module.name}</span>
                            <p className={`text-[9px] leading-relaxed font-mono ${isDayMode ? 'text-neutral-500' : 'text-neutral-400'}`}>{module.description}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className={`p-3.5 border-t flex justify-center shrink-0 ${isDayMode ? 'border-neutral-200' : 'border-ink-700/50'}`}>
                  <button
                    onClick={openLab}
                    className="text-[10px] font-mono tracking-widest text-neutral-400 hover:text-gold-500 transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    Browse All Systems <ChevronRight className="w-3.5 h-3.5 text-gold-500" />
                  </button>
                </div>
              </div>
            </Panel>
          </PanelGroup>
        </div>
      </div>
    </div>
  );
}
