import React from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import './Layout.css';

const Layout = () => {
  return (
    <div className="layout">
      <header className="header">
        <div className="container">
          <Link to="/" className="logo-link">
            <h1 className="logo">
              <img src="/images/logo.png" alt="Лига Поэтов" className="logo-icon" />
              Лига Поэтов
            </h1>
          </Link>
          <nav className="nav">
            <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              Поэты
            </NavLink>
            <NavLink to="/maxim-ranking" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              Рейтинг Максима
            </NavLink>
            <NavLink to="/oleg-ranking" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              Рейтинг Олега
            </NavLink>
            <NavLink to="/overall-ranking" className={({ isActive }) => isActive ? 'nav-link active overall-link' : 'nav-link overall-link'}>
              Общий Рейтинг
            </NavLink>
          </nav>
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

