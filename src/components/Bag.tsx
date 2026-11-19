import { Link } from 'react-router-dom'
import { bag, useBag } from '../lib/bag'
import type { Piece } from '../lib/types'

/** Ícone de sacola (linha fina, herda a cor do texto). */
export function BagIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="bag-icon">
      <path
        d="M5.5 8.5h13l-1 11.2a1 1 0 0 1-1 .8H7.5a1 1 0 0 1-1-.8l-1-11.2Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9 10V7a3 3 0 0 1 6 0v3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

/** Atalho da sacola no cabeçalho, com o número de peças. */
export function BagLink({ onClick }: { onClick?: () => void }) {
  const codes = useBag()
  const n = codes.length
  return (
    <Link to="/sacola" className="bag-link" onClick={onClick} aria-label={n ? `Sacola de locação: ${n} ${n === 1 ? 'peça' : 'peças'}` : 'Sacola de locação (vazia)'}>
      <BagIcon filled={n > 0} />
      <span className="bag-link__txt">Sacola</span>
      {n > 0 && <span className="bag-link__count" aria-hidden="true">{n}</span>}
    </Link>
  )
}

/** Botão grande da página da peça. */
export function AddToBag({ piece }: { piece: Piece }) {
  const codes = useBag()
  const inBag = codes.includes(piece.code)
  return (
    <div className="addbag">
      <button
        type="button"
        className={`btn${inBag ? ' btn--on' : ''}`}
        aria-pressed={inBag}
        onClick={() => bag.toggle(piece.code)}
      >
        <BagIcon filled={inBag} />
        <span>{inBag ? 'Na sacola — remover' : 'Adicionar à sacola'}</span>
      </button>
      {inBag && (
        <Link to="/sacola" className="tlink tlink--red">
          Ver sacola ({codes.length}) →
        </Link>
      )}
    </div>
  )
}

/** Botão pequeno sobre o card da peça (acervo, projetos, looks). */
export function BagQuick({ piece }: { piece: Piece }) {
  const codes = useBag()
  const inBag = codes.includes(piece.code)
  return (
    <button
      type="button"
      className={`bag-quick${inBag ? ' bag-quick--on' : ''}`}
      aria-pressed={inBag}
      aria-label={inBag ? `Remover ${piece.name} da sacola` : `Adicionar ${piece.name} à sacola`}
      title={inBag ? 'Na sacola — clique para remover' : 'Adicionar à sacola'}
      onClick={() => bag.toggle(piece.code)}
    >
      <BagIcon filled={inBag} />
      <span className="bag-quick__sign" aria-hidden="true">{inBag ? '✓' : '+'}</span>
    </button>
  )
}
