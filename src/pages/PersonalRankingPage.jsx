import React, { useState, useEffect } from 'react';
import { CATEGORIES } from '../context/PoetsContext';
import { USERS, USER_LABELS } from '../constants';
import PersonalRanking from '../components/PersonalRanking';
import TripleToggle from '../components/TripleToggle';
import './PersonalRankingPage.css';

const USER_CONFIGS = {
  maxim: { name: 'Maxim', title: 'Рейтинг Максима', icon: '🧟‍♂️', color: '#7E3E45' },
  oleg: { name: 'Oleg', title: 'Рейтинг Олега', icon: '🧛‍♂️', color: '#2c5f2d' },
  lyuba: { name: 'Lyuba', title: 'Рейтинг Любы', icon: '🧚‍♀️', color: '#ec4899' }
};

const PersonalRankingPage = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [compareWith, setCompareWith] = useState(null); // null | userId
  const [sortBy, setSortBy] = useState('overall');

  useEffect(() => {
    const user = localStorage.getItem('currentUser');
    setCurrentUser(user);
  }, []);

  if (!currentUser) return null;

  const currentConfig = USER_CONFIGS[currentUser];
  const otherUsers = USERS.filter((u) => u !== currentUser);
  const compareMode = Boolean(compareWith);
  const compareConfig = compareWith ? USER_CONFIGS[compareWith] : null;

  const handleSort = (field) => setSortBy(field);

  return (
    <div className={`personal-ranking-page ${compareMode ? 'compare-mode' : ''}`}>
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

        <TripleToggle
          className="compare-toggle-wrap"
          value={compareWith}
          onChange={setCompareWith}
          options={[
            { value: null, label: 'Выкл' },
            ...otherUsers.map((u) => ({ value: u, label: USER_LABELS[u] }))
          ]}
        />
      </div>

      <div className="rankings-container">
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

        {compareMode && compareConfig && (
          <div className="ranking-column other-user">
            <PersonalRanking
              raterName={compareConfig.name}
              raterId={compareWith}
              title={compareConfig.title}
              icon={compareConfig.icon}
              color={compareConfig.color}
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
