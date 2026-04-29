export interface Media {
  id: string
  filename: string
  originalFilename: string
  mimeType: string
  size: number
  width: number | null
  height: number | null
  alt: string | null
  url: string
  thumbnailUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface MediaTransform {
  width?: number
  height?: number
  format?: 'webp' | 'avif' | 'png' | 'jpg'
  quality?: number
}

export interface MediaUploadResponse {
  media: Media
}
