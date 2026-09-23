import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/Logo";
import { renderMarkdown } from "@/lib/markdown";

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
  "/image a neon cat riding a skateboard",
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

function ChatPage() {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const [guest, setGuest] = useState(false);
  const [ready, setReady] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const { listening, start } = useSpeech();

  useEffect(() => {
    setGuest(localStorage.getItem("cm_guest") === "1");
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || loading) return;
    if (!user && !guest) navigate({ to: "/auth" });
  }, [ready, loading, user, guest, navigate]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  async function authHeaders() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    } as Record<string, string>;
  }

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setBusy(true);

    try {
      if (text.toLowerCase().startsWith("/image ")) {
        const prompt = text.slice(7).trim();
        const res = await fetch("/api/image", {
          method: "POST",
          headers: await authHeaders(),
          body: JSON.stringify({ prompt }),
        });
        if (!res.ok) throw new Error(await res.text());
        const { dataUrl } = (await res.json()) as { dataUrl: string };
        setMessages([...next, { role: "assistant", content: `Here's "${prompt}".`, image: dataUrl }]);
        return;
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text().catch(() => "Chat failed"));

      const reader = res.body.getReader();
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
      setStreaming("");
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  async function leave() {
    localStorage.removeItem("cm_guest");
    if (user) await signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="flex min-h-screen flex-col bg-cream text-ink">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-ink/5 bg-cream/85 px-4 py-3 backdrop-blur sm:px-6">
        <Logo />
        <div className="flex items-center gap-2">
          {guest && !user && (
            <span className="hidden rounded-full bg-butter/30 px-3 py-1 text-xs font-semibold text-ink/70 sm:inline">
              Guest mode
            </span>
          )}
          <button
            onClick={() => setMessages([])}
            className="press rounded-xl bg-paper px-3 py-2 text-sm font-medium ring-1 ring-ink/5"
          >
            New chat
          </button>
          <button
            onClick={leave}
            className="press rounded-xl bg-ink/5 px-3 py-2 text-sm font-medium ring-1 ring-ink/5"
          >
            {user ? "Log out" : "Exit"}
          </button>
        </div>
      </header>

      <main className="scroll-thin mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        {messages.length === 0 && !streaming ? (
          <div className="anim-slideup pt-6 text-center">
            <div className="anim-floaty mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-mint text-2xl shadow-pop">
              ✦
            </div>
            <h1 className="font-display text-3xl font-semibold sm:text-4xl">What's on your mind?</h1>
            <p className="mx-auto mt-3 max-w-[40ch] text-pretty text-sm text-ink/60">
              Ask anything. Type <span className="font-semibold">/image</span> to draw, tap the mic to
              talk.
            </p>
            <div className="mt-7 grid gap-2 sm:grid-cols-2">
              {STARTERS.map((s, i) => (
                <button
                  key={s}
                  onClick={() => void send(s)}
                  style={{ animationDelay: `${80 * i}ms` }}
                  className="anim-slideup press lift rounded-2xl bg-paper px-4 py-3 text-left text-sm font-medium ring-1 ring-ink/5"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`anim-slideup flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-3xl px-4 py-3 text-sm ring-1 ring-ink/5 ${
                    m.role === "user" ? "bg-sky/25" : "bg-paper shadow-pop"
                  }`}
                >
                  {m.image ? (
                    <img
                      src={m.image}
                      alt={m.content}
                      className="anim-bouncein mb-2 w-full max-w-sm rounded-2xl"
                    />
                  ) : null}
                  <div className="prose-chat">{renderMarkdown(m.content)}</div>
                  {m.role === "assistant" && (
                    <button
                      onClick={() => speak(m.content)}
                      className="press mt-2 rounded-lg bg-ink/5 px-2 py-1 text-xs font-semibold text-ink/60"
                    >
                      🔊 Read aloud
                    </button>
                  )}
                </div>
              </div>
            ))}

            {streaming && (
              <div className="flex justify-start">
                <div className="max-w-[88%] rounded-3xl bg-paper px-4 py-3 text-sm shadow-pop ring-1 ring-ink/5">
                  <div className="prose-chat">{renderMarkdown(streaming)}</div>
                  <span className="caret anim-blink" />
                </div>
              </div>
            )}

            {busy && !streaming && (
              <div className="flex justify-start">
                <div className="anim-dots rounded-3xl bg-paper px-4 py-3 text-sm shadow-pop ring-1 ring-ink/5">
                  Thinking…
                </div>
              </div>
            )}
          </div>
        )}
        <div ref={endRef} />
      </main>

      <form
        onSubmit={onSubmit}
        className="sticky bottom-0 border-t border-ink/5 bg-cream/90 px-4 py-3 backdrop-blur sm:px-6"
      >
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <button
            type="button"
            onClick={() => start(setInput)}
            aria-label="Voice input"
            className={`press lift size-11 shrink-0 rounded-xl ring-1 ring-ink/5 ${
              listening ? "anim-ring bg-coral text-cream" : "bg-paper"
            }`}
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
            placeholder="Message Cheap Mind AI…  (/image to draw)"
            className="scroll-thin max-h-40 min-h-11 flex-1 resize-none rounded-xl bg-paper px-4 py-3 text-sm outline-none ring-1 ring-ink/5 transition focus:ring-2 focus:ring-mint"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="press lift size-11 shrink-0 rounded-xl bg-mint text-lg font-bold text-ink ring-1 ring-ink/5 disabled:opacity-50"
          >
            ↑
          </button>
        </div>
      </form>
    </div>
  );
}
