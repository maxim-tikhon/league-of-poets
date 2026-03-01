import React, { useState, useEffect } from 'react';
import { usePoets } from '../context/PoetsContext';
import { ref, set, onValue } from 'firebase/database';
import { database } from '../firebase/config';
import { generateContent, generateAIRatingByCat } from '../ai/gemini';
import { generatePoetLifeStoryPrompt, generatePoetInfluencePrompt, generatePoetDramaPrompt, generatePoetBeautyPrompt, generateAIRatingCreativityPrompt, generateAIRatingMoralPrompt, generateAIRatingDramaPrompt, generateAIRatingBeautyPrompt } from '../ai/prompts';
import { BookOpen, Scale, HeartCrack, Flower2, Bot, Camera, Link2, Plus, Trash2 } from 'lucide-react';
import './AdminPage.css';

const AdminPage = () => {
  const { 
    poets, 
    ratings,
    categoryLeaders,
    overallDuelWinners,
    aiChoiceTiebreaker,
    likes,
    updatePoet,
    updatePoemStatus, 
    deletePoem: deletePoemFunc, 
    deletePoet,
    calculateScore,
    CATEGORIES,
    categoryCoefficients,
    updateCategoryCoefficients,
    cleanupInvalidData
  } = usePoets();
  
  // Состояние гирлянды (из Firebase)
  const [garlandEnabled, setGarlandEnabled] = useState(true);
  const [glowEnabled, setGlowEnabled] = useState(true);
  const [breathingEnabled, setBreathingEnabled] = useState(false);
  const [footerFlowersEnabled, setFooterFlowersEnabled] = useState(true);
  const [jumpAnimationEnabled, setJumpAnimationEnabled] = useState(false);
  
  // Состояние для редактирования процентов категорий
  const [editingCoefficients, setEditingCoefficients] = useState({});
  const [coefficientsError, setCoefficientsError] = useState('');
  const [coefficientsSaved, setCoefficientsSaved] = useState(false);
  
  // Состояние настроек для бэкапа
  const [garlandSettings, setGarlandSettings] = useState(null);
  const [overallRankingSettings, setOverallRankingSettings] = useState(null);
  
  // Загружаем настройки из Firebase
  useEffect(() => {
    const settingsRef = ref(database, 'settings/garland');
    const unsubscribe = onValue(settingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGarlandEnabled(data.enabled !== false);
        setGlowEnabled(data.glow !== false);
        setBreathingEnabled(data.breathing === true);
        setFooterFlowersEnabled(data.footerFlowersEnabled !== false);
        setGarlandSettings(data); // Сохраняем для бэкапа
      }
    });
    
    return () => unsubscribe();
  }, []);

  // Настройки анимации карточки нового поэта в общем рейтинге
  useEffect(() => {
    const settingsRef = ref(database, 'settings/overallRanking');
    const unsubscribe = onValue(settingsRef, (snapshot) => {
      const data = snapshot.val();
      setJumpAnimationEnabled(data?.jumpAnimationEnabled === true);
      setOverallRankingSettings(data || { jumpAnimationEnabled: false });
    });

    return () => unsubscribe();
  }, []);
  
  // Сохранить настройки в Firebase
  const saveGarlandSettings = async (enabled, glow, breathing, footerFlowers) => {
    const settingsRef = ref(database, 'settings/garland');
    await set(settingsRef, {
      enabled,
      glow,
      breathing,
      footerFlowersEnabled: footerFlowers
    });
  };
  
  // Переключить гирлянду
  const toggleGarland = () => {
    const newState = !garlandEnabled;
    setGarlandEnabled(newState);
    saveGarlandSettings(newState, glowEnabled, breathingEnabled, footerFlowersEnabled);
  };
  
  // Переключить свечение
  const toggleGlow = () => {
    const newState = !glowEnabled;
    setGlowEnabled(newState);
    saveGarlandSettings(garlandEnabled, newState, breathingEnabled, footerFlowersEnabled);
  };
  
  // Переключить дыхание
  const toggleBreathing = () => {
    const newState = !breathingEnabled;
    setBreathingEnabled(newState);
    saveGarlandSettings(garlandEnabled, glowEnabled, newState, footerFlowersEnabled);
  };

  const toggleFooterFlowers = () => {
    const newState = !footerFlowersEnabled;
    setFooterFlowersEnabled(newState);
    saveGarlandSettings(garlandEnabled, glowEnabled, breathingEnabled, newState);
  };

  const toggleJumpAnimation = async () => {
    const newState = !jumpAnimationEnabled;
    setJumpAnimationEnabled(newState);
    const settingsRef = ref(database, 'settings/overallRanking');
    await set(settingsRef, { jumpAnimationEnabled: newState });
  };
  
  // Инициализация редактируемых коэффициентов
  useEffect(() => {
    if (categoryCoefficients) {
      const coeffs = {};
      Object.keys(categoryCoefficients).forEach(key => {
        coeffs[key] = (categoryCoefficients[key].coefficient * 100).toFixed(1);
      });
      setEditingCoefficients(coeffs);
    }
  }, [categoryCoefficients]);
  
  // Обработка изменения процента категории
  const handleCoefficientChange = (category, value) => {
    setEditingCoefficients(prev => ({
      ...prev,
      [category]: value
    }));
    setCoefficientsError('');
    setCoefficientsSaved(false);
  };
  
  // Сохранение коэффициентов
  const saveCategoryCoefficients = async () => {
    try {
      // Конвертируем проценты обратно в коэффициенты
      const coefficients = {};
      let sum = 0;
      
      Object.keys(editingCoefficients).forEach(key => {
        const percent = parseFloat(editingCoefficients[key]);
        if (isNaN(percent) || percent < 0) {
          throw new Error(`Некорректное значение для ${categoryCoefficients[key].name}`);
        }
        coefficients[key] = percent / 100;
        sum += percent;
      });
      
      // Проверка суммы
      if (Math.abs(sum - 100) > 0.1) {
        setCoefficientsError(`Сумма должна быть равна 100% (текущая: ${sum.toFixed(1)}%)`);
        return;
      }
      
      await updateCategoryCoefficients(coefficients);
      setCoefficientsError('');
      setCoefficientsSaved(true);
      
      // Убираем сообщение об успехе через 3 секунды
      setTimeout(() => {
        setCoefficientsSaved(false);
      }, 3000);
    } catch (error) {
      setCoefficientsError(error.message || 'Ошибка при сохранении');
    }
  };
  
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
  const [editAIRatings, setEditAIRatings] = useState({ creativity: 0, drama: 0, influence: 0, beauty: 0 });
  const [isGeneratingAIRating, setIsGeneratingAIRating] = useState(false);
  
  // Состояния для настройки позиции фото
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [editImagePositionY, setEditImagePositionY] = useState(25);
  
  // Состояния для редактирования ссылок
  const [showLinksModal, setShowLinksModal] = useState(false);
  const [editWikiUrl, setEditWikiUrl] = useState('');
  const [editWikiquoteUrl, setEditWikiquoteUrl] = useState('');
  const [editPoemsUrl, setEditPoemsUrl] = useState('');
  const [editYoutubeLinks, setEditYoutubeLinks] = useState([]);
  const [editOtherLinks, setEditOtherLinks] = useState([]);
  const [newYoutubeTitle, setNewYoutubeTitle] = useState('');
  const [newYoutubeUrl, setNewYoutubeUrl] = useState('');
  const [newOtherTitle, setNewOtherTitle] = useState('');
  const [newOtherUrl, setNewOtherUrl] = useState('');
  
  // Состояния для ручного назначения победителей
  const [showAssignLeaderModal, setShowAssignLeaderModal] = useState(false);
  const [assignUser, setAssignUser] = useState('maxim'); // maxim или oleg
  const [assignCategory, setAssignCategory] = useState('overall'); // overall, overall_worst, или категория
  
  // Получить всех претендентов на победу в выбранной категории
  const getContenders = () => {
    if (!poets || poets.length === 0) return [];
    
    if (assignCategory === 'overall') {
      // Для общего балла - ищем максимальный score
      const scoresMap = poets.map(poet => ({
        ...poet,
        score: calculateScore(assignUser, poet.id)
      })).filter(p => p.score > 0);
      
      if (scoresMap.length === 0) return [];
      
      const maxScore = Math.max(...scoresMap.map(p => p.score));
      return scoresMap.filter(p => Math.abs(p.score - maxScore) < 0.01);
      
    } else if (assignCategory === 'overall_worst') {
      // Для худшего поэта - ищем минимальный score (минимум 6 поэтов)
      const scoresMap = poets.map(poet => ({
        ...poet,
        score: calculateScore(assignUser, poet.id)
      })).filter(p => p.score > 0);
      
      if (scoresMap.length <= 5) return [];
      
      const minScore = Math.min(...scoresMap.map(p => p.score));
      return scoresMap.filter(p => Math.abs(p.score - minScore) < 0.01);
      
    } else {
      // Для категории - ищем максимальный рейтинг
      const ratingsMap = poets.map(poet => ({
        ...poet,
        rating: ratings[assignUser]?.[poet.id]?.[assignCategory] || 0
      })).filter(p => p.rating > 0);
      
      if (ratingsMap.length === 0) return [];
      
      const maxRating = Math.max(...ratingsMap.map(p => p.rating));
      return ratingsMap.filter(p => Math.abs(p.rating - maxRating) < 0.01);
    }
  };
  
  // Назначить победителя
  const assignLeader = async (poetId) => {
    try {
      const leaderRef = ref(database, `categoryLeaders/${assignUser}/${assignCategory}`);
      await set(leaderRef, poetId);
      alert('Победитель назначен!');
      setShowAssignLeaderModal(false);
    } catch (error) {
      console.error('Error assigning leader:', error);
      alert('Ошибка при назначении победителя');
    }
  };
  
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
      // Подготовка коэффициентов для экспорта
      const coefficientsForBackup = {};
      Object.keys(categoryCoefficients).forEach(key => {
        coefficientsForBackup[key] = categoryCoefficients[key].coefficient;
      });
      
      const backupData = {
        version: '2.0', // Обновляем версию для поддержки настроек
        exportDate: new Date().toISOString(),
        poets,
        ratings,
        categoryLeaders,
        overallDuelWinners,
        aiChoiceTiebreaker,
        likes,
        settings: {
          categoryCoefficients: coefficientsForBackup,
          garland: garlandSettings,
          overallRanking: overallRankingSettings
        }
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
        
        // Восстановление настроек (для бэкапов версии 2.0+)
        if (backupData.settings) {
          if (backupData.settings.categoryCoefficients) {
            await set(ref(database, 'settings/categoryCoefficients'), backupData.settings.categoryCoefficients);
          }
          
          if (backupData.settings.garland) {
            await set(ref(database, 'settings/garland'), backupData.settings.garland);
          }

          if (backupData.settings.overallRanking) {
            await set(ref(database, 'settings/overallRanking'), backupData.settings.overallRanking);
          }
        }
        
        alert('Данные успешно восстановлены!' + (backupData.settings ? ' (включая настройки)' : ''));
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
  
  // Скопировать промпт для биографии
  const handleCopyBioPrompt = () => {
    if (!selectedPoet) return;
    const prompt = generatePoetLifeStoryPrompt(selectedPoet.name);
    navigator.clipboard.writeText(prompt).catch(() => {});
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

  // Скопировать промпт для влияния
  const handleCopyInfluencePrompt = () => {
    if (!selectedPoet) return;
    const prompt = generatePoetInfluencePrompt(selectedPoet.name);
    navigator.clipboard.writeText(prompt).catch(() => {});
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

  // Скопировать промпт для драмы
  const handleCopyDramaPrompt = () => {
    if (!selectedPoet) return;
    const prompt = generatePoetDramaPrompt(selectedPoet.name);
    navigator.clipboard.writeText(prompt).catch(() => {});
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

  // Скопировать промпт для красоты
  const handleCopyBeautyPrompt = () => {
    if (!selectedPoet) return;
    const prompt = generatePoetBeautyPrompt(selectedPoet.name);
    navigator.clipboard.writeText(prompt).catch(() => {});
  };

  // ============================================
  // AI-РЕЙТИНГ
  // ============================================

  // Открыть модалку AI-рейтинга
  const handleEditAIRating = (poet) => {
    setSelectedPoet(poet);
    setEditAIRatings(poet.aiRatings || { creativity: 0, drama: 0, influence: 0, beauty: 0 });
    setShowAIRatingModal(true);
  };
  
  // Закрыть модалку AI-рейтинга
  const closeAIRatingModal = () => {
    setShowAIRatingModal(false);
    setEditAIRatings({ creativity: 0, drama: 0, influence: 0, beauty: 0 });
    setIsGeneratingAIRating(false);
  };
  
  // Открыть модалку настройки фото
  const handleEditPhoto = (poet) => {
    setSelectedPoet(poet);
    setEditImagePositionY(poet.imagePositionY !== undefined ? poet.imagePositionY : 25);
    setShowPhotoModal(true);
  };
  
  // Закрыть модалку настройки фото
  const closePhotoModal = () => {
    setShowPhotoModal(false);
    setEditImagePositionY(25);
  };
  
  // Открыть модалку редактирования ссылок
  const handleEditLinks = (poet) => {
    setSelectedPoet(poet);
    setEditWikiUrl(poet.links?.wikipedia || '');
    setEditWikiquoteUrl(poet.links?.wikiquote || '');
    setEditPoemsUrl(poet.links?.poems || '');
    // Преобразуем объект в массив если нужно (Firebase может вернуть объект)
    const ytLinks = poet.links?.youtube;
    setEditYoutubeLinks(Array.isArray(ytLinks) ? ytLinks : (ytLinks ? Object.values(ytLinks) : []));
    const otherLinks = poet.links?.other;
    setEditOtherLinks(Array.isArray(otherLinks) ? otherLinks : (otherLinks ? Object.values(otherLinks) : []));
    setNewYoutubeTitle('');
    setNewYoutubeUrl('');
    setNewOtherTitle('');
    setNewOtherUrl('');
    setShowLinksModal(true);
  };
  
  // Закрыть модалку ссылок
  const closeLinksModal = () => {
    setShowLinksModal(false);
    setEditWikiUrl('');
    setEditWikiquoteUrl('');
    setEditPoemsUrl('');
    setEditYoutubeLinks([]);
    setEditOtherLinks([]);
    setNewYoutubeTitle('');
    setNewYoutubeUrl('');
    setNewOtherTitle('');
    setNewOtherUrl('');
  };
  
  // Сохранить ссылки
  const handleSaveLinks = async () => {
    if (!selectedPoet) return;
    
    try {
      const linksData = {
        wikipedia: editWikiUrl.trim() || null,
        wikiquote: editWikiquoteUrl.trim() || null,
        poems: editPoemsUrl.trim() || null,
        youtube: editYoutubeLinks.length > 0 ? editYoutubeLinks : null,
        other: editOtherLinks.length > 0 ? editOtherLinks : null
      };
      
      await updatePoet(selectedPoet.id, { links: linksData });
      closeLinksModal();
    } catch (error) {
      console.error('Ошибка сохранения ссылок:', error);
    }
  };
  
  // Добавить YouTube ссылку
  const handleAddYoutubeLink = () => {
    if (!newYoutubeUrl.trim()) return;
    
    const newLink = {
      title: newYoutubeTitle.trim() || 'YouTube',
      url: newYoutubeUrl.trim()
    };
    
    setEditYoutubeLinks(prev => [...prev, newLink]);
    setNewYoutubeTitle('');
    setNewYoutubeUrl('');
  };
  
  // Удалить YouTube ссылку
  const handleRemoveYoutubeLink = (index) => {
    setEditYoutubeLinks(prev => prev.filter((_, i) => i !== index));
  };
  
  // Добавить другую ссылку
  const handleAddOtherLink = () => {
    if (!newOtherUrl.trim()) return;
    
    const newLink = {
      title: newOtherTitle.trim() || 'Ссылка',
      url: newOtherUrl.trim()
    };
    
    setEditOtherLinks(prev => [...prev, newLink]);
    setNewOtherTitle('');
    setNewOtherUrl('');
  };
  
  // Удалить другую ссылку
  const handleRemoveOtherLink = (index) => {
    setEditOtherLinks(prev => prev.filter((_, i) => i !== index));
  };
  
  // Сохранить позицию фото
  const handleSavePhoto = async () => {
    if (!selectedPoet) return;
    
    try {
      await updatePoet(selectedPoet.id, { imagePositionY: editImagePositionY });
      closePhotoModal();
    } catch (err) {
      console.error('Ошибка сохранения позиции фото:', err);
      alert('Ошибка при сохранении');
    }
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
      
      // Делаем 4 отдельных запроса (по одному на каждую категорию)
      const ratings = await generateAIRatingByCat(
        selectedPoet.name,
        {
          creativity: generateAIRatingCreativityPrompt,
          influence: generateAIRatingMoralPrompt,
          drama: generateAIRatingDramaPrompt,
          beauty: generateAIRatingBeautyPrompt
        },
        existingAIRatings
      );
      setEditAIRatings(ratings);
    } catch (err) {
      console.error('Ошибка генерации AI-рейтинга:', err);
      alert('Ошибка при генерации AI-рейтинга');
    }
    setIsGeneratingAIRating(false);
  };
  
  // Копирование промптов для AI-рейтинга
  const handleCopyPrompts = () => {
    if (!selectedPoet) return;
    
    // Собираем существующие AI-рейтинги других поэтов для контекста
    const existingAIRatings = poets
      .filter(p => p.id !== selectedPoet.id && p.aiRatings && Object.keys(p.aiRatings).length > 0)
      .map(p => ({
        name: p.name,
        ratings: p.aiRatings
      }));
    
    // Генерируем все 4 промпта
    const creativityPrompt = generateAIRatingCreativityPrompt(selectedPoet.name, existingAIRatings);
    const moralPrompt = generateAIRatingMoralPrompt(selectedPoet.name, existingAIRatings);
    const dramaPrompt = generateAIRatingDramaPrompt(selectedPoet.name, existingAIRatings);
    const beautyPrompt = generateAIRatingBeautyPrompt(selectedPoet.name, existingAIRatings);
    
    // Формируем текст для копирования
    const allPrompts = `
════════════════════════════════════════════════════════════════
📝 ТВОРЧЕСТВО (Creativity)
════════════════════════════════════════════════════════════════

${creativityPrompt}


════════════════════════════════════════════════════════════════
📝 МОРАЛЬ (Morality)
════════════════════════════════════════════════════════════════

${moralPrompt}


════════════════════════════════════════════════════════════════
📝 ДРАМА (Drama)
════════════════════════════════════════════════════════════════

${dramaPrompt}


════════════════════════════════════════════════════════════════
📝 КРАСОТА (Beauty)
════════════════════════════════════════════════════════════════

${beautyPrompt}


════════════════════════════════════════════════════════════════
⚠️ ВАЖНО
════════════════════════════════════════════════════════════════

Note: В конкурсе будут участвовать все выдающиеся поэты, поэтому придется ставить и низкие оценки. В целом весь диапазон оценок. Считай себя строгим критиком, но справедливым.
`.trim();
    
    // Копируем в буфер обмена
    navigator.clipboard.writeText(allPrompts)
      .then(() => {
        alert('✅ Промпты скопированы в буфер обмена!');
      })
      .catch(err => {
        console.error('Ошибка копирования:', err);
        alert('❌ Не удалось скопировать промпты');
      });
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
      {/* Секция Данные */}
      <div className="admin-section data-section">
        <h2 className="section-title">Данные</h2>
        <div className="data-actions">
          <button 
            className="btn-header-action"
            onClick={handleExportData}
            disabled={poets.length === 0}
            title="Скачать бэкап всех данных"
          >
            Скачать бэкап
          </button>
          
          <label className="btn-header-action btn-small" title="Загрузить бэкап из файла">
            Загрузить
            <input 
              type="file" 
              accept=".json"
              onChange={handleImportData}
              style={{ display: 'none' }}
            />
          </label>
          
          <button 
            className="btn-header-action btn-danger"
            onClick={() => setShowDeleteAllConfirm(true)}
            disabled={poets.length === 0}
          >
            Удалить всё
          </button>
        </div>
      </div>
      
      <div className="admin-content">
        {/* Список поэтов */}
        <div className="admin-section">
          <h2 className="section-title">Поэты</h2>
          <div className="poets-list">
            {[...poets].sort((a, b) => {
              // Сортировка по ID (Firebase push keys хронологические — новые сверху)
              return b.id.localeCompare(a.id);
            }).map(poet => (
              <div
                key={poet.id}
                className={`poet-item ${selectedPoet?.id === poet.id ? 'active' : ''}`}
              >
                <div className="poet-item-main" onClick={() => setSelectedPoet(poet)}>
                  <img 
                    src={poet.imageUrl} 
                    alt={poet.name}
                    className="poet-item-avatar"
                    style={{ 
                      objectPosition: `center ${poet.imagePositionY !== undefined ? poet.imagePositionY : 25}%`
                    }}
                  />
                  <span className="poet-item-name">
                    {(() => {
                      const parts = poet.name.split(' ');
                      if (parts.length === 1) return parts[0]; // Только псевдоним/фамилия
                      return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
                    })()}
                  </span>
                </div>
                <div className="poet-item-actions">
                  <button
                    className="btn-edit-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditBio(poet);
                    }}
                    title="Биография"
                  >
                    <BookOpen size={16} />
                  </button>
                  <button
                    className="btn-edit-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditInfluence(poet);
                    }}
                    title="Мораль"
                  >
                    <Scale size={16} />
                  </button>
                  <button
                    className="btn-edit-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditDrama(poet);
                    }}
                    title="Драма"
                  >
                    <HeartCrack size={16} />
                  </button>
                  <button
                    className="btn-edit-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditBeauty(poet);
                    }}
                    title="Красота"
                  >
                    <Flower2 size={16} />
                  </button>
                  <button
                    className="btn-edit-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditAIRating(poet);
                    }}
                    title="AI-рейтинг"
                  >
                    <Bot size={16} />
                  </button>
                  <button
                    className="btn-edit-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditPhoto(poet);
                    }}
                    title="Фото"
                  >
                    <Camera size={16} />
                  </button>
                  <button
                    className="btn-edit-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditLinks(poet);
                    }}
                    title="Ссылки"
                  >
                    <Link2 size={16} />
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
              Стихи: {selectedPoet.name}
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
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Назначение победителей вручную */}
        <div className="admin-section assign-leader-section">
