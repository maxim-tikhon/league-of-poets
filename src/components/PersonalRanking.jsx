import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePoets, CATEGORIES } from '../context/PoetsContext';
import StarRating from './StarRating';
import Tooltip from './Tooltip';
import BattleModal from './BattleModal';
import './PersonalRanking.css';

const PersonalRanking = ({ raterName, raterId, title, icon, color }) => {
  const location = useLocation();
  const { poets, ratings, categoryLeaders, isLoading, updateRating, setCategoryLeader, calculateScore, likes, toggleLike } = usePoets();
  const [sortBy, setSortBy] = useState('overall'); // 'overall', category key or 'awards'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'
  const [expandedCards, setExpandedCards] = useState([]); // Развернутые карточки
  const [battleConflict, setBattleConflict] = useState(null); // { category, poet1, poet2, isWorstConflict }
  const changedPoetRef = useRef(null); // { poetId, category } - поэт, для которого изменилась оценка
  const originalPoetIdRef = useRef(null); // ID изначального поэта (для цепочки дуэлей)
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

  // Функция форматирования общего балла (2 знака после запятой)
  const formatScore = useCallback((score) => {
    // Математическое округление (2.965 → 2.97)
    return (Math.round(score * 100) / 100).toFixed(2);
  }, []);

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
        
        // Проверяем, есть ли явно выбранный лидер
        const explicitLeader = categoryLeaders[raterId]?.[category];
        
        if (explicitLeader) {
          // Проверяем, что у явно выбранного лидера есть оценка в этой категории
          const leaderHasRating = poetsWithRatings.some(p => p.id === explicitLeader);
          const leaderStillOnTop = topPoets.some(p => p.id === explicitLeader);
          
          // Если у лидера нет оценки ИЛИ он больше не в топе - сбрасываем его статус и назначаем нового
          if (!leaderHasRating || !leaderStillOnTop) {
            setCategoryLeader(raterId, category, null);
            
            // Автоматически назначаем нового лидера, если есть только один с максимальным баллом
            if (topPoets.length === 1) {
              setCategoryLeader(raterId, category, topPoets[0].id);
              winners[category] = [topPoets[0].id];
            } else {
              winners[category] = [];
            }
          } else {
            // Если есть явный лидер И он все еще в топе - он победитель
            winners[category] = [explicitLeader];
          }
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
      
      if (overallExplicitLeader) {
        // Проверяем, что у явно выбранного лидера есть оценки
        const leaderHasScores = poetsWithScores.some(p => p.id === overallExplicitLeader);
        const leaderStillOnTop = topPoets.some(p => p.id === overallExplicitLeader);
        
        // Если у лидера нет оценок ИЛИ он больше не в топе - сбрасываем его статус и назначаем нового
        if (!leaderHasScores || !leaderStillOnTop) {
          setCategoryLeader(raterId, 'overall', null);
          
          // Автоматически назначаем нового лидера, если есть только один с максимальным баллом
          if (topPoets.length === 1) {
            setCategoryLeader(raterId, 'overall', topPoets[0].id);
            winners.overall = [topPoets[0].id];
          } else {
            winners.overall = [];
          }
        } else {
          // Если есть явный лидер И он все еще в топе - он победитель
          winners.overall = [overallExplicitLeader];
        }
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
  }, [poets, ratings, categoryLeaders, raterId, calculateScore, setCategoryLeader]);

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
        // Проверяем, что у явно выбранного худшего есть оценки
        const loserHasScores = poetsWithScores.some(p => p.id === explicitLoser);
        const loserStillAtBottom = lowestPoets.some(p => p.id === explicitLoser);
        
        // Если у худшего нет оценок ИЛИ он больше не в низу - сбрасываем его статус и назначаем нового
        if (!loserHasScores || !loserStillAtBottom) {
          setCategoryLeader(raterId, 'overall_worst', null);
          
          // Автоматически назначаем нового худшего, если есть только один с минимальным баллом
          if (lowestPoets.length === 1) {
            setCategoryLeader(raterId, 'overall_worst', lowestPoets[0].id);
            losers.overall = [lowestPoets[0].id];
          }
        } else {
          // Если есть явно выбранный худший, у него есть оценки, и он все еще среди худших - он и есть худший
          losers.overall = [explicitLoser];
        }
      } else if (lowestPoets.length === 1) {
        // Если только один поэт с минимальным баллом - он худший
        losers.overall = [lowestPoets[0].id];
      }
    }
    
    return losers;
  }, [poets, raterId, calculateScore, categoryLeaders, setCategoryLeader]);
  
  // Проверка дуэли для изменённого поэта
  const checkDuel = useCallback((poetId, changedCategory) => {
    const poet = poets.find(p => p.id === poetId);
    if (!poet) return;
    
    // 1. ПРОВЕРКА КАТЕГОРИИ (если изменилась категория, а не overall напрямую)
    if (changedCategory !== 'overall') {
      const poetCategoryScore = ratings[raterId]?.[poetId]?.[changedCategory] || 0;
      
      // Находим МАКСИМАЛЬНЫЙ балл в этой категории среди ВСЕХ поэтов
      const allScores = poets
        .map(p => ratings[raterId]?.[p.id]?.[changedCategory] || 0)
        .filter(score => score > 0);
      
      if (allScores.length === 0) return;
      const maxScore = Math.max(...allScores);
      
      let currentLeader = categoryLeaders[raterId]?.[changedCategory];
      
      // ВАЖНО: Проверяем, не потерял ли текущий лидер свой статус
      if (currentLeader) {
        const leaderScore = ratings[raterId]?.[currentLeader]?.[changedCategory] || 0;
        if (Math.abs(leaderScore - maxScore) >= 0.01) {
          // Лидер больше не имеет максимального балла → сбрасываем
          setCategoryLeader(raterId, changedCategory, null);
          
          // Автоматически назначаем нового лидера (если есть другой поэт с maxScore)
          const newLeader = poets.find(p => {
            const score = ratings[raterId]?.[p.id]?.[changedCategory] || 0;
            return p.id !== currentLeader && Math.abs(score - maxScore) < 0.01;
          });
          if (newLeader) {
            setCategoryLeader(raterId, changedCategory, newLeader.id);
            currentLeader = newLeader.id; // Обновляем локально для текущей проверки
          } else {
            currentLeader = null; // Сбрасываем локально
          }
        }
      }
      
      // Проверяем только если изменённый поэт претендует на лидерство (его балл == максимальному)
      if (Math.abs(poetCategoryScore - maxScore) < 0.01) {
        const updatedLeader = currentLeader; // Используем локальную переменную
        
        if (updatedLeader && updatedLeader !== poetId) {
          // Есть лидер, баллы равны максимальным → ДУЭЛЬ!
          const leaderPoet = poets.find(p => p.id === updatedLeader);
          if (leaderPoet) {
            setBattleConflict({
              category: changedCategory,
              poet1: leaderPoet,
              poet2: poet,
              isWorstConflict: false
            });
            return; // Дуэль запущена, overall проверится после её завершения
          }
        } else if (!updatedLeader) {
          // Нет лидера, но балл максимальный → автоматически лидер
          setCategoryLeader(raterId, changedCategory, poetId);
        }
        // Если updatedLeader === poetId → он уже лидер, ничего не делаем
      }
      // Если балл поэта < maxScore → он не претендует на лидерство, ничего не делаем
    }
    
    // 2. ПРОВЕРКА OVERALL (лучший по общему баллу)
    const poetOverallScore = calculateScore(raterId, poetId);
    
    // Находим МАКСИМАЛЬНЫЙ общий балл среди ВСЕХ поэтов
    const allOverallScores = poets
      .map(p => calculateScore(raterId, p.id))
      .filter(score => score > 0);
    
    if (allOverallScores.length === 0) return;
    const maxOverallScore = Math.max(...allOverallScores);
    
    let currentOverallLeader = categoryLeaders[raterId]?.['overall'];
    
    // ВАЖНО: Проверяем, не потерял ли текущий лидер overall свой статус
    if (currentOverallLeader) {
      const leaderScore = calculateScore(raterId, currentOverallLeader);
      if (Math.abs(leaderScore - maxOverallScore) >= 0.01) {
        // Лидер больше не имеет максимального балла → сбрасываем
        setCategoryLeader(raterId, 'overall', null);
        
        // Автоматически назначаем нового лидера (если есть другой поэт с maxOverallScore)
        const newLeader = poets.find(p => {
          const score = calculateScore(raterId, p.id);
          return p.id !== currentOverallLeader && Math.abs(score - maxOverallScore) < 0.01;
        });
        if (newLeader) {
          setCategoryLeader(raterId, 'overall', newLeader.id);
          currentOverallLeader = newLeader.id; // Обновляем локально
        } else {
          currentOverallLeader = null; // Сбрасываем локально
        }
      }
    }
    
    // Проверяем только если изменённый поэт претендует на лидерство (его балл == максимальному)
    if (Math.abs(poetOverallScore - maxOverallScore) < 0.01) {
      const updatedOverallLeader = currentOverallLeader; // Используем локальную переменную
      
      if (updatedOverallLeader && updatedOverallLeader !== poetId) {
        // Есть лидер, баллы равны максимальным → ДУЭЛЬ!
        const leaderPoet = poets.find(p => p.id === updatedOverallLeader);
        if (leaderPoet) {
          setBattleConflict({
            category: 'overall',
            poet1: leaderPoet,
            poet2: poet,
            isWorstConflict: false
          });
          return; // Дуэль запущена, worst проверится после её завершения
        }
      } else if (!updatedOverallLeader) {
        // Нет лидера, но балл максимальный → автоматически лидер
        setCategoryLeader(raterId, 'overall', poetId);
      }
      // Если updatedOverallLeader === poetId → он уже лидер, ничего не делаем
    }
    // Если балл поэта < maxOverallScore → он не претендует на лидерство, ничего не делаем
    
    // 3. ПРОВЕРКА WORST (худший по общему баллу, если поэтов > 5)
    const allPoetsWithScores = poets
      .map(p => ({ id: p.id, score: calculateScore(raterId, p.id) }))
      .filter(p => p.score > 0);
    
    if (allPoetsWithScores.length <= 5) return;
    
    // Находим МИНИМАЛЬНЫЙ общий балл среди ВСЕХ поэтов
    const minOverallScore = Math.min(...allPoetsWithScores.map(p => p.score));
    
    let currentWorst = categoryLeaders[raterId]?.['overall_worst'];
    
    // ВАЖНО: Проверяем, не потерял ли текущий худший свой статус
    if (currentWorst) {
      const worstScore = calculateScore(raterId, currentWorst);
      if (Math.abs(worstScore - minOverallScore) >= 0.01) {
        // Худший больше не имеет минимального балла → сбрасываем
        setCategoryLeader(raterId, 'overall_worst', null);
        
        // Автоматически назначаем нового худшего (если есть другой поэт с minOverallScore)
        const newWorst = allPoetsWithScores.find(p => {
          return p.id !== currentWorst && Math.abs(p.score - minOverallScore) < 0.01;
        });
        if (newWorst) {
          setCategoryLeader(raterId, 'overall_worst', newWorst.id);
          currentWorst = newWorst.id; // Обновляем локально
        } else {
          currentWorst = null; // Сбрасываем локально
        }
      }
    }
    
    // Проверяем только если изменённый поэт претендует на "худшее" (его балл == минимальному)
    if (Math.abs(poetOverallScore - minOverallScore) < 0.01) {
      const updatedWorst = currentWorst; // Используем локальную переменную
      
      if (updatedWorst && updatedWorst !== poetId) {
        // Есть худший, баллы равны минимальным → ДУЭЛЬ!
        const worstPoet = poets.find(p => p.id === updatedWorst);
        if (worstPoet) {
          setBattleConflict({
            category: 'overall',
            poet1: worstPoet,
            poet2: poet,
            isWorstConflict: true
          });
        }
      } else if (!updatedWorst) {
        // Нет худшего, но балл минимальный → автоматически худший
        setCategoryLeader(raterId, 'overall_worst', poetId);
      }
      // Если updatedWorst === poetId → он уже худший, ничего не делаем
    }
    // Если балл поэта > minOverallScore → он не претендует на "худшее", ничего не делаем
  }, [poets, ratings, raterId, categoryLeaders, setCategoryLeader, calculateScore]);
  
  // Функция пересчета лидера для категории/награды
  const recalculateLeader = useCallback((awardKey) => {
    if (awardKey === 'overall') {
      // Пересчитываем лучшего поэта
      const poetsWithScores = poets.map(poet => ({
        id: poet.id,
        score: calculateScore(raterId, poet.id)
      })).filter(p => p.score > 0);
      
      if (poetsWithScores.length > 0) {
        poetsWithScores.sort((a, b) => b.score - a.score);
        const topScore = poetsWithScores[0].score;
        const topPoets = poetsWithScores.filter(p => Math.abs(p.score - topScore) < 0.01);
        
        if (topPoets.length === 1) {
          setCategoryLeader(raterId, 'overall', topPoets[0].id);
        } else {
          setCategoryLeader(raterId, 'overall', null);
        }
      } else {
        setCategoryLeader(raterId, 'overall', null);
      }
    } else if (awardKey === 'overall_worst') {
      // Пересчитываем худшего поэта
      const poetsWithScores = poets.map(poet => ({
        id: poet.id,
        score: calculateScore(raterId, poet.id)
      })).filter(p => p.score > 0);
      
      if (poetsWithScores.length > 5) {
        poetsWithScores.sort((a, b) => a.score - b.score);
        const lowestScore = poetsWithScores[0].score;
        const lowestPoets = poetsWithScores.filter(p => Math.abs(p.score - lowestScore) < 0.01);
        
        if (lowestPoets.length === 1) {
          setCategoryLeader(raterId, 'overall_worst', lowestPoets[0].id);
        } else {
          setCategoryLeader(raterId, 'overall_worst', null);
        }
      } else {
        setCategoryLeader(raterId, 'overall_worst', null);
      }
    } else {
      // Пересчитываем категорийную награду
      const poetsWithRatings = poets.map(poet => ({
        id: poet.id,
        rating: ratings[raterId]?.[poet.id]?.[awardKey] || 0
      })).filter(p => p.rating > 0);
      
      if (poetsWithRatings.length > 0) {
        poetsWithRatings.sort((a, b) => b.rating - a.rating);
        const topRating = poetsWithRatings[0].rating;
        const topPoets = poetsWithRatings.filter(p => Math.abs(p.rating - topRating) < 0.01);
        
        if (topPoets.length === 1) {
          setCategoryLeader(raterId, awardKey, topPoets[0].id);
        } else {
          setCategoryLeader(raterId, awardKey, null);
        }
      } else {
        setCategoryLeader(raterId, awardKey, null);
      }
    }
  }, [poets, ratings, raterId, calculateScore, setCategoryLeader]);

  // Обработчик изменения рейтинга
  const handleRatingChange = (poetId, category, newValue) => {
    const oldValue = ratings[raterId]?.[poetId]?.[category] || 0;
    
    updateRating(raterId, poetId, category, newValue);
    changedPoetRef.current = { poetId, category };
    originalPoetIdRef.current = poetId; // Сохраняем изначального поэта
    
    // Если оценка уменьшилась или была сброшена, проверяем награды этого поэта
    if (newValue < oldValue || newValue === 0) {
      // Проверяем категорийную награду
      const categoryLeader = categoryLeaders[raterId]?.[category];
      if (categoryLeader === poetId) {
        // Этот поэт был лидером категории - пересчитываем
        setTimeout(() => {
          recalculateLeader(category);
        }, 100);
      }
      
      // Проверяем общую награду (лучший поэт)
      const overallLeader = categoryLeaders[raterId]?.['overall'];
      if (overallLeader === poetId) {
        // Этот поэт был лучшим - пересчитываем
        setTimeout(() => {
          recalculateLeader('overall');
        }, 100);
      }
      
      // Проверяем худшего поэта
      const worstPoet = categoryLeaders[raterId]?.['overall_worst'];
      if (worstPoet === poetId) {
        // Этот поэт был худшим - пересчитываем
        setTimeout(() => {
          recalculateLeader('overall_worst');
        }, 100);
      }
    }
  };
  
  // Проверяем дуэли после обновления рейтингов
  useEffect(() => {
    if (changedPoetRef.current) {
      const { poetId, category } = changedPoetRef.current;
      changedPoetRef.current = null;
      
      // Небольшая задержка для обновления состояния
      setTimeout(() => {
        checkDuel(poetId, category);
      }, 50);
    }
  }, [ratings, checkDuel]);
  
  // Обработчик завершения дуэли
  const handleBattleSelect = useCallback((winnerId) => {
    if (!battleConflict || !originalPoetIdRef.current) return;
    
    const { category, isWorstConflict } = battleConflict;
    
    // Сохраняем победителя
    const categoryKey = isWorstConflict ? 'overall_worst' : category;
    setCategoryLeader(raterId, categoryKey, winnerId);
    
    setBattleConflict(null);
    
    // Используем изначального поэта для дальнейших проверок
    const originalPoetId = originalPoetIdRef.current;
    
    // Если была дуэль за категорию → проверяем overall
    if (category !== 'overall' && !isWorstConflict) {
      setTimeout(() => {
        checkDuel(originalPoetId, 'overall');
      }, 100);
    }
    // Если была дуэль за overall (за лучшего) → всё завершено (worst уже проверен в checkDuel)
    // Если была дуэль за worst → всё завершено
  }, [battleConflict, raterId, setCategoryLeader, checkDuel]);

  // Обработка перехода со страницы поэта (скролл к карточке и разворачивание)
  useEffect(() => {
    if (location.state?.poetId && poets.length > 0) {
      const poetId = location.state.poetId;
      
      // Проверяем, не выполняли ли мы уже скролл для этого поэта
      if (scrolledToPoetRef.current === poetId) {
        return;
      }
      
      // Если сортировка по общему баллу - разворачиваем карточку
      if (sortBy === 'overall') {
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
  }, [location.state, poets, sortBy]);

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
    } else if (sortBy === 'awards') {
      // На вкладке "Награды" не показываем награды в карточках
      // (там своя структура отображения)
      categoriesToShow = [];
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
      if (isCompact) return null;
      // На чужом рейтинге не показываем пустое сердечко
      if (currentUser !== raterId) return null;
    }
    
    // Кликабельно только если это мой рейтинг (currentUser === raterId) и не компактный режим
    const isClickable = !isCompact && currentUser === raterId;
    
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
        
      </div>

      {sortBy === 'awards' ? (
        // Вкладка "Награды" - показываем награды с победителями
        <div className="awards-list-new">
          <div className="award-winners">
            {[
              { key: 'overall', name: 'Лучший поэт', badge: 'overall.png' },
              { key: 'creativity', name: CATEGORIES.creativity.name, badge: 'creativity.png' },
              { key: 'influence', name: CATEGORIES.influence.name, badge: 'influence.png' },
              { key: 'drama', name: CATEGORIES.drama.name, badge: 'drama.png' },
              { key: 'beauty', name: CATEGORIES.beauty.name, badge: 'beauty.png' },
              { key: 'last', name: 'Худший поэт', badge: 'last.png' }
            ].map(award => {
              // Найти победителей для этой награды
              const winners = award.key === 'last'
                ? (categoryLosers.overall || [])
                : (categoryWinners[award.key] || []);
              
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
                            <img src={poet.imageUrl} alt={poet.name} className="award-winner-avatar" />
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
            }).flat().filter(Boolean)}
          </div>
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
            const isExpanded = expandedCards.includes(poet.id);
            const canExpand = sortBy === 'overall'; // Можно разворачивать только для общего балла

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
                      <img src={poet.imageUrl} alt={poet.name} />
                    </div>
                  )}
                  <div className="poet-name-with-like">
                    <Link 
                      to={`/poet/${poet.id}`} 
                      className="poet-name-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <h3 className="poet-name compact">{poet.name}</h3>
                    </Link>
                    {renderLike(poet.id, true)}
                  </div>
                  
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
                    <img src={poet.imageUrl} alt={poet.name} />
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
                        <h3 className="poet-name">{poet.name}</h3>
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
      )}
      
      {/* Модалка дуэли */}
      {battleConflict && (
        <BattleModal
          poet1={battleConflict.poet1}
          poet2={battleConflict.poet2}
          category={battleConflict.category}
          onSelect={handleBattleSelect}
          onClose={() => setBattleConflict(null)}
          isWorstConflict={battleConflict.isWorstConflict}
        />
      )}
    </div>
  );
};

export default PersonalRanking;