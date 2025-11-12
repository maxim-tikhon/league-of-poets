import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePoets } from '../context/PoetsContext';
import './PoetDetailPage.css';

const PoetDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { poets, ratings, calculateScore, getOverallRankings, isLoading } = usePoets();
  
  const poet = poets.find(p => p.id === id);
  
  // Расчет общей средней оценки (в 5-балльной шкале)
  const getOverallAverage = () => {
    if (!poet) return 0;
    const maximScore = calculateScore('maxim', poet.id);
    const olegScore = calculateScore('oleg', poet.id);
    const averageScore = (maximScore + olegScore) / 2;
    return (averageScore / 100) * 5; // Конвертация в 5-балльную систему
  };

  // const getMaximOverall = () => {
  //   if (!poet) return 0;
  //   const maximScore = calculateScore('maxim', poet.id);
  //   return (maximScore / 100) * 5;
  // };

  // const getOlegOverall = () => {
  //   if (!poet) return 0;
  //   const olegScore = calculateScore('oleg', poet.id);
  //   return (olegScore / 100) * 5;
  // };

  // Получить место поэта в общем рейтинге
  const getPoetRank = () => {
    if (!poet) return null;
    const rankings = getOverallRankings();
    const index = rankings.findIndex(r => r.poet.id === poet.id);
    return index >= 0 ? index + 1 : null;
  };
  
  if (isLoading) {
    return (
      <div className="poet-detail-page fade-in">
        <div className="loading">Загрузка...</div>
      </div>
    );
  }
  
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
      nationality: { label: 'Национальность и происхождение', value: '' },
      birthPlace: { label: 'Место рождения', value: '' },
      deathPlace: { label: 'Место смерти', value: '' },
      causeOfDeath: { label: 'Причина смерти', value: '' }
    };
    
    // Регулярные выражения для извлечения полей
    const patterns = {
      fullName: /Полное имя:\s*(.+?)(?=(?:Годы жизни|Национальность|Место рождения|$))/is,
      lifeYears: /Годы жизни:\s*(.+?)(?=(?:Национальность|Место рождения|Место смерти|$))/is,
      nationality: /Национальность и происхождение:\s*(.+?)(?=(?:Место рождения|Место смерти|Причина|$))/is,
      birthPlace: /Место рождения:\s*(.+?)(?=(?:Место смерти|Причина|$))/is,
      deathPlace: /Место смерти:\s*(.+?)(?=(?:Причина|$))/is,
      causeOfDeath: /Причина смерти:\s*(.+?)$/is
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
      {/* <button onClick={() => navigate('/')} className="back-btn">
        ← Вернуться к списку
      </button>
       */}
      <div className="poet-detail-container">
        {/* Первая строка: Имя + Оценки */}
        <div className="poet-header">
          <h1 className="poet-detail-name">{poet.name}</h1>
          
          {/* Общая оценка с tooltip */}
          <div className="rating-overall-container">
            <div 
              className="rating-overall-card" 
              onClick={() => navigate('/overall-ranking', { state: { poetId: poet.id } })}
            >
              <div className="rating-overall-value">{getOverallAverage().toFixed(2)}</div>
              
              {/* Tooltip с детальными оценками */}
              <div className="rating-tooltip">
                {/* Место в рейтинге */}
                {getPoetRank() && (
                  <div className="rating-tooltip-item">
                    <span className="rating-tooltip-label">Место:</span>
                    <span className="rating-tooltip-value">#{getPoetRank()}</span>
                  </div>
                )}

                {/* Индивидуальные оценки */}
                {/* <div className="rating-tooltip-item">
                  <span className="rating-tooltip-label">Mаксим:</span>
                  <span className="rating-tooltip-value">{getMaximOverall().toFixed(2)}</span>
                </div>
                <div className="rating-tooltip-item">
                  <span className="rating-tooltip-label">Oлег:</span>
                  <span className="rating-tooltip-value">{getOlegOverall().toFixed(2)}</span>
                </div> */}
              </div>
            </div>
          </div>
        </div>

        {/* Вторая строка: Фото + Досье */}
        <div className="poet-content">
          {/* Левая колонка - фото */}
          {poet.imageUrl && (
            <div className="poet-portrait">
              <img src={poet.imageUrl} alt={poet.name} />
            </div>
          )}
          
          {/* Правая колонка - досье */}
          <div className="poet-info-column">
            {/* Досье */}
            {bioData && bioData.length > 0 ? (
              <div className="poet-bio-section">
                <div className="bio-grid">
                  {bioData.map((item, index) => (
                    <div key={index} className="bio-item">
                      <span className="bio-field">{item.label}:</span>{' '}
                      <span className="bio-value">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-bio">
                <p>Досье пока не добавлено</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PoetDetailPage;

