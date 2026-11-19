import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { adminListReferences, deleteReference, updateReference } from '../lib/api'
import { refreshSiteData, type Reference } from '../lib/siteData'
import { imageUrl } from '../lib/supabase'
import { removeFiles } from './images'

export default function ReferencesList() {
  const [items, setItems] = useState<Reference[] | null>(null)
  const [error, setError] = useState('')
  const [savedId, setSavedId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    document.title = 'Referências — painel'
    adminListReferences().then(setItems, (e: Error) => setError(e.message))
  }, [])

  if (!items) return error ? <p className="a-error">{error}</p> : <p>Carregando…</p>

  const flash = (id: string) => {
    setSavedId(id)
    setTimeout(() => setSavedId((x) => (x === id ? null : x)), 1600)
  }

  async function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id || !items) return
    const before = items
    const next = arrayMove(items, items.findIndex((x) => x.id === active.id), items.findIndex((x) => x.id === over.id))
    setItems(next.map((r, i) => ({ ...r, position: i })))
    try {
      await Promise.all(next.map((r, i) => (r.position !== i ? updateReference(r.id, { position: i }) : null)))
      refreshSiteData()
    } catch (e) {
      setItems(before)
      setError((e as Error).message)
    }
  }

  async function toggle(r: Reference) {
    setItems(items!.map((x) => (x.id === r.id ? { ...x, is_published: !x.is_published } : x)))
    try {
      await updateReference(r.id, { is_published: !r.is_published })
      flash(r.id)
      refreshSiteData()
    } catch (e) {
      setItems(items)
      setError((e as Error).message)
    }
  }

  async function remove(r: Reference) {
    if (!window.confirm(`Excluir a referência ${r.handle}? Ela sai do site e não pode ser recuperada.\n\nSe quiser só tirar do site por um tempo, use "Mostrar no site".`)) return
    try {
      await deleteReference(r.id)
      await removeFiles([r.path ?? '', r.thumb ?? ''])
      setItems(items!.filter((x) => x.id !== r.id))
      refreshSiteData()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <section>
      <div className="a-head">
        <h1>Referências</h1>
        <Link className="a-btn a-btn--primary" to="/admin/referencias/nova">+ Nova referência</Link>
      </div>
      {error && <p className="a-error">{error}</p>}
      <p className="a-hint">
        Aparecem na página Referências e na página inicial, nesta ordem.
        {items.length > 1 && ' Arraste as linhas (⋮⋮) para reordenar.'} Mudanças aqui valem na hora no site.
      </p>
      {items.length === 0 ? (
        <p className="a-empty">Nenhuma referência ainda.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <ul className="a-rows">
              {items.map((r) => (
                <Row key={r.id} r={r} saved={savedId === r.id} onToggle={() => toggle(r)} onDelete={() => remove(r)} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </section>
  )
}

function Row({ r, saved, onToggle, onDelete }: { r: Reference; saved: boolean; onToggle: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: r.id })
  const img = r.thumb || r.path
  return (
    <li ref={setNodeRef} className={`a-row${r.is_published ? '' : ' a-row--off'}`} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <span className="a-handle" {...attributes} {...listeners} aria-label={`Reordenar ${r.handle}`}>⋮⋮</span>
      <div className="a-row__img">{img ? <img src={imageUrl(img)} alt="" /> : <span className="a-noimg">sem foto</span>}</div>
      <div className="a-row__main">
        <Link to={`/admin/referencias/${r.id}`} className="a-row__title">{r.handle}</Link>
        <span className="a-row__sub">
          {r.url ? r.url.replace(/^https?:\/\/(www\.)?/, '') : 'sem link'}
          {!r.path && ' · sem foto'}
          {!r.is_published && ' · fora do site'}
        </span>
      </div>
      <label className="a-check a-check--inline">
        <input type="checkbox" checked={r.is_published} onChange={onToggle} /> Mostrar no site
      </label>
      <span className="a-saved" aria-live="polite">{saved ? 'Salvo ✓' : ''}</span>
      <div className="a-row__links">
        <Link to={`/admin/referencias/${r.id}`}>Editar</Link>
        <button type="button" className="a-link a-link--danger" onClick={onDelete}>Excluir</button>
      </div>
    </li>
  )
}
