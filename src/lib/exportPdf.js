import { PDFDocument, degrees, rgb } from 'pdf-lib'
import { imposeSaddleStitch } from './imposition'
import { chooseLayout, buildPositions } from './nup'

const MM_TO_PT = 72 / 25.4

async function buildPageDrawers(pages, targetDoc) {
  const cache = new Map()

  async function getDrawer(page) {
    if (cache.has(page.id)) return cache.get(page.id)

    let drawer
    if (page.type === 'image') {
      const img = page.imageMime === 'image/png'
        ? await targetDoc.embedPng(page.imageBytes)
        : await targetDoc.embedJpg(page.imageBytes)
      drawer = (pdfPage, x, y, w, h) => {
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
      drawer = () => {}
    }

    cache.set(page.id, drawer)
    return drawer
  }

  return getDrawer
}

// Construye un PDF "fuente" con todos los pliegos (frente y dorso intercalados, en orden
// de pliego 1 frente, pliego 1 dorso, pliego 2 frente, ...). Cada pagina del PDF fuente
// es UNA hoja del pliego, del tamano nativo del pliego (2*pageW × pageH en mm).
async function buildSourcePliegosDoc(pages, pageWmm, pageHmm) {
  const sheets = imposeSaddleStitch(pages.length)
  const doc = await PDFDocument.create()
  const getDrawer = await buildPageDrawers(pages, doc)

  const pliegoWpt = 2 * pageWmm * MM_TO_PT
  const pliegoHpt = pageHmm * MM_TO_PT
  const halfW = pageWmm * MM_TO_PT

  const order = []

  async function addSide(side, sheetSide) {
    const p = doc.addPage([pliegoWpt, pliegoHpt])
    const [leftIdx, rightIdx] = sheetSide
    const leftPage = pages[leftIdx - 1]
    const rightPage = pages[rightIdx - 1]
    if (leftPage) (await getDrawer(leftPage))(p, 0, 0, halfW, pliegoHpt)
    if (rightPage) (await getDrawer(rightPage))(p, halfW, 0, halfW, pliegoHpt)
    order.push(side)
  }

  for (const sh of sheets) {
    await addSide('front', sh.front)
    await addSide('back', sh.back)
  }

  return { doc, order, pliegoWpt, pliegoHpt }
}

// Dibuja un pliego embebido dentro de la caja {x,y,w,h} de la hoja de salida,
// rotado 90° en sentido horario si rotated=true.
function drawPliegoIntoBox(outPage, embPliego, pos) {
  const { x, y, w, h, rotated } = pos
  if (!rotated) {
    outPage.drawPage(embPliego, { x, y, width: w, height: h })
  } else {
    // El pliego nativo mide pliegoWpt × pliegoHpt. Rotado 90° CW ocupa h × w en bbox.
    // pdf-lib: rotate gira en sentido antihorario alrededor del punto (x,y) (bottom-left).
    // Para 90° CW = -90° CCW, el anchor queda en (x, y + h) y dimensiones intercambiadas.
    outPage.drawPage(embPliego, {
      x,
      y: y + h,
      width: h,
      height: w,
      rotate: degrees(-90),
    })
  }
}

// Marcas de corte alrededor de las copias. Modos:
//   'lines'   : lineas grises sobre los bordes del grid de copias (verticales y horizontales).
//   'corners' : crucecitas tipo trim marks justo afuera de cada copia.
function drawCropMarks(outPage, positions, mode, sheetWpt, sheetHpt) {
  if (!positions || positions.length === 0) return
  if (mode === 'none') return

  const gray = rgb(0.35, 0.35, 0.35)

  if (mode === 'lines') {
    // Bordes unicos del grid (verticales en x_start, x_start+copyW, ...; idem horizontales).
    const xs = new Set()
    const ys = new Set()
    for (const p of positions) {
      xs.add(p.x)
      xs.add(p.x + p.w)
      ys.add(p.y)
      ys.add(p.y + p.h)
    }
    const lineW = 0.4
    for (const xv of xs) {
      outPage.drawLine({
        start: { x: xv, y: 0 },
        end: { x: xv, y: sheetHpt },
        thickness: lineW,
        color: gray,
      })
    }
    for (const yv of ys) {
      outPage.drawLine({
        start: { x: 0, y: yv },
        end: { x: sheetWpt, y: yv },
        thickness: lineW,
        color: gray,
      })
    }
    return
  }

  if (mode === 'corners') {
    // Crucecitas en las 4 esquinas de cada copia. Longitud 4 mm, gap 1 mm respecto al borde.
    const len = 4 * MM_TO_PT
    const gap = 1 * MM_TO_PT
    const lineW = 0.5

    function mark(cx, cy, dirX, dirY) {
      // Linea horizontal saliendo desde (cx + dirX*gap, cy) hacia afuera (dirX).
      outPage.drawLine({
        start: { x: cx + dirX * gap, y: cy },
        end: { x: cx + dirX * (gap + len), y: cy },
        thickness: lineW,
        color: gray,
      })
      // Linea vertical saliendo desde (cx, cy + dirY*gap) hacia afuera (dirY).
      outPage.drawLine({
        start: { x: cx, y: cy + dirY * gap },
        end: { x: cx, y: cy + dirY * (gap + len) },
        thickness: lineW,
        color: gray,
      })
    }

    for (const p of positions) {
      // Esquinas de la copia: (x, y), (x+w, y), (x, y+h), (x+w, y+h)
      mark(p.x, p.y, -1, -1)         // inferior izq
      mark(p.x + p.w, p.y, +1, -1)   // inferior der
      mark(p.x, p.y + p.h, -1, +1)   // superior izq
      mark(p.x + p.w, p.y + p.h, +1, +1) // superior der
    }
  }
}

// Genera 1 PDF de salida con N copias por hoja. filter selecciona que pliegos van
// ('front', 'back' o ambos).
async function buildOutputDoc(srcBytes, srcOrder, filter, layout, sheetWpt, sheetHpt, cropMarks) {
  const outDoc = await PDFDocument.create()
  const indices = []
  for (let i = 0; i < srcOrder.length; i++) {
    if (filter(srcOrder[i])) indices.push(i)
  }
  if (indices.length === 0) return await outDoc.save()

  const embedded = await outDoc.embedPdf(srcBytes, indices)

  for (let i = 0; i < embedded.length; i++) {
    const side = srcOrder[indices[i]]
    const embPliego = embedded[i]
    const outP = outDoc.addPage([sheetWpt, sheetHpt])
    const positions = buildPositions(layout, sheetWpt, sheetHpt, side)
    for (const pos of positions) {
      drawPliegoIntoBox(outP, embPliego, pos)
    }
    drawCropMarks(outP, positions, cropMarks, sheetWpt, sheetHpt)
  }

  return await outDoc.save()
}

export async function buildImposedPdfs({
  pages,
  pageWmm,
  pageHmm,
  sheetWmm,
  sheetHmm,
  copiesPerSheet,
  mode,
  cropMarks = 'none',
}) {
  if (pages.length % 4 !== 0) {
    throw new Error('La cantidad de paginas debe ser multiplo de 4')
  }

  // Defaults compatibles con el comportamiento anterior: hoja = pliego (1 copia).
  const pliegoWmm = 2 * pageWmm
  const pliegoHmm = pageHmm
  const finalSheetW = sheetWmm && sheetWmm > 0 ? sheetWmm : pliegoWmm
  const finalSheetH = sheetHmm && sheetHmm > 0 ? sheetHmm : pliegoHmm

  const layout = chooseLayout(pliegoWmm, pliegoHmm, finalSheetW, finalSheetH, copiesPerSheet)
  if (layout.copies <= 0) {
    throw new Error('La hoja de impresion es mas chica que el pliego de la revista')
  }

  // Convertir layout a puntos PDF.
  const layoutPt = {
    ...layout,
    copyW: layout.copyW * MM_TO_PT,
    copyH: layout.copyH * MM_TO_PT,
  }
  const sheetWpt = finalSheetW * MM_TO_PT
  const sheetHpt = finalSheetH * MM_TO_PT

  const { doc: srcDoc, order } = await buildSourcePliegosDoc(pages, pageWmm, pageHmm)
  const srcBytes = await srcDoc.save()

  if (mode === 'single') {
    const bytes = await buildOutputDoc(srcBytes, order, () => true, layoutPt, sheetWpt, sheetHpt, cropMarks)
    return { single: bytes }
  }

  const fronts = await buildOutputDoc(srcBytes, order, (s) => s === 'front', layoutPt, sheetWpt, sheetHpt, cropMarks)
  const backs = await buildOutputDoc(srcBytes, order, (s) => s === 'back', layoutPt, sheetWpt, sheetHpt, cropMarks)
  return { fronts, backs }
}
