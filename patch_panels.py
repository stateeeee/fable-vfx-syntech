import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# We need to replace everything from `<div className="flex-1 flex gap-4 md:gap-6 overflow-hidden">`
# to `                </ul>\n             </div>\n          </div>\n        </div>\n      </div>\n    </div>`

start_marker = '<div className="flex-1 flex gap-4 md:gap-6 overflow-hidden">'

replacement = """<PanelGroup direction="horizontal" autoSaveId="syntech-main-horiz" className="flex-1 overflow-hidden">
          
          {/* LEFT & CENTER COLUMN */}
          <Panel defaultSize={75} minSize={40} className="flex flex-col overflow-hidden">
            <PanelGroup direction="vertical" autoSaveId="syntech-main-vert">
              {/* TOP AREA: Brain Graph / Ai Lab / Effect */}
              <Panel defaultSize={65} minSize={30}>
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

              <PanelResizeHandle className="h-4 md:h-6 flex items-center justify-center cursor-row-resize group relative z-10 shrink-0">
                <div className={`w-8 h-1.5 rounded-full transition-colors ${isDayMode ? 'bg-neutral-300 group-hover:bg-gold-500' : 'bg-[#333] group-hover:bg-gold-500'}`} />
              </PanelResizeHandle>

              {/* BOTTOM AREA: Nodal Comp + AI Director */}
              <Panel defaultSize={35} minSize={15}>
                <PanelGroup direction="horizontal" autoSaveId="syntech-bottom-horiz">
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

                  <PanelResizeHandle className="w-4 md:w-6 flex items-center justify-center cursor-col-resize group shrink-0">
                    <div className={`w-1.5 h-8 rounded-full transition-colors ${isDayMode ? 'bg-neutral-300 group-hover:bg-gold-500' : 'bg-[#333] group-hover:bg-gold-500'}`} />
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
             <div className={`w-1.5 h-8 rounded-full transition-colors ${isDayMode ? 'bg-neutral-300 group-hover:bg-gold-500' : 'bg-[#333] group-hover:bg-gold-500'}`} />
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
               
               <div className="flex-1 overflow-y-auto p-4 space-y-3">
                 {modules.map((module) => (
                   <div 
                     key={module.id}
                     onClick={() => setActiveModule(module.id)}
                     className={`p-4 rounded-xl border cursor-pointer transition-all ${
                       activeModule === module.id 
                         ? (isDayMode ? 'border-gold-500 bg-gold-500/10' : 'border-gold-500 bg-gold-500/10 shadow-[0_0_15px_rgba(220,163,75,0.15)]') 
                         : (isDayMode ? 'border-neutral-200 hover:border-gold-500/50 bg-white' : 'border-white/5 hover:border-gold-500/50 bg-[#111]')
                     }`}
                   >
                     <div className="flex justify-between items-start mb-2">
                        <span className={`font-mono text-[11px] font-bold tracking-widest ${isDayMode ? 'text-neutral-900' : 'text-white'}`}>
                          {module.name}
                        </span>
                        {activeModule === module.id && (
                          <div className="w-2 h-2 rounded-full bg-gold-500 animate-pulse" />
                        )}
                     </div>
                     <p className={`text-[10px] leading-relaxed mb-3 ${isDayMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                       {module.description}
                     </p>
                     
                     <div className="flex flex-wrap gap-1.5 mt-2">
                       {Object.keys(module.parameters || {}).slice(0, 3).map((param) => (
                         <span key={param} className={`px-1.5 py-0.5 rounded font-mono text-[8px] uppercase tracking-wider ${isDayMode ? 'bg-neutral-100 text-neutral-500' : 'bg-black/50 text-neutral-500'}`}>
                           {param}
                         </span>
                       ))}
                       {Object.keys(module.parameters || {}).length > 3 && (
                         <span className={`px-1.5 py-0.5 rounded font-mono text-[8px] uppercase tracking-wider ${isDayMode ? 'bg-neutral-100 text-neutral-500' : 'bg-black/50 text-neutral-500'}`}>
                           +{Object.keys(module.parameters || {}).length - 3}
                         </span>
                       )}
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          </Panel>
        </PanelGroup>"""

# Using regex to find the start and end of the block to replace
start_idx = content.find(start_marker)

end_marker = "                </div>\n               </div>\n            </div>\n          </div>\n        </div>\n      </div>\n    </div>\n  );\n}"
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    # Just up to the div closure of right sidebar
    # We will replace from start_idx to the end of the flex-1 container
    right_sidebar_end_marker = "               </div>\n            </div>\n          </div>\n"
    right_idx = content.find(right_sidebar_end_marker, start_idx)
    if right_idx != -1:
        new_content = content[:start_idx] + replacement + content[right_idx + len(right_sidebar_end_marker):]
        with open('src/App.tsx', 'w') as f:
            f.write(new_content)
        print("Patched successfully")
    else:
        print("Could not find right sidebar end")
else:
    print("Markers not found")

