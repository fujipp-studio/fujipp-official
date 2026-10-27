export async function prepareWalletQrLogo(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024)
    throw new Error('Choose a PNG, JPEG or WebP image up to 2 MB.')
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 16_000_000
    )
      throw new Error('The logo image is too large.')
    const canvas = document.createElement('canvas')
    canvas.width = 160
    canvas.height = 64
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not prepare the logo image.')
    const scale = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight)
    const width = image.naturalWidth * scale,
      height = image.naturalHeight * scale
    context.drawImage(
      image,
      (canvas.width - width) / 2,
      (canvas.height - height) / 2,
      width,
      height,
    )
    const result = canvas.toDataURL('image/png')
    if (result.length > 60000) throw new Error('The resized logo is too large.')
    return result
  } finally {
    URL.revokeObjectURL(url)
  }
}
