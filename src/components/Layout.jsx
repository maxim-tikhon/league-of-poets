import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import './Layout.css';

const Layout = () => {
  return (
    <div className="layout">
      <header className="header">
        <div className="container">
          <h1 className="logo">
            <span className="logo-icon">📜</span>
            League of Poets
          </h1>
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
              🏆 Общий Рейтинг
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
          <p>© 2025 League of Poets. Битва великих поэтов.</p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;

