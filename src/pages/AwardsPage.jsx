import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePoets, CATEGORIES } from '../context/PoetsContext';
import './OverallRankingPage.css'; // Для стилей наград
import './AwardsPage.css';

const AwardsPage = () => {
  const { 
    poets,
    ratings,
    calculateScore,
    calculateAverageScore,
    categoryLeaders,
    overallDuelWinners,
    aiChoiceTiebreaker
  } = usePoets();
  
  // Получаем текущего пользователя
  const currentUser = localStorage.getItem('currentUser') || 'maxim';
  const otherUser = currentUser === 'maxim' ? 'oleg' : 'maxim';
  
  const [activeTab, setActiveTab] = useState('overall'); // 'overall', 'my', 'other'

  // ============ ОБЩИЕ НАГРАДЫ (логика из OverallRankingPage) ============
  
  // Подсчет баллов "Выбор читателей" для поэта
  const calculateReadersChoiceScore = (poetId) => {
    const poet = poets.find(p => p.id === poetId);
    if (!poet || !poet.poems) return 0;
    
    const poemsArray = Object.values(poet.poems);
    
    let score = 0;
    poemsArray.forEach(poem => {
      if (poem.viewed?.maxim) score += 1;
      if (poem.viewed?.oleg) score += 1;
      if (poem.liked?.maxim) score += 3;
      if (poem.liked?.oleg) score += 3;
      if (poem.memorized?.maxim) score += 10;
      if (poem.memorized?.oleg) score += 10;
    });
    
    return score;
  };

  // Подсчет AI-рейтинга для поэта
  const calculateAIScore = (poetId) => {
    const poet = poets.find(p => p.id === poetId);
    if (!poet || !poet.aiRatings) return 0;
    
    const aiRatings = poet.aiRatings;
    
    const score = 
      (aiRatings.creativity || 0) * CATEGORIES.creativity.coefficient +
      (aiRatings.influence || 0) * CATEGORIES.influence.coefficient +
      (aiRatings.drama || 0) * CATEGORIES.drama.coefficient +
      (aiRatings.beauty || 0) * CATEGORIES.beauty.coefficient;
    
    const totalCoefficient = 
      CATEGORIES.creativity.coefficient +
      CATEGORIES.influence.coefficient +
      CATEGORIES.drama.coefficient +
      CATEGORIES.beauty.coefficient;
    
    return totalCoefficient > 0 ? score / totalCoefficient : 0;
  };

  // Победители категорий для ОБЩЕГО рейтинга
  const overallCategoryWinners = useMemo(() => {
    const winners = {};
    
    ['creativity', 'influence', 'drama', 'beauty'].forEach(category => {
      const rankedPoets = poets
        .map(poet => {
          const maximRating = ratings.maxim?.[poet.id]?.[category] || 0;
          const olegRating = ratings.oleg?.[poet.id]?.[category] || 0;
          let averageRating = 0;
          
          if (maximRating > 0 && olegRating > 0) {
            averageRating = (maximRating + olegRating) / 2;
          } else {
            averageRating = maximRating > 0 ? maximRating : olegRating;
          }
          
          return { id: poet.id, rating: averageRating };
        })
        .filter(item => item.rating > 0)
        .sort((a, b) => b.rating - a.rating);
      
      if (rankedPoets.length === 0) {
        winners[category] = [];
        return;
      }
      
      const topRating = rankedPoets[0].rating;
      const topPoets = rankedPoets.filter(p => Math.abs(p.rating - topRating) < 0.01);
      
      if (topPoets.length === 1) {
        winners[category] = [topPoets[0].id];
      } else {
        // Проверяем дуэль
        const duelData = overallDuelWinners?.[category];
        if (duelData) {
          const winnerId = duelData.winner || duelData;
          const isWinnerInTop = topPoets.some(p => p.id === winnerId);
          if (isWinnerInTop) {
            winners[category] = [winnerId];
            return;
          }
        }
        
        // Проверяем персональных лидеров
        const maximLeader = categoryLeaders.maxim?.[category];
        const olegLeader = categoryLeaders.oleg?.[category];
        
        if (maximLeader && olegLeader && maximLeader === olegLeader) {
          const inTop = topPoets.some(p => p.id === maximLeader);
          if (inTop) {
            winners[category] = [maximLeader];
            return;
          }
        }
        
        winners[category] = [];
      }
    });
    
    // Overall (лучший поэт)
    const overallRankings = poets
      .map(poet => ({ id: poet.id, score: calculateAverageScore(poet.id) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);
    
    if (overallRankings.length > 0) {
      const topScore = overallRankings[0].score;
      const topPoets = overallRankings.filter(r => Math.abs(r.score - topScore) < 0.01);
      
      if (topPoets.length === 1) {
        winners.overall = [topPoets[0].id];
      } else {
        const duelWinner = overallDuelWinners?.overall;
        if (duelWinner && topPoets.some(p => p.id === duelWinner)) {
          winners.overall = [duelWinner];
        } else {
          winners.overall = [];
        }
      }
    } else {
      winners.overall = [];
    }
    
    return winners;
  }, [poets, ratings, calculateAverageScore, overallDuelWinners, categoryLeaders]);

  // Худший поэт для ОБЩЕГО рейтинга
  const overallLoser = useMemo(() => {
    const overallRankings = poets
      .map(poet => ({ id: poet.id, score: calculateAverageScore(poet.id) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);
    
    if (overallRankings.length <= 3) return [];
    
    const lowestScore = overallRankings[overallRankings.length - 1].score;
    const lowestPoets = overallRankings.filter(r => Math.abs(r.score - lowestScore) < 0.01);
    
    if (lowestPoets.length === 1) {
      return [lowestPoets[0].id];
    }
    
    // Проверяем дуэль за худшего
    const duelLoser = overallDuelWinners?.overall_worst;
    if (duelLoser && lowestPoets.some(p => p.id === duelLoser)) {
      return [duelLoser];
    }
    
    return [];
  }, [poets, calculateAverageScore, overallDuelWinners]);

  // Выбор читателей
  const readersChoiceWinner = useMemo(() => {
    const readersRankings = poets
      .map(poet => ({ id: poet.id, score: calculateReadersChoiceScore(poet.id) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);
    
    return readersRankings.length > 0 ? [readersRankings[0].id] : [];
  }, [poets]);

  // Выбор ИИ
  const aiChoiceWinner = useMemo(() => {
    if (aiChoiceTiebreaker && aiChoiceTiebreaker.winner) {
      return [aiChoiceTiebreaker.winner];
    }
    
    const aiRankings = poets
      .map(poet => ({ id: poet.id, score: calculateAIScore(poet.id) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);
    
    return aiRankings.length > 0 ? [aiRankings[0].id] : [];
  }, [poets, aiChoiceTiebreaker]);

  // ============ ПЕРСОНАЛЬНЫЕ НАГРАДЫ (логика из PersonalRanking) ============
  
  const getPersonalWinners = (rater) => {
    const winners = {};
    
    // Категории
    ['creativity', 'influence', 'drama', 'beauty'].forEach(category => {
      const poetsWithRatings = poets
        .map(poet => ({
          id: poet.id,
          rating: ratings[rater]?.[poet.id]?.[category] || 0
        }))
        .filter(p => p.rating > 0)
        .sort((a, b) => b.rating - a.rating);
      
      if (poetsWithRatings.length === 0) {
        winners[category] = [];
        return;
      }
      
      const topRating = poetsWithRatings[0].rating;
      const topPoets = poetsWithRatings.filter(p => Math.abs(p.rating - topRating) < 0.01);
      
      const explicitLeader = categoryLeaders[rater]?.[category];
      
      if (explicitLeader && topPoets.some(p => p.id === explicitLeader)) {
        winners[category] = [explicitLeader];
      } else if (topPoets.length === 1) {
        winners[category] = [topPoets[0].id];
      } else {
        winners[category] = [];
      }
    });
    
    // Overall (лучший)
    const poetsWithScores = poets
      .map(poet => ({ id: poet.id, score: calculateScore(rater, poet.id) }))
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score);
    
    if (poetsWithScores.length > 0) {
      const topScore = poetsWithScores[0].score;
      const topPoets = poetsWithScores.filter(p => Math.abs(p.score - topScore) < 0.01);
      
      const explicitLeader = categoryLeaders[rater]?.['overall'];
      
      if (explicitLeader && topPoets.some(p => p.id === explicitLeader)) {
        winners.overall = [explicitLeader];
      } else if (topPoets.length === 1) {
        winners.overall = [topPoets[0].id];
      } else {
        winners.overall = [];
      }
    } else {
      winners.overall = [];
    }
    
    return winners;
  };

  const getPersonalLoser = (rater) => {
    const poetsWithScores = poets
      .map(poet => ({ id: poet.id, score: calculateScore(rater, poet.id) }))
      .filter(p => p.score > 0)
      .sort((a, b) => a.score - b.score);
    
    if (poetsWithScores.length <= 3) return [];
    
    const lowestScore = poetsWithScores[0].score;
    const lowestPoets = poetsWithScores.filter(p => Math.abs(p.score - lowestScore) < 0.01);
    
    const explicitLoser = categoryLeaders[rater]?.['overall_worst'];
    
    if (explicitLoser && lowestPoets.some(p => p.id === explicitLoser)) {
      return [explicitLoser];
    }
    
    if (lowestPoets.length === 1) {
      return [lowestPoets[0].id];
    }
    
    return [];
  };

  const maximWinners = useMemo(() => getPersonalWinners('maxim'), [poets, ratings, categoryLeaders, calculateScore]);
  const olegWinners = useMemo(() => getPersonalWinners('oleg'), [poets, ratings, categoryLeaders, calculateScore]);
  const maximLoser = useMemo(() => getPersonalLoser('maxim'), [poets, ratings, categoryLeaders, calculateScore]);
  const olegLoser = useMemo(() => getPersonalLoser('oleg'), [poets, ratings, categoryLeaders, calculateScore]);

  // Рендер карточки награды
  const renderAwardCard = (award, winners) => {
    if (winners.length === 0) return null;
    
    return winners.map(poetId => {
      const poet = poets.find(p => p.id === poetId);
      if (!poet) return null;
      
      return (
        <div key={`${award.key}-${poetId}`} className="award-item-wrapper">
          <Link to={`/poet/${poetId}`} className="award-winner-card">
            <div className="award-winner-composition">
              <div className="award-badge-section">
                <img 
                  src={`/images/badges/${award.badge}`} 
                  alt={award.name}
                  className="award-badge-large-img"
                />
              </div>
              <div className="award-poet-section">
                {poet.imageUrl && (
                  <img 
                    src={poet.imageUrl} 
                    alt={poet.name} 
                    className="award-winner-avatar"
                    style={{ 
                      objectPosition: `center ${poet.imagePositionY !== undefined ? poet.imagePositionY : 25}%`
                    }}
                  />
                )}
              </div>
            </div>
            <div className="award-winner-overlay">
              <div className="award-category-title">{award.name}</div>
              <div className="award-winner-name">{poet.name}</div>
            </div>
          </Link>
        </div>
      );
    });
  };

  // Конфигурация наград для общего рейтинга
  const overallAwards = [
    { key: 'overall', name: 'Лучший поэт', badge: 'overall.png' },
    { key: 'creativity', name: CATEGORIES.creativity.name, badge: 'creativity.png' },
    { key: 'influence', name: CATEGORIES.influence.name, badge: 'influence.png' },
    { key: 'drama', name: CATEGORIES.drama.name, badge: 'drama.png' },
    { key: 'beauty', name: CATEGORIES.beauty.name, badge: 'beauty.png' },
    { key: 'readers-choice', name: 'Выбор читателей', badge: 'readers-choice.png' },
    { key: 'ai-choice', name: 'Выбор ИИ', badge: 'ai-choice.png' },
    { key: 'last', name: 'Худший поэт', badge: 'last.png' }
  ];

  // Конфигурация наград для персонального рейтинга
  const personalAwards = [
    { key: 'overall', name: 'Лучший поэт', badge: 'overall.png' },
    { key: 'creativity', name: CATEGORIES.creativity.name, badge: 'creativity.png' },
    { key: 'influence', name: CATEGORIES.influence.name, badge: 'influence.png' },
    { key: 'drama', name: CATEGORIES.drama.name, badge: 'drama.png' },
    { key: 'beauty', name: CATEGORIES.beauty.name, badge: 'beauty.png' },
    { key: 'last', name: 'Худший поэт', badge: 'last.png' }
  ];

  // Получение победителей для текущей вкладки
  const getWinnersForAward = (awardKey) => {
    if (activeTab === 'overall') {
      if (awardKey === 'last') return overallLoser;
      if (awardKey === 'readers-choice') return readersChoiceWinner;
      if (awardKey === 'ai-choice') return aiChoiceWinner;
      return overallCategoryWinners[awardKey] || [];
    } else if (activeTab === 'my') {
      // Награды текущего пользователя
      const winners = currentUser === 'maxim' ? maximWinners : olegWinners;
      const loser = currentUser === 'maxim' ? maximLoser : olegLoser;
      if (awardKey === 'last') return loser;
      return winners[awardKey] || [];
    } else {
      // Награды другого пользователя
      const winners = otherUser === 'maxim' ? maximWinners : olegWinners;
      const loser = otherUser === 'maxim' ? maximLoser : olegLoser;
      if (awardKey === 'last') return loser;
      return winners[awardKey] || [];
    }
  };

  const currentAwards = activeTab === 'overall' ? overallAwards : personalAwards;
  
  // Имя другого пользователя для вкладки (родительный падеж)
  const otherUserNameGenitive = otherUser === 'maxim' ? 'Максима' : 'Олега';

  return (
    <div className="awards-page">

      {/* Вкладки */}
      <div className="tabs">
        <button 
          className={`tab-btn ${activeTab === 'overall' ? 'active' : ''}`}
          onClick={() => setActiveTab('overall')}
        >
          Общие
        </button>
        <button 
          className={`tab-btn ${activeTab === 'my' ? 'active' : ''}`}
          onClick={() => setActiveTab('my')}
        >
          Мои
        </button>
        <button 
          className={`tab-btn ${activeTab === 'other' ? 'active' : ''}`}
          onClick={() => setActiveTab('other')}
        >
          {otherUserNameGenitive}
        </button>
      </div>

      {/* Список наград */}
      <div className="awards-list-new">
        <div className="award-winners">
          {currentAwards.map(award => 
            renderAwardCard(award, getWinnersForAward(award.key))
          ).flat().filter(Boolean)}
          
          {currentAwards.every(award => getWinnersForAward(award.key).length === 0) && (
            <div className="no-awards-message">
              Пока нет наград для отображения
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AwardsPage;
