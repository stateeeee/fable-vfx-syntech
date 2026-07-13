import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  Layers, 
  Sliders, 
  Settings, 
  Zap, 
  Radio, 
  Cpu, 
  Lock, 
  Unlock, 
  RefreshCw, 
  Play, 
  Square,
  Volume2,
  SlidersHorizontal,
  Info,
  Sparkle,
  Send,
  Bot,
  Lightbulb,
  Sun,
  Moon
} from 'lucide-react';
import { ModuleConfig, ModuleId, ActiveTab, SignalSource } from './types';
import { EffectTelemetry, ParamSchema, ShellMessage } from './bridge/types';
import { EFFECTS_REGISTRY, hasRealEffect } from './effects-registry';
import VfxCanvas from './components/VfxCanvas';
import DiagnosticsPanel from './components/DiagnosticsPanel';
import EffectHost from './components/EffectHost';
import ChainLab from './components/ChainLab';
import AiDirector from './components/AiDirector';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Home as HomeIcon, Save as SaveIcon, Folder as FolderIcon, Sparkles as AiIcon } from 'lucide-react';

// explicit session snapshot for the SAVE nav action (decision #9: localStorage)
const SESSION_KEY = 'syntech.session';
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

  // Signal chain built by linking hub nodes on the brain graph (phase 5):
  // dragging hub A onto hub B appends the link; the chain persists per-browser
  const [graphChain, setGraphChain] = useState<ModuleId[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('syntech.graphChain') ?? '[]');
      return Array.isArray(saved) ? saved.filter((id) => id in EFFECTS_REGISTRY) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try { localStorage.setItem('syntech.graphChain', JSON.stringify(graphChain)); } catch { /* private mode */ }
  }, [graphChain]);

  const handleChainLink = (from: ModuleId, to: ModuleId) => {
    if (from === to) return;
    setGraphChain((prev) => {
      // extend the chain when the drag starts from its tail; otherwise start over
      if (prev.length && prev[prev.length - 1] === from && !prev.includes(to)) return [...prev, to];
      return [from, to];
    });
  };
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

  // The effect declared its real ParamSchema: swap the module's placeholder
  // parameters for the real ones so Gemini and the shell operate on truth.
  // Booleans are mapped to 0/1 sliders so AI presets can flip them too.
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
  const [hoveredMode, setHoveredMode] = useState<'art_director' | 'agent' | 'optimizer' | null>(null);
  const [geminiResponse, setGeminiResponse] = useState<string | null>(null);
  const [isProcessingGemini, setIsProcessingGemini] = useState(false);
  const [suggestedPreset, setSuggestedPreset] = useState<any | null>(null);

  // Apply a parameter preset suggested by Gemini AI: update the shell state
  // and forward it through the bridge so the open effect changes for real
  const handleApplyPreset = (preset: any) => {
    if (!preset) return;
    setModules((prev) =>
      prev.map((m) => {
        if (m.id === activeModule) {
          const updatedParameters = { ...m.parameters };
          let updated = false;
          for (const key of Object.keys(preset)) {
            if (updatedParameters[key]) {
              updatedParameters[key] = {
                ...updatedParameters[key],
                value: Number(preset[key])
              };
              updated = true;
            }
          }
          if (updated) {
            return { ...m, parameters: updatedParameters };
          }
        }
        return m;
      })
    );
    effectSendRef.current?.({ type: 'syntech:preset:apply', payload: { params: preset } });
  };

  const handleSendToGemini = async () => {
    if (isProcessingGemini) return;
    const promptToSend = geminiPrompt.trim();
    
    if (!activeGeminiMode) {
      setGeminiResponse("Please select a Gemini pathway (Art Director, Agent, or AI Optimizer) first.");
      return;
    }

    setIsProcessingGemini(true);
    setGeminiResponse(null);
    setSuggestedPreset(null);

    try {
      if (activeGeminiMode === 'art_director') {
        const response = await fetch('/api/gemini/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activeModule,
            parameters: currentModule.parameters,
            prompt: promptToSend
          })
        });
        const data = await response.json();
        if (data.analysis) {
          setGeminiResponse(data.analysis + (data.isFallback ? " (Local Backup)" : ""));
        } else {
          setGeminiResponse("No analysis returned from the cognitive model.");
        }
      } else if (activeGeminiMode === 'optimizer') {
        const response = await fetch('/api/gemini/optimize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activeModule,
            parameters: currentModule.parameters,
            prompt: promptToSend
          })
        });
        const data = await response.json();
        if (data.preset) {
          setSuggestedPreset(data.preset);
          handleApplyPreset(data.preset);
          if (data.isFallback) {
            setGeminiResponse("Optimization system offline. Loaded mathematical local optimal presets instead.");
          } else {
            setGeminiResponse(`Optimized parameter map calculated and applied automatically for module "${currentModule.name}".`);
          }
        } else {
          setGeminiResponse("Optimization model was unable to generate a valid parameter map.");
        }
      } else if (activeGeminiMode === 'agent') {
        // Chatbot / agent pathway
        const msg = promptToSend || "Analyze current VFX configuration and suggest a dramatic preset.";
        const response = await fetch('/api/gemini/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: msg,
            history: [],
            currentConfig: {
              activeModule,
              parameters: currentModule.parameters
            }
          })
        });
        const data = await response.json();
        if (response.ok) {
          setGeminiResponse(data.reply);
          if (data.preset) {
            setSuggestedPreset(data.preset);
          }
        } else {
          setGeminiResponse(`Agent node reported an error: ${data.error || 'Server rejected request'}`);
        }
      }
      setGeminiPrompt('');
    } catch (err: any) {
      console.error("Gemini Core execution failed:", err);
      setGeminiResponse(`Neural link interrupted: ${err.message || 'connection failure'}`);
    } finally {
      setIsProcessingGemini(false);
    }
  };

  // Dynamic ticking metrics
  const [frameCount, setFrameCount] = useState(0);
  const [uptimeSeconds, setUptimeSeconds] = useState(0); // starts at zero as a real-time stopwatch
  const [simulatedLatency, setSimulatedLatency] = useState(1.2);

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
      // Tick frames up rapidly at ~60fps
      frameTimer = window.setInterval(() => {
        setFrameCount((prev) => prev + Math.floor(Math.random() * 2) + 1);
      }, 16);

      // Tick uptime clock
      clockTimer = window.setInterval(() => {
        setUptimeSeconds((prev) => prev + 1);
        // Vary latency slightly
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

  // Format uptime (seconds -> hh:mm:ss)
  const formatUptime = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return [
      hrs.toString().padStart(2, '0'),
      mins.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].join(':');
  };

  // Format frame count with comma separators
  const formatFrames = (frames: number) => {
    return frames.toLocaleString('en-US');
  };

  // Toggle active/standby module state
  const toggleModuleStatus = (id: ModuleId, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the module just by clicking toggle
    setModules((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          const nextStatus = m.status === 'ACTIVE' ? 'STANDBY' : 'ACTIVE';
          return { ...m, status: nextStatus };
        }
        return m;
      })
    );
  };

  // Change individual parameter slider value
  const handleParameterChange = (moduleId: ModuleId, paramKey: string, newValue: number) => {
    setModules((prev) =>
      prev.map((m) => {
        if (m.id === moduleId) {
          return {
            ...m,
            parameters: {
              ...m.parameters,
              [paramKey]: {
                ...m.parameters[paramKey],
                value: newValue,
              },
            },
          };
        }
        return m;
      })
    );
  };

  // Quick preset selections for buffer size
  const handleBufferSizeChange = (size: number) => {
    setBufferSize(size);
  };

  return (
    <div className={`h-screen w-screen transition-colors duration-300 ${isDayMode ? 'bg-[#fcfbf9] text-neutral-900' : 'bg-[#050505] text-white'} flex font-sans overflow-hidden`}>
      
      {/* LEFT SIDEBAR */}
      <nav className={`w-[90px] shrink-0 flex flex-col items-center py-6 border-r transition-colors duration-300 ${isDayMode ? 'border-gold-500/10 bg-[#f7f5f0]' : 'border-[#111] bg-[#080808]'} gap-8 z-20`}>
        <div className="w-10 h-10 border-2 border-gold-500 rotate-45 flex items-center justify-center shrink-0 mb-4">
          <span className="text-gold-500 font-bold -rotate-45 text-xs">VS</span>
        </div>
        
        <ul className={`flex flex-col gap-8 w-full items-center text-[9px] uppercase tracking-widest font-medium transition-colors ${isDayMode ? 'text-neutral-500' : 'text-neutral-500'}`}>
          <li
            className={`flex flex-col items-center gap-2 cursor-pointer transition-colors ${!chainOpen && !openEffectId ? 'text-gold-500' : isDayMode ? 'hover:text-black' : 'hover:text-white'}`}
            onClick={() => { setChainOpen(false); handleEffectClose(); }}
          >
            <div className={`p-2 rounded-xl transition-colors ${!chainOpen && !openEffectId ? (isDayMode ? 'bg-gold-500/10' : 'bg-gold-500/10') : ''}`}>
               <HomeIcon className="w-5 h-5" />
            </div>
            <span>Home</span>
          </li>
          <li
            className={`flex flex-col items-center gap-2 cursor-pointer transition-colors ${savedFlash ? 'text-gold-500' : isDayMode ? 'hover:text-black' : 'hover:text-white'}`}
            onClick={handleSaveSession}
            title="Save the current session (module, theme) to this browser"
          >
            <div className={`p-2 rounded-xl transition-colors ${savedFlash ? 'bg-gold-500/10' : ''}`}>
               <SaveIcon className="w-5 h-5" />
            </div>
            <span>{savedFlash ? 'Saved' : 'Save'}</span>
          </li>
          <li
            className={`flex flex-col items-center gap-2 cursor-pointer transition-colors ${projectsOpen ? 'text-gold-500' : isDayMode ? 'hover:text-black' : 'hover:text-white'}`}
            onClick={() => setProjectsOpen(true)}
            title="Saved effect chains"
          >
            <div className={`p-2 rounded-xl transition-colors ${projectsOpen ? 'bg-gold-500/10' : ''}`}>
               <FolderIcon className="w-5 h-5" />
            </div>
            <span>Projects</span>
          </li>
          <li
            className={`flex flex-col items-center gap-2 cursor-pointer transition-colors ${chainOpen ? 'text-gold-500' : isDayMode ? 'hover:text-black' : 'hover:text-white'}`}
            onClick={() => { handleEffectClose(); setChainOpen(true); }}
          >
            <div className={`p-2 rounded-xl transition-colors ${chainOpen ? 'bg-gold-500/10' : ''}`}>
               <AiIcon className="w-5 h-5" />
            </div>
            <span>Ai Lab</span>
          </li>
        </ul>
      </nav>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col p-4 md:p-6 gap-4 md:gap-6 overflow-hidden relative">
        
        {/* PROJECTS MODAL */}
        {projectsOpen && (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            data-testid="projects-modal"
            onClick={() => setProjectsOpen(false)}
          >
            <div
              className={`w-full max-w-md mx-4 rounded-xl border p-5 space-y-3 shadow-2xl ${isDayMode ? 'bg-[#fcfbf9] border-gold-500/40 text-neutral-900' : 'bg-[#0a0a0a] border-gold-500/30 text-white'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-extrabold tracking-[0.25em] text-gold-500 uppercase">Projects — Saved chains</span>
                <button
                  onClick={() => setProjectsOpen(false)}
                  className="font-mono text-[11px] text-neutral-500 hover:text-gold-500 cursor-pointer"
                >
                  [CLOSE]
                </button>
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
                      className={`flex items-center justify-between p-3 rounded border cursor-pointer group ${isDayMode ? 'border-neutral-200 hover:border-gold-500 hover:bg-gold-500/5' : 'border-[#222] hover:border-gold-500/50 hover:bg-gold-500/10'}`}
                      onClick={() => {
                        setChainPresetToOpen(c.name);
                        setChainOpen(true);
                        setProjectsOpen(false);
                      }}
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-sm tracking-wide">{c.name}</span>
                        <span className="font-mono text-[9px] text-neutral-500">
                          {new Date(c.savedAt).toLocaleString()} • {c.enabled.length} modules
                        </span>
                      </div>
                      <div className={`p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ${isDayMode ? 'bg-neutral-200 text-neutral-700' : 'bg-[#333] text-white'}`}>
                        <Play className="w-3 h-3" />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}


        <PanelGroup direction="horizontal" autoSaveId="syntech-main-horiz" className="flex-1 flex gap-4 md:gap-6 overflow-hidden">
          
          {/* LEFT & CENTER COLUMN */}
          <Panel defaultSize={75} minSize={30} className="flex flex-col overflow-hidden">
            <PanelGroup direction="vertical" autoSaveId="syntech-main-vert" className="flex flex-col gap-4 md:gap-6">
              {/* TOP AREA: Brain Graph / Ai Lab / Effect */}
              <Panel defaultSize={65} minSize={20}>
                <div className={`w-full h-full relative rounded-2xl border ${isDayMode ? 'border-neutral-200 bg-white' : 'border-[#1a1a1a] bg-[#050505]'} overflow-hidden flex flex-col shadow-lg`}>
                  
                  {chainOpen ? (
                    <ChainLab
                      isDayMode={isDayMode}
                      onBack={() => setChainOpen(false)}
                      initialChain={graphChain.length > 0 ? graphChain : undefined}
                      initialPreset={chainPresetToOpen || undefined}
                    />
                  ) : openEffectId ? (
                    <EffectHost
                      module={modules.find((m) => m.id === openEffectId) || currentModule}
                      iframeSrc={EFFECTS_REGISTRY[openEffectId].iframeSrc}
                      isDayMode={isDayMode}
                      onBack={handleEffectClose}
                      onTelemetry={setEffectTelemetry}
                      onParams={(params) => handleEffectParams(openEffectId, params)}
                      onSendReady={(send) => { effectSendRef.current = send; }}
                      onOpenAi={() => setIsAiDrawerOpen(true)}
                    />
                  ) : (
                    <>
                      <div className="absolute top-10 left-10 z-10 pointer-events-none">
                        <h1 className="text-6xl md:text-8xl font-bold tracking-tighter text-white leading-none drop-shadow-2xl">
                          VFX
                        </h1>
                        <h1 className="text-6xl md:text-8xl font-bold tracking-tighter bg-gradient-to-r from-[#ffe5a1] via-[#dca34b] to-[#7b51b7] text-transparent bg-clip-text leading-tight drop-shadow-2xl">
                          SYNTECH
                        </h1>
                        <p className="mt-4 text-[11px] md:text-sm tracking-[0.2em] font-medium text-neutral-200 drop-shadow-md">
                          AI-Powered. Node-Based. Limitless.
                        </p>
                      </div>
                      
                      <VfxCanvas
                        modules={modules}
                        activeModule={activeModule}
                        setActiveModule={setActiveModule}
                        onModuleOpen={handleModuleOpen}
                        signalSource={signalSource}
                        isDayMode={isDayMode}
                        isStreaming={isStreaming}
                        onChainLink={(from, to) => { handleChainLink(from, to); }}
                        onChainOpen={() => { handleEffectClose(); setChainOpen(true); }}
                        chain={graphChain}
                      />
                    </>
                  )}
                </div>
              </Panel>

              <PanelResizeHandle className="h-4 flex items-center justify-center cursor-row-resize group relative z-10 shrink-0">
                <div className={`w-12 h-1.5 rounded-full transition-colors ${isDayMode ? 'bg-neutral-300 group-hover:bg-gold-500' : 'bg-[#333] group-hover:bg-gold-500'}`} />
              </PanelResizeHandle>

              {/* BOTTOM AREA: Nodal Comp + AI Director */}
              <Panel defaultSize={35} minSize={15}>
                <PanelGroup direction="horizontal" autoSaveId="syntech-bottom-horiz" className="flex gap-4 md:gap-6">
                  {/* Nodal Composition */}
                  <Panel defaultSize={55} minSize={20}>
                    <div className={`w-full h-full rounded-2xl border ${isDayMode ? 'border-neutral-200 bg-[#fbfaf7]' : 'border-[#1a1a1a] bg-[#0a0a0a]'} flex items-center justify-center relative shadow-inner overflow-hidden`}>
                      <div className="absolute top-4 left-5 flex items-center justify-between w-[calc(100%-40px)]">
                        <span className="font-mono text-[10px] tracking-[0.25em] text-gold-500 uppercase font-bold">Nodal Composition</span>
                        <div className="flex items-center gap-4 text-[9px] font-mono text-neutral-500">
                          <span>Q 100% v</span>
                          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border border-neutral-700 flex items-center justify-center">+</span> Add Node</span>
                        </div>
                      </div>
                      <span className="font-mono text-xs tracking-widest text-neutral-600 uppercase font-bold animate-pulse">
                        Nodal Composition Loading...
                      </span>
                    </div>
                  </Panel>

                  <PanelResizeHandle className="w-4 flex items-center justify-center cursor-col-resize group shrink-0">
                    <div className={`w-1.5 h-12 rounded-full transition-colors ${isDayMode ? 'bg-neutral-300 group-hover:bg-gold-500' : 'bg-[#333] group-hover:bg-gold-500'}`} />
                  </PanelResizeHandle>
                  
                  {/* AI Director */}
                  <Panel defaultSize={45} minSize={20}>
                    <div className={`w-full h-full rounded-2xl border ${isDayMode ? 'border-neutral-200 bg-white' : 'border-[#1a1a1a] bg-[#0a0a0a]'} flex flex-col relative shadow-lg overflow-hidden`}>
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
          
          <PanelResizeHandle className="w-4 md:w-6 flex items-center justify-center cursor-col-resize group shrink-0">
             <div className={`w-1.5 h-12 rounded-full transition-colors ${isDayMode ? 'bg-neutral-300 group-hover:bg-gold-500' : 'bg-[#333] group-hover:bg-gold-500'}`} />
          </PanelResizeHandle>

          {/* RIGHT SIDEBAR: Effects Library */}
          <Panel defaultSize={25} minSize={15} maxSize={40}>
            <div className={`w-full h-full rounded-2xl border flex flex-col overflow-hidden shadow-lg ${isDayMode ? 'border-neutral-200 bg-[#fbfaf7]' : 'border-[#1a1a1a] bg-[#080808]'}`}>
               <div className="p-5 border-b border-white/5 flex items-center justify-between shrink-0">
                 <h2 className="font-mono text-[10px] tracking-[0.25em] text-gold-500 uppercase font-bold flex items-center gap-2">
                   <Layers className="w-3 h-3" /> Effects Library
                 </h2>
                 <span className="text-[9px] font-mono text-neutral-500">05 Systems</span>
               </div>
               
               {/* Search box placeholder */}
               <div className="px-4 py-3 border-b border-white/5 shrink-0">
                 <div className={`w-full ${isDayMode ? 'bg-black/5 border-neutral-200' : 'bg-black/40 border-white/10'} border rounded-lg p-2.5 flex items-center gap-2`}>
                   <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-500"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                   <span className="text-[10px] font-mono text-neutral-600">Search systems...</span>
                 </div>
               </div>
               
               <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                  {modules.map((module, idx) => (
                    <div
                      key={module.id}
                      onClick={() => handleModuleOpen(module.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        activeModule === module.id
                          ? isDayMode
                            ? 'border-gold-500/50 bg-gold-500/5 shadow-md'
                            : 'border-gold-500/40 bg-gold-500/10 shadow-[0_0_15px_rgba(234,179,8,0.1)]'
                          : isDayMode
                          ? 'border-neutral-200 bg-white hover:border-gold-500/30'
                          : 'border-[#222] bg-[#111] hover:border-gold-500/30'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <span className="font-mono text-[8px] text-gold-500 uppercase tracking-widest">
                          0{idx + 1} // {module.id.replace('_', ' ')}
                        </span>
                        <span
                          className={`text-[8px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded ${
                            hasRealEffect(module.id)
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-neutral-500/20 text-neutral-400 border border-neutral-500/30'
                          }`}
                        >
                          {hasRealEffect(module.id) ? 'Active' : 'Standby'}
                        </span>
                      </div>
                      <div className="flex gap-3">
                        <div className="w-12 h-12 shrink-0 rounded bg-black/50 border border-white/5 overflow-hidden flex items-center justify-center">
                           <div className={`w-full h-full bg-gradient-to-br ${module.id === 'blob_tracker' ? 'from-amber-500/20 to-orange-500/5' : module.id === 'analog' ? 'from-blue-500/20 to-purple-500/5' : 'from-pink-500/20 to-rose-500/5'}`}></div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className={`text-sm font-bold ${isDayMode ? 'text-neutral-900' : 'text-white'}`}>
                            {module.name}
                          </span>
                          <p className={`text-[9px] leading-relaxed font-mono ${isDayMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                            {module.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
               </div>
               
               <div className="p-4 border-t border-white/5 flex justify-center shrink-0">
                 <button className="text-[10px] font-mono tracking-widest text-neutral-400 hover:text-white transition-colors flex items-center gap-2 cursor-pointer">
                   Browse All Systems <span className="text-gold-500">→</span>
                 </button>
               </div>
            </div>
          </Panel>
        </PanelGroup>

        {/* MULTI-PARAMETER FOOTER STATUS BAR */}
        <div className={`border-t py-2 px-6 flex items-center justify-between text-[9px] font-mono mt-auto gap-4 ${
          isDayMode ? 'border-neutral-200 bg-[#f7f5f0] text-neutral-500' : 'border-white/5 bg-[#030303] text-neutral-400'
        }`}>
          {/* Left section: Live Streaming Indicator & Uptime Chronometer */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="uppercase tracking-[0.15em] font-bold text-neutral-400">
                LIVE STREAMING
              </span>
            </div>
            <div className="w-px h-2.5 bg-neutral-800"></div>
            <div className="flex items-center gap-1.5">
              <span className="text-neutral-500">TIME:</span>
              <span className="text-gold-500 font-bold tracking-wider">{formatUptime(uptimeSeconds)}</span>
            </div>
          </div>

          {/* Right section: Brand / Created By State */}
          <div className="text-right flex items-center gap-1">
            <span className="text-neutral-500">VFX SYNTECH 2026</span>
            <span className="text-neutral-600">//</span>
            <span className="uppercase tracking-[0.2em] font-extrabold text-gold-500">
              CREATED BY STATE
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
