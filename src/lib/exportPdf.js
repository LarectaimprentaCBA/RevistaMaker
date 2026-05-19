import { PDFDocument } from 'pdf-lib'
import { imposeSaddleStitch } from './imposition'

const MM_TO_PT = 72 / 25.4

// Para cada page object del array (1-indexed dentro del documento), embebe el recurso
// y devuelve un draw(targetDoc, x, y, w, h) que dibuja esa pagina en una hoja.
async function buildPageDrawers(pages, targetDoc) {
  // pages aqui es el array de objetos Page del modelo (orden tal cual se va a leer la revista).
  // Cache de embeds para no re-embeber un mismo recurso.
  const cache = new Map()

  async function getDrawer(page) {
    if (cache.has(page.id)) return cache.get(page.id)

    let drawer
    if (page.type === 'image') {
      const img = page.imageMime === 'image/png'
        ? await targetDoc.embedPng(page.imageBytes)
        : await targetDoc.embedJpg(page.imageBytes)
      drawer = (pdfPage, x, y, w, h) => {
        // Ajustar imagen al box manteniendo aspecto (fit interior, centrado).
        const imgAspect = img.width / img.height
        const boxAspect = w / h
        let drawW, drawH
        if (imgAspect > boxAspect) {
          drawW = w
          drawH = w / imgAspect
        } else {
          drawH = h
          drawW = h * imgAspect
        }
        const drawX = x + (w - drawW) / 2
        const drawY = y + (h - drawH) / 2
        pdfPage.drawImage(img, { x: drawX, y: drawY, width: drawW, height: drawH })
      }
    } else if (page.type === 'pdf') {
      const [embedded] = await targetDoc.embedPdf(page.pdfBytes, [page.pdfPageIndex])
      drawer = (pdfPage, x, y, w, h) => {
        const srcW = embedded.width
        const srcH = embedded.height
        const srcAspect = srcW / srcH
        const boxAspect = w / h
        let drawW, drawH
        if (srcAspect > boxAspect) {
          drawW = w
          drawH = w / srcAspect
        } else {
          drawH = h
          drawW = h * srcAspect
        }
        const drawX = x + (w - drawW) / 2
        const drawY = y + (h - drawH) / 2
        pdfPage.drawPage(embedded, {
          x: drawX,
          y: drawY,
          width: drawW,
          height: drawH,
        })
      }
    } else {
      // blank
      drawer = () => {}
    }

    cache.set(page.id, drawer)
    return drawer
  }

  return getDrawer
}

// Dibuja un pliego (sheet side = "front"|"back") en una nueva hoja del doc destino.
// pageWmm/pageHmm son las dimensiones de la pagina final de la revista (cada mitad).
// El pliego tiene ancho = 2 * pageWmm.
async function addSheetSide(targetDoc, pages, sideIndices, pageWmm, pageHmm, getDrawer) {
  const sheetW = 2 * pageWmm * MM_TO_PT
  const sheetH = pageHmm * MM_TO_PT
  const pdfPage = targetDoc.addPage([sheetW, sheetH])
  const halfW = pageWmm * MM_TO_PT

  // sideIndices = [leftPageNumber, rightPageNumber] (1-indexed sobre pages[])
  const [leftIdx, rightIdx] = sideIndices
  const leftPage = pages[leftIdx - 1]
  const rightPage = pages[rightIdx - 1]

  if (leftPage) {
    const drawLeft = await getDrawer(leftPage)
    drawLeft(pdfPage, 0, 0, halfW, sheetH)
  }
  if (rightPage) {
    const drawRight = await getDrawer(rightPage)
    drawRight(pdfPage, halfW, 0, halfW, sheetH)
  }
}

export async function buildImposedPdfs({ pages, pageWmm, pageHmm, mode }) {
  if (pages.length % 4 !== 0) {
    throw new Error('La cantidad de paginas debe ser multiplo de 4')
  }

  const sheets = imposeSaddleStitch(pages.length)

  if (mode === 'single') {
    const doc = await PDFDocument.create()
    const getDrawer = await buildPageDrawers(pages, doc)
    // Orden: pliego 1 frente, pliego 1 dorso, pliego 2 frente, pliego 2 dorso, ...
    for (const sheet of sheets) {
      await addSheetSide(doc, pages, sheet.front, pageWmm, pageHmm, getDrawer)
      await addSheetSide(doc, pages, sheet.back, pageWmm, pageHmm, getDrawer)
    }
    const bytes = await doc.save()
    return { single: bytes }
  }

  // mode === 'split'
  const frontsDoc = await PDFDocument.create()
  const backsDoc = await PDFDocument.create()
  const frontsDrawer = await buildPageDrawers(pages, frontsDoc)
  const backsDrawer = await buildPageDrawers(pages, backsDoc)
  for (const sheet of sheets) {
    await addSheetSide(frontsDoc, pages, sheet.front, pageWmm, pageHmm, frontsDrawer)
    await addSheetSide(backsDoc, pages, sheet.back, pageWmm, pageHmm, backsDrawer)
  }
  const frontsBytes = await frontsDoc.save()
  const backsBytes = await backsDoc.save()
  return { fronts: frontsBytes, backs: backsBytes }
}
