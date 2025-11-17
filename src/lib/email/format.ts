const HTML_DETECTION_REGEX = /<\/?[a-z][\s\S]*>/i
const BREAK_TAG_REGEX = /<br\s*\/?>/gi
const PARAGRAPH_CLOSE_REGEX = /<\/p>/gi
const TAG_REGEX = /<[^>]+>/g

const HTML_ENTITY_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ENTITY_MAP[char])
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(PARAGRAPH_CLOSE_REGEX, '\n\n')
    .replace(BREAK_TAG_REGEX, '\n')
    .replace(TAG_REGEX, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function formatEmailBody(body: string | null | undefined): { html: string; text: string } {
  const normalized = (body ?? '').replace(/\r\n/g, '\n').trim()
  if (!normalized) {
    return { html: '', text: '' }
  }

  if (HTML_DETECTION_REGEX.test(normalized)) {
    return {
      html: normalized,
      text: htmlToPlainText(normalized),
    }
  }

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

  if (paragraphs.length <= 1 && normalized.includes('\n')) {
    const lines = normalized
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)

    if (lines.length > 1) {
      const html = lines
        .map((line) => `<p>${escapeHtml(line)}</p>`)
        .join('\n')

      const text = lines.join('\n')
      return { html, text }
    }
  }

  if (!paragraphs.length) {
    const safe = escapeHtml(normalized).replace(/\n/g, '<br />')
    return { html: `<p>${safe}</p>`, text: normalized }
  }

  const html = paragraphs
    .map((paragraph) => {
      const safe = escapeHtml(paragraph).replace(/\n/g, '<br />')
      return `<p>${safe}</p>`
    })
    .join('\n')

  const text = normalized
  return { html, text }
}
