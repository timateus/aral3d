import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Trash2, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import type { ScenarioAction, ChatMessage } from '@/types/scenario';

interface ScenarioChatProps {
  onActions: (actions: ScenarioAction[]) => void;
  onClear: () => void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scenario-chat`;

const ScenarioChat = ({ onActions, onClear }: ScenarioChatProps) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `Error ${resp.status}`);
      }

      const data = await resp.json();
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.content || 'Done!',
        actions: data.actions,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      if (data.actions?.length > 0) {
        onActions(data.actions as ScenarioAction[]);
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${e instanceof Error ? e.message : 'Unknown error'}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute bottom-4 left-4 z-10 glass-panel p-3 cursor-pointer hover:bg-white/10 transition-colors"
        title="Open Scenario Chat"
      >
        <MessageSquare className="w-5 h-5 text-foreground" />
      </button>
    );
  }

  return (
    <div className="absolute left-4 top-16 bottom-4 z-10 w-80 glass-panel flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        <span className="text-sm font-semibold text-foreground">Scenario Simulator</span>
        <div className="flex items-center gap-1">
          <button onClick={() => { onClear(); setMessages([]); }} className="p-1 hover:bg-white/10 rounded cursor-pointer" title="Clear">
            <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button onClick={() => setOpen(false)} className="p-1 hover:bg-white/10 rounded cursor-pointer" title="Close">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3">
        {messages.length === 0 && (
          <div className="text-xs text-muted-foreground italic text-center mt-8 px-4">
            Describe a scenario to simulate on the terrain. E.g. "Plant forests around the canals near Nukus" or "Build a dam on the Amu Darya"
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`mb-3 ${msg.role === 'user' ? 'text-right' : ''}`}>
            <div
              className={`inline-block text-left text-xs rounded-lg px-3 py-2 max-w-[95%] ${
                msg.role === 'user'
                  ? 'bg-primary/30 text-foreground'
                  : 'bg-white/5 text-foreground'
              }`}
            >
              {msg.role === 'assistant' ? (
                <div className="prose prose-invert prose-xs max-w-none [&>p]:m-0 [&>p]:text-xs [&>ul]:text-xs [&>ol]:text-xs">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                msg.content
              )}
              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-white/10 text-[10px] text-muted-foreground">
                  {msg.actions.length} action{msg.actions.length > 1 ? 's' : ''} applied
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="mb-3">
            <div className="inline-block bg-white/5 rounded-lg px-3 py-2 text-xs text-muted-foreground animate-pulse">
              Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-white/10 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Describe a scenario..."
          className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
          disabled={loading}
        />
        <Button
          size="icon"
          variant="ghost"
          onClick={send}
          disabled={loading || !input.trim()}
          className="h-7 w-7 shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};

export default ScenarioChat;
