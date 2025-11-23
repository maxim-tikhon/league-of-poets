import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePoets } from '../context/PoetsContext';
import { generateContent, generateAIRating } from '../ai/gemini';
import { generatePoetBioPrompt, generatePoetLifeStoryPrompt, generatePoetInfluencePrompt, generatePoetCreativityPrompt, generatePoetDramaPrompt, generatePoetBeautyPrompt, generateAIRatingPrompt, parseAIRating, generateRandomPoetPrompt } from '../ai/prompts';
import './PoetsPage.css';

const PoetsPage = () => {
  const { poets, ratings, calculateScore, isLoading, addPoet, updatePoet, deletePoet, likes } = usePoets();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [newPoetName, setNewPoetName] = useState('');
  const [newPoetImageUrl, setNewPoetImageUrl] = useState('');
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('date'); // 'date', 'firstName', 'lastName', 'rating'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc', 'desc'
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { poetId, poetName }
  const [showRatings, setShowRatings] = useState(false); // Показывать оценки всегда
  const [showFavorites, setShowFavorites] = useState(false); // Показывать только любимых
  const [isFirstLoad, setIsFirstLoad] = useState(true); // Флаг первой загрузки для анимации
  const [showNotification, setShowNotification] = useState(false); // Нотификация о копировании
  const [currentUser, setCurrentUser] = useState(null); // Текущий пользователь
  const [isGeneratingPoet, setIsGeneratingPoet] = useState(false); // Генерация случайного поэта

  // Получаем текущего пользователя из localStorage
  useEffect(() => {
    const user = localStorage.getItem('currentUser');
    setCurrentUser(user);
  }, []);

  const handleSort = (newSortBy) => {
    setIsFirstLoad(false); // Убираем анимацию при изменении сортировки
    
    if (sortBy === newSortBy) {
      // Переключаем порядок, если кликнули на ту же кнопку
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Новая сортировка - устанавливаем по умолчанию
      setSortBy(newSortBy);
      if (newSortBy === 'date') {
        setSortOrder('desc'); // По умолчанию новые первыми
      } else if (newSortBy === 'rating') {
        setSortOrder('desc'); // По умолчанию высокий рейтинг первым
      } else {
        setSortOrder('asc'); // По имени/фамилии - А→Я
      }
    }
  };

  // Генерация случайного поэта через AI
  const handleGenerateRandomPoet = async () => {
    setIsGeneratingPoet(true);
    setError('');
    
    try {
      // Список уже добавленных поэтов
      const existingPoets = poets.map(p => p.name);
      
      // Запрашиваем у AI случайного поэта
      const prompt = generateRandomPoetPrompt(existingPoets);
      const response = await generateContent(prompt, 0.9); // Высокая temperature для случайности
      
      // Очищаем ответ от лишних символов
      const poetName = response.trim().replace(/["""«»]/g, '');
      
      // Проверяем, что имя не пустое
      if (poetName && poetName.length > 2) {
        // Проверяем на дубликат
        if (poets.some(p => p.name.toLowerCase() === poetName.toLowerCase())) {
          setError('Этот поэт уже добавлен. Попробуйте ещё раз.');
        } else {
          setNewPoetName(poetName);
        }
      } else {
        setError('AI не смог сгенерировать поэта. Попробуйте ещё раз.');
      }
    } catch (err) {
      console.error('Ошибка генерации поэта:', err);
      setError('Ошибка при генерации поэта');
    } finally {
      setIsGeneratingPoet(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedName = newPoetName.trim();
    if (!trimmedName) {
      setError('Пожалуйста, введите имя поэта');
      return;
    }

    if (trimmedName.length < 2) {
      setError('Имя слишком короткое');
      return;
    }

    // Проверка на дубликат
    if (poets.some(p => p.name.toLowerCase() === trimmedName.toLowerCase())) {
      setError('Этот поэт уже добавлен');
      return;
    }

    // Создаем поэта сразу с базовой информацией
    const newPoet = await addPoet(trimmedName, newPoetImageUrl.trim(), '', '', '', '', '', '');
    
    // Закрываем модалку сразу
    setNewPoetName('');
    setNewPoetImageUrl('');
    setShowModal(false);
    
    // Генерируем информацию асинхронно в фоне
    (async () => {
      try {
        // Генерируем досье
        const bioPrompt = generatePoetBioPrompt(trimmedName);
        const generatedBio = await generateContent(bioPrompt);
        await updatePoet(newPoet.id, { bio: generatedBio });
        
        // Генерируем биографию (жизненный путь)
        const lifeStoryPrompt = generatePoetLifeStoryPrompt(trimmedName);
        const generatedLifeStory = await generateContent(lifeStoryPrompt);
        await updatePoet(newPoet.id, { lifeStory: generatedLifeStory });
        
        // Генерируем влияние
        const influencePrompt = generatePoetInfluencePrompt(trimmedName);
        const generatedInfluence = await generateContent(influencePrompt);
        await updatePoet(newPoet.id, { influence: generatedInfluence });
        
        // Генерируем творчество
        const creativityPrompt = generatePoetCreativityPrompt(trimmedName);
        const generatedCreativity = await generateContent(creativityPrompt);
        await updatePoet(newPoet.id, { creativity: generatedCreativity });
        
        // Генерируем драму
        const dramaPrompt = generatePoetDramaPrompt(trimmedName);
        const generatedDrama = await generateContent(dramaPrompt);
        await updatePoet(newPoet.id, { drama: generatedDrama });
        
        // Генерируем красоту
        const beautyPrompt = generatePoetBeautyPrompt(trimmedName);
        const generatedBeauty = await generateContent(beautyPrompt);
        await updatePoet(newPoet.id, { beauty: generatedBeauty });

        // Генерируем AI-рейтинг (3 запроса с усреднением для справедливости)
        // Собираем существующие AI-рейтинги других поэтов для контекста
        const existingAIRatings = poets
          .filter(p => p.aiRatings && Object.keys(p.aiRatings).length > 0)
          .map(p => ({
            name: p.name,
            ratings: p.aiRatings
          }));
        
        const aiRatingPrompt = generateAIRatingPrompt(trimmedName, existingAIRatings);
        const aiRatings = await generateAIRating(aiRatingPrompt, parseAIRating);
        await updatePoet(newPoet.id, { aiRatings });

      } catch (err) {
        console.error('Ошибка фоновой генерации:', err);
      }
    })();
  };

  const handleDeleteClick = (poetId, poetName) => {
    setDeleteConfirm({ poetId, poetName });
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      deletePoet(deleteConfirm.poetId);
      setDeleteConfirm(null);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm(null);
  };

  // Открыть Google Images для поиска портрета
  const openGoogleImageSearch = () => {
    const poetName = newPoetName.trim();
    if (!poetName) {
      setError('Сначала введите имя поэта');
      return;
    }
    const googleImagesUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(poetName)}`;
    window.open(googleImagesUrl, '_blank');
  };

  // Функция для получения имени (первое слово)
  const getFirstName = (fullName) => {
    const parts = fullName.split(' ');
    return parts[0] || fullName;
  };

  // Функция для получения фамилии (второе слово)
  const getLastName = (fullName) => {
    const parts = fullName.split(' ');
    return parts.length > 1 ? parts[parts.length - 1] : fullName;
  };

  // Функция для получения среднего рейтинга
  const getAverageRating = (poetId) => {
    const maximScore = calculateScore('maxim', poetId);
    const olegScore = calculateScore('oleg', poetId);
    
    // Если оба пользователя оценили - среднее
    if (maximScore > 0 && olegScore > 0) {
      return (maximScore + olegScore) / 2;
    }
    
    // Если только один пользователь оценил - его балл
    return maximScore > 0 ? maximScore : olegScore;
  };

  // Сортировка и фильтрация поэтов
  const getSortedPoets = () => {
    // Фильтрация по избранным
    let filteredPoets = [...poets];
    if (showFavorites && currentUser) {
      filteredPoets = filteredPoets.filter(poet => likes[currentUser]?.[poet.id]);
    }

    // Сортировка
    const sorted = filteredPoets.sort((a, b) => {
      let comparison = 0;

      if (sortBy === 'date') {
        const dateA = new Date(a.addedAt || 0);
        const dateB = new Date(b.addedAt || 0);
        comparison = dateB - dateA; // По умолчанию новые первые
      } else if (sortBy === 'firstName') {
        const firstNameA = getFirstName(a.name).toLowerCase();
        const firstNameB = getFirstName(b.name).toLowerCase();
        comparison = firstNameA.localeCompare(firstNameB, 'ru');
      } else if (sortBy === 'lastName') {
        const lastNameA = getLastName(a.name).toLowerCase();
        const lastNameB = getLastName(b.name).toLowerCase();
        comparison = lastNameA.localeCompare(lastNameB, 'ru');
      } else if (sortBy === 'rating') {
        const ratingA = getAverageRating(a.id);
        const ratingB = getAverageRating(b.id);
        comparison = ratingB - ratingA; // По умолчанию высокий рейтинг первым
      }

      return sortOrder === 'asc' ? -comparison : comparison;
    });

    return sorted;
  };

  const sortedPoets = getSortedPoets();

  return (
    <div className="poets-page fade-in">
      {/* <div className="page-header">
        <h1 className="page-title">
          <span className="title-icon">📚</span>
          Поэты
          <span className="poets-count-inline">({poets.length})</span>
        </h1>
      </div> */}

      <div className="sorting-controls">
        <button 
          className={`sort-btn ${sortBy === 'date' ? 'active' : ''}`}
          onClick={() => handleSort('date')}
        >
          Дата {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
        <button 
          className={`sort-btn ${sortBy === 'firstName' ? 'active' : ''}`}
          onClick={() => handleSort('firstName')}
        >
          Имя {sortBy === 'firstName' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
        <button 
          className={`sort-btn ${sortBy === 'lastName' ? 'active' : ''}`}
          onClick={() => handleSort('lastName')}
        >
          Фамилия {sortBy === 'lastName' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
        <button 
          className={`sort-btn ${sortBy === 'rating' ? 'active' : ''}`}
          onClick={() => handleSort('rating')}
        >
          Рейтинг {sortBy === 'rating' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
        
        <div className="ratings-toggle-inline">
          <label className="toggle-label">
            <input 
              type="checkbox" 
              checked={showRatings}
              onChange={(e) => setShowRatings(e.target.checked)}
              className="toggle-checkbox"
            />
            <span className="toggle-switch"></span>
            <span className="toggle-text">Оценки</span>
          </label>
        </div>

        {/* <div className="ratings-toggle-inline">
          <label className="toggle-label">
            <input 
              type="checkbox" 
              checked={showFavorites}
              onChange={(e) => {
                setShowFavorites(e.target.checked);
                setIsFirstLoad(false);
              }}
              className="toggle-checkbox"
            />
            <span className="toggle-switch"></span>
            <span className="toggle-text">Любимые</span>
          </label>
        </div> */}

        <button 
          onClick={() => setShowModal(true)} 
          className="btn-add-poet"
        >
          Добавить
        </button>
      </div>
      
      {/* Модалка добавления поэта */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close" 
              onClick={() => setShowModal(false)}
              title="Закрыть"
            >
              ✕
            </button>
            <h2 className="modal-title">Новый поэт</h2>
            <form onSubmit={handleSubmit} className="poet-form">
              <div className="form-field">
                <div className="label-with-button">
                  <label htmlFor="poet-name">Имя и фамилия *</label>
                  <button 
                    type="button" 
                    onClick={handleGenerateRandomPoet}
                    className="btn-copy-prompt"
                    title="Сгенерировать случайного русского поэта"
                    disabled={isGeneratingPoet}
                  >
                    {isGeneratingPoet ? 'Генерация...' : 'Случайный поэт'}
                  </button>
                </div>
                <input
                  id="poet-name"
                  type="text"
                  value={newPoetName}
                  onChange={(e) => {
                    setNewPoetName(e.target.value);
                    setError('');
                  }}
                  className="form-input"
                  placeholder="Имя Фамилия"
                />
                {error && <div className="field-error">{error}</div>}
              </div>
              
              <div className="form-field">
                <div className="label-with-button">
                  <label htmlFor="poet-image">URL портрета</label>
                  <button 
                    type="button" 
                    onClick={openGoogleImageSearch}
                    className="btn-copy-prompt"
                    title="Открыть Google Images для поиска портрета"
                  >
                    Найти фото
                  </button>
                </div>
                <input
                  id="poet-image"
                  type="url"
                  value={newPoetImageUrl}
                  onChange={(e) => setNewPoetImageUrl(e.target.value)}
                  className="form-input"
                  placeholder="Вставьте ссылку на изображение"
                />

              </div>
              
              <div className="form-actions">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="btn-cancel"
                >
                  Отмена
                </button>
                <button 
                  type="submit" 
                  className="btn-add-confirm"
                >
                  Добавить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {sortedPoets.length === 0 ? (
        <div className="empty-state">
          <img src="/images/poet2.png" alt="Нет поэтов" className="empty-icon" />
          {showFavorites ? (
            <>
              <p>У вас пока нет любимых поэтов</p>
              <p className="empty-hint">Добавьте поэтов в избранное, нажав на ❤️ на странице поэта</p>
            </>
          ) : (
            <>
              <p>Пока нет ни одного поэта в списке</p>
              <p className="empty-hint">Добавьте первого поэта, чтобы начать соревнование</p>
            </>
          )}
        </div>
      ) : (
        <div className="poets-grid">
          {sortedPoets.map(poet => {
            const averageRating = getAverageRating(poet.id);
            const hasRating = averageRating > 0;
            
            return (
              <div key={poet.id} className={`poet-card ${isFirstLoad ? 'animate-in' : ''}`} onClick={() => navigate(`/poet/${poet.id}`)}>
                <div className="poet-card-image">
                  {poet.imageUrl ? (
                    <>
                      <img src={poet.imageUrl} alt={poet.name} />
                      <div className="poet-card-overlay">
                        <h3 className="poet-card-name">
                          {(() => {
                            const nameParts = poet.name.split(' ');
                            if (nameParts.length >= 2) {
                              return (
                                <>
                                  <span className="first-name">{nameParts[0]}</span>
                                  <br />
                                  <span className="last-name">{nameParts.slice(1).join(' ')}</span>
                                </>
                              );
                            }
                            return poet.name;
                          })()}
                        </h3>
                        {hasRating && (
                          <div className={`poet-card-rating ${showRatings ? 'always-visible' : ''}`}>
                            {(Math.round(averageRating * 100) / 100).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="poet-card-placeholder">
                      <img src="/images/poet.png" alt="Поэт" className="placeholder-icon" />
                      <h3 className="poet-card-name">{poet.name}</h3>
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Предотвращаем переход на страницу поэта
                    handleDeleteClick(poet.id, poet.name);
                  }}
                  className="btn-delete-card"
                  title="Удалить поэта"
                ></button>
              </div>
            );
          })}
        </div>
      )}

      {/* Модалка подтверждения удаления */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={cancelDelete}>
          <div className="modal-content delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <button onClick={cancelDelete} className="modal-close">✕</button>
            <h2 className="modal-title delete-title">Удаление поэта</h2>
            <div className="delete-message">
              <p>Вы уверены, что хотите удалить поэта <span className="delete-poet-name">"{deleteConfirm.poetName}"?</span></p>
              {/* <p className="delete-poet-name">"{deleteConfirm.poetName}"?</p> */}
            </div>
            <div className="delete-actions">
              <button onClick={cancelDelete} className="btn-cancel">
                Отмена
              </button>
              <button onClick={confirmDelete} className="btn-delete-confirm">
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Нотификация о копировании */}
      {showNotification && (
        <div className="notification">
          <svg className="notification-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <span>Промпт скопирован</span>
        </div>
      )}
    </div>
  );
};

export default PoetsPage;

