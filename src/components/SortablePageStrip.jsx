import React from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import PageThumb from './PageThumb.jsx'

function SortableItem({ page, pageNumber, isCurrent, onClick, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: page.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative shrink-0 cursor-grab active:cursor-grabbing ${
        isCurrent ? 'ring-2 ring-blue-500' : ''
      }`}
      {...attributes}
      {...listeners}
      onClick={onClick}
    >
      <PageThumb page={page} pageNumber={pageNumber} className="w-16 h-20" />
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRemove(page.id)
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white text-[10px] w-4 h-4 rounded-full leading-none flex items-center justify-center"
        title="Quitar"
      >
        x
      </button>
    </div>
  )
}

export default function SortablePageStrip({
  pages,
  currentIndex,
  onReorder,
  onSelect,
  onRemove,
  onAddBlank,
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = pages.findIndex((p) => p.id === active.id)
    const newIndex = pages.findIndex((p) => p.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    onReorder(arrayMove(pages, oldIndex, newIndex))
  }

  return (
    <div className="border-t border-neutral-300 bg-neutral-200 px-3 py-2">
      <div className="text-xs text-neutral-600 mb-1 flex items-center gap-3">
        <span>Paginas ({pages.length})</span>
        <button
          onClick={onAddBlank}
          className="text-xs px-2 py-0.5 bg-white border border-neutral-300 rounded hover:bg-neutral-50"
        >
          + Pagina en blanco
        </button>
        <span className="text-neutral-500 italic">arrastra para reordenar</span>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={pages.map((p) => p.id)} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {pages.map((page, i) => (
              <SortableItem
                key={page.id}
                page={page}
                pageNumber={i + 1}
                isCurrent={i === currentIndex || i === currentIndex + 1}
                onClick={() => onSelect(i)}
                onRemove={onRemove}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
