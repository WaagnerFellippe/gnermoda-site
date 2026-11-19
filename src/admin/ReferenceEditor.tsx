import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { adminGetReference, adminListReferences, saveReference, type ReferenceInput } from '../lib/api'
import { cleanInstagram, instagramUrl, refreshSiteData } from '../lib/siteData'
import { imageUrl } from '../lib/supabase'
import { removeFiles, uploadImage } from './images'

type Form = ReferenceInput & { id: string }

const empty = (): Form => ({
  id: crypto.randomUUID(),
  handle: '',
  url: '',
  path: null,
  thumb: null,
  width: null,
  height: null,
  alt: '',
  caption: '',
  position: 0,
  is_published: true,
})

/** Arquivos que existem só no Storage (as fotos iniciais em /static não são apagadas). */
const storageFiles = (f: Pick<Form, 'path' | 'thumb'>) => [f.path ?? '', f.thumb ?? ''].filter((p) => p && !p.startsWith('/'))

export default function ReferenceEditor() {
  const { id = 'nova' } = useParams()
  const isNew = id === 'nova'
  const nav = useNavigate()
  const [form, setForm] = useState<Form | null>(null)
  const [saved, setSaved] = useState('')
  const [original, setOriginal] = useState<Pick<Form, 'path' | 'thumb'>>({ path: null, thumb: null })
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [drag, setDrag] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.title = 'Referência — painel'
    if (isNew) {
      // nova referência entra no fim da lista
      adminListReferences().then(
        (all) => {
          const f = { ...empty(), position: all.length ? Math.max(...all.map((r) => r.position)) + 1 : 0 }
          setForm(f)
          setSaved(JSON.stringify(f))
        },
        (e: Error) => setMsg({ kind: 'err', text: e.message }),
      )
      return
    }
    adminGetReference(id).then(
      (r) => {
        if (!r) return setMsg({ kind: 'err', text: 'Referência não encontrada.' })
        const f: Form = { ...r, url: r.url ?? '', alt: r.alt ?? '', caption: r.caption ?? '' }
        setForm(f)
        setSaved(JSON.stringify(f))
        setOriginal({ path: r.path, thumb: r.thumb })
      },
      (e: Error) => setMsg({ kind: 'err', text: e.message }),
    )
  }, [id, isNew])

  const dirty = useMemo(() => form !== null && JSON.stringify(form) !== saved, [form, saved])

  // avisa antes de sair da página com alterações não salvas
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  if (!form) return msg ? <p className="a-error">{msg.text}</p> : <p>Carregando…</p>
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f))

  async function onFile(file?: File) {
    if (!file) return
    setUploading(true)
    setMsg(null)
    try {
      const img = await uploadImage(`references/${form!.id}`, file)
      // foto enviada nesta edição e já substituída: não deixa sobrando
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

  function fillInstagram() {
    const user = cleanInstagram(form!.handle)
    if (user) set('url', instagramUrl(user))
  }

  async function save() {
    const f = form!
    const handle = f.handle.trim()
    if (!handle) return setMsg({ kind: 'err', text: 'Informe o nome ou perfil da referência.' })
    let url = (f.url ?? '').trim()
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`
    setBusy(true)
    setMsg(null)
    try {
      const row = await saveReference({
        ...f,
        handle,
        url: url || null,
        alt: (f.alt ?? '').trim() || null,
        caption: (f.caption ?? '').trim() || null,
      })
      // foto antiga trocada ou removida: apaga do Storage
      if (original.path && original.path !== row.path) await removeFiles(storageFiles(original))
      const next: Form = { ...row, url: row.url ?? '', alt: row.alt ?? '', caption: row.caption ?? '' }
      setForm(next)
      setSaved(JSON.stringify(next))
      setOriginal({ path: row.path, thumb: row.thumb })
      setMsg({ kind: 'ok', text: 'Referência salva — já atualizada no site.' })
      refreshSiteData()
      if (isNew) nav(`/admin/referencias/${row.id}`, { replace: true })
    } catch (e) {
      const text = (e as Error).message
      setMsg({ kind: 'err', text: /url_check|check constraint/i.test(text) ? 'O link precisa começar com https://' : text })
    } finally {
      setBusy(false)
    }
  }

  const img = form.thumb || form.path

  return (
    <form className="ed" onSubmit={(e) => { e.preventDefault(); save() }}>
      <div className="a-head">
        <div>
          <Link to="/admin/referencias" className="a-link">← Referências</Link>
          <h1>{form.handle || 'Nova referência'}</h1>
          {dirty && <p className="a-row__sub"><span className="a-dirty">alterações não salvas</span></p>}
        </div>
      </div>

      <fieldset className="ed__card">
        <legend>Dados</legend>
        <div className="ed__grid">
          <label className="ed__full">
            Nome ou perfil *
            <input required value={form.handle} onChange={(e) => set('handle', e.target.value)} placeholder="@perfil ou nome do artista" />
          </label>
          <label className="ed__full">
            Link
            <input type="text" inputMode="url" autoCapitalize="off" spellCheck={false} value={form.url ?? ''} onChange={(e) => set('url', e.target.value)} placeholder="https://instagram.com/perfil" />
          </label>
          <div className="ed__full a-inline">
            <button type="button" className="a-btn" onClick={fillInstagram} disabled={!cleanInstagram(form.handle)}>
              Usar o Instagram de {form.handle.trim() ? `@${cleanInstagram(form.handle)}` : 'o perfil'}
            </button>
            {form.url && /^https?:\/\//i.test(form.url) && (
              <a className="a-link" href={form.url} target="_blank" rel="noopener noreferrer">Testar link ↗</a>
            )}
          </div>
          <label className="ed__full">
            Legenda
            <textarea rows={2} value={form.caption ?? ''} onChange={(e) => set('caption', e.target.value)} />
            <small>Opcional. Aparece embaixo do nome.</small>
          </label>
          <label className="a-check">
            <input type="checkbox" checked={form.is_published} onChange={(e) => set('is_published', e.target.checked)} /> Mostrar no site
          </label>
        </div>
      </fieldset>

      <fieldset className="ed__card">
        <legend>Foto</legend>
        <div
          className={`ref-photo${drag ? ' ref-photo--on' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0]) }}
        >
          <div className="ref-photo__preview">
            {img ? <img src={imageUrl(img)} alt="" /> : <span>sem foto — no site aparece só o nome</span>}
          </div>
          <div className="ref-photo__actions">
            <button type="button" className="a-btn" onClick={() => input.current?.click()} disabled={uploading}>
              {uploading ? 'Enviando…' : img ? 'Trocar foto' : 'Enviar foto'}
            </button>
            {img && !uploading && <button type="button" className="a-link a-link--danger" onClick={removePhoto}>Remover foto</button>}
            <p className="a-hint">Clique ou arraste uma imagem para cá. Ela é reduzida e otimizada antes de enviar.</p>
          </div>
          <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
        </div>
        {img && (
          <label className="ed__full ed__alt">
            Texto alternativo
            <input value={form.alt ?? ''} onChange={(e) => set('alt', e.target.value)} placeholder={`Referência visual de ${form.handle || 'perfil'}`} />
            <small>Descreve a imagem para leitores de tela e para o Google.</small>
          </label>
        )}
      </fieldset>

      <div className="ed__bar">
        {msg && <p className={msg.kind === 'ok' ? 'a-ok' : 'a-error'} role="status">{msg.text}</p>}
        <div className="ed__actions">
          <button className="a-btn a-btn--primary" disabled={busy || uploading}>{busy ? 'Salvando…' : 'Salvar referência'}</button>
          {!isNew && <a className="a-btn" href="/referencias" target="_blank" rel="noopener">Ver no site ↗</a>}
        </div>
      </div>
    </form>
  )
}
