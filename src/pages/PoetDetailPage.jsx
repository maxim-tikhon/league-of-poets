import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePoets, CATEGORIES } from '../context/PoetsContext';
import StarRating from '../components/StarRating';
import BattleModal from '../components/BattleModal';
import { generateContent } from '../ai/gemini';
import { generatePoetBioPrompt } from '../ai/prompts';
import './PoetDetailPage.css';

const PoetDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { poets, ratings, calculateScore, isLoading, updateRating, categoryLeaders, setCategoryLeader, deletePoet, updatePoet, likes, toggleLike } = usePoets();
  
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
  
  // Расчет общей средней оценки (в 5-балльной шкале)
  const getOverallAverage = () => {
    if (!poet) return 0;
    const maximScore = calculateScore('maxim', poet.id);
    const olegScore = calculateScore('oleg', poet.id);
    
    // Если оба пользователя оценили - среднее
    let averageScore;
    if (maximScore > 0 && olegScore > 0) {
      averageScore = (maximScore + olegScore) / 2;
    } else {
      // Если только один пользователь оценил - его балл
      averageScore = maximScore > 0 ? maximScore : olegScore;
    }
    
    return (averageScore / 100) * 5; // Конвертация в 5-балльную систему
  };
  
  // Получить персональный общий рейтинг текущего пользователя (в 5-балльной шкале)
  const getPersonalOverallRating = () => {
    if (!poet || !currentUser) return 0;
    const userScore = calculateScore(currentUser, poet.id);
    return (userScore / 100) * 5; // Конвертация в 5-балльную систему
  };
  
  // Проверка конфликта: есть ли другие поэты с таким же максимальным баллом
  const checkForConflict = useCallback((changedPoetId, category) => {
    if (!currentUser) return;
    
    // Для общего балла используем calculateScore, для категорий - рейтинг категории
    const poetsWithRatings = poets.map(poet => ({
      id: poet.id,
      name: poet.name,
      imageUrl: poet.imageUrl,
      rating: category === 'overall' 
        ? calculateScore(currentUser, poet.id)
        : (ratings[currentUser]?.[poet.id]?.[category] || 0)
    })).filter(p => p.rating > 0);
    
    if (poetsWithRatings.length === 0) {
      // Нет поэтов с рейтингом - сбрасываем лидера если был
      const explicitLeader = categoryLeaders[currentUser]?.[category];
      if (explicitLeader) {
        setCategoryLeader(currentUser, category, null);
      }
      return;
    }
    
    // Находим максимальный рейтинг
    poetsWithRatings.sort((a, b) => b.rating - a.rating);
    const topRating = poetsWithRatings[0].rating;
    const topPoets = poetsWithRatings.filter(p => Math.abs(p.rating - topRating) < 0.01);
    
    const explicitLeader = categoryLeaders[currentUser]?.[category];
    
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
      return;
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
            category,
            poet1: challenger,
            poet2: opponent
          });
        }
      } else if (changedPoetId !== explicitLeader) {
        // Лидер все еще в топе, НО изменился НЕ он, а кто-то другой
        // Это значит кто-то догнал лидера - нужен баттл!
        const leader = topPoets.find(p => p.id === explicitLeader);
        const challenger = topPoets.find(p => p.id === changedPoetId);
        if (leader && challenger) {
          setBattleConflict({
            category,
            poet1: leader,
            poet2: challenger
          });
        }
      }
    } else {
      // Нет явного лидера, показываем баттл
      const challenger = topPoets.find(p => p.id === changedPoetId);
      const opponent = topPoets.find(p => p.id !== changedPoetId);
      if (challenger && opponent) {
        setBattleConflict({
          category,
          poet1: challenger,
          poet2: opponent
        });
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
      const { poetId, category } = lastRatingChange.current;
      
      // Проверяем конфликт для измененной категории
      checkForConflict(poetId, category);
      
      // НЕ проверяем общий балл здесь - он будет проверен после завершения дуэли за категорию
      lastRatingChange.current = null; // Сбрасываем после проверки
    }
  }, [ratings, checkForConflict]);
  
  // Обработчик выбора победителя в баттле
  const handleBattleSelect = (winnerId) => {
    if (battleConflict && currentUser) {
      const wasCategory = battleConflict.category !== 'overall';
      
      setCategoryLeader(currentUser, battleConflict.category, winnerId);
      setBattleConflict(null);
      
      // После завершения дуэли за категорию, проверяем нужна ли дуэль за overall
      if (wasCategory && initialChangedPoetRef.current) {
        // Используем setTimeout чтобы состояние успело обновиться
        setTimeout(() => {
          // Передаем ИЗНАЧАЛЬНОГО поэта (того, для кого меняли оценку)
          checkForConflict(initialChangedPoetRef.current, 'overall');
        }, 100);
      }
    }
  };
  
  if (isLoading) {
    return (
      <div className="poet-detail-page fade-in">
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
  
  // Открытие модалки удаления
  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };
  
  // Подтверждение удаления
  const confirmDelete = () => {
    deletePoet(poet.id);
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
      <div className="poet-detail-page fade-in">
        <div className="not-found">
          <h2>Поэт не найден</h2>
          <button onClick={() => navigate('/poets')} className="btn">
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
    <div className="poet-detail-page fade-in">
      <div className="poet-detail-container">
        {/* 3 колонки: Фото + Досье + Оценки */}
        <div className="poet-content">
          {/* Колонка 1 - фото */}
          {poet.imageUrl && (
            <div className="poet-portrait">
              <img 
                src={poet.imageUrl} 
                alt={poet.name}
                onClick={() => setEnlargedImage({ url: poet.imageUrl, name: poet.name })}
                className="poet-portrait-img-clickable"
              />
            </div>
          )}
          
          {/* Колонка 2 - имя + досье */}
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
          
          {/* Колонка 3 - оценки по категориям */}
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
                        alt={isLiked() ? 'Убрать из избранного' : 'Добавить в избранное'}
                        className="like-icon"
                        onClick={handleLikeClick}
                        title={isLiked() ? 'Убрать из избранного' : 'Добавить в избранное'}
                      />
                    </div>
                    
                    {/* Персональный общий рейтинг текущего пользователя - всегда виден */}
                    <div className="rating-overall-container">
                      <div 
                        className="rating-overall-card rating-personal-card" 
                        onClick={() => navigate(`/${currentUser}-ranking`, { state: { poetId: poet.id } })}
                      >
                        <div className="rating-overall-value">
                          {getPersonalOverallRating() > 0 ? getPersonalOverallRating().toFixed(2) : '—'}
                        </div>
                      </div>
                    </div>
                    
                    {/* Общий средний рейтинг - всегда виден, но прочерк до определенных условий */}
                    <div className="rating-overall-container">
                      <div 
                        className="rating-overall-card" 
                        onClick={() => navigate('/overall-ranking', { state: { poetId: poet.id } })}
                      >
                        <div className="rating-overall-value">
                          {hasRatings() && !isNewPoet() ? getOverallAverage().toFixed(2) : '—'}
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
      </div>

      {/* Модалка увеличенного изображения */}
      {enlargedImage && (
        <div className="image-lightbox-overlay" onClick={() => setEnlargedImage(null)}>
          <button className="lightbox-close" onClick={() => setEnlargedImage(null)}>✕</button>
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
              
              {editError && <p className="error-message">{editError}</p>}
              
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
    </div>
  );
};

export default PoetDetailPage;

