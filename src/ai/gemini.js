/**
 * Модуль для работы с Gemini AI API
 */

import { GoogleGenAI } from '@google/genai';

// Название модели можно изменить здесь
const MODEL_NAME = 'gemini-flash-latest';

// Задержка между запросами (в мс) для избежания rate limit
const REQUEST_DELAY_MS = 12000; // 12 секунд = 5 RPM

// Максимальное количество повторных попыток при ошибках
const MAX_RETRIES = 2;

// Утилита для задержки
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Парсинг времени ожидания из ответа Gemini (например "45.401998411s" -> 45401)
const parseRetryDelay = (errorMessage) => {
  const match = errorMessage.match(/retry in ([\d.]+)s/i);
  if (match) {
    return Math.ceil(parseFloat(match[1]) * 1000) + 1000; // +1 секунда запаса
  }
  return REQUEST_DELAY_MS; // По умолчанию
};

// ============================================
// НАСТРОЙКИ ГЕНЕРАЦИИ
// ============================================

/**
 * Температура для генерации (0.0 - 1.0)
 * 
 * Temperature контролирует "креативность" AI:
 * 
 * 0.0-0.3 (рекомендуется для фактов):
 *   - Детерминированные, предсказуемые ответы
 *   - Факты, даты, структурированные данные
 *   - Биографии поэтов, влияние, драма, красота
 *   - Меньше "выдумок", больше точности
 * 
 * 0.5-0.7 (сбалансированный):
 *   - Умеренная креативность
 *   - Описания, объяснения
 * 
 * 0.8-1.0 (креативный):
 *   - Максимальная непредсказуемость
 *   - Художественные тексты, стихи
 *   - Разнообразные, неожиданные формулировки
 */
const GENERATION_TEMPERATURE = 0.1;

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
 * @param {number} temperature - Температура генерации (0.0-1.0). По умолчанию 0.2
 * @returns {Promise<string>} - Сгенерированный текст
 * @throws {Error} - Ошибки API с подробным описанием
 */
