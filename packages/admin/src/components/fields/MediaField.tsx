import { useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { MediaPicker } from '@/components/media/MediaPicker'

interface Props {
  label: string
  value: string | null
  onChange: (value: string | null) => void
}

export function MediaField({ label, value, onChange }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {value ? (
        <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
          <ImagePlus size={16} className="text-gray-400" />
          <span className="flex-1 truncate text-sm text-gray-600">{value}</span>
          <button type="button" onClick={() => onChange(null)} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>
      ) : (
        <Button type="button" variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>
          <ImagePlus size={16} className="mr-1.5" />
          Select media
        </Button>
      )}
      {pickerOpen && (
        <MediaPicker
          onSelect={(mediaId, _url) => { onChange(mediaId); setPickerOpen(false) }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
