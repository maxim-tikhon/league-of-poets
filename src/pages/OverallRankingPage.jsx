import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { usePoets, CATEGORIES } from '../context/PoetsContext';
import StarRating from '../components/StarRating';
import DuelGame from '../components/DuelGame';
import './OverallRankingPage.css';

const OverallRankingPage = () => {
  const poetsContext = usePoets();
  const { 
    poets, 
    ratings, 
    categoryLeaders: rawCategoryLeaders, 
    overallDuelWinners: rawOverallDuelWinners, 
    isLoading, 
    getOverallRankings, 
    getCategoryRankings, 
    setOverallDuelWinner 
  } = poetsContext;
  
  const [activeTab, setActiveTab] = useState('overall'); // 'overall' or category key
  const [expandedCards, setExpandedCards] = useState(new Set()); // ID развернутых карточек для overall
  const [animatingPoet, setAnimatingPoet] = useState(null); // ID поэта, который анимируется
  const [showScore, setShowScore] = useState(false); // Показывать ли балл во время анимации
  const [animationStep, setAnimationStep] = useState(0); // Текущая позиция анимирующего поэта в списке (0 = первое место, N-1 = последнее место)
  const animatingCardRef = useRef(null); // Ref для анимирующейся карточки
  const [showFireworks, setShowFireworks] = useState(false); // Показывать ли фейерверк
  const [showCoffin, setShowCoffin] = useState(false); // Показывать ли гроб
  const [showTears, setShowTears] = useState(false); // Показывать ли слезы
  const [gameConflict, setGameConflict] = useState(null); // { category, poet1, poet2 }
  const [isMusicPlaying, setIsMusicPlaying] = useState(false); // Флаг для отображения кнопки
  const audioRef = useRef(null); // Реф для хранения аудио объекта
  
  // Получаем текущего пользователя из localStorage
  const currentUser = localStorage.getItem('currentUser');
  
  // Просто используем данные напрямую из контекста
  // Firebase уже оптимизирован и не будет создавать новые объекты если данные не изменились
  const categoryLeaders = rawCategoryLeaders || { maxim: {}, oleg: {} };
  const overallDuelWinners = rawOverallDuelWinners || {};
  
  // Триумфальная музыка для топ-3 🎊
  const playFireworkSound = () => {
    // Показываем кнопку сразу
    setIsMusicPlaying(true);
    
    // Останавливаем предыдущую музыку, если играет
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    // Используем реальную запись триумфальной музыки
    const audio = new Audio('/audio/victory-fanfare.wav');
    audio.volume = 0.6; // Устанавливаем громкость 60%
    audioRef.current = audio; // Сохраняем в ref
    
    // Подтверждаем, что музыка реально играет
    audio.addEventListener('playing', () => {
      setIsMusicPlaying(true);
    });
    
    // Очищаем ссылку на аудио после завершения
    audio.addEventListener('ended', () => {
      audioRef.current = null;
      setIsMusicPlaying(false);
    });
    
    // Если метаданные не загружаются
    audio.addEventListener('error', () => {
      audioRef.current = null;
      setIsMusicPlaying(false);
    });
    
    // Начинаем воспроизведение с 1:20 (80 секунд)
    audio.addEventListener('loadedmetadata', () => {
      audio.currentTime = 80; // 1 минута 20 секунд
    });
    
    // Запускаем воспроизведение сразу
    audio.play().catch(() => {
      // Игнорируем ошибки - музыка может играть несмотря на них
    });
  };
  
  // Резервный синтезированный звук фейерверка (на случай, если файл не загружен)
  const playFireworkSoundFallback = () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Создаем несколько звуков взрывов
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        // Взрыв (белый шум с envelope)
        const bufferSize = audioContext.sampleRate * 0.5;
        const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let j = 0; j < bufferSize; j++) {
          data[j] = Math.random() * 2 - 1;
        }
        
        const noise = audioContext.createBufferSource();
        noise.buffer = buffer;
        
        const noiseGain = audioContext.createGain();
        noiseGain.gain.setValueAtTime(0.3, audioContext.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        const filter = audioContext.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 1000;
        
        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(audioContext.destination);
        
        noise.start(audioContext.currentTime);
        noise.stop(audioContext.currentTime + 0.5);
        
        // Свист (частота падает)
        const oscillator = audioContext.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(2000, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.3);
        
        const oscGain = audioContext.createGain();
        oscGain.gain.setValueAtTime(0.2, audioContext.currentTime);
        oscGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.connect(oscGain);
        oscGain.connect(audioContext.destination);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
      }, i * 300);
    }
    
    // Триумфальная мелодия (фанфары)
    setTimeout(() => {
      const notes = [
        { freq: 523.25, time: 0 },    // C5
        { freq: 659.25, time: 0.15 },  // E5
        { freq: 783.99, time: 0.3 },   // G5
        { freq: 1046.5, time: 0.45 }   // C6
      ];
      
      notes.forEach(note => {
        setTimeout(() => {
          const osc = audioContext.createOscillator();
          osc.type = 'triangle';
          osc.frequency.value = note.freq;
          
          const gain = audioContext.createGain();
          gain.gain.setValueAtTime(0.3, audioContext.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
          
          osc.connect(gain);
          gain.connect(audioContext.destination);
          
          osc.start(audioContext.currentTime);
          osc.stop(audioContext.currentTime + 0.4);
        }, note.time * 1000);
      });
    }, 1000);
  };
  
  // Похоронный марш Шопена для последнего места ⚰️
  const playSadMusic = () => {
    // Показываем кнопку сразу
    setIsMusicPlaying(true);
    
    // Останавливаем предыдущую музыку, если играет
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    // Используем реальную запись похоронного марша Шопена
    // Источник: https://freesound.org/people/Sterio18/sounds/472906/
    // Лицензия: CC0 (Public Domain)
    const audio = new Audio('/audio/chopin-funeral-march.wav');
    audio.volume = 0.5; // Устанавливаем громкость 50%
    audioRef.current = audio; // Сохраняем в ref
    
    audio.play().catch(() => {
      // Игнорируем ошибки - музыка может играть несмотря на них
    });
    
    // Подтверждаем, что музыка реально играет
    audio.addEventListener('playing', () => {
      setIsMusicPlaying(true);
    });
    
    // Очищаем ссылку на аудио после завершения
    audio.addEventListener('ended', () => {
      audioRef.current = null;
      setIsMusicPlaying(false);
    });
  };
  
  // Резервный синтезированный вариант (на случай, если файл не загружен)
  const playSadMusicFallback = () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    const melody = [
      { freq: 246.94, time: 0, duration: 0.5 },
      { freq: 246.94, time: 0.6, duration: 0.5 },
      { freq: 246.94, time: 1.2, duration: 0.5 },
      { freq: 261.63, time: 1.8, duration: 0.4 },
      { freq: 293.66, time: 2.3, duration: 0.7 }
    ];

    melody.forEach(note => {
      setTimeout(() => {
        const osc = audioContext.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = note.freq;

        const gain = audioContext.createGain();
        gain.gain.setValueAtTime(0, audioContext.currentTime);
        gain.gain.linearRampToValueAtTime(0.25, audioContext.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + note.duration);

        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + note.duration);
      }, note.time * 1000);
    });
  };
  
  // Найти самого последнего добавленного поэта за последние 24 часа
  const getNewestPoet = () => {
    if (poets.length === 0) return null;
    
    const now = new Date();
    const poetsLast24h = poets.filter(poet => {
      const addedDate = new Date(poet.addedAt);
      const hoursDiff = (now - addedDate) / (1000 * 60 * 60);
      return hoursDiff <= 24;
    });
    
    if (poetsLast24h.length === 0) return null;
    
    // Найти самого последнего
    return poetsLast24h.reduce((latest, current) => {
      return new Date(current.addedAt) > new Date(latest.addedAt) ? current : latest;
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
  
  // Функция для остановки музыки
  const stopMusic = () => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch (err) {
        // Игнорируем ошибки остановки
      }
      audioRef.current = null;
      setIsMusicPlaying(false);
    }
  };
  
  // Останавливаем музыку при размонтировании компонента
  useEffect(() => {
    return () => {
      stopMusic();
    };
  }, []);
  
  // Проверяем, показывали ли уже анимацию в этой сессии
  useEffect(() => {
    // Не запускаем анимацию, пока данные загружаются
    if (isLoading || !newestPoet) {
      return;
    }
    
    const sessionKey = `animation_shown_${newestPoet.id}`;
    const animationShown = sessionStorage.getItem(sessionKey);
    
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
        sessionStorage.setItem(sessionKey, 'true');
        return;
      }
      
      // Генерируем маршрут согласно новому алгоритму
      const generateRoute = (targetIndex, totalPoets) => {
        // 1. Определяем BASE_STEPS (количество поэтов × 2)
        const baseSteps = totalPoets * 2;
        
        // 2. Допустимое отклонение (±10%)
        const deviation = Math.floor(baseSteps * 0.1);
        const totalSteps = baseSteps + Math.floor(Math.random() * (deviation * 2 + 1)) - deviation;
        
        // 3. Инициализация
        let currentIndex = 0; // Начинаем с первого места
        let accumulatedSteps = 0; // Сколько шагов уже прошли
        const positions = [0]; // Маршрут (список позиций)
        
        // 4. Генерация промежуточных движений
        let attempts = 0;
        while (accumulatedSteps < totalSteps) {
          // 4.1. Генерируем случайную позицию в диапазоне [0, totalPoets-1]
          const randomPosition = Math.floor(Math.random() * totalPoets);
          
          // 4.2. Вычисляем расстояние до этой позиции
          const stepsToPosition = Math.abs(randomPosition - currentIndex);
          
          // Если позиция совпадает с текущей - пропускаем
          if (stepsToPosition === 0) {
            continue;
          }
          
          // 4.3. Проверяем: хватит ли шагов вернуться к финальной позиции?
          const distanceToTarget = Math.abs(targetIndex - randomPosition);
          const stepsAfterMove = accumulatedSteps + stepsToPosition;
          const remainingSteps = totalSteps - stepsAfterMove;
          
          // Если после этого движения у нас не хватит шагов вернуться
          if (remainingSteps < distanceToTarget) {
            // Пробуем сгенерировать другую позицию
            attempts++;
            
            // Если уже много попыток или шагов почти не осталось - идем к цели
            if (attempts > 20 || (totalSteps - accumulatedSteps) <= Math.abs(targetIndex - currentIndex) * 1.2) {
              positions.push(targetIndex);
              break;
            }
            
            continue; // Пробуем другую позицию
          }
          
          // 4.4. Сбрасываем счетчик попыток и добавляем эту позицию в маршрут
          attempts = 0;
          positions.push(randomPosition);
          accumulatedSteps += stepsToPosition;
          currentIndex = randomPosition;
          
          // Защита от бесконечного цикла
          if (positions.length > 1000) {
            console.warn('Прерывание: слишком много итераций');
            positions.push(targetIndex);
            break;
          }
        }
        
        // 5. Убедимся, что финальная позиция - последняя
        if (positions[positions.length - 1] !== targetIndex) {
          positions.push(targetIndex);
        }
        
        return positions;
      };
      
      const totalPoets = rankings.length;
      const route = generateRoute(poetIndex, totalPoets);
      
      // Рассчитываем общее количество шагов в маршруте
      let totalSteps = 0;
      for (let i = 0; i < route.length - 1; i++) {
        totalSteps += Math.abs(route[i + 1] - route[i]);
      }
      
      // Фиксированная скорость: 5 шагов в секунду (медленнее)
      const stepsPerSecond = 3;
      const totalDuration = (totalSteps / stepsPerSecond) * 1000;
      
      // Через небольшую задержку запускаем движение
      setTimeout(() => {
        const startTime = Date.now();
        
        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / totalDuration, 1);
          
          // Вычисляем текущий пройденный путь (константная скорость)
          const currentStep = progress * totalSteps;
          
          // Находим текущую позицию на маршруте
          let accumulatedSteps = 0;
          let currentPos = route[0];
          
          for (let i = 0; i < route.length - 1; i++) {
            const segmentSteps = Math.abs(route[i + 1] - route[i]);
            
            if (accumulatedSteps + segmentSteps >= currentStep) {
              // Мы на этом сегменте
              const segmentProgress = (currentStep - accumulatedSteps) / segmentSteps;
              
              // Легкий easing для плавности (ease-in-out)
              const eased = segmentProgress < 0.5
                ? 2 * segmentProgress * segmentProgress
                : 1 - Math.pow(-2 * segmentProgress + 2, 2) / 2;
              
              currentPos = route[i] + (route[i + 1] - route[i]) * eased;
              break;
            }
            
            accumulatedSteps += segmentSteps;
          }
          
          // Если последний шаг
          if (progress >= 1) {
            currentPos = route[route.length - 1];
          }
          
          // Устанавливаем текущую позицию напрямую (это индекс в списке, а не процент!)
          setAnimationStep(currentPos);
          
          if (progress < 1) {
            requestAnimationFrame(animate);
          }
        };
        
        requestAnimationFrame(animate);
      }, 1000);
      
      // После окончания анимации показываем балл
      setTimeout(() => {
        setShowScore(true);
        
        const totalPoets = rankings.length;
        
        // Проверяем, попал ли поэт в топ-3
        if (poetIndex <= 2) {
          // Запускаем фейерверк!
          setShowFireworks(true);
          // Воспроизводим звук
          playFireworkSound();
          // Убираем фейерверк через 5 секунд
          setTimeout(() => {
            setShowFireworks(false);
          }, 5000);
        } else if (poetIndex === totalPoets - 1 && totalPoets > 3) {
          // Если последнее место И больше 3 поэтов, показываем трагичную анимацию 😢⚰️
          // Сначала показываем гроб
          setShowCoffin(true);
          
          // Через 2 секунды запускаем слезы и музыку
          setTimeout(() => {
            setShowTears(true);
            playSadMusic();
          }, 2000);
          
          // Убираем всё через 7 секунд (2 сек гроб + 5 сек слезы)
          setTimeout(() => {
            setShowCoffin(false);
            setShowTears(false);
          }, 7000);
        }
        
        setAnimatingPoet(null);
        setAnimationStep(0);
        sessionStorage.setItem(sessionKey, 'true');
      }, 1000 + totalDuration + 1000);
    }
  }, [isLoading, newestPoet, activeTab, overallRankings, allCategoryRankings]);

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
    ['creativity', 'influence', 'drama', 'beauty'].forEach(category => {
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
      // Сначала проверяем, есть ли победитель дуэли для этой категории
      const duelData = overallDuelWinners?.[category];
      if (duelData) {
        const winnerId = duelData.winner || duelData; // Для обратной совместимости
        const isWinnerInTop = topPoets.some(p => p.poet.id === winnerId);
        if (isWinnerInTop) {
          winners[category] = [winnerId];
          return;
        }
      }
      
      // Если дуэли не было, смотрим на персональных победителей
      const maximLeader = categoryLeaders.maxim?.[category];
      const olegLeader = categoryLeaders.oleg?.[category];
      
      // Если Максим и Олег оба выбрали одного и того же поэта, и он среди топовых - он победитель
      if (maximLeader && olegLeader && maximLeader === olegLeader) {
        const isLeaderInTop = topPoets.some(p => p.poet.id === maximLeader);
        if (isLeaderInTop) {
          winners[category] = [maximLeader];
          return;
        }
      }
      
      // Если выбраны разные поэты или никто не выбран - не показываем награду никому
      // (требуется дуэль)
      winners[category] = [];
    });
    
    // Теперь определяем победителя по overall с учетом категорийных наград
    if (overallRankings.length > 0) {
      const topScore = overallRankings[0].averageScore;
      const topPoets = overallRankings.filter(r => Math.abs(r.averageScore - topScore) < 0.01);
      
      if (topPoets.length > 1 && winners.overall.length === 0) {
        // Сначала проверяем, есть ли победитель дуэли для overall
        const duelWinner = overallDuelWinners?.overall;
        if (duelWinner) {
          const isWinnerInTop = topPoets.some(p => p.poet.id === duelWinner);
          if (isWinnerInTop) {
            winners.overall = [duelWinner];
            return winners;
          }
        }
        
        // Если дуэли не было - считаем количество категорийных наград
        const poetsWithBadgeCount = topPoets.map(poet => {
          const badgeCount = ['creativity', 'influence', 'drama', 'beauty'].filter(
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
  if (poets.length === 0) {
    return (
      <div className="overall-ranking fade-in">
        <div className="page-header-overall">
          <h1 className="page-title-overall">
            <span className="title-icon">🏆</span>
            Общий Рейтинг
          </h1>
        </div>
        <div className="empty-state">
          <span className="empty-icon">📝</span>
          <p>Нет поэтов для отображения рейтинга</p>
          <p className="empty-hint">Добавьте поэтов на странице "Поэты"</p>
        </div>
      </div>
    );
  }
  
  // Обновляем currentRankings с учетом пересортированного overall
  const finalRankings = activeTab === 'overall' ? sortedOverallRankings : currentRankings;
  
  // Функция для отображения бейджей победителя
  const renderWinnerBadges = (poetId) => {
    const badges = [];
    
    // Определяем какие награды показывать
    let categoriesToShow = [];
    if (activeTab === 'overall') {
      // При просмотре общего балла показываем награду за overall + все категорийные награды
      categoriesToShow = ['overall', 'creativity', 'influence', 'drama', 'beauty'];
    } else {
      // При просмотре конкретной категории показываем только её награду
      categoriesToShow = [activeTab];
    }
    
    categoriesToShow.forEach(category => {
      if (categoryWinners[category] && categoryWinners[category].includes(poetId)) {
        const categoryName = category === 'overall' ? 'Общий балл' : CATEGORIES[category].name;
        badges.push(
          <img 
            key={category}
            src={`/images/badges/${category}.png`}
            alt={`Победитель: ${categoryName}`}
            title={`🏆 Победитель: "${categoryName}"`}
            className="winner-badge"
          />
        );
      }
    });
    
    return badges.length > 0 ? <div className="winner-badges">{badges}</div> : null;
  };

  // Вычисляем ранги с учетом одинаковых значений
  const calculateRanks = (rankings, isOverall = true) => {
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
    <div className="overall-ranking fade-in">
      <div className="page-header-overall">
        <h1 className="page-title-overall">
        <span className="trophy-decoration">🏆</span>

          Общий Рейтинг
        </h1>
      </div>
      
      {/* Кнопка остановки музыки в правом нижнем углу */}
      {isMusicPlaying && (
        <button 
          className="stop-music-btn-floating" 
          onClick={stopMusic}
          title="Остановить музыку"
        >
          🤫
        </button>
      )}

      {/* Блок конфликтов */}
      {detectConflicts.length > 0 && (
        <div className="conflicts-block">
          <h3 className="conflicts-title">🎭 Конфликт чувств зафиксирован. Срочно требуется дуэль!</h3>
          <p className="conflicts-subtitle">
          Критики не сошлись во мнении — пусть судьба решит.
          </p>
          <div className="conflicts-list">
            {detectConflicts.map((conflict) => (
              <div key={conflict.category} className="conflict-item">
                <div className="conflict-info">
                  <span className="conflict-category">{conflict.categoryName}</span>
                  <span className="conflict-poets">
                    {conflict.poet1.name} VS {conflict.poet2.name}
                  </span>
                </div>
                <button
                  className="start-game-btn"
                  onClick={() => startDuelGame(conflict)}
                >
                  ⚔️ Дуэль
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
          <img 
            src="/images/badges/overall.png" 
            alt="Общий балл"
            className="tab-category-icon"
          />
          Общий балл
        </button>
        {Object.entries(CATEGORIES).map(([key, cat]) => (
          <button
            key={key}
            className={`tab-btn ${activeTab === key ? 'active' : ''}`}
            onClick={() => setActiveTab(key)}
          >
            <img 
              src={`/images/badges/${key}.png`} 
              alt={cat.name}
              className="tab-category-icon"
            />
            {cat.name}
          </button>
        ))}
      </div>

      {activeTab === 'overall' ? (
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
            const rank = ranks[index];
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
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
                      type: "spring",
                      stiffness: 50,
                      damping: 20,
                      mass: 1
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
                  className={`overall-card compact ${isNew ? 'new-poet' : ''} ${isAnimating ? 'animating' : ''} expandable`}
                  onClick={() => !isAnimating && toggleCardExpansion(poet.id)}
                >
                  {(!isAnimating || showScore) ? (
                    <div className="overall-rank compact">
                      {medal || `#${rank}`}
                    </div>
                  ) : (
                    <div className="overall-rank compact" style={{ opacity: 0 }}>?</div>
                  )}
                  <Link to={`/poet/${poet.id}`} className="overall-poet-name-link">
                    <h2 className="overall-poet-name compact">{poet.name}</h2>
                  </Link>
                  
                  <div className="overall-card-right-section">
                    {isNew && <span className="new-badge">NEW</span>}
                    {(!isAnimating || showScore) && renderWinnerBadges(poet.id)}
                    
                    {(!isAnimating || showScore) ? (
                      <div className="scores-compact-row">
                        <div className="score-compact-item maxim">
                          <span className="score-compact-label">M:</span>
                          <span className="score-compact-value">{maximScore.toFixed(1)}</span>
                        </div>
                        <div className="score-compact-item oleg">
                          <span className="score-compact-label">O:</span>
                          <span className="score-compact-value">{olegScore.toFixed(1)}</span>
                        </div>
                        <div className="score-compact-item average">
                          <span className="score-compact-value">{averageScore.toFixed(1)}</span>
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
                className={`overall-card expanded ${rank <= 3 ? 'top-three' : ''} ${rank === 1 ? 'first-place' : ''} ${isNew ? 'new-poet' : ''} ${isAnimating ? 'animating' : ''}`}
                onClick={() => !isAnimating && toggleCardExpansion(poet.id)}
              >
                {/* Первая строка - точно как компактный вид, только больше */}
                <div className="overall-card-header">
                  {(!isAnimating || showScore) ? (
                    <div className="overall-rank expanded">
                      {medal || `#${rank}`}
                    </div>
                  ) : (
                    <div className="overall-rank expanded" style={{ opacity: 0 }}>?</div>
                  )}
                  {poet.imageUrl && (
                    <div className="overall-avatar">
                      <img src={poet.imageUrl} alt={poet.name} />
                    </div>
                  )}
                  <Link to={`/poet/${poet.id}`} className="overall-poet-name-link">
                    <h2 className="overall-poet-name expanded">{poet.name}</h2>
                  </Link>
                  
                  <div className="overall-card-right-section">
                    {isNew && <span className="new-badge">NEW</span>}
                    {(!isAnimating || showScore) && renderWinnerBadges(poet.id)}
                    
                    {(!isAnimating || showScore) ? (
                      <div className="scores-compact-row expanded">
                        <div className="score-compact-item maxim">
                          <span className="score-compact-label">M:</span>
                          <span className="score-compact-value">{maximScore.toFixed(1)}</span>
                        </div>
                        <div className="score-compact-item oleg">
                          <span className="score-compact-label">O:</span>
                          <span className="score-compact-value">{olegScore.toFixed(1)}</span>
                        </div>
                        <div className="score-compact-item average">
                          <span className="score-compact-value">{averageScore.toFixed(1)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="scores-compact-row expanded">
                        <div className="score-loading">...</div>
                      </div>
                    )}
                  </div>
                </div>

                {(!isAnimating || showScore) ? (
                  <div className="ratings-grid">
                    {Object.entries(CATEGORIES).map(([key, cat]) => {
                      const maximRating = ratings.maxim[poet.id]?.[key] || 0;
                      const olegRating = ratings.oleg[poet.id]?.[key] || 0;
                      const avgRating = (maximRating + olegRating) / 2;
                      const points = avgRating * cat.coefficient;

                      return (
                        <div key={key} className="category-card">
                          <div className="category-card-header">
                            <span className="category-card-name">{cat.name}</span>
                            <span className="category-card-coefficient">×{cat.coefficient}</span>
                          </div>
                          <div className="category-ratings-boxes">
                            <div className="rating-box maxim">
                              <span className="rating-box-label">M:</span>
                              <span className="rating-box-value">{maximRating.toFixed(1)}</span>
                            </div>
                            <div className="rating-box oleg">
                              <span className="rating-box-label">O:</span>
                              <span className="rating-box-value">{olegRating.toFixed(1)}</span>
                            </div>
                            <div className="rating-box average">
                              <span className="rating-box-value">{avgRating.toFixed(1)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="score-loading">Вычисление рейтинга...</div>
                )}
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
            const rank = ranks[originalIndex >= 0 && index === Math.round(animationStep) ? originalIndex : index];
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
            const isNew = isNewestPoet(poet);
            const isAnimating = animatingPoet === poet.id;

            // Компактный вид для категорий (без возможности развертывания)
            const CategoryCardComponent = isAnimating ? motion.div : 'div';
            const categoryCardProps = isAnimating 
              ? { 
                  layout: true,
                  transition: { layout: { type: "spring", stiffness: 50, damping: 20, mass: 1 } },
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
                  <div className="category-rank-number compact">
                    {medal || `#${rank}`}
                  </div>
                ) : (
                  <div className="category-rank-number compact" style={{ opacity: 0 }}>?</div>
                )}
                <Link to={`/poet/${poet.id}`} className="category-poet-name-link">
                  <h3 className="category-poet-name compact">{poet.name}</h3>
                </Link>
                
                <div className="overall-card-right-section">
                  {isNew && <span className="new-badge">NEW</span>}
                  {(!isAnimating || showScore) && renderWinnerBadges(poet.id)}
                  
                  {(!isAnimating || showScore) ? (
                    <div className="scores-compact-row">
                      <div className="score-compact-item maxim">
                        <span className="score-compact-label">M:</span>
                        <span className="score-compact-value">{maximRating.toFixed(1)}</span>
                      </div>
                      <div className="score-compact-item oleg">
                        <span className="score-compact-label">O:</span>
                        <span className="score-compact-value">{olegRating.toFixed(1)}</span>
                      </div>
                      <div className="score-compact-item average">
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
      
      {/* Фейерверк для топ-3 */}
      {showFireworks && (
        <div className="fireworks-container">
          {/* Большие взрывы */}
          {[...Array(8)].map((_, i) => (
            <div key={`big-${i}`} className="firework-burst" style={{
              left: `${20 + (i * 12)}%`,
              top: `${20 + Math.random() * 60}%`,
              animationDelay: `${i * 0.3}s`
            }}>
              {[...Array(12)].map((_, j) => (
                <div key={j} className="spark" style={{
                  '--angle': `${j * 30}deg`
                }} />
              ))}
            </div>
          ))}
          
          {/* Падающее конфетти */}
          {[...Array(50)].map((_, i) => (
            <div key={`confetti-${i}`} className="confetti" style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              '--rotation': `${Math.random() * 360}deg`,
              backgroundColor: ['#ffd700', '#ff6b6b', '#4ecdc4', '#95e1d3', '#f38181'][i % 5]
            }} />
          ))}
          
          {/* Звездочки */}
          {[...Array(30)].map((_, i) => (
            <div key={`star-${i}`} className="star-particle" style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`
            }}>⭐</div>
          ))}
          
          {/* Центральная вспышка */}
          <div className="flash-overlay" />
        </div>
      )}
      
      {/* Анимация гроба для последнего места ⚰️ */}
      {showCoffin && (
        <div className="coffin-container">
          <div className="coffin-emoji">⚰️</div>
          <div className="coffin-text">R.I.P.</div>
          <div className="coffin-subtitle">Он вдохновлял, но не сегодня...</div>
        </div>
      )}
      
      {/* Анимация слез 😭 */}
      {showTears && (
        <div className="tears-container">
          {/* Много падающих слез */}
          {[...Array(40)].map((_, i) => (
            <div key={`tear-${i}`} className="tear" style={{
              left: `${10 + Math.random() * 80}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 3}s`,
              fontSize: `${2 + Math.random()}rem`
            }}>💧</div>
          ))}
          
          {/* Очень грустное облако */}
          <div className="sad-cloud">
            <div className="cloud-emoji">😭😭😭</div>
            <div className="sad-message">Последнее место...</div>
            <div className="sad-submessage">В следующий раз обязательно получится!</div>
          </div>
          
          {/* Много разбитых сердец */}
          {[...Array(12)].map((_, i) => (
            <div key={`heart-${i}`} className="broken-heart" style={{
              left: `${15 + (i * 6)}%`,
              top: `${40 + Math.random() * 40}%`,
              animationDelay: `${i * 0.15}s`,
              fontSize: `${2 + Math.random() * 1.5}rem`
            }}>💔</div>
          ))}
          
          {/* Грустные эмодзи */}
          {[...Array(8)].map((_, i) => (
            <div key={`sad-${i}`} className="sad-emoji" style={{
              left: `${20 + (i * 10)}%`,
              top: `${20 + Math.random() * 20}%`,
              animationDelay: `${i * 0.3}s`
            }}>😢</div>
          ))}
          
          {/* Темное облако сверху */}
          <div className="dark-overlay" />
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


