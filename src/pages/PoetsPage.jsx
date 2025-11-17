import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePoets } from '../context/PoetsContext';
import { generateContent } from '../ai/gemini';
import { generatePoetBioPrompt } from '../ai/prompts';
import './PoetsPage.css';

const PoetsPage = () => {
  const { poets, ratings, calculateScore, isLoading, addPoet, deletePoet, likes } = usePoets();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [newPoetName, setNewPoetName] = useState('');
  const [newPoetImageUrl, setNewPoetImageUrl] = useState('');
  const [newPoetBio, setNewPoetBio] = useState('');
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('date'); // 'date', 'firstName', 'lastName', 'rating'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc', 'desc'
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { poetId, poetName }
  const [showRatings, setShowRatings] = useState(false); // Показывать оценки всегда
  const [showFavorites, setShowFavorites] = useState(false); // Показывать только любимых
  const [isFirstLoad, setIsFirstLoad] = useState(true); // Флаг первой загрузки для анимации
  const [showNotification, setShowNotification] = useState(false); // Нотификация о копировании
  const [isGenerating, setIsGenerating] = useState(false); // Генерация AI
  const [currentUser, setCurrentUser] = useState(null); // Текущий пользователь

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

  const handleSubmit = (e) => {
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

    addPoet(trimmedName, newPoetImageUrl.trim(), newPoetBio.trim());
    setNewPoetName('');
    setNewPoetImageUrl('');
    setNewPoetBio('');
    setShowModal(false);
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

  const generatePoetBio = async () => {
    const poetName = newPoetName.trim();
    if (!poetName) {
      setError('Сначала введите имя поэта');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      // Генерируем промпт из модуля prompts.js
      const prompt = generatePoetBioPrompt(poetName);
      
      // Получаем контент через модуль gemini.js
      const generatedText = await generateContent(prompt);
      
      setNewPoetBio(generatedText);
      
    } catch (err) {
      console.error('Ошибка генерации:', err);
      setError(err.message || 'Ошибка при генерации информации');
    } finally {
      setIsGenerating(false);
    }
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
          Добавить поэта
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
                <label htmlFor="poet-name">Имя и фамилия *</label>
                <input
                  id="poet-name"
                  type="text"
                  value={newPoetName}
                  onChange={(e) => {
                    setNewPoetName(e.target.value);
                    setError('');
                  }}
                  className="form-input"
                  required
                />
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
              
              <div className="form-field">
                <div className="label-with-button">
                  <label htmlFor="poet-bio">Досье</label>
                  <button 
                    type="button" 
                    onClick={generatePoetBio}
                    className="btn-copy-prompt"
                    title="Сгенерировать досье с помощью AI"
                    disabled={isGenerating}
                  >
                    {isGenerating ? 'Генерация...' : 'AI ✨'}
                  </button>
                </div>
                <textarea
                  id="poet-bio"
                  value={newPoetBio}
                  onChange={(e) => setNewPoetBio(e.target.value)}
                  placeholder={isGenerating ? 'Генерирую информацию...' : 'Введите информацию о поэте или нажмите AI для автогенерации'}
                  className="form-textarea"
                  rows="8"
                  disabled={isGenerating}
                />

              </div>
              
              {error && <p className="error-message">{error}</p>}
              
              <div className="form-actions">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="btn-cancel"
                >
                  Отмена
                </button>
                <button type="submit" className="btn-add-confirm">
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
                            {((averageRating / 100) * 5).toFixed(1)}
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

