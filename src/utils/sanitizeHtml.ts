import DOMPurifyModule from "dompurify";

const factory = (DOMPurifyModule as any)?.default ?? DOMPurifyModule;
const purifier =
  typeof window !== "undefined" && typeof window.document !== "undefined"
    ? typeof factory === "function"
      ? factory(window as unknown as Window)
      : factory?.sanitize
      ? factory
      : null
    : null;

const ALLOWED_TAGS = [
  "div","p","span","strong","em","ul","ol","li","h1","h2","h3","h4","h5","h6",
  "img","section","article","header","footer","blockquote","code","pre","br",
];

const ALLOWED_ATTR = ["class","id","href","src","alt","title","aria-label","aria-hidden","data-*"];

export function sanitizeHtml(html: string): string {
  if (!html?.trim()) return "";
  if (!purifier?.sanitize) return html;
  return purifier.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: true,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    FORBID_TAGS: ["style","script"],
    FORBID_ATTR: ["style","onerror","onclick"],
  });
}
