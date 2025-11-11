import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePoets } from '../context/PoetsContext';
import './PoetDetailPage.css';

const PoetDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { poets, ratings, calculateScore, isLoading } = usePoets();
  
  const poet = poets.find(p => p.id === id);
  
  // Категории для оценок
  const CATEGORIES = {
    creativity: { name: 'Творчество', short: 'Т', coefficient: 8 },
    influence: { name: 'Влияние', short: 'В', coefficient: 6 },
    drama: { name: 'Драма', short: 'Д', coefficient: 4 },
    beauty: { name: 'Красота', short: 'К', coefficient: 2 }
  };
  
  // Расчет средних оценок по категориям (в 5-балльной шкале)
  const getCategoryAverage = (categoryKey) => {
    if (!poet) return 0;
    const maximRating = ratings.maxim[poet.id]?.[categoryKey] || 0;
    const olegRating = ratings.oleg[poet.id]?.[categoryKey] || 0;
    return (maximRating + olegRating) / 2;
  };
  
  // Расчет общей средней оценки (в 5-балльной шкале)
  const getOverallAverage = () => {
    if (!poet) return 0;
    const maximScore = calculateScore('maxim', poet.id);
    const olegScore = calculateScore('oleg', poet.id);
    const averageScore = (maximScore + olegScore) / 2;
    return (averageScore / 100) * 5; // Конвертация в 5-балльную систему
  };
  
  // Получить стили в зависимости от оценки
  const getRatingStyles = (rating) => {
    if (rating >= 3.5) {
      return {
        backgroundColor: 'rgba(144, 238, 144, 0.2)',
        borderColor: '#7ac27a',
        color: '#2d7a2d'
      };
    } else if (rating >= 2) {
      return {
        backgroundColor: 'rgba(255, 235, 150, 0.2)',
        borderColor: '#e6c84d',
        color: '#8b7500'
      };
    } else {
      return {
        backgroundColor: 'rgba(255, 182, 193, 0.2)',
        borderColor: '#ff6b8a',
        color: '#a83247'
      };
    }
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
          <button onClick={() => navigate('/poets')} className="btn btn-primary">
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
        <h1 className="poet-detail-name">{poet.name}</h1>
        
        <div className="poet-content">
          {/* Левая колонка - фото */}
          {poet.imageUrl && (
            <div className="poet-portrait">
              <img src={poet.imageUrl} alt={poet.name} />
            </div>
          )}
          
          {/* Правая колонка - оценки и досье */}
          <div className="poet-info-column">
            {/* Кружки с оценками */}
            <div className="ratings-circles">
              {Object.entries(CATEGORIES).map(([key, category]) => {
                const rating = getCategoryAverage(key);
                const styles = getRatingStyles(rating);
                return (
                  <div 
                    key={key} 
                    className="rating-circle" 
                    style={{
                      backgroundColor: styles.backgroundColor,
                      borderColor: styles.borderColor,
                      color: styles.color
                    }}
                    title={`${category.name}: ${rating.toFixed(1)}`}
                  >
                    <div className="circle-background-letter" style={{ color: styles.color }}>{category.short}</div>
                    <div className="circle-rating" style={{ color: styles.color }}>{rating.toFixed(1)}</div>
                  </div>
                );
              })}
              
              {/* Большой кружок с общей оценкой */}
              {(() => {
                const overallRating = getOverallAverage();
                const styles = getRatingStyles(overallRating);
                return (
                  <div 
                    className="rating-circle overall" 
                    style={{
                      backgroundColor: styles.backgroundColor,
                      borderColor: styles.borderColor,
                      color: styles.color
                    }}
                    title={`Общая оценка: ${overallRating.toFixed(2)}`}
                  >
                    <div className="circle-rating-large" style={{ color: styles.color }}>
                      {overallRating.toFixed(2)}
                    </div>
                  </div>
                );
              })()}
            </div>
            
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
                <span className="empty-icon">📝</span>
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

