import { useEffect, useMemo, useState } from 'react'
import { adminGetSettings, saveSettings, type SettingsRow } from '../lib/api'
import { site } from '../config/site'
import { cleanInstagram, cleanWhatsapp, formatWhatsapp, instagramUrl, refreshSiteData } from '../lib/siteData'

const DEFAULTS: SettingsRow = {
  email: site.email,
  instagram: site.instagram,
  whatsapp: site.whatsapp,
  whatsapp_label: site.whatsappLabel,
}

export default function ContactsEditor() {
  const [form, setForm] = useState<SettingsRow | null>(null)
  const [saved, setSaved] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    document.title = 'Contatos — painel'
    adminGetSettings().then(
      (s) => {
        const raw = s ?? DEFAULTS
        const f = { ...raw, whatsapp: formatWhatsapp(raw.whatsapp) }
        setForm(f)
        setSaved(JSON.stringify(f))
      },
      (e: Error) => setMsg({ kind: 'err', text: e.message }),
    )
  }, [])

  const dirty = useMemo(() => form !== null && JSON.stringify(form) !== saved, [form, saved])
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  if (!form) return msg ? <p className="a-error">{msg.text}</p> : <p>Carregando…</p>
  const set = <K extends keyof SettingsRow>(k: K, v: SettingsRow[K]) => setForm((f) => (f ? { ...f, [k]: v } : f))

  const ig = cleanInstagram(form.instagram)
  const wa = cleanWhatsapp(form.whatsapp)
  const waOk = /^55\d{10,11}$/.test(wa)
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())

  async function save() {
    if (!emailOk) return setMsg({ kind: 'err', text: 'Confira o e-mail.' })
    if (!ig) return setMsg({ kind: 'err', text: 'Informe o usuário do Instagram.' })
    if (!waOk) return setMsg({ kind: 'err', text: 'Confira o WhatsApp: DDD + número, ex.: (11) 94145-3472.' })
    const values: SettingsRow = {
      email: form!.email.trim(),
      instagram: ig,
      whatsapp: wa,
      whatsapp_label: form!.whatsapp_label.trim() || formatWhatsapp(wa),
    }
    setBusy(true)
    setMsg(null)
    try {
      await saveSettings(values)
      const shown = { ...values, whatsapp: formatWhatsapp(values.whatsapp) }
      setForm(shown)
      setSaved(JSON.stringify(shown))
      setMsg({ kind: 'ok', text: 'Contatos salvos — já atualizados em todo o site.' })
      refreshSiteData()
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="ed" onSubmit={(e) => { e.preventDefault(); save() }}>
      <div className="a-head">
        <div>
          <h1>Contatos</h1>
          <p className="a-row__sub">
            Usados no rodapé, na página Contato, na página inicial e nos botões de WhatsApp (inclusive o pedido de locação das peças).
            {dirty && <span className="a-dirty"> · alterações não salvas</span>}
          </p>
        </div>
      </div>

      <fieldset className="ed__card">
        <legend>E-mail e Instagram</legend>
        <div className="ed__grid">
          <label className="ed__full">
            E-mail *
            <input type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} />
          </label>
          <label className="ed__full">
            Instagram *
            <input value={form.instagram} onChange={(e) => set('instagram', e.target.value)} placeholder="gner.moda" />
            <small>Pode colar o @, o usuário ou o link do perfil.</small>
          </label>
          {ig && (
            <p className="ed__full a-inline">
              No site aparece como <strong>@{ig}</strong> ·{' '}
              <a className="a-link" href={instagramUrl(ig)} target="_blank" rel="noopener noreferrer">Testar ↗</a>
            </p>
          )}
        </div>
      </fieldset>

      <fieldset className="ed__card">
        <legend>WhatsApp</legend>
        <div className="ed__grid">
          <label>
            Número *
            <input
              inputMode="tel"
              value={form.whatsapp}
              onChange={(e) => set('whatsapp', e.target.value)}
              onBlur={() => {
                const d = cleanWhatsapp(form.whatsapp)
                if (/^55\d{10,11}$/.test(d)) setForm((f) => (f ? { ...f, whatsapp: formatWhatsapp(d), whatsapp_label: f.whatsapp_label || formatWhatsapp(d) } : f))
              }}
              placeholder="(11) 94145-3472"
            />
            <small>DDD + número. O 55 do Brasil é colocado sozinho.</small>
          </label>
          <label>
            Como aparece escrito
            <input value={form.whatsapp_label} onChange={(e) => set('whatsapp_label', e.target.value)} placeholder={waOk ? formatWhatsapp(wa) : '(11) 94145-3472'} />
            <small>Vazio = formato automático.</small>
          </label>
          {waOk ? (
            <p className="ed__full a-inline">
              Botões vão abrir o WhatsApp de <strong>{formatWhatsapp(wa)}</strong> ·{' '}
              <a className="a-link" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">Testar ↗</a>
            </p>
          ) : (
            form.whatsapp.trim() && <p className="ed__full a-warn">Número incompleto: use DDD + número (10 ou 11 dígitos).</p>
          )}
        </div>
      </fieldset>

      <div className="ed__bar">
        {msg && <p className={msg.kind === 'ok' ? 'a-ok' : 'a-error'} role="status">{msg.text}</p>}
        <div className="ed__actions">
          <button className="a-btn a-btn--primary" disabled={busy || !dirty}>{busy ? 'Salvando…' : 'Salvar contatos'}</button>
          <a className="a-btn" href="/contato" target="_blank" rel="noopener">Ver no site ↗</a>
        </div>
      </div>
    </form>
  )
}
