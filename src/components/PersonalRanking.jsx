import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePoets, CATEGORIES } from '../context/PoetsContext';
import StarRating from './StarRating';
import Tooltip from './Tooltip';
import './PersonalRanking.css';

const PersonalRanking = ({ 
  raterName, 
  raterId, 
  title, 
  icon, 
  color, 
  compareMode = false, 
  isSecondary = false,
  sortBy: externalSortBy,
  hideControls = false
}) => {
  const location = useLocation();
  const { poets, ratings, categoryLeaders, isLoading, updateRating, setCategoryLeader, calculateScore, likes, toggleLike } = usePoets();
  
  // Используем внешнее состояние сортировки если передано, иначе внутреннее
  const [internalSortBy, setInternalSortBy] = useState('overall');
  const sortBy = externalSortBy !== undefined ? externalSortBy : internalSortBy;
  const setInternalSortByFn = setInternalSortBy;
  
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'
  const [expandedCards, setExpandedCards] = useState([]); // Развернутые карточки
  const scrolledToPoetRef = useRef(null); // ID поэта, к которому уже был выполнен скролл
  const [currentUser, setCurrentUser] = useState(null); // Текущий пользователь
  const [currentTheme, setCurrentTheme] = useState('classic'); // Текущая тема
  
  // Получаем текущего пользователя из localStorage
  useEffect(() => {
    const user = localStorage.getItem('currentUser');
    setCurrentUser(user);
  }, []);

  // Получение текущей темы
  useEffect(() => {
    const theme = localStorage.getItem('selectedTheme') || 'classic';
    setCurrentTheme(theme);
  }, []);
  
  // Сворачиваем все карточки при включении режима сравнения
  useEffect(() => {
    if (compareMode) {
      setExpandedCards([]);
    }
  }, [compareMode]);

  // Функция форматирования общего балла (2 знака после запятой)
  const formatScore = (score) => {
    // Математическое округление (2.965 → 2.97)
    return (Math.round(score * 100) / 100).toFixed(2);
  };

  // Функция сокращения имени: "Александр Пушкин" → "А. Пушкин"
  const shortenName = (fullName) => {
    const parts = fullName.trim().split(' ');
    if (parts.length < 2) return fullName;
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');
    return `${firstName[0]}. ${lastName}`;
  };

  const getSortedPoets = () => {
    const poetsWithScores = poets
      .map(poet => {
        const poetRatings = ratings[raterId]?.[poet.id] || {};
        const score = calculateScore(raterId, poet.id);
        return {
          poet,
          ratings: poetRatings,
          score
        };
      })
      .filter(item => item.score > 0); // Показываем только поэтов с оценками

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
      
      // Если значения равны и мы сортируем по категории или общему баллу, проверяем победителя/худшего
      if (Math.abs(primarySort) < 0.01) {
        if (sortBy === 'overall' || Object.keys(CATEGORIES).includes(sortBy)) {
          // Для категорий проверяем явного лидера
          const explicitLeader = categoryLeaders[raterId]?.[sortBy];
          if (explicitLeader) {
            if (a.poet.id === explicitLeader) return -1;
            if (b.poet.id === explicitLeader) return 1;
          }
          
          // Для overall также проверяем худшего
          if (sortBy === 'overall') {
            const explicitLoser = categoryLeaders[raterId]?.['overall_worst'];
            if (explicitLoser) {
              if (a.poet.id === explicitLoser) return 1; // Худший идет ниже
              if (b.poet.id === explicitLoser) return -1; // Другой идет выше
            }
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
        
        // Проверяем, есть ли явно выбранный лидер через дуэль
        const explicitLeader = categoryLeaders[raterId]?.[category];
        
        if (explicitLeader) {
          // Если лидер выбран через дуэль - он и есть победитель
          // (дуэль уже решила, дополнительные проверки не нужны)
          winners[category] = [explicitLeader];
        }
        // Если НЕТ явного лидера и только один поэт с максимальным рейтингом - автоматический победитель
        else if (topPoets.length === 1) {
          winners[category] = [topPoets[0].id];
        }
        // Если несколько поэтов с максимальным рейтингом и нет явного лидера - нужна дуэль
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
      
      // Проверяем, есть ли явно выбранный лидер через дуэль
      const overallExplicitLeader = categoryLeaders[raterId]?.['overall'];
      
      if (overallExplicitLeader) {
        // Если лидер выбран через дуэль - он и есть победитель
        // (дуэль уже решила, дополнительные проверки не нужны)
        winners.overall = [overallExplicitLeader];
      }
      // Если НЕТ явного лидера и только один поэт с максимальным баллом - автоматический победитель
      else if (topPoets.length === 1) {
        winners.overall = [topPoets[0].id];
      }
      // Если несколько поэтов с максимальным баллом и нет явного лидера - нужна дуэль
      else {
        winners.overall = [];
      }
    }
    
    return winners;
  }, [poets, ratings, categoryLeaders, raterId, calculateScore]);

  // Определяем худшего по общему баллу
  const categoryLosers = useMemo(() => {
    const losers = {
      overall: []
    };
    
    // Худший только по общему баллу
    const poetsWithScores = poets.map(poet => ({
      id: poet.id,
      score: calculateScore(raterId, poet.id)
    })).filter(p => p.score > 0);
    
    // Награда выдается только если в рейтинге больше 3 поэтов
    if (poetsWithScores.length > 3) {
      poetsWithScores.sort((a, b) => a.score - b.score); // По возрастанию
      const lowestScore = poetsWithScores[0].score;
      const lowestPoets = poetsWithScores.filter(p => Math.abs(p.score - lowestScore) < 0.01);
      
      // Проверяем есть ли явно выбранный худший через дуэль
      const explicitLoser = categoryLeaders[raterId]?.['overall_worst'];
      
      if (explicitLoser) {
        // Если худший выбран через дуэль - он и есть худший
        // (дуэль уже решила, дополнительные проверки не нужны)
        losers.overall = [explicitLoser];
      }
      // Если НЕТ явно выбранного худшего и только один поэт с минимальным баллом - автоматически худший
      else if (lowestPoets.length === 1) {
        losers.overall = [lowestPoets[0].id];
      }
      // Если несколько поэтов с минимальным баллом и нет явно выбранного - нужна дуэль
      else {
        losers.overall = [];
      }
    }
    
    return losers;
  }, [poets, raterId, calculateScore, categoryLeaders]);
  
  // ===== ВСЯ ЛОГИКА ДУЭЛЕЙ И ПЕРЕСЧЕТА ПЕРЕНЕСЕНА НА PoetDetailPage =====
  // PersonalRanking - ТОЛЬКО для отображения данных
  
  // Обработка перехода со страницы поэта (скролл к карточке и разворачивание)
  useEffect(() => {
    if (location.state?.poetId && poets.length > 0 && !isSecondary) {
      const poetId = location.state.poetId;
      
      // Проверяем, не выполняли ли мы уже скролл для этого поэта
      if (scrolledToPoetRef.current === poetId) {
        return;
      }
      
      // Если сортировка по общему баллу и не режим сравнения - разворачиваем карточку
      if (sortBy === 'overall' && !compareMode) {
        setExpandedCards([poetId]);
      }
      
      // Скроллим к карточке после небольшой задержки (чтобы DOM обновился)
      setTimeout(() => {
        const cardElement = document.querySelector(`[data-poet-id="${poetId}"]`);
        if (cardElement) {
          cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
      
      // Сохраняем ID поэта, к которому выполнили скролл
      scrolledToPoetRef.current = poetId;
      
      // Очищаем state после обработки
      window.history.replaceState({}, document.title);
    }
  }, [location.state, poets, sortBy, compareMode, isSecondary]);

  // Сворачиваем все карточки при переключении на сортировку по категориям
  useEffect(() => {
    if (sortBy !== 'overall') {
      setExpandedCards([]);
    }
  }, [sortBy]);
  
  // Функция для отображения бейджей победителя и худшего
  const renderWinnerBadges = (poetId) => {
    const badges = [];
    
    // Определяем, какие награды показывать в зависимости от выбранной категории
    let categoriesToShow = [];
    
    if (sortBy === 'overall') {
      // На вкладке "Общий балл" показываем ВСЕ награды
      categoriesToShow = ['overall', 'creativity', 'influence', 'drama', 'beauty'];
    } else {
      // На вкладке конкретной категории показываем ТОЛЬКО награду этой категории
      categoriesToShow = [sortBy];
    }
    
    // Награды за 1-е место (лучший)
    categoriesToShow.forEach(category => {
      if (categoryWinners[category] && categoryWinners[category].includes(poetId)) {
        const categoryName = category === 'overall' ? 'Лучший поэт' : CATEGORIES[category].name;
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
    
    // Награда за последнее место (худший) - показываем только на вкладке "Общий балл"
    if (sortBy === 'overall' && categoryLosers.overall && categoryLosers.overall.includes(poetId)) {
      badges.push(
          <img 
          key="overall-last"
            src={`/images/badges/last.png`}
            alt="Худший поэт"
            className="winner-badge loser-badge"
          />
      );
    }
    
    return badges.length > 0 ? <div className="winner-badges">{badges}</div> : null;
  };

  // Обработчик клика на лайк (только для владельца рейтинга)
  const handleLikeClick = (e, poetId) => {
    e.stopPropagation(); // Предотвращаем разворачивание карточки
    // Лайкать может только владелец рейтинга
    if (currentUser === raterId) {
      toggleLike(raterId, poetId);
    }
  };

  // Рендер лайка (показываем лайки владельца рейтинга, а не текущего пользователя)
  const renderLike = (poetId, isCompact = false) => {
    // Показываем лайки владельца этого рейтинга (raterId), а не текущего пользователя
    const isLiked = likes[raterId]?.[poetId] || false;
    
    // Если не лайкнуто - показываем только на своем рейтинге и в развернутом виде
    if (!isLiked) {
      // В компактном режиме никогда не показываем пустое сердечко
      return null;
      // На чужом рейтинге не показываем пустое сердечко
      
    }
    
    // Кликабельно только если это мой рейтинг (currentUser === raterId) и не компактный режим
    const isClickable = false;
    
    return (
      <img 
        src={
          isLiked 
            ? (currentTheme === 'classic' ? '/images/clike.png' : '/images/like.png')
            : '/images/notlike.png'
        }
        alt={isLiked ? 'В избранном' : 'Не в избранном'}
        className={`like-icon ${isLiked ? 'liked' : ''} ${isCompact ? 'compact' : ''} ${!isClickable ? 'readonly' : ''}`}
        onClick={isClickable ? (e) => handleLikeClick(e, poetId) : undefined}
        title={isClickable ? (isLiked ? 'Убрать из избранного' : 'Добавить в избранное') : ''}
      />
    );
  };

  // Пока загружается - показываем пустой контейнер
  if (isLoading) {
    return <div className="personal-ranking"></div>;
  }

  if (poets.length === 0) {
    return (
      <div className="personal-ranking">
        <div className="empty-state">
          <img src="/images/poet2.png" alt="Нет поэтов" className="empty-icon" />
          <p>Нет поэтов для оценки</p>
          <p className="empty-hint">Добавьте поэтов на странице "Поэты"</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`personal-ranking ${compareMode ? 'compare-mode' : ''}`}>
      {/* <div className="page-header">
        <h1 className="page-title" style={{ color }}>
          <span className="title-icon">{icon}</span>
          {title}
        </h1>
      </div> */}

      {/* Показываем вкладки только если hideControls = false */}
      {!hideControls && (
        <div className="sorting-controls">
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
        </div>
      )}

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
            const isExpanded = expandedCards.includes(poet.id);
            const canExpand = sortBy === 'overall' && !compareMode; // Можно разворачивать только для общего балла и не в режиме сравнения

            // Обработчик клика для разворачивания/сворачивания карточки
            const toggleExpand = () => {
              if (!canExpand) return; // Не разворачивать для категорий
              
              if (isExpanded) {
                setExpandedCards(expandedCards.filter(id => id !== poet.id));
              } else {
                setExpandedCards([...expandedCards, poet.id]);
              }
            };

            // Компактный режим (по умолчанию)
            if (!isExpanded) {
              // Определяем, что показывать в компактном режиме
              let displayValue;
              if (sortBy === 'overall') {
                displayValue = formatScore(score);
              } else if (Object.keys(CATEGORIES).includes(sortBy)) {
                const rating = poetRatings[sortBy] || 0;
                displayValue = (Math.round(rating * 10) / 10).toFixed(1);
              } else {
                // Для сортировки по дате или имени показываем общий балл
                displayValue = formatScore(score);
              }
              
              return (
                <div 
                  key={poet.id}
                  data-poet-id={poet.id}
                  className="poet-ranking-card compact"
                  onClick={canExpand ? toggleExpand : undefined}
                  style={{ cursor: canExpand ? 'pointer' : 'default' }}
                >
                  {rank && <span className="rank-number compact">#{rank}</span>}
                  {poet.imageUrl && (
                    <div className="poet-avatar compact">
                      <img 
                        src={poet.imageUrl} 
                        alt={poet.name}
                        style={{ 
                          objectPosition: `center ${poet.imagePositionY !== undefined ? poet.imagePositionY : 25}%`
                        }}
                      />
                    </div>
                  )}
                  <div className="poet-name-with-like">
                    <Link 
                      to={`/poet/${poet.id}`} 
                      className="poet-name-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <h3 className="poet-name compact">{compareMode ? shortenName(poet.name) : poet.name}</h3>
                    </Link>
                    {renderLike(poet.id, true)}
                  </div>
                  
                  <div className="poet-ranking-right-section">
                    {renderWinnerBadges(poet.id)}
                    <div className={`score-compact ${sortBy === 'overall' ? 'overall' : 'category'}`}>
                      <span className="score-value-compact">
                        {displayValue}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }

            // Полный режим (развернутый)
            return (
              <div 
                key={poet.id}
                data-poet-id={poet.id}
                className="poet-ranking-card"
              >
                {rank && <span className="rank-number">#{rank}</span>}
                
                {poet.imageUrl && (
                  <div className="poet-avatar">
                    <img 
                      src={poet.imageUrl} 
                      alt={poet.name}
                      style={{ 
                        objectPosition: `center ${poet.imagePositionY !== undefined ? poet.imagePositionY : 25}%`
                      }}
                    />
                  </div>
                )}
                
                <div className="poet-info-section">
                  <div 
                    className="poet-ranking-header"
                    onClick={canExpand ? toggleExpand : undefined}
                    style={{ cursor: canExpand ? 'pointer' : 'default' }}
                  >
                    <div className="poet-name-with-like">
                      <Link 
                        to={`/poet/${poet.id}`} 
                        className="poet-name-link"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <h3 className="poet-name">{compareMode ? shortenName(poet.name) : poet.name}</h3>
                      </Link>
                      {renderLike(poet.id, false)}
                    </div>
                    
                    <div className="poet-ranking-right-section">
                      {renderWinnerBadges(poet.id)}
                      <div className={`total-score ${isOverallHighlighted ? 'highlighted' : ''}`}>
                        <span className="score-value">{formatScore(score)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div 
                    className="ratings-grid"
                    onClick={(e) => e.stopPropagation()}
                  >
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
                            <span className="category-name">{cat.name}</span>
                            {/* <span className="category-coefficient">×{cat.coefficient}</span> */}
                          </div>
                          <StarRating
                            value={rating}
                            onChange={(value) => handleRatingChange(poet.id, key, value)}
                            readOnly={true}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
};

export default PersonalRanking;