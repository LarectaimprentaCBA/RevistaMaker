import React, { useState } from 'react'

export default function ExportDialog({
  open,
  mode,
  totalPages,
  pliegoCount,
  copiesPerSheet,
  sheetWmm,
  sheetHmm,
  onCancel,
  onConfirm,
}) {
  const [cropMarks, setCropMarks] = useState('none')

  if (!open) return null

  const physicalSheets = Math.ceil(pliegoCount / copiesPerSheet)
  const totalOutputPages = physicalSheets * 2 // frente + dorso de cada hoja fisica
  const fmtCm = (mm) => (mm / 10).toFixed(mm % 10 === 0 ? 0 : 1)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-[460px] max-w-[92vw] p-5">
        <div className="text-lg font-semibold text-neutral-800 mb-1">
          {mode === 'single' ? 'Exportar PDF doble faz' : 'Exportar 2 PDFs (frentes / dorsos)'}
        </div>
        <div className="text-sm text-neutral-600 mb-4">
          {totalPages} pag · {pliegoCount} pliego{pliegoCount === 1 ? '' : 's'} · {copiesPerSheet}{' '}
          {copiesPerSheet === 1 ? 'copia' : 'copias'} por hoja → <b>{physicalSheets}</b> hoja{physicalSheets === 1 ? '' : 's'} fisica{physicalSheets === 1 ? '' : 's'}
          {' '}({totalOutputPages} pag de salida) en hoja {fmtCm(sheetWmm)}×{fmtCm(sheetHmm)} cm
        </div>

        <div className="text-sm font-medium text-neutral-700 mb-2">Marcas de corte</div>
        <div className="flex flex-col gap-2 mb-4">
          {[
            { value: 'none', label: 'Ninguna', desc: 'Sin marcas. Las copias se imponen pegadas en el grid.' },
            { value: 'lines', label: 'Lineas finas entre copias', desc: 'Lineas grises sobre los bordes del grid; sirven de guia para guillotina.' },
            { value: 'corners', label: 'Cruces en las esquinas (trim marks)', desc: 'Crucecitas en las 4 esquinas de cada copia, justo afuera del area imprimible.' },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-2 p-2 rounded border cursor-pointer ${
                cropMarks === opt.value ? 'border-blue-500 bg-blue-50' : 'border-neutral-200 hover:bg-neutral-50'
              }`}
            >
              <input
                type="radio"
                name="cropMarks"
                value={opt.value}
                checked={cropMarks === opt.value}
                onChange={() => setCropMarks(opt.value)}
                className="mt-1"
              />
              <div>
                <div className="text-sm text-neutral-800">{opt.label}</div>
                <div className="text-xs text-neutral-500">{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>

        {copiesPerSheet > 1 && (
          <div className="text-xs text-neutral-500 mb-4 border-l-2 border-amber-300 pl-2">
            Imprimi en doble faz con <b>voltear sobre el borde largo</b> (Long edge / Lado largo). El
            dorso se imprime espejado horizontalmente para que cada copia quede alineada con su frente.
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 bg-neutral-200 text-neutral-700 rounded hover:bg-neutral-300 text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(cropMarks)}
            className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
          >
            Exportar
          </button>
        </div>
      </div>
    </div>
  )
}
