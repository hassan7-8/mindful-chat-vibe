import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/Logo";
import { renderMarkdown } from "@/lib/markdown";
import { getDeviceId } from "@/lib/device";

const TITLE = "Chat — Cheap Mind AI";
const DESC = "Chat with Cheap Mind AI: instant answers, image generation and voice, all in one clean screen.";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: ChatPage,
});

type Msg = { role: "user" | "assistant"; content: string; image?: string };

const STARTERS = [
  "Explain quantum computing like I'm 10",
  "Write a tweet about cheap AI",
  "Plan a 3-day trip to Lahore",
  "Give me a 20-minute workout",
];

function useSpeech() {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  function start(onText: (t: string) => void) {
    const W = window as any;
    const SR = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!SR) {
      toast.error("Voice input isn't supported in this browser.");
      return;
    }
    if (recRef.current) {
      recRef.current.stop();
      recRef.current = null;
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      onText(text);
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
    };
    rec.onerror = () => {
      recRef.current = null;
      setListening(false);
    };
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  return { listening, start };
}

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    toast.error("Voice playback isn't supported here.");
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[#*`_>]/g, ""));
  u.rate = 1.05;
  window.speechSynthesis.speak(u);
}

const MODELS = [
  { id: "fast", label: "Swift", hint: "Fastest", dot: "bg-sky" },
  { id: "smart", label: "Balanced", hint: "Best mix", dot: "bg-mint" },
  { id: "pro", label: "Genius", hint: "Deepest", dot: "bg-plum" },
] as const;
type ModelId = (typeof MODELS)[number]["id"];

