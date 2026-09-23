import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/Logo";

const TITLE = "Log in or sign up — Cheap Mind AI";
const DESC = "Create a free Cheap Mind AI account in seconds and start chatting instantly.";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [codeBusy, setCodeBusy] = useState(false);

  async function unlock(e: FormEvent) {
    e.preventDefault();
    if (codeBusy) return;
    setCodeBusy(true);
    try {
      const res = await fetch("/api/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) throw new Error(await res.text());
      localStorage.setItem("cm_guest", "1");
      toast.success("Code accepted — you're in.");
      navigate({ to: "/chat" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That code isn't right.");
    } finally {
      setCodeBusy(false);
    }
  }

  useEffect(() => {
    if (!loading && user) navigate({ to: "/chat" });
  }, [user, loading, navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/chat" },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Welcome to Cheap Mind AI!");
          navigate({ to: "/chat" });
        } else {
          toast.success("Check your inbox to confirm your email, then log in.");
          setMode("login");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
        navigate({ to: "/chat" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(result.error.message ?? "Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/chat" });
  }

  return (
    <div className="min-h-screen bg-cream px-5 py-6 text-ink sm:px-8">
      <header className="mx-auto max-w-4xl">
        <Logo />
      </header>
      <div className="mx-auto mt-10 flex max-w-4xl flex-col items-center gap-10 lg:flex-row lg:items-stretch">
        <div className="w-full lg:w-1/2">
          <div className="anim-slideup mb-5 inline-flex items-center gap-2 rounded-full bg-coral/10 px-3 py-1.5 text-sm font-medium text-coral ring-1 ring-coral/25">
            <span className="size-2 rounded-full bg-coral" />
            {mode === "signup" ? "New here?" : "Welcome back"}
          </div>
          <h1
            className="anim-slideup text-balance font-display text-4xl font-semibold leading-none sm:text-5xl"
            style={{ animationDelay: "80ms" }}
          >
            {mode === "signup" ? (
              <>
                Sign up. Chat
                <br />
                in 10 seconds.
              </>
            ) : (
              <>
                Log in.
                <br />
                Pick up the thread.
              </>
            )}
          </h1>
          <p className="anim-slideup mt-5 max-w-[38ch] text-pretty text-ink/70" style={{ animationDelay: "160ms" }}>
            No credit card, no catch. Just a fast brain that costs pennies.
          </p>
          <div className="anim-slideup mt-6 space-y-2 text-sm font-medium text-ink/70" style={{ animationDelay: "240ms" }}>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-mint" />
              Free tier forever
            </div>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-sky" />
              Instant answers
            </div>
          </div>
        </div>

        <div className="w-full lg:w-1/2">
          <form
            onSubmit={submit}
            className="anim-bouncein rounded-3xl bg-cream p-6 shadow-pop ring-1 ring-ink/5"
          >
            <div className="mb-5 flex gap-1 rounded-xl bg-ink/5 p-1 text-sm font-semibold">
              {(["signup", "login"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`press flex-1 rounded-lg py-2 text-center transition-colors ${
                    mode === m ? "bg-cream ring-1 ring-ink/5" : "text-ink/50 hover:text-ink"
                  }`}
                >
                  {m === "signup" ? "Sign up" : "Log in"}
                </button>
              ))}
            </div>

            <label className="block text-xs font-semibold uppercase tracking-wide text-ink/50">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="mb-4 mt-1 w-full rounded-xl bg-paper px-3 py-2.5 text-sm outline-none ring-1 ring-ink/5 transition focus:ring-2 focus:ring-mint"
            />
            <label className="block text-xs font-semibold uppercase tracking-wide text-ink/50">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mb-5 mt-1 w-full rounded-xl bg-paper px-3 py-2.5 text-sm outline-none ring-1 ring-ink/5 transition focus:ring-2 focus:ring-mint"
            />
            <button
              type="submit"
              disabled={busy}
              className="press lift w-full rounded-xl bg-mint py-3 text-sm font-semibold text-ink ring-1 ring-ink/5 disabled:opacity-60"
            >
              {busy ? "One sec…" : mode === "signup" ? "Create free account" : "Log in"}
            </button>
            <div className="my-4 text-center text-xs text-ink/40">or continue with</div>
            <button
              type="button"
              onClick={google}
              className="press lift w-full rounded-xl bg-paper py-2.5 text-sm font-medium ring-1 ring-ink/5"
            >
              Google
            </button>
          </form>

          <div className="anim-slideup mt-4 rounded-3xl bg-paper p-5 ring-1 ring-ink/5" style={{ animationDelay: "320ms" }}>
            {codeOpen ? (
              <form onSubmit={unlock} className="space-y-3">
                <label className="block text-xs font-semibold uppercase tracking-wide text-ink/50">
                  Access code
                </label>
                <input
                  type="password"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter your code"
                  className="w-full rounded-xl bg-cream px-3 py-2.5 text-sm outline-none ring-1 ring-ink/5 transition focus:ring-2 focus:ring-butter"
                />
                <button
                  type="submit"
                  disabled={codeBusy}
                  className="press lift w-full rounded-xl bg-butter py-2.5 text-sm font-semibold text-ink ring-1 ring-ink/5 disabled:opacity-60"
                >
                  {codeBusy ? "Checking…" : "Enter chat"}
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setCodeOpen(true)}
                className="press w-full text-sm font-semibold text-ink/60 hover:text-ink"
              >
                Have an access code? Continue without an account →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
