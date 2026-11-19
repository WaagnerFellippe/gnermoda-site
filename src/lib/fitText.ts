// =====================================================================
// Ajuste automático de títulos — nenhuma palavra cortada ou partida.
//
// O CSS já limita o tamanho dos títulos pela largura da coluna (unidade
// cqi), mas isso depende de uma estimativa da largura das letras. Aqui
// medimos a palavra real, na fonte real, e reduzimos o título apenas o
// necessário para a palavra mais longa caber inteira na linha.
//
// Roda ao carregar, quando as fontes terminam de carregar, quando a janela
// muda de tamanho (inclui zoom do navegador) e quando a página troca.
// Para incluir outro elemento, basta adicionar o atributo data-fit nele.
// =====================================================================

const SELECTOR = [
  '[data-fit]',
  '.page-title', '.hero__shortcuts a', '.block__title', '.piece__name',
  '.handle', '.prow__title', '.section-title', '.kicker', '.about__end',
  '.request__title', '.ref__handle', '.ref__empty', '.pcard__name',
  '.nav__link', '.footer a', '.footer__title', '.tlink', '.btn', '.badge',
  '.pcard__meta', '.form__hint', '.crumbs', '.specs dt', '.specs dd', 'figcaption',
].join(',')

const FITTED = 'data-fitted'

function px(v: string) { return parseFloat(v) || 0 }

/** Largura disponível: a área de conteúdo do bloco pai, descontando o
 *  recuo e a borda do próprio elemento (ex.: padding de um botão). */
function availableWidth(el: HTMLElement): number {
  const parent = el.parentElement
  if (!parent) return Infinity
  const pcs = getComputedStyle(parent)
  const ecs = getComputedStyle(el)
  const parentContent = parent.clientWidth - px(pcs.paddingLeft) - px(pcs.paddingRight)
  const own = px(ecs.paddingLeft) + px(ecs.paddingRight) + px(ecs.borderLeftWidth) + px(ecs.borderRightWidth)
  return parentContent - own
}

/** Largura da palavra mais longa, medida com a quebra de palavras desligada. */
function longestWord(el: HTMLElement): number {
  const prev = el.style.overflowWrap
  el.style.overflowWrap = 'normal'
  // junta os trechos de texto (ex.: "@" + "gner.moda" vêm em pedaços separados)
  const nodes: Text[] = []
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text)
  const starts: number[] = []
  let text = ''
  for (const n of nodes) { starts.push(text.length); text += n.data }
  const at = (i: number): [Text, number] => {
    let k = 0
    while (k + 1 < nodes.length && starts[k + 1] <= i) k++
    return [nodes[k], i - starts[k]]
  }
  let max = 0
  const range = document.createRange()
  const re = /\S+/g
  for (let m = re.exec(text); m; m = re.exec(text)) {
    // mede trecho a trecho e soma: uma "palavra" com hífen ou @ pode estar
    // dividida entre linhas ou entre pedaços de texto
    let w = 0
    let i = m.index
    const end = m.index + m[0].length
    while (i < end) {
      const [node, off] = at(i)
      const stop = Math.min(end - i, node.data.length - off)
      range.setStart(node, off)
      range.setEnd(node, off + stop)
      for (const r of range.getClientRects()) w += r.width
      i += stop
    }
    max = Math.max(max, w)
  }
  el.style.overflowWrap = prev
  return max
}

function fit(el: HTMLElement) {
  // volta ao tamanho definido no CSS antes de medir
  if (el.hasAttribute(FITTED)) {
    el.style.fontSize = ''
    el.removeAttribute(FITTED)
  }
  if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return // oculto
  let avail = availableWidth(el)
  // se o próprio elemento tem largura limitada (ex.: selo com largura máxima)
  // e a palavra transborda dentro dele, vale a largura dele
  const prev = el.style.overflowWrap
  el.style.overflowWrap = 'normal'
  if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1) {
    const cs = getComputedStyle(el)
    avail = Math.min(avail, el.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight))
  }
  el.style.overflowWrap = prev
  const word = longestWord(el)
  if (word <= avail || word === 0) return
  const size = parseFloat(getComputedStyle(el).fontSize)
  el.style.fontSize = `${Math.floor(size * (avail / word) * 0.98 * 10) / 10}px`
  el.setAttribute(FITTED, '')
}

let scheduled = false
function fitAll() {
  if (scheduled) return
  scheduled = true
  requestAnimationFrame(() => {
    scheduled = false
    document.querySelectorAll<HTMLElement>(SELECTOR).forEach(fit)
  })
}

export function startFitText() {
  if (typeof window === 'undefined' || !('ResizeObserver' in window)) return
  fitAll()
  document.fonts?.ready.then(fitAll)
  // só a largura importa (zoom, girar o celular, redimensionar a janela)
  let lastWidth = 0
  new ResizeObserver(([entry]) => {
    const w = Math.round(entry.contentRect.width)
    if (w !== lastWidth) { lastWidth = w; fitAll() }
  }).observe(document.documentElement)
  // troca de página, conteúdo carregado do banco, menu aberto/fechado
  const root = document.getElementById('root')
  if (root) {
    new MutationObserver(fitAll).observe(root, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ['class', 'hidden', 'open', 'aria-expanded'],
    })
  }
}
