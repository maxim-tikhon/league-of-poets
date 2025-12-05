import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePoets } from '../context/PoetsContext';
import './TimelinePage.css';

const TimelinePage = () => {
  const { poets, isLoading } = usePoets();
  const navigate = useNavigate();
  const [selectedCentury, setSelectedCentury] = useState('all');

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
    
    return { birthYear, deathYear };
  };

  // Подготовка данных поэтов с годами жизни
  const poetsWithYears = useMemo(() => {
    return poets
      .map(poet => {
        const years = extractYears(poet.bio);
        if (!years) return null;
        
        return {
          ...poet,
          birthYear: years.birthYear,
          deathYear: years.deathYear,
          century: Math.floor(years.birthYear / 100) + 1
        };
      })
      .filter(poet => poet !== null)
      .sort((a, b) => a.birthYear - b.birthYear);
  }, [poets]);

  // Определение временного диапазона
  const timeRange = useMemo(() => {
    if (poetsWithYears.length === 0) return { min: 1700, max: 2000 };
    
    const birthYears = poetsWithYears.map(p => p.birthYear);
    const deathYears = poetsWithYears.map(p => p.deathYear).filter(y => y !== null);
    
    const minYear = Math.min(...birthYears);
    const maxYear = Math.max(...deathYears, ...birthYears);
    
    // Округляем до десятилетий
    return {
      min: Math.floor(minYear / 10) * 10,
      max: Math.ceil(maxYear / 10) * 10
    };
  }, [poetsWithYears]);

  // Группировка по векам
  const centuries = useMemo(() => {
    const centuriesSet = new Set(poetsWithYears.map(p => p.century));
    return Array.from(centuriesSet).sort();
  }, [poetsWithYears]);

  // Фильтрация по выбранному веку
  const filteredPoets = useMemo(() => {
    if (selectedCentury === 'all') return poetsWithYears;
    return poetsWithYears.filter(p => p.century === selectedCentury);
  }, [poetsWithYears, selectedCentury]);

  // Вычисление позиции на линии
  const getPosition = (year) => {
    const totalRange = timeRange.max - timeRange.min;
    return ((year - timeRange.min) / totalRange) * 100;
  };

  // Названия веков на русском
  const getCenturyName = (century) => {
    const names = {
      16: 'XVI',
      17: 'XVII',
      18: 'XVIII',
      19: 'XIX',
      20: 'XX',
      21: 'XXI'
    };
    return `${names[century] || century} век`;
  };

  // Пока загружается - показываем пустой контейнер
  if (isLoading) {
    return <div className="timeline-page"></div>;
  }

  if (poetsWithYears.length === 0) {
    return (
      <div className="timeline-page">
        <div className="empty-state">
          <img src="/images/poet2.png" alt="Нет данных" className="empty-icon" />
          <p>Нет поэтов с данными о годах жизни</p>
          <p className="empty-hint">Добавьте информацию о годах жизни в досье поэтов</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tl-page">
      {/* Статистика */}
      <div className="tl-stats">
        <div className="tl-stat-item">
          <span className="tl-stat-label">Всего поэтов</span>
          <span className="tl-stat-value">{poetsWithYears.length}</span>
        </div>
        <div className="tl-stat-item">
          <span className="tl-stat-label">Временной охват</span>
          <span className="tl-stat-value">{timeRange.max - timeRange.min} лет</span>
        </div>
        <div className="tl-stat-item">
          <span className="tl-stat-label">Самый ранний</span>
          <span className="tl-stat-value">{timeRange.min}</span>
        </div>
        <div className="tl-stat-item">
          <span className="tl-stat-label">Самый поздний</span>
          <span className="tl-stat-value">{timeRange.max}</span>
        </div>
      </div>

      {/* Фильтр по векам */}
      <div className="tl-filters">
        <button
          className={`tl-filter-btn ${selectedCentury === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedCentury('all')}
        >
          Все эпохи
        </button>
        {centuries.map(century => (
          <button
            key={century}
            className={`tl-filter-btn ${selectedCentury === century ? 'active' : ''}`}
            onClick={() => setSelectedCentury(century)}
          >
            {getCenturyName(century)}
          </button>
        ))}
      </div>

        {/* Временная линия */}
        <div className="tl-container">
          <div className="tl-header">
            <h2 className="tl-title">Временная линия поэтов</h2>
          </div>

          {/* Шкала времени */}
          <div className="tl-scale">
            {Array.from({ length: Math.floor((timeRange.max - timeRange.min) / 10) + 1 }, (_, i) => {
              const year = timeRange.min + i * 10;
              if (year > timeRange.max) return null;
              const isMajor = year % 25 === 0;
              return (
                <div key={year} className={`tl-scale-mark ${isMajor ? 'major' : 'minor'}`} style={{ left: `${getPosition(year)}%` }}>
                  {isMajor && <span className="tl-scale-year">{year}</span>}
                </div>
              );
            })}
          </div>

          {/* Линии жизни поэтов */}
          <div className="tl-poets" style={{ minHeight: `${filteredPoets.length * 50 + 100}px` }}>
            {filteredPoets.map((poet, index) => {
              const birthPos = getPosition(poet.birthYear);
              const deathPos = poet.deathYear ? getPosition(poet.deathYear) : null;
              const lifespan = poet.deathYear ? poet.deathYear - poet.birthYear : null;

              return (
                <div
                  key={poet.id}
                  className="tl-poet"
                  style={{ 
                    top: `${index * 50}px`,
                    zIndex: 100 - index
                  }}
                >
                  {/* Линия жизни */}
                  {deathPos && (
                    <div
                      className="tl-life-line"
                      style={{
                        left: `${birthPos}%`,
                        width: `${deathPos - birthPos}%`
                      }}
                    />
                  )}

                  {/* Точка рождения с фото */}
                  <div
                    className="tl-point birth"
                    style={{ left: `${birthPos}%` }}
                    onClick={() => navigate(`/poet/${poet.id}`)}
                  >
                    {poet.imageUrl && (
                      <img 
                        src={poet.imageUrl} 
                        alt={poet.name} 
                        className="tl-avatar"
                        style={{ 
                          objectPosition: `center ${poet.imagePositionY !== undefined ? poet.imagePositionY : 25}%`
                        }}
                      />
                    )}
                    <div className="tl-tooltip">
                      <div className="tl-tooltip-name">{poet.name}</div>
                      <div className="tl-tooltip-years">
                        {poet.birthYear}—{poet.deathYear || '?'}
                        {lifespan && ` (${lifespan} лет)`}
                      </div>
                    </div>
                  </div>

                  {/* Точка смерти */}
                  {deathPos && (
                    <div
                      className="tl-point death"
                      style={{ left: `${deathPos}%` }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

      {/* Группировка по векам - карточки */}
      <div className="tl-centuries">
        <h2 className="tl-centuries-title">Поэты по векам</h2>
        <div className="tl-centuries-grid">
          {centuries.map(century => {
            const centuryPoets = poetsWithYears.filter(p => p.century === century);
            return (
              <div key={century} className="tl-century-card">
                <h3 className="tl-century-title">{getCenturyName(century)}</h3>
                <div className="tl-century-count">{centuryPoets.length} поэтов</div>
                <div className="tl-century-poets">
                  {centuryPoets.slice(0, 5).map(poet => (
                    <div
                      key={poet.id}
                      className="tl-century-poet"
                      onClick={() => navigate(`/poet/${poet.id}`)}
                    >
                      {poet.imageUrl && (
                        <img 
                          src={poet.imageUrl} 
                          alt={poet.name} 
                          className="tl-century-avatar"
                          style={{ 
                            objectPosition: `center ${poet.imagePositionY !== undefined ? poet.imagePositionY : 25}%`
                          }}
                        />
                      )}
                      <div className="tl-century-info">
                        <span className="tl-century-name">{poet.name}</span>
                        <span className="tl-century-years">
                          {poet.birthYear}—{poet.deathYear || '?'}
                        </span>
                      </div>
                    </div>
                  ))}
                  {centuryPoets.length > 5 && (
                    <div className="tl-century-more">
                      +{centuryPoets.length - 5} еще
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TimelinePage;

