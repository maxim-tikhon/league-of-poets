// Доступные темы для сайта
export const themes = {
  classic: {
    name: 'Классическая',
    colors: {
      '--parchment': '#F9F7F4',
      '--ink': '#3d3328',
      '--ink-light': '#4a4035',
      '--sepia': '#8b7355',
      '--gold': '#C7A36B',
      '--gold-dark': '#b8962f',
      '--burgundy': '#9d4451',
      '--cream': '#FFFFFF',
      '--hover-light': '#F3EBD3',
      '--shadow': 'rgba(61, 51, 40, 0.08)',
      '--shadow-strong': 'rgba(61, 51, 40, 0.15)'
    }
  },
  letterboxd: {
    name: 'Letterboxd',
    colors: {
      '--parchment': '#14181c', // Темный фон с текстурой
      '--ink': '#FFFFFF', // Белый текст
      '--ink-light': '#B3B3B3', // Серый текст
      '--sepia': '#B3B3B3', // Для скроллбара
      '--gold': '#00ac1c', // Зеленый акцент
      '--gold-dark': '#009d1a', // Темно-зеленый для hover
      '--burgundy': '#00ac1c', // Зеленый для акцентов
      '--cream': '#1a1a1a', // Темно-серый для карточек
      '--hover-light': '#2a2a2a', // Чуть светлее для hover
      '--shadow': 'rgba(0, 0, 0, 0.7)',
      '--shadow-strong': 'rgba(0, 0, 0, 0.9)'
    }
  }
};

// Применить тему
export const applyTheme = (themeName) => {
  const theme = themes[themeName];
  if (!theme) return;

  const root = document.documentElement;
  Object.entries(theme.colors).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });

  // Добавляем data-атрибут для специфичных стилей
  document.body.setAttribute('data-theme', themeName);

  // Сохраняем выбранную тему
  localStorage.setItem('selectedTheme', themeName);
};

// Получить текущую тему
export const getCurrentTheme = () => {
  return localStorage.getItem('selectedTheme') || 'classic';
};

