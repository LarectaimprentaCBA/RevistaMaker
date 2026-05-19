import React from 'react'
import PageThumb from './PageThumb.jsx'

// Muestra una vista doble pagina estilo revista.
// spreadIndex: 0..(N/2)-1. Spread 0 = tapa sola (pag 1) a la derecha.
// Spread N/2-1 = contratapa sola (pag N) a la izquierda.
export default function Spread({ pages, spreadIndex, pageWmm, pageHmm, onPrev, onNext }) {
  const total = pages.length
  if (total === 0) return null

  const spreadCount = Math.ceil((total + 1) / 2)

  let leftIdx = null
  let rightIdx = null
  if (spreadIndex === 0) {
    rightIdx = 0
  } else if (spreadIndex === spreadCount - 1 && total % 2 === 0) {
    leftIdx = total - 1
  } else {
    leftIdx = spreadIndex * 2 - 1
    rightIdx = spreadIndex * 2
    if (rightIdx >= total) rightIdx = null
  }

  const leftPage = leftIdx != null ? pages[leftIdx] : null
  const rightPage = rightIdx != null ? pages[rightIdx] : null

  const aspect = pageWmm / pageHmm
  // Hacer que el spread completo ocupe disponible, con max-w/max-h razonables
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-neutral-100 p-4 min-h-0">
      <div className="text-xs text-neutral-600 mb-2">
        Vista {spreadIndex + 1} / {spreadCount} {' '}
        {leftIdx != null && rightIdx != null
          ? `(paginas ${leftIdx + 1}-${rightIdx + 1})`
          : leftIdx != null
            ? `(pagina ${leftIdx + 1})`
            : rightIdx != null
              ? `(pagina ${rightIdx + 1})`
              : ''}
      </div>
      <div className="flex-1 min-h-0 w-full flex items-center justify-center gap-1">
        <button
          onClick={onPrev}
          disabled={spreadIndex === 0}
          className="px-3 py-2 bg-white border border-neutral-300 rounded disabled:opacity-30 hover:bg-neutral-50"
        >
          ‹
        </button>
        <div
          className="flex bg-white shadow-lg max-h-full"
          style={{
            aspectRatio: `${2 * aspect} / 1`,
            height: '100%',
            maxWidth: '100%',
          }}
        >
          <div className="flex-1 border-r border-neutral-200">
            {leftPage ? (
              <PageThumb
                page={leftPage}
                pageNumber={leftIdx + 1}
                className="w-full h-full"
              />
            ) : (
              <div className="w-full h-full" />
            )}
          </div>
          <div className="flex-1">
            {rightPage ? (
              <PageThumb
                page={rightPage}
                pageNumber={rightIdx + 1}
                className="w-full h-full"
              />
            ) : (
              <div className="w-full h-full" />
            )}
          </div>
        </div>
        <button
          onClick={onNext}
          disabled={spreadIndex >= spreadCount - 1}
          className="px-3 py-2 bg-white border border-neutral-300 rounded disabled:opacity-30 hover:bg-neutral-50"
        >
          ›
        </button>
      </div>
    </div>
  )
}
