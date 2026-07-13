import re

with open('src/App.tsx', 'r') as f:
    lines = f.readlines()

main_return_idx = -1
for i, line in enumerate(lines):
    if line.startswith("  return (") and i > 400:
        main_return_idx = i
        break

if main_return_idx == -1:
    print("Could not find main return")
    exit(1)

pre_return = "".join(lines[:main_return_idx])

if "import AiDirector" not in pre_return:
    pre_return = pre_return.replace("import ChainLab from './components/ChainLab';", "import ChainLab from './components/ChainLab';\nimport AiDirector from './components/AiDirector';\nimport { Home as HomeIcon, Save as SaveIcon, Folder as FolderIcon, Sparkles as AiIcon } from 'lucide-react';")

new_return = """  return (
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

        <div className="flex-1 flex gap-4 md:gap-6 overflow-hidden">
          
          {/* LEFT & CENTER COLUMN (Brain Graph + Nodal Comp + AI Director) */}
          <div className="flex-[2.5] flex flex-col gap-4 md:gap-6 overflow-hidden">
            
            {/* TOP AREA: Brain Graph / Ai Lab / Effect */}
            <div className={`flex-[1.8] relative rounded-2xl border ${isDayMode ? 'border-neutral-200 bg-white' : 'border-[#1a1a1a] bg-[#050505]'} overflow-hidden flex flex-col shadow-lg`}>
              
              {chainOpen ? (
                <ChainLab
                  isDayMode={isDayMode}
                  onBack={() => setChainOpen(false)}
                  initialChain={graphChain.length > 0 ? graphChain : undefined}
                  initialPreset={chainPresetToOpen || undefined}
                />
              ) : openEffectId ? (
                <EffectHost
                  moduleId={openEffectId}
                  isDayMode={isDayMode}
                  onClose={handleEffectClose}
                  onTelemetry={setEffectTelemetry}
                  onRegisterSend={(send) => (effectSendRef.current = send)}
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
                    onModuleSelect={handleModuleOpen}
                    isDayMode={isDayMode}
                    isStreaming={isStreaming}
                    onChainLink={(from, to) => { handleChainLink(from, to); }}
                    onChainOpen={() => { handleEffectClose(); setChainOpen(true); }}
                    graphChain={graphChain}
                    onClearChain={() => setGraphChain([])}
                  />
                </>
              )}
            </div>

            {/* BOTTOM AREA: Nodal Comp + AI Director */}
            <div className="flex-1 min-h-[250px] flex gap-4 md:gap-6">
              {/* Nodal Composition */}
              <div className={`flex-[1.5] rounded-2xl border ${isDayMode ? 'border-neutral-200 bg-[#fbfaf7]' : 'border-[#1a1a1a] bg-[#0a0a0a]'} flex items-center justify-center relative shadow-inner overflow-hidden`}>
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
              
              {/* AI Director */}
              <div className={`flex-[1.2] rounded-2xl border ${isDayMode ? 'border-neutral-200 bg-white' : 'border-[#1a1a1a] bg-[#0a0a0a]'} flex flex-col relative shadow-lg overflow-hidden`}>
                 <AiDirector 
                   currentConfig={{
                     activeModule,
                     signalSource,
                     bufferSize,
                     parameters: modules.find((m) => m.id === activeModule)?.parameters || {},
                   }}
                   onApplyPreset={(preset) => effectSendRef.current?.({ type: 'preset:apply', preset })}
                 />
              </div>
            </div>
          </div>

          {/* RIGHT SIDEBAR: Effects Library */}
          <div className={`w-[280px] md:w-[320px] shrink-0 rounded-2xl border flex flex-col overflow-hidden shadow-lg ${isDayMode ? 'border-neutral-200 bg-[#fbfaf7]' : 'border-[#1a1a1a] bg-[#080808]'}`}>
             <div className="p-5 border-b border-white/5 flex items-center justify-between">
               <h2 className="font-mono text-[10px] tracking-[0.25em] text-gold-500 uppercase font-bold flex items-center gap-2">
                 <Layers className="w-3 h-3" /> Effects Library
               </h2>
               <span className="text-[9px] font-mono text-neutral-500">03 Systems</span>
             </div>
             
             {/* Search box placeholder */}
             <div className="px-4 py-3 border-b border-white/5">
               <div className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 flex items-center gap-2">
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
             
             <div className="p-4 border-t border-white/5 flex justify-center">
               <button className="text-[10px] font-mono tracking-widest text-neutral-400 hover:text-white transition-colors flex items-center gap-2 cursor-pointer">
                 Browse All Systems <span className="text-gold-500">→</span>
               </button>
             </div>
          </div>

        </div>

        {/* COMPACT FOOTER */}
        <div className={`flex justify-center border-t pt-1 pb-1 mt-auto ${isDayMode ? 'border-neutral-200' : 'border-white/5'}`}>
          <span className="font-mono text-[9px] uppercase tracking-[0.4em] text-neutral-500">
            CREATED BY STATE
          </span>
        </div>

      </div>
    </div>
  );
}
"""

with open('src/App.tsx', 'w') as f:
    f.write(pre_return + new_return)

