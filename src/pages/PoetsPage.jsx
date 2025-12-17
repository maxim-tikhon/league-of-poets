import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePoets } from '../context/PoetsContext';
import { generateContent, generateAIRatingByCat } from '../ai/gemini';
import { generatePoetBioPrompt, generatePoetLifeStoryPrompt, generatePoetInfluencePrompt, generatePoetCreativityPrompt, generatePoetDramaPrompt, generatePoetBeautyPrompt, generateAIRatingCreativityPrompt, generateAIRatingMoralPrompt, generateAIRatingDramaPrompt, generateAIRatingBeautyPrompt } from '../ai/prompts';

// Пул 1: Самые известные поэты (наивысший шанс выпадения) — 22 поэта
const SUPER_POETS = [
  'Александр Пушкин', 'Михаил Лермонтов', 'Сергей Есенин', 'Иван Крылов',
  'Николай Некрасов', 'Владимир Маяковский', 'Фёдор Тютчев', 'Афанасий Фет',
  'Анна Ахматова', 'Владимир Высоцкий', 'Иосиф Бродский', 'Марина Цветаева',
  'Александр Блок', 'Борис Пастернак', 'Евгений Евтушенко',
  'Иван Бунин', 'Валерий Брюсов', 'Белла Ахмадулина', 'Николай Гумилев',
  'Александр Твардовский', 'Роберт Рождественский', 'Осип Мандельштам'
];

// Пул 2: Поэты (подняты из Пула 3) — 29 поэтов
const PRIMARY_POETS = [
  'Михаил Ломоносов', 'Гавриил Державин', 'Константин Батюшков', 'Евгений Баратынский',
  'Александр Грибоедов', 'Денис Давыдов', 'Кондратий Рылеев', 'Зинаида Гиппиус',
  'Дмитрий Мережковский', 'Максимилиан Волошин', 'Иннокентий Анненский', 'Игорь Северянин',
  'Андрей Белый', 'Велимир Хлебников', 'Даниил Хармс',
  'Николай Заболоцкий', 'Александр Галич', 'Александр Башлачёв', 'Егор Летов',
  'Булат Окуджава', 'Янка Дягилева', 'Виктор Цой', 'Арсений Тарковский', 'Борис Рыжий', 'Александр Введенский', 'Агния Барто',
  'Самуил Маршак', 'Корней Чуковский', 'Владислав Ходасевич'
];

// Пул 3: Известные поэты (высокий шанс выпадения) — 57 поэтов
const SECONDARY_POETS = [
  'Василий Жуковский', 'Муса Джалиль', 'Иван Тургенев',
   'Николай Рубцов', 'Расул Гамзатов', 'Константин Бальмонт',
  'Елена Благинина', 'Борис Заходер', 'Николай Добронравов', 'Юнна Мориц',
  'Юлия Друнина', 'Алексей Толстой', 'Зинаида Александрова', 'Саша Черный',
  'Иван Дмитриев', 'Александр Кушнер', 'Давид Самойлов', 'Ольга Берггольц',
  'Вероника Тушнова',
  'Юрий Воронов', 'Римма Казакова',
  'Юрий Левитанский', 'Яков Аким', 
  'Новелла Матвеева', 'Олег Григорьев', 'Ирина Пивоварова', 'Игорь Тальков',
  'Вера Инбер',
  'Александр Вертинский', 
  'Антон Дельвиг', 'Леонид Аронзон',
  'Дмитрий Быков', 'Игорь Губерман', 'Вера Полозкова', 'Валентин Гафт', 'Андрей Вознесенский',
  'Иван Барков', 'Фёдор Сологуб', 'Александр Радищев', 'Варлам Шаламов',
  'Земфира', 'Дельфин', 'Оксимирон', 'Монеточка', 'Илья Кормильцев', 'Ника Турбина',
  'Борис Поплавский', 'Эдуард Лимонов', 'Леонид Губанов', 'Константин Симонов', 
   'Черубина де Габриак', 'Майк Науменко', 'Юрий Шевчук', 'Борис Гребенщиков',
   'Татьяна Снежина', 'Noize MC', 'Эдуард Асадов'
];

