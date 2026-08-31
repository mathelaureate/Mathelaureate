import { useEffect, useRef, useState } from 'react'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerSrc

function IaDocPage({ pdf, pageNumber, width }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!pdf || !width) return undefined
    const canvas = canvasRef.current
    if (!canvas) return undefined

    let cancelled = false
    let renderTask = null

    async function draw() {
      const page = await pdf.getPage(pageNumber)
      if (cancelled) return

      const base = page.getViewport({ scale: 1 })
      const cssWidth = Math.max(1, width)
      const cssHeight = (base.height / base.width) * cssWidth
      const outputScale = Math.min(window.devicePixelRatio || 1, 2)
      const viewport = page.getViewport({ scale: (cssWidth / base.width) * outputScale })

      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      canvas.style.width = `${cssWidth}px`
      canvas.style.height = `${cssHeight}px`

      const context = canvas.getContext('2d', { alpha: false })
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)

      renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport,
      })
      await renderTask.promise
    }

    draw().catch(() => {})

    return () => {
      cancelled = true
      renderTask?.cancel?.()
    }
  }, [pdf, pageNumber, width])

  return (
    <div className="ia-doc-sheet">
      <canvas ref={canvasRef} draggable={false} />
    </div>
  )
}

export function IaDocumentViewer({ url, unlocked = false, previewPages = 1, justUnlocked = false }) {
  const pageStackRef = useRef(null)
  const [pdf, setPdf] = useState(null)
  const [pageCount, setPageCount] = useState(0)
  const [width, setWidth] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const node = pageStackRef.current
    if (!node) return undefined

    const updateWidth = () => {
      const next = Math.floor(node.clientWidth)
      if (next > 0) setWidth(next)
    }
    updateWidth()

    const observer = new ResizeObserver(updateWidth)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!url) return undefined
    let cancelled = false
    const loadingTask = getDocument({
      url,
      withCredentials: false,
      disableAutoFetch: false,
      disableStream: false,
    })

    setLoading(true)
    setError('')
    setPdf(null)
    setPageCount(0)

    loadingTask.promise
      .then((doc) => {
        if (cancelled) {
          doc.destroy()
          return
        }
        setPdf(doc)
        setPageCount(doc.numPages || 0)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError('Unable to open this document.')
        setLoading(false)
      })

    return () => {
      cancelled = true
      loadingTask.destroy()
    }
  }, [url])

  const previewLimit = Math.max(1, Number(previewPages) || 1)
  const visibleCount = unlocked
    ? pageCount
    : Math.min(pageCount, previewLimit)
  const pages = Array.from({ length: visibleCount }, (_, index) => index + 1)

  return (
    <div
      className={`ia-doc-stage${unlocked ? ' is-unlocked' : ' is-locked'}${justUnlocked ? ' is-just-unlocked' : ''}`}
      onContextMenu={(event) => event.preventDefault()}
    >
      {justUnlocked ? (
        <div className="ia-unlock-burst" aria-live="polite">
          <div className="ia-unlock-burst-ring">
            <span>Unlocked</span>
          </div>
        </div>
      ) : null}
      {loading ? <p className="ia-doc-status">Loading document…</p> : null}
      {error ? (
        <iframe
          className="ia-pdf-frame"
          title="IA document"
          src={`${url}#toolbar=0&navpanes=0&scrollbar=1&view=FitH&download=0`}
        />
      ) : null}
      <div ref={pageStackRef} className="ia-doc-stack">
        {pages.map((pageNumber) => (
          <div
            key={`${url}-${pageNumber}`}
            className={unlocked && justUnlocked && pageNumber > previewLimit ? 'ia-doc-sheet-wrap is-new-page' : 'ia-doc-sheet-wrap'}
            style={
              unlocked && justUnlocked && pageNumber > previewLimit
                ? { animationDelay: `${Math.min(12, pageNumber - previewLimit) * 70}ms` }
                : undefined
            }
          >
            <IaDocPage pdf={pdf} pageNumber={pageNumber} width={width} />
          </div>
        ))}
        {!unlocked && !loading && !error ? <div className="ia-doc-fade" aria-hidden="true" /> : null}
      </div>
    </div>
  )
}
