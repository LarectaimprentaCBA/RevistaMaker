// Saddle-stitch (abrochado a caballo) imposition.
// For N pages where N % 4 === 0, returns an array of sheets.
// Each sheet has front and back, each side has [left, right] page numbers (1-indexed).
// Page number 0 represents a blank page (should not happen if validated).
//
// Folding model: hoja se imprime doble faz, se apila junto a las otras hojas,
// se dobla todo al medio y se abrocha en el lomo.
// Pliego i (0..N/4-1):
//   Frente: izq = N - 2i           der = 1 + 2i
//   Dorso:  izq = 2 + 2i           der = N - 1 - 2i

export function imposeSaddleStitch(totalPages) {
  if (totalPages % 4 !== 0) {
    throw new Error(`totalPages debe ser multiplo de 4, recibido ${totalPages}`)
  }
  const sheets = []
  const sheetCount = totalPages / 4
  for (let i = 0; i < sheetCount; i++) {
    sheets.push({
      front: [totalPages - 2 * i, 1 + 2 * i],
      back: [2 + 2 * i, totalPages - 1 - 2 * i],
    })
  }
  return sheets
}

export function needsForMultipleOfFour(n) {
  const rem = n % 4
  if (rem === 0) return { ok: true, missing: 0 }
  return { ok: false, missing: 4 - rem }
}