// Пул 4: 42 поэта
const TERTIARY_POETS = [
  'Сергей Михалков', 'Аполлон Григорьев', 'Владимир Соловьев', 'Вячеслав Иванов', 'Алексей Крученых',
  'Николай Клюев', 'Владимир Нарбут', 'Эдуард Багрицкий', 'Геннадий Айги',
  'Дмитрий Пригов', 'Елена Шварц', 'Ольга Седакова', 'Михаил Кузмин',
  'Георгий Иванов', 'Геннадий Шпаликов', 'Юрий Визбор',
  'Юлий Ким', 'Эдуард Успенский', 'Дмитрий Кедрин',
  'Семен Гудзенко', 'Хаски', 'Алина Витухновская', 'Фёдор Достоевский', 'Лев Толстой',
  'Максим Горький', 'Антон Чехов', 'Владимир Набоков', 'Тэффи', 'Даниил Андреев', 'Леонид Филатов',
  'Дмитрий Веневитинов', 'Вильгельм Кюхельбекер', 'Игорь Холин', 'Каролина Павлова',
  'Георгий Адамович','Елена Гуро',
  // 
   'Генрих Сапгир', 'Лев Рубинштейн', 'Николай Олейников', 'София Парнок',
   'Борис Слуцкий', 'Мирра Лохвицкая'
];

// Пул 5: Дополнительные поэты (обычный шанс) — 17 поэтов
const QUATERNARY_POETS = [
   'Николай Огарёв', 'Семен Надсон','Николай Агнивцев', 'Аделаида Герцык',
  'Илья Сельвинский', 'Илья Эренбург', 'Ирина Одоевцева', 'Константин Фофанов',
   'Сергей Клычков','Леонид Мартынов',
  'Аполлон Майков', 'Николай Карамзин', 'Петр Вяземский',
  'Мария Степанова', 'Николай Асеев', 'Сергей Гандлевский', 'Михаил Исаковский'
  
  // 'Александр Бестужев', 'Александр Одоевский',  'Яков Полонский', 'Алексей Апухтин',
  // 'Демьян Бедный', 'Ярослав Смеляков','Александр Межиров','Вера Павлова', 'Марина Бородицкая',
  // 'Аля Кудряшова', 'Ах Астахова',
  // 'Владимир Орлов','Роман Сеф','Михаил Яснов',
  // 'Валентин Берестов'
  
  // ?????? 'Козьма Прутков', - not real

  //ценность техническая
  //'Александр Сумароков','Василий Тредиаковский'

];

// Пул 6: Поэты с минимальным шансом — 0 поэтов
const QUINARY_POETS = [
  // 'Михаил Пляцковский', 'Ирина Токмакова', 'Юрий Энтин', 'Михаил Матусовский', 'Георгий Ладонщиков',
  // 'Пётр Синявский', 'Эмма Мошковская', 'Ольга Высотская',
  // 'Алексей Сурков', 'Андрей Дементьев', 'Константин Ваншенкин',
  // 'Сергей Орлов', 'Михаил Дудин', 'Александр Яшин', 'Виктор Боков',
  // 'Алексей Плещеев', 'Иван Никитин', 'Иван Суриков', 'Алексей Кольцов', 'Фёдор Глинка', 'Николай Языков',
  // 'Лариса Рубальская'
];

// Пул 7: Запасная скамейка (не участвуют в случайном выборе) — 0 поэтов
const RESERVE_POETS = [
  // 'Алексей Жемчужников', 'Вадим Шершеневич', 'Владимир Луговской',
  // 'Всеволод Багрицкий', 'Галина Галина', 'Николай Тихонов',
  // 'Сергей Городецкий', 'Рюрик Ивнев', 'Семен Кирсанов', 'Николай Рерих',
  // 'Юргис Балтрушайтис', 'Сергей Обрадович',
  // more inportant below
  // 'Николай Оцуп',
  // 'Андрей Усачев', 'Владимир Степанов',
  // 'Михаил Зенкевич'
];

