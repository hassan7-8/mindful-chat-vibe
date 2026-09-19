import { Fragment, type ReactNode } from "react";

/** Tiny, dependency-free markdown renderer: headings, lists, code, bold, inline code. */
export function renderMarkdown(src: string): ReactNode {
  const out: ReactNode[] = [];
  const lines = src.split("\n");
  const at = (n: number) => lines[n] ?? "";
  let i = 0;
  let key = 0;

  const isBullet = (s: string) => /^\s*[-*]\s+/.test(s);
  const isNumbered = (s: string) => /^\s*\d+[.)]\s+/.test(s);
  const isBlockStart = (s: string) => /^(#{1,3}\s|```)/.test(s) || isBullet(s) || isNumbered(s);

  while (i < lines.length) {
    const line = at(i);

    if (line.startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !at(i).startsWith("```")) code.push(at(i++));
      i++;
      out.push(
        <pre key={key++}>
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const level = (h[1] ?? "#").length;
      const Tag = (`h${level}`) as "h1" | "h2" | "h3";
      out.push(<Tag key={key++}>{inline(h[2] ?? "")}</Tag>);
      i++;
      continue;
    }

    if (isBullet(line)) {
      const items: string[] = [];
      while (i < lines.length && isBullet(at(i))) items.push(at(i++).replace(/^\s*[-*]\s+/, ""));
      out.push(
        <ul key={key++}>
          {items.map((it, j) => (
            <li key={j}>{inline(it)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (isNumbered(line)) {
      const items: string[] = [];
      while (i < lines.length && isNumbered(at(i))) items.push(at(i++).replace(/^\s*\d+[.)]\s+/, ""));
      out.push(
        <ol key={key++}>
          {items.map((it, j) => (
            <li key={j}>{inline(it)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    const para: string[] = [line];
    i++;
    while (i < lines.length && at(i).trim() !== "" && !isBlockStart(at(i))) {
      para.push(at(i++));
    }
    out.push(<p key={key++}>{inline(para.join(" "))}</p>);
  }
  return <>{out}</>;
}

function inline(text: string): ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("`") && p.endsWith("`")) return <code key={i}>{p.slice(1, -1)}</code>;
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
    return <Fragment key={i}>{p}</Fragment>;
  });
}
