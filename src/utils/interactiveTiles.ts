type ClueTile = {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
};

interface InteractiveTilesOpts {
  heading?: string;
  helperText?: string;
  tiles: ClueTile[];
  imageHint?: string;
  role?: "presenter" | "participant";
}

const escapeAttr = (val: string) => val.replace(/"/g, "&quot;");

/**
 * Generate an interactive clue tile grid with an image reveal pane.
 * Presenter only: clicking a tile toggles its image; participant sees static tiles.
 */
export const renderInteractiveTiles = ({
  heading,
  helperText,
  tiles,
  imageHint = "Select a clue to reveal an image.",
  role = "presenter",
}: InteractiveTilesOpts): string => {
  const rootId = `cq-tiles-${Math.random().toString(36).slice(2, 8)}`;
  const presenterOnlyScript =
    role === "presenter"
      ? `
      <script>
        (function(){
          const root = document.getElementById("${rootId}");
          if (!root) return;
          // Guard to avoid running on participant if mounted there
          const isPresenter = document.body?.dataset?.cqRole === "presenter" || window.location.pathname.includes("presenter");
          if (!isPresenter) return;
          const buttons = root.querySelectorAll("[data-clue-id]");
          const pane = root.querySelector("[data-clue-image]");
          let activeId = "";
          buttons.forEach((btn) => {
            btn.addEventListener("click", () => {
              const id = btn.getAttribute("data-clue-id") || "";
              activeId = activeId === id ? "" : id;
              buttons.forEach((b) => b.classList.toggle("is-active", b.getAttribute("data-clue-id") === activeId));
              if (!pane) return;
              if (!activeId) {
                pane.innerHTML = '<div class="text-xs text-slate-500 text-center w-full">${imageHint}</div>';
                return;
              }
              const img = btn.getAttribute("data-clue-img");
              const title = btn.getAttribute("data-clue-title") || "";
              if (img) {
                pane.innerHTML = '<div class="flex flex-col gap-2"><img src="' + img + '" alt="' + title + '" class="cq-phenotype-img" /><div class="text-xs text-slate-400 text-center">' + title + '</div></div>';
              } else {
                pane.innerHTML = '<div class="text-xs text-slate-400 text-center w-full">' + title + '</div>';
              }
            });
          });
        })();
      </script>
    `
      : "";

  const tilesHtml = tiles
    .map(
      (t) => `
      <button
        type="button"
        class="cq-tile cq-hoverable cq-phenotype-tile text-left"
        data-clue-id="${escapeAttr(t.id)}"
        data-clue-img="${escapeAttr(t.imageUrl ?? "")}"
        data-clue-title="${escapeAttr(t.title)}"
      >
        <div class="cq-cardLabel"><span>${t.title}</span></div>
        <div class="text-lg font-semibold">${t.title}</div>
        <p class="cq-mute">${t.description}</p>
      </button>
    `
    )
    .join("");

  return `
    <div class="flex flex-col gap-4 h-full justify-center" id="${rootId}">
      <div class="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-300">
        <span class="cq-chip">${heading ?? "Clues"}</span>
        ${helperText ? `<span class="text-[11px] text-slate-500">${helperText}</span>` : ""}
      </div>

      <div class="grid md:grid-cols-[1.05fr_0.95fr] gap-3 items-start h-full">
        <div class="cq-tiles grid md:grid-cols-1 gap-3">
          ${tilesHtml}
        </div>
        <div class="cq-card cq-hoverable h-full flex items-center justify-center bg-slate-900/70 border border-slate-800 cq-phenotype-image-pane" data-clue-image>
          <div class="text-xs text-slate-500 text-center w-full">${imageHint}</div>
        </div>
      </div>
    </div>
    ${presenterOnlyScript}
  `;
};
