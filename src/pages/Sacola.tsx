import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { acervo } from '../data/content'
import { listPieces } from '../lib/api'
import { bag, parseShared, shareUrl, useBag, waBag } from '../lib/bag'
import { STATUS, byPosition, categoryLabel, pieceUrl, sizeLabel } from '../lib/format'
import type { Piece } from '../lib/types'
import { BagIcon } from '../components/Bag'
import { Img, LoadError, StatusBadge, WhatsIcon, useAsync, useMeta } from '../components/ui'

export default function Sacola() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const mine = useBag()
  const shared = parseShared(params.get('pecas'))
  const isShared = shared.length > 0
  const codes = isShared ? shared : mine
  useMeta(isShared ? 'Lista de peças' : 'Sacola de locação', 'Peças do acervo GNER.MODA reunidas para um pedido de locação.')

  const { data: all, error, loading } = useAsync(() => listPieces(), [])
  const pieces = useMemo(() => {
    if (!all) return []
    const byCode = new Map(all.map((p) => [p.code, p]))
    return codes.map((c) => byCode.get(c)).filter((p): p is Piece => !!p)
  }, [all, codes])
  const missing = all ? codes.length - pieces.length : 0
  const validCodes = pieces.map((p) => p.code)

  const sameAsMine = isShared && !!all && validCodes.length === mine.length && validCodes.every((c) => mine.includes(c))

  // peça que saiu do acervo: tira da sacola sozinha (o contador fica certo)
  useEffect(() => {
    if (!isShared && all && missing > 0) bag.replace(validCodes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isShared, all, missing])

  if (error) return <div className="page"><LoadError message={error} /></div>

  return (
    <div className="page sacola">
      <header className="page-head">
        <h1 className="page-title">{isShared ? 'Lista' : 'Sacola'}</h1>
        <p className="lead">
          {isShared
            ? 'Alguém compartilhou estas peças do acervo com você. Dá para pedir a locação direto daqui ou juntar à sua sacola.'
            : 'Junte as peças que você quer para a produção e envie um pedido só. O Gner confirma a disponibilidade com você.'}
        </p>
      </header>

      {isShared && (
        <div className="notice">
          {sameAsMine ? (
            <span>Esta é a mesma lista da sua sacola.</span>
          ) : (
            <>
              <button type="button" className="btn" onClick={() => { bag.addMany(validCodes); nav('/sacola') }}>
                <BagIcon /> <span>Juntar à minha sacola</span>
              </button>
              {mine.length > 0 && (
                <button type="button" className="tlink" onClick={() => { bag.replace(validCodes); nav('/sacola') }}>
                  Substituir minha sacola por esta lista
                </button>
              )}
            </>
          )}
        </div>
      )}

      {loading ? (
        <div className="skeleton skeleton--row" />
      ) : pieces.length === 0 ? (
        <div className="empty">
          <p>{isShared ? 'As peças desta lista não estão mais no acervo.' : 'Sua sacola está vazia.'}</p>
          <p className="muted">No acervo, toque em <strong>+</strong> no canto de uma peça ou em “Adicionar à sacola” na página dela.</p>
          <div className="btn-row">
            <Link className="btn btn--solid" to="/acervo"><span>Ver o acervo</span></Link>
            <Link className="btn" to="/looks"><span>Ver looks prontos</span></Link>
          </div>
        </div>
      ) : (
        <div className="sacola__grid">
          <section aria-label="Peças">
            <p className="sacola__count">
              {pieces.length} {pieces.length === 1 ? 'peça' : 'peças'}
              {isShared && missing > 0 && <span className="muted"> · {missing} {missing === 1 ? 'peça saiu' : 'peças saíram'} do acervo e {missing === 1 ? 'foi removida' : 'foram removidas'} da lista</span>}
            </p>
            <ul className="bag-list">
              {pieces.map((p) => <BagRow key={p.code} piece={p} editable={!isShared} />)}
            </ul>
            <ShareBox codes={pieces.map((p) => p.code)} />
            {!isShared && (
              <button type="button" className="tlink sacola__clear" onClick={() => { if (window.confirm('Esvaziar a sacola?')) bag.clear() }}>
                Esvaziar sacola
              </button>
            )}
          </section>
          <RequestForm pieces={pieces} />
        </div>
      )}
    </div>
  )
}

