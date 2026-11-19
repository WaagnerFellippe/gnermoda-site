import { Link, useParams } from 'react-router-dom'
import { getLook, listPublishedLooks } from '../lib/api'
import { bag, useBag, waBag } from '../lib/bag'
import { byPosition, lookUrl } from '../lib/format'
import type { ImageRef, Look } from '../lib/types'
import { BagIcon } from '../components/Bag'
import { PieceCard } from '../components/PieceCard'
import { Img, LoadError, Star, WhatsIcon, useAsync, useMeta } from '../components/ui'
import NotFound from './NotFound'

/** Capa do look: a foto enviada no painel ou, sem ela, as fotos das peças lado a lado. */
function LookCover({ look, sizes, eager }: { look: Look; sizes: string; eager?: boolean }) {
  if (look.path && look.width && look.height) {
    const img: ImageRef = { path: look.path, thumb: look.thumb, width: look.width, height: look.height, alt: look.alt || look.title }
    return <div className="look-cover"><Img image={img} sizes={sizes} eager={eager} /></div>
  }
  const imgs = look.pieces.map((p) => byPosition(p.piece_images)[0]).filter(Boolean).slice(0, 4)
  return (
    <div className={`look-cover look-cover--grid look-cover--${Math.max(imgs.length, 1)}`}>
      {imgs.map((im, i) => (
        <span key={i} className="look-cover__cell"><Img image={im!} sizes="25vw" alt="" eager={eager} /></span>
      ))}
    </div>
  )
}

export function LookCard({ look }: { look: Look }) {
  return (
    <Link to={lookUrl(look)} className="look-card">
      <LookCover look={look} sizes="(max-width: 700px) 100vw, 33vw" />
      <span className="look-card__title">{look.title}</span>
      <span className="look-card__meta">{look.pieces.length} {look.pieces.length === 1 ? 'peça' : 'peças'}</span>
    </Link>
  )
}

export default function Looks() {
  useMeta('Looks', 'Looks prontos montados com peças do acervo GNER.MODA — alugue o look completo.')
  const { data, error, loading } = useAsync(() => listPublishedLooks(), [])
  return (
    <div className="page">
      <Star className="star--corner" />
      <header className="page-head">
        <h1 className="page-title">Looks</h1>
        <p className="lead">Combinações montadas com peças do acervo. Leve o look inteiro para a sacola e peça tudo de uma vez.</p>
      </header>
      {error ? (
        <LoadError message={error} />
      ) : loading ? (
        <div className="looks-grid">{[0, 1, 2].map((i) => <div key={i} className="skeleton skeleton--card" />)}</div>
      ) : !data?.length ? (
        <div className="empty">
          <p>Os primeiros looks estão sendo montados.</p>
          <div className="btn-row"><Link className="btn btn--solid" to="/acervo"><span>Ver o acervo</span></Link></div>
        </div>
      ) : (
        <div className="looks-grid">{data.map((l) => <LookCard key={l.id} look={l} />)}</div>
      )}
    </div>
  )
}

export function LookPage() {
  const { slug = '' } = useParams()
  const { data, error, loading } = useAsync(() => getLook(slug), [slug])
  useMeta(data?.title, data ? data.description || `Look ${data.title}, montado com ${data.pieces.length} peças do acervo GNER.MODA.` : undefined)
  const codes = useBag()

  if (loading) return <div className="page"><div className="skeleton skeleton--hero" /></div>
  if (error) return <div className="page"><LoadError message={error} /></div>
  if (!data) return <NotFound />

  const lookCodes = data.pieces.map((p) => p.code)
  const allIn = lookCodes.length > 0 && lookCodes.every((c) => codes.includes(c))

  return (
    <div className="page look">
      <nav className="crumbs" aria-label="Caminho"><Link to="/looks">Looks</Link></nav>
      {data.status !== 'published' && <p className="notice">Pré-visualização: este look ainda não está publicado.</p>}
      <div className="look__grid">
        <LookCover look={data} sizes="(max-width: 900px) 100vw, 50vw" eager />
        <div className="look__info">
          <h1 className="page-title">{data.title}</h1>
          {data.description && <p className="lead">{data.description}</p>}
          <p className="muted">{data.pieces.length} {data.pieces.length === 1 ? 'peça' : 'peças'} do acervo</p>
          <div className="btn-row">
            <button
              type="button"
              className={`btn btn--solid${allIn ? ' btn--on' : ''}`}
              onClick={() => (allIn ? lookCodes.forEach((c) => bag.remove(c)) : bag.addMany(lookCodes))}
              aria-pressed={allIn}
            >
              <BagIcon filled={allIn} />
              <span>{allIn ? 'Look na sacola — remover' : 'Adicionar look completo à sacola'}</span>
            </button>
            <a className="btn" href={waBag(data.pieces)} target="_blank" rel="noopener noreferrer">
              <WhatsIcon /> <span>Pedir só este look</span>
            </a>
          </div>
          {allIn && <Link to="/sacola" className="tlink tlink--red">Ver sacola ({codes.length}) →</Link>}
        </div>
      </div>
      <h2 className="section-title">Peças do look</h2>
      <div className="grid grid--4">{data.pieces.map((p) => <PieceCard key={p.id} piece={p} />)}</div>
    </div>
  )
}
