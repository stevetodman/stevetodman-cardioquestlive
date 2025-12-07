const allowedTags = new Set([
  "div",
  "p",
  "span",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "img",
  "section",
  "article",
  "header",
  "footer",
  "blockquote",
  "code",
  "pre",
  "br",
]);

const allowedAttributes = new Set([
  "class",
  "id",
  "href",
  "src",
  "alt",
  "title",
  "aria-label",
  "aria-hidden",
]);

const allowedProtocols = ["http:", "https:", "mailto:"];

export function sanitizeHtml(html: string): string {
  if (!html?.trim()) return "";

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const nodes = doc.body.querySelectorAll("*");
  nodes.forEach((el) => {
    const tag = el.tagName.toLowerCase();
    if (!allowedTags.has(tag)) {
      const parent = el.parentNode;
      if (!parent) return;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
      return;
    }

    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
        return;
      }
      if (!allowedAttributes.has(name) && !name.startsWith("data-")) {
        el.removeAttribute(attr.name);
        return;
      }
      if (name === "href" || name === "src") {
        const value = attr.value.trim();
        const url = (() => {
          try {
            return new URL(value, "http://localhost");
          } catch {
            return null;
          }
        })();
        if (!url || !allowedProtocols.includes(url.protocol)) {
          el.removeAttribute(attr.name);
          return;
        }
      }
    });
  });

  return doc.body.innerHTML;
}
