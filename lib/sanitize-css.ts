/**
 * Strip dangerous CSS constructs from user-supplied stylesheets before
 * injecting them into the Mermaid preview. This is a denylist — not a parser —
 * so it's defensive but conservative.
 */
const FORBIDDEN_PATTERNS = [
  /@import\b/gi,
  /url\s*\(\s*['"]?\s*(?:javascript|data|vbscript)/gi,
  /expression\s*\(/gi,
  /behavior\s*:/gi,
  /-moz-binding/gi,
  /<\/?\s*(?:style|script|iframe|object|embed|link)\b/gi,
  /\\[0-9a-f]{1,6}\s?/gi, // CSS unicode escape (defang)
];

export function sanitizeCss(input: string): string {
  if (!input) return "";
  let css = input;
  for (const re of FORBIDDEN_PATTERNS) css = css.replace(re, "");
  return css.slice(0, 10_000);
}
