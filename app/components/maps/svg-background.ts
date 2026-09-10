// Keep the decoded SVG and one canvas, rather than four encoded PNG copies.
// MapLibre 6 accepts the canvas directly through ImageSource.updateImage.
export const loadSvgBackground = async (url: string, signal: AbortSignal) => {
  const response = await fetch(url, { credentials: 'include', signal })
  if (!response.ok) throw new Error(`Unable to fetch SVG background (${response.status})`)
  const blob = await response.blob()
  const contentType = response.headers.get('content-type') || blob.type
  if (!contentType.includes('svg')) throw new Error(`Unexpected background content type: ${contentType}`)

  const objectUrl = URL.createObjectURL(blob)
  const image = new Image()
  try {
    image.src = objectUrl
    await image.decode()
    signal.throwIfAborted()
  } finally {
    URL.revokeObjectURL(objectUrl)
  }

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Unable to initialize background raster canvas')
  const width = Math.max(Math.round(image.naturalWidth || image.width || 1920), 1)
  const height = Math.max(Math.round(image.naturalHeight || image.height || 1080), 1)
  return {
    rasterize(scale: number) {
      canvas.width = Math.max(Math.round(width * scale), 1)
      canvas.height = Math.max(Math.round(height * scale), 1)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      return canvas
    },
  }
}
