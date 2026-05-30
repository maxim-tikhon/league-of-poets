import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { usePoets, CATEGORIES } from '../context/PoetsContext';
import { ref, onValue } from 'firebase/database';
import { database } from '../firebase/config';
import StarRating from '../components/StarRating';
import DuelGame from '../components/DuelGame';
import Tooltip from '../components/Tooltip';
import { generateContent } from '../ai/gemini';
import { generateAITiebreakerPrompt, parseAITiebreaker } from '../ai/prompts';
import { USERS, USER_LABELS, USER_INITIALS } from '../constants';
import './OverallRankingPage.css';

const emptyLeadersMap = () => USERS.reduce((acc, u) => ({ ...acc, [u]: {} }), {});

const OverallRankingPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const poetsContext = usePoets();
  const {
    poets,
    ratings,
    likes,
    categoryLeaders: rawCategoryLeaders,
    overallDuelWinners: rawOverallDuelWinners,
    aiChoiceTiebreaker,
    tournaments,
    categoryCoefficients,
    isLoading,
    getOverallRankings,
    getCategoryRankings,
    setOverallDuelWinner,
    setAIChoiceWinner,
    calculateAverageScore
  } = poetsContext;

  // Админ (Максим) может исключать пользователей из расчёта общего/средних баллов
  const [excludedUsers, setExcludedUsers] = useState(new Set());
  
  const [activeTab, setActiveTab] = useState('overall'); // 'overall' or category key
  const [expandedCards, setExpandedCards] = useState(new Set()); // ID развернутых карточек для overall
  const [animatingPoet, setAnimatingPoet] = useState(null); // ID поэта, который анимируется
  const [showScore, setShowScore] = useState(false); // Показывать ли балл во время анимации
  const [animationStep, setAnimationStep] = useState(0); // Текущая позиция анимирующего поэта в списке (0 = первое место, N-1 = последнее место)
  const animatingCardRef = useRef(null); // Ref для анимирующейся карточки
  const animationFrameId = useRef(null); // ID для requestAnimationFrame
  const animationTimeouts = useRef([]); // Массив ID таймаутов для очистки
  const [gameConflict, setGameConflict] = useState(null); // { category, poet1, poet2 }
  const [jumpAnimationEnabled, setJumpAnimationEnabled] = useState(false); // OFF по умолчанию
  
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
  const isAdmin = currentUser === 'maxim';

  // Список активных оценщиков (без исключённых админом)
  const activeUsers = useMemo(
    () => USERS.filter((u) => !excludedUsers.has(u)),
    [excludedUsers]
  );

  const toggleUserExclusion = useCallback((user) => {
    if (!isAdmin) return;
    setExcludedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(user)) next.delete(user);
      else next.add(user);
      return next;
    });
  }, [isAdmin]);

  // Локальные версии калькуляторов с учётом исключённых пользователей
  const localHasFullRating = useCallback((rater, poetId) => {
    const poetRatings = ratings[rater]?.[poetId];
    if (!poetRatings) return false;
    return Object.keys(categoryCoefficients).every((cat) => (poetRatings[cat] || 0) > 0);
  }, [ratings, categoryCoefficients]);

  const localCalculateScore = useCallback((rater, poetId) => {
    const poetRatings = ratings[rater]?.[poetId];
    if (!poetRatings) return 0;
    return Object.keys(categoryCoefficients).reduce((total, category) => {
      const rating = poetRatings[category] || 0;
      return total + rating * categoryCoefficients[category].coefficient;
    }, 0);
  }, [ratings, categoryCoefficients]);
  
  // Просто используем данные напрямую из контекста
  // Firebase уже оптимизирован и не будет создавать новые объекты если данные не изменились
  const categoryLeaders = rawCategoryLeaders || emptyLeadersMap();
  const overallDuelWinners = rawOverallDuelWinners || {};
  const tournamentAwards = useMemo(() => {
    if (!Array.isArray(tournaments)) return [];
    return tournaments.filter((tournament) =>
      Boolean(tournament?.winnerPoetId) && Boolean(tournament?.badge)
    );
  }, [tournaments]);

  // Нобелевская премия: лайк от всех трёх пользователей.
  // Если лауреатов будет слишком много — ужесточим (добавим порог creativity или N лайков стихов).
  const nobelWinners = useMemo(() => {
    return new Set(
      poets
        .filter((poet) => USERS.every((u) => Boolean(likes[u]?.[poet.id])))
        .map((poet) => poet.id)
    );
  }, [poets, likes]);
  
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

  // Настройка из админки: включена ли "прыжковая" анимация новой карточки
  useEffect(() => {
    const settingsRef = ref(database, 'settings/overallRanking');
    const unsubscribe = onValue(settingsRef, (snapshot) => {
      const data = snapshot.val();
      setJumpAnimationEnabled(data?.jumpAnimationEnabled === true);
    });
    return () => unsubscribe();
  }, []);
  
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
      USERS.forEach((u) => {
        if (poem.viewed?.[u]) score += 1;
        if (poem.liked?.[u]) score += 15;
        if (poem.memorized?.[u]) score += 50;
      });
    });

    return score;
  }, [poets]);

  // Статистика стихов поэта (для отображения)
  const getPoemStats = useCallback((poetId) => {
    const poet = poets.find(p => p.id === poetId);
    if (!poet || !poet.poems) return { viewed: 0, liked: 0, memorized: 0 };

    const poemsArray = Object.values(poet.poems);
    const countField = (field) =>
      poemsArray.reduce(
        (sum, p) => sum + USERS.filter((u) => p?.[field]?.[u]).length,
        0
      );

    return {
      viewed: countField('viewed'),
      liked: countField('liked'),
      memorized: countField('memorized')
    };
  }, [poets]);

  const buildReadersChoiceRankings = useCallback(() => {
    return poets
      .map((poet) => ({
        poet,
        score: calculateReadersChoiceScore(poet.id),
        stats: getPoemStats(poet.id)
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if ((a.stats?.viewed || 0) !== (b.stats?.viewed || 0)) {
          return (a.stats?.viewed || 0) - (b.stats?.viewed || 0);
        }
        return String(a.poet?.name || '').localeCompare(String(b.poet?.name || ''), 'ru');
      });
  }, [poets, calculateReadersChoiceScore, getPoemStats]);
  
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
      if (excludedUsers.size === 0) {
        rankings[category] = getCategoryRankings(category);
        return;
      }
      rankings[category] = poets
        .map((poet) => {
          const userRatings = USERS.reduce((acc, u) => {
            acc[u] = ratings[u]?.[poet.id]?.[category] || 0;
            return acc;
          }, {});
          const activeNonZero = activeUsers
            .map((u) => userRatings[u])
            .filter((v) => v > 0);
          const averageRating = activeNonZero.length
            ? activeNonZero.reduce((s, v) => s + v, 0) / activeNonZero.length
            : 0;
          const ratedByAll = activeUsers.length > 0 && activeNonZero.length === activeUsers.length;
          return {
            poet,
            maximRating: userRatings.maxim,
            olegRating: userRatings.oleg,
            lyubaRating: userRatings.lyuba,
            userRatings,
            averageRating,
            ratedByAll,
            ratedByBoth: ratedByAll
          };
        })
        .filter((item) => item.averageRating > 0)
        .sort((a, b) => b.averageRating - a.averageRating);
    });
    return rankings;
  }, [poets, ratings, getCategoryRankings, excludedUsers, activeUsers]);

  // Мемоизируем overallRankings для оптимизации (ДОЛЖНО БЫТЬ ДО useEffect)
  const overallRankings = useMemo(() => {
    if (excludedUsers.size === 0) return getOverallRankings();
    return poets
      .map((poet) => {
        const userScores = USERS.reduce((acc, u) => {
          acc[u] = localHasFullRating(u, poet.id) ? localCalculateScore(u, poet.id) : 0;
          return acc;
        }, {});
        const activeScores = activeUsers
          .filter((u) => localHasFullRating(u, poet.id))
          .map((u) => localCalculateScore(u, poet.id));
        const averageScore = activeScores.length
          ? activeScores.reduce((s, v) => s + v, 0) / activeScores.length
          : 0;
        const ratedByAll = activeUsers.length > 0 && activeScores.length === activeUsers.length;
        return {
          poet,
          maximScore: userScores.maxim,
          olegScore: userScores.oleg,
          lyubaScore: userScores.lyuba,
          userScores,
          averageScore,
          ratedByAll,
          ratedByBoth: ratedByAll
        };
      })
      .filter((item) => item.averageScore > 0)
      .sort((a, b) => b.averageScore - a.averageScore);
  }, [getOverallRankings, excludedUsers, poets, activeUsers, localHasFullRating, localCalculateScore]);
  
  // Обнаружение конфликтов между пользователями
  const detectConflicts = useMemo(() => {
    const conflicts = [];

    Object.keys(CATEGORIES).forEach(category => {
      // Собираем уникальные ID-лидеров от всех пользователей
      const userPicks = USERS
        .map((u) => categoryLeaders[u]?.[category])
        .filter(Boolean);
      const distinctPicks = [...new Set(userPicks)];

      // Если все согласны или кто-то ещё не выбрал — нет конфликта
      if (distinctPicks.length < 2) return;

      const categoryRankings = allCategoryRankings[category];
      if (categoryRankings.length === 0) return;

      const maxScore = categoryRankings[0].averageRating;
      const topPoets = categoryRankings.filter(
        item => Math.abs(item.averageRating - maxScore) < 0.01
      );
      if (topPoets.length < 2) return;

      // Оставляем только пиков, реально находящихся в топе
      const picksInTop = distinctPicks.filter((pid) =>
        topPoets.some((item) => item.poet.id === pid)
      );
      if (picksInTop.length < 2) return;

      // Для дуэли берём первые два кандидата (отсортировано для стабильности)
      const conflictParticipants = picksInTop.slice(0, 2).sort();

      // Проверяем, не была ли уже дуэль или ручное назначение между этими поэтами
      const duelData = overallDuelWinners?.[category];
      if (duelData) {
        const winnerId = duelData.winner || duelData;
        const duelParticipants = duelData.participants || [];
        const isWinnerInTop = topPoets.some(item => item.poet.id === winnerId);

        // Ручное назначение из админки: подавляем конфликт пока победитель в топе
        if (isWinnerInTop && duelData.manual) {
          return;
        }

        if (
          isWinnerInTop
          && duelParticipants.length === 2
          && duelParticipants[0] === conflictParticipants[0]
          && duelParticipants[1] === conflictParticipants[1]
        ) {
          return;
        }
      }

      const poet1 = poets.find(p => p.id === conflictParticipants[0]);
      const poet2 = poets.find(p => p.id === conflictParticipants[1]);
      if (poet1 && poet2) {
        conflicts.push({
          category,
          categoryName: CATEGORIES[category].name,
          poet1,
          poet2,
          score: maxScore
        });
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
      // Режим "Flat": без прыжков. Сразу показываем финальную позицию и раскрываем карточку.
      if (!jumpAnimationEnabled) {
        setActiveTab('overall');
        setAnimatingPoet(null);
        setShowScore(true);
        setAnimationStep(0);
        setExpandedCards(prev => {
          const newSet = new Set(prev);
          newSet.add(newestPoet.id);
          return newSet;
        });

        // Чтобы было понятно, где новый поэт: прокручиваем к его карточке
        setTimeout(() => {
          const cardElement = document.querySelector(`[data-poet-id="${newestPoet.id}"]`);
          if (cardElement) {
            cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 350);

        localStorage.setItem(animationKey, 'true');
        return;
      }

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
  }, [isLoading, newestPoet, activeTab, overallRankings, allCategoryRankings, currentUser, jumpAnimationEnabled]);

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
    
    // Награды — для всех поэтов с любыми оценками (хотя бы один пользователь поставил)
    const confirmedOverall = overallRankings;
    if (confirmedOverall.length > 0) {
      const topScore = confirmedOverall[0].averageScore;
      const topPoets = confirmedOverall.filter(r => Math.abs(r.averageScore - topScore) < 0.01);

      if (topPoets.length === 1) {
        winners.overall = [topPoets[0].poet.id];
      } else {
        // Несколько поэтов с одинаковым баллом - считаем количество категорийных наград
        // (сначала нужно определить победителей по категориям, поэтому это в конце)
      }
    }

    // Помощник: выбрать победителя из топовых поэтов с учётом пиков пользователей
    const resolveWinnerFromTop = (topPoets, leaderKey, duelKey) => {
      const userPicksInTop = USERS
        .map((u) => categoryLeaders[u]?.[leaderKey])
        .filter((pid) => pid && topPoets.some((p) => p.poet.id === pid));
      const distinctPicks = [...new Set(userPicksInTop)];

      if (distinctPicks.length === 1) return [distinctPicks[0]];

      if (distinctPicks.length >= 2) {
        const duelData = overallDuelWinners?.[duelKey];
        if (duelData) {
          const winnerId = duelData.winner || duelData;
          if (topPoets.some((p) => p.poet.id === winnerId)) return [winnerId];
        }
        return [];
      }

      // Никто из пользователей не выбрал лидера в топе
      return [];
    };

    // Победители по категориям — все поэты с любой оценкой
    ['creativity', 'drama', 'influence', 'beauty'].forEach(category => {
      const rankings = allCategoryRankings[category];
      const confirmed = rankings;
      if (confirmed.length === 0) return;

      const topScore = confirmed[0].averageRating;
      const topPoets = confirmed.filter(r => Math.abs(r.averageRating - topScore) < 0.01);

      if (topPoets.length === 1) {
        winners[category] = [topPoets[0].poet.id];
        return;
      }

      winners[category] = resolveWinnerFromTop(topPoets, category, category);
    });
    
    // Теперь определяем победителя по overall с учетом категорийных наград
    if (confirmedOverall.length > 0) {
      const topScore = confirmedOverall[0].averageScore;
      const topPoets = confirmedOverall.filter(r => Math.abs(r.averageScore - topScore) < 0.01);

      if (topPoets.length > 1 && winners.overall.length === 0) {
        const userPicksInTop = USERS
          .map((u) => categoryLeaders[u]?.['overall'])
          .filter((pid) => pid && topPoets.some((p) => p.poet.id === pid));
        const distinctPicks = [...new Set(userPicksInTop)];

        if (distinctPicks.length === 1) {
          winners.overall = [distinctPicks[0]];
          return winners;
        }

        if (distinctPicks.length >= 2) {
          const duelData = overallDuelWinners?.overall;
          if (duelData) {
            const duelWinner = duelData.winner || duelData;
            if (topPoets.some(p => p.poet.id === duelWinner)) {
              winners.overall = [duelWinner];
              return winners;
            }
          }
          winners.overall = [];
          return winners;
        }

        // Никто не назначил лидера в топе — считаем количество категорийных наград
        const poetsWithBadgeCount = topPoets.map(poet => {
          const badgeCount = ['creativity', 'drama', 'influence', 'beauty'].filter(
            cat => winners[cat] && winners[cat].includes(poet.poet.id)
          ).length;
          return { id: poet.poet.id, badgeCount };
        });

        poetsWithBadgeCount.sort((a, b) => b.badgeCount - a.badgeCount);
        const maxBadges = poetsWithBadgeCount[0].badgeCount;
        const poetsWithMaxBadges = poetsWithBadgeCount.filter(p => p.badgeCount === maxBadges);
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
    
    // Худший только по общему баллу — все поэты с любой оценкой
    const confirmed = overallRankings;
    if (confirmed.length > 3) {
      const lowestScore = confirmed[confirmed.length - 1].averageScore;
      const lowestPoets = confirmed.filter(r => Math.abs(r.averageScore - lowestScore) < 0.01);
      
      // Если только один поэт с минимальным баллом - он худший
      if (lowestPoets.length === 1) {
        losers.overall = [lowestPoets[0].poet.id];
      } else if (lowestPoets.length > 1) {
        // Несколько поэтов с одинаковым минимальным баллом — собираем пиков пользователей
        const userPicksInBottom = USERS
          .map((u) => categoryLeaders[u]?.['overall_worst'])
          .filter((pid) => pid && lowestPoets.some((p) => p.poet.id === pid));
        const distinctPicks = [...new Set(userPicksInBottom)];

        if (distinctPicks.length === 1) {
          losers.overall = [distinctPicks[0]];
        } else if (distinctPicks.length >= 2) {
          const duelLoser = overallDuelWinners?.overall_worst;
          if (duelLoser) {
            const winnerId = duelLoser.winner || duelLoser;
            if (lowestPoets.some(p => p.poet.id === winnerId)) {
              losers.overall = [winnerId];
            }
          }
        }
      }
    }
    
    return losers;
  }, [overallRankings, categoryLeaders, overallDuelWinners]);
  
  // Лучший белорусский поэт — все белорусы с любой оценкой
  const belarusianWinner = useMemo(() => {
    const scored = overallRankings.filter(item => item.poet.belarusian);
    return scored.length > 0 ? scored[0].poet.id : null;
  }, [overallRankings]);

  // Лучший поэт-исполнитель — все музыканты с любой оценкой
  const musicianWinner = useMemo(() => {
    const scored = overallRankings.filter(item => item.poet.musician);
    return scored.length > 0 ? scored[0].poet.id : null;
  }, [overallRankings]);

  // Лучший зарубежный поэт — все зарубежные с любой оценкой
  const foreignWinner = useMemo(() => {
    const scored = overallRankings.filter(item => item.poet.foreign);
    return scored.length > 0 ? scored[0].poet.id : null;
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
      const readersRankings = buildReadersChoiceRankings().map((item) => ({
        id: item.poet.id,
        score: item.score,
        viewed: item.stats?.viewed || 0
      }));
      
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

    // Нобелевская премия - показываем только на вкладке "Общий балл"
    if (activeTab === 'overall' && nobelWinners.has(poetId)) {
      badges.push(
        <img
          key="nobel"
          src="/images/badges/nobel.png"
          alt="Нобелевская премия"
          className="winner-badge"
        />
      );
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

    // Лучший белорусский поэт - показываем только на вкладке "Общий балл"
    if (activeTab === 'overall' && belarusianWinner === poetId) {
      badges.push(
        <img
          key="belarus"
          src="/images/badges/belarus.png"
          alt="Лучший белорусский поэт"
          className="winner-badge"
        />
      );
    }

    // Лучший поэт-исполнитель - показываем только на вкладке "Общий балл"
    if (activeTab === 'overall' && musicianWinner === poetId) {
      badges.push(
        <img
          key="musician"
          src="/images/badges/musician.png"
          alt="Лучший поэт-исполнитель"
          className="winner-badge"
        />
      );
    }

    // Лучший зарубежный поэт - показываем только на вкладке "Общий балл"
    if (activeTab === 'overall' && foreignWinner === poetId) {
      badges.push(
        <img
          key="foreign"
          src="/images/badges/world.png"
          alt="Лучший зарубежный поэт"
          className="winner-badge"
        />
      );
    }

    // Турнирные награды - показываем только на вкладке "Общий балл"
    if (activeTab === 'overall' && tournamentAwards.length > 0) {
      tournamentAwards.forEach((tournament) => {
        if (tournament.winnerPoetId === poetId) {
          badges.push(
            <img
              key={`tournament-${tournament.id}`}
              src={`/images/badges/${tournament.badge}`}
              alt={tournament.name || 'Турнирная награда'}
              className="winner-badge"
            />
          );
        }
      });
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
      
      {/* Блок конфликтов — список ничьих, разрешается вручную из админки.
          Дуэль-игра отключена для 3 пользователей (использовали при двух игроках). */}
      {detectConflicts.length > 0 && (
        <div className="conflicts-block">
          <div className="conflicts-list">
            {detectConflicts.map((conflict) => (
              <div key={conflict.category} className="conflict-item" data-category={conflict.category}>
                <div className="conflict-info">
                  <span className="conflict-category">{conflict.categoryName}:</span>
                  <span className="conflict-poets">
                    {conflict.poet1.name} VS {conflict.poet2.name}
                  </span>
                </div>
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

        {/* Легенда цветов пользователей — только на оценочных вкладках.
            Админ (Максим) может кликом по имени исключить пользователя из расчётов. */}
        {activeTab !== 'readers-choice' && activeTab !== 'ai-choice' && (
          <div className="readers-choice-legend rating-users-legend">
            {USERS.map((u) => {
              const excluded = excludedUsers.has(u);
              const className = [
                'readers-choice-legend-item',
                'rating-users-legend-item',
                u,
                excluded ? 'excluded' : '',
                isAdmin ? 'clickable' : ''
              ].filter(Boolean).join(' ');
              return (
                <span
                  key={u}
                  className={className}
                  onClick={isAdmin ? () => toggleUserExclusion(u) : undefined}
                  role={isAdmin ? 'button' : undefined}
                  tabIndex={isAdmin ? 0 : undefined}
                  onKeyDown={isAdmin ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleUserExclusion(u);
                    }
                  } : undefined}
                >
                  <span className="rating-users-legend-dot" />
                  {USER_LABELS[u]}
                </span>
              );
            })}
          </div>
        )}

        {activeTab === 'readers-choice' && (
          <div className="readers-choice-legend" aria-label="Легенда баллов выбор читателей">
            <div className="readers-choice-legend-item">
              <img src="/images/viewed.png" alt="Просмотрено" />
              <span>× 1</span>
            </div>
            <div className="readers-choice-legend-item">
              <img src="/images/like.png" alt="Лайк" />
              <span>× 15</span>
            </div>
            <div className="readers-choice-legend-item">
              <img src="/images/memorized.png" alt="Выучено наизусть" />
              <span>× 50</span>
            </div>
          </div>
        )}
      </div>

      {activeTab === 'readers-choice' ? (
        // Вкладка "Выбор читателей" - показываем рейтинг по взаимодействию со стихами
        <div className="category-list">
          {(() => {
            const readersRankings = buildReadersChoiceRankings();
            
            if (readersRankings.length === 0) {
              return (
                <div className="empty-state">
                  <p>Пока нет взаимодействий со стихами</p>
                </div>
              );
            }
            
            // Победитель: максимальный score, при равенстве — меньше viewed
            const winnerId = readersRankings[0]?.poet?.id || null;

            const readersRanks = [];
            let currentRank = 1;
            for (let i = 0; i < readersRankings.length; i += 1) {
              if (i > 0) {
                const prevScore = readersRankings[i - 1].score;
                const curScore = readersRankings[i].score;
                if (Math.abs(curScore - prevScore) >= 0.001) {
                  currentRank = i + 1;
                }
              }
              readersRanks.push(currentRank);
            }
            
            return readersRankings.map((item, index) => {
              const { poet, score, stats } = item;
              const rank = readersRanks[index];
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
                    <h3 className="category-poet-name compact">{poet.name}{poet.belarusian && <img src="/images/blr.png" alt="BY" className="blr-flag" />}{poet.musician && <img src="/images/music.png" alt="Музыкант" className="blr-flag" />}{poet.foreign && <img src="/images/world.png" alt="Зарубежный" className="blr-flag" />}</h3>
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

            const aiCategoryBounds = {
              creativity: { max: -Infinity, min: Infinity },
              influence: { max: -Infinity, min: Infinity },
              drama: { max: -Infinity, min: Infinity },
              beauty: { max: -Infinity, min: Infinity }
            };

            aiRankings.forEach(({ aiRatings }) => {
              ['creativity', 'influence', 'drama', 'beauty'].forEach((key) => {
                const value = Number(aiRatings?.[key]);
                if (!Number.isFinite(value) || value <= 0) return;
                if (value > aiCategoryBounds[key].max) aiCategoryBounds[key].max = value;
                if (value < aiCategoryBounds[key].min) aiCategoryBounds[key].min = value;
              });
            });
            
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

            const aiRanks = [];
            let currentRank = 1;
            for (let i = 0; i < aiRankings.length; i += 1) {
              if (i > 0) {
                const prevScore = aiRankings[i - 1].aiScore;
                const curScore = aiRankings[i].aiScore;
                if (Math.abs(curScore - prevScore) >= 0.001) {
                  currentRank = i + 1;
                }
              }
              aiRanks.push(currentRank);
            }
            
            return aiRankings.map((item, index) => {
              const { poet, aiScore, aiRatings } = item;
              const rank = aiRanks[index];
              const isWinner = poet.id === winnerId;
              const isAiRatingMax = (key) => {
                const value = Number(aiRatings?.[key]);
                const max = aiCategoryBounds[key].max;
                return Number.isFinite(value) && Number.isFinite(max) && value > 0 && Math.abs(value - max) < 0.001;
              };
              const isAiRatingMin = (key) => {
                const value = Number(aiRatings?.[key]);
                const min = aiCategoryBounds[key].min;
                const max = aiCategoryBounds[key].max;
                return Number.isFinite(value) &&
                  Number.isFinite(min) &&
                  value > 0 &&
                  Math.abs(value - min) < 0.001 &&
                  Math.abs(max - min) >= 0.001;
              };
              
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
                    <h3 className="category-poet-name compact">{poet.name}{poet.belarusian && <img src="/images/blr.png" alt="BY" className="blr-flag" />}{poet.musician && <img src="/images/music.png" alt="Музыкант" className="blr-flag" />}{poet.foreign && <img src="/images/world.png" alt="Зарубежный" className="blr-flag" />}</h3>
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
                        <div className={`ai-rating-mini ${isAiRatingMax('creativity') ? 'max' : ''} ${isAiRatingMin('creativity') ? 'min' : ''}`.trim()} title="Творчество">
                          <span className="ai-rating-label">Т:</span>
                          <span className="ai-rating-value">{aiRatings.creativity?.toFixed(1) || '—'}</span>
                        </div>
                        <div className={`ai-rating-mini ${isAiRatingMax('influence') ? 'max' : ''} ${isAiRatingMin('influence') ? 'min' : ''}`.trim()} title="Мораль">
                          <span className="ai-rating-label">М:</span>
                          <span className="ai-rating-value">{aiRatings.influence?.toFixed(1) || '—'}</span>
                        </div>
                        <div className={`ai-rating-mini ${isAiRatingMax('drama') ? 'max' : ''} ${isAiRatingMin('drama') ? 'min' : ''}`.trim()} title="Драма">
                          <span className="ai-rating-label">Д:</span>
                          <span className="ai-rating-value">{aiRatings.drama?.toFixed(1) || '—'}</span>
                        </div>
                        <div className={`ai-rating-mini ${isAiRatingMax('beauty') ? 'max' : ''} ${isAiRatingMin('beauty') ? 'min' : ''}`.trim()} title="Красота">
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
            const { poet, userScores = {}, averageScore, ratedByBoth } = item;
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
                    <h2 className="overall-poet-name compact">{poet.name}{poet.belarusian && <img src="/images/blr.png" alt="BY" className="blr-flag" />}{poet.musician && <img src="/images/music.png" alt="Музыкант" className="blr-flag" />}{poet.foreign && <img src="/images/world.png" alt="Зарубежный" className="blr-flag" />}</h2>
                  </Link>
                  
                  <div className="overall-card-right-section">
                    {/* {isNew && <span className="new-badge">NEW</span>} */}
                    {(!isAnimating || showScore) && renderWinnerBadges(poet.id)}
                    
                    {(!isAnimating || showScore) ? (
                      <div className="scores-compact-row">
                        {activeUsers.map((u) => (
                          <div key={u} className={`score-compact-item ${u}`}>
                            <span className="score-compact-value">{(userScores[u] || 0) > 0 ? formatScore(userScores[u]) : '—'}</span>
                          </div>
                        ))}
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
                      <h2 className="overall-poet-name">{poet.name}{poet.belarusian && <img src="/images/blr.png" alt="BY" className="blr-flag" />}{poet.musician && <img src="/images/music.png" alt="Музыкант" className="blr-flag" />}{poet.foreign && <img src="/images/world.png" alt="Зарубежный" className="blr-flag" />}</h2>
                    </Link>
                    
                    <div className="overall-header-right-section">
                      {(!isAnimating || showScore) && renderWinnerBadges(poet.id)}
                      
                      {(!isAnimating || showScore) ? (
                        <div className="scores-compact-row expanded">
                          {activeUsers.map((u) => (
                            <div key={u} className={`score-compact-item ${u}`}>
                              <span className="score-compact-value">{(userScores[u] || 0) > 0 ? formatScore(userScores[u]) : '—'}</span>
                            </div>
                          ))}
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
                        const userCatRatings = USERS.reduce((acc, u) => {
                          acc[u] = ratings[u]?.[poet.id]?.[key] || 0;
                          return acc;
                        }, {});
                        const activeNonZero = activeUsers.map((u) => userCatRatings[u]).filter((v) => v > 0);
                        const avgRating = activeNonZero.length
                          ? activeNonZero.reduce((s, v) => s + v, 0) / activeNonZero.length
                          : 0;

                        return (
                          <div key={key} className="overall-rating-item">
                            <div className="overall-rating-label">
                              <span className="overall-category-name">{cat.name}</span>
                            </div>
                            <div className="overall-category-scores">
                              {activeUsers.map((u) => (
                                <div key={u} className={`overall-category-score ${u}`}>
                                  <span className="overall-category-score-value">{userCatRatings[u] > 0 ? userCatRatings[u].toFixed(1) : '—'}</span>
                                </div>
                              ))}
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
            const { poet, userRatings = {}, averageRating, ratedByBoth } = item;
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
                  <h3 className="category-poet-name compact">{poet.name}{poet.belarusian && <img src="/images/blr.png" alt="BY" className="blr-flag" />}{poet.musician && <img src="/images/music.png" alt="Музыкант" className="blr-flag" />}{poet.foreign && <img src="/images/world.png" alt="Зарубежный" className="blr-flag" />}</h3>
                </Link>
                
                <div className="overall-card-right-section">
                  {/* {isNew && <span className="new-badge">NEW</span>} */}
                  {(!isAnimating || showScore) && renderWinnerBadges(poet.id)}
                  
                  {(!isAnimating || showScore) ? (
                    <div className="scores-compact-row">
                      {activeUsers.map((u) => (
                        <div key={u} className={`score-compact-item category ${u}`}>
                          <span className="score-compact-value">{(userRatings[u] || 0) > 0 ? userRatings[u].toFixed(1) : '—'}</span>
                        </div>
                      ))}
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
      
      
      {/* Дуэль-игра отключена с переходом на 3 пользователей.
          Конфликты разрешаются через ручное назначение в админке (категория «Общий»).
          Код DuelGame оставлен на случай возврата к игре. */}
    </div>
  );
};

export default OverallRankingPage;


