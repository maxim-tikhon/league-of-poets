import React from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
// import ThemeSelector from './ThemeSelector';
import './Layout.css';

const Layout = () => {
  const logoSrc = '/images/logo.png';

  return (
    <div className="layout">
      <header className="header">
        <div className="container header-container">
          <Link to="/" className="logo-link">
            <h1 className="logo">
              <img src={logoSrc} alt="Лига Поэтов" className="logo-icon" />
              Лига Поэтов
            </h1>
          </Link>
          <nav className="nav">
            <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              Поэты
            </NavLink>
            <NavLink to="/personal-ranking" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              Мой рейтинг
            </NavLink>
            <NavLink to="/overall-ranking" className={({ isActive }) => isActive ? 'nav-link active overall-link' : 'nav-link overall-link'}>
              Общий Рейтинг
            </NavLink>
            <NavLink to="/awards" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              Награды
            </NavLink>
            <NavLink to="/head-to-head" className={({ isActive }) => isActive ? 'nav-link nav-link-icon active' : 'nav-link nav-link-icon'} title="Статистика">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
            </NavLink>
            {/* <NavLink to="/admin" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              Админка
            </NavLink> */}
            {/* <NavLink to="/timeline" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              Временная линия
            </NavLink> */}
            {/* <NavLink to="/head-to-head" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              Статистика
            </NavLink> */}
          </nav>
          {/* <ThemeSelector /> */}
        </div>
      </header>
      
      <main className="main">
        <div className="container">
          <Outlet />
        </div>
      </main>
      
      <footer className="footer">
        <div className="container">
          <p>© 2025 Лига Поэтов.</p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;

