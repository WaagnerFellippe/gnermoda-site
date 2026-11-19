import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { adminGetLook, adminListLooks, deleteLook, saveLook } from '../lib/api'
import { lookUrl, slugify } from '../lib/format'
import { imageUrl } from '../lib/supabase'
import type { Look, Piece, ProjectStatus } from '../lib/types'
import { PiecePicker } from './PiecePicker'
import { removeFiles, uploadImage } from './images'

interface Form {
  id: string
  title: string
  slug: string
  slugTouched: boolean
  description: string
  path: string | null
  thumb: string | null
  width: number | null
  height: number | null
  alt: string
  status: ProjectStatus
  position: number
  pieces: Piece[]
}

const toForm = (l: Look): Form => ({
  id: l.id, title: l.title, slug: l.slug, slugTouched: true, description: l.description ?? '',
  path: l.path ?? null, thumb: l.thumb ?? null, width: l.width ?? null, height: l.height ?? null,
  alt: l.alt ?? '', status: l.status, position: l.position, pieces: l.pieces,
})

const storageFiles = (f: { path: string | null; thumb: string | null }) => [f.path ?? '', f.thumb ?? ''].filter((p) => p && !p.startsWith('/'))
const snapshot = (f: Form) => JSON.stringify({ ...f, slugTouched: undefined, pieces: f.pieces.map((p) => p.id) })

