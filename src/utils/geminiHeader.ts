type HeaderVariant = "dense" | "default";

interface GeminiHeaderOpts {
  subtitle?: string;
  title: string;
  meta?: string;
  variant?: HeaderVariant;
}

/**
 * Shared Gemini slide header used across decks to keep title/subtitle/meta compact.
 * Keeps styling self-contained so the presenter shell stays unchanged.
 */
export const geminiHeader = ({
  subtitle,
  title,
  meta,
  variant = "dense",
}: GeminiHeaderOpts): string => {
  const isDense = variant === "dense";
  const subtitleHtml = subtitle
    ? `<div class="text-[11px] uppercase tracking-[0.16em] text-slate-400">${subtitle}</div>`
    : "";
  const metaHtml = meta
    ? `<div class="text-[11px] uppercase tracking-[0.18em] text-slate-500 text-right leading-tight">${meta}</div>`
    : "";

  return `
    <div class="${isDense ? "space-y-1.5" : "space-y-2"}">
      ${subtitleHtml}
      <div class="flex items-start justify-between gap-3">
        <h2 class="cq-h1 ${isDense ? "text-[30px] md:text-[32px] leading-tight" : "text-3xl md:text-4xl"}">${title}</h2>
        ${metaHtml}
      </div>
    </div>
  `;
};
