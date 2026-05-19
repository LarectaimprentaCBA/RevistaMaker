import React, { useEffect, useRef, useState } from 'react'

// Input numerico que guarda valor en MM internamente pero muestra/edita en la unidad
// seleccionada por el usuario (cm o mm). Mantiene un buffer de texto local mientras
// se edita para que se pueda escribir libremente (puntos decimales, borrar todo, etc.).
// Solo "commitea" al padre en onBlur o Enter.
function NumInputMm({ valueMm, factor, onCommitMm, className = '' }) {
  const formatted = (mm) => {
    const v = (mm || 0) / factor
    if (!Number.isFinite(v)) return ''
    return Number.isInteger(v) ? String(v) : v.toFixed(1)
  }

  const [text, setText] = useState(formatted(valueMm))
  const editingRef = useRef(false)

  // Sincronizar el buffer cuando cambia el valor desde afuera (presets, link hoja/pliego)
  // pero solo si NO estamos editando ahora mismo.
  useEffect(() => {
    if (!editingRef.current) setText(formatted(valueMm))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueMm, factor])

  function commit() {
    const norm = text.replace(',', '.').trim()
    const n = parseFloat(norm)
    if (Number.isFinite(n) && n > 0) {
      onCommitMm(n * factor)
    } else {
      // revertir al valor previo si quedo vacio o invalido
      setText(formatted(valueMm))
    }
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onFocus={() => {
        editingRef.current = true
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        editingRef.current = false
        commit()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        else if (e.key === 'Escape') {
          setText(formatted(valueMm))
          e.currentTarget.blur()
        }
      }}
      className={className}
    />
  )
}

export default function TopBar({
  pageWmm,
  pageHmm,
  sheetWmm,
  sheetHmm,
  copiesPerSheet,
  maxCopies,
  nupRotated,
  onChangePageSize,
  onChangeSheetSize,
  onChangeCopies,
  onResetSheet,
  onLoadFiles,
  onClearAll,
  onExport,
  exportEnabled,
  busy,
  totalPages,
}) {
  const fileRef = useRef(null)
  const [unit, setUnit] = useState('cm')

  const factor = unit === 'cm' ? 10 : 1

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

      {/* Tamano de pagina de la revista */}
      <div className="flex items-center gap-1 text-sm">
        <span className="text-neutral-600">Revista (1 pag):</span>
        <NumInputMm
          valueMm={pageWmm}
          factor={factor}
          onCommitMm={(mm) => onChangePageSize(mm, pageHmm)}
          className="w-14 px-1.5 py-1 border border-neutral-300 rounded text-right"
        />
        <span>x</span>
        <NumInputMm
          valueMm={pageHmm}
          factor={factor}
          onCommitMm={(mm) => onChangePageSize(pageWmm, mm)}
          className="w-14 px-1.5 py-1 border border-neutral-300 rounded text-right"
        />
        <div className="flex items-center gap-1 ml-1">
          <button
            onClick={() => onChangePageSize(148, 210)}
            className="px-1.5 py-0.5 bg-neutral-100 border border-neutral-300 rounded text-xs hover:bg-neutral-200"
            title="A5 vertical (148x210 mm)"
          >
            A5
          </button>
          <button
            onClick={() => onChangePageSize(210, 297)}
            className="px-1.5 py-0.5 bg-neutral-100 border border-neutral-300 rounded text-xs hover:bg-neutral-200"
            title="A4 vertical (210x297 mm)"
          >
            A4
          </button>
        </div>
      </div>

      {/* Tamano de la hoja de impresion */}
      <div className="flex items-center gap-1 text-sm">
        <span className="text-neutral-600">Hoja imp:</span>
        <NumInputMm
          valueMm={sheetWmm}
          factor={factor}
          onCommitMm={(mm) => onChangeSheetSize(mm, sheetHmm)}
          className="w-14 px-1.5 py-1 border border-neutral-300 rounded text-right"
        />
        <span>x</span>
        <NumInputMm
          valueMm={sheetHmm}
          factor={factor}
          onCommitMm={(mm) => onChangeSheetSize(sheetWmm, mm)}
          className="w-14 px-1.5 py-1 border border-neutral-300 rounded text-right"
        />
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="px-1 py-1 border border-neutral-300 rounded bg-white"
        >
          <option value="cm">cm</option>
          <option value="mm">mm</option>
        </select>
        <div className="flex items-center gap-1 ml-1">
          <button
            onClick={onResetSheet}
            className="px-1.5 py-0.5 bg-neutral-100 border border-neutral-300 rounded text-xs hover:bg-neutral-200"
            title="Hoja = pliego (1 copia)"
          >
            =Pliego
          </button>
          <button
            onClick={() => onChangeSheetSize(297, 210)}
            className="px-1.5 py-0.5 bg-neutral-100 border border-neutral-300 rounded text-xs hover:bg-neutral-200"
            title="A4 horizontal (297x210 mm)"
          >
            A4 h
          </button>
          <button
            onClick={() => onChangeSheetSize(420, 297)}
            className="px-1.5 py-0.5 bg-neutral-100 border border-neutral-300 rounded text-xs hover:bg-neutral-200"
            title="A3 horizontal (420x297 mm)"
          >
            A3 h
          </button>
          <button
            onClick={() => onChangeSheetSize(450, 320)}
            className="px-1.5 py-0.5 bg-neutral-100 border border-neutral-300 rounded text-xs hover:bg-neutral-200"
            title="SRA3 horizontal (450x320 mm)"
          >
            SRA3
          </button>
        </div>
      </div>

      {/* Copias por hoja */}
      <div className="flex items-center gap-1 text-sm">
        <span className="text-neutral-600">Copias/hoja:</span>
        <input
          type="number"
          min="1"
          max={Math.max(1, maxCopies)}
          step="1"
          value={copiesPerSheet || 1}
          onChange={(e) => {
            const raw = Number(e.target.value)
            if (!Number.isFinite(raw) || raw < 1) return
            onChangeCopies(Math.min(Math.max(1, maxCopies || 1), raw))
          }}
          className="w-12 px-1.5 py-1 border border-neutral-300 rounded text-right disabled:bg-neutral-100 disabled:text-neutral-400"
          disabled={!maxCopies}
        />
        <span
          className={`text-xs ${maxCopies > 1 ? 'text-emerald-700' : 'text-neutral-500'}`}
          title={nupRotated ? 'Las copias se imponen rotadas 90°' : ''}
        >
          (entran {maxCopies}{nupRotated ? ' rot.' : ''})
        </span>
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
