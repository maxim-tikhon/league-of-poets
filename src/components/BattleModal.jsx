import React from 'react';
import { CATEGORIES } from '../context/PoetsContext';
import './BattleModal.css';

const BattleModal = ({ poet1, poet2, category, onSelect, onClose }) => {
  const isOverall = category === 'overall';
  const categoryName = isOverall ? 'Общий балл' : CATEGORIES[category]?.name || category;
  
  return (
    <div className="battle-modal-overlay" onClick={onClose}>
      <div className={`battle-modal ${isOverall ? 'epic-duel' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="battle-header">
          {isOverall ? (
            <>
              <h2 className="battle-title epic">ФИНАЛЬНАЯ ДУЭЛЬ</h2>
              <p className="battle-subtitle">
                Выберите победителя в категории <strong>"Лучшй Поэт"</strong>
              </p>
              <p className="battle-description epic">
                Два величайших поэта. Одинаковый балл. Только один станет легендой.
              </p>
            </>
          ) : (
            <>
              <h2 className="battle-title">ДУЭЛЬ</h2>
              <p className="battle-subtitle">
                Выберите победителя в категории <strong>"{categoryName}"</strong>
              </p>
            </>
          )}
        </div>
        
        <div className="battle-arena">
          <button 
            className="battle-poet-card left"
            onClick={() => onSelect(poet1.id)}
          >
            <div className="battle-poet-image">
              {poet1.imageUrl ? (
                <>
                  <img 
                    src={poet1.imageUrl} 
                    alt={poet1.name}
                  />
                  <div className="battle-poet-overlay">
                    <h3 className="battle-poet-name">
                      {(() => {
                        const nameParts = poet1.name.split(' ');
                        if (nameParts.length >= 2) {
                          return (
                            <>
                              <span className="first-name">{nameParts[0]}</span>
                              <br />
                              <span className="last-name">{nameParts.slice(1).join(' ')}</span>
                            </>
                          );
                        }
                        return poet1.name;
                      })()}
                    </h3>
                  </div>
                </>
              ) : (
                <div className="battle-poet-placeholder">
                  <img src="/images/poet.png" alt="Поэт" className="placeholder-icon" />
                  <h3 className="battle-poet-name">{poet1.name}</h3>
                </div>
              )}
            </div>
          </button>
          
          <div className="battle-prize">
            <img 
              src={`/images/badges/${category}.png`} 
              alt={categoryName}
              className="battle-prize-icon"
            />
          </div>
          
          <button 
            className="battle-poet-card right"
            onClick={() => onSelect(poet2.id)}
          >
            <div className="battle-poet-image">
              {poet2.imageUrl ? (
                <>
                  <img 
                    src={poet2.imageUrl} 
                    alt={poet2.name}
                  />
                  <div className="battle-poet-overlay">
                    <h3 className="battle-poet-name">
                      {(() => {
                        const nameParts = poet2.name.split(' ');
                        if (nameParts.length >= 2) {
                          return (
                            <>
                              <span className="first-name">{nameParts[0]}</span>
                              <br />
                              <span className="last-name">{nameParts.slice(1).join(' ')}</span>
                            </>
                          );
                        }
                        return poet2.name;
                      })()}
                    </h3>
                  </div>
                </>
              ) : (
                <div className="battle-poet-placeholder">
                  <img src="/images/poet.png" alt="Поэт" className="placeholder-icon" />
                  <h3 className="battle-poet-name">{poet2.name}</h3>
                </div>
              )}
            </div>
          </button>
        </div>
        
        <button className="battle-close-btn" onClick={onClose}>
          ✕
        </button>
      </div>
    </div>
  );
};

export default BattleModal;

