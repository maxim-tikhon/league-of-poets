import React, { useState, useEffect } from 'react';
import { CATEGORIES } from '../context/PoetsContext';
import PersonalRanking from '../components/PersonalRanking';
import './PersonalRankingPage.css';

const PersonalRankingPage = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [sortBy, setSortBy] = useState('overall');

  // Получаем текущего пользователя из localStorage
  useEffect(() => {
    const user = localStorage.getItem('currentUser');
    setCurrentUser(user);
  }, []);

  if (!currentUser) {
    return null;
  }

  // Конфигурация пользователей
  const userConfig = {
    maxim: {
      name: 'Maxim',
      title: 'Рейтинг Максима',
      icon: '🧟‍♂️',
      color: '#7E3E45'
    },
    oleg: {
      name: 'Oleg',
      title: 'Рейтинг Олега',
      icon: '🧛‍♂️',
      color: '#2c5f2d'
    }
  };

  const currentConfig = userConfig[currentUser];
  const otherUser = currentUser === 'maxim' ? 'oleg' : 'maxim';
  const otherConfig = userConfig[otherUser];

  const handleSort = (field) => {
    setSortBy(field);
  };

  return (
    <div className={`personal-ranking-page ${compareMode ? 'compare-mode' : ''}`}>
      {/* Общие вкладки и тоггл */}
      <div className="page-sorting-controls">
        <button 
          className={`sort-btn ${sortBy === 'overall' ? 'active' : ''}`}
          onClick={() => handleSort('overall')}
        >
          Общий балл
        </button>
        {Object.entries(CATEGORIES).map(([key, cat]) => (
          <button 
            key={key}
            className={`sort-btn ${sortBy === key ? 'active' : ''}`}
            onClick={() => handleSort(key)}
          >
            {cat.name}
          </button>
        ))}
        
        {/* Тоггл для режима сравнения */}
        <label className="compare-toggle">
          <input
            type="checkbox"
            checked={compareMode}
            onChange={(e) => setCompareMode(e.target.checked)}
          />
          <span className="toggle-slider"></span>
          <span className="toggle-label">
            {otherConfig.name === 'Maxim' ? 'Рейтинг Максима' : 'Рейтинг Олега'}
          </span>
        </label>
      </div>

      {/* Рейтинги */}
      <div className="rankings-container">
        {/* Рейтинг текущего пользователя */}
        <div className="ranking-column current-user">
          <PersonalRanking 
            raterName={currentConfig.name}
            raterId={currentUser}
            title={currentConfig.title}
            icon={currentConfig.icon}
            color={currentConfig.color}
            compareMode={compareMode}
            sortBy={sortBy}
            hideControls={true}
          />
        </div>

        {/* Рейтинг другого пользователя (только в режиме сравнения) */}
        {compareMode && (
          <div className="ranking-column other-user">
            <PersonalRanking 
              raterName={otherConfig.name}
              raterId={otherUser}
              title={otherConfig.title}
              icon={otherConfig.icon}
              color={otherConfig.color}
              compareMode={compareMode}
              isSecondary={true}
              sortBy={sortBy}
              hideControls={true}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonalRankingPage;