function ChatPage() {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const [guest, setGuest] = useState(false);
  const [ready, setReady] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [model, setModel] = useState<ModelId>("smart");
  const [imageMode, setImageMode] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { listening, start } = useSpeech();

  useEffect(() => {
    setGuest(!!localStorage.getItem("cm_guest_token"));
    const saved = localStorage.getItem("cm_model");
    if (saved === "fast" || saved === "smart" || saved === "pro") setModel(saved);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || loading) return;
    if (!user && !guest) navigate({ to: "/auth" });
  }, [ready, loading, user, guest, navigate]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  function pickModel(m: ModelId) {
    setModel(m);
    localStorage.setItem("cm_model", m);
  }

  async function authHeaders() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const g = localStorage.getItem("cm_guest_token");
    return {
      "Content-Type": "application/json",
      ...(g ? { "x-guest-token": g, "x-device-id": getDeviceId() } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    } as Record<string, string>;
  }

  async function handleFail(res: Response) {
    const text = await res.text().catch(() => "");
    if (res.status === 401 && !user) {
      localStorage.removeItem("cm_guest_token");
      navigate({ to: "/auth" });
    }
    throw new Error(text || "Something went wrong");
  }

  async function send(raw: string, history: Msg[] = messages) {
    const text = raw.trim();
    if (!text || busy) return;
    setInput("");
    const next: Msg[] = [...history, { role: "user", content: imageMode ? `🎨 ${text}` : text }];
    setMessages(next);
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      if (imageMode) {
        const res = await fetch("/api/image", {
          method: "POST",
          headers: await authHeaders(),
          body: JSON.stringify({ prompt: text }),
          signal: ctrl.signal,
        });
        if (!res.ok) await handleFail(res);
        const { dataUrl } = (await res.json()) as { dataUrl: string };
        setMessages([...next, { role: "assistant", content: `Here's “${text}”.`, image: dataUrl }]);
        return;
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          model,
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) await handleFail(res);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setStreaming(acc);
      }
      setStreaming("");
      setMessages([...next, { role: "assistant", content: acc || "…" }]);
    } catch (err) {
      const partial = streaming;
      setStreaming("");
      if (err instanceof DOMException && err.name === "AbortError") {
        if (partial) setMessages([...next, { role: "assistant", content: partial }]);
        return;
      }
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  function regenerate() {
    const lastUser = [...messages].reverse().findIndex((m) => m.role === "user");
    if (lastUser < 0) return;
    const idx = messages.length - 1 - lastUser;
    const msg = messages[idx];
    if (!msg) return;
    void send(msg.content.replace(/^🎨 /, ""), messages.slice(0, idx));
  }

  async function copy(text: string, i: number) {
    await navigator.clipboard.writeText(text);
    setCopied(i);
    setTimeout(() => setCopied(null), 1400);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  async function leave() {
    localStorage.removeItem("cm_guest");
    localStorage.removeItem("cm_guest_token");
    if (user) await signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-cream text-ink">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-0">
        <div className="anim-orb absolute -left-16 top-24 size-56 rounded-full bg-mint/20 blur-3xl" />
        <div className="anim-drift absolute -right-10 top-1/3 size-64 rounded-full bg-sky/20 blur-3xl" />
        <div className="anim-orb absolute bottom-10 left-1/3 size-48 rounded-full bg-plum/15 blur-3xl" style={{ animationDelay: "2s" }} />
      </div>

      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-ink/5 bg-cream/80 px-4 py-3 backdrop-blur-md sm:px-6">
        <Logo />
        <div className="flex items-center gap-2">
          {guest && !user && (
            <span className="anim-pop hidden rounded-full bg-butter/40 px-3 py-1 text-xs font-semibold text-ink/70 sm:inline">
              Guest
            </span>
          )}
          <button
            onClick={() => setMessages([])}
            className="press lift rounded-xl bg-paper px-3 py-2 text-sm font-medium ring-1 ring-ink/5"
          >
            ＋ New
          </button>
          <button
            onClick={leave}
            className="press rounded-xl bg-ink/5 px-3 py-2 text-sm font-medium ring-1 ring-ink/5"
          >
            {user ? "Log out" : "Exit"}
          </button>
        </div>
      </header>

      <main className="scroll-thin relative z-10 mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        {messages.length === 0 && !streaming ? (
          <div className="anim-slideup pt-6 text-center">
            <div className="anim-floaty mx-auto mb-5 flex size-16 items-center justify-center rounded-3xl bg-mint text-3xl shadow-pop ring-1 ring-ink/5">
              ✦
            </div>
            <h1 className="font-display text-3xl font-semibold sm:text-4xl">What's on your mind?</h1>
            <p className="mx-auto mt-3 max-w-[40ch] text-pretty text-sm text-ink/60">
              Pick a brain below, tap 🎨 to draw, or 🎤 to talk.
            </p>
            <div className="mt-7 grid gap-2 sm:grid-cols-2">
              {STARTERS.map((s, i) => (
                <button
                  key={s}
                  onClick={() => void send(s)}
                  style={{ animationDelay: `${80 * i}ms` }}
                  className="anim-slideup press lift rounded-2xl bg-paper/90 px-4 py-3 text-left text-sm font-medium ring-1 ring-ink/5 backdrop-blur"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`anim-slideup flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] rounded-3xl px-4 py-3 text-sm ring-1 ring-ink/5 ${
                    m.role === "user" ? "rounded-br-lg bg-sky/25" : "rounded-bl-lg bg-paper shadow-pop-sm"
                  }`}
                >
                  {m.image ? (
                    <a href={m.image} download="cheap-mind-image.png">
                      <img src={m.image} alt={m.content} className="anim-bouncein mb-2 w-full max-w-sm rounded-2xl" />
                    </a>
                  ) : null}
                  <div className="prose-chat">{renderMarkdown(m.content)}</div>
                  {m.role === "assistant" && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button onClick={() => speak(m.content)} className="press rounded-lg bg-ink/5 px-2 py-1 text-xs font-semibold text-ink/60 hover:text-ink">
                        🔊 Listen
                      </button>
                      <button onClick={() => void copy(m.content, i)} className="press rounded-lg bg-ink/5 px-2 py-1 text-xs font-semibold text-ink/60 hover:text-ink">
                        {copied === i ? "✓ Copied" : "⧉ Copy"}
                      </button>
                      {i === messages.length - 1 && !busy && (
                        <button onClick={regenerate} className="press rounded-lg bg-ink/5 px-2 py-1 text-xs font-semibold text-ink/60 hover:text-ink">
                          ↻ Retry
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {streaming && (
              <div className="flex justify-start">
                <div className="max-w-[88%] rounded-3xl rounded-bl-lg bg-paper px-4 py-3 text-sm shadow-pop-sm ring-1 ring-ink/5">
                  <div className="prose-chat">{renderMarkdown(streaming)}</div>
                  <span className="caret anim-blink" />
                </div>
              </div>
            )}

            {busy && !streaming && (
              <div className="flex justify-start">
                {imageMode ? (
                  <div className="shimmer size-56 rounded-3xl ring-1 ring-ink/5" />
                ) : (
                  <div className="anim-dots rounded-3xl bg-paper px-4 py-3 text-lg shadow-pop-sm ring-1 ring-ink/5">
                    <i>•</i>
                    <i>•</i>
                    <i>•</i>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <div ref={endRef} />
      </main>

      <form onSubmit={onSubmit} className="sticky bottom-0 z-20 border-t border-ink/5 bg-cream/85 px-3 pb-3 pt-2 backdrop-blur-md sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="scroll-thin mb-2 flex gap-1.5 overflow-x-auto">
            {MODELS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => pickModel(m.id)}
                className={`press flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-all ${
                  model === m.id && !imageMode ? "bg-ink text-cream ring-ink" : "bg-paper text-ink/60 ring-ink/5 hover:text-ink"
                }`}
                title={m.hint}
              >
                <span className={`size-2 rounded-full ${m.dot}`} />
                {m.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setImageMode((v) => !v)}
              className={`press flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-all ${
                imageMode ? "anim-pop bg-coral text-cream ring-coral" : "bg-paper text-ink/60 ring-ink/5 hover:text-ink"
              }`}
            >
              🎨 Image
            </button>
          </div>
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => start(setInput)}
              aria-label="Voice input"
              className={`press lift size-11 shrink-0 rounded-xl ring-1 ring-ink/5 ${listening ? "anim-ring bg-coral text-cream" : "bg-paper"}`}
            >
              🎤
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={1}
              placeholder={imageMode ? "Describe the picture to create…" : "Message Cheap Mind AI…"}
              className={`scroll-thin max-h-40 min-h-11 flex-1 resize-none rounded-xl bg-paper px-4 py-3 text-sm outline-none ring-1 ring-ink/5 transition focus:ring-2 ${imageMode ? "focus:ring-coral" : "focus:ring-mint"}`}
            />
            {busy ? (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                aria-label="Stop"
                className="press size-11 shrink-0 rounded-xl bg-ink text-cream ring-1 ring-ink/5"
              >
                ■
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                aria-label="Send"
                className={`press lift size-11 shrink-0 rounded-xl text-lg font-bold text-ink ring-1 ring-ink/5 disabled:opacity-50 ${imageMode ? "bg-coral" : "bg-mint"}`}
              >
                ↑
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
