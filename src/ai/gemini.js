/**
 * Модуль для работы с Gemini AI API
 */

import { GoogleGenAI } from '@google/genai';

// Название модели можно изменить здесь
const MODEL_NAME = 'gemini-flash-latest';

/**
 * Инициализация Gemini AI клиента
 * @returns {GoogleGenAI} - Инициализированный клиент
 * @throws {Error} - Если API ключ не настроен
 */
const initializeAI = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  
  if (!apiKey || apiKey === 'your_api_key_here') {
    throw new Error('API ключ Gemini не настроен. Создайте файл .env с VITE_GEMINI_API_KEY');
  }

  return new GoogleGenAI({ apiKey });
};

/**
 * Генерация контента через Gemini AI
 * @param {string} prompt - Промпт для генерации
 * @returns {Promise<string>} - Сгенерированный текст
 * @throws {Error} - Ошибки API с подробным описанием
 */
export const generateContent = async (prompt) => {
  try {
    const ai = initializeAI();
    
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });
    
    // Получаем текст из ответа
    const generatedText = response.text;
    
    // Очищаем от markdown форматирования
    const cleanText = generatedText
      .replace(/\*\*/g, '')  // Убираем **
      .replace(/\*/g, '')    // Убираем *
      .replace(/^#+\s/gm, '') // Убираем заголовки #
      .trim();
    
    return cleanText;
    
  } catch (err) {
    console.error('Ошибка генерации Gemini AI:', err);
    
    // Обрабатываем различные типы ошибок
    if (err.message?.includes('API_KEY_INVALID')) {
      throw new Error('Неверный API ключ. Проверьте ключ в файле .env');
    } else if (err.message?.includes('PERMISSION_DENIED') || err.message?.includes('403')) {
      throw new Error('API не активирован. Включите Generative Language API в Google Cloud Console');
    } else if (err.message?.includes('RESOURCE_EXHAUSTED') || err.message?.includes('429')) {
      throw new Error('Превышен лимит запросов. Попробуйте позже');
    } else if (err.message?.includes('404')) {
      throw new Error(`Модель ${MODEL_NAME} не найдена. Проверьте название модели`);
    } else if (err.message) {
      throw new Error(err.message);
    } else {
      throw new Error('Неизвестная ошибка при генерации контента');
    }
  }
};

/**
 * Проверка доступности API
 * @returns {Promise<boolean>} - true если API доступен
 */
export const checkAPIAvailability = async () => {
  try {
    const ai = initializeAI();
    // Делаем минимальный запрос для проверки
    await ai.models.generateContent({
      model: MODEL_NAME,
      contents: 'Test',
    });
    return true;
  } catch (err) {
    console.error('API недоступен:', err);
    return false;
  }
};

