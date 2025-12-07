import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePoets, CATEGORIES } from '../context/PoetsContext';
import StarRating from '../components/StarRating';
import BattleModal from '../components/BattleModal';
import { generateContent } from '../ai/gemini';
import { 
  generatePoetBioPrompt, 
  generateRandomPoemPrompt, 
  generatePopularPoemPrompt, 
  generateThemedPoemPrompt,
  POEM_GENERATION_OPTIONS
} from '../ai/prompts';
import { Globe, BookOpen, Image, Youtube, ExternalLink, Quote, Link } from 'lucide-react';
import './PoetDetailPage.css';

const PoetDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { poets, ratings, calculateScore, isLoading, updateRating, categoryLeaders, setCategoryLeader, deletePoet: deletePoetFunc, updatePoet, likes, toggleLike, addPoem, updatePoemStatus } = usePoets();
  
  const poet = poets.find(p => p.id === id);
  const [enlargedImage, setEnlargedImage] = useState(null); // Для lightbox
  const [currentUser, setCurrentUser] = useState(null); // Текущий пользователь (maxim/oleg)
  const [battleConflict, setBattleConflict] = useState(null); // { category, poet1, poet2 }
  const lastRatingChange = useRef(null); // { poetId, category, timestamp }
  const initialChangedPoetRef = useRef(null);
  
  // Модалки редактирования и удаления
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editError, setEditError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('classic');
  
  // Активная вкладка контента
  const [activeTab, setActiveTab] = useState('poems');
  
  // Стихотворения поэта из Firebase
  const poems = poet?.poems ? Object.keys(poet.poems).map(key => ({
    id: key,
    ...poet.poems[key]
  })).sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt)) : [];
  
  // Общая статистика по стихам (для всех пользователей)
  const poemStats = {
    viewed: poems.reduce((sum, p) => {
      return sum + (p.viewed?.['maxim'] ? 1 : 0) + (p.viewed?.['oleg'] ? 1 : 0);
    }, 0),
    liked: poems.reduce((sum, p) => {
      return sum + (p.liked?.['maxim'] ? 1 : 0) + (p.liked?.['oleg'] ? 1 : 0);
    }, 0),
    memorized: poems.reduce((sum, p) => {
      return sum + (p.memorized?.['maxim'] ? 1 : 0) + (p.memorized?.['oleg'] ? 1 : 0);
    }, 0)
  };
  
  // Модалка добавления стихотворения
  const [showAddPoemModal, setShowAddPoemModal] = useState(false);
  const [newPoemTitle, setNewPoemTitle] = useState('');
  const [poemError, setPoemError] = useState('');
  const [isGeneratingPoem, setIsGeneratingPoem] = useState(false);
  const [selectedOption, setSelectedOption] = useState('random');
  
  // Модалка просмотра стихотворения
  const [showPoemModal, setShowPoemModal] = useState(false);
  const [selectedPoem, setSelectedPoem] = useState(null);
  
  // Показать все ссылки
  const [showAllLinks, setShowAllLinks] = useState(false);
  
  // Получение текущего пользователя из localStorage
  useEffect(() => {
    const user = localStorage.getItem('currentUser');
    setCurrentUser(user);
  }, []);

  // Получение текущей темы
  useEffect(() => {
    const theme = localStorage.getItem('selectedTheme') || 'classic';
    setCurrentTheme(theme);

    // Слушаем изменения темы
    const handleThemeChange = () => {
      const newTheme = localStorage.getItem('selectedTheme') || 'classic';
      setCurrentTheme(newTheme);
    };

    window.addEventListener('themechange', handleThemeChange);
    return () => window.removeEventListener('themechange', handleThemeChange);
  }, []);
  
  // Закрытие lightbox по клавише Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && enlargedImage) {
        setEnlargedImage(null);
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [enlargedImage]);
  
  // Проверка, является ли поэт "новым" (не показывали ли уже анимацию этому пользователю)
  const isNewPoet = () => {
    if (!poet || !poet.firstRatedAt) return false;
    
    // Проверяем, показывали ли анимацию текущему пользователю
    const animationKey = `animation_shown_${currentUser}_${poet.id}`;
    const animationShown = localStorage.getItem(animationKey);
    
    // Если анимация уже была показана - поэт НЕ новый (можно показывать рейтинг)
    if (animationShown) return false;
    
    // Если анимация НЕ была показана И есть firstRatedAt - поэт новый (скрываем рейтинг)
    // Также проверяем, что с момента первой оценки прошло не более 24 часов
    const now = new Date();
    const ratedDate = new Date(poet.firstRatedAt);
    const hoursDiff = (now - ratedDate) / (1000 * 60 * 60);
    
    return hoursDiff <= 1;
  };
  
  // Проверка, есть ли у поэта оценки
  const hasRatings = () => {
    if (!poet) return false;
    const maximScore = calculateScore('maxim', poet.id);
    const olegScore = calculateScore('oleg', poet.id);
    return maximScore > 0 || olegScore > 0;
  };
  
  // Расчет общей средней оценки (уже в 5-балльной шкале)
  const getOverallAverage = () => {
    if (!poet) return 0;
    const maximScore = calculateScore('maxim', poet.id);
    const olegScore = calculateScore('oleg', poet.id);
    
    // Если оба пользователя оценили - среднее
    if (maximScore > 0 && olegScore > 0) {
      return (maximScore + olegScore) / 2;
    }
    
    // Если только один пользователь оценил - его балл
    return maximScore > 0 ? maximScore : olegScore;
  };
  
  // Получить персональный общий рейтинг текущего пользователя (уже в 5-балльной шкале)
  const getPersonalOverallRating = () => {
    if (!poet || !currentUser) return 0;
    return calculateScore(currentUser, poet.id);
  };
  
  // Проверка конфликта: есть ли другие поэты с таким же максимальным/минимальным баллом
  // Возвращает true, если дуэль была запущена
  const checkForConflict = useCallback((changedPoetId, category, changedCategory = null, newRatingValue = null) => {
    if (!currentUser) return false;
    
    
    // Для overall_worst используем calculateScore, для категорий - рейтинг категории
    const poetsWithRatings = poets.map(poet => {
      let rating;
      
      if (category === 'overall' || category === 'overall_worst') {
        // Для overall пересчитываем score с учетом нового значения
        if (poet.id === changedPoetId && changedCategory && newRatingValue !== null) {
          const poetRatings = ratings[currentUser]?.[poet.id] || {};
          const updatedRatings = { ...poetRatings, [changedCategory]: newRatingValue };
          
          if (category === 'overall' && poet.id === changedPoetId) {
          }
          
          let totalScore = 0;
          let totalWeight = 0;
          
          if (category === 'overall' && poet.id === changedPoetId) {
          }
          
          Object.entries(CATEGORIES).forEach(([key, { coefficient }]) => {
            const ratingValue = updatedRatings[key] || 0;
            
            if (category === 'overall' && poet.id === changedPoetId) {
            }
            
            if (ratingValue > 0) {
              totalScore += ratingValue * coefficient;
              totalWeight += coefficient;
            }
          });
          rating = totalWeight > 0 ? totalScore / totalWeight : 0;
          
          if (category === 'overall' && poet.id === changedPoetId) {
          }
          
          if (category === 'overall' && poet.id === changedPoetId) {
          }
        } else {
          rating = calculateScore(currentUser, poet.id);
          if (category === 'overall' && poet.id === changedPoetId) {
          }
        }
      } else {
        rating = (poet.id === changedPoetId && newRatingValue !== null)
          ? newRatingValue // ← Используем новое значение для измененного поэта!
          : (ratings[currentUser]?.[poet.id]?.[category] || 0);
      }
      
      return {
        id: poet.id,
        name: poet.name,
        imageUrl: poet.imageUrl,
        imagePositionY: poet.imagePositionY,
        rating
      };
    }).filter(p => p.rating > 0);
    
    if (category === 'overall') {
    }
    
    if (poetsWithRatings.length === 0) {
      // Нет поэтов с рейтингом - сбрасываем лидера если был
      const explicitLeader = categoryLeaders[currentUser]?.[category];
      if (explicitLeader) {
        setCategoryLeader(currentUser, category, null);
      }
      return false;
    }
    
    // Для overall_worst проверяем худшего поэта (минимальный балл)
    // Для остальных - лучшего (максимальный балл)
    const isWorstCategory = category === 'overall_worst';
    
    if (isWorstCategory) {
      // Проверяем только если поэтов достаточно (>5)
      if (poetsWithRatings.length <= 5) {
        return false;
      }
    }
    
    // Находим максимальный или минимальный рейтинг
    poetsWithRatings.sort((a, b) => isWorstCategory ? a.rating - b.rating : b.rating - a.rating);
    const topRating = poetsWithRatings[0].rating;
    const topPoets = poetsWithRatings.filter(p => Math.abs(p.rating - topRating) < 0.01);
    
    if (isWorstCategory) {
    } else {
    }
    topPoets.forEach(p => {
    });
    
    const explicitLeader = categoryLeaders[currentUser]?.[category];
    if (isWorstCategory) {
    } else {
    }
    
    // ВАЖНО: Сначала проверяем, не потерял ли текущий лидер свою позицию
    if (explicitLeader) {
      const leaderStillInTop = topPoets.some(p => p.id === explicitLeader);
      
      if (!leaderStillInTop) {
        // Текущий лидер больше не в топе - сбрасываем
        setCategoryLeader(currentUser, category, null);
        
        // Если после сброса остался только ОДИН претендент - автоматически назначаем
        if (topPoets.length === 1) {
          setCategoryLeader(currentUser, category, topPoets[0].id);
          return false;
        }
        // Если несколько претендентов - запускаем дуэль между ними
        else if (topPoets.length > 1) {
          const challenger = topPoets.find(p => p.id === changedPoetId);
          const opponent = topPoets.find(p => p.id !== changedPoetId);
          if (challenger && opponent) {
            setBattleConflict({
              category: isWorstCategory ? 'overall' : category,
              poet1: challenger,
              poet2: opponent,
              isWorstConflict: isWorstCategory
            });
            return true;
          }
        }
        return false;
      }
    }
    
    // Если только один поэт с максимальным рейтингом
    if (topPoets.length === 1) {
      const newLeader = topPoets[0].id;
      
      // Если есть старый лидер и это не он - сбросить и установить нового
      if (explicitLeader && explicitLeader !== newLeader) {
        setCategoryLeader(currentUser, category, newLeader);
      }
      // Если лидера нет вообще - установить единственного топового
      else if (!explicitLeader) {
        setCategoryLeader(currentUser, category, newLeader);
      }
      // Если это тот же лидер - ничего не делать
      else {
      }
      return false; // Дуэль не запущена
    }
    
    // Если несколько поэтов с топовым рейтингом - показываем дуэль
    
    if (explicitLeader) {
      const leaderStillOnTop = topPoets.some(p => p.id === explicitLeader);
      
      if (!leaderStillOnTop) {
        // Лидер больше не в топе, сбрасываем его
        setCategoryLeader(currentUser, category, null);
        // И показываем баттл среди новых лидеров
        const challenger = topPoets.find(p => p.id === changedPoetId);
        const opponent = topPoets.find(p => p.id !== changedPoetId);
        if (challenger && opponent) {
          setBattleConflict({
            category: isWorstCategory ? 'overall' : category,
            poet1: challenger,
            poet2: opponent,
            isWorstConflict: isWorstCategory
          });
          return true; // Дуэль запущена
        } else {
          return false;
        }
      } else if (changedPoetId !== explicitLeader) {
        // Лидер все еще в топе, НО изменился НЕ он, а кто-то другой
        // Это значит кто-то догнал лидера - нужен баттл!
        
        if (category === 'overall') {
        }
        
        const leader = topPoets.find(p => p.id === explicitLeader);
        const challenger = topPoets.find(p => p.id === changedPoetId);
        
        if (category === 'overall') {
        }
        
        if (leader && challenger) {
          if (category === 'overall') {
          }
          setBattleConflict({
            category: isWorstCategory ? 'overall' : category,
            poet1: leader,
            poet2: challenger,
            isWorstConflict: isWorstCategory
          });
          return true; // Дуэль запущена
        } else {
          if (category === 'overall') {
          }
          return false;
        }
      } else if (changedPoetId === explicitLeader) {
        // Изменился САМ лидер, и есть другие поэты с таким же топовым рейтингом
        // Нужен баттл между лидером и первым другим поэтом с топовым рейтингом!
        const leader = topPoets.find(p => p.id === explicitLeader);
        const opponent = topPoets.find(p => p.id !== explicitLeader);
        if (leader && opponent) {
          setBattleConflict({
            category: isWorstCategory ? 'overall' : category,
            poet1: leader,
            poet2: opponent,
            isWorstConflict: isWorstCategory
          });
          return true; // Дуэль запущена
        } else {
          return false;
        }
      }
      if (category === 'overall') {
      }
      return false; // Не подошло ни под один кейс
    } else {
      if (category === 'overall') {
      }
      // Нет явного лидера, показываем баттл
      const challenger = topPoets.find(p => p.id === changedPoetId);
      const opponent = topPoets.find(p => p.id !== changedPoetId);
      if (challenger && opponent) {
        setBattleConflict({
          category: isWorstCategory ? 'overall' : category,
          poet1: challenger,
          poet2: opponent,
          isWorstConflict: isWorstCategory
        });
        return true; // Дуэль запущена
      } else {
        return false;
      }
    }
  }, [poets, ratings, currentUser, categoryLeaders, setCategoryLeader, calculateScore]);
  
  // Обработчик изменения рейтинга
  const handleRatingChange = (category, newValue) => {
    if (currentUser && poet) {
      updateRating(currentUser, poet.id, category, newValue);
      
      // Сохраняем изначального поэта (для финальной дуэли)
      initialChangedPoetRef.current = poet.id;
      
      // Сохраняем информацию об изменении для useEffect
      lastRatingChange.current = {
        poetId: poet.id,
        category,
        newValue, // ← Сохраняем новое значение!
        timestamp: Date.now()
      };
    }
  };
  
  // Получить текущие рейтинги поэта для текущего пользователя
  const getCurrentRatings = () => {
    if (!currentUser || !poet) return {};
    return ratings[currentUser]?.[poet.id] || {};
  };
  
  const poetRatings = getCurrentRatings();
  
  // useEffect для проверки конфликта после обновления ratings
  useEffect(() => {
    if (lastRatingChange.current) {
      const { poetId, category, newValue } = lastRatingChange.current;
      
      
      // Проверяем конфликт для измененной категории (передаем новое значение!)
      const categoryDuelLaunched = checkForConflict(poetId, category, category, newValue);
      
      // ВАЖНО: Если изменилась категория (не overall напрямую), нужно проверить overall и worst
      // Проверка overall/worst произойдет ПОСЛЕ завершения категорийной дуэли (если она запустится)
      // ИЛИ сразу (если дуэль за категорию не запустится)
      if (category !== 'overall' && category !== 'overall_worst') {
        if (!categoryDuelLaunched) {
          const overallDuelLaunched = checkForConflict(poetId, 'overall', category, newValue);
          
          if (!overallDuelLaunched) {
            checkForConflict(poetId, 'overall_worst', category, newValue);
          } else {
          }
        } else {
        }
      }
      
      lastRatingChange.current = null; // Сбрасываем после проверки
    }
  }, [ratings, checkForConflict, battleConflict]);
  
  // Обработчик выбора победителя в баттле
  const handleBattleSelect = (winnerId) => {
    if (battleConflict && currentUser) {
      
      const wasCategory = battleConflict.category !== 'overall';
      const isWorstDuel = battleConflict.isWorstConflict;
      
      // Для худшего поэта сохраняем в 'overall_worst', для остальных - в category
      const categoryToSave = isWorstDuel ? 'overall_worst' : battleConflict.category;
      setCategoryLeader(currentUser, categoryToSave, winnerId);
      setBattleConflict(null);
      
      // После завершения дуэли за категорию, проверяем нужна ли дуэль за overall и worst
      if (wasCategory && !isWorstDuel && initialChangedPoetRef.current) {
        // Используем setTimeout чтобы состояние успело обновиться
        setTimeout(() => {
          // Передаем ИЗНАЧАЛЬНОГО поэта (того, для кого меняли оценку)
          checkForConflict(initialChangedPoetRef.current, 'overall');
          
          // После проверки overall, проверяем worst (если поэтов достаточно)
          setTimeout(() => {
            if (!battleConflict) {
              checkForConflict(initialChangedPoetRef.current, 'overall_worst');
            } else {
            }
          }, 50);
        }, 100);
      } else if (!wasCategory && !isWorstDuel && initialChangedPoetRef.current) {
        // Если завершилась дуэль за overall, проверяем worst
        setTimeout(() => {
          checkForConflict(initialChangedPoetRef.current, 'overall_worst');
        }, 100);
      } else if (isWorstDuel) {
      } else {
      }
    }
  };
  
  if (isLoading) {
    return (
      <div className="poet-detail-page">
        <div className="loading">Загрузка...</div>
      </div>
    );
  }
  
  // Открытие модалки редактирования
  const handleEditClick = () => {
    setEditName(poet.name);
    setEditImageUrl(poet.imageUrl || '');
    setEditBio(poet.bio || '');
    setEditError('');
    setShowEditModal(true);
  };
  
  // Сохранение изменений
  const handleEditSubmit = (e) => {
    e.preventDefault();
    const trimmedName = editName.trim();
    
    if (!trimmedName) {
      setEditError('Имя поэта не может быть пустым');
      return;
    }
    
    updatePoet(poet.id, {
      name: trimmedName,
      imageUrl: editImageUrl.trim(),
      bio: editBio.trim()
    });
    
    setShowEditModal(false);
  };
  
  // Генерация досье через AI для редактирования
  const generateEditPoetBio = async () => {
    const poetName = editName.trim();
    if (!poetName) {
      setEditError('Сначала введите имя поэта');
      return;
    }

    setIsGenerating(true);
    setEditError('');

    try {
      const prompt = generatePoetBioPrompt(poetName);
      const generatedText = await generateContent(prompt);
      setEditBio(generatedText);
    } catch (err) {
      console.error('Ошибка генерации:', err);
      setEditError(err.message || 'Ошибка при генерации информации');
    } finally {
      setIsGenerating(false);
    }
  };

  // Открыть Google Images для поиска портрета при редактировании
  const openEditGoogleImageSearch = () => {
    const poetName = editName.trim();
    if (!poetName) {
      setEditError('Сначала введите имя поэта');
      return;
    }
    const googleImagesUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(poetName)}`;
    window.open(googleImagesUrl, '_blank');
  };
  
  // === Функции для работы со стихотворениями ===
  
  // Проверка на дубликаты
  const isPoemDuplicate = (title) => {
    return poems.some(poem => poem.title.toLowerCase() === title.toLowerCase());
  };
  
  // Добавление стихотворения
  // Поиск ссылки на стихотворение через RapidAPI
  const searchPoemUrl = async (poetName, poemTitle) => {
    try {
      const query = `${poetName} ${poemTitle} site:rustih.ru`;
      const url = `https://google-search74.p.rapidapi.com/?query=${encodeURIComponent(query)}&limit=1&related_keywords=true`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': '58cedd75c1msha8a949d550cd81dp15949fjsn3430eac905e0',
          'X-RapidAPI-Host': 'google-search74.p.rapidapi.com'
        }
      });
      
      const data = await response.json();
      
      // Получаем первый результат
      if (data.results && data.results.length > 0) {
        return data.results[0].url || '';
      }
      
      return '';
    } catch (error) {
      console.error('Ошибка поиска ссылки:', error);
      return '';
    }
  };

  const handleAddPoem = async () => {
    const trimmedTitle = newPoemTitle.trim();
    
    if (!trimmedTitle) {
      setPoemError('Введите название стихотворения');
      return;
    }
    
    if (isPoemDuplicate(trimmedTitle)) {
      setPoemError('Такое стихотворение уже добавлено');
      return;
    }
    
    try {
      // Ищем ссылку на стихотворение
      const poemUrl = await searchPoemUrl(poet.name, trimmedTitle);
      
      // Добавляем стихотворение в Firebase с ссылкой
      await addPoem(poet.id, trimmedTitle, poemUrl);
      
      // Закрываем модалку и очищаем форму
      setShowAddPoemModal(false);
      setNewPoemTitle('');
      setPoemError('');
      setSelectedOption('random');
    } catch (err) {
      console.error('Ошибка добавления стихотворения:', err);
      setPoemError('Ошибка при добавлении стихотворения');
    }
  };
  
  // Универсальная функция генерации стихотворения
  const generatePoem = async () => {
    if (!poet) return;
    
    setIsGeneratingPoem(true);
    setPoemError('');
    
    try {
      const existingTitles = poems.map(p => p.title);
      let prompt;
      
      // Определяем какой промпт использовать
      if (selectedOption === 'random') {
        prompt = generateRandomPoemPrompt(poet.name, existingTitles);
      } else if (selectedOption === 'popular') {
        prompt = generatePopularPoemPrompt(poet.name, existingTitles);
      } else {
        // Для всех тем используем themed prompt
        prompt = generateThemedPoemPrompt(poet.name, selectedOption, existingTitles);
      }
      
      const generatedTitle = await generateContent(prompt);
      const cleanedTitle = generatedTitle.trim().replace(/^["«]|["»]$/g, '');
      
      if (isPoemDuplicate(cleanedTitle)) {
        setPoemError('Сгенерированное стихотворение уже есть в списке');
      } else {
        setNewPoemTitle(cleanedTitle);
      }
    } catch (err) {
      console.error('Ошибка генерации:', err);
      setPoemError(err.message || 'Ошибка при генерации стихотворения');
    } finally {
      setIsGeneratingPoem(false);
    }
  };
  
  // === Функции для модалки просмотра стихотворения ===
  
  // Открыть модалку стихотворения
  const handlePoemClick = (poem) => {
    setSelectedPoem(poem);
    setShowPoemModal(true);
  };
  
  // Закрыть модалку стихотворения
  const closePoemModal = () => {
    setShowPoemModal(false);
    setSelectedPoem(null);
  };
  
  // Переключить статус (viewed, liked, memorized)
  const togglePoemStatus = async (field) => {
    if (!selectedPoem || !currentUser) return;
    
    const currentValue = selectedPoem[field]?.[currentUser] || false;
    
    try {
      await updatePoemStatus(poet.id, selectedPoem.id, currentUser, field, !currentValue);
      
      // Обновляем локальное состояние
      setSelectedPoem({
        ...selectedPoem,
        [field]: {
          ...selectedPoem[field],
          [currentUser]: !currentValue
        }
      });
    } catch (err) {
      console.error(`Ошибка обновления ${field}:`, err);
    }
  };
  
  // Парсинг биографии с выделением подзаголовков
  const parseLifeStory = (text) => {
    if (!text) return null;
    
    const lines = text.split('\n');
    const elements = [];
    let currentParagraph = [];
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Пропускаем пустые строки
      if (!trimmedLine) {
        // Если накопился параграф, добавляем его
        if (currentParagraph.length > 0) {
          elements.push(
            <p key={`p-${index}`} className="life-story-paragraph">
              {currentParagraph.join(' ')}
            </p>
          );
          currentParagraph = [];
        }
        return;
      }
      
      // Проверяем, является ли строка подзаголовком 
      // Форматы: "YYYY — событие", "YYYY-YYYY — событие", "Осень YYYY — событие", "Январь YYYY — событие"
      const isHeader = /^(Весна|Лето|Осень|Зима|Январь|Февраль|Март|Апрель|Май|Июнь|Июль|Август|Сентябрь|Октябрь|Ноябрь|Декабрь|Начало|Конец)?\s*\d{4}(\s*[-–—]\s*\d{4})?\s*[-–—]/.test(trimmedLine);
      
      if (isHeader) {
        // Если накопился параграф перед заголовком, добавляем его
        if (currentParagraph.length > 0) {
          elements.push(
            <p key={`p-${index}`} className="life-story-paragraph">
              {currentParagraph.join(' ')}
            </p>
          );
          currentParagraph = [];
        }
        
        // Добавляем подзаголовок
        elements.push(
          <h3 key={`h-${index}`} className="life-story-header">
            {trimmedLine}
          </h3>
        );
      } else {
        // Накапливаем строки параграфа
        currentParagraph.push(trimmedLine);
      }
    });
    
    // Добавляем последний параграф, если есть
    if (currentParagraph.length > 0) {
      elements.push(
        <p key={`p-last`} className="life-story-paragraph">
          {currentParagraph.join(' ')}
        </p>
      );
    }
    
    return elements;
  };
  
  // Парсинг информации о влиянии
  const parseInfluence = (text) => {
    if (!text) return null;
    
    const lines = text.split('\n');
    const elements = [];
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Пропускаем пустые строки
      if (!trimmedLine) return;
      
      // Проверяем, является ли строка пунктом (начинается с "ПУНКТ" или "пункт")
      const isPunkt = trimmedLine.toLowerCase().startsWith('пункт');
      
      if (isPunkt) {
        // Удаляем маркер "пункт" (регистронезависимо) и отображаем как элемент списка
        const textWithoutPunkt = trimmedLine.replace(/^пункт\s*/i, '').trim();
        
        elements.push(
          <div key={`item-${index}`} className="influence-item">
            <span className="influence-item-text">{textWithoutPunkt}</span>
          </div>
        );
      }
    });
    
    return elements;
  };

  // Парсинг информации о творчестве
  const parseCreativity = (text) => {
    if (!text) return null;
    
    const lines = text.split('\n');
    const elements = [];
    let isReviewsSection = false;
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Пропускаем пустые строки
      if (!trimmedLine) return;
      
      // Проверяем, начинается ли раздел "Отзывы:"
      if (trimmedLine === 'Отзывы:') {
        isReviewsSection = true;
        elements.push(
          <h3 key={`reviews-header-${index}`} className="creativity-reviews-header">
            Отзывы:
          </h3>
        );
        return;
      }
      
      // Если мы в разделе отзывов и строка начинается с ОТЗЫВ
      if (isReviewsSection && trimmedLine.toLowerCase().startsWith('отзыв')) {
        const reviewText = trimmedLine.replace(/^отзыв\s*/i, '').trim();
        elements.push(
          <div key={`review-${index}`} className="creativity-review-item">
            <span className="creativity-review-text">{reviewText}</span>
          </div>
        );
        return;
      }
      
      // Обычные поля формата "Название: текст"
      const match = trimmedLine.match(/^([^:]+):\s*(.+)$/);
      
      if (match && !isReviewsSection) {
        const label = match[1].trim();
        const value = match[2].trim();
        
        elements.push(
          <div key={`creativity-${index}`} className="creativity-item">
            <span className="creativity-label">{label}:</span> {value}
          </div>
        );
      }
    });
    
    return elements;
  };

  // Парсинг информации о драме
  const parseDrama = (text) => {
    if (!text) return null;
    
    const lines = text.split('\n');
    const elements = [];
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Пропускаем пустые строки
      if (!trimmedLine) return;
      
      // Проверяем, является ли строка фактом (начинается с "ФАКТ" или "факт")
      const isFact = trimmedLine.toLowerCase().startsWith('факт');
      
      if (isFact) {
        // Удаляем маркер "факт" (регистронезависимо) и отображаем как элемент списка
        const textWithoutFact = trimmedLine.replace(/^факт\s*/i, '').trim();
        
        elements.push(
          <div key={`drama-${index}`} className="drama-item">
            <span className="drama-item-text">{textWithoutFact}</span>
          </div>
        );
      }
    });
    
    return elements;
  };

  // Парсинг информации о красоте
  const parseBeauty = (text) => {
    if (!text) return null;
    
    const lines = text.split('\n');
    const elements = [];
    let currentHeader = null;
    let currentItems = [];
    
    const flushSection = () => {
      if (currentHeader && currentItems.length > 0) {
        elements.push(
          <div key={`section-${elements.length}`}>
            <h3 className="beauty-subsection-header">{currentHeader}</h3>
            {currentItems.map((item, idx) => (
              <div key={`item-${elements.length}-${idx}`} className="beauty-item">
                <span className="beauty-item-text">{item}</span>
              </div>
            ))}
          </div>
        );
        currentItems = [];
      }
    };
    
    lines.forEach((line) => {
      const trimmedLine = line.trim();
      
      // Пропускаем пустые строки
      if (!trimmedLine) return;
      
      // Проверяем, является ли строка пунктом (начинается с "ПУНКТ" или "пункт")
      const isPunkt = trimmedLine.toLowerCase().startsWith('пункт');
      
      if (isPunkt) {
        // Это пункт - удаляем маркер и добавляем в текущую секцию
        const textWithoutPunkt = trimmedLine.replace(/^пункт\s*/i, '').trim();
        currentItems.push(textWithoutPunkt);
      } else {
        // Это заголовок - сохраняем предыдущую секцию и начинаем новую
        flushSection();
        currentHeader = trimmedLine;
      }
    });
    
    // Не забываем добавить последнюю секцию
    flushSection();
    
    return elements;
  };
  
  // Открытие модалки удаления
  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };
  
  // Подтверждение удаления
  const confirmDelete = () => {
    deletePoetFunc(poet.id);
    navigate('/');
  };

  // Обработка клика по лайку
  const handleLikeClick = () => {
    if (currentUser && poet) {
      toggleLike(currentUser, poet.id);
    }
  };

  // Проверка, лайкнул ли текущий пользователь поэта
  const isLiked = () => {
    if (!currentUser || !poet) return false;
    return likes[currentUser]?.[poet.id] || false;
  };
  
  if (!poet) {
    return (
      <div className="poet-detail-page">
        <div className="not-found">
          <h2>Поэт не найден</h2>
          <button onClick={() => navigate('/')} className="btn">
            Вернуться к списку
          </button>
        </div>
      </div>
    );
  }
  
  // Умный парсинг досье - извлекаем конкретные поля
  const parseBio = (bioText) => {
    if (!bioText) return null;
    
    const fields = {
      fullName: { label: 'Полное имя', value: '' },
      lifeYears: { label: 'Годы жизни', value: '' },
      nationality: { label: 'Национальность', value: '' },
      origin: { label: 'Происхождение', value: '' },
      birthPlace: { label: 'Место рождения', value: '' },
      deathPlace: { label: 'Место смерти', value: '' },
      causeOfDeath: { label: 'Причина смерти', value: '' },
      deathAge: { label: 'Возраст смерти', value: '' }
    };
    
    // Регулярные выражения для извлечения полей
    const patterns = {
      fullName: /Полное имя:\s*(.+?)(?=(?:Годы жизни|Национальность|Происхождение|$))/is,
      lifeYears: /Годы жизни:\s*(.+?)(?=(?:Национальность|Происхождение|Место рождения|$))/is,
      nationality: /Национальность:\s*(.+?)(?=(?:Происхождение|Место рождения|Место смерти|$))/is,
      origin: /Происхождение:\s*(.+?)(?=(?:Место рождения|Место смерти|Причина|$))/is,
      birthPlace: /Место рождения:\s*(.+?)(?=(?:Место смерти|Причина|Возраст|$))/is,
      deathPlace: /Место смерти:\s*(.+?)(?=(?:Причина|Возраст|$))/is,
      causeOfDeath: /Причина смерти:\s*(.+?)(?=(?:Возраст|$))/is,
      deathAge: /Возраст смерти:\s*(.+?)$/is
    };
    
    // Извлекаем значения для каждого поля
    Object.keys(patterns).forEach(key => {
      const match = bioText.match(patterns[key]);
      if (match && match[1]) {
        fields[key].value = match[1].trim();
      }
    });
    
    // Возвращаем только те поля, которые были найдены
    return Object.values(fields).filter(field => field.value);
  };
  
  const bioData = parseBio(poet.bio);
  
  return (
    <div className="poet-detail-page">
      <div className="poet-detail-container">
        {/* 2 основные колонки: Фото слева + Контент справа */}
        <div className="poet-content">
          {/* Колонка 1 - фото */}
          {poet.imageUrl && (
            <div className="poet-portrait">
              <div className="poet-portrait-image-wrapper">
                <img 
                  src={poet.imageUrl} 
                  alt={poet.name}
                  onClick={() => setEnlargedImage({ url: poet.imageUrl, name: poet.name })}
                  className="poet-portrait-img-clickable"
                  style={{ 
                    objectPosition: `center ${poet.imagePositionY !== undefined ? poet.imagePositionY : 25}%`
                  }}
                />
              </div>
              
              {/* Статистика по стихам */}
              <div className="poem-stats">
                <div className="stat-item">
                  <img 
                    src={currentTheme === 'classic' ? '/images/viewed.png' : '/images/viewed.png'} 
                    alt="Просмотрено" 
                    className="stat-icon"
                  />
                  <span className="stat-count">{poemStats.viewed}</span>
                </div>
                <div className="stat-item">
                  <img 
                    src={currentTheme === 'classic' ? '/images/clike.png' : '/images/like.png'} 
                    alt="Нравится" 
                    className="stat-icon"
                  />
                  <span className="stat-count">{poemStats.liked}</span>
                </div>
                <div className="stat-item">
                  <img 
                    src={currentTheme === 'classic' ? '/images/memorized.png' : '/images/memorized.png'} 
                    alt="Выучено" 
                    className="stat-icon"
                  />
                  <span className="stat-count">{poemStats.memorized}</span>
                </div>
              </div>
              
              {/* Секция ссылок в стиле Letterboxd */}
              {(() => {
                const allLinks = [];
                
                // Собираем все ссылки
                if (poet.links?.wikipedia) {
                  allLinks.push({ type: 'wiki', name: 'Википедия', url: poet.links.wikipedia });
                }
                allLinks.push({ type: 'photo', name: 'Фотографии и портреты', url: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(poet.name)}` });
                if (poet.links?.poems) {
                  allLinks.push({ type: 'poems', name: 'Стихи на Rustih.ru', url: poet.links.poems });
                }
                if (poet.links?.wikiquote) {
                  allLinks.push({ type: 'quotes', name: 'Цитаты', url: poet.links.wikiquote });
                }
                
                const ytLinks = poet.links?.youtube;
                if (ytLinks) {
                  (Array.isArray(ytLinks) ? ytLinks : Object.values(ytLinks)).forEach(yt => {
                    allLinks.push({ type: 'youtube', name: yt.title || 'YouTube', url: yt.url });
                  });
                }
                
                const otherLinks = poet.links?.other;
                if (otherLinks) {
                  (Array.isArray(otherLinks) ? otherLinks : Object.values(otherLinks)).forEach(link => {
                    allLinks.push({ type: 'other', name: link.title, url: link.url });
                  });
                }
                
                const MAX_VISIBLE = 4;
                // Если скрыта только 1 ссылка — показываем её тоже (не прячем за кнопку)
                const hiddenCount = allLinks.length - MAX_VISIBLE;
                const effectiveMax = hiddenCount === 1 ? MAX_VISIBLE + 1 : MAX_VISIBLE;
                const visibleLinks = showAllLinks ? allLinks : allLinks.slice(0, effectiveMax);
                const actualHiddenCount = allLinks.length - effectiveMax;
                
                const getIcon = (type) => {
                  switch(type) {
                    case 'wiki': return <Globe size={16} />;
                    case 'photo': return <Image size={16} />;
                    case 'poems': return <BookOpen size={16} />;
                    case 'quotes': return <Quote size={16} />;
                    case 'youtube': return <Youtube size={16} />;
                    default: return <Link size={16} />;
                  }
                };
                
                return (
                  <div className="poet-links-section">
                    <div className="links-header">
                      <span className="links-title">узнать больше</span>
                    </div>
                    
                    <div className="links-body">
                      <div className="links-list">
                        {visibleLinks.map((link, index) => (
                          <a 
                            key={index}
                            href={link.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="link-row"
                            title={link.name}
                          >
                            <span className="link-icon">{getIcon(link.type)}</span>
                            <span className="link-name">{link.name}</span>
                          </a>
                        ))}
                      </div>
                      
                      {actualHiddenCount > 0 && !showAllLinks && (
                        <button 
                          className="link-row show-more-btn"
                          onClick={() => setShowAllLinks(true)}
                          title={`Показать ещё ${actualHiddenCount}`}
                        >
                          <span className="link-icon">•••</span>
                          <span className="link-name">Показать ещё {actualHiddenCount}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
          
          {/* Колонка 2 - весь контент справа */}
          <div className="poet-right-column">
            {/* Верхняя часть: Досье и Оценки рядом */}
            <div className="poet-top-section">
              {/* Досье */}
              <div className="poet-bio-section">
            {/* Имя поэта */}
            <div className="poet-header-inline">
              <h1 className="poet-detail-name">{poet.name}</h1>
            </div>
            
            {/* Досье */}
            {bioData && bioData.length > 0 ? (
              <div className="bio-grid">
                {bioData.map((item, index) => (
                  <div key={index} className="bio-item">
                    <span className="bio-field">{item.label}:</span>{' '}
                    <span className="bio-value">{item.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-bio">
                <p>Досье пока не добавлено</p>
              </div>
            )}
              </div>
              
              {/* Оценки */}
              {currentUser && (
                <div className="poet-ratings-section">
                  {/* Блок с лайком и рейтингами */}
                  <div className="poet-ratings-header">
                    <div className="like-container">
                      <img 
                        src={
                          isLiked() 
                            ? (currentTheme === 'classic' ? '/images/clike.png' : '/images/like.png')
                            : '/images/notlike.png'
                        }
                        alt={isLiked() ? 'Убрать лайк' : 'Лайкнуть'}
                        className="like-icon"
                        onClick={handleLikeClick}
                        title={isLiked() ? 'Убрать лайк' : 'Лайкнуть'}
                      />
                    </div>
                    
                    {/* Персональный общий рейтинг текущего пользователя - всегда виден */}
                    <div className="rating-overall-container">
                      <div 
                        className="rating-overall-card rating-personal-card" 
                        onClick={() => navigate('/personal-ranking', { state: { poetId: poet.id } })}
                      >
                        <div className="rating-overall-value">
                          {getPersonalOverallRating() > 0 ? (Math.round(getPersonalOverallRating() * 100) / 100).toFixed(2) : '—'}
                        </div>
                      </div>
                    </div>
                    
                    {/* Общий средний рейтинг - всегда виден, но прочерк до определенных условий */}
                    <div className="rating-overall-container">
                      <div 
                        className="rating-overall-card" 
                        onClick={() => {
                          // Для нового поэта — просто переход (чтобы анимация прошла)
                          // Для устоявшегося — переход с раскрытием карточки
                          if (isNewPoet()) {
                            navigate('/overall-ranking');
                          } else {
                            navigate('/overall-ranking', { state: { poetId: poet.id } });
                          }
                        }}
                      >
                        <div className="rating-overall-value">
                          {hasRatings() ? (
                            isNewPoet() ? '?' : (Math.round(getOverallAverage() * 100) / 100).toFixed(2)
                          ) : '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="ratings-categories-column">
                    {Object.entries(CATEGORIES).map(([key, cat]) => {
                      const rating = poetRatings[key] || 0;
                      
                      return (
                        <div key={key} className="rating-category-card">
                          <div className="rating-category-header">
                            <span className="category-name">{cat.name}</span>
                          </div>
                          <StarRating
                            value={rating}
                            onChange={(value) => handleRatingChange(key, value)}
                          />
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Кнопки редактирования и удаления */}
                  <div className="poet-actions">
                    <button 
                      onClick={handleEditClick}
                      className="poet-action-btn"
                    >
                      Редактировать
                    </button>
                    <button 
                      onClick={handleDeleteClick}
                      className="poet-action-btn poet-action-delete"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Меню навигации контента */}
            <div className="poet-content-menu">
          <button 
            className={`menu-tab ${activeTab === 'poems' ? 'active' : ''}`}
            onClick={() => setActiveTab('poems')}
          >
            Стихи
          </button>
          <button 
            className={`menu-tab ${activeTab === 'biography' ? 'active' : ''}`}
            onClick={() => setActiveTab('biography')}
          >
            Биография
          </button>
          <button 
            className={`menu-tab ${activeTab === 'creativity' ? 'active' : ''}`}
            onClick={() => setActiveTab('creativity')}
          >
            Творчество
          </button>
          <button 
            className={`menu-tab ${activeTab === 'influence' ? 'active' : ''}`}
            onClick={() => setActiveTab('influence')}
          >
            Мораль
          </button>
          <button 
            className={`menu-tab ${activeTab === 'drama' ? 'active' : ''}`}
            onClick={() => setActiveTab('drama')}
          >
            Драма
          </button>
          <button 
            className={`menu-tab ${activeTab === 'beauty' ? 'active' : ''}`}
            onClick={() => setActiveTab('beauty')}
          >
            Красота
          </button>
            </div>
            
            {/* Контент выбранной вкладки */}
            <div className="poet-tab-content">
          {activeTab === 'biography' && (
            <div className="tab-panel">
              {poet.lifeStory ? (
                <div className="life-story">
                  {parseLifeStory(poet.lifeStory)}
                </div>
              ) : (
                <p className="no-content">Биография пока не добавлена</p>
              )}
            </div>
          )}
          {activeTab === 'poems' && (
            <div className="tab-panel">
              <div className="poems-grid">
                {poems.map((poem) => {
                  // Определяем приоритет статуса: выучено > лайкнуто > просмотрено
                  let statusClass = '';
                  if (poem.memorized?.[currentUser]) {
                    statusClass = 'memorized';
                  } else if (poem.liked?.[currentUser]) {
                    statusClass = 'liked';
                  } else if (poem.viewed?.[currentUser]) {
                    statusClass = 'viewed';
                  }
                  
                  return (
                    <div 
                      key={poem.id} 
                      className={`poem-card ${statusClass}`}
                      onClick={() => handlePoemClick(poem)}
                    >
                      <span className="poem-title">{poem.title}</span>
                    </div>
                  );
                })}
                <div 
                  className="poem-card poem-add"
                  onClick={() => setShowAddPoemModal(true)}
                >
                  <span className="poem-add-icon">+</span>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'creativity' && (
            <div className="tab-panel">
              {poet.creativity ? (
                <div className="creativity-section">
                  {parseCreativity(poet.creativity)}
                </div>
              ) : (
                <div className="no-content">Информация о творчестве не найдена</div>
              )}
            </div>
          )}
          {activeTab === 'influence' && (
            <div className="tab-panel">
              {poet.influence ? (
                <div className="influence-content">
                  {parseInfluence(poet.influence)}
                </div>
              ) : (
                <p className="no-content">Информация о влиянии пока не добавлена</p>
              )}
            </div>
          )}
          {activeTab === 'drama' && (
            <div className="tab-panel">
              {poet.drama ? (
                <div className="drama-section">
                  {parseDrama(poet.drama)}
                </div>
              ) : (
                <div className="no-content">Информация о драме не найдена</div>
              )}
            </div>
          )}
          {activeTab === 'beauty' && (
            <div className="tab-panel">
              {poet.beauty ? (
                <div className="beauty-section">
                  {parseBeauty(poet.beauty)}
                </div>
              ) : (
                <div className="no-content">Информация о красоте не найдена</div>
              )}
            </div>
          )}
            </div>
          </div>
        </div>
      </div>

      {/* Модалка увеличенного изображения */}
      {enlargedImage && (
        <div className="image-lightbox-overlay" onClick={() => setEnlargedImage(null)}>
          <div className="lightbox-controls">
            <button className="lightbox-close" onClick={() => setEnlargedImage(null)}>✕</button>
          </div>
          <div className="image-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={enlargedImage.url} alt={enlargedImage.name} />
          </div>
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
      
      {/* Модалка редактирования */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close" 
              onClick={() => setShowEditModal(false)}
              title="Закрыть"
            >
              ✕
            </button>
            <h2 className="modal-title">Редактировать поэта</h2>
            <form onSubmit={handleEditSubmit} className="poet-form">
              <div className="form-field">
                <label htmlFor="edit-poet-name">Имя и фамилия *</label>
                <input
                  id="edit-poet-name"
                  type="text"
                  value={editName}
                  onChange={(e) => {
                    setEditName(e.target.value);
                    setEditError('');
                  }}
                  className="form-input"
                  required
                />
              </div>
              
              <div className="form-field">
                <div className="label-with-button">
                  <label htmlFor="edit-poet-image">URL портрета</label>
                  <button 
                    type="button" 
                    onClick={openEditGoogleImageSearch}
                    className="btn-copy-prompt"
                    title="Открыть Google Images для поиска портрета"
                  >
                    Найти фото
                  </button>
                </div>
                <input
                  id="edit-poet-image"
                  type="url"
                  value={editImageUrl}
                  onChange={(e) => setEditImageUrl(e.target.value)}
                  className="form-input"
                  placeholder="Вставьте ссылку на изображение"
                />
              </div>
              
              <div className="form-field">
                <div className="label-with-button">
                  <label htmlFor="edit-poet-bio">Досье</label>
                  <button 
                    type="button" 
                    onClick={generateEditPoetBio}
                    className="btn-copy-prompt"
                    title="Сгенерировать досье с помощью AI"
                    disabled={isGenerating}
                  >
                    {isGenerating ? 'Генерация...' : 'AI ✨'}
                  </button>
                </div>
                <textarea
                  id="edit-poet-bio"
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder={isGenerating ? 'Генерирую информацию...' : 'Введите информацию о поэте или нажмите AI для автогенерации'}
                  className="form-textarea"
                  rows="8"
                  disabled={isGenerating}
                />
              </div>
              
              {editError && <div className="form-error">{editError}</div>}
              
              <div className="form-actions">
                <button 
                  type="button" 
                  onClick={() => setShowEditModal(false)} 
                  className="btn-cancel"
                >
                  Отмена
                </button>
                <button type="submit" className="btn-add-confirm">
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Модалка удаления */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowDeleteModal(false)} className="modal-close">✕</button>
            <h2 className="modal-title delete-title">Удаление поэта</h2>
            <div className="delete-message">
              <p>Вы уверены, что хотите удалить поэта <span className="delete-poet-name">"{poet.name}"</span>?</p>
            </div>
            <div className="delete-actions">
              <button onClick={() => setShowDeleteModal(false)} className="btn-cancel">
                Отмена
              </button>
              <button onClick={confirmDelete} className="btn-delete-confirm">
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Модалка добавления стихотворения */}
      {showAddPoemModal && (
        <div className="modal-overlay" onClick={() => setShowAddPoemModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close" 
              onClick={() => setShowAddPoemModal(false)}
              title="Закрыть"
            >
              ✕
            </button>
            <h2 className="modal-title">Добавить стихотворение</h2>
            
            <div className="poem-form">
              <div className="form-field">
                <label htmlFor="poem-title">Название</label>
                <input
                  id="poem-title"
                  type="text"
                  value={newPoemTitle}
                  onChange={(e) => {
                    setNewPoemTitle(e.target.value);
                    setPoemError('');
                  }}
                  className="form-input"
                  placeholder="Введите название или сгенерируйте"
                  disabled={isGeneratingPoem}
                />
                {poemError && <div className="field-error">{poemError}</div>}
              </div>
              
              <div className="poem-generation-section">
                <p className="generation-title">Генерация с помощью AI</p>
                
                <div className="generation-controls">
                  <select
                    id="poem-option"
                    value={selectedOption}
                    onChange={(e) => setSelectedOption(e.target.value)}
                    className="option-select"
                    disabled={isGeneratingPoem}
                  >
                    {POEM_GENERATION_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={generatePoem}
                    className="btn-generate"
                    disabled={isGeneratingPoem}
                  >
                    {isGeneratingPoem ? 'Генерация...' : 'Сгенерировать'}
                  </button>
                </div>
              </div>
              
              <div className="form-actions">
                <button 
                  onClick={() => setShowAddPoemModal(false)} 
                  className="btn-cancel"
                  disabled={isGeneratingPoem}
                >
                  Отмена
                </button>
                <button 
                  onClick={handleAddPoem} 
                  className="btn-add-confirm"
                  disabled={isGeneratingPoem}
                >
                  Добавить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Модалка просмотра стихотворения */}
      {showPoemModal && selectedPoem && (
        <div className="modal-overlay" onClick={closePoemModal}>
          <div className="modal-content poem-view-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close" 
              onClick={closePoemModal}
              title="Закрыть"
            >
              ✕
            </button>
            
            {selectedPoem.url ? (
              <a 
                href={selectedPoem.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="modal-title poem-title-link"
                title="Открыть на rustih.ru"
              >
                <span className="poem-title-modal">{selectedPoem.title}</span>
              </a>
            ) : (
              <h2 className="modal-title">{selectedPoem.title}</h2>
            )}
            
            <div className="poem-view-content">
              {/* Статусы стихотворения */}
              <div className="poem-statuses">
                {/* Просмотрено */}
                <div className="status-item" onClick={() => togglePoemStatus('viewed')}>
                  <img 
                    src={selectedPoem.viewed?.[currentUser] 
                      ? currentTheme === 'classic' ? '/images/viewed.png' : '/images/viewed.png'
                      : currentTheme === 'classic' ? '/images/notviewed.png' : '/images/notviewed.png'
                    }
                    alt={selectedPoem.viewed?.[currentUser] ? 'Просмотрено' : 'Не просмотрено'}
                    className="status-icon status-icon-viewed"
                    title={selectedPoem.viewed?.[currentUser] ? 'Просмотрено' : 'Не просмотрено'}
                  />
                  <span className="status-label">Просмотрено</span>
                </div>
                
                {/* Нравится */}
                <div className="status-item" onClick={() => togglePoemStatus('liked')}>
                  <img 
                    src={selectedPoem.liked?.[currentUser] 
                      ? currentTheme === 'classic' ? '/images/clike.png' : '/images/like.png'
                      : '/images/notlike.png'
                    }
                    alt={selectedPoem.liked?.[currentUser] ? 'Нравится' : 'Не нравится'}
                    className="status-icon"
                    title={selectedPoem.liked?.[currentUser] ? 'Нравится' : 'Не нравится'}
                  />
                  <span className="status-label">Нравится</span>
                </div>
                
                {/* Выучено наизусть */}
                <div className="status-item" onClick={() => togglePoemStatus('memorized')}>
                  <img 
                    src={selectedPoem.memorized?.[currentUser] 
                      ? currentTheme === 'classic' ? '/images/memorized.png' : '/images/memorized.png'
                      : currentTheme === 'classic' ? '/images/notmemorized.png' : '/images/notmemorized.png'
                    }
                    alt={selectedPoem.memorized?.[currentUser] ? 'Выучено' : 'Не выучено'}
                    className="status-icon"
                    title={selectedPoem.memorized?.[currentUser] ? 'Выучено наизусть' : 'Не выучено'}
                  />
                  <span className="status-label">Выучено</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PoetDetailPage;

