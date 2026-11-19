import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { adminListLooks, updateLook } from '../lib/api'
import { PROJECT_STATUS, byPosition, lookUrl } from '../lib/format'
import { imageUrl } from '../lib/supabase'
import type { Look } from '../lib/types'

export default function LooksList() {
  const [items, setItems] = useState<Look[] | null>(null)
  const [error, setError] = useState('')
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    document.title = 'Looks — painel'
    adminListLooks().then(setItems, (e: Error) => setError(e.message))
  }, [])

  if (!items) return error ? <p className="a-error">{error}</p> : <p>Carregando…</p>

  async function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id || !items) return
    const before = items
    const next = arrayMove(items, items.findIndex((x) => x.id === active.id), items.findIndex((x) => x.id === over.id))
    setItems(next.map((l, i) => ({ ...l, position: i })))
    try {
      await Promise.all(next.map((l, i) => (l.position !== i ? updateLook(l.id, { position: i }) : null)))
    } catch (e) {
      setItems(before)
      setError((e as Error).message)
    }
  }

  return (
    <section>
      <div className="a-head">
        <h1>Looks</h1>
        <Link className="a-btn a-btn--primary" to="/admin/looks/novo">+ Novo look</Link>
      </div>
      {error && <p className="a-error">{error}</p>}
      <p className="a-hint">
        Looks prontos montados com peças do acervo. No site, o visitante leva o look completo para a sacola.
        {items.length > 1 && ' Arraste as linhas (⋮⋮) para mudar a ordem.'}
      </p>
      {items.length === 0 ? (
        <p className="a-empty">Nenhum look ainda. Comece em “+ Novo look”.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((l) => l.id)} strategy={verticalListSortingStrategy}>
            <ul className="a-rows">{items.map((l) => <Row key={l.id} look={l} />)}</ul>
          </SortableContext>
        </DndContext>
      )}
    </section>
  )
}

function Row({ look }: { look: Look }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: look.id })
  const cover = look.thumb || look.path || byPosition(look.pieces[0]?.piece_images)[0]?.thumb || byPosition(look.pieces[0]?.piece_images)[0]?.path
  return (
    <li ref={setNodeRef} className={`a-row${look.status === 'published' ? '' : ' a-row--off'}`} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <span className="a-handle" {...attributes} {...listeners} aria-label={`Reordenar ${look.title}`}>⋮⋮</span>
      <div className="a-row__img">{cover ? <img src={imageUrl(cover)} alt="" /> : <span className="a-noimg">sem foto</span>}</div>
      <div className="a-row__main">
        <Link to={`/admin/looks/${look.id}`} className="a-row__title">{look.title}</Link>
        <span className="a-row__sub">{look.pieces.length} {look.pieces.length === 1 ? 'peça' : 'peças'}</span>
      </div>
      <span className={`a-pill a-pill--${look.status}`}>{PROJECT_STATUS[look.status]}</span>
      <div className="a-row__links">
        <Link to={`/admin/looks/${look.id}`}>Editar</Link>
        {look.status === 'published' && <a href={lookUrl(look)} target="_blank" rel="noopener">Ver ↗</a>}
      </div>
    </li>
  )
}
