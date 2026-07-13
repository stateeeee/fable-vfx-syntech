import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Bot,
  RefreshCw,
  Cpu,
  Lightbulb,
  ChevronRight,
} from 'lucide-react';
import Markdown from 'react-markdown';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  presetSuggested?: any;
}

interface AiDirectorProps {
  isDayMode?: boolean;
  currentConfig: {
    activeModule: string;
    signalSource: string;
    bufferSize: number;
    parameters: any;
  };
  onApplyPreset: (preset: any) => void;
}

// module-specific default suggestion prompts (used before Gemini replies)
const DEFAULT_SUGGESTIONS: Record<string, string[]> = {
  blob_tracker: ['Increase Blob Tracker sensitivity', 'Add fluid dynamics turbulence', 'Boost cellular density glow'],
  analog: ['Add Analog sync jitter', 'Warm the CRT phosphor bloom', 'Increase chromatic aberration'],
  blob_reveal: ['Soften the reveal mask edges', 'Pulse the mask with the audio', 'Raise reveal threshold'],
  bokeh: ['Enhance Bokeh depth falloff', 'Widen the aperture disks', 'Add anamorphic squeeze'],
  anamorphic_lab: ['Stretch the horizontal flares', 'Add film halation glow', 'Increase diffraction streaks'],
};

