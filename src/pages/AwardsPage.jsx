import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePoets, CATEGORIES } from '../context/PoetsContext';
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
  
  const navigate = useNavigate();

  // Получаем победителя по ID
  const getPoetById = (poetId) => {
    return poets.find(p => p.id === poetId);
  };

  // Получаем победителей по категориям для ОБЩЕГО рейтинга
  // Используем точно такую же логику как в OverallRankingPage
  const getCategoryWinnersOverall = (category) => {
    // Находим всех поэтов с оценками в данной категории
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
        
        return {
          poet,
          rating: averageRating
        };
      })
      .filter(item => item.rating > 0)
      .sort((a, b) => b.rating - a.rating);
    
    if (rankedPoets.length === 0) return null;
    
    const topRating = rankedPoets[0].rating;
    const topPoets = rankedPoets.filter(p => Math.abs(p.rating - topRating) < 0.01);
    
    // Если только один поэт с максимальным баллом - он победитель
    if (topPoets.length === 1) {
      return topPoets[0].poet;
    }
    
    // Если несколько поэтов с одинаковым топовым баллом
    // Сначала проверяем, есть ли победитель дуэли для этой категории
    const duelData = overallDuelWinners?.[category];
    if (duelData) {
      const winnerId = duelData.winner || duelData;
      const isWinnerInTop = topPoets.some(p => p.poet.id === winnerId);
      if (isWinnerInTop) {
        return getPoetById(winnerId);
      }
    }
    
    // Если дуэли не было, смотрим на персональных победителей
    const maximLeader = categoryLeaders.maxim?.[category];
    const olegLeader = categoryLeaders.oleg?.[category];
    
    // Проверяем, кто из лидеров находится в топе по баллам
    const maximLeaderInTop = maximLeader && topPoets.some(p => p.poet.id === maximLeader);
    const olegLeaderInTop = olegLeader && topPoets.some(p => p.poet.id === olegLeader);
    
    // Если Максим и Олег оба выбрали одного и того же поэта, и он среди топовых - он победитель
    if (maximLeader && olegLeader && maximLeader === olegLeader && maximLeaderInTop) {
      return getPoetById(maximLeader);
    }
    
    // Если только Максим выбрал лидера и он в топе - он победитель
    if (maximLeaderInTop && !olegLeaderInTop) {
      return getPoetById(maximLeader);
    }
    
    // Если только Олег выбрал лидера и он в топе - он победитель
    if (olegLeaderInTop && !maximLeaderInTop) {
      return getPoetById(olegLeader);
    }
    
    // Если оба выбрали разных поэтов из топа или никто не выбрал - нет победителя
    return null;
  };

  // Вычисляем лучшего поэта ОБЩЕГО рейтинга
  // Используем точно такую же логику как в OverallRankingPage
  const getBestOverallPoet = useMemo(() => {
    const overallRankings = poets
      .map(poet => ({
        poet,
        score: calculateAverageScore(poet.id)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);
    
    if (overallRankings.length === 0) return null;
    
    const topScore = overallRankings[0].score;
    const topPoets = overallRankings.filter(r => Math.abs(r.score - topScore) < 0.01);
    
    // Если только один с макс баллом - он победитель
    if (topPoets.length === 1) {
      return topPoets[0].poet;
    }
    
    // Если несколько поэтов с одинаковым топовым баллом
    // Сначала проверяем, есть ли победитель дуэли для overall
    const duelWinner = overallDuelWinners?.overall;
    if (duelWinner) {
      const isWinnerInTop = topPoets.some(p => p.poet.id === duelWinner);
      if (isWinnerInTop) {
        return getPoetById(duelWinner);
      }
    }
    
    // Если дуэли не было - считаем количество категорийных наград
    const categories = ['creativity', 'influence', 'drama', 'beauty'];
    const categoryWinners = {};
    
    categories.forEach(cat => {
      const winner = getCategoryWinnersOverall(cat);
      if (winner) {
        categoryWinners[cat] = winner.id;
      }
    });
    
    const poetsWithBadgeCount = topPoets.map(item => {
      const badgeCount = categories.filter(
        cat => categoryWinners[cat] === item.poet.id
      ).length;
      return { poet: item.poet, badgeCount };
    });
    
    // Сортируем по количеству наград
    poetsWithBadgeCount.sort((a, b) => b.badgeCount - a.badgeCount);
    const maxBadges = poetsWithBadgeCount[0].badgeCount;
    const poetsWithMaxBadges = poetsWithBadgeCount.filter(p => p.badgeCount === maxBadges);
    
    // Если только один поэт с максимальным количеством наград - он победитель
    return poetsWithMaxBadges.length === 1 ? poetsWithMaxBadges[0].poet : null;
  }, [poets, calculateAverageScore, overallDuelWinners, categoryLeaders, ratings]);

  // Вычисляем худшего поэта ОБЩЕГО рейтинга
  // Используем точно такую же логику как в OverallRankingPage
  const getWorstOverallPoet = useMemo(() => {
    const overallRankings = poets
      .map(poet => ({
        poet,
        score: calculateAverageScore(poet.id)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score); // От большего к меньшему
    
    // Награда выдается только если в рейтинге больше 3 поэтов
    if (overallRankings.length <= 3) return null;
    
    const lowestScore = overallRankings[overallRankings.length - 1].score;
    const lowestPoets = overallRankings.filter(r => Math.abs(r.score - lowestScore) < 0.01);
    
    // Если только один поэт с минимальным баллом - он худший
    if (lowestPoets.length === 1) {
      return lowestPoets[0].poet;
    }
    
    // Если несколько поэтов с одинаковым минимальным баллом - нет худшего
    return null;
  }, [poets, calculateAverageScore]);

  // Получаем лидера категории для ПЕРСОНАЛЬНОГО рейтинга (Максим/Олег)
  // Используем точно такую же логику как в PersonalRanking
  const getPersonalCategoryLeader = (rater, category) => {
    const poetsWithRatings = poets
      .map(poet => ({
        id: poet.id,
        rating: ratings[rater]?.[poet.id]?.[category] || 0
      }))
      .filter(p => p.rating > 0)
      .sort((a, b) => b.rating - a.rating);
    
    if (poetsWithRatings.length === 0) return null;
    
    const topRating = poetsWithRatings[0].rating;
    const topPoets = poetsWithRatings.filter(p => Math.abs(p.rating - topRating) < 0.01);
    
    // Проверяем, есть ли явный лидер
    const explicitLeader = categoryLeaders[rater]?.[category];
    
    // Если есть явный лидер И он все еще в топе - он победитель
    if (explicitLeader && topPoets.some(p => p.id === explicitLeader)) {
      return getPoetById(explicitLeader);
    }
    
    // Если только один поэт с максимальным рейтингом - он победитель
    if (topPoets.length === 1) {
      return getPoetById(topPoets[0].id);
    }
    
    // Если несколько поэтов с максимальным рейтингом и нет явного лидера - нет победителя
    return null;
  };

  // Получаем лидера по общему баллу для ПЕРСОНАЛЬНОГО рейтинга (Максим/Олег)
  // Используем точно такую же логику как в PersonalRanking
  const getPersonalOverallLeader = (rater) => {
    const poetsWithScores = poets
      .map(poet => ({
        id: poet.id,
        score: calculateScore(rater, poet.id)
      }))
      .filter(p => p.score > 0);
    
    if (poetsWithScores.length === 0) return null;
    
    poetsWithScores.sort((a, b) => b.score - a.score);
    const topScore = poetsWithScores[0].score;
    const topPoets = poetsWithScores.filter(p => Math.abs(p.score - topScore) < 0.01);
    
    // Проверяем, есть ли явно выбранный лидер
    const overallExplicitLeader = categoryLeaders[rater]?.['overall'];
    
    // Если есть явный лидер И он все еще в топе - он победитель
    if (overallExplicitLeader && topPoets.some(p => p.id === overallExplicitLeader)) {
      return getPoetById(overallExplicitLeader);
    }
    
    // Если только один поэт с максимальным баллом - он победитель
    if (topPoets.length === 1) {
      return getPoetById(topPoets[0].id);
    }
    
    // Если несколько поэтов с максимальным баллом и нет явного лидера - нет победителя
    return null;
  };

  // Получаем худшего поэта для ПЕРСОНАЛЬНОГО рейтинга (Максим/Олег)
  // Используем точно такую же логику как в PersonalRanking
  const getPersonalWorstPoet = (rater) => {
    const poetsWithScores = poets
      .map(poet => ({
        id: poet.id,
        score: calculateScore(rater, poet.id)
      }))
      .filter(p => p.score > 0);
    
    // Награда выдается только если в рейтинге больше 3 поэтов
    if (poetsWithScores.length <= 3) return null;
    
    poetsWithScores.sort((a, b) => a.score - b.score); // По возрастанию
    const lowestScore = poetsWithScores[0].score;
    const lowestPoets = poetsWithScores.filter(p => Math.abs(p.score - lowestScore) < 0.01);
    
    // Проверяем есть ли явно выбранный худший через дуэль
    const explicitLoser = categoryLeaders[rater]?.['overall_worst'];
    
    if (explicitLoser) {
      // Если есть явно выбранный худший и он все еще среди худших - он и есть худший
      const loserStillAtBottom = lowestPoets.some(p => p.id === explicitLoser);
      if (loserStillAtBottom) {
        return getPoetById(explicitLoser);
      }
    }
    
    // Если только один поэт с минимальным баллом - он худший
    if (lowestPoets.length === 1) {
      return getPoetById(lowestPoets[0].id);
    }
    
    // Если несколько поэтов с одинаковым минимальным баллом - нет худшего
    return null;
  };

  // Подсчет баллов "Выбор читателей" для поэта
  const calculateReadersChoiceScore = (poetId) => {
    const poet = poets.find(p => p.id === poetId);
    if (!poet || !poet.poems) return 0;
    
    const poemsArray = Object.values(poet.poems);
    
    let score = 0;
    poemsArray.forEach(poem => {
      // Просмотры: 1 балл за каждого пользователя
      if (poem.viewed?.maxim) score += 1;
      if (poem.viewed?.oleg) score += 1;
      
      // Лайки: 3 балла за каждого пользователя
      if (poem.liked?.maxim) score += 3;
      if (poem.liked?.oleg) score += 3;
      
      // Выучено: 10 баллов за каждого пользователя
      if (poem.memorized?.maxim) score += 10;
      if (poem.memorized?.oleg) score += 10;
    });
    
    return score;
  };

  // Получаем победителя "Выбор читателей"
  const getReadersChoiceWinner = useMemo(() => {
    const readersRankings = poets
      .map(poet => ({
        poet,
        score: calculateReadersChoiceScore(poet.id)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);
    
    if (readersRankings.length === 0) return null;
    
    // Победитель - поэт с максимальным баллом
    return readersRankings[0].poet;
  }, [poets]);
  
  // Подсчет AI-рейтинга для поэта (используем те же коэффициенты из CATEGORIES)
  const calculateAIScore = (poetId) => {
    const poet = poets.find(p => p.id === poetId);
    if (!poet || !poet.aiRatings) return 0;
    
    const aiRatings = poet.aiRatings;
    
    // Используем те же коэффициенты что и для обычных оценок (импортируются из контекста)
    const score = 
      (aiRatings.creativity || 0) * CATEGORIES.creativity.coefficient +
      (aiRatings.influence || 0) * CATEGORIES.influence.coefficient +
      (aiRatings.drama || 0) * CATEGORIES.drama.coefficient +
      (aiRatings.beauty || 0) * CATEGORIES.beauty.coefficient;
    
    // Считаем сумму коэффициентов
    const totalCoefficient = 
      CATEGORIES.creativity.coefficient +
      CATEGORIES.influence.coefficient +
      CATEGORIES.drama.coefficient +
      CATEGORIES.beauty.coefficient;
    
    // Возвращаем средневзвешенное (в 5-балльной системе)
    return totalCoefficient > 0 ? score / totalCoefficient : 0;
  };
  
  // Получаем победителя "Выбор ИИ"
  const getAIChoiceWinner = useMemo(() => {
    // Если есть результат тайбрейкера - используем его
    if (aiChoiceTiebreaker && aiChoiceTiebreaker.winner) {
      return getPoetById(aiChoiceTiebreaker.winner);
    }
    
    // Иначе определяем по максимальному AI-баллу
    const aiRankings = poets
      .map(poet => ({
        poet,
        score: calculateAIScore(poet.id)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);
    
    if (aiRankings.length === 0) return null;
    
    // Победитель - поэт с максимальным AI-баллом
    return aiRankings[0].poet;
  }, [poets, aiChoiceTiebreaker]);

  // Данные для таблицы наград (в нужном порядке)
  const awardsData = useMemo(() => [
    {
      id: 'best',
      title: 'Лучший поэт',
      icon: '/images/badges/overall.png',
      overall: getBestOverallPoet,
      maxim: getPersonalOverallLeader('maxim'),
      oleg: getPersonalOverallLeader('oleg')
    },
    {
      id: 'creativity',
      title: 'Творчество',
      icon: '/images/badges/creativity.png',
      overall: getCategoryWinnersOverall('creativity'),
      maxim: getPersonalCategoryLeader('maxim', 'creativity'),
      oleg: getPersonalCategoryLeader('oleg', 'creativity')
    },
    {
      id: 'influence',
      title: 'Мораль',
      icon: '/images/badges/influence.png',
      overall: getCategoryWinnersOverall('influence'),
      maxim: getPersonalCategoryLeader('maxim', 'influence'),
      oleg: getPersonalCategoryLeader('oleg', 'influence')
    },
    {
      id: 'drama',
      title: 'Драма',
      icon: '/images/badges/drama.png',
      overall: getCategoryWinnersOverall('drama'),
      maxim: getPersonalCategoryLeader('maxim', 'drama'),
      oleg: getPersonalCategoryLeader('oleg', 'drama')
    },
    {
      id: 'beauty',
      title: 'Красота',
      icon: '/images/badges/beauty.png',
      overall: getCategoryWinnersOverall('beauty'),
      maxim: getPersonalCategoryLeader('maxim', 'beauty'),
      oleg: getPersonalCategoryLeader('oleg', 'beauty')
    },
    {
      id: 'readers-choice',
      title: 'Выбор читателей',
      icon: '/images/badges/readers-choice.png',
      overall: getReadersChoiceWinner,
      maxim: null, // Эта награда только для общего рейтинга
      oleg: null   // Эта награда только для общего рейтинга
    },
    {
      id: 'ai-choice',
      title: 'Выбор ИИ',
      icon: '/images/badges/ai-choice.png',
      overall: getAIChoiceWinner,
      maxim: null, // Эта награда только для общего рейтинга
      oleg: null   // Эта награда только для общего рейтинга
    },
    {
      id: 'worst',
      title: 'Худший поэт',
      icon: '/images/badges/last.png',
      overall: getWorstOverallPoet,
      maxim: getPersonalWorstPoet('maxim'),
      oleg: getPersonalWorstPoet('oleg')
    }
  ], [getBestOverallPoet, getWorstOverallPoet, getReadersChoiceWinner, getAIChoiceWinner, poets, ratings, categoryLeaders]);

  // Рендер карточки победителя
  const renderWinner = (poet) => {
    if (!poet) {
      return <div className="award-winner-empty">—</div>;
    }

    return (
      <div 
        className="award-winner-cell"
        onClick={() => navigate(`/poet/${poet.id}`)}
      >
        {poet.imageUrl && (
          <img 
            src={poet.imageUrl} 
            alt={poet.name}
            className="award-winner-photo"
          />
        )}
        <span className="award-winner-name">{poet.name}</span>
      </div>
    );
  };

  return (
    <div className="awards-page fade-in">
      <div className="awards-header">
        <h1 className="awards-title">Трофейная комната</h1>
        <p className="awards-subtitle">Лучшие из лучших</p>
      </div>

      {/* Таблица наград */}
      <section className="awards-table-section">
        <div className="awards-table">
          {/* Заголовки колонок */}
          <div className="awards-table-header">
            <div className="awards-table-cell header-award">Награда</div>
            <div className="awards-table-cell header-rater">Общий</div>
            <div className="awards-table-cell header-rater">Максим</div>
            <div className="awards-table-cell header-rater">Олег</div>
          </div>

          {/* Строки с наградами */}
          {awardsData.map((award) => (
            <div key={award.id} className={`awards-table-row ${award.id}`}>
              {/* Колонка с названием награды */}
              <div className="awards-table-cell award-title-cell">
                <img src={award.icon} alt={award.title} className="award-icon" />
                <span className="award-title-text">{award.title}</span>
              </div>

              {/* Колонка Общий */}
              <div className="awards-table-cell winner-cell" data-rater="Общий">
                {renderWinner(award.overall)}
              </div>

              {/* Колонка Максим */}
              <div className="awards-table-cell winner-cell" data-rater="Максим">
                {renderWinner(award.maxim)}
              </div>

              {/* Колонка Олег */}
              <div className="awards-table-cell winner-cell" data-rater="Олег">
                {renderWinner(award.oleg)}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AwardsPage;

