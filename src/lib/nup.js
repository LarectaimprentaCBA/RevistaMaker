// Calculo de imposicion N-up: cuantas copias del mismo pliego entran en una hoja.
// Todas las dimensiones aqui se pasan en la unidad que el caller elija (ej. mm).
// Devuelve siempre el resultado en la misma unidad.

// Probar las dos orientaciones del pliego y devolver la que maximiza copias.
export function calcMaxNUp(pliegoW, pliegoH, sheetW, sheetH) {
  const colsA = Math.floor(sheetW / pliegoW)
  const rowsA = Math.floor(sheetH / pliegoH)
  const nA = Math.max(0, colsA) * Math.max(0, rowsA)

  const colsB = Math.floor(sheetW / pliegoH)
  const rowsB = Math.floor(sheetH / pliegoW)
  const nB = Math.max(0, colsB) * Math.max(0, rowsB)

  if (nA <= 0 && nB <= 0) {
    // La hoja es mas chica que el pliego en cualquier orientacion.
    return { maxCopies: 0, rotated: false, cols: 0, rows: 0, copyW: pliegoW, copyH: pliegoH }
  }

  if (nB > nA) {
    return { maxCopies: nB, rotated: true, cols: colsB, rows: rowsB, copyW: pliegoH, copyH: pliegoW }
  }
  return { maxCopies: nA, rotated: false, cols: colsA, rows: rowsA, copyW: pliegoW, copyH: pliegoH }
}

// Elegir layout final dado un override del usuario. El override no puede superar el maximo.
export function chooseLayout(pliegoW, pliegoH, sheetW, sheetH, requestedCopies) {
  const max = calcMaxNUp(pliegoW, pliegoH, sheetW, sheetH)
  if (max.maxCopies <= 0) {
    return { ...max, copies: 0 }
  }
  const req = Number.isFinite(requestedCopies) && requestedCopies > 0
    ? Math.min(requestedCopies, max.maxCopies)
    : max.maxCopies
  return { ...max, copies: req }
}

// Construye las posiciones (esquina inferior-izquierda en coordenadas PDF) de cada copia
// dentro de la hoja. Para 'front': orden de lectura (izq->der, arriba->abajo).
// Para 'back': mismas posiciones pero ESPEJADAS horizontalmente en sheetW. Esto asume
// que la impresora hace "duplex flip on long edge" (lo tipico para hojas horizontales).
// Asi la copia i del dorso queda alineada con la copia i del frente despues del flip.
export function buildPositions(layout, sheetW, sheetH, side) {
  const { cols, rows, copyW, copyH, copies, rotated } = layout
  if (copies <= 0) return []

  const gridW = cols * copyW
  const gridH = rows * copyH
  const startX = (sheetW - gridW) / 2
  const startY = (sheetH - gridH) / 2

  const positions = []
  for (let i = 0; i < copies; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = startX + col * copyW
    // PDF tiene origen abajo-izquierda; queremos la fila 0 arriba.
    const y = startY + (rows - 1 - row) * copyH
    positions.push({ x, y, w: copyW, h: copyH, rotated })
  }

  if (side === 'back') {
    return positions.map((p) => ({ ...p, x: sheetW - p.x - p.w }))
  }
  return positions
}