export default function LookEditor() {
  const { id = 'novo' } = useParams()
  const isNew = id === 'novo'
  const nav = useNavigate()
  const [form, setForm] = useState<Form | null>(null)
  const [saved, setSaved] = useState('')
  const [original, setOriginal] = useState<{ path: string | null; thumb: string | null }>({ path: null, thumb: null })
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [drag, setDrag] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.title = 'Look — painel'
    if (isNew) {
      adminListLooks().then(
        (all) => {
          const f: Form = {
            id: crypto.randomUUID(), title: '', slug: '', slugTouched: false, description: '',
            path: null, thumb: null, width: null, height: null, alt: '', status: 'draft',
            position: all.length ? Math.max(...all.map((l) => l.position)) + 1 : 0, pieces: [],
          }
          setForm(f)
          setSaved(snapshot(f))
        },
        (e: Error) => setMsg({ kind: 'err', text: e.message }),
      )
      return
    }
    adminGetLook(id).then(
      (l) => {
        if (!l) return setMsg({ kind: 'err', text: 'Look não encontrado.' })
        const f = toForm(l)
        setForm(f)
        setSaved(snapshot(f))
        setOriginal({ path: f.path, thumb: f.thumb })
      },
      (e: Error) => setMsg({ kind: 'err', text: e.message }),
    )
  }, [id, isNew])

  const dirty = useMemo(() => form !== null && snapshot(form) !== saved, [form, saved])
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  if (!form) return msg ? <p className="a-error">{msg.text}</p> : <p>Carregando…</p>
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f))

  function onTitle(v: string) {
    setForm((f) => (f ? { ...f, title: v, slug: f.slugTouched ? f.slug : slugify(v) } : f))
  }

  async function onFile(file?: File) {
    if (!file) return
    setUploading(true)
    setMsg(null)
    try {
      const img = await uploadImage(`looks/${form!.id}`, file)
      const prev = form!
      if (prev.path && prev.path !== original.path) await removeFiles(storageFiles(prev))
      setForm((f) => (f ? { ...f, path: img.path, thumb: img.thumb ?? null, width: img.width, height: img.height } : f))
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message })
    } finally {
      setUploading(false)
    }
  }

  async function removePhoto() {
    const f = form!
    if (f.path && f.path !== original.path) await removeFiles(storageFiles(f))
    setForm({ ...f, path: null, thumb: null, width: null, height: null })
  }

  async function save(status: ProjectStatus = form!.status) {
    const f = form!
    if (!f.title.trim()) return setMsg({ kind: 'err', text: 'Dê um nome ao look.' })
    const slug = slugify(f.slug || f.title)
    if (!slug) return setMsg({ kind: 'err', text: 'Informe a URL do look.' })
    if (status === 'published' && f.pieces.length === 0) return setMsg({ kind: 'err', text: 'Para publicar, escolha ao menos uma peça.' })
    setBusy(true)
    setMsg(null)
    try {
      const row = await saveLook({
        id: f.id, slug, title: f.title.trim(), description: f.description.trim() || null,
        path: f.path, thumb: f.thumb, width: f.width, height: f.height, alt: f.alt.trim() || null,
        status, position: f.position, piece_ids: f.pieces.map((p) => p.id),
      })
      if (original.path && original.path !== row.path) await removeFiles(storageFiles(original))
      const next: Form = { ...f, slug: row.slug, status: row.status, slugTouched: true }
      setForm(next)
      setSaved(snapshot(next))
      setOriginal({ path: next.path, thumb: next.thumb })
      setMsg({
        kind: 'ok',
        text: status === 'published' ? 'Look publicado — já aparece no site.' : status === 'archived' ? 'Look arquivado — saiu do site.' : 'Rascunho salvo — ainda não aparece no site.',
      })
      if (isNew) nav(`/admin/looks/${row.id}`, { replace: true })
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!window.confirm(`Excluir o look “${form!.title || 'sem nome'}”? As peças continuam no acervo; só o look é apagado.`)) return
    setBusy(true)
    try {
      await deleteLook(form!.id)
      await removeFiles(storageFiles(original))
      nav('/admin/looks', { replace: true })
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message })
      setBusy(false)
    }
  }

  const img = form.thumb || form.path
  const statusLabel = { draft: 'Rascunho', published: 'Publicado', archived: 'Arquivado' }[form.status]

  return (
    <form className="ed" onSubmit={(e) => { e.preventDefault(); save() }}>
      <div className="a-head">
        <div>
          <Link to="/admin/looks" className="a-link">← Looks</Link>
          <h1>{form.title || 'Novo look'}</h1>
          <p className="a-row__sub">
            <span className={`a-pill a-pill--${form.status}`}>{statusLabel}</span>
            {dirty && <span className="a-dirty"> · alterações não salvas</span>}
          </p>
        </div>
      </div>

      <fieldset className="ed__card">
        <legend>Dados</legend>
        <div className="ed__grid">
          <label className="ed__full">
            Nome do look *
            <input required value={form.title} onChange={(e) => onTitle(e.target.value)} placeholder="Ex.: Couro & alfaiataria" />
          </label>
          <label className="ed__full">
            Endereço no site
            <span className="ed__slug">
              <span>gnermoda.com/looks/</span>
              <input value={form.slug} onChange={(e) => setForm((f) => (f ? { ...f, slug: slugify(e.target.value), slugTouched: true } : f))} />
            </span>
          </label>
          <label className="ed__full">
            Descrição
            <textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="A ideia do look, a ocasião, a referência…" />
            <small>Opcional. Aparece na página do look.</small>
          </label>
        </div>
      </fieldset>

      <fieldset className="ed__card">
        <legend>Peças do look</legend>
        <p className="a-hint">Busque por nome ou código. A ordem aqui é a ordem no site — arraste para mudar.</p>
        <PiecePicker value={form.pieces} onChange={(v) => set('pieces', v)} />
      </fieldset>

      <fieldset className="ed__card">
        <legend>Foto do look (opcional)</legend>
        <div
          className={`ref-photo${drag ? ' ref-photo--on' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0]) }}
        >
          <div className="ref-photo__preview">
            {img ? <img src={imageUrl(img)} alt="" /> : <span>sem foto — no site, a capa é montada com as fotos das peças</span>}
          </div>
          <div className="ref-photo__actions">
            <button type="button" className="a-btn" onClick={() => input.current?.click()} disabled={uploading}>
              {uploading ? 'Enviando…' : img ? 'Trocar foto' : 'Enviar foto'}
            </button>
            {img && !uploading && <button type="button" className="a-link a-link--danger" onClick={removePhoto}>Remover foto</button>}
            <p className="a-hint">Uma foto do look vestido ou montado (flat lay). Clique ou arraste para cá.</p>
          </div>
          <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
        </div>
        {img && (
          <label className="ed__full ed__alt">
            Texto alternativo
            <input value={form.alt} onChange={(e) => set('alt', e.target.value)} placeholder={form.title} />
            <small>Descreve a imagem para leitores de tela e para o Google.</small>
          </label>
        )}
      </fieldset>

      <div className="ed__bar">
        {msg && <p className={msg.kind === 'ok' ? 'a-ok' : 'a-error'} role="status">{msg.text}</p>}
        <div className="ed__actions">
          {form.status === 'published' ? (
            <>
              <button className="a-btn a-btn--primary" disabled={busy || uploading}>{busy ? 'Salvando…' : 'Salvar alterações'}</button>
              <button type="button" className="a-btn" disabled={busy} onClick={() => save('draft')}>Despublicar</button>
            </>
          ) : (
            <>
              <button type="button" className="a-btn a-btn--primary" disabled={busy || uploading} onClick={() => save('published')}>{busy ? 'Salvando…' : 'Publicar'}</button>
              <button type="button" className="a-btn" disabled={busy || uploading} onClick={() => save('draft')}>Salvar rascunho</button>
            </>
          )}
          {!isNew && (
            <a className="a-btn" href={lookUrl(form)} target="_blank" rel="noopener">{form.status === 'published' ? 'Ver no site ↗' : 'Pré-visualizar ↗'}</a>
          )}
          {!isNew && form.status !== 'archived' && (
            <button type="button" className="a-link" disabled={busy} onClick={() => save('archived')}>Arquivar</button>
          )}
          {!isNew && <button type="button" className="a-link a-link--danger" disabled={busy} onClick={remove}>Excluir</button>}
        </div>
      </div>
    </form>
  )
}
