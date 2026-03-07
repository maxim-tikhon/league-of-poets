import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ref, set, update, remove, onValue, push, get, runTransaction } from 'firebase/database';
import { database } from '../firebase/config';
import { generateContent } from '../ai/gemini';

const PoetsContext = createContext();

export const usePoets = () => {
  const context = useContext(PoetsContext);
  if (!context) {
    throw new Error('usePoets must be used within PoetsProvider');
  }
  return context;
};

// Категории и их дефолтные коэффициенты (5-балльная система)
// Коэффициенты рассчитаны так, чтобы максимум был 5.0
// 50:20:20:10 → 0.5:0.2:0.2:0.1 (сумма = 1.0, умноженная на 5)
export const DEFAULT_CATEGORIES = {
  creativity: { name: 'Творчество', coefficient: 0.6, description: 'Образность, язык, ритм, глубина мыслей, стиль, эмоциональность и т.д.' },
  drama: { name: 'Драма', coefficient: 0.2, description: 'Степень трагичности жизни, страдания, утраты, судьба и т.д.' },
  influence: { name: 'Мораль', coefficient: 0.1, description: 'Нравственность, моральные качества, поступки, влияние на общество и культуру' },
  beauty: { name: 'Красота', coefficient: 0.1, description: 'Внешность, харизма, обаяние' }   
};

