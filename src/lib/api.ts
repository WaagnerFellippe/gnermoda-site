import { supabase } from './supabase'
import type { Look, Piece, Project } from './types'
import type { Reference } from './siteData'

const IMG = 'id,path,thumb,width,height,alt,position'
const PIECE = `id,code,slug,name,category,sizes,colors,materials,status,description,measurements,condition,price_note,is_published,sort_order,piece_images(${IMG})`
const PROJECT_LIST = `id,code,slug,title,artist,stylist,short_description,category,project_date,status,sort_order,featured_home,is_test,updated_at,project_images(${IMG},caption,is_cover)`
const PROJECT_FULL = `${PROJECT_LIST},body,published_at,project_credits(id,name,role,position),project_pieces(position,pieces(${PIECE}))`

function check<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data as T
}

// ---------- Público --------------------------------------------------
export async function listPieces(): Promise<Piece[]> {
  return check(
    await supabase.from('pieces').select(PIECE).eq('is_published', true).order('sort_order').order('code'),
  ) as unknown as Piece[]
}

export async function getPiece(slug: string): Promise<Piece | null> {
  const rows = check(
    await supabase
      .from('pieces')
      .select(`${PIECE},project_pieces(projects(id,slug,title,status))`)
      .eq('slug', slug)
      .limit(1),
  ) as unknown as Piece[]
  return rows[0] ?? null
}

export async function listPublishedProjects(): Promise<Project[]> {
  return check(
    await supabase.from('projects').select(PROJECT_LIST).eq('status', 'published').order('sort_order').order('published_at', { ascending: false }),
  ) as unknown as Project[]
}

/** Visitante só recebe projetos publicados (regra do banco). Admin logado recebe também rascunhos → pré-visualização. */
export async function getProject(slug: string): Promise<Project | null> {
  const rows = check(await supabase.from('projects').select(PROJECT_FULL).eq('slug', slug).limit(1)) as unknown as Project[]
  return rows[0] ?? null
}

// ---------- Admin ----------------------------------------------------
export async function adminListProjects(): Promise<Project[]> {
  return check(await supabase.from('projects').select(PROJECT_LIST).order('sort_order').order('updated_at', { ascending: false })) as unknown as Project[]
}

export async function adminGetProject(id: string): Promise<Project | null> {
  const rows = check(await supabase.from('projects').select(PROJECT_FULL).eq('id', id).limit(1)) as unknown as Project[]
  return rows[0] ?? null
}

export async function adminListPieces(): Promise<Piece[]> {
  return check(await supabase.from('pieces').select(PIECE).order('sort_order').order('code')) as unknown as Piece[]
}

export async function adminGetPiece(id: string): Promise<Piece | null> {
  const rows = check(
    await supabase.from('pieces').select(`${PIECE},project_pieces(projects(id,slug,title,status))`).eq('id', id).limit(1),
  ) as unknown as Piece[]
  return rows[0] ?? null
}

export interface SaveResult {
  id: string
  code: string
  slug: string
  status?: string
  removed_paths: string[]
}

export async function rpcSave(fn: 'save_project' | 'save_piece', payload: unknown): Promise<SaveResult> {
  return check(await supabase.rpc(fn, { p: payload })) as SaveResult
}

export async function updateRow(table: 'projects' | 'pieces', id: string, values: Record<string, unknown>) {
  check(await supabase.from(table).update(values).eq('id', id).select('id'))
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) return false
  const r = await supabase.from('admins').select('user_id').eq('user_id', u.user.id).limit(1)
  return !r.error && (r.data?.length ?? 0) > 0
}

// ---------- Referências e contatos (painel) ---------------------------

export type ReferenceInput = Omit<Reference, 'id'> & { id?: string }

export async function adminListReferences(): Promise<Reference[]> {
  return check(await supabase.from('site_references').select('*').order('position').order('created_at')) as Reference[]
}

