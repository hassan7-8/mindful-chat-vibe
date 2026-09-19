import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";

const TITLE = "Cheap Mind AI — Big-brain chat for tiny budgets";
const DESC =
  "Ask anything, get instant streaming answers, spend almost nothing. Cheap Mind AI is the fast, playful chatbot that won't break the bank.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: Landing,
});

const DEMO_LINES = [
  "Sure! Here's a 3-day Lisbon plan on a shoestring…",
  "Day 1: Alfama viewpoints (free) + Time Out Market.",
  "Day 2: Belém pastéis + LX Factory. Day 3: Sintra.",
];

function Landing() {
  const { user } = useAuth();
  const [typed, setTyped] = useState("");
  const [lineIdx, setLineIdx] = useState(0);

  useEffect(() => {
    const target = DEMO_LINES[lineIdx % DEMO_LINES.length] ?? "";
    if (typed.length < target.length) {
      const t = setTimeout(() => setTyped(target.slice(0, typed.length + 1)), 22);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setTyped("");
      setLineIdx((n) => n + 1);
    }, 1800);
    return () => clearTimeout(t);
  }, [typed, lineIdx]);

  const chatTo = user ? "/chat" : "/auth";

  return (
    <div className="min-h-screen bg-cream text-ink">
      <section className="relative overflow-hidden bg-ink px-5 pb-20 pt-6 text-cream sm:px-8">
        <header className="mx-auto flex max-w-6xl items-center justify-between">
          <Logo light />
          <Link
            to={chatTo}
            className="press lift rounded-full bg-cream/10 px-4 py-2 text-sm font-semibold text-cream ring-1 ring-cream/15 hover:bg-cream/15"
          >
            {user ? "Open chat" : "Log in"}
          </Link>
        </header>

        <div className="mx-auto mt-14 flex max-w-6xl flex-col items-start gap-14 lg:flex-row lg:items-center">
          <div className="w-full lg:max-w-[22ch]">
            <div className="anim-slideup mb-7 inline-flex items-center gap-2 rounded-full bg-butter/10 px-3 py-1.5 text-sm font-medium text-butter ring-1 ring-butter/25">
              <span className="size-2 rounded-full bg-butter anim-blink" />
              AI that won't break the bank
            </div>
            <h1
              className="anim-slideup text-balance font-display text-6xl font-semibold leading-none sm:text-7xl"
              style={{ animationDelay: "80ms" }}
            >
              Cheap
              <br />
              Mind <span className="text-mint">AI</span>
            </h1>
            <p
              className="anim-slideup mt-6 max-w-[42ch] text-pretty text-lg text-cream/75 sm:text-xl"
              style={{ animationDelay: "160ms" }}
            >
              Ask anything, get instant answers, spend almost nothing. Big-brain chat for tiny budgets.
            </p>
            <div className="anim-slideup mt-9 flex flex-wrap items-center gap-5" style={{ animationDelay: "240ms" }}>
              <Link
                to={chatTo}
                className="press lift anim-ring inline-flex items-center gap-2.5 rounded-full bg-mint px-8 py-4 text-lg font-semibold text-ink"
              >
                Start chatting <span className="text-xl leading-none">→</span>
              </Link>
              {!user && (
                <Link
                  to="/auth"
                  className="press text-lg font-semibold text-cream/80 underline decoration-coral decoration-2 underline-offset-4 hover:text-cream"
                >
                  Log in
                </Link>
              )}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md py-8">
            <div className="anim-orb absolute -right-4 -top-2 size-28 rounded-full bg-mint/80 blur-2xl" />
            <div className="anim-drift absolute -bottom-2 left-4 size-24 rounded-full bg-coral/70 blur-2xl" />
            <div className="anim-bouncein relative rounded-3xl bg-cream p-5 text-ink shadow-pop-lg ring-1 ring-ink/5">
              <div className="mb-3 flex items-center gap-2">
                <span className="size-6 rounded-full bg-coral" />
                <span className="text-sm font-semibold">Cheap Mind</span>
                <span className="ml-auto text-xs font-medium text-mint-foreground text-ink/50">● live</span>
              </div>
              <div className="rounded-2xl rounded-tr-md bg-sky/20 px-3 py-2 text-sm ring-1 ring-ink/5">
                Plan a 3-day Lisbon trip on a tight budget?
              </div>
              <div className="mt-3 min-h-[3.2rem] text-sm leading-relaxed">
                <span className="caret">{typed}</span>
              </div>
              <div className="mt-2 text-xs text-ink/50">
                typing
                <span className="anim-dots">
                  <i>.</i>
                  <i>.</i>
                  <i>.</i>
                </span>
              </div>
            </div>
            <div className="anim-floaty absolute -left-2 top-14 rounded-2xl bg-butter px-3 py-2 text-sm font-semibold text-ink shadow-pop-sm sm:-left-6">
              ~$0.00 / msg
            </div>
            <div className="anim-floaty-slow absolute -right-1 bottom-10 rounded-2xl bg-plum px-3 py-2 text-sm font-semibold text-cream shadow-pop-sm sm:-right-3">
              instant ⚡
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8">
        <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-3">
          {[
            { c: "bg-mint", t: "Streams live", d: "Answers appear word by word, the moment they're ready." },
            { c: "bg-sky", t: "Remembers chats", d: "Every conversation is saved to your account." },
            { c: "bg-coral", t: "Free forever", d: "Runs on a free AI tier. No card, no catch." },
          ].map((f, i) => (
            <div
              key={f.t}
              className="lift anim-slideup rounded-3xl bg-cream p-6 shadow-pop ring-1 ring-ink/5"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <span className={`inline-block size-3 rounded-full ${f.c}`} />
              <h3 className="mt-3 font-display text-xl font-semibold">{f.t}</h3>
              <p className="mt-1 text-sm text-ink/70">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 pb-20 sm:px-8">
        <div className="mx-auto flex max-w-4xl flex-col items-start gap-8 rounded-3xl bg-ink p-8 text-cream shadow-pop-lg sm:flex-row sm:items-center sm:justify-between sm:p-10">
          <div>
            <h2 className="text-balance font-display text-4xl font-semibold leading-none">
              Sign up. Chat
              <br />
              in 10 seconds.
            </h2>
            <p className="mt-3 text-cream/70">No credit card, no catch. Just a fast brain that costs pennies.</p>
          </div>
          <Link
            to={chatTo}
            className="press lift shrink-0 rounded-full bg-mint px-7 py-3.5 font-semibold text-ink"
          >
            {user ? "Open chat →" : "Create free account →"}
          </Link>
        </div>
      </section>
    </div>
  );
}
