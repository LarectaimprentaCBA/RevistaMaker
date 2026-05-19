import { pdfjsLib } from './pdfjsSetup'

let pageIdCounter = 1
const nextId = () => `p${pageIdCounter++}`

function readAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(r.error)
    r.readAsArrayBuffer(file)
  })
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

// Renderiza una pagina del PDF a dataURL JPEG (para thumbnail y preview).
async function renderPdfPageToDataUrl(pdfDoc, pageIndex, maxSide = 600) {
  const page = await pdfDoc.getPage(pageIndex + 1)
  const viewport0 = page.getViewport({ scale: 1 })
  const scale = Math.min(maxSide / viewport0.width, maxSide / viewport0.height, 4)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const ctx = canvas.getContext('2d')
  await page.render({ canvasContext: ctx, viewport }).promise
  return canvas.toDataURL('image/jpeg', 0.85)
}

export async function loadFilesAsPages(files) {
  const newPages = []
  for (const file of files) {
    const lower = file.name.toLowerCase()
    if (lower.endsWith('.pdf')) {
      const bytes = new Uint8Array(await readAsArrayBuffer(file))
      // Loading task usa una copia porque pdfjs puede transferir el buffer
      const loadingTask = pdfjsLib.getDocument({ data: bytes.slice() })
      const pdf = await loadingTask.promise
      for (let i = 0; i < pdf.numPages; i++) {
        const thumb = await renderPdfPageToDataUrl(pdf, i, 600)
        newPages.push({
          id: nextId(),
          type: 'pdf',
          sourceName: `${file.name} p${i + 1}`,
          pdfBytes: bytes,
          pdfPageIndex: i,
          thumbDataUrl: thumb,
        })
      }
    } else if (
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.png')
    ) {
      const dataUrl = await readAsDataUrl(file)
      const bytes = new Uint8Array(await readAsArrayBuffer(file))
      newPages.push({
        id: nextId(),
        type: 'image',
        sourceName: file.name,
        imageBytes: bytes,
        imageMime: lower.endsWith('.png') ? 'image/png' : 'image/jpeg',
        thumbDataUrl: dataUrl,
      })
    } else {
      console.warn('Tipo no soportado:', file.name)
    }
  }
  return newPages
}

export function makeBlankPage() {
  return {
    id: nextId(),
    type: 'blank',
    sourceName: '(en blanco)',
    thumbDataUrl: null,
  }
}
