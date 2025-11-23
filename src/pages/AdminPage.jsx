import React, { useState } from 'react';
import { usePoets } from '../context/PoetsContext';
import { ref, set } from 'firebase/database';
import { database } from '../firebase/config';
import { generateContent, generateAIRating } from '../ai/gemini';
import { generatePoetLifeStoryPrompt, generatePoetInfluencePrompt, generatePoetCreativityPrompt, generatePoetDramaPrompt, generatePoetBeautyPrompt, generateAIRatingPrompt, parseAIRating } from '../ai/prompts';
import './AdminPage.css';

const AdminPage = () => {
  const { 
    poets, 
    ratings,
    categoryLeaders,
    overallDuelWinners,
    aiChoiceTiebreaker,
    likes,
    updatePoemStatus, 
    deletePoem: deletePoemFunc, 
    deletePoet 
  } = usePoets();
  
  const [selectedPoet, setSelectedPoet] = useState(null);
  const [selectedPoem, setSelectedPoem] = useState(null);
  const [editPoemTitle, setEditPoemTitle] = useState('');
  const [editPoemUrl, setEditPoemUrl] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  
  // Состояния для редактирования биографии
  const [showBioModal, setShowBioModal] = useState(false);
  const [editBioText, setEditBioText] = useState('');
  const [isGeneratingBio, setIsGeneratingBio] = useState(false);
  
  // Состояния для редактирования влияния
  const [showInfluenceModal, setShowInfluenceModal] = useState(false);
  const [editInfluenceText, setEditInfluenceText] = useState('');
  const [isGeneratingInfluence, setIsGeneratingInfluence] = useState(false);
  
  // Состояния для редактирования творчества
  const [showCreativityModal, setShowCreativityModal] = useState(false);
  const [editCreativityText, setEditCreativityText] = useState('');
  const [isGeneratingCreativity, setIsGeneratingCreativity] = useState(false);
  
  // Состояния для редактирования драмы
  const [showDramaModal, setShowDramaModal] = useState(false);
  const [editDramaText, setEditDramaText] = useState('');
  const [isGeneratingDrama, setIsGeneratingDrama] = useState(false);
  
  // Состояния для редактирования красоты
  const [showBeautyModal, setShowBeautyModal] = useState(false);
  const [editBeautyText, setEditBeautyText] = useState('');
  const [isGeneratingBeauty, setIsGeneratingBeauty] = useState(false);
  
  // Состояния для AI-рейтинга
  const [showAIRatingModal, setShowAIRatingModal] = useState(false);
  const [editAIRatings, setEditAIRatings] = useState({ creativity: 0, influence: 0, drama: 0, beauty: 0 });
  const [isGeneratingAIRating, setIsGeneratingAIRating] = useState(false);
  
  // Получить все стихотворения выбранного поэта
  const poems = selectedPoet?.poems 
    ? Object.keys(selectedPoet.poems).map(key => ({
        id: key,
        ...selectedPoet.poems[key]
      })).sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt))
    : [];
  
  // Открыть модалку редактирования
  const handleEditPoem = (poem) => {
    setSelectedPoem(poem);
    setEditPoemTitle(poem.title);
    setEditPoemUrl(poem.url || '');
    setShowEditModal(true);
    setShowDeleteConfirm(false);
  };
  
  // Закрыть модалку редактирования
  const closeEditModal = () => {
    setShowEditModal(false);
    setSelectedPoem(null);
    setEditPoemTitle('');
    setEditPoemUrl('');
    setShowDeleteConfirm(false);
  };
  
  // Сохранить изменения названия и ссылки
  const handleSavePoemTitle = async () => {
    if (!selectedPoem || !editPoemTitle.trim()) return;
    
    const trimmedTitle = editPoemTitle.trim();
    const trimmedUrl = editPoemUrl.trim();
    
    // Проверка на дубликат (кроме текущего)
    const isDuplicate = poems.some(p => 
      p.id !== selectedPoem.id && 
      p.title.toLowerCase() === trimmedTitle.toLowerCase()
    );
    
    if (isDuplicate) {
      alert('Стихотворение с таким названием уже существует');
      return;
    }
    
    try {
      // Обновляем title
      await set(ref(database, `poets/${selectedPoet.id}/poems/${selectedPoem.id}/title`), trimmedTitle);
      // Обновляем url
      await set(ref(database, `poets/${selectedPoet.id}/poems/${selectedPoem.id}/url`), trimmedUrl);
      closeEditModal();
    } catch (err) {
      console.error('Ошибка сохранения:', err);
      alert('Ошибка при сохранении');
    }
  };
  
  // Удалить стихотворение
  const handleDeletePoem = async () => {
    if (!selectedPoem) return;
    
    try {
      await deletePoemFunc(selectedPoet.id, selectedPoem.id);
      closeEditModal();
    } catch (err) {
      console.error('Ошибка удаления:', err);
      alert('Ошибка при удалении стихотворения');
    }
  };
  
  // Удалить всех поэтов
  const handleDeleteAllPoets = async () => {
    try {
      // Удаляем всех поэтов по одному
      for (const poet of poets) {
        await deletePoet(poet.id);
      }
      setShowDeleteAllConfirm(false);
      setSelectedPoet(null);
    } catch (err) {
      console.error('Ошибка удаления всех поэтов:', err);
      alert('Ошибка при удалении данных');
    }
  };
  
  // Экспорт всех данных в JSON файл
  const handleExportData = () => {
    try {
      const backupData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        poets,
        ratings,
        categoryLeaders,
        overallDuelWinners,
        aiChoiceTiebreaker,
        likes
      };
      
      const dataStr = JSON.stringify(backupData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `league-of-poets-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Ошибка экспорта:', err);
      alert('Ошибка при экспорте данных');
    }
  };
  
  // Импорт данных из JSON файла
  const handleImportData = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const backupData = JSON.parse(e.target.result);
        
        // Проверка структуры данных
        if (!backupData.poets || !backupData.ratings) {
          alert('Неверный формат файла бэкапа');
          return;
        }
        
        // Подтверждение импорта
        const confirmed = window.confirm(
          `Вы собираетесь загрузить бэкап от ${new Date(backupData.exportDate).toLocaleDateString()}.\n\n` +
          `Поэтов в бэкапе: ${backupData.poets.length}\n\n` +
          `Это заменит все текущие данные. Продолжить?`
        );
        
        if (!confirmed) return;
        
        // Загружаем данные в Firebase
        await set(ref(database, 'poets'), 
          backupData.poets.reduce((acc, poet) => {
            acc[poet.id] = poet;
            return acc;
          }, {})
        );
        
        if (backupData.ratings) {
          await set(ref(database, 'ratings'), backupData.ratings);
        }
        
        if (backupData.categoryLeaders) {
          await set(ref(database, 'categoryLeaders'), backupData.categoryLeaders);
        }
        
        if (backupData.overallDuelWinners) {
          await set(ref(database, 'overallDuelWinners'), backupData.overallDuelWinners);
        }
        
        if (backupData.aiChoiceTiebreaker) {
          await set(ref(database, 'aiChoiceTiebreaker'), backupData.aiChoiceTiebreaker);
        }
        
        if (backupData.likes) {
          await set(ref(database, 'likes'), backupData.likes);
        }
        
        alert('Данные успешно восстановлены!');
        setSelectedPoet(null);
      } catch (err) {
        console.error('Ошибка импорта:', err);
        alert('Ошибка при импорте данных: ' + err.message);
      }
    };
    
    reader.readAsText(file);
    // Сброс input для возможности повторной загрузки того же файла
    event.target.value = '';
  };
  
  // Открыть модалку редактирования биографии
  const handleEditBio = (poet) => {
    setSelectedPoet(poet);
    setEditBioText(poet.lifeStory || '');
    setShowBioModal(true);
  };
  
  // Закрыть модалку биографии
  const closeBioModal = () => {
    setShowBioModal(false);
    setEditBioText('');
    setIsGeneratingBio(false);
  };
  
  // Сгенерировать новую биографию
  const handleGenerateBio = async () => {
    if (!selectedPoet) return;
    
    setIsGeneratingBio(true);
    try {
      const prompt = generatePoetLifeStoryPrompt(selectedPoet.name);
      const generatedBio = await generateContent(prompt);
      setEditBioText(generatedBio);
    } catch (err) {
      console.error('Ошибка генерации биографии:', err);
      alert('Ошибка при генерации биографии');
    }
    setIsGeneratingBio(false);
  };
  
  // Сохранить отредактированную биографию
  const handleSaveBio = async () => {
    if (!selectedPoet) return;
    
    try {
      await set(ref(database, `poets/${selectedPoet.id}/lifeStory`), editBioText.trim());
      closeBioModal();
    } catch (err) {
      console.error('Ошибка сохранения биографии:', err);
      alert('Ошибка при сохранении');
    }
  };
  
  // Открыть модалку редактирования влияния
  const handleEditInfluence = (poet) => {
    setSelectedPoet(poet);
    setEditInfluenceText(poet.influence || '');
    setShowInfluenceModal(true);
  };
  
  // Закрыть модалку влияния
  const closeInfluenceModal = () => {
    setShowInfluenceModal(false);
    setEditInfluenceText('');
    setIsGeneratingInfluence(false);
  };
  
  // Сгенерировать новое влияние
  const handleGenerateInfluence = async () => {
    if (!selectedPoet) return;
    
    setIsGeneratingInfluence(true);
    try {
      const prompt = generatePoetInfluencePrompt(selectedPoet.name);
      const generatedInfluence = await generateContent(prompt);
      setEditInfluenceText(generatedInfluence);
    } catch (err) {
      console.error('Ошибка генерации влияния:', err);
      alert('Ошибка при генерации влияния');
    }
    setIsGeneratingInfluence(false);
  };
  
  // Сохранить отредактированное влияние
  const handleSaveInfluence = async () => {
    if (!selectedPoet) return;
    
    try {
      await set(ref(database, `poets/${selectedPoet.id}/influence`), editInfluenceText.trim());
      closeInfluenceModal();
    } catch (err) {
      console.error('Ошибка сохранения влияния:', err);
      alert('Ошибка при сохранении');
    }
  };

  // Редактировать творчество
  const handleEditCreativity = (poet) => {
    setSelectedPoet(poet);
    setEditCreativityText(poet.creativity || '');
    setShowCreativityModal(true);
  };
  
  // Закрыть модалку творчества
  const closeCreativityModal = () => {
    setShowCreativityModal(false);
    setEditCreativityText('');
    setIsGeneratingCreativity(false);
  };
  
  // Сгенерировать новое творчество
  const handleGenerateCreativity = async () => {
    if (!selectedPoet) return;
    
    setIsGeneratingCreativity(true);
    try {
      const prompt = generatePoetCreativityPrompt(selectedPoet.name);
      const generatedCreativity = await generateContent(prompt);
      setEditCreativityText(generatedCreativity);
    } catch (err) {
      console.error('Ошибка генерации творчества:', err);
      alert('Ошибка при генерации творчества');
    }
    setIsGeneratingCreativity(false);
  };
  
  // Сохранить отредактированное творчество
  const handleSaveCreativity = async () => {
    if (!selectedPoet) return;
    
    try {
      await set(ref(database, `poets/${selectedPoet.id}/creativity`), editCreativityText.trim());
      closeCreativityModal();
    } catch (err) {
      console.error('Ошибка сохранения творчества:', err);
      alert('Ошибка при сохранении');
    }
  };

  // Редактировать драму
  const handleEditDrama = (poet) => {
    setSelectedPoet(poet);
    setEditDramaText(poet.drama || '');
    setShowDramaModal(true);
  };
  
  // Закрыть модалку драмы
  const closeDramaModal = () => {
    setShowDramaModal(false);
    setEditDramaText('');
    setIsGeneratingDrama(false);
  };
  
  // Сгенерировать новую драму
  const handleGenerateDrama = async () => {
    if (!selectedPoet) return;
    
    setIsGeneratingDrama(true);
    try {
      const prompt = generatePoetDramaPrompt(selectedPoet.name);
      const generatedDrama = await generateContent(prompt);
      setEditDramaText(generatedDrama);
    } catch (err) {
      console.error('Ошибка генерации драмы:', err);
      alert('Ошибка при генерации драмы');
    }
    setIsGeneratingDrama(false);
  };
  
  // Сохранить отредактированную драму
  const handleSaveDrama = async () => {
    if (!selectedPoet) return;
    
    try {
      await set(ref(database, `poets/${selectedPoet.id}/drama`), editDramaText.trim());
      closeDramaModal();
    } catch (err) {
      console.error('Ошибка сохранения драмы:', err);
      alert('Ошибка при сохранении');
    }
  };

  // Редактировать красоту
  const handleEditBeauty = (poet) => {
    setSelectedPoet(poet);
    setEditBeautyText(poet.beauty || '');
    setShowBeautyModal(true);
  };
  
  // Закрыть модалку красоты
  const closeBeautyModal = () => {
    setShowBeautyModal(false);
    setEditBeautyText('');
    setIsGeneratingBeauty(false);
  };
  
  // Сгенерировать новую красоту
  const handleGenerateBeauty = async () => {
    if (!selectedPoet) return;
    
    setIsGeneratingBeauty(true);
    try {
      const prompt = generatePoetBeautyPrompt(selectedPoet.name);
      const generatedBeauty = await generateContent(prompt);
      setEditBeautyText(generatedBeauty);
    } catch (err) {
      console.error('Ошибка генерации красоты:', err);
      alert('Ошибка при генерации красоты');
    }
    setIsGeneratingBeauty(false);
  };
  
  // Сохранить отредактированную красоту
  const handleSaveBeauty = async () => {
    if (!selectedPoet) return;
    
    try {
      await set(ref(database, `poets/${selectedPoet.id}/beauty`), editBeautyText.trim());
      closeBeautyModal();
    } catch (err) {
      console.error('Ошибка сохранения красоты:', err);
      alert('Ошибка при сохранении');
    }
  };

  // ============================================
  // AI-РЕЙТИНГ
  // ============================================

  // Открыть модалку AI-рейтинга
  const handleEditAIRating = (poet) => {
    setSelectedPoet(poet);
    setEditAIRatings(poet.aiRatings || { creativity: 0, influence: 0, drama: 0, beauty: 0 });
    setShowAIRatingModal(true);
  };
  
  // Закрыть модалку AI-рейтинга
  const closeAIRatingModal = () => {
    setShowAIRatingModal(false);
    setEditAIRatings({ creativity: 0, influence: 0, drama: 0, beauty: 0 });
    setIsGeneratingAIRating(false);
  };
  
  // Генерация AI-рейтинга
  const handleGenerateAIRating = async () => {
    if (!selectedPoet) return;
    
    setIsGeneratingAIRating(true);
    try {
      // Собираем существующие AI-рейтинги других поэтов для контекста
      const existingAIRatings = poets
        .filter(p => p.id !== selectedPoet.id && p.aiRatings && Object.keys(p.aiRatings).length > 0)
        .map(p => ({
          name: p.name,
          ratings: p.aiRatings
        }));
      
      const prompt = generateAIRatingPrompt(selectedPoet.name, existingAIRatings);
      // Делаем 3 запроса и усредняем для справедливости
      const ratings = await generateAIRating(prompt, parseAIRating);
      setEditAIRatings(ratings);
    } catch (err) {
      console.error('Ошибка генерации AI-рейтинга:', err);
      alert('Ошибка при генерации AI-рейтинга');
    }
    setIsGeneratingAIRating(false);
  };
  
  // Сохранение AI-рейтинга
  const handleSaveAIRating = async () => {
    if (!selectedPoet) return;
    
    try {
      await set(ref(database, `poets/${selectedPoet.id}/aiRatings`), editAIRatings);
      closeAIRatingModal();
    } catch (err) {
      console.error('Ошибка сохранения AI-рейтинга:', err);
      alert('Ошибка при сохранении');
    }
  };
  
  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <h1>Админка</h1>
          <div className="admin-header-actions">
            <button 
              className="btn-backup btn-export"
              onClick={handleExportData}
              disabled={poets.length === 0}
              title="Скачать бэкап всех данных"
            >
            Скачать бэкап
            </button>
            
            <label className="btn-backup btn-import" title="Загрузить бэкап из файла">
              Загрузить бэкап
              <input 
                type="file" 
                accept=".json"
                onChange={handleImportData}
                style={{ display: 'none' }}
              />
            </label>
            
            <button 
              className="btn-delete-all"
              onClick={() => setShowDeleteAllConfirm(true)}
              disabled={poets.length === 0}
            >
              Удалить всё
            </button>
          </div>
        </div>
        {/* <p className="admin-subtitle">Управление стихотворениями</p> */}
      </div>
      
      <div className="admin-content">
        {/* Список поэтов */}
        <div className="admin-section">
          <h2 className="section-title">Выберите поэта</h2>
          <div className="poets-list">
            {poets.map(poet => (
              <div
                key={poet.id}
                className={`poet-item ${selectedPoet?.id === poet.id ? 'active' : ''}`}
              >
                <div className="poet-item-main" onClick={() => setSelectedPoet(poet)}>
                  <img 
                    src={poet.imageUrl} 
                    alt={poet.name}
                    className="poet-item-avatar"
                  />
                  <span className="poet-item-name">{poet.name}</span>
                </div>
                <div className="poet-item-actions">
                  <button
                    className="btn-edit-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditBio(poet);
                    }}
                    title="Редактировать биографию"
                  >
                    📖
                  </button>
                  <button
                    className="btn-edit-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditInfluence(poet);
                    }}
                    title="Редактировать влияние"
                  >
                    ⭐
                  </button>
                  <button
                    className="btn-edit-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditCreativity(poet);
                    }}
                    title="Редактировать творчество"
                  >
                    ✨
                  </button>
                  <button
                    className="btn-edit-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditDrama(poet);
                    }}
                    title="Редактировать драму"
                  >
                    🎭
                  </button>
                  <button
                    className="btn-edit-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditBeauty(poet);
                    }}
                    title="Редактировать красоту"
                  >
                    💎
                  </button>
                  <button
                    className="btn-edit-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditAIRating(poet);
                    }}
                    title="AI-рейтинг"
                  >
                    🤖
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Список стихотворений выбранного поэта */}
        {selectedPoet && (
          <div className="admin-section">
            <h2 className="section-title">
              Стихотворения: {selectedPoet.name}
              <span className="poems-count">({poems.length})</span>
            </h2>
            
            {poems.length === 0 ? (
              <p className="empty-message">У этого поэта пока нет стихотворений</p>
            ) : (
              <div className="poems-list">
                {poems.map(poem => (
                  <div
                    key={poem.id}
                    className="poem-item"
                    onClick={() => handleEditPoem(poem)}
                  >
                    <span className="poem-item-title">{poem.title}</span>
                    <span className="poem-item-date">
                      {new Date(poem.addedAt).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Модалка редактирования/удаления стихотворения */}
      {showEditModal && selectedPoem && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal-content admin-edit-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close" 
              onClick={closeEditModal}
              title="Закрыть"
            >
              ✕
            </button>
            
            <h2 className="modal-title">Редактирование стихотворения</h2>
            
            <div className="admin-edit-content">
              {/* Название стихотворения (редактируемое) */}
              <div className="form-field">
                <label htmlFor="edit-poem-title">Название</label>
                <input
                  id="edit-poem-title"
                  type="text"
                  value={editPoemTitle}
                  onChange={(e) => setEditPoemTitle(e.target.value)}
                  className="form-input"
                  placeholder="Название стихотворения"
                />
              </div>
              
              {/* Ссылка на стихотворение (редактируемая) */}
              <div className="form-field">
                <label htmlFor="edit-poem-url">Ссылка (rustih.ru)</label>
                <input
                  id="edit-poem-url"
                  type="url"
                  value={editPoemUrl}
                  onChange={(e) => setEditPoemUrl(e.target.value)}
                  className="form-input"
                  placeholder="https://rustih.ru/..."
                />
              </div>
              
              {/* Действия */}
              <div className="admin-actions">
                {!showDeleteConfirm ? (
                  <>
                    <button 
                      className="btn-save-poem" 
                      onClick={handleSavePoemTitle}
                    >
                      Сохранить
                    </button>
                    <button 
                      className="btn-delete-poem" 
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      Удалить
                    </button>
                  </>
                ) : (
                  <>
                    <p className="delete-confirm-text">Точно удалить стихотворение?</p>
                    <button 
                      className="btn-confirm-delete" 
                      onClick={handleDeletePoem}
                    >
                      Да, удалить
                    </button>
                    <button 
                      className="btn-cancel-delete" 
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      Отмена
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Модалка подтверждения удаления всех поэтов */}
      {showDeleteAllConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteAllConfirm(false)}>
          <div className="modal-content delete-all-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close" 
              onClick={() => setShowDeleteAllConfirm(false)}
              title="Закрыть"
            >
              ✕
            </button>
            
            <h2 className="modal-title">⚠️ Удалить всё?</h2>
            
            <div className="delete-all-content">
              <p className="delete-all-warning">
                Вы собираетесь удалить <strong>всех поэтов ({poets.length})</strong> и все связанные данные:
              </p>
              <ul className="delete-all-list">
                <li>Все стихотворения</li>
                <li>Все оценки (Максима и Олега)</li>
                <li>Все лайки</li>
                <li>Всю историю дуэлей</li>
                <li>Все награды</li>
              </ul>
              <p className="delete-all-warning-final">
                <strong>Это действие необратимо!</strong>
              </p>
              
              <div className="delete-all-actions">
                <button 
                  className="btn-cancel-delete" 
                  onClick={() => setShowDeleteAllConfirm(false)}
                >
                  Отмена
                </button>
                <button 
                  className="btn-confirm-delete-all" 
                  onClick={handleDeleteAllPoets}
                >
                  Да, удалить всё
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Модалка редактирования биографии */}
      {showBioModal && (
        <div className="modal-overlay" onClick={closeBioModal}>
          <div className="modal-content bio-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close" 
              onClick={closeBioModal}
              title="Закрыть"
            >
              ✕
            </button>
            
            <h2 className="modal-title">
              Биография: {selectedPoet?.name}
            </h2>
            
            <div className="bio-modal-content">
              <div className="bio-actions">
                <button 
                  className="btn-generate-bio"
                  onClick={handleGenerateBio}
                  disabled={isGeneratingBio}
                >
                  {isGeneratingBio ? '⏳ Генерирую...' : '✨ Сгенерировать AI'}
                </button>
              </div>
              
              <textarea
                className="bio-textarea"
                value={editBioText}
                onChange={(e) => setEditBioText(e.target.value)}
                placeholder="Введите биографию поэта..."
                disabled={isGeneratingBio}
              />
              
              <div className="bio-modal-actions">
                <button 
                  className="btn-cancel-bio" 
                  onClick={closeBioModal}
                >
                  Отмена
                </button>
                <button 
                  className="btn-save-bio" 
                  onClick={handleSaveBio}
                  disabled={isGeneratingBio}
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Модалка редактирования влияния */}
      {showInfluenceModal && (
        <div className="modal-overlay" onClick={closeInfluenceModal}>
          <div className="modal-content bio-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close" 
              onClick={closeInfluenceModal}
              title="Закрыть"
            >
              ✕
            </button>
            
            <h2 className="modal-title">
              Влияние: {selectedPoet?.name}
            </h2>
            
            <div className="bio-modal-content">
              <div className="bio-actions">
                <button 
                  className="btn-generate-bio"
                  onClick={handleGenerateInfluence}
                  disabled={isGeneratingInfluence}
                >
                  {isGeneratingInfluence ? '⏳ Генерирую...' : '✨ Сгенерировать AI'}
                </button>
              </div>
              
              <textarea
                className="bio-textarea"
                value={editInfluenceText}
                onChange={(e) => setEditInfluenceText(e.target.value)}
                placeholder="Введите информацию о влиянии поэта..."
                disabled={isGeneratingInfluence}
              />
              
              <div className="bio-modal-actions">
                <button 
                  className="btn-cancel-bio" 
                  onClick={closeInfluenceModal}
                >
                  Отмена
                </button>
                <button 
                  className="btn-save-bio" 
                  onClick={handleSaveInfluence}
                  disabled={isGeneratingInfluence}
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Модалка редактирования творчества */}
      {showCreativityModal && (
        <div className="modal-overlay" onClick={closeCreativityModal}>
          <div className="modal-content bio-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close" 
              onClick={closeCreativityModal}
              title="Закрыть"
            >
              ✕
            </button>
            
            <h2 className="modal-title">
              Творчество: {selectedPoet?.name}
            </h2>
            
            <div className="bio-modal-content">
              <div className="bio-actions">
                <button 
                  className="btn-generate-bio"
                  onClick={handleGenerateCreativity}
                  disabled={isGeneratingCreativity}
                >
                  {isGeneratingCreativity ? '⏳ Генерирую...' : '✨ Сгенерировать AI'}
                </button>
              </div>
              
              <textarea
                className="bio-textarea"
                value={editCreativityText}
                onChange={(e) => setEditCreativityText(e.target.value)}
                placeholder="Введите информацию о творчестве поэта..."
                disabled={isGeneratingCreativity}
              />
              
              <div className="bio-modal-actions">
                <button 
                  className="btn-cancel-bio" 
                  onClick={closeCreativityModal}
                >
                  Отмена
                </button>
                <button 
                  className="btn-save-bio" 
                  onClick={handleSaveCreativity}
                  disabled={isGeneratingCreativity}
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Модалка редактирования драмы */}
      {showDramaModal && (
        <div className="modal-overlay" onClick={closeDramaModal}>
          <div className="modal-content bio-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close" 
              onClick={closeDramaModal}
              title="Закрыть"
            >
              ✕
            </button>
            
            <h2 className="modal-title">
              Драма: {selectedPoet?.name}
            </h2>
            
            <div className="bio-modal-content">
              <div className="bio-actions">
                <button 
                  className="btn-generate-bio"
                  onClick={handleGenerateDrama}
                  disabled={isGeneratingDrama}
                >
                  {isGeneratingDrama ? '⏳ Генерирую...' : '✨ Сгенерировать AI'}
                </button>
              </div>
              
              <textarea
                className="bio-textarea"
                value={editDramaText}
                onChange={(e) => setEditDramaText(e.target.value)}
                placeholder="Введите информацию о драме в жизни поэта..."
                disabled={isGeneratingDrama}
              />
              
              <div className="bio-modal-actions">
                <button 
                  className="btn-cancel-bio" 
                  onClick={closeDramaModal}
                >
                  Отмена
                </button>
                <button 
                  className="btn-save-bio" 
                  onClick={handleSaveDrama}
                  disabled={isGeneratingDrama}
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Модалка редактирования красоты */}
      {showBeautyModal && (
        <div className="modal-overlay" onClick={closeBeautyModal}>
          <div className="modal-content bio-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close" 
              onClick={closeBeautyModal}
              title="Закрыть"
            >
              ✕
            </button>
            
            <h2 className="modal-title">
              Красота: {selectedPoet?.name}
            </h2>
            
            <div className="bio-modal-content">
              <div className="bio-actions">
                <button 
                  className="btn-generate-bio"
                  onClick={handleGenerateBeauty}
                  disabled={isGeneratingBeauty}
                >
                  {isGeneratingBeauty ? '⏳ Генерирую...' : '✨ Сгенерировать AI'}
                </button>
              </div>
              
              <textarea
                className="bio-textarea"
                value={editBeautyText}
                onChange={(e) => setEditBeautyText(e.target.value)}
                placeholder="Введите информацию о красоте поэта..."
                disabled={isGeneratingBeauty}
              />
              
              <div className="bio-modal-actions">
                <button 
                  className="btn-cancel-bio" 
                  onClick={closeBeautyModal}
                >
                  Отмена
                </button>
                <button 
                  className="btn-save-bio" 
                  onClick={handleSaveBeauty}
                  disabled={isGeneratingBeauty}
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модалка AI-рейтинга */}
      {showAIRatingModal && (
        <div className="modal-overlay" onClick={closeAIRatingModal}>
          <div className="modal-content bio-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close" 
              onClick={closeAIRatingModal}
              title="Закрыть"
            >
              ✕
            </button>
            
            <h2 className="modal-title">
              🤖 AI-Рейтинг: {selectedPoet?.name}
            </h2>
            
            <div className="bio-modal-content">
              <div className="bio-actions">
                <button 
                  className="btn-generate-bio"
                  onClick={handleGenerateAIRating}
                  disabled={isGeneratingAIRating}
                >
                  {isGeneratingAIRating ? '⏳ Генерирую...' : '✨ Сгенерировать AI'}
                </button>
              </div>
              
              <div className="ai-ratings-grid">
                <div className="ai-rating-item">
                  <label>Творчество (1-5):</label>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.5"
                    value={editAIRatings.creativity}
                    onChange={(e) => setEditAIRatings({ ...editAIRatings, creativity: parseFloat(e.target.value) || 0 })}
                    disabled={isGeneratingAIRating}
                  />
                </div>
                
                <div className="ai-rating-item">
                  <label>Влияние (1-5):</label>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.5"
                    value={editAIRatings.influence}
                    onChange={(e) => setEditAIRatings({ ...editAIRatings, influence: parseFloat(e.target.value) || 0 })}
                    disabled={isGeneratingAIRating}
                  />
                </div>
                
                <div className="ai-rating-item">
                  <label>Драма (1-5):</label>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.5"
                    value={editAIRatings.drama}
                    onChange={(e) => setEditAIRatings({ ...editAIRatings, drama: parseFloat(e.target.value) || 0 })}
                    disabled={isGeneratingAIRating}
                  />
                </div>
                
                <div className="ai-rating-item">
                  <label>Красота (1-5):</label>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.5"
                    value={editAIRatings.beauty}
                    onChange={(e) => setEditAIRatings({ ...editAIRatings, beauty: parseFloat(e.target.value) || 0 })}
                    disabled={isGeneratingAIRating}
                  />
                </div>
              </div>
              
              <div className="bio-modal-actions">
                <button 
                  className="btn-cancel-bio" 
                  onClick={closeAIRatingModal}
                >
                  Отмена
                </button>
                <button 
                  className="btn-save-bio" 
                  onClick={handleSaveAIRating}
                  disabled={isGeneratingAIRating}
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;

