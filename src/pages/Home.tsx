import { Link } from 'react-router-dom'
import { contato, fotos, home } from '../data/content'
import { instagramUrl, useContacts, useReferences } from '../lib/siteData'
import { listPieces, listPublishedProjects } from '../lib/api'
import { CATEGORIES, waGeneral } from '../lib/format'
import { PieceCard } from '../components/PieceCard'
import { ProjectRow } from '../components/ProjectRow'
import { ButtonLink, Img, Star, TextLink, WhatsIcon, staticImg, useAsync, useMeta } from '../components/ui'

const ATALHOS = [
  { to: '/sobre-mim', label: 'Sobre mim' },
  { to: '/acervo', label: 'Acervo' },
  { to: '/projetos', label: 'Projetos' },
  { to: '/referencias', label: 'Referências' },
]

export default function Home() {
  const contacts = useContacts()
  useMeta()
  const pieces = useAsync(listPieces, [])
  const projects = useAsync(listPublishedProjects, [])

  // Prioriza peças disponíveis; completa com as demais (status sempre visível no cartão).
  // Uma peça por categoria, priorizando as disponíveis.
  const destaque = (() => {
    const all = (pieces.data ?? []).slice().sort((a, b) => Number(b.status === 'disponivel') - Number(a.status === 'disponivel'))
    const out: typeof all = []
    for (const p of all) if (out.length < 4 && !out.some((x) => x.category === p.category)) out.push(p)
    for (const p of all) if (out.length < 4 && !out.includes(p)) out.push(p)
    return out
  })()
  const projs = (projects.data ?? [])
    .slice()
    .sort((a, b) => Number(b.featured_home) - Number(a.featured_home))
    .slice(0, 4)

  return (
    <div className="page page--home">
      <section className="hero">
        <Star className="star--hero" />
        <Star className="star--hero-low" />
        <div className="hero__media">
          <Img image={staticImg(fotos.hero.src, fotos.hero.w, fotos.hero.h, fotos.hero.alt)} sizes="(max-width: 800px) 100vw, 45vw" eager className="bw" />
        </div>
        <div className="hero__text">
          <nav className="hero__shortcuts" aria-label="Atalhos">
            {ATALHOS.map((a) => (
              <Link key={a.to} to={a.to}>
                {a.label}
              </Link>
            ))}
          </nav>
          <p className="lead">{home.apresentacao}</p>
          <ButtonLink to="/acervo">Conheça o acervo</ButtonLink>
        </div>
      </section>

      <section className="block" aria-labelledby="h-acervo">
        <div className="block__head">
          <h2 id="h-acervo" className="block__title">Acervo</h2>
          <TextLink to="/acervo">Ver peças</TextLink>
        </div>
        <div className="tabs" role="list">
          {CATEGORIES.map((c) => (
            <Link key={c.value} role="listitem" className="tab" to={`/acervo?cat=${c.value}`}>
              {c.label}
            </Link>
          ))}
        </div>
        <div className="grid grid--4">
          {destaque.map((p) => (
            <PieceCard key={p.id} piece={p} />
          ))}
          {pieces.loading && Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton skeleton--card" />)}
        </div>
      </section>

      <section className="block" aria-labelledby="h-projetos">
        <div className="block__head">
          <h2 id="h-projetos" className="block__title">Projetos</h2>
          <TextLink to="/projetos">Ver projetos</TextLink>
        </div>
        <div className="plist">
          {projs.map((p) => (
            <ProjectRow key={p.id} project={p} />
          ))}
          {!projects.loading && projs.length === 0 && <p className="muted">Novos projetos em breve.</p>}
        </div>
      </section>

      <section className="block block--split" aria-labelledby="h-sobre">
        <div>
          <div className="block__head">
            <h2 id="h-sobre" className="block__title">Sobre mim</h2>
            <TextLink to="/sobre-mim">Ler sobre Gner</TextLink>
          </div>
          <p className="lead">{home.sobreResumo}</p>
          <ButtonLink to="/sobre-mim">Conheça a história</ButtonLink>
        </div>
        <div className="block__media">
          <Img image={staticImg(fotos.sobre[0].src, fotos.sobre[0].w, fotos.sobre[0].h, fotos.sobre[0].alt)} sizes="(max-width: 800px) 100vw, 40vw" className="bw" />
        </div>
      </section>

      <section className="block" aria-labelledby="h-ref">
        <div className="block__head">
          <h2 id="h-ref" className="block__title">Referências</h2>
          <TextLink to="/referencias">Ver referências</TextLink>
        </div>
        <RefGrid />
      </section>

      <section className="block block--contact" aria-labelledby="h-contato">
        <Star className="star--contact" />
        <div className="block__head">
          <h2 id="h-contato" className="block__title">Contato</h2>
          <TextLink to="/contato">Falar com o Gner</TextLink>
        </div>
        <p className="lead">{contato.abertura}</p>
        <p className="handle">
          <a href={instagramUrl(contacts.instagram)} target="_blank" rel="noopener noreferrer">
            @{contacts.instagram}
          </a>
        </p>
        <div className="btn-row">
          <ButtonLink to="/contato">Contato</ButtonLink>
          <a className="btn btn--solid" href={waGeneral()} target="_blank" rel="noopener noreferrer">
            <WhatsIcon /> <span>WhatsApp</span>
          </a>
        </div>
      </section>
    </div>
  )
}

export function RefGrid() {
  const referencias = useReferences()
  if (!referencias.length) return null
  return (
    <ul className="refs">
      {referencias.map((r) => {
        const media = (
          <div className="ref__media">
            {r.path && r.width && r.height ? (
              <Img
                image={{ path: r.path, thumb: r.thumb, width: r.width, height: r.height, alt: r.alt || `Referência visual de ${r.handle}` }}
                sizes="(max-width: 700px) 50vw, 25vw"
              />
            ) : (
              <span className="ref__empty">{r.handle}</span>
            )}
            {r.url && (
              <span className="ref__cta" aria-hidden="true">
                <span className="ref__cta-long">{/instagram\.com/i.test(r.url) ? 'Ver no Instagram' : 'Ver perfil'} ↗</span>
                <span className="ref__cta-short">{/instagram\.com/i.test(r.url) ? 'Instagram' : 'Perfil'} ↗</span>
              </span>
            )}
          </div>
        )
        const text = (
          <>
            <span className="ref__handle">
              {r.handle}
              {r.url && <span className="ref__arrow" aria-hidden="true">{'\u2060'}↗</span>}
            </span>
            {r.caption && <span className="ref__caption">{r.caption}</span>}
          </>
        )
        return (
          <li key={r.id} className="ref">
            {r.url ? (
              // o card inteiro (foto + nome) leva ao perfil
              <a className="ref__card" href={r.url} target="_blank" rel="noopener noreferrer">
                {media}
                {text}
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
            ) : (
              <div className="ref__card">
                {media}
                {text}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
