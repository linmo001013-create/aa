const DEFAULT_REVOKE_DELAY_MS = 60 * 1000

/**
 * Download a Blob as a file.
 *
 * Strategy (in order of preference):
 *   1. `showSaveFilePicker` (File System Access API) — works in Chrome / some Android WebViews,
 *      opens a native file-save dialog.
 *   2. `navigator.share({ files })` — works on many Android WebViews / mobile browsers,
 *      lets the user pick "Save to files".
 *   3. Classic <a> + ObjectURL fallback — works everywhere else but may not trigger
 *      a visible save dialog on Android when used inside a WebView.
 *
 * @param {Blob} blob
 * @param {string} filename
 * @param {{ revokeDelayMs?: number }} [options]
 * @returns {Promise<string|undefined>} Promise resolving to the ObjectURL if fallback was used,
 *   or undefined if a newer API successfully handled the download.
 */
export async function downloadBlob(blob, filename, options = {}) {
  if (!(blob instanceof Blob)) {
    throw new TypeError('downloadBlob expects a Blob')
  }

  // 1. showSaveFilePicker (File System Access API)
  try {
    if (typeof window.showSaveFilePicker === 'function') {
      const handle = await window.showSaveFilePicker({
        suggestedName: String(filename || 'download'),
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return // successfully saved via native dialog
    }
  } catch (e) {
    // AbortError = user cancelled → silently stop
    if (e.name === 'AbortError') return
    // Other error (e.g. API not supported) → fall through
  }

  // 2. navigator.share (mobile-friendly, Android WebView)
  try {
    if (typeof navigator.canShare === 'function' && typeof navigator.share === 'function') {
      const file = new File([blob], String(filename || 'download'), { type: blob.type })
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] })
        return // shared successfully
      }
    }
  } catch {
    // Fall through gracefully
  }

  // 3. Classic <a> + ObjectURL fallback
  const revokeDelayMs = Number.isFinite(Number(options.revokeDelayMs))
    ? Math.max(1000, Math.round(Number(options.revokeDelayMs)))
    : DEFAULT_REVOKE_DELAY_MS

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = String(filename || 'download')
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body?.appendChild(anchor)
  anchor.click()
  anchor.remove()

  window.setTimeout(() => {
    try {
      URL.revokeObjectURL(url)
    } catch {
      // Ignore revoke failures for completed downloads.
    }
  }, revokeDelayMs)

  return url
}
