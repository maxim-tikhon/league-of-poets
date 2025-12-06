import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ref, set, update, remove, onValue, push, get } from 'firebase/database';
import { database } from '../firebase/config';

const PoetsContext = createContext();

export const usePoets = () => {
  const context = useContext(PoetsContext);
  if (!context) {
    throw new Error('usePoets must be used within PoetsProvider');
  }
  return context;
};

// Категории и их коэффициенты (5-балльная система)
// Коэффициенты рассчитаны так, чтобы максимум был 5.0
// 9:5:4:2 → 0.45:0.25:0.2:0.1 (сумма = 1.0, умноженная на 5)
export const CATEGORIES = {
  creativity: { name: 'Творчество', coefficient: 0.5, description: 'Образность, язык, ритм, глубина мыслей, стиль, эмоциональность и т.д.' },
  influence: { name: 'Мораль', coefficient: 0.2, description: 'Нравственность, моральные качества, поступки, влияние на общество и культуру' },
  drama: { name: 'Драма', coefficient: 0.2, description: 'Степень трагичности жизни, страдания, утраты, судьба и т.д.' },
  beauty: { name: 'Красота', coefficient: 0.1, description: 'Внешность, харизма, обаяние' }   
};

export const PoetsProvider = ({ children }) => {
  const [poets, setPoets] = useState([]);
  const [ratings, setRatings] = useState({
    maxim: {},
    oleg: {}
  });
  const [categoryLeaders, setCategoryLeaders] = useState({
    maxim: {},
    oleg: {}
  });
  const [overallDuelWinners, setOverallDuelWinners] = useState({});
  const [aiChoiceTiebreaker, setAIChoiceTiebreaker] = useState(null);
  const [likes, setLikes] = useState({
    maxim: {},
    oleg: {}
  });
  const [isLoading, setIsLoading] = useState(true);

  // Подписка на изменения поэтов в Firebase
  useEffect(() => {
    const poetsRef = ref(database, 'poets');
    
    const unsubscribe = onValue(poetsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Преобразуем объект Firebase в массив
        const poetsArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setPoets(poetsArray);
      } else {
        setPoets([]);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Подписка на изменения рейтингов в Firebase
  useEffect(() => {
    const ratingsRef = ref(database, 'ratings');
    
    const unsubscribe = onValue(ratingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRatings(data);
      } else {
        setRatings({
          maxim: {},
          oleg: {}
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // Подписка на изменения лидеров категорий в Firebase
  useEffect(() => {
    const leadersRef = ref(database, 'categoryLeaders');
    
    const unsubscribe = onValue(leadersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setCategoryLeaders(data);
      } else {
        setCategoryLeaders({
          maxim: {},
          oleg: {}
        });
      }
    });
    
    return () => unsubscribe();
  }, []);

  // Подписка на победителей дуэлей для общего рейтинга
  useEffect(() => {
    const duelWinnersRef = ref(database, 'overallDuelWinners');
    
    const unsubscribe = onValue(duelWinnersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setOverallDuelWinners(data);
      } else {
        setOverallDuelWinners({});
      }
    });
    
    return () => unsubscribe();
  }, []);
  
  // Подписка на результат AI-тайбрейкера для "Выбор ИИ"
  useEffect(() => {
    const aiTiebreakerRef = ref(database, 'aiChoiceTiebreaker');
    
    const unsubscribe = onValue(aiTiebreakerRef, (snapshot) => {
      const data = snapshot.val();
      setAIChoiceTiebreaker(data || null);
    });
    
    return () => unsubscribe();
  }, []);

  // Подписка на изменения лайков в Firebase
  useEffect(() => {
    const likesRef = ref(database, 'likes');
    
    const unsubscribe = onValue(likesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setLikes(data);
      } else {
        setLikes({
          maxim: {},
          oleg: {}
        });
      }
    });
    
    return () => unsubscribe();
  }, []);

  // Добавить поэта
  const addPoet = async (name, imageUrl = '', bio = '', lifeStory = '', influence = '', creativity = '', drama = '', beauty = '') => {
    const id = Date.now().toString();
    const newPoet = {
      name: name.trim(),
      imageUrl: imageUrl.trim(),
      bio: bio.trim(),
      lifeStory: lifeStory.trim(),
      influence: influence.trim(),
      creativity: creativity.trim(),
      drama: drama.trim(),
      beauty: beauty.trim(),
      addedAt: new Date().toISOString()
    };
    
    // Добавляем поэта в Firebase
    await set(ref(database, `poets/${id}`), newPoet);
    
    // Инициализация рейтингов нулями
    await set(ref(database, `ratings/maxim/${id}`), {
      creativity: 0,
      influence: 0,
      drama: 0,
      beauty: 0
    });
    
    await set(ref(database, `ratings/oleg/${id}`), {
      creativity: 0,
      influence: 0,
      drama: 0,
      beauty: 0
    });
    
    return { id, ...newPoet };
  };

  // Очистка невалидных данных (ссылок на несуществующих поэтов)
  const cleanupInvalidData = async () => {
    const validPoetIds = poets.map(p => p.id);
    const updates = {};
    let cleanedCount = 0;
    
    // Проверяем categoryLeaders для обоих пользователей
    ['maxim', 'oleg'].forEach(user => {
      const userLeaders = categoryLeaders[user] || {};
      Object.keys(userLeaders).forEach(category => {
        const leaderId = userLeaders[category];
        if (leaderId && !validPoetIds.includes(leaderId)) {
          updates[`categoryLeaders/${user}/${category}`] = null;
          cleanedCount++;
          console.log(`[Cleanup] Removing invalid ${category} leader for ${user}: ${leaderId}`);
        }
      });
    });
    
    // Проверяем overallDuelWinners
    Object.keys(overallDuelWinners || {}).forEach(category => {
      const duelData = overallDuelWinners[category];
      if (duelData) {
        const winnerId = duelData.winner || duelData;
        const participants = duelData.participants || [];
        const hasInvalidWinner = winnerId && !validPoetIds.includes(winnerId);
        const hasInvalidParticipant = participants.some(p => !validPoetIds.includes(p));
        
        if (hasInvalidWinner || hasInvalidParticipant) {
          updates[`overallDuelWinners/${category}`] = null;
          cleanedCount++;
          console.log(`[Cleanup] Removing invalid duel winner for ${category}`);
        }
      }
    });
    
    // Проверяем aiChoiceTiebreaker
    if (aiChoiceTiebreaker) {
      const winnerId = aiChoiceTiebreaker.winner;
      const participants = aiChoiceTiebreaker.participants || [];
      const hasInvalidWinner = winnerId && !validPoetIds.includes(winnerId);
      const hasInvalidParticipant = participants.some(p => !validPoetIds.includes(p));
      
      if (hasInvalidWinner || hasInvalidParticipant) {
        updates['aiChoiceTiebreaker'] = null;
        cleanedCount++;
        console.log(`[Cleanup] Removing invalid AI choice tiebreaker`);
      }
    }
    
    // Проверяем ratings
    const ratingsSnapshot = await get(ref(database, 'ratings'));
    const ratingsData = ratingsSnapshot.val() || {};
    ['maxim', 'oleg'].forEach(user => {
      const userRatings = ratingsData[user] || {};
      Object.keys(userRatings).forEach(poetId => {
        if (!validPoetIds.includes(poetId)) {
          updates[`ratings/${user}/${poetId}`] = null;
          cleanedCount++;
          console.log(`[Cleanup] Removing invalid rating for ${user}/${poetId}`);
        }
      });
    });
    
    // Проверяем likes
    const likesSnapshot = await get(ref(database, 'likes'));
    const likesData = likesSnapshot.val() || {};
    ['maxim', 'oleg'].forEach(user => {
      const userLikes = likesData[user] || {};
      Object.keys(userLikes).forEach(poetId => {
        if (!validPoetIds.includes(poetId)) {
          updates[`likes/${user}/${poetId}`] = null;
          cleanedCount++;
          console.log(`[Cleanup] Removing invalid like for ${user}/${poetId}`);
        }
      });
    });
    
    if (Object.keys(updates).length > 0) {
      await update(ref(database), updates);
      console.log(`[Cleanup] Cleaned ${cleanedCount} invalid references`);
    } else {
      console.log(`[Cleanup] No invalid data found`);
    }
    
    return cleanedCount;
  };

  // Удалить поэта
  const deletePoet = async (poetId) => {
    // Удаляем поэта
    await remove(ref(database, `poets/${poetId}`));
    
    // Удаляем его рейтинги
    await remove(ref(database, `ratings/maxim/${poetId}`));
    await remove(ref(database, `ratings/oleg/${poetId}`));
    
    // Удаляем его лайки
    await remove(ref(database, `likes/maxim/${poetId}`));
    await remove(ref(database, `likes/oleg/${poetId}`));
    
    // Удаляем его из лидеров категорий, если он там есть (включая overall_worst)
    const updates = {};
    const allCategories = [...Object.keys(CATEGORIES), 'overall', 'overall_worst'];
    allCategories.forEach(category => {
      if (categoryLeaders.maxim?.[category] === poetId) {
        updates[`categoryLeaders/maxim/${category}`] = null;
      }
      if (categoryLeaders.oleg?.[category] === poetId) {
        updates[`categoryLeaders/oleg/${category}`] = null;
      }
      // Удаляем из победителей дуэлей
      const duelData = overallDuelWinners[category];
      if (duelData) {
        const winnerId = duelData.winner || duelData; // Для обратной совместимости
        const participants = duelData.participants || [];
        // Удаляем дуэль если poetId был победителем или участником
        if (winnerId === poetId || participants.includes(poetId)) {
          updates[`overallDuelWinners/${category}`] = null;
        }
      }
    });
    
    // Проверяем overall категорию для дуэлей
    const overallDuelData = overallDuelWinners.overall;
    if (overallDuelData) {
      const winnerId = overallDuelData.winner || overallDuelData;
      const participants = overallDuelData.participants || [];
      if (winnerId === poetId || participants.includes(poetId)) {
        updates['overallDuelWinners/overall'] = null;
      }
    }
    
    // Проверяем AI-тайбрейкер для "Выбор ИИ"
    if (aiChoiceTiebreaker) {
      const winnerId = aiChoiceTiebreaker.winner;
      const participants = aiChoiceTiebreaker.participants || [];
      // Удаляем тайбрейкер если poetId был победителем или участником
      if (winnerId === poetId || participants.includes(poetId)) {
        updates['aiChoiceTiebreaker'] = null;
      }
    }
    
    if (Object.keys(updates).length > 0) {
      await update(ref(database), updates);
    }
  };

  // Обновить поэта
  const updatePoet = async (poetId, updatedData) => {
    await update(ref(database, `poets/${poetId}`), updatedData);
  };

  // Обновить рейтинг
  const updateRating = async (rater, poetId, category, value) => {
    // Проверяем, была ли у поэта хотя бы одна оценка до этого
    const poet = poets.find(p => p.id === poetId);
    if (poet) {
      const maximScore = calculateScore('maxim', poetId);
      const olegScore = calculateScore('oleg', poetId);
      const hadRatings = maximScore > 0 || olegScore > 0;
      
      // Если это первая оценка (до этого рейтинг был 0), сохраняем время первой оценки
      if (!hadRatings && !poet.firstRatedAt) {
        await update(ref(database, `poets/${poetId}`), {
          firstRatedAt: new Date().toISOString()
        });
      }
    }
    
    await set(ref(database, `ratings/${rater}/${poetId}/${category}`), value);
  };

  // Установить явного лидера категории
  const setCategoryLeader = async (rater, category, poetId) => {
    await set(ref(database, `categoryLeaders/${rater}/${category}`), poetId);
  };

  // Установить победителя дуэли для общего рейтинга
  const setOverallDuelWinner = async (category, winnerId, poet1Id, poet2Id) => {
    // Сохраняем и победителя, и обоих участников дуэли
    // Это позволит проверить, была ли дуэль между этими же поэтами
    await set(ref(database, `overallDuelWinners/${category}`), {
      winner: winnerId,
      participants: [poet1Id, poet2Id].sort() // Сортируем для консистентности
    });
  };
  
  // Сохранить результат AI-тайбрейкера для "Выбор ИИ"
  const setAIChoiceWinner = async (winnerId, participants, topScore) => {
    await set(ref(database, 'aiChoiceTiebreaker'), {
      winner: winnerId,
      participants: participants.sort(), // ID всех поэтов с одинаковым топовым баллом
      topScore: topScore, // Балл победителей для отслеживания изменений
      timestamp: Date.now()
    });
  };

  // Вычислить общий балл для поэта от одного оценщика
  const calculateScore = useCallback((rater, poetId) => {
    const poetRatings = ratings[rater]?.[poetId];
    if (!poetRatings) return 0;

    const score = Object.keys(CATEGORIES).reduce((total, category) => {
      const rating = poetRatings[category] || 0;
      const coefficient = CATEGORIES[category].coefficient;
      return total + (rating * coefficient);
    }, 0);
    
    // Логируем расчет для отладки
    const poet = poets.find(p => p.id === poetId);
    if (poet) {
      console.log(`💰 calculateScore for ${poet.name} (${rater}):`, {
        creativity: `${poetRatings.creativity || 0} × 0.5 = ${(poetRatings.creativity || 0) * 0.5}`,
        influence: `${poetRatings.influence || 0} × 0.2 = ${(poetRatings.influence || 0) * 0.2}`,
        drama: `${poetRatings.drama || 0} × 0.2 = ${(poetRatings.drama || 0) * 0.2}`,
        beauty: `${poetRatings.beauty || 0} × 0.1 = ${(poetRatings.beauty || 0) * 0.1}`,
        total: score
      });
    }
    
    return score;
  }, [ratings, poets]);

  // Вычислить средний балл (общий рейтинг)
  const calculateAverageScore = useCallback((poetId) => {
    const maximScore = calculateScore('maxim', poetId);
    const olegScore = calculateScore('oleg', poetId);
    
    // Если оба пользователя оценили - среднее
    if (maximScore > 0 && olegScore > 0) {
      return (maximScore + olegScore) / 2;
    }
    
    // Если только один пользователь оценил - его балл
    return maximScore > 0 ? maximScore : olegScore;
  }, [calculateScore]);

  // Получить рейтинги для категории
  const getCategoryRankings = useCallback((category) => {
    return poets
      .map(poet => {
        const maximRating = ratings.maxim[poet.id]?.[category] || 0;
        const olegRating = ratings.oleg[poet.id]?.[category] || 0;
        
        // Если оба пользователя оценили - среднее
        let averageRating;
        if (maximRating > 0 && olegRating > 0) {
          averageRating = (maximRating + olegRating) / 2;
        } else {
          // Если только один пользователь оценил - его оценка
          averageRating = maximRating > 0 ? maximRating : olegRating;
        }
        
        return {
          poet,
          maximRating,
          olegRating,
          averageRating
        };
      })
      .filter(item => item.averageRating > 0) // Показываем только поэтов с оценками
      .sort((a, b) => b.averageRating - a.averageRating);
  }, [poets, ratings]);

  // Получить общие рейтинги
  const getOverallRankings = useCallback(() => {
    return poets
      .map(poet => ({
        poet,
        maximScore: calculateScore('maxim', poet.id),
        olegScore: calculateScore('oleg', poet.id),
        averageScore: calculateAverageScore(poet.id)
      }))
      .filter(item => item.averageScore > 0) // Показываем только поэтов с оценками
      .sort((a, b) => b.averageScore - a.averageScore);
  }, [poets, calculateScore, calculateAverageScore]);

  // Переключить лайк поэта
  const toggleLike = async (user, poetId) => {
    const currentLikeStatus = likes[user]?.[poetId] || false;
    await set(ref(database, `likes/${user}/${poetId}`), !currentLikeStatus);
  };

  // === Функции для работы со стихотворениями ===
  
  // Добавить стихотворение поэту
  const addPoem = async (poetId, title, url = '') => {
    const poemId = `poem_${Date.now()}`;
    const newPoem = {
      title: title.trim(),
      url: url.trim(),
      viewed: { maxim: false, oleg: false },
      liked: { maxim: false, oleg: false },
      memorized: { maxim: false, oleg: false },
      addedAt: new Date().toISOString()
    };
    
    await set(ref(database, `poets/${poetId}/poems/${poemId}`), newPoem);
    return poemId;
  };
  
  // Обновить статус стихотворения для пользователя
  const updatePoemStatus = async (poetId, poemId, user, field, value) => {
    // field может быть: 'viewed', 'liked', 'memorized'
    await set(ref(database, `poets/${poetId}/poems/${poemId}/${field}/${user}`), value);
  };
  
  // Удалить стихотворение
  const deletePoem = async (poetId, poemId) => {
    await remove(ref(database, `poets/${poetId}/poems/${poemId}`));
  };

  const value = {
    poets,
    ratings,
    categoryLeaders,
    overallDuelWinners,
    aiChoiceTiebreaker,
    likes,
    isLoading,
    addPoet,
    deletePoet,
    updatePoet,
    updateRating,
    setCategoryLeader,
    setOverallDuelWinner,
    setAIChoiceWinner,
    toggleLike,
    addPoem,
    updatePoemStatus,
    deletePoem,
    calculateScore,
    calculateAverageScore,
    CATEGORIES,
    getCategoryRankings,
    getOverallRankings,
    cleanupInvalidData
  };

  return (
    <PoetsContext.Provider value={value}>
      {children}
    </PoetsContext.Provider>
  );
};
