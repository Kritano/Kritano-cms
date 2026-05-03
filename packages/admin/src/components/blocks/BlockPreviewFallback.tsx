import type { FieldDefinition } from '@kritano/cms/types'

interface Props {
  fields: Record<string, FieldDefinition>
}

/**
 * Auto-generated structural preview of a block based on its field types.
 * Renders as an inline SVG — no external dependencies.
 */
export function BlockPreviewFallback({ fields }: Props) {
  const elements: string[] = []
  let y = 16
  const w = 240
  const pad = 16

  for (const [name, field] of Object.entries(fields || {})) {
    switch (field.type) {
      case 'text':
        // Heading-style bar for title/heading fields, shorter for others
        const isHeading = name === 'heading' || name === 'title' || name === 'name'
        const barWidth = isHeading ? w - pad * 2 - 20 : (w - pad * 2) * 0.6
        elements.push(`<rect x="${pad}" y="${y}" width="${barWidth}" height="${isHeading ? 14 : 10}" rx="3" fill="#cbd5e1"/>`)
        y += isHeading ? 24 : 18
        break

      case 'textarea':
      case 'richText':
        // Multiple lines
        for (let i = 0; i < 3; i++) {
          const lw = w - pad * 2 - i * 30 - Math.random() * 20
          elements.push(`<rect x="${pad}" y="${y}" width="${Math.max(lw, 60)}" height="8" rx="2" fill="#e2e8f0"/>`)
          y += 14
        }
        y += 4
        break

      case 'media':
        // Image placeholder
        const imgH = 60
        elements.push(`<rect x="${pad}" y="${y}" width="${w - pad * 2}" height="${imgH}" rx="6" fill="#f1f5f9"/>`)
        elements.push(`<text x="${w / 2}" y="${y + imgH / 2 + 4}" text-anchor="middle" fill="#94a3b8" font-size="10" font-family="system-ui">image</text>`)
        y += imgH + 10
        break

      case 'url':
        // Button shape for CTA-like fields
        if (name.toLowerCase().includes('cta') || name.toLowerCase().includes('button') || name.toLowerCase().includes('url')) {
          elements.push(`<rect x="${pad}" y="${y}" width="80" height="24" rx="4" fill="#334155"/>`)
          elements.push(`<text x="${pad + 40}" y="${y + 15}" text-anchor="middle" fill="white" font-size="8" font-family="system-ui">Button</text>`)
          y += 34
        } else {
          elements.push(`<rect x="${pad}" y="${y}" width="${(w - pad * 2) * 0.5}" height="10" rx="3" fill="#e2e8f0"/>`)
          y += 18
        }
        break

      case 'select':
        // Dropdown
        elements.push(`<rect x="${pad}" y="${y}" width="100" height="20" rx="4" fill="white" stroke="#e2e8f0" stroke-width="1.5"/>`)
        elements.push(`<text x="${pad + 50}" y="${y + 13}" text-anchor="middle" fill="#94a3b8" font-size="8" font-family="system-ui">Select</text>`)
        y += 28
        break

      case 'boolean':
        // Toggle
        elements.push(`<rect x="${pad}" y="${y}" width="28" height="14" rx="7" fill="#cbd5e1"/>`)
        elements.push(`<circle cx="${pad + 21}" cy="${y + 7}" r="5" fill="white"/>`)
        y += 22
        break

      case 'number':
        elements.push(`<rect x="${pad}" y="${y}" width="60" height="10" rx="3" fill="#e2e8f0"/>`)
        y += 18
        break

      case 'datetime':
        elements.push(`<rect x="${pad}" y="${y}" width="90" height="10" rx="3" fill="#e2e8f0"/>`)
        y += 18
        break

      default:
        elements.push(`<rect x="${pad}" y="${y}" width="${(w - pad * 2) * 0.4}" height="10" rx="3" fill="#e2e8f0"/>`)
        y += 18
        break
    }
  }

  const h = Math.max(y + 12, 80)

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full"
      style={{ aspectRatio: `${w}/${h}` }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width={w} height={h} fill="#f8fafc" />
      <g dangerouslySetInnerHTML={{ __html: elements.join('\n') }} />
    </svg>
  )
}
