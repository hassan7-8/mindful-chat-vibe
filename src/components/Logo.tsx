import { Link } from "@tanstack/react-router";

export function Logo({ light = false, size = "md" }: { light?: boolean; size?: "sm" | "md" }) {
  return (
    <Link
      to="/"
      className={`inline-flex items-center gap-2 font-display font-semibold ${size === "sm" ? "text-base" : "text-lg"} ${light ? "text-cream" : "text-ink"}`}
    >
      <span className="size-3 rounded-full bg-coral" />
      Cheap Mind <span className="text-mint">AI</span>
    </Link>
  );
}