function BagRow({ piece, editable }: { piece: Piece; editable: boolean }) {
  const img = byPosition(piece.piece_images)[0]
  const tam = sizeLabel(piece.sizes)
  return (
    <li className="bag-row">
      <Link to={pieceUrl(piece)} className="bag-row__img">
        {img ? <Img image={img} sizes="120px" alt="" /> : <span className="pcard__noimg">Sem foto</span>}
      </Link>
      <div className="bag-row__info">
        <Link to={pieceUrl(piece)} className="bag-row__name">{piece.name}</Link>
        <span className="bag-row__meta">
          {piece.code} · {categoryLabel(piece.category)}{tam && ` · Tam. ${tam}`}
        </span>
        <StatusBadge status={piece.status} />
      </div>
      {editable && (
        <button type="button" className="bag-row__remove" onClick={() => bag.remove(piece.code)} aria-label={`Remover ${piece.name} da sacola`}>
          Remover
        </button>
      )}
    </li>
  )
}

function ShareBox({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false)
  const url = shareUrl(codes)
  async function share() {
    // celular: abre o menu de compartilhar; computador: copia o link
    if (navigator.share) {
      try { await navigator.share({ title: 'Peças GNER.MODA', text: 'Peças do acervo GNER.MODA', url }); return } catch { /* cancelou: copia */ }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      window.prompt('Copie o link da lista:', url)
    }
  }
  return (
    <div className="sharebox">
      <button type="button" className="btn" onClick={share}>
        <span>{copied ? 'Link copiado ✓' : 'Compartilhar lista'}</span>
      </button>
      <span className="muted">Mande para o cliente ou a equipe aprovar. Quem abrir o link vê as mesmas peças.</span>
    </div>
  )
}

function RequestForm({ pieces }: { pieces: Piece[] }) {
  const [f, setF] = useState({ nome: '', producao: '', retirada: '', devolucao: '', obs: '' })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })
  const today = new Date().toISOString().slice(0, 10)
  const unavailable = pieces.filter((p) => !STATUS[p.status].available)

  const send = (e: React.FormEvent) => {
    e.preventDefault()
    window.open(waBag(pieces, f), '_blank', 'noopener')
  }

  return (
    <section className="request" aria-labelledby="bag-req">
      <h2 id="bag-req" className="request__title">Solicitar locação</h2>
      <p className="muted">{acervo.semCheckout}</p>
      {unavailable.length > 0 && (
        <p className="form__warn">
          {unavailable.length === 1 ? '1 peça está' : `${unavailable.length} peças estão`} indisponível no momento — o pedido vai assim mesmo e o Gner te avisa.
        </p>
      )}
      <form onSubmit={send} className="form">
        <label>
          Seu nome
          <input value={f.nome} onChange={set('nome')} autoComplete="name" />
        </label>
        <label>
          Produção ou projeto
          <input value={f.producao} onChange={set('producao')} placeholder="Ex.: editorial, clipe, campanha" />
        </label>
        <div className="form__2">
          <label>
            Retirada
            <input type="date" min={today} value={f.retirada} onChange={set('retirada')} />
          </label>
          <label>
            Devolução
            <input type="date" min={f.retirada || today} value={f.devolucao} onChange={set('devolucao')} />
          </label>
        </div>
        <label>
          Observações
          <textarea rows={3} value={f.obs} onChange={set('obs')} placeholder="Tamanhos, horários, entrega…" />
        </label>
        <div className="btn-row">
          <button className="btn btn--solid" type="submit">
            <WhatsIcon /> <span>Enviar pedido ({pieces.length} {pieces.length === 1 ? 'peça' : 'peças'})</span>
          </button>
        </div>
        <p className="form__hint">O pedido abre no WhatsApp com a lista das peças, os códigos e o link da lista.</p>
      </form>
    </section>
  )
}
