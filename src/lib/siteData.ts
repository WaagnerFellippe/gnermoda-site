// =====================================================================
// Contatos e referências — editáveis pelo painel (/admin).
//
// O site carrega esses dados do banco uma vez ao abrir e guarda uma cópia
// no aparelho do visitante, para a próxima visita já abrir atualizada.
// Se o banco não responder, usa os valores de reserva (config/site.ts e
// data/content.ts), então o site nunca fica sem contato.
// =====================================================================
import { useSyncExternalStore } from 'react'
import { site } from '../config/site'
import { referencias as fallbackRefs } from '../data/content'
import { supabase } from './supabase'

export interface Contacts {
  email: string
  instagram: string // sem @ (ex.: gner.moda)
  whatsapp: string // só números, com 55 + DDD
  whatsappLabel: string // como aparece escrito
}

export interface Reference {
  id: string
  handle: string
  url: string | null
  path: string | null
  thumb: string | null
  width: number | null
  height: number | null
  alt: string | null
  caption: string | null
  position: number
  is_published: boolean
}

interface SiteData {
  contacts: Contacts
  references: Reference[]
}

const CACHE_KEY = 'gner-site-data-v1'

const FALLBACK: SiteData = {
  contacts: { email: site.email, instagram: site.instagram, whatsapp: site.whatsapp, whatsappLabel: site.whatsappLabel },
  references: fallbackRefs.map((r, i) => ({
    id: `fallback-${i}`,
    handle: r.handle,
    url: r.url ?? null,
    path: r.image ? `${r.image}.webp` : null,
    thumb: r.image ? `${r.image}-sm.webp` : null,
    width: r.w ?? null,
    height: r.h ?? null,
    alt: r.image ? `Referência visual de ${r.handle}` : null,
    caption: r.caption ?? null,
    position: i,
    is_published: true,
  })),
}

function readCache(): SiteData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as SiteData
    return d?.contacts && Array.isArray(d.references) ? d : null
  } catch {
    return null
  }
}

let state: SiteData = (typeof window !== 'undefined' && readCache()) || FALLBACK
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Busca contatos e referências publicadas no banco e atualiza o site. */
export async function refreshSiteData() {
  try {
    const [s, r] = await Promise.all([
      supabase.from('site_settings').select('email,instagram,whatsapp,whatsapp_label').eq('id', 1).maybeSingle(),
      supabase.from('site_references').select('*').eq('is_published', true).order('position').order('created_at'),
    ])
    if (s.error || r.error) throw s.error ?? r.error
    const next: SiteData = {
      contacts: s.data
        ? {
            email: s.data.email || FALLBACK.contacts.email,
            instagram: s.data.instagram || FALLBACK.contacts.instagram,
            whatsapp: s.data.whatsapp || FALLBACK.contacts.whatsapp,
            whatsappLabel: s.data.whatsapp_label || s.data.whatsapp || FALLBACK.contacts.whatsappLabel,
          }
        : FALLBACK.contacts,
      references: (r.data ?? []) as Reference[],
    }
    state = next
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)) } catch { /* modo privado */ }
    emit()
  } catch {
    // sem conexão com o banco: mantém o que já está na tela
  }
}

let started = false
export function startSiteData() {
  if (started) return
  started = true
  refreshSiteData()
}

/** Contatos atuais (para usar fora de componentes, ex.: montar link do WhatsApp). */
export const getContacts = () => state.contacts

export function useContacts(): Contacts {
  return useSyncExternalStore(subscribe, () => state.contacts, () => FALLBACK.contacts)
}

export function useReferences(): Reference[] {
  return useSyncExternalStore(subscribe, () => state.references, () => FALLBACK.references)
}

// ---------- Ajudantes de formato ---------------------------------------
/** "@gner.moda", "instagram.com/gner.moda/" ou "gner.moda" → "gner.moda" */
export function cleanInstagram(v: string) {
  return v
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/[/?#].*$/, '')
}

export const instagramUrl = (user: string) => `https://instagram.com/${cleanInstagram(user)}`

/** Só os números; acrescenta 55 se a pessoa digitou só DDD + número. */
export function cleanWhatsapp(v: string) {
  const d = v.replace(/\D/g, '')
  return d.length === 10 || d.length === 11 ? `55${d}` : d
}

/** 5511941453472 → (11) 94145-3472 */
export function formatWhatsapp(digits: string) {
  const d = digits.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return digits
}
