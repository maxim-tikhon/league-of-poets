import React, { useState, useEffect, useRef } from 'react';
import { themes, applyTheme, getCurrentTheme } from '../themes';
import './ThemeSelector.css';

const ThemeSelector = () => {
  const [currentTheme, setCurrentTheme] = useState(getCurrentTheme());
  const [isOpen, setIsOpen] = useState(false);
  const closeTimeoutRef = useRef(null);

  useEffect(() => {
    // Применяем сохраненную тему при загрузке
    applyTheme(currentTheme);
    
    // Очищаем таймер при размонтировании
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  const handleThemeChange = (themeName) => {
    setCurrentTheme(themeName);
    applyTheme(themeName);
    setIsOpen(false);
    // Отправляем событие для обновления других компонентов
    window.dispatchEvent(new Event('themechange'));
  };

  return (
    <div 
      className="theme-selector"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        className="theme-toggle-btn"
        title="Сменить тему"
      >
        <svg 
          width="20" 
          height="20" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a10 10 0 0 0 0 20" fill="currentColor" opacity="0.3" />
        </svg>
      </button>

      {isOpen && (
        <div className="theme-dropdown">
            <div className="theme-dropdown-header">Выбрать тему</div>
            {Object.entries(themes).map(([key, theme]) => (
              <button
                key={key}
                className={`theme-option ${currentTheme === key ? 'active' : ''}`}
                onClick={() => handleThemeChange(key)}
              >
                <span className="theme-name">{theme.name}</span>
                {currentTheme === key && <span className="theme-check">✓</span>}
              </button>
            ))}
        </div>
      )}
    </div>
  );
};

export default ThemeSelector;