// Deprecated: используйте categoryCoefficients из usePoets() вместо этого
export const CATEGORIES = DEFAULT_CATEGORIES;

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
  const [tournaments, setTournaments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Коэффициенты категорий (загружаются из Firebase)
  const [categoryCoefficients, setCategoryCoefficients] = useState(DEFAULT_CATEGORIES);

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

  // Подписка на изменения коэффициентов категорий в Firebase
  useEffect(() => {
    const coefficientsRef = ref(database, 'settings/categoryCoefficients');
    
    const unsubscribe = onValue(coefficientsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Объединяем с дефолтными значениями (name и description)
        const mergedCategories = {};
        Object.keys(DEFAULT_CATEGORIES).forEach(key => {
          mergedCategories[key] = {
            ...DEFAULT_CATEGORIES[key],
            coefficient: data[key] !== undefined ? data[key] : DEFAULT_CATEGORIES[key].coefficient
          };
        });
        setCategoryCoefficients(mergedCategories);
      } else {
        // Если данных нет - используем дефолтные значения
        setCategoryCoefficients(DEFAULT_CATEGORIES);
      }
    });
    
    return () => unsubscribe();
  }, []);

  // Подписка на турниры
  useEffect(() => {
    const tournamentsRef = ref(database, 'tournaments');

    const unsubscribe = onValue(tournamentsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setTournaments([]);
        return;
      }

      const tournamentsArray = Object.keys(data)
        .map((key) => ({
          id: key,
          ...data[key]
        }))
        .sort((a, b) => {
          const hasOrderA = Number.isFinite(Number(a.displayOrder));
          const hasOrderB = Number.isFinite(Number(b.displayOrder));
          if (hasOrderA && hasOrderB) {
            return Number(a.displayOrder) - Number(b.displayOrder);
          }
          if (hasOrderA && !hasOrderB) return -1;
          if (!hasOrderA && hasOrderB) return 1;
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });

      setTournaments(tournamentsArray);
    });

    return () => unsubscribe();
  }, []);

  // Поиск ссылки на Википедию для поэта
  const searchWikipediaLink = async (poetName) => {
    try {
      const searchUrl = `https://ru.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(poetName)}&limit=1&namespace=0&format=json&origin=*`;
      
      const response = await fetch(searchUrl);
      const data = await response.json();
      
      if (data[3] && data[3].length > 0) {
        return data[3][0];
      }
      return '';
    } catch (error) {
      return '';
    }
  };

  // Поиск ссылки на Wikiquote для цитат поэта
  const searchWikiquoteLink = async (poetName) => {
    try {
      const searchUrl = `https://ru.wikiquote.org/w/api.php?action=opensearch&search=${encodeURIComponent(poetName)}&limit=1&namespace=0&format=json&origin=*`;
      
      const response = await fetch(searchUrl);
      const data = await response.json();
      
      if (data[3] && data[3].length > 0) {
        return data[3][0];
      }
      return '';
    } catch (error) {
      return '';
    }
  };

  // Поиск ссылки на стихи поэта (rustih.ru)
  const searchPoemsLink = async (poetName) => {
    try {
      const query = `${poetName} стихи site:rustih.ru`;
      const url = `https://google-search74.p.rapidapi.com/?query=${encodeURIComponent(query)}&limit=1&related_keywords=false`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': '58cedd75c1msha8a949d550cd81dp15949fjsn3430eac905e0',
          'X-RapidAPI-Host': 'google-search74.p.rapidapi.com'
        }
      });
      
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        return data.results[0].url || '';
      }
      return '';
    } catch (error) {
      return '';
    }
  };

  // Добавить поэта
  const addPoet = async (name, imageUrl = '', bio = '', lifeStory = '', influence = '', creativity = '', drama = '', beauty = '') => {
    const id = Date.now().toString();
    
    // Ищем ссылки параллельно
    const [wikiLink, wikiquoteLink, poemsLink] = await Promise.all([
      searchWikipediaLink(name.trim()),
      searchWikiquoteLink(name.trim()),
      searchPoemsLink(name.trim())
    ]);
    
    const newPoet = {
      name: name.trim(),
      imageUrl: imageUrl.trim(),
      bio: bio.trim(),
      lifeStory: lifeStory.trim(),
      influence: influence.trim(),
      creativity: creativity.trim(),
      drama: drama.trim(),
      beauty: beauty.trim(),
      addedAt: new Date().toISOString(),
      links: {
        wikipedia: wikiLink || null,
        wikiquote: wikiquoteLink || null,
        poems: poemsLink || null,
        youtube: null,
        other: null
      }
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

  // Обновить ссылки поэта
  const updatePoetLinks = async (poetId, links) => {
    await update(ref(database, `poets/${poetId}/links`), links);
  };

  // Добавить YouTube ссылку
  const addYoutubeLink = async (poetId, title, url) => {
    const poet = poets.find(p => p.id === poetId);
    const currentLinks = poet?.links?.youtube || [];
    const newLinks = [...currentLinks, { title, url, addedAt: new Date().toISOString() }];
    await set(ref(database, `poets/${poetId}/links/youtube`), newLinks);
  };

  // Удалить YouTube ссылку
  const removeYoutubeLink = async (poetId, index) => {
    const poet = poets.find(p => p.id === poetId);
    const currentLinks = poet?.links?.youtube || [];
    const newLinks = currentLinks.filter((_, i) => i !== index);
    await set(ref(database, `poets/${poetId}/links/youtube`), newLinks);
  };

  // Обновить рейтинг
  const updateRating = async (rater, poetId, category, value) => {
    const poet = poets.find(p => p.id === poetId);
    
    // Сначала устанавливаем новое значение рейтинга
    await set(ref(database, `ratings/${rater}/${poetId}/${category}`), value);
    
    if (poet) {
      // Вычисляем, какой будет новый score ПОСЛЕ установки значения
      // Для текущего rater: берём текущие оценки и заменяем category на новое value
      const currentRaterRatings = ratings[rater]?.[poetId] || {};
      const newRaterRatings = { ...currentRaterRatings, [category]: value };
      const newRaterScore = Object.keys(CATEGORIES).reduce((total, cat) => {
        const rating = newRaterRatings[cat] || 0;
        return total + (rating * CATEGORIES[cat].coefficient);
      }, 0);
      
      // Для другого rater: score остаётся как есть
      const otherRater = rater === 'maxim' ? 'oleg' : 'maxim';
      const otherScore = calculateScore(otherRater, poetId);
      
      // Старые scores (до изменения)
      const oldRaterScore = calculateScore(rater, poetId);
      const hadRatings = oldRaterScore > 0 || otherScore > 0;
      
      // Новый общий score
      const willHaveRatings = newRaterScore > 0 || otherScore > 0;
      
      // Если раньше не было оценок, а теперь есть → устанавливаем firstRatedAt
      if (!hadRatings && willHaveRatings) {
        await update(ref(database, `poets/${poetId}`), {
          firstRatedAt: new Date().toISOString()
        });
      }
      
      // Если раньше были оценки, а теперь нет → удаляем firstRatedAt
      if (hadRatings && !willHaveRatings && poet.firstRatedAt) {
        await update(ref(database, `poets/${poetId}`), {
          firstRatedAt: null
        });
      }
    }
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

    const score = Object.keys(categoryCoefficients).reduce((total, category) => {
      const rating = poetRatings[category] || 0;
      const coefficient = categoryCoefficients[category].coefficient;
      return total + (rating * coefficient);
    }, 0);
    
    return score;
  }, [ratings, poets, categoryCoefficients]);

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

  // === Функции для работы с турнирами ===
  const createTournament = async ({
    name,
    badge,
    size = 16,
    aiPromptTemplate = ''
  }) => {
    const tournamentsRef = ref(database, 'tournaments');
    const newTournamentRef = push(tournamentsRef);
    const now = new Date().toISOString();
    const maxDisplayOrder = tournaments.reduce((max, item) => {
      const value = Number(item?.displayOrder);
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, -1);

    const normalizedSize = Number(size) === 32 ? 32 : 16;

    await set(newTournamentRef, {
      name: name?.trim() || 'Новый турнир',
      badge: badge?.trim() || '',
      size: normalizedSize,
      aiPromptTemplate: aiPromptTemplate?.trim() || '',
      displayOrder: maxDisplayOrder + 1,
      status: 'draft',
      winnerPoetId: null,
      createdAt: now,
      updatedAt: now
    });

    return newTournamentRef.key;
  };

  const updateTournament = async (tournamentId, updates = {}) => {
    if (!tournamentId) throw new Error('tournamentId is required');

    const payload = { ...updates };
    if (payload.name !== undefined) payload.name = payload.name?.trim() || '';
    if (payload.badge !== undefined) payload.badge = payload.badge?.trim() || '';
    if (payload.aiPromptTemplate !== undefined) {
      payload.aiPromptTemplate = payload.aiPromptTemplate?.trim() || '';
    }
    if (payload.size !== undefined) {
      payload.size = Number(payload.size) === 32 ? 32 : 16;
    }
    payload.updatedAt = new Date().toISOString();

    await update(ref(database, `tournaments/${tournamentId}`), payload);
  };

  const deleteTournament = async (tournamentId) => {
    if (!tournamentId) throw new Error('tournamentId is required');
    await remove(ref(database, `tournaments/${tournamentId}`));
  };

  const addTournamentParticipant = async (tournamentId, participant) => {
    if (!tournamentId) throw new Error('tournamentId is required');
    const tournament = tournaments.find((t) => t.id === tournamentId);
    if (!tournament) throw new Error('Tournament not found');

    const size = tournament.size === 32 ? 32 : 16;
    const participantsObj = tournament.participants || {};
    const participantsArray = Object.keys(participantsObj).map((id) => ({
      id,
      ...participantsObj[id]
    }));

    const usedSlots = new Set(
      participantsArray
        .map((p) => p.slot)
        .filter((slot) => Number.isInteger(slot))
    );

    const freeSlots = [];
    for (let i = 0; i < size; i += 1) {
      if (!usedSlots.has(i)) freeSlots.push(i);
    }

    if (freeSlots.length === 0) {
      throw new Error('No free slots in tournament');
    }

    const randomSlot = freeSlots[Math.floor(Math.random() * freeSlots.length)];
    const participantRef = push(ref(database, `tournaments/${tournamentId}/participants`));
    const now = new Date().toISOString();
    await set(participantRef, {
      poetId: participant.poetId,
      poemIds: Array.isArray(participant.poemIds) ? participant.poemIds : [],
      slot: randomSlot,
      createdAt: now,
      updatedAt: now
    });
    await update(ref(database, `tournaments/${tournamentId}`), { updatedAt: now });
    return participantRef.key;
  };

  const updateTournamentParticipant = async (tournamentId, participantId, updates = {}) => {
    if (!tournamentId || !participantId) throw new Error('tournamentId and participantId are required');
    await update(ref(database, `tournaments/${tournamentId}/participants/${participantId}`), {
      ...updates,
      updatedAt: new Date().toISOString()
    });
    await update(ref(database, `tournaments/${tournamentId}`), { updatedAt: new Date().toISOString() });
  };

  const deleteTournamentParticipant = async (tournamentId, participantId) => {
    if (!tournamentId || !participantId) throw new Error('tournamentId and participantId are required');
    await remove(ref(database, `tournaments/${tournamentId}/participants/${participantId}`));
    await update(ref(database, `tournaments/${tournamentId}`), { updatedAt: new Date().toISOString() });
  };

  const getParticipantBySlot = (tournament, slot) => {
    const participantsObj = tournament?.participants || {};
    const participantEntry = Object.entries(participantsObj).find(([, value]) => value?.slot === slot);
    if (!participantEntry) return null;
    return { id: participantEntry[0], ...participantEntry[1] };
  };

  const buildPoemsText = (poetId, poemIds = []) => {
    const poet = poets.find((p) => p.id === poetId);
    if (!poet || !poet.poems) return '—';
    const poems = Object.entries(poet.poems)
      .filter(([id]) => poemIds.includes(id))
      .map(([, poem]) => poem?.title?.trim())
      .filter(Boolean);
    return poems.length ? poems.join('; ') : '—';
  };

  const resolveAiWinner = async (tournament, matchData) => {
    const poetA = poets.find((p) => p.id === matchData.poetAId);
    const poetB = poets.find((p) => p.id === matchData.poetBId);
    if (!poetA || !poetB) return null;

    const poemsA = buildPoemsText(poetA.id, matchData.poetAPoemIds || []);
    const poemsB = buildPoemsText(poetB.id, matchData.poetBPoemIds || []);
    const fallbackPrompt = [
      `Выбери победителя в категории "${tournament?.name || 'Турнир'}".`,
      `Ответ строго одним именем: "${poetA.name}" или "${poetB.name}".`,
      `Поэт A: ${poetA.name}. Стихи: ${poemsA}.`,
      `Поэт B: ${poetB.name}. Стихи: ${poemsB}.`
    ].join('\n');

    const template = (tournament?.aiPromptTemplate || '').trim();
    const prompt = template
      ? template
          .replaceAll('{{poetA_name}}', poetA.name)
          .replaceAll('{{poetB_name}}', poetB.name)
          .replaceAll('{{poetA_poems}}', poemsA)
          .replaceAll('{{poetB_poems}}', poemsB)
      : fallbackPrompt;

    try {
      const response = await generateContent(prompt, 0.1);
      console.log('[Tournament AI] ── Raw response ──\n', response);
      const text = String(response || '');

      // Try JSON with winner: "A" or "B"
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          console.log('[Tournament AI] JSON block found:', jsonMatch[0]);
          const parsed = JSON.parse(jsonMatch[0]);
          console.log('[Tournament AI] Parsed JSON:', parsed);
          const w = String(parsed.winner || '').trim().toUpperCase();
          const reason = parsed.reason ? String(parsed.reason).trim() : null;
          console.log('[Tournament AI] winner field:', w, '| reason:', reason);
          if (w === 'A') { console.log('[Tournament AI] → Winner A:', poetA.name); return { winnerSide: 'A', winnerId: poetA.id, reason }; }
          if (w === 'B') { console.log('[Tournament AI] → Winner B:', poetB.name); return { winnerSide: 'B', winnerId: poetB.id, reason }; }
          console.log('[Tournament AI] winner field not A/B, falling through');
        } else {
          console.log('[Tournament AI] No JSON block found in response');
        }
      } catch (parseError) {
        console.log('[Tournament AI] JSON parse error:', parseError);
      }

      // Fall back to name-based matching
      const lower = text.toLowerCase();
      console.log('[Tournament AI] Trying name match. poetA:', poetA.name, '| poetB:', poetB.name);
      if (lower.includes(poetA.name.toLowerCase())) { console.log('[Tournament AI] → Name match: poetA'); return { winnerSide: 'A', winnerId: poetA.id, reason: null }; }
      if (lower.includes(poetB.name.toLowerCase())) { console.log('[Tournament AI] → Name match: poetB'); return { winnerSide: 'B', winnerId: poetB.id, reason: null }; }
      console.log('[Tournament AI] No name match found');
    } catch (error) {
      console.log('[Tournament AI] generateContent error:', error);
    }
    const fallbackSide = Math.random() < 0.5 ? 'A' : 'B';
    const fallbackWinner = fallbackSide === 'A' ? poetA.id : poetB.id;
    console.log('[Tournament AI] Fallback winner used:', fallbackWinner);
    return { winnerSide: fallbackSide, winnerId: fallbackWinner, reason: null };
  };

  const getMatchPath = (match) =>
    match.type === 'final'
      ? 'finalMatch'
      : `rounds/${match.roundIndex}/${match.side}/${match.nodeIndex}`;
  const getPlayInPath = () => 'playIn';
  const normalizeVoteToSide = (voteValue, poetAId, poetBId) => {
    const raw = String(voteValue || '').trim();
    if (!raw) return null;
    if (raw === 'A' || raw === 'B') return raw;

    const a = String(poetAId || '').trim();
    const b = String(poetBId || '').trim();
    if (!a || !b) return null;
    if (a === b) return null;
    if (raw === a) return 'A';
    if (raw === b) return 'B';
    return null;
  };

  const buildStoredVoteValue = (winnerPoetId, winnerSide, poetAId, poetBId) => {
    if (winnerSide === 'A' || winnerSide === 'B') return winnerSide;

    const chosen = String(winnerPoetId || '').trim();
    const a = String(poetAId || '').trim();
    const b = String(poetBId || '').trim();
    if (!chosen || !a || !b) return chosen;
    if (a === b) throw new Error('Нужно выбрать конкретную сторону дуэли (A/B) для одинаковых поэтов');
    if (chosen === a || chosen === b) return chosen;
    throw new Error('Неверный выбор победителя');
  };

  const buildMatchData = (tournament, match) => {
    const size = tournament.size === 32 ? 32 : 16;
    const sideSize = size / 2;

    if (match.type === 'final') {
      const finalData = tournament.final || {};
      return {
        poetAId: finalData.poetAId || null,
        poetBId: finalData.poetBId || null,
        poetAPoemIds: finalData.poetAPoemIds || [],
        poetBPoemIds: finalData.poetBPoemIds || [],
        votes: {},
        status: 'active',
        updatedAt: new Date().toISOString()
      };
    }

    const existing = tournament?.rounds?.[match.roundIndex]?.[match.side]?.[match.nodeIndex];
    if (match.roundIndex > 0) {
      return existing || null;
    }

    const baseSlot = match.side === 'left' ? 0 : sideSize;
    const firstSlot = baseSlot + match.nodeIndex * 2;
    const p1 = getParticipantBySlot(tournament, firstSlot);
    const p2 = getParticipantBySlot(tournament, firstSlot + 1);

    return {
      poetAId: p1?.poetId || null,
      poetBId: p2?.poetId || null,
      poetAPoemIds: p1?.poemIds || [],
      poetBPoemIds: p2?.poemIds || [],
      votes: existing?.votes || {},
      status: existing?.status || 'active',
      updatedAt: new Date().toISOString()
    };
  };

  const ensureTournamentMatch = async (tournamentId, match, options = {}) => {
    const { waitForAi = false, triggerAi = true } = options;
    if (!tournamentId || !match) throw new Error('tournamentId and match are required');
    const tournamentSnapshot = await get(ref(database, `tournaments/${tournamentId}`));
    const tournament = tournamentSnapshot.val();
    if (!tournament) throw new Error('Tournament not found');

    const path = getMatchPath(match);
    const existing = match.type === 'final'
      ? (tournament.finalMatch || null)
      : (tournament?.rounds?.[match.roundIndex]?.[match.side]?.[match.nodeIndex] || null);

    const built = buildMatchData(tournament, match);
    if (!built || !built.poetAId || !built.poetBId) {
      throw new Error('Match is not ready: two opponents required');
    }

    const payload = existing ? { ...existing } : built;
    if (!payload.votes) payload.votes = {};

    if (!existing) {
      await set(ref(database, `tournaments/${tournamentId}/${path}`), payload);
    }

    const aiTask = async () => {
      if (payload.votes.ai) return;

      // Claim AI request lock: only one client should trigger AI for this match.
      const matchRef = ref(database, `tournaments/${tournamentId}/${path}`);
      const lockResult = await runTransaction(matchRef, (current) => {
        if (!current) return current;
        if (current?.votes?.ai) return;
        if (current?.aiRequestStatus === 'pending') return;
        return {
          ...current,
          aiRequestStatus: 'pending',
          aiRequestedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      });

      if (!lockResult.committed) {
        console.log('[Tournament AI] Skip duplicate AI request for match:', path);
        return;
      }

      try {
        const result = await resolveAiWinner(tournament, payload);
        if (result?.winnerId) {
          console.log('[Tournament AI] Winner:', result.winnerId, result.reason ? `| Reason: ${result.reason}` : '');
          const aiUpdate = {
            'votes/ai': result.winnerSide || result.winnerId,
            aiRequestStatus: 'done',
            aiRespondedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          if (result.reason) aiUpdate['votes/aiReason'] = result.reason;
          await update(matchRef, aiUpdate);
          await settleTournamentMatchIfReady(tournamentId, match);
        }
      } catch (error) {
        await update(matchRef, {
          aiRequestStatus: 'error',
          aiErrorAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        throw error;
      }
    };

    if (triggerAi) {
      if (waitForAi) {
        await aiTask();
      } else {
        aiTask().catch(() => {});
      }
    }
  };

  const settleTournamentMatchIfReady = async (tournamentId, match) => {
    const tournamentSnapshot = await get(ref(database, `tournaments/${tournamentId}`));
    const tournament = tournamentSnapshot.val();
    if (!tournament) return;

    const matchPath = getMatchPath(match);
    const matchData = match.type === 'final'
      ? tournament.finalMatch
      : tournament?.rounds?.[match.roundIndex]?.[match.side]?.[match.nodeIndex];
    if (!matchData || !matchData.poetAId || !matchData.poetBId) return;

    const votes = matchData.votes || {};
    if (!votes.maxim || !votes.oleg || !votes.ai) return;
    if (matchData.winnerPoetId) return;

    const sideVotes = [votes.maxim, votes.oleg, votes.ai]
      .map((vote) => normalizeVoteToSide(vote, matchData.poetAId, matchData.poetBId))
      .filter(Boolean);
    if (sideVotes.length < 3) return;

    const counts = {};
    sideVotes.forEach((side) => {
      counts[side] = (counts[side] || 0) + 1;
    });
    let winnerSide = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    if (!winnerSide) winnerSide = normalizeVoteToSide(votes.ai, matchData.poetAId, matchData.poetBId) || 'A';
    const winnerPoetId = winnerSide === 'A' ? matchData.poetAId : matchData.poetBId;

    const winnerPoemIds =
      winnerSide === 'A'
        ? (matchData.poetAPoemIds || [])
        : (matchData.poetBPoemIds || []);

    await update(ref(database, `tournaments/${tournamentId}/${matchPath}`), {
      winnerPoetId,
      winnerSide,
      winnerPoemIds,
      status: 'finished',
      finishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const size = tournament.size === 32 ? 32 : 16;
    const roundsPerSide = Math.log2(size / 2);

    if (match.type === 'final') {
      await update(ref(database, `tournaments/${tournamentId}`), {
        winnerPoetId,
        status: 'finished',
        finishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      return;
    }

    if (match.roundIndex < roundsPerSide - 1) {
      const nextRoundIndex = match.roundIndex + 1;
      const nextNodeIndex = Math.floor(match.nodeIndex / 2);
      const isUpper = match.nodeIndex % 2 === 0;
      const fieldPoet = isUpper ? 'poetAId' : 'poetBId';
      const fieldPoems = isUpper ? 'poetAPoemIds' : 'poetBPoemIds';
      const nextPath = `tournaments/${tournamentId}/rounds/${nextRoundIndex}/${match.side}/${nextNodeIndex}`;
      await update(ref(database, nextPath), {
        [fieldPoet]: winnerPoetId,
        [fieldPoems]: winnerPoemIds,
        status: 'active',
        updatedAt: new Date().toISOString()
      });
      return;
    }

    const finalFieldPoet = match.side === 'left' ? 'poetAId' : 'poetBId';
    const finalFieldPoems = match.side === 'left' ? 'poetAPoemIds' : 'poetBPoemIds';
    await update(ref(database, `tournaments/${tournamentId}/final`), {
      [finalFieldPoet]: winnerPoetId,
      [finalFieldPoems]: winnerPoemIds,
      updatedAt: new Date().toISOString()
    });
  };

  const submitTournamentVote = async (tournamentId, match, user, winnerPoetId, winnerSide = null) => {
    if (!tournamentId || !match || !user || !winnerPoetId) {
      throw new Error('tournamentId, match, user and winnerPoetId are required');
    }
    if (!['maxim', 'oleg'].includes(user)) throw new Error('Invalid user');

    await ensureTournamentMatch(tournamentId, match, {
      waitForAi: false,
      triggerAi: user === 'maxim'
    });
    const tournamentSnapshot = await get(ref(database, `tournaments/${tournamentId}`));
    const tournament = tournamentSnapshot.val();
    if (!tournament) throw new Error('Tournament not found');

    const matchPath = getMatchPath(match);
    const matchData = match.type === 'final'
      ? tournament.finalMatch
      : tournament?.rounds?.[match.roundIndex]?.[match.side]?.[match.nodeIndex];
    if (!matchData?.poetAId || !matchData?.poetBId) throw new Error('Match is not ready');
    const voteValue = buildStoredVoteValue(
      winnerPoetId,
      winnerSide,
      matchData.poetAId,
      matchData.poetBId
    );

    await update(ref(database, `tournaments/${tournamentId}/${matchPath}`), {
      [`votes/${user}`]: voteValue,
      updatedAt: new Date().toISOString()
    });
    await settleTournamentMatchIfReady(tournamentId, match);
  };

  const ensureTournamentPlayIn = async (tournamentId, payload = {}, options = {}) => {
    const { waitForAi = false, triggerAi = true } = options;
    if (!tournamentId) throw new Error('tournamentId is required');

    const tournamentSnapshot = await get(ref(database, `tournaments/${tournamentId}`));
    const tournament = tournamentSnapshot.val();
    if (!tournament) throw new Error('Tournament not found');

    const playInPath = getPlayInPath();
    const existing = tournament.playIn || null;
    const now = new Date().toISOString();

    const shouldCreateNew = !existing
      || existing.status === 'finished'
      || !existing.poetAId
      || !existing.poetBId;

    let playInPayload = existing;
    if (shouldCreateNew) {
      if (!payload?.incumbentParticipantId || !payload?.incumbentPoetId || !payload?.challengerPoetId) {
        throw new Error('Play-in payload is incomplete');
      }

      playInPayload = {
        incumbentParticipantId: payload.incumbentParticipantId,
        poetAId: payload.incumbentPoetId,
        poetBId: payload.challengerPoetId,
        poetAPoemIds: Array.isArray(payload.incumbentPoemIds) ? payload.incumbentPoemIds : [],
        poetBPoemIds: Array.isArray(payload.challengerPoemIds) ? payload.challengerPoemIds : [],
        votes: {},
        status: 'active',
        createdAt: now,
        updatedAt: now
      };
      await set(ref(database, `tournaments/${tournamentId}/${playInPath}`), playInPayload);
    }

    if (!playInPayload?.poetAId || !playInPayload?.poetBId) {
      throw new Error('Play-in is not ready: two opponents required');
    }

    const aiTask = async () => {
      if (playInPayload?.votes?.ai) return;
      const playInRef = ref(database, `tournaments/${tournamentId}/${playInPath}`);

      const lockResult = await runTransaction(playInRef, (current) => {
        if (!current) return current;
        if (current?.votes?.ai) return;
        if (current?.aiRequestStatus === 'pending') return;
        return {
          ...current,
          aiRequestStatus: 'pending',
          aiRequestedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      });

      if (!lockResult.committed) {
        console.log('[Tournament AI] Skip duplicate AI request for play-in');
        return;
      }

      try {
        const result = await resolveAiWinner(tournament, playInPayload);
        if (result?.winnerId) {
          const aiUpdate = {
            'votes/ai': result.winnerSide || result.winnerId,
            aiRequestStatus: 'done',
            aiRespondedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          if (result.reason) aiUpdate['votes/aiReason'] = result.reason;
          await update(playInRef, aiUpdate);
          await settleTournamentPlayInIfReady(tournamentId);
        }
      } catch (error) {
        await update(playInRef, {
          aiRequestStatus: 'error',
          aiErrorAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        throw error;
      }
    };

    if (triggerAi) {
      if (waitForAi) {
        await aiTask();
      } else {
        aiTask().catch(() => {});
      }
    }
  };

  const settleTournamentPlayInIfReady = async (tournamentId) => {
    if (!tournamentId) return;
    const tournamentSnapshot = await get(ref(database, `tournaments/${tournamentId}`));
    const tournament = tournamentSnapshot.val();
    if (!tournament) return;

    const playIn = tournament.playIn;
    if (!playIn || playIn.status !== 'active') return;
    if (!playIn.poetAId || !playIn.poetBId) return;

    const votes = playIn.votes || {};
    if (!votes.maxim || !votes.oleg || !votes.ai) return;
    if (playIn.winnerPoetId) return;

    const sideVotes = [votes.maxim, votes.oleg, votes.ai]
      .map((vote) => normalizeVoteToSide(vote, playIn.poetAId, playIn.poetBId))
      .filter(Boolean);
    if (sideVotes.length < 3) return;

    const counts = {};
    sideVotes.forEach((side) => {
      counts[side] = (counts[side] || 0) + 1;
    });
    let winnerSide = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    if (!winnerSide) winnerSide = normalizeVoteToSide(votes.ai, playIn.poetAId, playIn.poetBId) || 'A';
    const winnerPoetId = winnerSide === 'A' ? playIn.poetAId : playIn.poetBId;

    const now = new Date().toISOString();
    if (
      String(winnerPoetId) === String(playIn.poetBId)
      && playIn.incumbentParticipantId
    ) {
      const participantRef = ref(database, `tournaments/${tournamentId}/participants/${playIn.incumbentParticipantId}`);
      const participantSnapshot = await get(participantRef);
      if (participantSnapshot.exists()) {
        await update(participantRef, {
          poetId: playIn.poetBId,
          poemIds: Array.isArray(playIn.poetBPoemIds) ? playIn.poetBPoemIds : [],
          updatedAt: now
        });
      }
    }

    await update(ref(database, `tournaments/${tournamentId}/playIn`), {
      winnerPoetId,
      winnerSide,
      status: 'finished',
      finishedAt: now,
      updatedAt: now
    });
    await update(ref(database, `tournaments/${tournamentId}`), { updatedAt: now });
  };

  const submitTournamentPlayInVote = async (tournamentId, user, winnerPoetId, winnerSide = null) => {
    if (!tournamentId || !user || !winnerPoetId) {
      throw new Error('tournamentId, user and winnerPoetId are required');
    }
    if (!['maxim', 'oleg'].includes(user)) throw new Error('Invalid user');

    await ensureTournamentPlayIn(tournamentId, {}, {
      waitForAi: false,
      triggerAi: user === 'maxim'
    });

    const tournamentSnapshot = await get(ref(database, `tournaments/${tournamentId}`));
    const tournament = tournamentSnapshot.val();
    if (!tournament?.playIn || tournament.playIn.status !== 'active') {
      throw new Error('Активной дуэли за место нет');
    }

    const playIn = tournament.playIn;
    const voteValue = buildStoredVoteValue(
      winnerPoetId,
      winnerSide,
      playIn.poetAId,
      playIn.poetBId
    );

    await update(ref(database, `tournaments/${tournamentId}/playIn`), {
      [`votes/${user}`]: voteValue,
      updatedAt: new Date().toISOString()
    });
    await settleTournamentPlayInIfReady(tournamentId);
  };

  const promoteTournamentWinnerByBye = async (tournamentId, match, winnerPoetId) => {
    if (!tournamentId || !match || !winnerPoetId) {
      throw new Error('tournamentId, match and winnerPoetId are required');
    }

    const tournamentSnapshot = await get(ref(database, `tournaments/${tournamentId}`));
    const tournament = tournamentSnapshot.val();
    if (!tournament) throw new Error('Tournament not found');

    let winnerPoemIds = [];
    if (match.type === 'final') {
      const finalData = tournament.final || {};
      winnerPoemIds = winnerPoetId === finalData.poetAId
        ? (finalData.poetAPoemIds || [])
        : (finalData.poetBPoemIds || []);
    } else if (match.roundIndex === 0) {
      const size = tournament.size === 32 ? 32 : 16;
      const sideSize = size / 2;
      const baseSlot = match.side === 'left' ? 0 : sideSize;
      const firstSlot = baseSlot + match.nodeIndex * 2;
      const participantsObj = tournament.participants || {};
      const p1 = Object.values(participantsObj).find((p) => p?.slot === firstSlot);
      const p2 = Object.values(participantsObj).find((p) => p?.slot === firstSlot + 1);
      winnerPoemIds = winnerPoetId === p1?.poetId ? (p1?.poemIds || []) : (p2?.poemIds || []);
    } else {
      const matchData = tournament?.rounds?.[match.roundIndex]?.[match.side]?.[match.nodeIndex];
      if (!matchData) throw new Error('Match data not found');
      winnerPoemIds = winnerPoetId === matchData.poetAId
        ? (matchData.poetAPoemIds || [])
        : (matchData.poetBPoemIds || []);
    }

    const now = new Date().toISOString();
    if (match.type === 'final') {
      const finalData = tournament.final || {};
      const winnerSide = String(winnerPoetId) === String(finalData.poetAId) ? 'A' : 'B';
      await update(ref(database, `tournaments/${tournamentId}/finalMatch`), {
        winnerPoetId,
        winnerSide,
        winnerPoemIds,
        status: 'finished',
        finishedAt: now,
        updatedAt: now
      });
      console.log('[Tournament] Manual promote final winner:', winnerPoetId);
      await update(ref(database, `tournaments/${tournamentId}`), {
        winnerPoetId,
        status: 'finished',
        finishedAt: now,
        updatedAt: now
      });
      return;
    }

    const roundsPerSide = Math.log2((tournament.size === 32 ? 32 : 16) / 2);
    await update(ref(database, `tournaments/${tournamentId}/rounds/${match.roundIndex}/${match.side}/${match.nodeIndex}`), {
      winnerPoetId,
      status: 'finished',
      finishedAt: now,
      updatedAt: now
    });

    if (match.roundIndex < roundsPerSide - 1) {
      const nextRoundIndex = match.roundIndex + 1;
      const nextNodeIndex = Math.floor(match.nodeIndex / 2);
      const isUpper = match.nodeIndex % 2 === 0;
      const fieldPoet = isUpper ? 'poetAId' : 'poetBId';
      const fieldPoems = isUpper ? 'poetAPoemIds' : 'poetBPoemIds';
      await update(ref(database, `tournaments/${tournamentId}/rounds/${nextRoundIndex}/${match.side}/${nextNodeIndex}`), {
        [fieldPoet]: winnerPoetId,
        [fieldPoems]: winnerPoemIds,
        status: 'active',
        updatedAt: now
      });
      return;
    }

    const finalFieldPoet = match.side === 'left' ? 'poetAId' : 'poetBId';
    const finalFieldPoems = match.side === 'left' ? 'poetAPoemIds' : 'poetBPoemIds';
    await update(ref(database, `tournaments/${tournamentId}/final`), {
      [finalFieldPoet]: winnerPoetId,
      [finalFieldPoems]: winnerPoemIds,
      updatedAt: now
    });
  };

  // Обновить коэффициенты категорий
  const updateCategoryCoefficients = async (coefficients) => {
    // Валидация: сумма должна быть равна 1.0 (100%)
    const sum = Object.values(coefficients).reduce((acc, val) => acc + val, 0);
    if (Math.abs(sum - 1.0) > 0.001) {
      throw new Error(`Сумма коэффициентов должна быть равна 100% (текущая: ${(sum * 100).toFixed(1)}%)`);
    }
    
    // Сохраняем только числовые значения коэффициентов
    const coefficientsToSave = {};
    Object.keys(coefficients).forEach(key => {
      coefficientsToSave[key] = coefficients[key];
    });
    
    await set(ref(database, 'settings/categoryCoefficients'), coefficientsToSave);
  };

  const value = {
    poets,
    ratings,
    categoryLeaders,
    overallDuelWinners,
    aiChoiceTiebreaker,
    likes,
    tournaments,
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
    createTournament,
    updateTournament,
    deleteTournament,
    addTournamentParticipant,
    updateTournamentParticipant,
    deleteTournamentParticipant,
    ensureTournamentMatch,
    submitTournamentVote,
    ensureTournamentPlayIn,
    submitTournamentPlayInVote,
    promoteTournamentWinnerByBye,
    calculateScore,
    calculateAverageScore,
    CATEGORIES,
    categoryCoefficients,
    updateCategoryCoefficients,
    getCategoryRankings,
    getOverallRankings,
    cleanupInvalidData,
    searchWikipediaLink,
    updatePoetLinks,
    addYoutubeLink,
    removeYoutubeLink
  };

  return (
    <PoetsContext.Provider value={value}>
      {children}
    </PoetsContext.Provider>
  );
};
