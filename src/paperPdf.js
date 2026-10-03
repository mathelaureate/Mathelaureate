export async function savePagesAsPdf(pages, filename) {
  const [{ jsPDF }, html2canvasMod] = await Promise.all([import('jspdf'), import('html2canvas')])
  const html2canvas = html2canvasMod.default
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  for (let index = 0; index < pages.length; index += 1) {
    const image = await pageImage(html2canvas, pages[index])
    if (index) pdf.addPage()
    pdf.addImage(image, 'JPEG', 0, 0, 210, 297)
  }
  pdf.save(filename)
}

async function pageImage(html2canvas, page) {
  const options = {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
  }
  const canvas = await html2canvas(page, options)
  try {
    return canvas.toDataURL('image/jpeg', 0.95)
  } catch {
    page.querySelectorAll('img').forEach((img) => {
      try {
        if (new URL(img.src, window.location.origin).origin !== window.location.origin) img.remove()
      } catch {
        img.remove()
      }
    })
    const retry = await html2canvas(page, { ...options, useCORS: false })
    return retry.toDataURL('image/jpeg', 0.95)
  }
}