// Полный список всех поэтов (SUPER ×3, PRIMARY ×3, SECONDARY ×2, TERTIARY ×2, QUATERNARY ×1, QUINARY ×1)
// RESERVE_POETS не включены — они на запасной скамейке
const ALL_POETS = [...SUPER_POETS,...PRIMARY_POETS, ...SECONDARY_POETS, ...TERTIARY_POETS, ...QUATERNARY_POETS,
  ...SUPER_POETS,...PRIMARY_POETS, ...SECONDARY_POETS, ...TERTIARY_POETS,
  ...SUPER_POETS, ...PRIMARY_POETS, ...SECONDARY_POETS, 
  ...SUPER_POETS, ...PRIMARY_POETS, ...SUPER_POETS];
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
  const [showFavorites, setShowFavorites] = useState(false); // Показывать только любимых
  const [showTimeline, setShowTimeline] = useState(false); // Показывать таймлайн эпох
  const [isFirstLoad, setIsFirstLoad] = useState(true); // Флаг первой загрузки для анимации
  const [showNotification, setShowNotification] = useState(false); // Нотификация о копировании
  const [currentUser, setCurrentUser] = useState(null); // Текущий пользователь

  // Получаем текущего пользователя из localStorage
  useEffect(() => {
    const user = localStorage.getItem('currentUser');
    setCurrentUser(user);
  }, []);

  // Утилита для извлечения годов жизни из досье
  const extractYears = (bio) => {
    if (!bio) return null;
    
    // Ищем паттерн "Годы жизни: ... 1799 ... 1837"
    const lifeYearsMatch = bio.match(/Годы жизни:\s*(.+?)(?=(?:Национальность|Происхождение|Место рождения|$))/is);
    if (!lifeYearsMatch) return null;
    
    const lifeYearsText = lifeYearsMatch[1];
    
    // Извлекаем все 4-значные числа (годы)
    const years = lifeYearsText.match(/\b\d{4}\b/g);
    if (!years || years.length < 1) return null;
    
    const birthYear = parseInt(years[0]);
    const deathYear = years.length > 1 ? parseInt(years[1]) : null;
    
    // Извлекаем возраст смерти из био (если есть)
    const deathAgeMatch = bio.match(/Возраст смерти:\s*(\d+)/i);
    const deathAge = deathAgeMatch ? parseInt(deathAgeMatch[1]) : null;
    
    return { birthYear, deathYear, deathAge };
  };

  // Подготовка данных поэтов с годами жизни для таймлайна
  const getTimelinePoets = () => {
    return poets
      .map(poet => {
        const years = extractYears(poet.bio);
        if (!years) return null;
        
        // Используем возраст смерти из био, если есть; иначе вычисляем
        const calculatedLifespan = years.deathYear 
          ? years.deathYear - years.birthYear 
          : new Date().getFullYear() - years.birthYear;
        
        return {
          ...poet,
          birthYear: years.birthYear,
          deathYear: years.deathYear,
          lifespan: years.deathAge || calculatedLifespan,
          century: Math.floor(years.birthYear / 100) + 1,
          isAlive: !years.deathYear
        };
      })
      .filter(poet => poet !== null)
      .sort((a, b) => a.birthYear - b.birthYear);
  };

  // Алгоритм распределения поэтов по колонкам
  // Заполняем слева направо до максимума, потом возвращаемся в начало
  const assignColumns = (timelinePoets, maxColumns = 15) => {
    if (timelinePoets.length === 0) return [];
    
    // Сортируем по году рождения
    const sorted = [...timelinePoets].sort((a, b) => a.birthYear - b.birthYear);
    
    // Колонки - массив, где каждый элемент это год окончания последнего поэта в колонке
    const columns = Array(maxColumns).fill(0); // Инициализируем все колонки нулём (свободны)
    
    // Указатель на следующую колонку для проверки (идём слева направо)
    let nextColumnHint = 0;
    
    return sorted.map(poet => {
      const endYear = poet.deathYear || new Date().getFullYear();
      const minGap = 3; // Минимальный отступ между поэтами в годах
      
      // Начинаем поиск с nextColumnHint, идём вправо
      let assignedColumn = -1;
      
      // Сначала ищем от nextColumnHint до конца
      for (let i = nextColumnHint; i < maxColumns; i++) {
        if (poet.birthYear >= columns[i] + minGap) {
          assignedColumn = i;
          columns[i] = endYear;
          nextColumnHint = i + 1; // Следующий поэт начнёт искать со следующей колонки
          break;
        }
      }
      
      // Если не нашли — ищем с начала до nextColumnHint (новый "ряд")
      if (assignedColumn === -1) {
        for (let i = 0; i < nextColumnHint; i++) {
          if (poet.birthYear >= columns[i] + minGap) {
            assignedColumn = i;
            columns[i] = endYear;
            nextColumnHint = i + 1;
            break;
          }
        }
      }
      
      // Если всё равно не нашли — добавляем в первую доступную или расширяем
      if (assignedColumn === -1) {
        // Ищем любую свободную
        for (let i = 0; i < maxColumns; i++) {
          if (poet.birthYear >= columns[i] + minGap) {
            assignedColumn = i;
            columns[i] = endYear;
            nextColumnHint = i + 1;
            break;
          }
        }
      }
      
      // Fallback: если вообще ничего не подошло — ставим в наименее занятую колонку
      if (assignedColumn === -1) {
        const minEndYear = Math.min(...columns);
        assignedColumn = columns.indexOf(minEndYear);
        columns[assignedColumn] = endYear;
        nextColumnHint = assignedColumn + 1;
      }
      
      // Сбрасываем указатель если дошли до конца
      if (nextColumnHint >= maxColumns) {
        nextColumnHint = 0;
      }
      
      return { ...poet, column: assignedColumn };
    });
  };

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

  // Выбор случайного поэта из трёх пулов
  // SUPER_POETS (41) — наивысший шанс (3x в ALL_POETS)
  // PRIMARY_POETS (83) — высокий шанс (2x в ALL_POETS)
  // SECONDARY_POETS (78) — обычный шанс (1x в ALL_POETS)
  const handleGenerateRandomPoet = () => {
    setError('');
    
    // Список уже добавленных поэтов (приводим к нижнему регистру для сравнения)
    const existingPoetsLower = poets.map(p => p.name.toLowerCase());
    
    // Фильтруем ALL_POETS — там уже заложены веса (SUPER 3x, PRIMARY 2x, SECONDARY 1x)
    let availablePoets = ALL_POETS.filter(
      name => !existingPoetsLower.includes(name.toLowerCase())
    );
    
    if (availablePoets.length === 0) {
      setError('Все поэты из списка уже добавлены!');
      return;
    }
    
    // Выбираем случайного поэта
    const randomIndex = Math.floor(Math.random() * availablePoets.length);
    const poetName = availablePoets[randomIndex];
    
    setNewPoetName(poetName);
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
      const DELAY_MS = 12000; // 12 секунд между запросами (5 RPM limit)
      const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      
      try {
        // Генерируем досье
        const bioPrompt = generatePoetBioPrompt(trimmedName);
        const generatedBio = await generateContent(bioPrompt);
        await updatePoet(newPoet.id, { bio: generatedBio });
        
        // Генерируем биографию (жизненный путь)
        const lifeStoryPrompt = generatePoetLifeStoryPrompt(trimmedName);
        const generatedLifeStory = await generateContent(lifeStoryPrompt);
        await updatePoet(newPoet.id, { lifeStory: generatedLifeStory });
        
        await delay(DELAY_MS);
        
        // Генерируем влияние
        const influencePrompt = generatePoetInfluencePrompt(trimmedName);
        const generatedInfluence = await generateContent(influencePrompt);
        await updatePoet(newPoet.id, { influence: generatedInfluence });
        
        await delay(DELAY_MS);
        
        // Генерируем творчество
        const creativityPrompt = generatePoetCreativityPrompt(trimmedName);
        const generatedCreativity = await generateContent(creativityPrompt);
        await updatePoet(newPoet.id, { creativity: generatedCreativity });
        
        await delay(DELAY_MS);
        
        // Генерируем драму
        const dramaPrompt = generatePoetDramaPrompt(trimmedName);
        const generatedDrama = await generateContent(dramaPrompt);
        await updatePoet(newPoet.id, { drama: generatedDrama });
        
        await delay(DELAY_MS);
        
        // Генерируем красоту
        const beautyPrompt = generatePoetBeautyPrompt(trimmedName);
        const generatedBeauty = await generateContent(beautyPrompt);
        await updatePoet(newPoet.id, { beauty: generatedBeauty });

        // Генерируем AI-рейтинг (3 запроса с усреднением для справедливости)
        // Собираем существующие AI-рейтинги других поэтов для контекста
        // const existingAIRatings = poets
        //   .filter(p => p.aiRatings && Object.keys(p.aiRatings).length > 0)
        //   .map(p => ({
        //     name: p.name,
        //     ratings: p.aiRatings
        //   }));
        
        // Генерируем AI рейтинги (4 отдельных запроса, по одному на категорию)
        // const aiRatings = await generateAIRatingByCat(
        //   trimmedName,
        //   {
        //     creativity: generateAIRatingCreativityPrompt,
        //     influence: generateAIRatingMoralPrompt,
        //     drama: generateAIRatingDramaPrompt,
        //     beauty: generateAIRatingBeautyPrompt
        //   },
        //   existingAIRatings
        // );
        // await updatePoet(newPoet.id, { aiRatings });

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

  // Функция для получения фамилии
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
      } else if (sortBy === 'lastName') {
        const lastNameA = getLastName(a.name).toLowerCase();
        const lastNameB = getLastName(b.name).toLowerCase();
        comparison = lastNameA.localeCompare(lastNameB, 'ru');
      } else if (sortBy === 'birthYear') {
        const yearsA = extractYears(a.bio);
        const yearsB = extractYears(b.bio);
        const birthA = yearsA?.birthYear || 0;
        const birthB = yearsB?.birthYear || 0;
        comparison = birthB - birthA; // По умолчанию младшие первые (как и с датой добавления)
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
    <div className="poets-page">
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
          Дата добавления {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
        <button 
          className={`sort-btn ${sortBy === 'lastName' ? 'active' : ''}`}
          onClick={() => handleSort('lastName')}
        >
          Фамилия {sortBy === 'lastName' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
        <button 
          className={`sort-btn ${sortBy === 'birthYear' ? 'active' : ''}`}
          onClick={() => handleSort('birthYear')}
        >
          Дата рождения {sortBy === 'birthYear' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
        <button 
          className={`sort-btn ${sortBy === 'rating' ? 'active' : ''}`}
          onClick={() => handleSort('rating')}
        >
          Рейтинг {sortBy === 'rating' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
        
        <label className="ratings-toggle timeline-toggle">
          <input
            type="checkbox"
            checked={showTimeline}
            onChange={(e) => {
              setShowTimeline(e.target.checked);
              setIsFirstLoad(false);
            }}
          />
          <span className="toggle-slider"></span>
          <span className="toggle-label">Таймлайн</span>
        </label>

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
                    title="Выбрать случайного поэта из списка"
                  >
                    Случайный поэт
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

      {isLoading ? (
        // Пока загружается - показываем пустой контейнер
        <div className="poets-grid"></div>
      ) : showTimeline ? (
        // Режим таймлайна — вертикальная диаграмма жизни поэтов
        (() => {
          const timelinePoets = getTimelinePoets();
          
          if (timelinePoets.length === 0) {
            return (
              <div className="empty-state">
                <img src="/images/poet2.png" alt="Нет данных" className="empty-icon" />
                <p>Нет поэтов с данными о годах жизни</p>
                <p className="empty-hint">Добавьте информацию о годах жизни в досье поэтов</p>
              </div>
            );
          }

          // Ширина колонки поэта
          const columnWidth = 50; // пикселей
          
          // Рассчитываем сколько колонок влезает
          // Ширина контейнера примерно 1200px, ось 60px слева + 50px справа
          const containerWidth = 1200;
          const axisWidth = 110;
          const availableWidth = containerWidth - axisWidth;
          const maxColumns = Math.floor(availableWidth / columnWidth);
          
          // Распределяем поэтов по колонкам
          const poetsWithColumns = assignColumns(timelinePoets, maxColumns);
          const totalColumns = Math.min(maxColumns, Math.max(...poetsWithColumns.map(p => p.column)) + 1);

          // Находим долгожителя и короткожителя (среди умерших)
          const deadPoets = poetsWithColumns.filter(p => !p.isAlive && p.lifespan);
          const maxLifespan = deadPoets.length > 0 ? Math.max(...deadPoets.map(p => p.lifespan)) : 0;
          const minLifespan = deadPoets.length > 0 ? Math.min(...deadPoets.map(p => p.lifespan)) : 0;
          const longestLivedId = deadPoets.find(p => p.lifespan === maxLifespan)?.id;
          const shortestLivedId = deadPoets.find(p => p.lifespan === minLifespan)?.id;

          // Определяем временной диапазон
          const allYears = timelinePoets.flatMap(p => [p.birthYear, p.deathYear || new Date().getFullYear()]);
          const rawMinYear = Math.min(...allYears);
          const rawMaxYear = Math.max(...allYears);
          // Округляем до 50 лет для красивых подписей
          const minYear = Math.floor(rawMinYear / 50) * 50;
          const currentYear = new Date().getFullYear();
          const maxYear = currentYear;
          const totalYears = maxYear - minYear;
          
          // Высота в пикселях на год (для масштабирования)
          const pxPerYear = 5;
          const totalHeight = totalYears * pxPerYear;

          // Генерируем отметки на оси времени — каждые 10 лет с подписями, 50-летние более заметные
          const getTimeMarks = () => {
            const marks = [];
            for (let year = minYear; year <= maxYear; year += 10) {
              marks.push({
                year,
                position: ((year - minYear) / totalYears) * 100,
                isMajor: year % 50 === 0 // 50-летние более заметные
              });
            }
            // Добавляем метку текущего года (крупно, как 50-ки)
            if (currentYear % 10 !== 0) {
              marks.push({
                year: currentYear,
                position: ((currentYear - minYear) / totalYears) * 100,
                isMajor: true
              });
            }
            return marks;
          };

          const timeMarks = getTimeMarks();

          // Эпохи русской поэзии
          const epochs = [
            { name: 'Классицизм', start: 1730, end: 1800, color: '#6B8CAE', desc: 'Культ разума, строгие правила и оды для императриц.' },
            { name: 'Золотой век', start: 1800, end: 1840, color: '#C7A36B', desc: 'Рождение современного языка, романтизм и пушкинская лёгкость.' },
            { name: 'Межвековье', start: 1840, end: 1890, color: '#8B7BA0', desc: 'Поэзия в тени прозы, раскол между гражданской лирикой и чистым искусством.' },
            { name: 'Серебряный век', start: 1890, end: 1920, color: '#A0AEC0', desc: 'Взрыв форм, богема и мистика на краю исторической катастрофы.' },
            { name: 'Советская эпоха', start: 1920, end: 1955, color: '#9d4451', desc: 'Эпоха соцреализма: идеология, война и жёсткий цензурный контроль.' },
            { name: 'Бронзовый век', start: 1955, end: 1991, color: '#8B7355', desc: 'Эпоха «Оттепели», стадионной и подпольной поэзии (самиздат).' },
            { name: 'Современность', start: 1991, end: currentYear, color: '#4a9c5d', desc: 'Полная свобода, тексты в смартфонах и поиск новой искренности.' },
          ];

          return (
            <div className="gantt-timeline">
              {/* Легенда эпох */}
              <div className="epochs-legend">
                {epochs.map(epoch => (
                  <div key={epoch.name} className="epoch-item">
                    <span 
                      className="epoch-color" 
                      style={{ background: epoch.color }}
                    ></span>
                    <span className="epoch-name">{epoch.name}</span>
                    <div className="epoch-tooltip">
                      <div className="epoch-tooltip-years">{epoch.start} – {epoch.end >= new Date().getFullYear() ? 'наши дни' : epoch.end}</div>
                      <div className="epoch-tooltip-desc">{epoch.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="gantt-container" style={{ '--total-height': `${totalHeight}px`, '--column-width': `${columnWidth}px`, '--total-columns': totalColumns }}>
                {/* Ось времени слева */}
                <div className="gantt-axis">
                  <div className="gantt-axis-line"></div>
                  {timeMarks.map(mark => (
                    <div 
                      key={mark.year}
                      className={`gantt-axis-mark ${mark.isMajor ? 'major' : 'minor'}`}
                      style={{ top: `${mark.position}%` }}
                    >
                      <span className="gantt-axis-year">{mark.year}</span>
                      <div className="gantt-axis-tick"></div>
                    </div>
                  ))}
                </div>

                {/* Фоновые полосы эпох */}
                <div className="epochs-background">
                  {epochs.map(epoch => {
                    // Пропускаем эпохи вне диапазона (включая те, что заканчиваются ровно на minYear)
                    if (epoch.end <= minYear || epoch.start > maxYear) return null;
                    
                    const startPos = Math.max(0, ((epoch.start - minYear) / totalYears) * 100);
                    const endPos = Math.min(100, ((epoch.end - minYear) / totalYears) * 100);
                    const height = endPos - startPos;
                    
                    return (
                      <React.Fragment key={epoch.name}>
                        {/* Линия начала эпохи — цветная, еле заметная */}
                        <div
                          className="epoch-divider"
                          style={{ 
                            top: `${startPos}%`,
                            background: epoch.color,
                          }}
                        />
                        {/* Фоновая полоса */}
                        <div
                          className="epoch-band"
                          style={{
                            top: `${startPos}%`,
                            height: `${height}%`,
                            background: epoch.color,
                          }}
                        />
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Цветная линия эпох справа */}
                <div className="epochs-line">
                  {epochs.map(epoch => {
                    if (epoch.end <= minYear || epoch.start > maxYear) return null;
                    
                    const startPos = Math.max(0, ((epoch.start - minYear) / totalYears) * 100);
                    const endPos = Math.min(100, ((epoch.end - minYear) / totalYears) * 100);
                    const height = endPos - startPos;
                    
                    return (
                      <div
                        key={epoch.name}
                        className="epoch-line-segment"
                        style={{
                          top: `${startPos}%`,
                          height: `${height}%`,
                          background: epoch.color,
                        }}
                      />
                    );
                  })}
                </div>

                {/* Названия эпох справа */}
                <div className="epochs-labels">
                  {epochs.map(epoch => {
                    // Пропускаем эпохи вне диапазона
                    if (epoch.end <= minYear || epoch.start > maxYear) return null;
                    
                    const startPos = Math.max(0, ((epoch.start - minYear) / totalYears) * 100);
                    const endPos = Math.min(100, ((epoch.end - minYear) / totalYears) * 100);
                    const centerPos = (startPos + endPos) / 2;
                    
                    return (
                      <div
                        key={epoch.name}
                        className="epoch-label"
                        style={{
                          top: `${centerPos}%`,
                          color: epoch.color,
                        }}
                      >
                        {epoch.name}
                      </div>
                    );
                  })}
                </div>

                {/* Горизонтальные линии сетки */}
                <div className="gantt-grid">
                  {timeMarks.map(mark => (
                    <div 
                      key={mark.year}
                      className={`gantt-grid-line ${mark.isMajor ? 'major' : 'minor'}`}
                      style={{ top: `${mark.position}%` }}
                    />
                  ))}
                </div>

                {/* Область с поэтами */}
                <div className="gantt-poets-area">
                  {poetsWithColumns.map((poet, index) => {
                    const birthPosition = ((poet.birthYear - minYear) / totalYears) * 100;
                    const endYear = poet.deathYear || new Date().getFullYear();
                    const deathPosition = ((endYear - minYear) / totalYears) * 100;
                    const lifeHeight = deathPosition - birthPosition;
                    // Позиция колонки — сразу после оси, близко друг к другу
                    const leftOffset = 70 + (poet.column * columnWidth);

                    const isLongest = poet.id === longestLivedId;
                    const isShortest = poet.id === shortestLivedId;

                    return (
                      <div 
                        key={poet.id}
                        className={`gantt-poet ${isLongest ? 'longest-lived' : ''} ${isShortest ? 'shortest-lived' : ''}`}
                        style={{ 
                          left: `${leftOffset}px`,
                          top: `${birthPosition}%`,
                          height: `${lifeHeight}%`,
                          '--animation-delay': `${index * 0.08}s`
                        }}
                        onClick={() => navigate(`/poet/${poet.id}`)}
                      >
                        {/* Аватар (точка рождения) */}
                        <div className={`gantt-avatar ${poet.isAlive ? 'alive' : ''}`}>
                          {poet.imageUrl ? (
                            <img 
                              src={poet.imageUrl} 
                              alt={poet.name}
                              style={{ 
                                objectPosition: `center ${poet.imagePositionY !== undefined ? poet.imagePositionY : 25}%`
                              }}
                            />
                          ) : (
                            <div className="gantt-avatar-placeholder">
                              {poet.name.charAt(0)}
                            </div>
                          )}
                        </div>

                        {/* Линия жизни */}
                        <div className={`gantt-lifeline ${poet.isAlive ? 'alive' : ''}`}>
                          <div className="gantt-lifeline-inner"></div>
                        </div>

                        {/* Точка смерти */}
                        {!poet.isAlive && (
                          <div className="gantt-death-point"></div>
                        )}

                        {/* Tooltip при наведении — формат "А. Фамилия" */}
                        <div className="gantt-tooltip">
                          <div className="gantt-tooltip-name">
                            {poet.name.split(' ').length === 1 
                              ? poet.name 
                              : `${poet.name.split(' ')[0].charAt(0)}. ${poet.name.split(' ').slice(1).join(' ')}`}
                          </div>
                          <div className="gantt-tooltip-dates">
                            {poet.birthYear} — {poet.deathYear || 'н.в.'}
                          </div>
                          <div className="gantt-tooltip-lifespan">
                            {poet.lifespan} {(() => {
                              const n = poet.lifespan;
                              const lastTwo = n % 100;
                              const lastOne = n % 10;
                              if (lastTwo >= 11 && lastTwo <= 19) return 'лет';
                              if (lastOne === 1) return 'год';
                              if (lastOne >= 2 && lastOne <= 4) return 'года';
                              return 'лет';
                            })()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
            </div>
          );
        })()
      ) : sortedPoets.length === 0 ? (
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
                      <img 
                        src={poet.imageUrl} 
                        alt={poet.name}
                        style={{ 
                          objectPosition: `center ${poet.imagePositionY !== undefined ? poet.imagePositionY : 25}%`
                        }}
                      />
                      {hasRating && sortBy === 'rating' && (
                        <div className="poet-card-rating always-visible">
                          {averageRating.toFixed(1)}
                        </div>
                      )}
                      <div className="poet-card-overlay">
                        <h3 className="poet-card-name">
                          {(() => {
                            const nameParts = poet.name.split(' ');
                            if (nameParts.length === 1) {
                              return <span className="last-name">{nameParts[0]}</span>;
                            }
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
                      </div>
                    </>
                  ) : (
                    <div className="poet-card-placeholder">
                      <img src="/images/poet.png" alt="Поэт" className="placeholder-icon" />
                      <h3 className="poet-card-name">{poet.name}</h3>
                    </div>
                  )}
                </div>
                {/* <button
                  onClick={(e) => {
                    e.stopPropagation(); // Предотвращаем переход на страницу поэта
                    handleDeleteClick(poet.id, poet.name);
                  }}
                  className="btn-delete-card"
                  title="Удалить поэта"
                ></button> */}
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

