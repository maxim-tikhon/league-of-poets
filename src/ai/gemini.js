/**
 * Модуль для работы с Gemini AI API
 */

import { GoogleGenAI } from '@google/genai';

// Название модели можно изменить здесь
const MODEL_NAME = 'gemini-flash-latest';

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
const GENERATION_TEMPERATURE = 0.5;

/**
 * Количество попыток для усреднения AI-рейтингов
 * Чем больше - тем справедливее, но дольше
 * Рекомендуется: 3 (оптимальный баланс) или 5 (максимальная точность)
 */
const AI_RATING_ATTEMPTS = 3;

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
export const generateContent = async (prompt, temperature = GENERATION_TEMPERATURE) => {
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
 * Генерация AI-рейтинга с максимальной объективностью
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
        maxOutputTokens: 100,
      },
    });
    return true;
  } catch (err) {
    console.error('API недоступен:', err);
    return false;
  }
};

