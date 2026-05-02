import { useState } from 'react'
import type { BlockDefinition, Block } from '@kritano/cms/types'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, ChevronDown, ChevronRight, Copy, Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { BlockPicker } from './BlockPicker'
import { BlockEditor } from './BlockEditor'

interface Props {
  blockDefs: BlockDefinition[]
  value: Block[]
  onChange: (value: Block[]) => void
}

export function BlockBuilder({ blockDefs: rawBlockDefs, value: rawValue, onChange }: Props) {
  const blockDefs = Array.isArray(rawBlockDefs) ? rawBlockDefs : []
  const value = Array.isArray(rawValue) ? rawValue : []
  const [pickerOpen, setPickerOpen] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function addBlock(blockName: string) {
    const id = crypto.randomUUID()
    const newBlock: Block = { id, type: blockName, fields: {} }
    onChange([...value, newBlock])
    setExpandedIds((prev) => new Set(prev).add(id))
  }

  function duplicateBlock(index: number) {
    const source = value[index]
    const dup: Block = { id: crypto.randomUUID(), type: source.type, fields: { ...source.fields } }
    const updated = [...value]
    updated.splice(index + 1, 0, dup)
    onChange(updated)
  }

  function deleteBlock(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  function updateBlock(index: number, fields: Record<string, unknown>) {
    const updated = [...value]
    updated[index] = { ...updated[index], fields }
    onChange(updated)
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = value.findIndex((b) => b.id === active.id)
    const newIndex = value.findIndex((b) => b.id === over.id)
    const updated = [...value]
    const [moved] = updated.splice(oldIndex, 1)
    updated.splice(newIndex, 0, moved)
    onChange(updated)
  }

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={value.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          {value.map((block, i) => {
            const blockDef = blockDefs.find((d) => d.name === block.type)
            return (
              <SortableBlock
                key={block.id}
                block={block}
                index={i}
                blockDef={blockDef}
                expanded={expandedIds.has(block.id)}
                onToggle={() => toggleExpand(block.id)}
                onDuplicate={() => duplicateBlock(i)}
                onDelete={() => deleteBlock(i)}
                onUpdate={(fields) => updateBlock(i, fields)}
              />
            )
          })}
        </SortableContext>
      </DndContext>

      <Button type="button" variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>
        <Plus size={16} className="mr-1" />
        Add block
      </Button>

      {pickerOpen && (
        <BlockPicker blocks={blockDefs} onSelect={addBlock} onClose={() => setPickerOpen(false)} />
      )}
    </div>
  )
}

interface SortableBlockProps {
  block: Block
  index: number
  blockDef: BlockDefinition | undefined
  expanded: boolean
  onToggle: () => void
  onDuplicate: () => void
  onDelete: () => void
  onUpdate: (fields: Record<string, unknown>) => void
}

function SortableBlock({ block, blockDef, expanded, onToggle, onDuplicate, onDelete, onUpdate }: SortableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const firstTextField = block.fields
    ? Object.values(block.fields).find((v) => typeof v === 'string')
    : null

  return (
    <div ref={setNodeRef} style={style} className="rounded-md border border-gray-200 bg-white">
      <div className="flex items-center gap-2 px-3 py-2">
        <button {...attributes} {...listeners} className="cursor-grab text-gray-300 hover:text-gray-500">
          <GripVertical size={16} />
        </button>
        <button type="button" onClick={onToggle} className="flex flex-1 items-center gap-2 text-left">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="text-xs font-semibold uppercase text-gray-500">{block.type}</span>
          {!expanded && firstTextField && (
            <span className="truncate text-sm text-gray-400">{String(firstTextField).slice(0, 50)}</span>
          )}
        </button>
        <button type="button" onClick={onDuplicate} className="text-gray-300 hover:text-gray-500">
          <Copy size={14} />
        </button>
        <button type="button" onClick={onDelete} className="text-gray-300 hover:text-red-500">
          <Trash2 size={14} />
        </button>
      </div>
      {expanded && blockDef && (
        <div className="border-t border-gray-100 px-3 pb-3">
          <BlockEditor blockDef={blockDef} fields={block.fields} onChange={onUpdate} />
        </div>
      )}
    </div>
  )
}
