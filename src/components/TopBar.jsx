import React, { useRef, useState } from 'react'

export default function TopBar({
  pageWmm,
  pageHmm,
  onChangeSize,
  onLoadFiles,
  onClearAll,
  onExport,
  exportEnabled,
  busy,
  totalPages,
}) {
  const fileRef = useRef(null)
  const [unit, setUnit] = useState('cm')

  const factor = unit === 'cm' ? 10 : 1 // mm por unidad visible
  const fmt = (mm) => {
    const v = mm / factor
    // 1 decimal solo si hace falta
    return Number.isInteger(v) ? String(v) : v.toFixed(1)
  }

  const sheetWdisp = fmt(pageWmm * 2)
  const sheetHdisp = fmt(pageHmm)

  function changeSheet(wDisp, hDisp) {
    const sheetWmm = (Number(wDisp) || 0) * factor
    const sheetHmm = (Number(hDisp) || 0) * factor
    onChangeSize(sheetWmm / 2, sheetHmm)
  }

  function setPresetMm(sheetWmm, sheetHmm) {
    onChangeSize(sheetWmm / 2, sheetHmm)
  }

  return (
    <div className="bg-white border-b border-neutral-300 px-4 py-2 flex items-center gap-3 flex-wrap">
      <div className="font-semibold text-neutral-800 mr-2">RevistaMaker</div>

      <button
        onClick={() => fileRef.current?.click()}
        className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        disabled={busy}
      >
        + Cargar imagenes / PDF
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".jpg,.jpeg,.png,.pdf"
        multiple
        onChange={(e) => {
          if (e.target.files?.length) onLoadFiles(Array.from(e.target.files))
          e.target.value = ''
        }}
        className="hidden"
      />

      <div className="flex items-center gap-1 text-sm">
        <span className="text-neutral-600">Hoja:</span>
        <input
          type="number"
          min="1"
          step="0.1"
          value={sheetWdisp}
          onChange={(e) => changeSheet(e.target.value, sheetHdisp)}
          className="w-16 px-1.5 py-1 border border-neutral-300 rounded text-right"
        />
        <span>x</span>
        <input
          type="number"
          min="1"
          step="0.1"
          value={sheetHdisp}
          onChange={(e) => changeSheet(sheetWdisp, e.target.value)}
          className="w-16 px-1.5 py-1 border border-neutral-300 rounded text-right"
        />
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="px-1 py-1 border border-neutral-300 rounded bg-white"
        >
          <option value="cm">cm</option>
          <option value="mm">mm</option>
        </select>

        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={() => setPresetMm(297, 210)}
            className="px-1.5 py-0.5 bg-neutral-100 border border-neutral-300 rounded text-xs hover:bg-neutral-200"
            title="Hoja A4 horizontal -> revista A5 (148x210 mm)"
          >
            A4 → A5
          </button>
          <button
            onClick={() => setPresetMm(420, 297)}
            className="px-1.5 py-0.5 bg-neutral-100 border border-neutral-300 rounded text-xs hover:bg-neutral-200"
            title="Hoja A3 horizontal -> revista A4 (210x297 mm)"
          >
            A3 → A4
          </button>
          <button
            onClick={() => setPresetMm(400, 150)}
            className="px-1.5 py-0.5 bg-neutral-100 border border-neutral-300 rounded text-xs hover:bg-neutral-200"
            title="Hoja 40x15 cm -> revista 20x15 cm"
          >
            40×15 cm
          </button>
        </div>
      </div>

      <div className="text-xs text-neutral-500">
        Cada pagina: {fmt(pageWmm)} x {fmt(pageHmm)} {unit}
      </div>

      <div className="text-sm text-neutral-600">
        {totalPages} pag · {Math.ceil(totalPages / 4)} pliegos
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => onExport('single')}
          disabled={!exportEnabled || busy}
          className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          title="Un solo PDF con pliegos (doble faz)"
        >
          Exportar PDF doble faz
        </button>
        <button
          onClick={() => onExport('split')}
          disabled={!exportEnabled || busy}
          className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          title="Dos PDFs separados: frentes y dorsos"
        >
          Exportar 2 PDFs (frentes/dorsos)
        </button>
        <button
          onClick={onClearAll}
          disabled={busy}
          className="px-3 py-1.5 bg-neutral-200 text-neutral-700 rounded hover:bg-neutral-300 text-sm"
        >
          Limpiar
        </button>
      </div>
    </div>
  )
}
