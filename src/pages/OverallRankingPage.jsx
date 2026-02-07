import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { usePoets, CATEGORIES } from '../context/PoetsContext';
import StarRating from '../components/StarRating';
import DuelGame from '../components/DuelGame';
import Tooltip from '../components/Tooltip';
import { generateContent } from '../ai/gemini';
import { generateAITiebreakerPrompt, parseAITiebreaker } from '../ai/prompts';
import './OverallRankingPage.css';

const OverallRankingPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const poetsContext = usePoets();
  const { 
    poets, 
    ratings, 
    categoryLeaders: rawCategoryLeaders, 
    overallDuelWinners: rawOverallDuelWinners, 
    aiChoiceTiebreaker,
    isLoading, 
    getOverallRankings, 
    getCategoryRankings, 
    setOverallDuelWinner,
    setAIChoiceWinner,
    calculateAverageScore
  } = poetsContext;
  
  const [activeTab, setActiveTab] = useState('overall'); // 'overall' or category key
  const [expandedCards, setExpandedCards] = useState(new Set()); // ID развернутых карточек для overall
  const [animatingPoet, setAnimatingPoet] = useState(null); // ID поэта, который анимируется
  const [showScore, setShowScore] = useState(false); // Показывать ли балл во время анимации
  const [animationStep, setAnimationStep] = useState(0); // Текущая позиция анимирующего поэта в списке (0 = первое место, N-1 = последнее место)
  const animatingCardRef = useRef(null); // Ref для анимирующейся карточки
  const animationFrameId = useRef(null); // ID для requestAnimationFrame
  const animationTimeouts = useRef([]); // Массив ID таймаутов для очистки
  const [gameConflict, setGameConflict] = useState(null); // { category, poet1, poet2 }
  
  // Функция форматирования общего балла пользователя (2 знака после запятой)
  const formatScore = useCallback((score) => {
    // Математическое округление (2.965 → 2.97)
    return (Math.round(score * 100) / 100).toFixed(2);
  }, []);

  // Функция форматирования среднего балла (2 знака после запятой)
  const formatAverageScore = useCallback((score) => {
    // Математическое округление (2.965 → 2.97)
    return (Math.round(score * 100) / 100).toFixed(2);
  }, []);
  
  // Получаем текущего пользователя из localStorage
  const currentUser = localStorage.getItem('currentUser');
  
  // Просто используем данные напрямую из контекста
  // Firebase уже оптимизирован и не будет создавать новые объекты если данные не изменились
  const categoryLeaders = rawCategoryLeaders || { maxim: {}, oleg: {} };
  const overallDuelWinners = rawOverallDuelWinners || {};
  
  // Найти самого последнего оцененного поэта за последние 24 часа
  const getNewestPoet = () => {
    if (poets.length === 0) return null;

    const now = new Date();
    
    const poetsLast24h = poets.filter(poet => {
      // Проверяем наличие firstRatedAt (момент получения первой оценки)
      if (!poet.firstRatedAt) return false;

      const ratedDate = new Date(poet.firstRatedAt);
      const hoursDiff = (now - ratedDate) / (1000 * 60 * 60);
      return hoursDiff <= 1;
    });

    if (poetsLast24h.length === 0) return null;

    // Найти поэта с самым свежим firstRatedAt
    return poetsLast24h.reduce((latest, current) => {
      return new Date(current.firstRatedAt) > new Date(latest.firstRatedAt) ? current : latest;
    });
  };

  const newestPoet = getNewestPoet();
  
  // Проверка, является ли поэт самым новым
  const isNewestPoet = (poet) => {
    return newestPoet && poet.id === newestPoet.id;
  };
  
  // Переключение развертывания карточки для overall
  const toggleCardExpansion = (poetId) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(poetId)) {
        newSet.delete(poetId);
      } else {
        newSet.add(poetId);
      }
      return newSet;
    });
  };
  
  // Подсчет баллов "Выбор читателей" для поэта
  const calculateReadersChoiceScore = useCallback((poetId) => {
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
  }, [poets]);
  
  // Статистика стихов поэта (для отображения)
  const getPoemStats = useCallback((poetId) => {
    const poet = poets.find(p => p.id === poetId);
    if (!poet || !poet.poems) return { viewed: 0, liked: 0, memorized: 0 };
    
    const poemsArray = Object.values(poet.poems);
    
    return {
      viewed: poemsArray.reduce((sum, p) => sum + (p.viewed?.maxim ? 1 : 0) + (p.viewed?.oleg ? 1 : 0), 0),
      liked: poemsArray.reduce((sum, p) => sum + (p.liked?.maxim ? 1 : 0) + (p.liked?.oleg ? 1 : 0), 0),
      memorized: poemsArray.reduce((sum, p) => sum + (p.memorized?.maxim ? 1 : 0) + (p.memorized?.oleg ? 1 : 0), 0)
    };
  }, [poets]);
  
  // Подсчет AI-рейтинга для поэта (средневзвешенное по категориям)
  const calculateAIScore = useCallback((poetId) => {
    const poet = poets.find(p => p.id === poetId);
    if (!poet || !poet.aiRatings) return 0;
    
    const aiRatings = poet.aiRatings;
    
    // Используем те же коэффициенты что и для обычных оценок
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
    
    // Возвращаем средневзвешенное
    return totalCoefficient > 0 ? score / totalCoefficient : 0;
  }, [poets]);
  
  // Функция проверки и разрешения ничьей для "Выбор ИИ"
  const checkAIChoiceTiebreaker = useCallback(async () => {
    // Подсчитываем AI-баллы для всех поэтов с оценками (и AI, и общими)
    const aiRankings = poets
      .map(poet => ({
        poet,
        score: calculateAIScore(poet.id),
        overallScore: calculateAverageScore(poet.id)
      }))
      .filter(item => item.score > 0 && item.overallScore > 0) // Только с AI-оценками И общим баллом
      .sort((a, b) => b.score - a.score);
    
    if (aiRankings.length === 0) return;
    
    // Определяем топовый балл и всех поэтов с этим баллом
    const topScore = aiRankings[0].score;
    const topPoets = aiRankings.filter(p => Math.abs(p.score - topScore) < 0.001); // Допуск для float
    
    // Если только один поэт с максимальным баллом - тайбрейкер не нужен
    if (topPoets.length === 1) {
      // Если тайбрейкер существует, но больше не актуален - удаляем его
      if (aiChoiceTiebreaker) {
        await setAIChoiceWinner(null, [], 0);
      }
      return;
    }
    
    // Есть несколько поэтов с одинаковым баллом - нужен тайбрейкер
    const topPoetIds = topPoets.map(p => p.poet.id).sort();
    
    // Проверяем, нужно ли запускать новый тайбрейкер
    const needNewTiebreaker = 
      !aiChoiceTiebreaker || // Тайбрейкера еще нет
      Math.abs(aiChoiceTiebreaker.topScore - topScore) > 0.001 || // Балл изменился
      JSON.stringify(aiChoiceTiebreaker.participants.sort()) !== JSON.stringify(topPoetIds); // Состав изменился
    
    if (!needNewTiebreaker) return;
    
    // Запускаем AI-тайбрейкер
    console.log('🤖 Запуск AI-тайбрейкера для выбора победителя среди:', topPoets.map(p => p.poet.name));
    
    try {
      const prompt = generateAITiebreakerPrompt(topPoets.map(p => p.poet));
      const response = await generateContent(prompt, 0.7); // Немного креативности для выбора
      const winnerId = parseAITiebreaker(response, topPoets.map(p => p.poet));
      
      if (winnerId) {
        console.log('✅ AI выбрал победителя:', poets.find(p => p.id === winnerId)?.name);
        await setAIChoiceWinner(winnerId, topPoetIds, topScore);
      } else {
        console.warn('⚠️ AI не смог определить победителя');
        // Используем первого в списке как fallback
        await setAIChoiceWinner(topPoetIds[0], topPoetIds, topScore);
      }
    } catch (error) {
      console.error('❌ Ошибка при запуске AI-тайбрейкера:', error);
      // Используем первого в списке как fallback
      await setAIChoiceWinner(topPoetIds[0], topPoetIds, topScore);
    }
  }, [poets, aiChoiceTiebreaker, calculateAIScore, calculateAverageScore, setAIChoiceWinner]);
  
  // Запускаем тайбрейкер только при открытии вкладки "Выбор ИИ"
  useEffect(() => {
    if (activeTab === 'ai-choice' && !isLoading && poets.length > 0) {
      checkAIChoiceTiebreaker();
    }
  }, [activeTab, isLoading, poets.length, checkAIChoiceTiebreaker]);
  
  // Предварительно рассчитываем все рейтинги категорий (ОПТИМИЗАЦИЯ)
  // Зависим напрямую от poets и ratings, а не от функции getCategoryRankings
  const allCategoryRankings = useMemo(() => {
    const rankings = {};
    Object.keys(CATEGORIES).forEach(category => {
      rankings[category] = getCategoryRankings(category);
    });
    return rankings;
  }, [poets, ratings, getCategoryRankings]); // Добавили poets и ratings для явности
  
  // Мемоизируем overallRankings для оптимизации (ДОЛЖНО БЫТЬ ДО useEffect)
  const overallRankings = useMemo(() => getOverallRankings(), [getOverallRankings]);
  
  // Обнаружение конфликтов между Максимом и Олегом
  const detectConflicts = useMemo(() => {
    const conflicts = [];
    
    Object.keys(CATEGORIES).forEach(category => {
      const maximLeader = categoryLeaders.maxim?.[category];
      const olegLeader = categoryLeaders.oleg?.[category];
      
      // Конфликт возникает ТОЛЬКО если:
      // 1. У двух+ поэтов одинаковый МАКСИМАЛЬНЫЙ средний балл
      // 2. Максим и Олег выбрали разных победителей
      
      // Если они выбрали одного и того же - нет конфликта
      if (!maximLeader || !olegLeader || maximLeader === olegLeader) {
        return;
      }
      
      // Получаем рейтинги для этой категории (из кэша)
      const categoryRankings = allCategoryRankings[category];
      
      if (categoryRankings.length === 0) return;
      
      // Находим максимальный средний балл
      const maxScore = categoryRankings[0].averageRating;
      
      // Находим всех поэтов с максимальным баллом
      const topPoets = categoryRankings.filter(
        item => Math.abs(item.averageRating - maxScore) < 0.01
      );
      
      // Конфликт только если >= 2 поэтов с максимальным баллом
      if (topPoets.length < 2) {
        return;
      }
      
      // Проверяем, что выбранные лидеры действительно в топе
      const maximLeaderInTop = topPoets.some(item => item.poet.id === maximLeader);
      const olegLeaderInTop = topPoets.some(item => item.poet.id === olegLeader);
      
      if (maximLeaderInTop && olegLeaderInTop) {
        // Оба выбрали разных поэтов из топа
        // Проверяем, была ли уже дуэль между ЭТИМИ ДВУМЯ поэтами
        const duelWinner = overallDuelWinners?.[category];
        
        if (duelWinner) {
          // Дуэль была. Проверяем:
          // 1. Победитель все еще в топе
          // 2. Текущий конфликт между теми же двумя поэтами, что и в предыдущей дуэли
          const duelData = overallDuelWinners[category];
          const winnerId = duelData.winner || duelData; // Для обратной совместимости
          const duelParticipants = duelData.participants || []; // Участники предыдущей дуэли
          
          const isWinnerInTop = topPoets.some(item => item.poet.id === winnerId);
          
          if (isWinnerInTop && duelParticipants.length === 2) {
            // Победитель все еще в топе, и мы знаем участников предыдущей дуэли
            // Проверяем, что текущий конфликт между теми же двумя поэтами
            const currentParticipants = [maximLeader, olegLeader].sort();
            const isSameDuel = 
              currentParticipants[0] === duelParticipants[0] &&
              currentParticipants[1] === duelParticipants[1];
            
            if (isSameDuel) {
              // Дуэль уже была между этими двумя поэтами - конфликта нет
              return;
            }
            // Иначе - новый поэт в конфликте (один из лидеров изменился), нужна новая дуэль
          }
        }
        
        // Дуэли не было или ситуация изменилась - это КОНФЛИКТ!
        const poet1 = poets.find(p => p.id === maximLeader);
        const poet2 = poets.find(p => p.id === olegLeader);
        
        if (poet1 && poet2) {
          conflicts.push({
            category,
            categoryName: CATEGORIES[category].name,
            poet1,
            poet2,
            score: maxScore
          });
        }
      }
    });
    
    return conflicts;
  }, [poets, categoryLeaders, overallDuelWinners, allCategoryRankings]);
  
  // Запуск игры для разрешения конфликта
  const startDuelGame = (conflict) => {
    setGameConflict(conflict);
  };
  
  // Обработка завершения игры
  const handleGameEnd = (winnerPoet) => {
    if (!gameConflict) return;
    
    const { category, poet1, poet2 } = gameConflict;
    
    // Победитель игры становится победителем дуэли для общего рейтинга
    // Сохраняем и победителя, и обоих участников дуэли
    // Это НЕ влияет на персональные выборы Максима и Олега
    setOverallDuelWinner(category, winnerPoet.id, poet1.id, poet2.id);
    
    // Закрываем игру
    setGameConflict(null);
  };

  // Обработка перехода со страницы поэта (раскрытие карточки и скролл)
  useEffect(() => {
    if (location.state?.poetId) {
      const poetId = location.state.poetId;
      
      // Переключаемся на вкладку overall
      setActiveTab('overall');
      
      // Разворачиваем карточку
      setExpandedCards(new Set([poetId]));
      
      // Скроллим к карточке после небольшой задержки (чтобы DOM обновился)
      setTimeout(() => {
        const cardElement = document.querySelector(`[data-poet-id="${poetId}"]`);
        if (cardElement) {
          cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
      
      // Очищаем state после обработки
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);
  
  // Проверяем, показывали ли уже анимацию этому пользователю (навсегда)
  useEffect(() => {
    // Не запускаем анимацию, пока данные загружаются
    if (isLoading || !newestPoet) {
      return;
    }

    // Включаем firstRatedAt в ключ, чтобы анимация показывалась заново при переоценке
    const animationKey = `animation_shown_${currentUser}_${newestPoet.id}_${newestPoet.firstRatedAt}`;
    const animationShown = localStorage.getItem(animationKey);

    if (!animationShown) {
      // Сразу устанавливаем анимирующего поэта (плашка будет видна на первом месте)
      setAnimatingPoet(newestPoet.id);
      setShowScore(false);
      setAnimationStep(0);
      
      // Скроллим к блоку с табами (после небольшой задержки, чтобы элементы отрендерились)
      setTimeout(() => {
        const tabsBlock = document.querySelector('.tabs');
        if (tabsBlock) {
          tabsBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
      
      // Находим индекс нового поэта в рейтинге (используем кэш)
      const rankings = activeTab === 'overall' ? overallRankings : allCategoryRankings[activeTab];
      const poetIndex = rankings.findIndex(item => item.poet.id === newestPoet.id);
      
      // Если поэт всего один - не запускаем анимацию
      if (rankings.length === 1) {
        setAnimatingPoet(null);
        setShowScore(true);
        localStorage.setItem(animationKey, 'true');
        return;
      }
      
      const totalPoets = rankings.length;
      
      // НОВАЯ АНИМАЦИЯ: Поэт хаотично перемещается по списку
      const startPos = 0; // Всегда начинаем с самого верха
      const target = poetIndex; // Целевая позиция
      
      // 1. Определяем общее количество разрешённых шагов (2N - 4N)
      const minSteps = totalPoets * 2;
      const maxSteps = totalPoets * 4;
      let allowedSteps = Math.floor(Math.random() * (maxSteps - minSteps + 1)) + minSteps;
      
      // 2. Генерируем путь с хаотичными прыжками
      const generatePath = () => {
        const path = [];
        let currentPos = startPos;
        let remainingSteps = allowedSteps;
        
        // Добавляем стартовую позицию
        path.push(currentPos);
        
        // Генерируем случайные прыжки, пока возможно
        while (true) {
          // Генерируем случайную новую позицию
          let newPos;
          
          // Первый прыжок - только вниз
          if (currentPos === startPos && path.length === 1) {
            newPos = Math.floor(Math.random() * totalPoets);
            if (newPos === 0) newPos = 1; // Не остаёмся на месте
          } else {
            // Любая случайная позиция в списке
            newPos = Math.floor(Math.random() * totalPoets);
          }
          
          // Считаем шаги для этого прыжка
          const stepsToNew = Math.abs(newPos - currentPos);
          
          // Считаем шаги от новой позиции до цели
          const stepsToTarget = Math.abs(target - newPos);
          
          // Проверяем: хватит ли шагов для прыжка и возврата к цели?
          if (stepsToNew + stepsToTarget <= remainingSteps) {
            // Добавляем все промежуточные шаги
            const direction = newPos > currentPos ? 1 : -1;
            for (let i = 1; i <= stepsToNew; i++) {
              currentPos += direction;
              path.push(currentPos);
            }
            
            remainingSteps -= stepsToNew;
          } else {
            // Не хватает шагов - делаем финальный прыжок к цели
            const direction = target > currentPos ? 1 : -1;
            while (currentPos !== target) {
              currentPos += direction;
              path.push(currentPos);
            }
            break;
          }
        }
        
        return path;
      };
      
      const path = generatePath();
      const stepDelay = 400; // 400мс на каждый шаг
      const totalDuration = path.length * stepDelay; // Общая длительность анимации
      
      // Через небольшую задержку запускаем пошаговое движение
      const startTimeoutId = setTimeout(() => {
        let currentIndex = 0;
        
        const showNextStep = () => {
          if (currentIndex < path.length) {
            setAnimationStep(path[currentIndex]);
            currentIndex++;
            
            // Планируем следующий шаг
            const timeoutId = setTimeout(showNextStep, stepDelay);
            animationTimeouts.current.push(timeoutId);
          }
        };
        
        showNextStep();
      }, 1000);
      
      animationTimeouts.current.push(startTimeoutId);
      
      // После окончания анимации показываем балл и разворачиваем карточку
      const endTimeoutId = setTimeout(() => {
        setShowScore(true);
        
        // Разворачиваем карточку нового поэта
        setExpandedCards(prev => {
          const newSet = new Set(prev);
          newSet.add(newestPoet.id);
          return newSet;
        });
        
        setAnimatingPoet(null);
        setAnimationStep(0);
        localStorage.setItem(animationKey, 'true');
      }, 1000 + totalDuration + 1000);
      
      animationTimeouts.current.push(endTimeoutId);
    }
  }, [isLoading, newestPoet, activeTab, overallRankings, allCategoryRankings, currentUser]);

  // Очистка таймеров и анимаций при размонтировании компонента
  useEffect(() => {
    return () => {
      // Отменяем requestAnimationFrame если он был
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      
      // Очищаем все таймауты
      animationTimeouts.current.forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
      animationTimeouts.current = [];
    };
  }, []);

  // Автоматический скролл к анимирующемуся поэту (только если вышел за пределы viewport)
  useEffect(() => {
    if (!animatingPoet || !animatingCardRef.current) return;
    
    const element = animatingCardRef.current;
    const rect = element.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    
    // Проверяем, виден ли элемент на экране
    const isVisible = (
      rect.top >= 0 && 
      rect.bottom <= windowHeight
    );
    
    // Скроллим только если элемент не виден
    if (!isVisible) {
      element.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' // Центрируем элемент на экране
      });
    }
  }, [animationStep, animatingPoet]); // Срабатывает при каждом изменении позиции

  // ======== ВСЕ HOOKS ДОЛЖНЫ БЫТЬ ПЕРЕД УСЛОВНЫМ RETURN ========
  
  // Определяем победителей в каждой категории (1-е место)
  // ДОЛЖНО БЫТЬ ДО categoryRankings!
  const categoryWinners = useMemo(() => {
    const winners = {
      overall: [],
      creativity: [],
      influence: [],
      drama: [],
      beauty: []
    };
    
    // Победитель по общему баллу определяется по максимальному баллу,
    // а при равенстве - по количеству категорийных наград
    if (overallRankings.length > 0) {
      const topScore = overallRankings[0].averageScore;
      const topPoets = overallRankings.filter(r => Math.abs(r.averageScore - topScore) < 0.01);
      
      if (topPoets.length === 1) {
        winners.overall = [topPoets[0].poet.id];
      } else {
        // Несколько поэтов с одинаковым баллом - считаем количество категорийных наград
        // (сначала нужно определить победителей по категориям, поэтому это в конце)
      }
    }
    
    // Победители по категориям
    ['creativity', 'drama', 'influence', 'beauty'].forEach(category => {
      // Находим поэтов с максимальным средним баллом (используем кэш)
      const rankings = allCategoryRankings[category];
      if (rankings.length === 0) return;
      
      const topScore = rankings[0].averageRating;
      const topPoets = rankings.filter(r => Math.abs(r.averageRating - topScore) < 0.01);
      
      // Если только один поэт с топовым баллом - он безусловный победитель
      if (topPoets.length === 1) {
        winners[category] = [topPoets[0].poet.id];
        return;
      }
      
      // Если несколько поэтов с одинаковым топовым баллом
      // Сначала смотрим на персональных победителей
      const maximLeader = categoryLeaders.maxim?.[category];
      const olegLeader = categoryLeaders.oleg?.[category];
      
      // Проверяем, кто из лидеров находится в топе по баллам
      const maximLeaderInTop = maximLeader && topPoets.some(p => p.poet.id === maximLeader);
      const olegLeaderInTop = olegLeader && topPoets.some(p => p.poet.id === olegLeader);
      
      // Если Максим и Олег оба выбрали одного и того же поэта, и он среди топовых - он победитель
      if (maximLeader && olegLeader && maximLeader === olegLeader && maximLeaderInTop) {
        winners[category] = [maximLeader];
        return;
      }
      
      // Если только у Максима есть лидер в топе - он победитель
      if (maximLeaderInTop && !olegLeaderInTop) {
        winners[category] = [maximLeader];
        return;
      }
      
      // Если только у Олега есть лидер в топе - он победитель
      if (olegLeaderInTop && !maximLeaderInTop) {
        winners[category] = [olegLeader];
        return;
      }
      
      // Если у обоих разные лидеры в топе - проверяем результат дуэли
      if (maximLeaderInTop && olegLeaderInTop && maximLeader !== olegLeader) {
        const duelData = overallDuelWinners?.[category];
        if (duelData) {
          const winnerId = duelData.winner || duelData; // Для обратной совместимости
          const isWinnerInTop = topPoets.some(p => p.poet.id === winnerId);
          if (isWinnerInTop) {
            winners[category] = [winnerId];
            return;
          }
        }
        // Если дуэли нет - конфликт
        winners[category] = [];
        return;
      }
      
      // Если никто не выбрал лидера - конфликт
      winners[category] = [];
    });
    
    // Теперь определяем победителя по overall с учетом категорийных наград
    if (overallRankings.length > 0) {
      const topScore = overallRankings[0].averageScore;
      const topPoets = overallRankings.filter(r => Math.abs(r.averageScore - topScore) < 0.01);
      
      if (topPoets.length > 1 && winners.overall.length === 0) {
        // Сначала проверяем персональных лидеров
        const maximLeader = categoryLeaders.maxim?.['overall'];
        const olegLeader = categoryLeaders.oleg?.['overall'];
        
        const maximLeaderInTop = maximLeader && topPoets.some(p => p.poet.id === maximLeader);
        const olegLeaderInTop = olegLeader && topPoets.some(p => p.poet.id === olegLeader);
        
        // Если оба выбрали одного и того же - он победитель
        if (maximLeader && olegLeader && maximLeader === olegLeader && maximLeaderInTop) {
          winners.overall = [maximLeader];
          return winners;
        }
        
        // Если только у Максима есть лидер в топе - он победитель
        if (maximLeaderInTop && !olegLeaderInTop) {
          winners.overall = [maximLeader];
          return winners;
        }
        
        // Если только у Олега есть лидер в топе - он победитель
        if (olegLeaderInTop && !maximLeaderInTop) {
          winners.overall = [olegLeader];
          return winners;
        }
        
        // Если у обоих разные лидеры - проверяем дуэль
        if (maximLeaderInTop && olegLeaderInTop && maximLeader !== olegLeader) {
          const duelWinner = overallDuelWinners?.overall;
          if (duelWinner) {
            const isWinnerInTop = topPoets.some(p => p.poet.id === duelWinner);
            if (isWinnerInTop) {
              winners.overall = [duelWinner];
              return winners;
            }
          }
          // Если дуэли нет - конфликт
          winners.overall = [];
          return winners;
        }
        
        // Если никто не назначил лидера - считаем количество категорийных наград
        const poetsWithBadgeCount = topPoets.map(poet => {
          const badgeCount = ['creativity', 'drama', 'influence', 'beauty'].filter(
            cat => winners[cat] && winners[cat].includes(poet.poet.id)
          ).length;
          return { id: poet.poet.id, badgeCount };
        });
        
        // Сортируем по количеству наград
        poetsWithBadgeCount.sort((a, b) => b.badgeCount - a.badgeCount);
        const maxBadges = poetsWithBadgeCount[0].badgeCount;
        const poetsWithMaxBadges = poetsWithBadgeCount.filter(p => p.badgeCount === maxBadges);
        
        // Если только один поэт с максимальным количеством наград - он победитель
        winners.overall = poetsWithMaxBadges.length === 1 ? [poetsWithMaxBadges[0].id] : [];
      }
    }
    
    return winners;
  }, [poets, ratings, categoryLeaders, overallDuelWinners, allCategoryRankings, overallRankings]);

  // Определяем худшего по общему баллу
  const categoryLosers = useMemo(() => {
    const losers = {
      overall: []
    };
    
    // Худший только по общему баллу (с минимальным средним баллом)
    // Награда выдается только если в рейтинге больше 3 поэтов
    if (overallRankings.length > 3) {
      const lowestScore = overallRankings[overallRankings.length - 1].averageScore;
      const lowestPoets = overallRankings.filter(r => Math.abs(r.averageScore - lowestScore) < 0.01);
      
      // Если только один поэт с минимальным баллом - он худший
      if (lowestPoets.length === 1) {
        losers.overall = [lowestPoets[0].poet.id];
      } else if (lowestPoets.length > 1) {
        // Если несколько поэтов с одинаковым минимальным баллом
        // Сначала проверяем персональных худших
        const maximLoser = categoryLeaders.maxim?.['overall_worst'];
        const olegLoser = categoryLeaders.oleg?.['overall_worst'];
        
        const maximLoserInBottom = maximLoser && lowestPoets.some(p => p.poet.id === maximLoser);
        const olegLoserInBottom = olegLoser && lowestPoets.some(p => p.poet.id === olegLoser);
        
        // Если оба выбрали одного и того же - он худший
        if (maximLoser && olegLoser && maximLoser === olegLoser && maximLoserInBottom) {
          losers.overall = [maximLoser];
        } else if (maximLoserInBottom && !olegLoserInBottom) {
          // Если только у Максима есть худший в нижних - он худший
          losers.overall = [maximLoser];
        } else if (olegLoserInBottom && !maximLoserInBottom) {
          // Если только у Олега есть худший в нижних - он худший
          losers.overall = [olegLoser];
        } else if (maximLoserInBottom && olegLoserInBottom && maximLoser !== olegLoser) {
          // Если у обоих разные - проверяем дуэль
          const duelLoser = overallDuelWinners?.overall_worst;
          if (duelLoser && lowestPoets.some(p => p.poet.id === duelLoser)) {
            losers.overall = [duelLoser];
          }
        }
      }
    }
    
    return losers;
  }, [overallRankings]);
  
  // Для категорий добавляем дополнительную сортировку с учетом победителей
  const categoryRankings = useMemo(() => {
    if (activeTab === 'overall') return null;
    
    const rankings = allCategoryRankings[activeTab] || [];
    
    // Получаем победителя категории из categoryWinners (учитывает дуэли!)
    const winner = categoryWinners[activeTab]?.[0];
    
    // Сортируем с учетом победителя: при одинаковых баллах победитель выше
    return [...rankings].sort((a, b) => {
      // Сначала по баллу (как обычно)
      const scoreDiff = b.averageRating - a.averageRating;
      if (Math.abs(scoreDiff) > 0.01) return scoreDiff;
      
      // Если баллы равны, то победитель должен быть первым
      if (winner) {
        if (a.poet.id === winner) return -1;
        if (b.poet.id === winner) return 1;
      }
      
      return 0;
    });
  }, [activeTab, allCategoryRankings, categoryWinners]);
  
  const currentRankings = activeTab === 'overall' ? overallRankings : categoryRankings;
  
  // Пересортировываем overall с учетом победителя
  const sortedOverallRankings = useMemo(() => {
    if (activeTab !== 'overall') return overallRankings;
    
    const overallWinner = categoryWinners.overall?.[0];
    if (!overallWinner) return overallRankings;
    
    // Сортируем: победитель с главной наградой выше при равных баллах
    return [...overallRankings].sort((a, b) => {
      const scoreDiff = b.averageScore - a.averageScore;
      if (Math.abs(scoreDiff) > 0.01) return scoreDiff;
      
      // При равных баллах победитель выше
      if (a.poet.id === overallWinner) return -1;
      if (b.poet.id === overallWinner) return 1;
      
      return 0;
    });
  }, [overallRankings, categoryWinners, activeTab]);
  
  // ======== УСЛОВНЫЙ RETURN ПОСЛЕ ВСЕХ HOOKS ========
  // Пока загружается - показываем пустой контейнер (без мигания empty state)
  if (isLoading) {
    return <div className="overall-ranking"></div>;
  }
  
  if (poets.length === 0) {
    return (
      <div className="overall-ranking">
        <div className="empty-state">
          <img src="/images/poet2.png" alt="Нет поэтов" className="empty-icon" />
          <p>Нет поэтов для отображения рейтинга</p>
          <p className="empty-hint">Добавьте поэтов на странице "Поэты"</p>
        </div>
      </div>
    );
  }
  
  // Обновляем currentRankings с учетом пересортированного overall
  const finalRankings = activeTab === 'overall' ? sortedOverallRankings : currentRankings;
  
  // Функция для отображения бейджей победителя и худшего
  const renderWinnerBadges = (poetId) => {
    const badges = [];
    
    // Определяем, какие награды показывать в зависимости от активной вкладки
    let categoriesToShow = [];
    
    if (activeTab === 'overall') {
      // На вкладке "Общий балл" показываем ВСЕ награды
      categoriesToShow = ['overall', 'creativity', 'drama', 'influence', 'beauty'];
    } else if (activeTab === 'readers-choice' || activeTab === 'ai-choice') {
      // На вкладках "Выбор читателей" и "Выбор ИИ" не показываем награды в карточках
      // (там своя структура отображения)
      categoriesToShow = [];
    } else {
      // На вкладке конкретной категории показываем ТОЛЬКО награду этой категории
      categoriesToShow = [activeTab];
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
    
    // Награда "Выбор читателей" - показываем только на вкладке "Общий балл"
    if (activeTab === 'overall') {
      const readersRankings = poets
        .map(poet => ({
          id: poet.id,
          score: calculateReadersChoiceScore(poet.id)
        }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score);
      
      if (readersRankings.length > 0 && readersRankings[0].id === poetId) {
        badges.push(
          <img 
            key="readers-choice"
            src={`/images/badges/readers-choice.png`}
            alt="Выбор читателей"
            className="winner-badge"
          />
        );
      }
    }
    
    // Награда "Выбор ИИ" - показываем только на вкладке "Общий балл"
    if (activeTab === 'overall') {
      let aiWinnerId = null;

      // Если есть результат тайбрейкера - используем его
      if (aiChoiceTiebreaker && aiChoiceTiebreaker.winner) {
        aiWinnerId = aiChoiceTiebreaker.winner;
      } else {
        // Иначе определяем победителя по максимальному баллу (только среди оцененных поэтов)
        const aiRankings = poets
          .map(poet => ({
            id: poet.id,
            score: calculateAIScore(poet.id),
            overallScore: calculateAverageScore(poet.id)
          }))
          .filter(item => item.score > 0 && item.overallScore > 0) // Только с AI И общим баллом
          .sort((a, b) => b.score - a.score);

        if (aiRankings.length > 0) {
          aiWinnerId = aiRankings[0].id;
        }
      }
      
      if (aiWinnerId === poetId) {
        badges.push(
          <img 
            key="ai-choice"
            src={`/images/badges/ai-choice.png`}
            alt="Выбор ИИ"
            className="winner-badge"
          />
        );
      }
    }
    
    // Награда за последнее место (худший) - показываем только на вкладке "Общий балл"
    if (activeTab === 'overall' && categoryLosers.overall && categoryLosers.overall.includes(poetId)) {
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

  // Вычисляем ранги с учетом одинаковых значений
  const calculateRanks = (rankings, isOverall = true) => {
    // Защита от null/undefined rankings
    if (!rankings || !Array.isArray(rankings)) return [];
    
    const ranks = [];
    let currentRank = 1;

    for (let i = 0; i < rankings.length; i++) {
      const currentValue = isOverall 
        ? rankings[i].averageScore 
        : rankings[i].averageRating;
      
      if (i === 0) {
        ranks.push(currentRank);
      } else {
        const prevValue = isOverall
          ? rankings[i - 1].averageScore
          : rankings[i - 1].averageRating;
        
        // Если значения разные, обновляем ранг
        if (Math.abs(currentValue - prevValue) >= 0.01) {
          currentRank = i + 1;
        }
        ranks.push(currentRank);
      }
    }
    
    return ranks;
  };

  const ranks = calculateRanks(finalRankings, activeTab === 'overall');

  return (
    <div className="overall-ranking">
      {/* <div className="page-header-overall">
        <h1 className="page-title-overall">
        <span className="trophy-decoration">🏆</span>

          Общий Рейтинг
        </h1>
      </div> */}
      
      {/* Блок конфликтов */}
      {detectConflicts.length > 0 && (
        <div className="conflicts-block">
          <h3 className="conflicts-title">Критики не сошлись во мнении — пусть судьба решит.</h3>

          <div className="conflicts-list">
            {detectConflicts.map((conflict) => (
              <div key={conflict.category} className="conflict-item" data-category={conflict.category}>
                <div className="conflict-info">
                  <span className="conflict-category">{conflict.categoryName}:</span>
                  <span className="conflict-poets">
                    {conflict.poet1.name} VS {conflict.poet2.name}
                  </span>
                </div>
                <button
                  className="start-game-btn"
                  onClick={() => startDuelGame(conflict)}
                >
                  Дуэль
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === 'overall' ? 'active' : ''}`}
          onClick={() => setActiveTab('overall')}
        >
          {/* <img 
            src="/images/badges/overall.png" 
            alt="Общий балл"
            className="tab-category-icon"
          /> */}
          Общий балл
        </button>
        {Object.entries(CATEGORIES).map(([key, cat]) => (
        
            <button key={key}
              className={`tab-btn ${activeTab === key ? 'active' : ''}`}
              onClick={() => setActiveTab(key)}
            >
              {/* <img 
                src={`/images/badges/${key}.png`} 
                alt={cat.name}
                className="tab-category-icon"
              /> */}
              {cat.name}
            </button>
      
        ))}
        
        {/* Вкладка "Награды" - отделена от других */}
        <button
          className={`tab-btn tab-btn-readers ${activeTab === 'readers-choice' ? 'active' : ''}`}
          onClick={() => setActiveTab('readers-choice')}
        >
          Выбор читателей
        </button>
        
        <button
          className={`tab-btn ${activeTab === 'ai-choice' ? 'active' : ''}`}
          onClick={() => setActiveTab('ai-choice')}
        >
          Выбор ИИ
        </button>
      </div>

      {activeTab === 'readers-choice' ? (
        // Вкладка "Выбор читателей" - показываем рейтинг по взаимодействию со стихами
        <div className="category-list">
          {(() => {
            // Подсчитываем баллы для всех поэтов
            const readersRankings = poets
              .map(poet => ({
                poet,
                score: calculateReadersChoiceScore(poet.id),
                stats: getPoemStats(poet.id)
              }))
              .filter(item => item.score > 0) // Только поэты с баллами
              .sort((a, b) => b.score - a.score); // Сортируем по убыванию
            
            if (readersRankings.length === 0) {
              return (
                <div className="empty-state">
                  <p>Пока нет взаимодействий со стихами</p>
                </div>
              );
            }
            
            // Определяем победителя (первый в списке)
            const winnerId = readersRankings[0]?.poet?.id || null;
            
            return readersRankings.map((item, index) => {
              const { poet, score, stats } = item;
              const rank = index + 1;
              const isWinner = index === 0;
              
              return (
                <div 
                  key={poet.id}
                  className="category-rank-card compact"
                >
                  <span className="category-rank-number compact">#{rank}</span>
                  
                  {poet.imageUrl && (
                    <div className="overall-avatar compact">
                      <img 
                        src={poet.imageUrl} 
                        alt={poet.name}
                        style={{ 
                          objectPosition: `center ${poet.imagePositionY !== undefined ? poet.imagePositionY : 25}%`
                        }}
                      />
                    </div>
                  )}
                  
                  <Link to={`/poet/${poet.id}`} className="category-poet-name-link">
                    <h3 className="category-poet-name compact">{poet.name}</h3>
                  </Link>
                  
                  <div className="overall-card-right-section">
                    {isWinner && (
                      <div className="winner-badges">
                        <img 
                          src="/images/badges/readers-choice.png" 
                          alt="Выбор читателей"
                          className="winner-badge"
                        />
                      </div>
                    )}
                    
                    <div className="scores-compact-row">
                      {/* Статистика стихов */}
                      <div className="readers-stats-inline">
                        <div className="readers-stat-mini">
                          <img src="/images/viewed.png" alt="Просмотрено" />
                          <span>{stats.viewed}</span>
                        </div>
                        <div className="readers-stat-mini">
                          <img src="/images/like.png" alt="Лайков" />
                          <span>{stats.liked}</span>
                        </div>
                        <div className="readers-stat-mini">
                          <img src="/images/memorized.png" alt="Выучено" />
                          <span>{stats.memorized}</span>
                        </div>
                      </div>
                      
                      {/* Голубой блок с баллами */}
                      <div className="score-compact-item readers average">
                        <span className="score-compact-value">{score}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      ) : activeTab === 'ai-choice' ? (
        // Вкладка "Выбор ИИ" - показываем рейтинг по AI-оценкам
        <div className="category-list">
          {(() => {
            // Подсчитываем AI-баллы для всех поэтов
            let aiRankings = poets
              .map(poet => {
                const aiScore = calculateAIScore(poet.id);
                const overallScore = calculateAverageScore(poet.id);
                return {
                  poet,
                  aiScore,
                  overallScore,
                  aiRatings: poet.aiRatings || {}
                };
              })
              .filter(item => item.aiScore > 0 && item.overallScore > 0) // Только поэты с AI-оценками И общим баллом
              .sort((a, b) => b.aiScore - a.aiScore); // Сортируем по убыванию
            
            if (aiRankings.length === 0) {
              return (
                <div className="empty-state">
                  <p>Пока нет AI-оценок</p>
                </div>
              );
            }
            
            // Определяем победителя - используем результат тайбрейкера, если есть
            let winnerId = null;
            if (aiChoiceTiebreaker && aiChoiceTiebreaker.winner) {
              winnerId = aiChoiceTiebreaker.winner;
              
              // Если есть тайбрейкер, перемещаем победителя на 1-е место
              const winnerIndex = aiRankings.findIndex(item => item.poet.id === winnerId);
              if (winnerIndex > 0) {
                // Извлекаем победителя и ставим его первым
                const winner = aiRankings.splice(winnerIndex, 1)[0];
                aiRankings.unshift(winner);
              }
            } else {
              winnerId = aiRankings[0]?.poet?.id || null;
            }
            
            return aiRankings.map((item, index) => {
              const { poet, aiScore, aiRatings } = item;
              const rank = index + 1;
              const isWinner = poet.id === winnerId;
              
              return (
                <div 
                  key={poet.id}
                  className="category-rank-card compact"
                >
                  <span className="category-rank-number compact">#{rank}</span>
                  
                  {poet.imageUrl && (
                    <div className="overall-avatar compact">
                      <img 
                        src={poet.imageUrl} 
                        alt={poet.name}
                        style={{ 
                          objectPosition: `center ${poet.imagePositionY !== undefined ? poet.imagePositionY : 25}%`
                        }}
                      />
                    </div>
                  )}
                  
                  <Link to={`/poet/${poet.id}`} className="category-poet-name-link">
                    <h3 className="category-poet-name compact">{poet.name}</h3>
                  </Link>
                  
                  <div className="overall-card-right-section">
                    {isWinner && (
                      <div className="winner-badges">
                        <img 
                          src="/images/badges/ai-choice.png" 
                          alt="Выбор ИИ"
                          className="winner-badge"
                        />
                      </div>
                    )}
                    
                    <div className="scores-compact-row">
                      {/* AI-оценки по категориям */}
                      <div className="ai-ratings-inline">
                        <div className="ai-rating-mini" title="Творчество">
                          <span className="ai-rating-label">Т:</span>
                          <span className="ai-rating-value">{aiRatings.creativity?.toFixed(1) || '—'}</span>
                        </div>
                        <div className="ai-rating-mini" title="Мораль">
                          <span className="ai-rating-label">М:</span>
                          <span className="ai-rating-value">{aiRatings.influence?.toFixed(1) || '—'}</span>
                        </div>
                        <div className="ai-rating-mini" title="Драма">
                          <span className="ai-rating-label">Д:</span>
                          <span className="ai-rating-value">{aiRatings.drama?.toFixed(1) || '—'}</span>
                        </div>
                        <div className="ai-rating-mini" title="Красота">
                          <span className="ai-rating-label">К:</span>
                          <span className="ai-rating-value">{aiRatings.beauty?.toFixed(1) || '—'}</span>
                        </div>
                      </div>
                      
                      {/* Голубой блок со средним AI-баллом */}
                      <div className="score-compact-item ai-choice average">
                        <span className="score-compact-value">{aiScore.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      ) : activeTab === 'overall' ? (
        <div className="overall-list">
          {(() => {
            // Если идет анимация, переставляем нового поэта на нужную позицию
            let displayRankings = [...finalRankings];
            let animatingIndex = -1;
            let originalIndex = -1;
            
            if (animatingPoet) {
              originalIndex = finalRankings.findIndex(item => item.poet.id === animatingPoet);
              if (originalIndex >= 0) {
                // animationStep теперь хранит текущую позицию в списке (0, 1, 2, ...)
                const targetPosition = Math.min(
                  Math.max(0, Math.round(animationStep)),
                  displayRankings.length - 1
                );
                
                // Убираем поэта с его места и ставим на вычисленную позицию
                const [animatingItem] = displayRankings.splice(originalIndex, 1);
                displayRankings.splice(targetPosition, 0, animatingItem);
              }
            }
            
            return displayRankings.map((item, index) => {
            const { poet, maximScore, olegScore, averageScore } = item;
            const rank = ranks[index] || index + 1; // fallback если ranks пустой
            const isNew = isNewestPoet(poet);
            const isAnimating = animatingPoet === poet.id;
            const isExpanded = expandedCards.has(poet.id);
            
            // Используем motion.div только для анимирующегося поэта
            const CardComponent = isAnimating ? motion.div : 'div';
            const cardProps = isAnimating 
              ? { 
                  layout: true,
                  transition: { 
                    layout: { 
                      type: "tween",
                      duration: 0.35,
                      ease: [0.25, 0.1, 0.25, 1] // Плавный easing для синхронизации с шагами
                    }
                  },
                  ref: animatingCardRef
                }
              : {};
            
            // Компактный вид (по умолчанию)
            if (!isExpanded) {
              return (
                <CardComponent 
                  key={poet.id}
                  {...cardProps}
                  data-poet-id={poet.id}
                  className={`overall-card compact ${isNew ? 'new-poet' : ''} ${isAnimating ? 'animating' : ''} expandable`}
                  onClick={() => !isAnimating && toggleCardExpansion(poet.id)}
                >
                  {(!isAnimating || showScore) ? (
                    <span className="overall-rank-number compact">#{rank}</span>
                  ) : (
                    <span className="overall-rank-number compact" style={{ opacity: 0 }}>?</span>
                  )}
                  {poet.imageUrl && (
                    <div className="overall-avatar compact">
                      <img 
                        src={poet.imageUrl} 
                        alt={poet.name}
                        style={{ 
                          objectPosition: `center ${poet.imagePositionY !== undefined ? poet.imagePositionY : 25}%`
                        }}
                      />
                    </div>
                  )}
                  <Link to={`/poet/${poet.id}`} className="overall-poet-name-link">
                    <h2 className="overall-poet-name compact">{poet.name}</h2>
                  </Link>
                  
                  <div className="overall-card-right-section">
                    {/* {isNew && <span className="new-badge">NEW</span>} */}
                    {(!isAnimating || showScore) && renderWinnerBadges(poet.id)}
                    
                    {(!isAnimating || showScore) ? (
                      <div className="scores-compact-row">
                        <div className="score-compact-item maxim">
                          <span className="score-compact-label">м</span>
                          <span className="score-compact-value">{formatScore(maximScore)}</span>
                        </div>
                        <div className="score-compact-item oleg">
                          <span className="score-compact-label">о</span>
                          <span className="score-compact-value">{formatScore(olegScore)}</span>
                        </div>
                        <div className="score-compact-item average">
                          <span className="score-compact-value">{formatAverageScore(averageScore)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="scores-compact-row">
                        <div className="score-loading">...</div>
                      </div>
                    )}
                  </div>
                </CardComponent>
              );
            }
            
            // Развернутый вид
            return (
              <CardComponent 
                key={poet.id}
                {...cardProps}
                data-poet-id={poet.id}
                className={`overall-card expanded ${rank <= 3 ? 'top-three' : ''} ${rank === 1 ? 'first-place' : ''} ${isNew ? 'new-poet' : ''} ${isAnimating ? 'animating' : ''}`}
                onClick={() => !isAnimating && toggleCardExpansion(poet.id)}
              >
                {/* Место (#1, #2, etc) */}
                {(!isAnimating || showScore) ? (
                  <span className="rank-number">#{rank}</span>
                ) : (
                  <span className="rank-number" style={{ opacity: 0 }}>?</span>
                )}
                
                {/* Фотография на всю высоту */}
                {poet.imageUrl && (
                  <div className="overall-avatar">
                    <img src={poet.imageUrl} alt={poet.name} style={{ 
                          objectPosition: `center ${poet.imagePositionY !== undefined ? poet.imagePositionY : 25}%`
                        }} />
                  </div>
                )}
                
                {/* Секция с информацией */}
                <div className="overall-info-section">
                  {/* Первая строка: имя, награды, оценки */}
                  <div className="overall-card-header">
                    <Link to={`/poet/${poet.id}`} className="overall-poet-name-link" onClick={(e) => e.stopPropagation()}>
                      <h2 className="overall-poet-name">{poet.name}</h2>
                    </Link>
                    
                    <div className="overall-header-right-section">
                      {(!isAnimating || showScore) && renderWinnerBadges(poet.id)}
                      
                      {(!isAnimating || showScore) ? (
                        <div className="scores-compact-row expanded">
                          <div className="score-compact-item maxim">
                            <span className="score-compact-label">м</span>
                            <span className="score-compact-value">{formatScore(maximScore)}</span>
                          </div>
                          <div className="score-compact-item oleg">
                            <span className="score-compact-label">о</span>
                            <span className="score-compact-value">{formatScore(olegScore)}</span>
                          </div>
                          <div className="score-compact-item average">
                            <span className="score-compact-value">{formatAverageScore(averageScore)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="scores-compact-row expanded">
                          <div className="score-loading">...</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Вторая строка: категории с оценками М, О, средняя */}
                  {(!isAnimating || showScore) ? (
                    <div className="overall-ratings-grid">
                      {Object.entries(CATEGORIES).map(([key, cat]) => {
                        const maximRating = ratings.maxim[poet.id]?.[key] || 0;
                        const olegRating = ratings.oleg[poet.id]?.[key] || 0;
                        const avgRating = (maximRating + olegRating) / 2;

                        return (
                          <div key={key} className="overall-rating-item">
                            <div className="overall-rating-label">
                              <span className="overall-category-name">{cat.name}</span>
                              {/* <span className="overall-category-coefficient">×{cat.coefficient}</span> */}
                            </div>
                            <div className="overall-category-scores">
                              <div className="overall-category-score maxim">
                                <span className="overall-category-score-label">м</span>
                                <span className="overall-category-score-value">{maximRating.toFixed(1)}</span>
                              </div>
                              <div className="overall-category-score oleg">
                                <span className="overall-category-score-label">о</span>
                                <span className="overall-category-score-value">{olegRating.toFixed(1)}</span>
                              </div>
                              <div className="overall-category-score average">
                                <span className="overall-category-score-value">{avgRating.toFixed(1)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="score-loading">Вычисление рейтинга...</div>
                  )}
                </div>
              </CardComponent>
            );
            });
          })()}
        </div>
      ) : (
        <div className="category-list">
          {(() => {
            // Перестановка элементов для анимации (аналогично overall)
            let displayRankings = [...finalRankings];
            let originalIndex = -1;
            
            if (animatingPoet) {
              originalIndex = finalRankings.findIndex(item => item.poet.id === animatingPoet);
              if (originalIndex >= 0) {
                // animationStep теперь хранит текущую позицию в списке (0, 1, 2, ...)
                const targetPosition = Math.min(
                  Math.max(0, Math.round(animationStep)),
                  displayRankings.length - 1
                );
                
                // Убираем поэта с его места и ставим на вычисленную позицию
                const [animatingItem] = displayRankings.splice(originalIndex, 1);
                displayRankings.splice(targetPosition, 0, animatingItem);
              }
            }
            
            return displayRankings.map((item, index) => {
            const { poet, maximRating, olegRating, averageRating } = item;
            const rankIndex = originalIndex >= 0 && index === Math.round(animationStep) ? originalIndex : index;
            const rank = ranks[rankIndex] || rankIndex + 1; // fallback если ranks пустой
            const isNew = isNewestPoet(poet);
            const isAnimating = animatingPoet === poet.id;

            // Компактный вид для категорий (без возможности развертывания)
            const CategoryCardComponent = isAnimating ? motion.div : 'div';
            const categoryCardProps = isAnimating 
              ? { 
                  layout: true,
                  transition: { 
                    layout: { 
                      type: "tween",
                      duration: 0.35,
                      ease: [0.25, 0.1, 0.25, 1] // Плавный easing для синхронизации с шагами
                    }
                  },
                  ref: animatingCardRef
                }
              : {};
            
            return (
              <CategoryCardComponent 
                key={poet.id}
                {...categoryCardProps}
                className={`category-rank-card compact ${isNew ? 'new-poet' : ''} ${isAnimating ? 'animating' : ''}`}
              >
                {(!isAnimating || showScore) ? (
                  <span className="category-rank-number compact">#{rank}</span>
                ) : (
                  <span className="category-rank-number compact" style={{ opacity: 0 }}>?</span>
                )}
                {poet.imageUrl && (
                  <div className="overall-avatar compact">
                    <img src={poet.imageUrl} alt={poet.name} style={{ 
                          objectPosition: `center ${poet.imagePositionY !== undefined ? poet.imagePositionY : 25}%`
                        }} />
                  </div>
                )}
                <Link to={`/poet/${poet.id}`} className="category-poet-name-link">
                  <h3 className="category-poet-name compact">{poet.name}</h3>
                </Link>
                
                <div className="overall-card-right-section">
                  {/* {isNew && <span className="new-badge">NEW</span>} */}
                  {(!isAnimating || showScore) && renderWinnerBadges(poet.id)}
                  
                  {(!isAnimating || showScore) ? (
                    <div className="scores-compact-row">
                      <div className="score-compact-item category maxim">
                        <span className="score-compact-label">м</span>
                        <span className="score-compact-value">{maximRating.toFixed(1)}</span>
                      </div>
                      <div className="score-compact-item category oleg">
                        <span className="score-compact-label">о</span>
                        <span className="score-compact-value">{olegRating.toFixed(1)}</span>
                      </div>
                      <div className="score-compact-item category average">
                        <span className="score-compact-value">{averageRating.toFixed(1)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="scores-compact-row">
                      <div className="score-loading">...</div>
                    </div>
                  )}
                </div>
              </CategoryCardComponent>
            );
            });
          })()}
        </div>
      )}
      
      
      {/* Игра для разрешения конфликта */}
      {gameConflict && currentUser && (
        <DuelGame
          poet1={gameConflict.poet1}
          poet2={gameConflict.poet2}
          category={gameConflict.categoryName}
          currentUser={currentUser}
          onGameEnd={handleGameEnd}
          onClose={() => setGameConflict(null)}
        />
      )}
    </div>
  );
};

export default OverallRankingPage;


