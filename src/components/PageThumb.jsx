import React from 'react'

export default function PageThumb({ page, pageNumber, className = '', showLabel = true }) {
  return (
    <div
      className={`relative bg-white border border-neutral-300 shadow-sm overflow-hidden flex items-center justify-center ${className}`}
    >
      {page?.type === 'blank' || !page?.thumbDataUrl ? (
        <span className="text-neutral-300 text-xs select-none">en blanco</span>
      ) : (
        <img
          src={page.thumbDataUrl}
          alt={page.sourceName}
          className="max-w-full max-h-full object-contain"
          draggable={false}
        />
      )}
      {showLabel && pageNumber != null && (
        <div className="absolute bottom-0 right-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5">
          {pageNumber}
        </div>
      )}
    </div>
  )
}
