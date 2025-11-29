import React from "react";

interface Props {
  html: string;
}

export function SlidePreview({ html }: Props) {
  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3 shadow-md w-full">
      {/* 
        We use scale to fit the "desktop" slide content into a mobile view 
        This is a common trick for slide previews.
      */}
      <div className="relative w-full pb-[56.25%] overflow-hidden rounded-xl bg-slate-950"> 
          <div
            className="absolute top-0 left-0 w-[200%] h-[200%] origin-top-left scale-[0.5] pointer-events-none transform"
            dangerouslySetInnerHTML={{ __html: html }}
            style={{
                // Ensure internal scrolling is disabled for preview
                overflow: 'hidden' 
            }}
          />
      </div>
    </div>
  );
}