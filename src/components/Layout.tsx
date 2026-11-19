import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { site } from '../config/site'
import { instagramUrl, useContacts } from '../lib/siteData'
import { waGeneral } from '../lib/format'
import { Logo } from './ui'
import { ThemeToggle } from './ThemeToggle'
import { BagLink } from './Bag'

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/acervo', label: 'Acervo' },
  { to: '/looks', label: 'Looks' },
  { to: '/projetos', label: 'Projetos' },
  { to: '/sobre-mim', label: 'Sobre mim' },
  { to: '/referencias', label: 'Referências' },
]

export function Layout() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => {
    setOpen(false)
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <>
      <a className="skip" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="header">
        <Link to="/" className="header__logo" aria-label={`${site.name} — início`}>
          <Logo />
        </Link>
        <div className="header__tools">
          <BagLink />
          <ThemeToggle />
        <button
          className="menu-btn"
          aria-expanded={open}
          aria-controls="menu"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? 'Fechar' : 'Menu'}
        </button>
        </div>
        <nav id="menu" className={`nav${open ? ' nav--open' : ''}`} aria-label="Principal">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="nav__link">
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main id="conteudo" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
    </>
  )
}

function Footer() {
  const contacts = useContacts()
  return (
    <footer className="footer">
      <div className="footer__top">
        <Link to="/" className="footer__logo" aria-label={`${site.name} — início`}>
          <Logo />
        </Link>
        <div className="footer__cols">
          <div className="footer__col">
            <h2 className="footer__title">Explore</h2>
            <ul>
              {NAV.map((n) => (
                <li key={n.to}>
                  <Link to={n.to}>{n.label}</Link>
                </li>
              ))}
              <li>
                <Link to="/contato">Contato</Link>
              </li>
            </ul>
          </div>
          <div className="footer__col">
            <h2 className="footer__title">Contact</h2>
            <ul>
              <li>
                <a href={instagramUrl(contacts.instagram)} target="_blank" rel="noopener noreferrer">
                  @{contacts.instagram}
                </a>
              </li>
              <li>
                <a href={`mailto:${contacts.email}`}>{contacts.email}</a>
              </li>
              <li>
                <a href={waGeneral()} target="_blank" rel="noopener noreferrer">
                  WhatsApp — <span className="nowrap">{contacts.whatsappLabel}</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <p className="footer__legal">© {new Date().getFullYear()} GNER.MODA — ALL RIGHTS RESERVED</p>
    </footer>
  )
}
