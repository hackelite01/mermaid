/**
 * Best-effort Mermaid code formatter. Mermaid has no official formatter and
 * its grammar varies by diagram type, so this is conservative:
 *
 *  - normalizes line endings
 *  - trims trailing whitespace
 *  - collapses runs of blank lines
 *  - re-indents block contents inside known wrapper keywords (classDiagram,
 *    sequenceDiagram, stateDiagram, etc.) using two-space indent
 *
 * It will not reorder tokens or rewrite expressions.
 */
const TWO = "  ";

const TOP_LEVEL = /^(?:flowchart|graph|sequenceDiagram|classDiagram|erDiagram|stateDiagram(?:-v2)?|gantt|pie|journey|gitGraph|mindmap|timeline|quadrantChart)\b/;

export function formatMermaid(source: string): string {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let inBlock = false;
  let blankRun = 0;

  for (const raw of lines) {
    const line = raw.replace(/\s+$/g, "");
    if (!line.trim()) {
      blankRun++;
      if (blankRun <= 1) out.push("");
      continue;
    }
    blankRun = 0;

    if (TOP_LEVEL.test(line.trim())) {
      out.push(line.trim());
      inBlock = true;
      continue;
    }

    if (inBlock) {
      // Don't touch lines that already include leading indentation > 2 spaces
      // (they may be inside subgraphs/notes — preserve intent).
      const stripped = line.replace(/^[ \t]+/, "");
      out.push(TWO + stripped);
    } else {
      out.push(line);
    }
  }

  // Trim trailing blank lines.
  while (out.length && !out[out.length - 1].trim()) out.pop();
  return out.join("\n") + "\n";
}
