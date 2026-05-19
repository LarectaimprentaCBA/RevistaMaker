import React, { useCallback, useEffect, useMemo, useState } from 'react'
import TopBar from './components/TopBar.jsx'
import Spread from './components/Spread.jsx'
import SortablePageStrip from './components/SortablePageStrip.jsx'
import ExportDialog from './components/ExportDialog.jsx'
import { loadFilesAsPages, makeBlankPage } from './lib/fileLoader.js'
import { needsForMultipleOfFour } from './lib/imposition.js'
import { buildImposedPdfs } from './lib/exportPdf.js'
import { calcMaxNUp } from './lib/nup.js'

export default function App() {
  const [pages, setPages] = useState([])
  const [pageWmm, setPageWmm] = useState(148) // A5 default
  const [pageHmm, setPageHmm] = useState(210)
  // Hoja de impresion: arranca igual al pliego (1 copia, comportamiento previo).
  const [sheetWmm, setSheetWmm] = useState(2 * 148)
  const [sheetHmm, setSheetHmm] = useState(210)
  const [copiesPerSheet, setCopiesPerSheet] = useState(1)
  const [sheetLinked, setSheetLinked] = useState(true) // si true, sheet sigue automaticamente al pliego
  const [spreadIndex, setSpreadIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)
  const [updater, setUpdater] = useState(null)
  const [exportRequest, setExportRequest] = useState(null) // { mode } | null

  useEffect(() => {
    if (!window.api?.onUpdaterStatus) return
    return window.api.onUpdaterStatus((payload) => setUpdater(payload))
  }, [])

  const validation = needsForMultipleOfFour(pages.length)
  const spreadCount = Math.max(1, Math.ceil((pages.length + 1) / 2))
  const pliegoCount = Math.ceil(pages.length / 4)

  // Recalcular layout n-up cuando cambian dimensiones.
  const nup = useMemo(
    () => calcMaxNUp(2 * pageWmm, pageHmm, sheetWmm, sheetHmm),
    [pageWmm, pageHmm, sheetWmm, sheetHmm]
  )

  // Si la hoja esta "linkeada" al pliego, mantenerla sincronizada cuando cambia el pliego.
  useEffect(() => {
    if (sheetLinked) {
      setSheetWmm(2 * pageWmm)
      setSheetHmm(pageHmm)
    }
  }, [pageWmm, pageHmm, sheetLinked])

  // Al cambiar dimensiones de hoja o pliego, resetear copias al maximo (auto).
  // El override manual del usuario se mantiene mientras no cambien las dimensiones.
  useEffect(() => {
    setCopiesPerSheet(Math.max(1, nup.maxCopies))
  }, [pageWmm, pageHmm, sheetWmm, sheetHmm])

  useEffect(() => {
    if (spreadIndex >= spreadCount) setSpreadIndex(Math.max(0, spreadCount - 1))
  }, [spreadCount, spreadIndex])

  function showToast(msg, kind = 'info', ms = 4000) {
    setToast({ msg, kind })
    setTimeout(() => setToast((t) => (t?.msg === msg ? null : t)), ms)
  }

  const handleLoadFiles = useCallback(async (files) => {
    setBusy(true)
    try {
      const newPages = await loadFilesAsPages(files)
      setPages((prev) => [...prev, ...newPages])
      showToast(`Cargadas ${newPages.length} paginas`, 'info')
    } catch (err) {
      console.error(err)
      showToast(`Error al cargar: ${err.message}`, 'error')
    } finally {
      setBusy(false)
    }
  }, [])

  function handleDropZone(e) {
    e.preventDefault()
    if (e.dataTransfer?.files?.length) {
      handleLoadFiles(Array.from(e.dataTransfer.files))
    }
  }

  function handleReorder(newPages) {
    setPages(newPages)
  }

  function handleRemove(id) {
    setPages((prev) => prev.filter((p) => p.id !== id))
  }

  function handleAddBlank() {
    setPages((prev) => [...prev, makeBlankPage()])
  }

  function handleClearAll() {
    if (pages.length === 0) return
    if (confirm('Quitar todas las paginas cargadas?')) setPages([])
  }

  function handleChangePageSize(w, h) {
    setPageWmm(w)
    setPageHmm(h)
  }

  function handleChangeSheetSize(w, h) {
    setSheetLinked(false)
    setSheetWmm(w)
    setSheetHmm(h)
  }

  function handleResetSheet() {
    setSheetLinked(true)
    setSheetWmm(2 * pageWmm)
    setSheetHmm(pageHmm)
  }

  function handleRequestExport(mode) {
    if (!validation.ok) {
      showToast(`Faltan ${validation.missing} paginas para multiplo de 4`, 'error')
      return
    }
    if (!pageWmm || !pageHmm || pageWmm < 10 || pageHmm < 10) {
      showToast('Tamaño de pagina invalido', 'error')
      return
    }
    if (nup.maxCopies <= 0) {
      showToast('La hoja de impresion es mas chica que el pliego de la revista', 'error')
      return
    }
    setExportRequest({ mode })
  }

  async function handleConfirmExport(cropMarks) {
    const req = exportRequest
    setExportRequest(null)
    if (!req) return
    setBusy(true)
    try {
      const result = await buildImposedPdfs({
        pages,
        pageWmm,
        pageHmm,
        sheetWmm,
        sheetHmm,
        copiesPerSheet,
        mode: req.mode,
        cropMarks,
      })

      if (req.mode === 'single') {
        const filePath = await window.api.saveFile({
          defaultPath: `revista_${pages.length}p.pdf`,
          filters: [{ name: 'PDF', extensions: ['pdf'] }],
        })
        if (!filePath) return
        await window.api.writeFile({ filePath, bytes: result.single })
        showToast(`Guardado: ${filePath}`, 'info', 6000)
      } else {
        const frontsPath = await window.api.saveFile({
          defaultPath: `revista_${pages.length}p_frentes.pdf`,
          filters: [{ name: 'PDF', extensions: ['pdf'] }],
        })
        if (!frontsPath) return
        await window.api.writeFile({ filePath: frontsPath, bytes: result.fronts })

        const backsPath = await window.api.saveFile({
          defaultPath: `revista_${pages.length}p_dorsos.pdf`,
          filters: [{ name: 'PDF', extensions: ['pdf'] }],
        })
        if (!backsPath) return
        await window.api.writeFile({ filePath: backsPath, bytes: result.backs })
        showToast(`Guardados: frentes y dorsos`, 'info', 6000)
      }
    } catch (err) {
      console.error(err)
      showToast(`Error al exportar: ${err.message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'ArrowLeft') setSpreadIndex((i) => Math.max(0, i - 1))
      else if (e.key === 'ArrowRight') setSpreadIndex((i) => Math.min(spreadCount - 1, i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [spreadCount])

  return (
    <div
      className="h-full flex flex-col"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDropZone}
    >
      {updater?.state === 'downloaded' && (
        <div className="bg-blue-600 text-white px-4 py-2 text-sm flex items-center justify-between">
          <span>
            Hay una version nueva ({updater.version}) lista para instalar.
          </span>
          <button
            onClick={() => window.api.installUpdate()}
            className="ml-3 px-3 py-1 bg-white text-blue-700 rounded text-xs font-semibold hover:bg-blue-50"
          >
            Reiniciar e instalar
          </button>
        </div>
      )}
      {updater?.state === 'downloading' && (
        <div className="bg-blue-100 text-blue-900 px-4 py-1 text-xs">
          Descargando actualizacion... {updater.percent ?? 0}%
        </div>
      )}

      <TopBar
        pageWmm={pageWmm}
        pageHmm={pageHmm}
        sheetWmm={sheetWmm}
        sheetHmm={sheetHmm}
        copiesPerSheet={copiesPerSheet}
        maxCopies={nup.maxCopies}
        nupRotated={nup.rotated}
        onChangePageSize={handleChangePageSize}
        onChangeSheetSize={handleChangeSheetSize}
        onChangeCopies={setCopiesPerSheet}
        onResetSheet={handleResetSheet}
        onLoadFiles={handleLoadFiles}
        onClearAll={handleClearAll}
        onExport={handleRequestExport}
        exportEnabled={validation.ok && pages.length > 0}
        busy={busy}
        totalPages={pages.length}
      />

      {!validation.ok && pages.length > 0 && (
        <div className="bg-amber-100 border-b border-amber-300 text-amber-900 px-4 py-2 text-sm">
          La cantidad de paginas ({pages.length}) no es multiplo de 4. Faltan{' '}
          <b>{validation.missing}</b> pagina{validation.missing === 1 ? '' : 's'} para poder armar
          la revista. Agrega paginas o usa "+ Pagina en blanco" abajo.
        </div>
      )}

      {nup.maxCopies <= 0 && pages.length > 0 && (
        <div className="bg-red-100 border-b border-red-300 text-red-900 px-4 py-2 text-sm">
          La hoja de impresion ({(sheetWmm / 10).toFixed(1)}×{(sheetHmm / 10).toFixed(1)} cm) es mas
          chica que el pliego de la revista ({(2 * pageWmm / 10).toFixed(1)}×{(pageHmm / 10).toFixed(1)} cm).
          Agranda la hoja o achica la revista.
        </div>
      )}

      {pages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-neutral-500">
          <div className="text-center">
            <div className="text-lg mb-2">Soltá archivos aca</div>
            <div className="text-sm">JPG, PNG o PDF. Los PDFs se separan en paginas individuales.</div>
          </div>
        </div>
      ) : (
        <Spread
          pages={pages}
          spreadIndex={spreadIndex}
          pageWmm={pageWmm}
          pageHmm={pageHmm}
          onPrev={() => setSpreadIndex((i) => Math.max(0, i - 1))}
          onNext={() => setSpreadIndex((i) => Math.min(spreadCount - 1, i + 1))}
        />
      )}

      {pages.length > 0 && (
        <SortablePageStrip
          pages={pages}
          currentIndex={spreadIndex === 0 ? -1 : spreadIndex * 2 - 1}
          onReorder={handleReorder}
          onSelect={(i) => setSpreadIndex(Math.max(0, Math.ceil((i + 1) / 2) - (i === 0 ? 1 : 0)))}
          onRemove={handleRemove}
          onAddBlank={handleAddBlank}
        />
      )}

      <ExportDialog
        open={!!exportRequest}
        mode={exportRequest?.mode}
        totalPages={pages.length}
        pliegoCount={pliegoCount}
        copiesPerSheet={copiesPerSheet}
        sheetWmm={sheetWmm}
        sheetHmm={sheetHmm}
        onCancel={() => setExportRequest(null)}
        onConfirm={handleConfirmExport}
      />

      {toast && (
        <div
          className={`fixed bottom-4 right-4 px-4 py-2 rounded shadow-lg text-sm text-white ${
            toast.kind === 'error' ? 'bg-red-600' : 'bg-neutral-800'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}
