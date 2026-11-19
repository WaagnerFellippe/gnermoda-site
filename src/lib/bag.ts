// =====================================================================
// Sacola de locação: a lista de peças que o visitante está considerando.
// Fica salva no aparelho dele (sem login) e vira um pedido único no
// WhatsApp ou um link compartilhável (/sacola?pecas=GM-0001,GM-0017).
// Guarda os CÓDIGOS das peças — estáveis e legíveis no link.
// =====================================================================
import { useSyncExternalStore } from 'react'
import { site } from '../config/site'
import { sizeLabel, waLink } from './format'
import type { Piece } from './types'

const KEY = 'gner-sacola-v1'
const MAX = 60

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, MAX) : []
  } catch {
    return []
  }
}

let codes: string[] = typeof window === 'undefined' ? [] : read()
const listeners = new Set<() => void>()

function write(next: string[]) {
  codes = [...new Set(next)].slice(0, MAX)
  try { localStorage.setItem(KEY, JSON.stringify(codes)) } catch { /* modo privado: vale só nesta visita */ }
  listeners.forEach((l) => l())
}

// sacola aberta em outra aba: mantém as duas em dia
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) { codes = read(); listeners.forEach((l) => l()) }
  })
}

const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l) }
const EMPTY: string[] = []

export function useBag(): string[] {
  return useSyncExternalStore(subscribe, () => codes, () => EMPTY)
}

export const bag = {
  has: (code: string) => codes.includes(code),
  add: (code: string) => write([...codes, code]),
  addMany: (list: string[]) => write([...codes, ...list]),
  remove: (code: string) => write(codes.filter((c) => c !== code)),
  toggle: (code: string) => (codes.includes(code) ? bag.remove(code) : bag.add(code)),
  replace: (list: string[]) => write(list),
  clear: () => write([]),
}

// ---------- Link compartilhável ----------------------------------------
export const shareUrl = (list: string[]) => `${site.domain}/sacola?pecas=${list.join(',')}`

/** Lê ?pecas=GM-0001,GM-0017 (aceita espaços e letras minúsculas). */
export function parseShared(param: string | null): string[] {
  if (!param) return []
  return [...new Set(param.split(/[\s,]+/).map((c) => c.trim().toUpperCase()).filter((c) => /^GM-\d{1,6}$/.test(c)))].slice(0, MAX)
}

// ---------- Pedido único no WhatsApp ------------------------------------
export interface BagRequest {
  nome?: string
  producao?: string
  retirada?: string
  devolucao?: string
  obs?: string
}

const fmtDate = (d?: string) => (d ? d.split('-').reverse().join('/') : '')

export function waBag(pieces: Piece[], req: BagRequest = {}) {
  const lines = pieces.map((p, i) => {
    const tam = sizeLabel(p.sizes)
    return `${i + 1}. ${p.name} — ${p.code}${tam ? ` — Tam. ${tam}` : ''}`
  })
  const extra = [
    req.nome && `Nome: ${req.nome}`,
    req.producao && `Produção/projeto: ${req.producao}`,
    req.retirada && `Retirada: ${fmtDate(req.retirada)}`,
    req.devolucao && `Devolução: ${fmtDate(req.devolucao)}`,
    req.obs && `Observações: ${req.obs}`,
  ].filter(Boolean)
  const msg = [
    `Olá, Gner! Vim pelo site GNER.MODA e gostaria de consultar a locação ${pieces.length === 1 ? 'desta peça' : `destas ${pieces.length} peças`}:`,
    '',
    ...lines,
    ...(extra.length ? ['', ...extra] : []),
    '',
    `Lista: ${shareUrl(pieces.map((p) => p.code))}`,
  ].join('\n')
  return waLink(msg)
}