export async function adminGetReference(id: string): Promise<Reference | null> {
  const rows = check(await supabase.from('site_references').select('*').eq('id', id).limit(1)) as Reference[]
  return rows[0] ?? null
}

export async function saveReference(r: ReferenceInput): Promise<Reference> {
  const rows = check(await supabase.from('site_references').upsert(r).select('*')) as Reference[]
  return rows[0]
}

export async function updateReference(id: string, values: Partial<Reference>) {
  check(await supabase.from('site_references').update(values).eq('id', id).select('id'))
}

export async function deleteReference(id: string) {
  check(await supabase.from('site_references').delete().eq('id', id).select('id'))
}

export interface SettingsRow { email: string; instagram: string; whatsapp: string; whatsapp_label: string }

export async function adminGetSettings(): Promise<SettingsRow | null> {
  const r = await supabase.from('site_settings').select('email,instagram,whatsapp,whatsapp_label').eq('id', 1).maybeSingle()
  if (r.error) throw new Error(r.error.message)
  return r.data as SettingsRow | null
}

export async function saveSettings(values: SettingsRow) {
  check(await supabase.from('site_settings').upsert({ id: 1, ...values }).select('id'))
}

// ---------- Looks prontos -------------------------------------------
type LookRow = Omit<Look, 'pieces'>
type LookLink = { look_id: string; piece_id: string; position: number }

function attachPieces(looks: LookRow[], links: LookLink[], pieces: Piece[]): Look[] {
  const byId = new Map(pieces.map((p) => [p.id, p]))
  return looks.map((l) => ({
    ...l,
    pieces: links
      .filter((x) => x.look_id === l.id)
      .sort((a, b) => a.position - b.position)
      .map((x) => byId.get(x.piece_id))
      .filter((p): p is Piece => !!p),
  }))
}

export async function listPublishedLooks(): Promise<Look[]> {
  const [looks, links, pieces] = await Promise.all([
    supabase.from('looks').select('*').eq('status', 'published').order('position').order('created_at'),
    supabase.from('look_pieces').select('look_id,piece_id,position'),
    listPieces(),
  ])
  return attachPieces(check(looks) as LookRow[], check(links) as LookLink[], pieces).filter((l) => l.pieces.length > 0)
}

export async function getLook(slug: string): Promise<Look | null> {
  const rows = check(await supabase.from('looks').select('*').eq('slug', slug).limit(1)) as LookRow[]
  if (!rows[0]) return null
  const [links, pieces] = await Promise.all([
    supabase.from('look_pieces').select('look_id,piece_id,position').eq('look_id', rows[0].id),
    listPieces(),
  ])
  return attachPieces(rows, check(links) as LookLink[], pieces)[0]
}

export async function adminListLooks(): Promise<Look[]> {
  const [looks, links] = await Promise.all([
    supabase.from('looks').select('*').order('position').order('created_at'),
    supabase.from('look_pieces').select('look_id,piece_id,position'),
  ])
  return attachPieces(check(looks) as LookRow[], check(links) as LookLink[], await adminListPieces())
}

export async function adminGetLook(id: string): Promise<Look | null> {
  const rows = check(await supabase.from('looks').select('*').eq('id', id).limit(1)) as LookRow[]
  if (!rows[0]) return null
  const links = check(await supabase.from('look_pieces').select('look_id,piece_id,position').eq('look_id', id)) as LookLink[]
  return attachPieces(rows, links, await adminListPieces())[0]
}

export async function saveLook(look: LookRow & { piece_ids: string[] }): Promise<LookRow> {
  const r = await supabase.rpc('save_look', { p: look })
  if (r.error) throw new Error(r.error.message)
  return r.data as LookRow
}

export async function updateLook(id: string, values: Partial<LookRow>) {
  check(await supabase.from('looks').update(values).eq('id', id).select('id'))
}

export async function deleteLook(id: string) {
  check(await supabase.from('looks').delete().eq('id', id).select('id'))
}
