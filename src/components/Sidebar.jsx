import { useState } from "react";
import { NavLink } from "react-router-dom";

const DashboardIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <rect x="3" y="3" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const UsersIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ProfileIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const LogoutIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M15 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MenuIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M18 6 6 18M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BrandLogo = () => (
  <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <rect x="2" y="2" width="28" height="28" rx="8" fill="rgba(99,102,241,0.15)" stroke="rgba(99,102,241,0.45)" strokeWidth="1.5" />
    <path d="M8 23L16 9L24 23" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M11 18h10" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export default function Sidebar({ authUser, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);
  const isSuperAdmin = Boolean(authUser?.isSuperAdmin);
  const displayName = String(authUser?.fullName || authUser?.username || "").trim();
  const initials = displayName
    ? displayName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  const getSidebarLinkClass = ({ isActive }) =>
    `sidebar-link${isActive ? " sidebar-link-active" : ""}`;

  const close = () => setIsOpen(false);
  const toggle = () => setIsOpen((v) => !v);

  return (
    <>
      {/* Mobile top bar */}
      <div className="sidebar-topbar">
        <div className="sidebar-topbar-brand">
          <BrandLogo />
          <span>El Puente MT</span>
        </div>
        <button
          className="sidebar-topbar-toggle"
          type="button"
          onClick={toggle}
          aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={isOpen}
          aria-controls="app-sidebar"
        >
          {isOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div className="sidebar-backdrop" onClick={close} aria-hidden="true" />
      )}

      {/* Sidebar panel */}
      <aside
        id="app-sidebar"
        className={`app-sidebar${isOpen ? " sidebar-open" : ""}`}
        aria-label="Navegación del administrador"
      >
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-logo">
            <BrandLogo />
          </div>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name">El Puente MT</span>
            <span className="sidebar-brand-tagline">Panel admin</span>
          </div>
        </div>

        {/* Nav links */}
        <nav className="sidebar-nav" aria-label="Navegación principal">
          <NavLink className={getSidebarLinkClass} to="/admin" onClick={close}>
            <span className="sidebar-link-icon" aria-hidden="true">
              <DashboardIcon />
            </span>
            <span>Dashboard</span>
          </NavLink>
          <NavLink className={getSidebarLinkClass} to="/config" onClick={close}>
            <span className="sidebar-link-icon" aria-hidden="true">
              <SettingsIcon />
            </span>
            <span>Configuración</span>
          </NavLink>
          {isSuperAdmin && (
            <NavLink className={getSidebarLinkClass} to="/users" onClick={close}>
              <span className="sidebar-link-icon" aria-hidden="true">
                <UsersIcon />
              </span>
              <span>Usuarios</span>
            </NavLink>
          )}
          <NavLink className={getSidebarLinkClass} to="/profile" onClick={close}>
            <span className="sidebar-link-icon" aria-hidden="true">
              <ProfileIcon />
            </span>
            <span>Perfil</span>
          </NavLink>
        </nav>

        {/* Footer: user + logout */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar" aria-hidden="true">
              {initials}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{displayName || "Usuario"}</span>
              <span className="sidebar-user-role">
                {isSuperAdmin ? "Super admin" : "Admin"}
              </span>
            </div>
          </div>
          <button
            className="sidebar-logout-button"
            type="button"
            onClick={() => {
              close();
              onLogout();
            }}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <LogoutIcon />
          </button>
        </div>
      </aside>
    </>
  );
}