<h2 className="section-title">Награды</h2>
          <p className="section-hint">Если дуэль не запустилась или более 2 претендентов</p>
          
          <div className="assign-controls">
            <div className="assign-row">
              <label>
                Пользователь:
                <select value={assignUser} onChange={(e) => setAssignUser(e.target.value)}>
                  <option value="maxim">Максим</option>
                  <option value="oleg">Олег</option>
                </select>
              </label>
              
              <label>
                Категория:
                <select value={assignCategory} onChange={(e) => setAssignCategory(e.target.value)}>
                  <option value="overall">Общий балл</option>
                  <option value="overall_worst">Худший поэт</option>
                  <option value="creativity">Творчество</option>
                  <option value="influence">Мораль</option>
                  <option value="drama">Драма</option>
                  <option value="beauty">Красота</option>
                </select>
              </label>
              
              <button 
                className="btn-show-contenders"
                onClick={() => setShowAssignLeaderModal(true)}
              >
                Показать претендентов
              </button>
            </div>
          </div>
        </div>
        
        {/* Проценты категорий */}
        <div className="admin-section settings-section">
          <h2 className="section-title">Проценты категорий</h2>
          <p className="section-hint">
            Настройте веса категорий для расчета общего балла (сумма должна быть 100%)
          </p>
          
          <div className="coefficients-grid">
            {Object.entries(categoryCoefficients).map(([key, category]) => (
              <div key={key} className="coefficient-item">
                <label htmlFor={`coeff-${key}`}>
                  <span className="coefficient-icon">
                    {key === 'creativity' && <BookOpen size={18} />}
                    {key === 'influence' && <Scale size={18} />}
                    {key === 'drama' && <HeartCrack size={18} />}
                    {key === 'beauty' && <Flower2 size={18} />}
                  </span>
                  <span className="coefficient-name">{category.name}</span>
                </label>
                <div className="coefficient-input-group">
                  <input
                    id={`coeff-${key}`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={editingCoefficients[key] || '0'}
                    onChange={(e) => handleCoefficientChange(key, e.target.value)}
                    className="coefficient-input"
                  />
                  <span className="coefficient-unit">%</span>
                </div>
              </div>
            ))}
          </div>
          
          <div className="coefficients-actions">
            <button 
              className="btn-save-coefficients"
              onClick={saveCategoryCoefficients}
              title="Сохранить проценты категорий"
            >
              Сохранить проценты
            </button>
            
            {coefficientsError && (
              <div className="coefficients-error">{coefficientsError}</div>
            )}
            
            {coefficientsSaved && (
              <div className="coefficients-success">✓ Проценты сохранены</div>
            )}
            
            <div className="coefficients-sum">
              Сумма: {Object.values(editingCoefficients).reduce((sum, val) => sum + parseFloat(val || 0), 0).toFixed(1)}%
            </div>
          </div>
        </div>
        
        {/* Новогодние настройки */}
        <div className="admin-section settings-section">
          <h2 className="section-title">Гирлянда</h2>
          <div className="settings-inline">
            <button 
              className={`toggle-btn ${garlandEnabled ? 'active' : ''}`}
              onClick={toggleGarland}
              title="Показать гирлянду"
            >
              {garlandEnabled ? 'Вкл' : 'Выкл'}
            </button>
            <button 
              className={`toggle-btn ${glowEnabled ? 'active' : ''}`}
              onClick={toggleGlow}
              disabled={!garlandEnabled}
              title="Свечение лампочек"
            >
              Свечение
            </button>
            <button 
              className={`toggle-btn ${breathingEnabled ? 'active' : ''}`}
              onClick={toggleBreathing}
              disabled={!garlandEnabled}
              title="Дыхание лампочек"
            >
              Затухание
            </button>
            <button
              className={`toggle-btn ${footerFlowersEnabled ? 'active' : ''}`}
              onClick={toggleFooterFlowers}
              title="Цветы над футером"
            >
              Цветы в футере
            </button>
          </div>
        </div>

        <div className="admin-section settings-section">
          <h2 className="section-title">Общий рейтинг</h2>
          <div className="settings-inline">
            <button
              className={`toggle-btn ${jumpAnimationEnabled ? 'active' : ''}`}
              onClick={toggleJumpAnimation}
              title="Прыжковая анимация нового поэта в общем рейтинге"
            >
              Анимация прыжков: {jumpAnimationEnabled ? 'Вкл' : 'Выкл'}
            </button>
          </div>
        </div>
        
        {/* Обслуживание данных - скрыто, раскомментировать при необходимости */}
        {/* <div className="admin-section settings-section">
          <h2 className="section-title">Обслуживание</h2>
          <div className="settings-inline">
            <button 
              className="cleanup-btn"
              onClick={async () => {
                const count = await cleanupInvalidData();
                alert(count > 0 
                  ? `Очищено ${count} невалидных записей. Проверьте консоль для деталей.`
                  : 'Невалидных данных не найдено!'
                );
              }}
              title="Удалить ссылки на несуществующих поэтов"
            >
              Очистить невалидные данные
            </button>
          </div>
        </div> */}
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
            
            <h2 className="modal-title">Удалить всё?</h2>
            
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
              {/* <p className="delete-all-warning-final">
                <strong>Это действие необратимо!</strong>
              </p> */}
              
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
                  {isGeneratingBio ? 'Генерирую...' : 'Сгенерировать AI'}
                </button>
                <button 
                  className="btn-copy-prompts"
                  onClick={handleCopyBioPrompt}
                  title="Скопировать промпт в буфер обмена"
                >
                  Промпт
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
              Мораль: {selectedPoet?.name}
            </h2>
            
            <div className="bio-modal-content">
              <div className="bio-actions">
                <button 
                  className="btn-generate-bio"
                  onClick={handleGenerateInfluence}
                  disabled={isGeneratingInfluence}
                >
                  {isGeneratingInfluence ? 'Генерирую...' : 'Сгенерировать AI'}
                </button>
                <button 
                  className="btn-copy-prompts"
                  onClick={handleCopyInfluencePrompt}
                  title="Скопировать промпт в буфер обмена"
                >
                  Промпт
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
                  {isGeneratingDrama ? 'Генерирую...' : 'Сгенерировать AI'}
                </button>
                <button 
                  className="btn-copy-prompts"
                  onClick={handleCopyDramaPrompt}
                  title="Скопировать промпт в буфер обмена"
                >
                  Промпт
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
                  {isGeneratingBeauty ? 'Генерирую...' : 'Сгенерировать AI'}
                </button>
                <button 
                  className="btn-copy-prompts"
                  onClick={handleCopyBeautyPrompt}
                  title="Скопировать промпт в буфер обмена"
                >
                  Промпт
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
              AI-Рейтинг: {selectedPoet?.name}
            </h2>
            
            <div className="bio-modal-content">
              <div className="bio-actions">
                <button 
                  className="btn-generate-bio"
                  onClick={handleGenerateAIRating}
                  disabled={isGeneratingAIRating}
                >
                  {isGeneratingAIRating ? 'Генерирую...' : 'Сгенерировать AI'}
                </button>
                <button 
                  className="btn-copy-prompts"
                  onClick={handleCopyPrompts}
                  title="Скопировать промпты в буфер обмена"
                >
                  Промпты
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
                  <label>Мораль (1-5):</label>
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
      
      {/* Модалка настройки фото */}
      {showPhotoModal && (
        <div className="modal-overlay" onClick={closePhotoModal}>
          <div className="modal-content bio-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close" 
              onClick={closePhotoModal}
              title="Закрыть"
            >
              ✕
            </button>
            
            <h2 className="modal-title">
            Настройка фото: {selectedPoet?.name}
            </h2>
            
            <div className="bio-modal-content">
              {/* Превью фото */}
              {selectedPoet?.imageUrl && (
                <div className="photo-preview-container">
                  <div className="photo-preview-wrapper">
                    <img 
                      src={selectedPoet.imageUrl} 
                      alt={selectedPoet.name}
                      className="photo-preview-image"
                      style={{ 
                        objectPosition: `center ${editImagePositionY}%`
                      }}
                    />
                  </div>
                  <p className="photo-preview-label">Превью (280×380px)</p>
                </div>
              )}
              
              {/* Слайдер позиции */}
              <div className="position-slider-container">
                <label className="slider-label">
                  Вертикальная позиция: {editImagePositionY}%
                </label>
                <input 
                  type="range"
                  min="0"
                  max="100"
                  value={editImagePositionY}
                  onChange={(e) => setEditImagePositionY(Number(e.target.value))}
                  className="position-slider"
                />
                <p className="slider-hint">
                  0% = верх фото (небо) • 25% = лицо • 50% = середина • 100% = низ фото
                </p>
              </div>
              
              <div className="bio-modal-actions">
                <button 
                  className="btn-cancel-bio" 
                  onClick={closePhotoModal}
                >
                  Отмена
                </button>
                <button 
                  className="btn-save-bio" 
                  onClick={handleSavePhoto}
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Модалка редактирования ссылок */}
      {showLinksModal && (
        <div className="modal-overlay" onClick={closeLinksModal}>
          <div className="modal-content bio-modal links-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close" 
              onClick={closeLinksModal}
              title="Закрыть"
            >
              ✕
            </button>
            
            <h2 className="modal-title">
              Ссылки: {selectedPoet?.name}
            </h2>
            
            <div className="bio-modal-content">
              {/* Ссылка на Википедию */}
              <div className="links-section">
                <label className="links-label">Википедия</label>
                <input 
                  type="url"
                  value={editWikiUrl}
                  onChange={(e) => setEditWikiUrl(e.target.value)}
                  placeholder="https://ru.wikipedia.org/wiki/..."
                  className="links-input"
                />
              </div>
              
              {/* Ссылка на стихи */}
              <div className="links-section">
                <label className="links-label">Стихи (Rustih.ru)</label>
                <input 
                  type="url"
                  value={editPoemsUrl}
                  onChange={(e) => setEditPoemsUrl(e.target.value)}
                  placeholder="https://rustih.ru/..."
                  className="links-input"
                />
              </div>
              
              {/* Ссылка на цитаты */}
              <div className="links-section">
                <label className="links-label">Цитаты (Wikiquote)</label>
                <input 
                  type="url"
                  value={editWikiquoteUrl}
                  onChange={(e) => setEditWikiquoteUrl(e.target.value)}
                  placeholder="https://ru.wikiquote.org/wiki/..."
                  className="links-input"
                />
              </div>
              
              {/* YouTube ссылки */}
              <div className="links-section">
                <label className="links-label">YouTube</label>
                
                {editYoutubeLinks.length > 0 && (
                  <div className="links-list">
                    {editYoutubeLinks.map((yt, index) => (
                      <div key={index} className="link-item">
                        <span className="link-item-title">{yt.title}</span>
                        <a href={yt.url} target="_blank" rel="noopener noreferrer" className="link-item-url">
                          {yt.url.length > 35 ? yt.url.substring(0, 35) + '...' : yt.url}
                        </a>
                        <button 
                          className="btn-remove-link"
                          onClick={() => handleRemoveYoutubeLink(index)}
                          title="Удалить"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="add-link-form">
                  <input 
                    type="text"
                    value={newYoutubeTitle}
                    onChange={(e) => setNewYoutubeTitle(e.target.value)}
                    placeholder="Название"
                    className="links-input small"
                  />
                  <input 
                    type="url"
                    value={newYoutubeUrl}
                    onChange={(e) => setNewYoutubeUrl(e.target.value)}
                    placeholder="https://youtube.com/..."
                    className="links-input flex-1"
                  />
                  <button 
                    className="btn-add-link"
                    onClick={handleAddYoutubeLink}
                    disabled={!newYoutubeUrl.trim()}
                    title="Добавить"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
              
              {/* Другие ссылки */}
              <div className="links-section">
                <label className="links-label">Другие ссылки</label>
                
                {editOtherLinks.length > 0 && (
                  <div className="links-list">
                    {editOtherLinks.map((link, index) => (
                      <div key={index} className="link-item">
                        <span className="link-item-title">{link.title}</span>
                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="link-item-url">
                          {link.url.length > 35 ? link.url.substring(0, 35) + '...' : link.url}
                        </a>
                        <button 
                          className="btn-remove-link"
                          onClick={() => handleRemoveOtherLink(index)}
                          title="Удалить"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="add-link-form">
                  <input 
                    type="text"
                    value={newOtherTitle}
                    onChange={(e) => setNewOtherTitle(e.target.value)}
                    placeholder="Название"
                    className="links-input small"
                  />
                  <input 
                    type="url"
                    value={newOtherUrl}
                    onChange={(e) => setNewOtherUrl(e.target.value)}
                    placeholder="https://..."
                    className="links-input flex-1"
                  />
                  <button 
                    className="btn-add-link"
                    onClick={handleAddOtherLink}
                    disabled={!newOtherUrl.trim()}
                    title="Добавить"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="bio-modal-actions">
              <button 
                className="btn-cancel-bio" 
                onClick={closeLinksModal}
              >
                Отмена
              </button>
              <button 
                className="btn-save-bio" 
                onClick={handleSaveLinks}
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Модалка назначения победителя */}
      {showAssignLeaderModal && (
        <div className="modal-overlay" onClick={() => setShowAssignLeaderModal(false)}>
          <div className="modal-content assign-leader-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close" 
              onClick={() => setShowAssignLeaderModal(false)}
              title="Закрыть"
            >
              ×
            </button>
            
            <h2 className="modal-title">
              Назначить победителя: {assignUser === 'maxim' ? 'Максим' : 'Олег'}
            </h2>
            
            <div className="assign-category-info">
              <strong>Категория:</strong> {
                assignCategory === 'overall' ? 'Общий балл' :
                assignCategory === 'overall_worst' ? 'Худший поэт' :
                CATEGORIES[assignCategory]?.name || assignCategory
              }
            </div>
            
            {(() => {
              const contenders = getContenders();
              
              if (contenders.length === 0) {
                return <p className="no-contenders">Нет претендентов (все поэты имеют разные баллы или недостаточно поэтов)</p>;
              }
              
              if (contenders.length === 1) {
                return (
                  <div>
                    <p className="single-contender">Только один претендент:</p>
                    <div className="contender-card">
                      <img 
                        src={contenders[0].imageUrl} 
                        alt={contenders[0].name}
                        style={{ 
                          objectPosition: `center ${contenders[0].imagePositionY !== undefined ? contenders[0].imagePositionY : 25}%`
                        }}
                      />
                      <div>
                        <h3>{contenders[0].name}</h3>
                        <p>Балл: {(contenders[0].score || contenders[0].rating).toFixed(2)}</p>
                      </div>
                      <button 
                        className="btn-assign-leader"
                        onClick={() => assignLeader(contenders[0].id)}
                      >
                        Назначить
                      </button>
                    </div>
                  </div>
                );
              }
              
              return (
                <div>
                  <p className="contenders-count">Претендентов: {contenders.length}</p>
                  <div className="contenders-list">
                    {contenders.map(poet => (
                      <div key={poet.id} className="contender-card">
                        <img 
                          src={poet.imageUrl} 
                          alt={poet.name}
                          style={{ 
                            objectPosition: `center ${poet.imagePositionY !== undefined ? poet.imagePositionY : 25}%`
                          }}
                        />
                        <div>
                          <h3>{poet.name}</h3>
                          <p>Балл: {(poet.score || poet.rating).toFixed(2)}</p>
                        </div>
                        <button 
                          className="btn-assign-leader"
                          onClick={() => assignLeader(poet.id)}
                        >
                          Назначить
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;

