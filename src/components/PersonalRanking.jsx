import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { usePoets, CATEGORIES } from '../context/PoetsContext';
import StarRating from './StarRating';
import Tooltip from './Tooltip';
import BattleModal from './BattleModal';
import './PersonalRanking.css';

const PersonalRanking = ({ raterName, raterId, title, icon, color }) => {
  const { poets, ratings, categoryLeaders, isLoading, updateRating, setCategoryLeader, calculateScore } = usePoets();
  const [sortBy, setSortBy] = useState('date'); // 'overall', 'date', 'name' or category key
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'
  const [compactMode, setCompactMode] = useState(false); // Компактный режим
  const [scoreSystem, setScoreSystem] = useState('five'); // 'five' or 'hundred'
  const [battleConflict, setBattleConflict] = useState(null); // { category, poet1, poet2 }
  const lastRatingChange = useRef(null); // { poetId, category, timestamp }

  // Функция форматирования оценки в зависимости от выбранной системы
  const formatScore = useCallback((score) => {
    if (scoreSystem === 'five') {
      return (score / 20).toFixed(2); // Конвертация из 100-балльной в 5-балльную
    }
    return score.toFixed(1); // 100-балльная система
  }, [scoreSystem]);

  const getSortedPoets = () => {
    const poetsWithScores = poets.map(poet => {
      const poetRatings = ratings[raterId]?.[poet.id] || {};
      const score = calculateScore(raterId, poet.id);
      return {
        poet,
        ratings: poetRatings,
        score
      };
    });

    return poetsWithScores.sort((a, b) => {
      let aValue, bValue;
      
      if (sortBy === 'overall') {
        aValue = a.score;
        bValue = b.score;
      } else if (sortBy === 'name') {
        return sortOrder === 'asc' 
          ? a.poet.name.localeCompare(b.poet.name)
          : b.poet.name.localeCompare(a.poet.name);
      } else if (sortBy === 'date') {
        return sortOrder === 'asc'
          ? new Date(a.poet.addedAt) - new Date(b.poet.addedAt)
          : new Date(b.poet.addedAt) - new Date(a.poet.addedAt);
      } else {
        // Сортировка по категории
        aValue = a.ratings[sortBy] || 0;
        bValue = b.ratings[sortBy] || 0;
      }
      
      const primarySort = sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      
      // Если значения равны и мы сортируем по категории или общему баллу, проверяем победителя
      if (Math.abs(primarySort) < 0.01) {
        if (sortBy === 'overall' || Object.keys(CATEGORIES).includes(sortBy)) {
          // Для категорий проверяем явного лидера
          const explicitLeader = categoryLeaders[raterId]?.[sortBy];
          if (explicitLeader) {
            if (a.poet.id === explicitLeader) return -1;
            if (b.poet.id === explicitLeader) return 1;
          }
        }
      }
      
      return primarySort;
    });
  };

  const handleSort = (field) => {
    // Для общего балла и категорий - всегда desc (от лучших к худшим)
    const isScoreOrCategory = field === 'overall' || Object.keys(CATEGORIES).includes(field);
    
    if (isScoreOrCategory) {
      setSortBy(field);
      setSortOrder('desc');
    } else {
      // Для имени и даты - позволяем переключать направление
      if (sortBy === field) {
        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
        setSortBy(field);
        setSortOrder('desc');
      }
    }
  };

  const sortedPoets = getSortedPoets();
  
  // Определяем победителей в каждой категории (1-е место) для данного рейтера
  const categoryWinners = useMemo(() => {
    const winners = {
      overall: [],
      creativity: [],
      influence: [],
      drama: [],
      beauty: []
    };
    
    // Победители по категориям
    ['creativity', 'influence', 'drama', 'beauty'].forEach(category => {
      const poetsWithRatings = poets.map(poet => ({
        id: poet.id,
        rating: ratings[raterId]?.[poet.id]?.[category] || 0
      })).filter(p => p.rating > 0);
      
      if (poetsWithRatings.length > 0) {
        // Сортируем по убыванию рейтинга
        poetsWithRatings.sort((a, b) => b.rating - a.rating);
        const topRating = poetsWithRatings[0].rating;
        // Находим всех поэтов с максимальным рейтингом (на случай ничьей)
        const topPoets = poetsWithRatings.filter(p => Math.abs(p.rating - topRating) < 0.01);
        
        // Проверяем, есть ли явно выбранный лидер
        const explicitLeader = categoryLeaders[raterId]?.[category];
        
        // Если есть явный лидер И он все еще в топе - он победитель
        if (explicitLeader && topPoets.some(p => p.id === explicitLeader)) {
          winners[category] = [explicitLeader];
        }
        // Если только один поэт с максимальным рейтингом - он победитель
        else if (topPoets.length === 1) {
          winners[category] = [topPoets[0].id];
        }
        // Если несколько поэтов с максимальным рейтингом и нет явного лидера - нет победителя
        else {
          winners[category] = [];
        }
      }
    });
    
    // Победитель по общему баллу - через дуэль или явного лидера
    const poetsWithScores = poets.map(poet => ({
      id: poet.id,
      score: calculateScore(raterId, poet.id)
    })).filter(p => p.score > 0);
    
    if (poetsWithScores.length > 0) {
      poetsWithScores.sort((a, b) => b.score - a.score);
      const topScore = poetsWithScores[0].score;
      const topPoets = poetsWithScores.filter(p => Math.abs(p.score - topScore) < 0.01);
      
      // Проверяем, есть ли явно выбранный лидер
      const overallExplicitLeader = categoryLeaders[raterId]?.['overall'];
      
      // Если есть явный лидер И он все еще в топе - он победитель
      if (overallExplicitLeader && topPoets.some(p => p.id === overallExplicitLeader)) {
        winners.overall = [overallExplicitLeader];
      }
      // Если только один поэт с максимальным баллом - он победитель
      else if (topPoets.length === 1) {
        winners.overall = [topPoets[0].id];
      }
      // Если несколько поэтов с максимальным баллом и нет явного лидера - нет победителя
      // (нужна дуэль для выбора)
      else {
        winners.overall = [];
      }
    }
    
    return winners;
  }, [poets, ratings, categoryLeaders, raterId, calculateScore]);
  
  // Проверка конфликта: есть ли другие поэты с таким же максимальным баллом
  const checkForConflict = useCallback((changedPoetId, category) => {
    // Для общего балла используем calculateScore, для категорий - рейтинг категории
    const poetsWithRatings = poets.map(poet => ({
      id: poet.id,
      name: poet.name,
      imageUrl: poet.imageUrl,
      rating: category === 'overall' 
        ? calculateScore(raterId, poet.id)
        : (ratings[raterId]?.[poet.id]?.[category] || 0)
    })).filter(p => p.rating > 0);
    
    if (poetsWithRatings.length === 0) {
      // Нет поэтов с рейтингом - сбрасываем лидера если был
      const explicitLeader = categoryLeaders[raterId]?.[category];
      if (explicitLeader) {
        setCategoryLeader(raterId, category, null);
      }
      return;
    }
    
    // Находим максимальный рейтинг
    poetsWithRatings.sort((a, b) => b.rating - a.rating);
    const topRating = poetsWithRatings[0].rating;
    const topPoets = poetsWithRatings.filter(p => Math.abs(p.rating - topRating) < 0.01);
    
    const explicitLeader = categoryLeaders[raterId]?.[category];
    
    // Если только один поэт с максимальным рейтингом
    if (topPoets.length === 1) {
      const newLeader = topPoets[0].id;
      
      // Если есть старый лидер и это не он - сбросить и установить нового
      if (explicitLeader && explicitLeader !== newLeader) {
        setCategoryLeader(raterId, category, newLeader);
      }
      // Если лидера нет вообще - установить единственного топового
      else if (!explicitLeader) {
        setCategoryLeader(raterId, category, newLeader);
      }
      // Если это тот же лидер - ничего не делать
      return;
    }
    
    // Если несколько поэтов с топовым рейтингом - показываем дуэль
    // Для категорий И для общего балла
    if (explicitLeader) {
      const leaderStillOnTop = topPoets.some(p => p.id === explicitLeader);
      
      if (!leaderStillOnTop) {
        // Лидер больше не в топе, сбрасываем его
        setCategoryLeader(raterId, category, null);
        // И показываем баттл среди новых лидеров
        // Дуэль между поэтом, который изменился, и первым из топа
        const challenger = topPoets.find(p => p.id === changedPoetId);
        const opponent = topPoets.find(p => p.id !== changedPoetId);
        if (challenger && opponent) {
          setBattleConflict({
            category,
            poet1: challenger,
            poet2: opponent
          });
        }
      } else if (changedPoetId !== explicitLeader) {
        // Лидер все еще в топе, НО изменился НЕ он, а кто-то другой
        // Это значит кто-то догнал лидера - нужен баттл!
        const leader = topPoets.find(p => p.id === explicitLeader);
        const challenger = topPoets.find(p => p.id === changedPoetId);
        if (leader && challenger) {
          setBattleConflict({
            category,
            poet1: leader,
            poet2: challenger
          });
        }
      }
    } else {
      // Нет явного лидера, показываем баттл
      // Дуэль между поэтом, который изменился, и первым из остальных топовых
      const challenger = topPoets.find(p => p.id === changedPoetId);
      const opponent = topPoets.find(p => p.id !== changedPoetId);
      if (challenger && opponent) {
        setBattleConflict({
          category,
          poet1: challenger,
          poet2: opponent
        });
      }
    }
  }, [poets, ratings, raterId, categoryLeaders, setCategoryLeader, calculateScore]);
  
  // Сохраняем изначального поэта для последующей проверки overall
  const initialChangedPoetRef = useRef(null);
  
  // Обработчик изменения рейтинга с проверкой конфликтов
  const handleRatingChange = (poetId, category, newValue) => {
    // Сначала обновляем рейтинг
    updateRating(raterId, poetId, category, newValue);
    
    // Сохраняем изначального поэта (для финальной дуэли)
    initialChangedPoetRef.current = poetId;
    
    // Сохраняем информацию об изменении для useEffect
    lastRatingChange.current = {
      poetId,
      category,
      timestamp: Date.now()
    };
  };
  
  // useEffect для проверки конфликта после обновления ratings
  useEffect(() => {
    if (lastRatingChange.current) {
      const { poetId, category } = lastRatingChange.current;
      
      // Проверяем конфликт для измененной категории
      checkForConflict(poetId, category);
      
      // НЕ проверяем общий балл здесь - он будет проверен после завершения дуэли за категорию
      lastRatingChange.current = null; // Сбрасываем после проверки
    }
  }, [ratings, checkForConflict]); // Срабатывает при изменении ratings
  
  // Обработчик выбора победителя в баттле
  const handleBattleSelect = (winnerId) => {
    if (battleConflict) {
      const wasCategory = battleConflict.category !== 'overall';
      
      setCategoryLeader(raterId, battleConflict.category, winnerId);
      setBattleConflict(null);
      
      // После завершения дуэли за категорию, проверяем нужна ли дуэль за overall
      if (wasCategory && initialChangedPoetRef.current) {
        // Используем setTimeout чтобы состояние успело обновиться
        setTimeout(() => {
          // Передаем ИЗНАЧАЛЬНОГО поэта (того, для кого меняли оценку)
          // а не победителя дуэли за категорию
          checkForConflict(initialChangedPoetRef.current, 'overall');
        }, 100);
      }
    }
  };
  
  // Функция для отображения бейджей победителя
  const renderWinnerBadges = (poetId) => {
    const badges = [];
    
    // Определяем какие награды показывать в зависимости от сортировки
    let categoriesToShow = [];
    if (sortBy === 'overall') {
      // При сортировке по общему баллу показываем все награды
      categoriesToShow = ['overall', 'creativity', 'influence', 'drama', 'beauty'];
    } else if (Object.keys(CATEGORIES).includes(sortBy)) {
      // При сортировке по конкретной категории показываем только её награду
      categoriesToShow = [sortBy];
    } else {
      // При сортировке по дате или имени показываем все награды
      categoriesToShow = ['overall', 'creativity', 'influence', 'drama', 'beauty'];
    }
    
    categoriesToShow.forEach(category => {
      if (categoryWinners[category] && categoryWinners[category].includes(poetId)) {
        const categoryName = category === 'overall' ? 'Лучшй поэт' : CATEGORIES[category].name;
        badges.push(
      
            <img 
            key={category}
              src={`/images/badges/${category}.png`}
              alt={`Победитель в категории ${categoryName}`}
              className="winner-badge"
            />
  
        );
      }
    });
    
    return badges.length > 0 ? <div className="winner-badges">{badges}</div> : null;
  };

  if (poets.length === 0) {
    return (
      <div className="personal-ranking fade-in">
        {/* <div className="page-header">
          <h1 className="page-title" style={{ color }}>
            <span className="title-icon">{icon}</span>
            {title}
          </h1>
        </div> */}
        <div className="empty-state">
          <img src="/images/poet2.png" alt="Нет поэтов" className="empty-icon" />
          <p>Нет поэтов для оценки</p>
          <p className="empty-hint">Добавьте поэтов на странице "Поэты"</p>
        </div>
      </div>
    );
  }

  return (
    <div className="personal-ranking fade-in">
      {/* <div className="page-header">
        <h1 className="page-title" style={{ color }}>
          <span className="title-icon">{icon}</span>
          {title}
        </h1>
      </div> */}

      <div className="sorting-controls">
        <button 
          className={`sort-btn ${sortBy === 'date' ? 'active' : ''}`}
          onClick={() => handleSort('date')}
        >
          Дата {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
        <button 
          className={`sort-btn ${sortBy === 'name' ? 'active' : ''}`}
          onClick={() => handleSort('name')}
        >
          Имя {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
        <button 
          className={`sort-btn ${sortBy === 'overall' ? 'active' : ''}`}
          onClick={() => handleSort('overall')}
        >
          {/* <img 
            src="/images/badges/overall.png" 
            alt="Общий балл"
            className="sort-btn-icon"
          /> */}
          Общий балл
        </button>
        {Object.entries(CATEGORIES).map(([key, cat]) => (
            <button 
              key={key}
              className={`sort-btn ${sortBy === key ? 'active' : ''}`}
              onClick={() => handleSort(key)}
            >
              {/* <img 
                src={`/images/badges/${key}.png`} 
                alt={cat.name}
                className="sort-btn-icon"
              /> */}
              {cat.name}
            </button>
        ))}
        
        {/* Вкладка "Награды" - отделена от других */}
        <button 
          className={`sort-btn sort-btn-awards ${sortBy === 'awards' ? 'active' : ''}`}
          onClick={() => handleSort('awards')}
        >
          Награды
        </button>
        
        <div className="compact-mode-toggle-inline">
          <label className="toggle-label">
            <input 
              type="checkbox" 
              checked={compactMode}
              onChange={(e) => setCompactMode(e.target.checked)}
              className="toggle-checkbox"
            />
            <span className="toggle-switch"></span>
            <span className="toggle-text">Список</span>
          </label>
        </div>
        
        <div className="score-system-toggle-inline">
          <label className="toggle-label">
            <input 
              type="checkbox" 
              checked={scoreSystem === 'hundred'}
              onChange={(e) => setScoreSystem(e.target.checked ? 'hundred' : 'five')}
              className="toggle-checkbox"
            />
            <span className="toggle-switch"></span>
            <span className="toggle-text">5⇄100</span>
          </label>
        </div>
      </div>

      {sortBy === 'awards' ? (
        // Вкладка "Награды" - показываем только поэтов с наградами
        <div className="awards-list">
          {poets
            .filter(poet => {
              // Показываем только поэтов, у которых есть хотя бы одна награда
              return ['overall', 'creativity', 'influence', 'drama', 'beauty'].some(category => 
                categoryWinners[category] && categoryWinners[category].includes(poet.id)
              );
            })
            .map(poet => {
              // Собираем все награды поэта
              const poetAwards = [];
              if (categoryWinners.overall && categoryWinners.overall.includes(poet.id)) {
                poetAwards.push({ category: 'overall', name: 'Лучшй поэт' });
              }
              Object.entries(CATEGORIES).forEach(([key, cat]) => {
                if (categoryWinners[key] && categoryWinners[key].includes(poet.id)) {
                  poetAwards.push({ category: key, name: cat.name });
                }
              });

              return (
                <div key={poet.id} className="award-card">
                  {poet.imageUrl && (
                    <div className="award-poet-avatar">
                      <img src={poet.imageUrl} alt={poet.name} />
                    </div>
                  )}
                  <Link to={`/poet/${poet.id}`} className="award-poet-name-link">
                    <h3 className="award-poet-name">{poet.name}</h3>
                  </Link>
                  <div className="award-badges-container">
                    {poetAwards.map((award, index) => (
                      <Tooltip key={index} text={`Победитель в категории "${award.name}"`}>
                        <img 
                          src={`/images/badges/${award.category}.png`}
                          alt={`Победитель в категории ${award.name}`}
                          className="award-badge"
                        />
                      </Tooltip>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      ) : (
      <div className="poets-ranking-list">
        {(() => {
          // Вычисляем ранги один раз для всех поэтов
          // Показываем ранги только для общего балла и категорий (всегда desc)
          const showRank = sortBy !== 'name' && sortBy !== 'date';
          const ranks = [];
          
          if (showRank) {
            let currentRank = 1;
            for (let i = 0; i < sortedPoets.length; i++) {
              const item = sortedPoets[i];
              const currentValue = sortBy === 'overall' 
                ? item.score 
                : (item.ratings[sortBy] || 0);
              
              if (i === 0) {
                ranks.push(currentRank);
              } else {
                const prevItem = sortedPoets[i - 1];
                const prevValue = sortBy === 'overall'
                  ? prevItem.score
                  : (prevItem.ratings[sortBy] || 0);
                
                // Если значения разные, обновляем ранг
                if (Math.abs(currentValue - prevValue) >= 0.01) {
                  currentRank = i + 1;
                }
                ranks.push(currentRank);
              }
            }
          }
          
          return sortedPoets.map((item, index) => {
            const { poet, ratings: poetRatings, score } = item;
            const rank = showRank ? ranks[index] : null;
            const isOverallHighlighted = sortBy === 'overall';

            // Компактный режим
            if (compactMode) {
              // Определяем, что показывать в компактном режиме
              let displayValue;
              if (sortBy === 'overall') {
                displayValue = formatScore(score);
              } else if (Object.keys(CATEGORIES).includes(sortBy)) {
                const rating = poetRatings[sortBy] || 0;
                displayValue = rating.toFixed(1);
              } else {
                // Для сортировки по дате или имени показываем общий балл
                displayValue = formatScore(score);
              }
              
              return (
                <div key={poet.id} className="poet-ranking-card compact">
                  {rank && <span className="rank-number compact">#{rank}</span>}
                  {poet.imageUrl && (
                    <div className="poet-avatar compact">
                      <img src={poet.imageUrl} alt={poet.name} />
                    </div>
                  )}
                  <Link to={`/poet/${poet.id}`} className="poet-name-link">
                    <h3 className="poet-name compact">{poet.name}</h3>
                  </Link>
                  
                  <div className="poet-ranking-right-section">
                    {renderWinnerBadges(poet.id)}
                    <div className="score-compact">
                      <span className="score-value-compact">
                        {displayValue}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }

            // Полный режим
            return (
              <div key={poet.id} className="poet-ranking-card">
                <div className="poet-ranking-header">
                  {rank && <span className="rank-number">#{rank}</span>}
                  {poet.imageUrl && (
                    <div className="poet-avatar">
                      <img src={poet.imageUrl} alt={poet.name} />
                    </div>
                  )}
                  <Link to={`/poet/${poet.id}`} className="poet-name-link">
                    <h3 className="poet-name">{poet.name}</h3>
                  </Link>
                  
                  <div className="poet-ranking-right-section">
                    {renderWinnerBadges(poet.id)}
                    <div className={`total-score ${isOverallHighlighted ? 'highlighted' : ''}`}>
        
                      <span className="score-value">{formatScore(score)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="ratings-grid">
                  {Object.entries(CATEGORIES).map(([key, cat]) => {
                    const rating = poetRatings[key] || 0;
                    const points = rating * cat.coefficient;
                    const isHighlighted = sortBy === key;
                    
                    return (
                      <div 
                        key={key} 
                        className={`rating-item ${isHighlighted ? 'highlighted' : ''}`}
                      >
                        <div className="rating-label">
                          <Tooltip text={cat.description}>
                            <span className="category-name">{cat.name}</span>
                          </Tooltip>
                          <span className="category-coefficient">×{cat.coefficient}</span>
                        </div>
                        <StarRating
                          value={rating}
                          onChange={(value) => handleRatingChange(poet.id, key, value)}
                        />
        
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          });
        })()}
      </div>
      )}
      
      {/* Модалка для выбора победителя при конфликте */}
      {battleConflict && (
        <BattleModal
          poet1={battleConflict.poet1}
          poet2={battleConflict.poet2}
          category={battleConflict.category}
          onSelect={handleBattleSelect}
          onClose={() => setBattleConflict(null)}
        />
      )}
    </div>
  );
};

export default PersonalRanking;

