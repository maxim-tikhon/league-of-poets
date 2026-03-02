import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { database } from '../firebase/config';
// import ThemeSelector from './ThemeSelector';
import './Layout.css';

const Layout = () => {
  const logoSrc = '/images/logo.png';
  
  // Состояние гирлянды (загружается из Firebase)
  // По умолчанию false, чтобы не мелькала при загрузке
  const [garlandEnabled, setGarlandEnabled] = useState(false);
  const [glowEnabled, setGlowEnabled] = useState(true);
  const [breathingEnabled, setBreathingEnabled] = useState(false);
  const [footerFlowersEnabled, setFooterFlowersEnabled] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [currentUser, setCurrentUser] = useState('');
  
  // Загружаем настройки из Firebase
  useEffect(() => {
    const settingsRef = ref(database, 'settings/garland');
    const unsubscribe = onValue(settingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGarlandEnabled(data.enabled !== false); // По умолчанию включена
        setGlowEnabled(data.glow !== false); // По умолчанию включено
        setBreathingEnabled(data.breathing === true); // По умолчанию выключено
        setFooterFlowersEnabled(data.footerFlowersEnabled !== false); // По умолчанию включено
      }
      setSettingsLoaded(true);
    });
    
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const syncCurrentUser = () => {
      setCurrentUser(localStorage.getItem('currentUser') || '');
    };

    syncCurrentUser();
    window.addEventListener('storage', syncCurrentUser);
    return () => window.removeEventListener('storage', syncCurrentUser);
  }, []);

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
            <NavLink to="/tournaments" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              Турниры
            </NavLink>
            <NavLink to="/likes" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              Лайки
            </NavLink>
            <NavLink to="/head-to-head" className={({ isActive }) => isActive ? 'nav-link nav-link-icon active' : 'nav-link nav-link-icon'} title="Статистика">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
            </NavLink>
            {currentUser === 'maxim' && (
              <NavLink to="/admin" className={({ isActive }) => isActive ? 'nav-link nav-link-icon active' : 'nav-link nav-link-icon'} title="Админ">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="3"></circle>
                  <path d="M4 20c0-4.2 3.6-7 8-7s8 2.8 8 7"></path>
                </svg>
              </NavLink>
            )}
            {/* <NavLink to="/timeline" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              Временная линия
            </NavLink> */}
            {/* <NavLink to="/head-to-head" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              Статистика
            </NavLink> */}
          </nav>
          {/* <ThemeSelector /> */}
        </div>
        
        {/* Декор хедера — внутри хедера, чтобы был виден при скролле */}
        {settingsLoaded && garlandEnabled && (
        <div className="christmas-garland">
        <svg viewBox="0 0 1200 55" preserveAspectRatio="none" className="garland-svg" style={{ overflow: 'visible' }}>
          <defs>
            {/* Фильтр размытия для мягкого свечения */}
            <filter id="blur-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="12" />
            </filter>
            
            {/* Фильтр для бокового тёплого ореола */}
            <filter id="blur-halo" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
            
            {/* Тёплый оранжевый градиент для ореола */}
            <radialGradient id="warm-halo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#e8a060" stopOpacity="0.4"/>
              <stop offset="60%" stopColor="#c08040" stopOpacity="0.2"/>
              <stop offset="100%" stopColor="#805020" stopOpacity="0"/>
            </radialGradient>
            
            {/* Фильтры — мягкие, тёплые, советские тона */}
            <filter id="glow-red" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="4" result="blur"/>
              <feFlood floodColor="#e63946" floodOpacity="0.75"/>
              <feComposite in2="blur" operator="in"/>
              <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="glow-orange" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="4" result="blur"/>
              <feFlood floodColor="#f4a261" floodOpacity="0.75"/>
              <feComposite in2="blur" operator="in"/>
              <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="glow-yellow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="4" result="blur"/>
              <feFlood floodColor="#e9c46a" floodOpacity="0.75"/>
              <feComposite in2="blur" operator="in"/>
              <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="glow-green" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="4" result="blur"/>
              <feFlood floodColor="#2a9d8f" floodOpacity="0.75"/>
              <feComposite in2="blur" operator="in"/>
              <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="glow-blue" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="4" result="blur"/>
              <feFlood floodColor="#457b9d" floodOpacity="0.75"/>
              <feComposite in2="blur" operator="in"/>
              <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="glow-milk" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="4" result="blur"/>
              <feFlood floodColor="#f5e6d3" floodOpacity="0.75"/>
              <feComposite in2="blur" operator="in"/>
              <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            
            {/* Градиенты для советских лампочек — винтажные, тёплые, приглушённые */}
            <radialGradient id="bulb-red" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#e8a090"/>
              <stop offset="40%" stopColor="#c75050"/>
              <stop offset="80%" stopColor="#8b3030"/>
              <stop offset="100%" stopColor="#4a1818"/>
            </radialGradient>
            <radialGradient id="bulb-orange" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#e8c8a0"/>
              <stop offset="40%" stopColor="#d4956a"/>
              <stop offset="80%" stopColor="#a86840"/>
              <stop offset="100%" stopColor="#5a3520"/>
            </radialGradient>
            <radialGradient id="bulb-yellow" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#e8dca8"/>
              <stop offset="40%" stopColor="#c4a850"/>
              <stop offset="80%" stopColor="#907830"/>
              <stop offset="100%" stopColor="#4a3c18"/>
            </radialGradient>
            <radialGradient id="bulb-green" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#a8c8b8"/>
              <stop offset="40%" stopColor="#5a8a6a"/>
              <stop offset="80%" stopColor="#3a5a4a"/>
              <stop offset="100%" stopColor="#1a2a20"/>
            </radialGradient>
            <radialGradient id="bulb-blue" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#a8b8c8"/>
              <stop offset="40%" stopColor="#5a7090"/>
              <stop offset="80%" stopColor="#3a4a60"/>
              <stop offset="100%" stopColor="#1a2030"/>
            </radialGradient>
            <radialGradient id="bulb-milk" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#f5efe5"/>
              <stop offset="40%" stopColor="#e0d0b8"/>
              <stop offset="80%" stopColor="#c0a888"/>
              <stop offset="100%" stopColor="#806848"/>
            </radialGradient>
          </defs>
          
          {(() => {
            // Позиции советских лампочек — 10 штук, 4 цвета
            const bulbs = [
              { x: 60, y: 4, color: 'red', rotate: -5 },
              { x: 180, y: 15, color: 'yellow', rotate: 10 },
              { x: 300, y: 3, color: 'green', rotate: -4 },
              { x: 420, y:10, color: 'blue', rotate: 7 },
              { x: 540, y: 4, color: 'red', rotate: -12 },
              { x: 660, y: 17, color: 'yellow', rotate: 5 },
              { x: 780, y: 3, color: 'green', rotate: -7 },
              { x: 900, y: 12, color: 'blue', rotate: 11 },
              { x: 1020, y: 4, color: 'red', rotate: -5 },
              { x: 1140, y: 7, color: 'yellow', rotate: -10 },
            ];
            
            // Провод через точки лампочек — с большим провисанием
            const wirePath = `M -20,${bulbs[0].y} ` + 
              bulbs.map((b, i) => {
                if (i === 0) return `L ${b.x},${b.y}`;
                const prev = bulbs[i - 1];
                const midX = (prev.x + b.x) / 2;
                const midY = Math.max(prev.y, b.y) + 10;
                return `Q ${midX},${midY} ${b.x},${b.y}`;
              }).join(' ') + ` L 1220,${bulbs[bulbs.length-1].y}`;
            
            return (
              <>
                {/* Провод — тёмно-зелёный, как советский */}
                <path 
                  d={wirePath}
                  stroke="#1a2f1a" 
                  strokeWidth="2" 
                  fill="none"
                  strokeLinecap="round"
                />
                
                {/* Советские лампочки-фонарики с поворотами */}
                {bulbs.map((bulb, i) => (
                  <g 
                    key={i} 
                    className="bulb-group" 
                    style={{ animationDelay: `${i * 0.18}s` }}
                    transform={`rotate(${bulb.rotate}, ${bulb.x}, ${bulb.y + 2})`}
                  >
                    {/* Металлический цоколь */}
                    <rect 
                      x={bulb.x - 3} 
                      y={bulb.y} 
                      width="6" 
                      height="4" 
                      fill="#6a6a6a"
                      rx="0.5"
                    />
                    <rect 
                      x={bulb.x - 2} 
                      y={bulb.y + 3} 
                      width="4" 
                      height="2" 
                      fill="#555"
                    />
                    
                    {/* Мягкое свечение вокруг лампочки */}
                    {glowEnabled && (
                    <>
                      {/* Основное свечение */}
                      <ellipse 
                        cx={bulb.x} 
                        cy={bulb.y + 17} 
                        rx="14" 
                        ry="18" 
                        fill={`url(#bulb-${bulb.color})`}
                        className={`bulb-glow no-twinkle ${breathingEnabled ? 'breathing' : ''}`}
                        filter="url(#blur-glow)"
                      />
                      {/* Тёплый ореол слева */}
                      <ellipse 
                        cx={bulb.x - 6} 
                        cy={bulb.y + 18} 
                        rx="6" 
                        ry="10" 
                        fill="url(#warm-halo)"
                        className={`bulb-halo no-twinkle ${breathingEnabled ? 'breathing' : ''}`}
                        filter="url(#blur-halo)"
                      />
                      {/* Тёплый ореол справа */}
                      <ellipse 
                        cx={bulb.x + 6} 
                        cy={bulb.y + 18} 
                        rx="6" 
                        ry="10" 
                        fill="url(#warm-halo)"
                        className={`bulb-halo no-twinkle ${breathingEnabled ? 'breathing' : ''}`}
                        filter="url(#blur-halo)"
                      />
                    </>
                    )}
                    
                    {/* Советская лампочка — вытянутая грушевидная форма */}
                    <path 
                      d={`M ${bulb.x} ${bulb.y + 5} 
                          Q ${bulb.x - 6} ${bulb.y + 12} ${bulb.x - 5} ${bulb.y + 20}
                          Q ${bulb.x - 4} ${bulb.y + 28} ${bulb.x} ${bulb.y + 30}
                          Q ${bulb.x + 4} ${bulb.y + 28} ${bulb.x + 5} ${bulb.y + 20}
                          Q ${bulb.x + 6} ${bulb.y + 12} ${bulb.x} ${bulb.y + 5} Z`}
                      fill={`url(#bulb-${bulb.color})`}
                      className={`bulb-light no-twinkle ${breathingEnabled ? 'breathing' : ''}`}
                    />
                    
                    {/* Блик на стекле */}
                    <ellipse 
                      cx={bulb.x - 1.5} 
                      cy={bulb.y + 14} 
                      rx="1.5" 
                      ry="4" 
                      fill="rgba(255,255,255,0.45)"
                      transform={`rotate(-15, ${bulb.x - 1.5}, ${bulb.y + 14})`}
                    />
                  </g>
                ))}
                
              </>
            );
          })()}
        </svg>
        </div>
        )}
      </header>
      
      <main className={`main ${settingsLoaded && garlandEnabled ? 'with-garland' : ''}`}>
        <div className="container">
          <Outlet />
        </div>
      </main>
      
      <footer className="footer">
        {settingsLoaded && footerFlowersEnabled && (
          <img src="/images/flowers.png" alt="" className="footer-flowers" aria-hidden="true" />
        )}
        <div className="container">
          <p>© 2026 Лига Поэтов.</p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;

