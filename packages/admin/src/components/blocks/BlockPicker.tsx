import type { BlockDefinition } from '@kritano/types'
import { Plus, X } from 'lucide-react'

interface Props {
  blocks: BlockDefinition[]
  onSelect: (blockName: string) => void
  onClose: () => void
}

export function BlockPicker({ blocks, onSelect, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Add block</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-1">
          {blocks.map((block) => (
            <button
              key={block.name}
              onClick={() => { onSelect(block.name); onClose() }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-gray-100"
            >
              <Plus size={14} className="text-gray-400" />
              {block.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