export const generateContent = async (prompt, temperature = GENERATION_TEMPERATURE, retryCount = 0) => {
  try {
    const ai = initializeAI();
    
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      generationConfig: {
        temperature: temperature,
        // maxOutputTokens: 8192,
      },
    });
    
    // Получаем текст из ответа
    const generatedText = response.text;
    
    // Проверяем, что ответ не пустой
    if (!generatedText) {
      throw new Error('Gemini вернул пустой ответ (возможно rate limit или safety filter)');
    }
    
    // Очищаем от markdown форматирования
    const cleanText = generatedText
      .replace(/\*\*/g, '')  // Убираем **
      .replace(/\*/g, '')    // Убираем *
      .replace(/^#+\s/gm, '') // Убираем заголовки #
      .trim();
    
    return cleanText;
    
  } catch (err) {
    const errorStr = typeof err.message === 'string' ? err.message : JSON.stringify(err);
    
    // Проверяем, можно ли сделать retry
    const isRateLimitError = errorStr.includes('429') || errorStr.includes('RESOURCE_EXHAUSTED') || errorStr.includes('quota');
    const isOverloadError = errorStr.includes('503') || errorStr.includes('overloaded') || errorStr.includes('UNAVAILABLE');
    
    if ((isRateLimitError || isOverloadError) && retryCount < MAX_RETRIES) {
      const retryDelay = parseRetryDelay(errorStr);
      await delay(retryDelay);
      return generateContent(prompt, temperature, retryCount + 1);
    }
    
    // Обрабатываем различные типы ошибок
    if (err.message?.includes('API_KEY_INVALID')) {
      throw new Error('Неверный API ключ. Проверьте ключ в файле .env');
    } else if (err.message?.includes('PERMISSION_DENIED') || err.message?.includes('403')) {
      throw new Error('API не активирован. Включите Generative Language API в Google Cloud Console');
    } else if (isRateLimitError) {
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
 * НОВАЯ ВЕРСИЯ: Генерация AI-рейтинга по отдельным категориям
 * Делает 4 отдельных запроса (по одному на каждую категорию)
 * @param {string} poetName - Имя поэта
 * @param {Object} promptFunctions - Объект с функциями промптов {creativity, influence, drama, beauty}
 * @param {Array} existingRatings - Массив уже оцененных поэтов для контекста
 * @returns {Promise<Object>} - Рейтинг { creativity, influence, drama, beauty }
 */
export const generateAIRatingByCat = async (poetName, promptFunctions, existingRatings = []) => {
  const ratings = {
    creativity: 0,
    influence: 0,
    drama: 0,
    beauty: 0
  };
  
  const categories = [
    { key: 'creativity', promptFunc: promptFunctions.creativity },
    { key: 'influence', promptFunc: promptFunctions.influence },
    { key: 'drama', promptFunc: promptFunctions.drama },
    { key: 'beauty', promptFunc: promptFunctions.beauty }
  ];
  
  // Делаем 4 отдельных запроса (по одному на категорию) с задержкой между ними
  for (let i = 0; i < categories.length; i++) {
    const { key, promptFunc } = categories[i];
    
    // Добавляем задержку перед каждым запросом (кроме первого)
    if (i > 0) {
      await delay(REQUEST_DELAY_MS);
    }
    
    try {
      const prompt = promptFunc(poetName, existingRatings);
      const response = await generateContent(prompt, 0); // temperature = 0 для детерминизма
      
      // Парсим одиночное число из ответа (0.5-5 с шагом 0.5)
      const match = response.match(/([0-5](?:\.[05])?|0\.5)/);
      if (match) {
        const rating = parseFloat(match[1]);
        
        // Проверка валидности (от 0.5 до 5, с шагом 0.5)
        if (rating >= 0.5 && rating <= 5 && (rating * 2) % 1 === 0) {
          ratings[key] = rating;
        }
      }
    } catch (err) {
      // Оставляем 0 для этой категории при ошибке
    }
  }
  
  return ratings;
};

/**
 * УСТАРЕВШАЯ ВЕРСИЯ: Генерация AI-рейтинга с усреднением
 * Делает несколько запросов и усредняет результаты для большей справедливости
 * @param {string} prompt - Промпт для генерации
 * @param {function} parseFunction - Функция для парсинга ответа AI
 * @returns {Promise<Object>} - Усреднённый рейтинг { creativity, influence, drama, beauty }
 */
export const generateAIRating = async (prompt, parseFunction) => {
  const allRatings = [];
  
  // Делаем несколько запросов для усреднения
  for (let i = 0; i < AI_RATING_ATTEMPTS; i++) {
    try {
      const response = await generateContent(prompt, 0);
      const ratings = parseFunction(response);
      allRatings.push(ratings);
    } catch (err) {
      console.error(`Ошибка при попытке ${i + 1}:`, err);
      // Продолжаем даже если одна попытка не удалась
    }
  }
  
  // Если все попытки провалились - возвращаем нули
  if (allRatings.length === 0) {
    return { creativity: 0, influence: 0, drama: 0, beauty: 0 };
  }
  
  // Усредняем результаты
  const averaged = {
    creativity: 0,
    influence: 0,
    drama: 0,
    beauty: 0
  };
  
  const categories = ['creativity', 'influence', 'drama', 'beauty'];
  
  categories.forEach(category => {
    const sum = allRatings.reduce((acc, rating) => acc + (rating[category] || 0), 0);
    const average = sum / allRatings.length;
    
    // Округляем до ближайшего 0.5
    averaged[category] = roundToHalf(average);
  });
  
  return averaged;
};

/**
 * Округление числа до ближайшего 0.5
 * Примеры: 3.2 → 3.0, 3.3 → 3.5, 3.7 → 4.0
 * @param {number} num - Число для округления
 * @returns {number} - Округлённое число
 */
const roundToHalf = (num) => {
  return Math.round(num * 2) / 2;
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
      generationConfig: {
        temperature: GENERATION_TEMPERATURE,
        //maxOutputTokens: 100,
      },
    });
    return true;
  } catch (err) {
    console.error('API недоступен:', err);
    return false;
  }
};

