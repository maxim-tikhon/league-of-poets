import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePoets } from '../context/PoetsContext';
import './PoetsPage.css';

const PoetsPage = () => {
  const { poets, ratings, calculateScore, isLoading, addPoet, deletePoet } = usePoets();
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

  const handleSort = (newSortBy) => {
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

  const copyPromptToClipboard = () => {
    const poetName = newPoetName.trim() || '[имя поэта]';
    const prompt = `Составь краткое досье на ${poetName} в виде списка (карточки) с полями (названия полей выдели жирным, каждое поле с новой строки - следуй формату):

Полное имя

Годы жизни

Национальность и происхождение (например, русский, дворянское)

Место рождения

Место смерти (не только город, но и если известно место)

Причина смерти

Сделай ответ компактным, в виде списка, как карточку.

Пример досье:

Полное имя: Александр Сергеевич Пушкин

Годы жизни: 6 июня 1799 - 10 февраля 1837 (37 лет) - в скобках укажи возраст на момент смерти

Национальность и происхождение: русский, дворянское

Место рождения: Москва, в родовом имении дворян Пушкиных

Место смерти: Санкт-Петербург, в квартире на набережной Мойки

Причина смерти: смертельное ранение на дуэли`;

    navigator.clipboard.writeText(prompt).then(() => {
      alert('Промпт скопирован в буфер обмена!');
    }).catch(err => {
      console.error('Ошибка копирования:', err);
    });
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
    return (maximScore + olegScore) / 2;
  };

  // Сортировка поэтов
  const getSortedPoets = () => {
    const sorted = [...poets].sort((a, b) => {
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
      <div className="page-header">
        <h1 className="page-title">
          <span className="title-icon">📚</span>
          Поэты
          <span className="poets-count-inline">({poets.length})</span>
        </h1>
      </div>

      <div className="sorting-controls">
        <span>Сортировать по:</span>
        <button 
          className={`sort-btn ${sortBy === 'date' ? 'active' : ''}`}
          onClick={() => handleSort('date')}
        >
          Дате {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
        <button 
          className={`sort-btn ${sortBy === 'firstName' ? 'active' : ''}`}
          onClick={() => handleSort('firstName')}
        >
          Имени {sortBy === 'firstName' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
        <button 
          className={`sort-btn ${sortBy === 'lastName' ? 'active' : ''}`}
          onClick={() => handleSort('lastName')}
        >
          Фамилии {sortBy === 'lastName' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
        <button 
          className={`sort-btn ${sortBy === 'rating' ? 'active' : ''}`}
          onClick={() => handleSort('rating')}
        >
          Рейтингу {sortBy === 'rating' && (sortOrder === 'asc' ? '↑' : '↓')}
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
            <span className="toggle-text">Показать оценки</span>
          </label>
        </div>

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
            <h2 className="modal-title">📝 Новый поэт</h2>
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
                <label htmlFor="poet-image">URL портрета</label>
                <input
                  id="poet-image"
                  type="url"
                  value={newPoetImageUrl}
                  onChange={(e) => setNewPoetImageUrl(e.target.value)}
                  className="form-input"
                />

              </div>
              
              <div className="form-field">
                <div className="label-with-button">
                  <label htmlFor="poet-bio">Досье</label>
                  <button 
                    type="button" 
                    onClick={copyPromptToClipboard}
                    className="btn-copy-prompt"
                    title="Скопировать промпт для получения досье"
                  >
                    📋 Копировать промпт
                  </button>
                </div>
                <textarea
                  id="poet-bio"
                  value={newPoetBio}
                  onChange={(e) => setNewPoetBio(e.target.value)}
                 
                  className="form-textarea"
                  rows="8"
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

      {poets.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">📚</span>
          <p>Пока нет ни одного поэта в списке</p>
          <p className="empty-hint">Добавьте первого поэта, чтобы начать соревнование</p>
        </div>
      ) : (
        <div className="poets-grid">
          {sortedPoets.map(poet => {
            const averageRating = getAverageRating(poet.id);
            const hasRating = averageRating > 0;
            
            return (
              <div key={poet.id} className="poet-card" onClick={() => navigate(`/poet/${poet.id}`)}>
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
                      <span className="placeholder-icon">📚</span>
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
            <h2 className="modal-title delete-title">⚠️ Удаление поэта</h2>
            <div className="delete-message">
              <p>Вы уверены, что хотите удалить поэта</p>
              <p className="delete-poet-name">"{deleteConfirm.poetName}"?</p>
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
    </div>
  );
};

export default PoetsPage;

