import React, { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePoets } from '../context/PoetsContext';
import './FavoritePoemsPage.css';

const FavoritePoemsPage = () => {
  const { poets, likes, isLoading } = usePoets();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [showOtherUser, setShowOtherUser] = useState(false);
  const [activeTab, setActiveTab] = useState('poets'); // 'poets' | 'poems'

  useEffect(() => {
    const user = localStorage.getItem('currentUser');
    setCurrentUser(user);
  }, []);

  const otherUser = currentUser === 'maxim' ? 'oleg' : 'maxim';
  const activeUser = showOtherUser ? otherUser : currentUser;
  const activeUserLabel = activeUser === 'maxim' ? 'Максима' : 'Олега';
  const toggleLabel = activeTab === 'poets'
    ? (otherUser === 'maxim' ? 'Поэты Максима' : 'Поэты Олега')
    : (otherUser === 'maxim' ? 'Стихи Максима' : 'Стихи Олега');

  const favoritePoets = useMemo(() => {
    if (!activeUser || !poets?.length) return [];
    const likedMap = likes?.[activeUser] || {};

    return poets
      .filter((poet) => likedMap[poet.id])
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [poets, likes, activeUser]);

  const favoritePoems = useMemo(() => {
    if (!activeUser || !poets?.length) return [];

    const result = [];
    poets.forEach((poet) => {
      if (!poet.poems) return;

      Object.entries(poet.poems).forEach(([poemId, poem]) => {
        if (poem?.liked?.[activeUser]) {
          result.push({
            id: `${poet.id}_${poemId}`,
            poetId: poet.id,
            poetName: poet.name,
            poetImageUrl: poet.imageUrl,
            poetImagePositionY: poet.imagePositionY,
            title: poem.title || 'Без названия',
            poemUrl: poem.url || '',
            addedAt: poem.addedAt || poet.addedAt || null,
          });
        }
      });
    });

    return result.sort((a, b) => {
      const dateA = a.addedAt ? new Date(a.addedAt).getTime() : 0;
      const dateB = b.addedAt ? new Date(b.addedAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [poets, activeUser]);

  if (!currentUser) return null;

  return (
    <div className="favorite-poems-page">
      <div className="favorite-poems-controls sorting-controls likes-tabs-controls">
        <div className="favorite-poems-tabs">
          <button
            className={`sort-btn ${activeTab === 'poets' ? 'active' : ''}`}
            onClick={() => setActiveTab('poets')}
          >
            Поэты
          </button>
          <button
            className={`sort-btn ${activeTab === 'poems' ? 'active' : ''}`}
            onClick={() => setActiveTab('poems')}
          >
            Стихи
          </button>
        </div>

        <label className="favorite-poems-toggle ratings-toggle timeline-toggle">
          <input
            type="checkbox"
            checked={showOtherUser}
            onChange={(e) => setShowOtherUser(e.target.checked)}
          />
          <span className="toggle-slider"></span>
          <span className="toggle-label">
            {toggleLabel}
          </span>
        </label>
      </div>

      {isLoading ? (
        <div className="favorite-poems-grid" />
      ) : activeTab === 'poets' ? (
        favoritePoets.length === 0 ? (
          <div className="favorite-poems-empty">
            <img src="/images/poet2.png" alt="Нет поэтов" className="empty-icon" />
            <p>У пользователя {activeUserLabel} пока нет любимых поэтов</p>
          </div>
        ) : (
          <div className="poets-grid">
            {favoritePoets.map((poet) => (
              <div key={poet.id} className="poet-card" onClick={() => navigate(`/poet/${poet.id}`)}>
                <div className="poet-card-image">
                  {poet.imageUrl ? (
                    <>
                      <img
                        src={poet.imageUrl}
                        alt={poet.name}
                        style={{ objectPosition: `center ${poet.imagePositionY ?? 25}%` }}
                      />
                      <div className="poet-card-overlay">
                        <h3 className="poet-card-name">
                          {(() => {
                            const nameParts = poet.name.split(' ');
                            if (nameParts.length === 1) {
                              return <span className="last-name">{nameParts[0]}</span>;
                            }
                            if (nameParts.length >= 2) {
                              return (
                                <>
                                  <span className="first-name">{nameParts[0]}</span>
                                  <br />
                                  <span className="last-name">{nameParts.slice(1).join(' ')}</span>
                                </>
                              );
                            }
                            return poet.name;
                          })()}
                        </h3>
                      </div>
                    </>
                  ) : (
                    <div className="poet-card-placeholder">
                      <img src="/images/poet.png" alt="Поэт" className="placeholder-icon" />
                      <h3 className="poet-card-name">{poet.name}</h3>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : favoritePoems.length === 0 ? (
        <div className="favorite-poems-empty">
          <img src="/images/poet2.png" alt="Нет стихов" className="empty-icon" />
          <p>У пользователя {activeUserLabel} пока нет любимых стихов</p>
        </div>
      ) : (
        <div className="favorite-poems-grid">
          {favoritePoems.map((poem) => (
            <div
              key={poem.id}
              className={`favorite-poem-card ${poem.poemUrl ? 'poem-clickable' : ''}`}
              onClick={() => {
                if (poem.poemUrl) window.open(poem.poemUrl, '_blank', 'noopener,noreferrer');
              }}
              role={poem.poemUrl ? 'button' : undefined}
              tabIndex={poem.poemUrl ? 0 : undefined}
              onKeyDown={(e) => {
                if (!poem.poemUrl) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  window.open(poem.poemUrl, '_blank', 'noopener,noreferrer');
                }
              }}
            >
              <Link
                to={`/poet/${poem.poetId}`}
                className="favorite-poem-avatar"
                onClick={(e) => e.stopPropagation()}
              >
                {poem.poetImageUrl ? (
                  <img
                    src={poem.poetImageUrl}
                    alt={poem.poetName}
                    style={{ objectPosition: `center ${poem.poetImagePositionY ?? 25}%` }}
                  />
                ) : (
                  <img src="/images/poet.png" alt={poem.poetName} />
                )}
              </Link>

              <div className="favorite-poem-content">
                <a
                  href={poem.poemUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="favorite-poem-title"
                  onClick={(e) => {
                    if (!poem.poemUrl) e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  {poem.title}
                </a>
                <div className="favorite-poem-meta">
                  <Link
                    to={`/poet/${poem.poetId}`}
                    className="favorite-poem-poet-link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {poem.poetName}
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FavoritePoemsPage;
