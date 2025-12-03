export const slideWrapper = (content: string): string => `
  <div class="cq-deck h-full w-full text-slate-50">
    <div class="cq-frame h-full w-full">
      <div class="cq-viewport">
        <div class="cq-slideBg"></div>
        <div class="cq-content h-full w-full">
          ${content}
        </div>
      </div>
    </div>
  </div>
`;
