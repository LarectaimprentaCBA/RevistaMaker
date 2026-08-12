import { PDFDocument, degrees, rgb } from 'pdf-lib'
import { imposeSaddleStitch } from './imposition'
import { chooseLayout, buildPositions } from './nup'

const MM_TO_PT = 72 / 25.4

// Encaja un contenido de srcW×srcH dentro de la caja w×h conservando la
// proporcion, centrado. Devuelve el tamano dibujado y el offset dentro de la caja.
function fitIntoBox(srcW, srcH, w, h) {
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
  return { drawW, drawH, offX: (w - drawW) / 2, offY: (h - drawH) / 2 }
}

// Dibuja una pagina embebida ocupando exactamente la caja (x, y, w, h), donde w y h
// son las medidas YA VISIBLES, aplicando el /Rotate que traia el PDF original.
// pdf-lib rota en sentido antihorario alrededor del punto (x, y) que le pasamos, y
// escala con width/height contra las dimensiones SIN rotar del XObject: por eso en
// 90 y 270 hay que intercambiarlas y mover el ancla a la esquina que corresponde.
function drawEmbeddedPage(pdfPage, embedded, x, y, w, h, rotation) {
  if (rotation === 90) {
    pdfPage.drawPage(embedded, { x, y: y + h, width: h, height: w, rotate: degrees(-90) })
  } else if (rotation === 180) {
    pdfPage.drawPage(embedded, { x: x + w, y: y + h, width: w, height: h, rotate: degrees(180) })
  } else if (rotation === 270) {
    pdfPage.drawPage(embedded, { x: x + w, y, width: h, height: w, rotate: degrees(90) })
  } else {
    pdfPage.drawPage(embedded, { x, y, width: w, height: h })
  }
}

async function buildPageDrawers(pages, targetDoc) {
  const cache = new Map()
  // Un mismo archivo PDF aporta varias paginas: lo parseamos una sola vez.
  // La clave es el Uint8Array, que fileLoader comparte entre las paginas del archivo.
  const srcDocs = new Map()

  function loadSourceDoc(bytes) {
    let p = srcDocs.get(bytes)
    if (!p) {
      p = PDFDocument.load(bytes)
      srcDocs.set(bytes, p)
    }
    return p
  }

  async function getDrawer(page) {
    if (cache.has(page.id)) return cache.get(page.id)

    let drawer
    if (page.type === 'image') {
      const img = page.imageMime === 'image/png'
        ? await targetDoc.embedPng(page.imageBytes)
        : await targetDoc.embedJpg(page.imageBytes)
      drawer = (pdfPage, x, y, w, h) => {
        const { drawW, drawH, offX, offY } = fitIntoBox(img.width, img.height, w, h)
        pdfPage.drawImage(img, { x: x + offX, y: y + offY, width: drawW, height: drawH })
      }
    } else if (page.type === 'pdf') {
      const srcDoc = await loadSourceDoc(page.pdfBytes)
      const srcPage = srcDoc.getPage(page.pdfPageIndex)

      // Por defecto pdf-lib embebe usando el MediaBox y ademas le fuerza el origen a
      // (0, 0). Si el PDF trae el origen desplazado —Canva exporta con y=7.83pt— el
      // contenido queda corrido: banda en blanco de ese alto abajo y el mismo recorte
      // arriba. Pasandole el CropBox con su origen real, pdf-lib arma la Matrix que lo
      // compensa. getCropBox() cae al MediaBox cuando el PDF no declara CropBox.
      const box = srcPage.getCropBox()
      const embedded = await targetDoc.embedPage(srcPage, {
        left: box.x,
        bottom: box.y,
        right: box.x + box.width,
        top: box.y + box.height,
      })

      // pdf-lib tampoco aplica el /Rotate de la pagina fuente al embeberla (los visores
      // si lo respetan), asi que lo compensamos nosotros al dibujar.
      const rotation = ((srcPage.getRotation().angle % 360) + 360) % 360
      const swapped = rotation === 90 || rotation === 270
      const visibleW = swapped ? embedded.height : embedded.width
      const visibleH = swapped ? embedded.width : embedded.height

      drawer = (pdfPage, x, y, w, h) => {
        const { drawW, drawH, offX, offY } = fitIntoBox(visibleW, visibleH, w, h)
        drawEmbeddedPage(pdfPage, embedded, x + offX, y + offY, drawW, drawH, rotation)
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