export default function AiDirector({ currentConfig, onApplyPreset, isDayMode }: AiDirectorProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      text: `I've analyzed your composition. The audio shows strong low-mid frequencies that would benefit from enhanced depth mapping and organic distortion. Select a suggestion or write a custom directive to begin.`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Consulting core index...');
  const [showThread, setShowThread] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (showThread) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, showThread]);

  useEffect(() => {
    if (!isLoading) return;
    const phrases = [
      'Accessing vault index...',
      'Decompressing node vectors...',
      'Synthesizing parameters...',
      'Consulting Gemini models...',
      'Finalizing neural prediction...',
    ];
    let i = 0;
    const interval = setInterval(() => { i = (i + 1) % phrases.length; setLoadingText(phrases[i]); }, 1500);
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;
    const userMsg: Message = { id: `msg_${Date.now()}`, role: 'user', text: textToSend, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const historyPayload = messages.map((m) => ({ role: m.role, text: m.text }));
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          history: historyPayload,
          currentConfig: {
            activeModule: currentConfig.activeModule,
            signalSource: currentConfig.signalSource,
            bufferSize: currentConfig.bufferSize,
            parameters: currentConfig.parameters,
          },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => [
          ...prev,
          { id: `msg_${Date.now() + 1}`, role: 'model', text: data.reply, timestamp: new Date(), presetSuggested: data.preset },
        ]);
      } else {
        throw new Error(data.error || 'Server rejected request');
      }
    } catch (err: any) {
      console.error('AI chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_err_${Date.now()}`,
          role: 'model',
          text: `⚠️ **Neural Link Interruption**: Failed to complete server-side prompt proxy. Please ensure your \`GEMINI_API_KEY\` is configured. \n\n*Error: ${err.message || 'Unknown network failure'}*`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const latestModel = [...messages].reverse().find((m) => m.role === 'model');
  const latestPreset = latestModel?.presetSuggested;
  const analysisText = (latestModel?.text || '').split('PRESET:')[0].trim();

  // suggestion bullets: parameter-preset entries if Gemini returned any,
  // otherwise the module's default creative directives
  const presetSuggestions: string[] = latestPreset
    ? Object.entries(latestPreset).map(([k, v]) => `Set ${k.replace(/([A-Z])/g, ' $1').trim()} → ${v}`)
    : [];
  const moduleSuggestions = DEFAULT_SUGGESTIONS[currentConfig.activeModule] || DEFAULT_SUGGESTIONS.blob_tracker;

  const handleApplyAll = () => {
    if (latestPreset) {
      onApplyPreset(latestPreset);
      return;
    }
    // no preset yet — ask Gemini to optimize the active module and apply it
    handleSendMessage(
      `Optimize the settings of the active module "${currentConfig.activeModule}" to maximize its visual density and output intensity. Generate preset.`
    );
  };

  const panelInk = isDayMode ? 'bg-[#fbfaf7]' : 'bg-ink-900';
  const subInk = isDayMode ? 'text-neutral-500' : 'text-neutral-400';

  return (
    <div className={`flex-1 flex flex-col h-full w-full overflow-hidden ${panelInk}`}>
      {/* Header */}
      <div className={`px-4 py-3 border-b flex items-center justify-between shrink-0 ${isDayMode ? 'border-neutral-200 bg-white' : 'border-ink-700/50 bg-ink-950'}`}>
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 border border-gold-500/60 rotate-45 flex items-center justify-center shrink-0 rounded-[6px] bg-gold-500/5">
            <Sparkles className="w-3 h-3 text-gold-500 -rotate-45" />
          </div>
          <h2 className="text-[11px] tracking-[0.22em] font-mono text-gold-500 uppercase font-bold">AI Director</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[9px] font-mono ${isDayMode ? 'text-[#7b51b7]' : 'text-violet-400'}`}>Gemini AI</span>
          <span className="flex items-center gap-1 text-[8px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Active
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-4 custom-scrollbar">
        {/* Scene Analysis */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Bot className="w-3 h-3 text-gold-500" />
            <span className="font-mono text-[10px] font-bold tracking-widest uppercase text-gold-500">Scene Analysis</span>
          </div>
          <div className={`markdown-body font-mono text-[11px] leading-relaxed ${isDayMode ? 'text-neutral-700' : 'text-neutral-300'}`}>
            {isLoading ? (
              <span className="flex items-center gap-2 text-gold-500/80">
                <RefreshCw className="w-3 h-3 animate-spin" /> {loadingText}
              </span>
            ) : (
              <Markdown>{analysisText || 'Awaiting signal analysis…'}</Markdown>
            )}
          </div>
        </div>

        {/* Suggestions */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Lightbulb className="w-3 h-3 text-violet-400" />
            <span className={`font-mono text-[10px] font-bold tracking-widest uppercase ${isDayMode ? 'text-[#7b51b7]' : 'text-violet-400'}`}>Suggestions</span>
          </div>
          <ul className="space-y-1.5">
            {(presetSuggestions.length ? presetSuggestions : moduleSuggestions).map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => (presetSuggestions.length ? handleApplyAll() : handleSendMessage(`${s} for the "${currentConfig.activeModule}" module. Generate preset.`))}
                  className={`w-full flex items-start gap-2 text-left font-mono text-[10px] leading-snug px-2 py-1.5 rounded-md border transition-colors cursor-pointer disabled:opacity-40 ${
                    isDayMode ? 'border-neutral-200 hover:border-gold-500/40 hover:bg-gold-500/5 text-neutral-700' : 'border-ink-700/60 hover:border-gold-500/40 hover:bg-gold-500/[0.06] text-neutral-300'
                  }`}
                >
                  <ChevronRight className="w-3 h-3 text-gold-500 shrink-0 mt-[1px]" />
                  <span>{s}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* full conversation (collapsed by default to keep the panel scannable) */}
        {messages.length > 1 && (
          <div>
            <button
              type="button"
              onClick={() => setShowThread((v) => !v)}
              className={`font-mono text-[9px] uppercase tracking-widest ${subInk} hover:text-gold-500 cursor-pointer`}
            >
              {showThread ? '▾ Hide' : '▸ Show'} full transcript ({messages.length})
            </button>
            {showThread && (
              <div className="mt-2 space-y-2.5">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-2 ${msg.role === 'model' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[88%] p-2.5 rounded-lg border font-mono text-[10px] leading-relaxed ${
                      msg.role === 'model'
                        ? (isDayMode ? 'bg-white border-neutral-200 text-neutral-700' : 'bg-black/40 border-ink-700/60 text-neutral-300')
                        : (isDayMode ? 'bg-gold-500/10 border-gold-500/30 text-gold-800' : 'bg-gold-500/10 border-gold-500/30 text-gold-200')
                    }`}>
                      <div className="markdown-body"><Markdown>{msg.text.split('PRESET:')[0]}</Markdown></div>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Apply All */}
      <div className={`px-4 py-2.5 border-t shrink-0 ${isDayMode ? 'border-neutral-200 bg-[#f5f4f0]' : 'border-ink-700/50 bg-ink-950'}`}>
        <button
          type="button"
          data-testid="apply-all"
          onClick={handleApplyAll}
          disabled={isLoading}
          className="w-full px-3 py-2 bg-gold-500 text-black font-extrabold text-[10px] tracking-wider uppercase rounded-md hover:bg-gold-400 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
        >
          <Cpu className="w-3.5 h-3.5" /> Apply All Suggestions
        </button>
      </div>

      {/* Input bar (chat preserved) */}
      <div className={`p-3 border-t shrink-0 ${isDayMode ? 'border-neutral-200 bg-white' : 'border-ink-700/50 bg-ink-950'}`}>
        <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(input); }} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Gemini to optimize active nodes..."
            disabled={isLoading}
            className={`flex-1 min-w-0 px-3 py-2 rounded-md font-mono text-[11px] transition-colors ${
              isDayMode ? 'bg-white border border-neutral-300 text-neutral-900 focus:outline-none focus:border-gold-500/60 placeholder-neutral-400' : 'bg-black/40 border border-ink-700/70 text-white focus:outline-none focus:border-gold-500/60 placeholder-neutral-600'
            } disabled:opacity-40`}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-3 bg-gold-500 text-black font-extrabold rounded-md flex items-center justify-center transition-colors hover:bg-gold-400 cursor-pointer disabled:opacity-30"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
