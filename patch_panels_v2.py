with open('src/App.tsx', 'r') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    if "import { Home as HomeIcon" in line:
        new_lines.append("import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';\n")
    new_lines.append(line)

lines = new_lines

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if '<div className="flex-1 flex gap-4 md:gap-6 overflow-hidden">' in line:
        start_idx = i
        break

for i in range(start_idx + 1, len(lines)):
    if '{/* COMPACT FOOTER */}' in lines[i]:
        end_idx = i - 1 # the empty line or div before footer
        # let's backtrack to find the exact </div> that closes the flex-1 flex gap-4
        while '</div>' not in lines[end_idx]:
            end_idx -= 1
        break

print(f"Replacing from line {start_idx} to {end_idx}")

replacement = """
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
                 <span className="text-[9px] font-mono text-neutral-500">03 Systems</span>
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
        </PanelGroup>\n"""

if start_idx != -1 and end_idx != -1:
    final_lines = lines[:start_idx] + [replacement] + lines[end_idx+1:]
    with open('src/App.tsx', 'w') as f:
        f.writelines(final_lines)
    print("Patched successfully!")
else:
    print("Failed to find boundaries")
