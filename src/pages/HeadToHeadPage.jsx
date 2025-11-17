import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePoets, CATEGORIES } from '../context/PoetsContext';
import './HeadToHeadPage.css';

const HeadToHeadPage = () => {
  const { poets, ratings, calculateScore } = usePoets();
  const navigate = useNavigate();

  // Подсчет статистики
  const statistics = useMemo(() => {
    // Поэты, оцененные обоими
    const poetsRatedByBoth = poets.filter(poet => {
      const maximScore = calculateScore('maxim', poet.id);
      const olegScore = calculateScore('oleg', poet.id);
      return maximScore > 0 && olegScore > 0;
    });

    if (poetsRatedByBoth.length === 0) {
      return null;
    }

    // Подсчет средних баллов
    let maximTotal = 0;
    let olegTotal = 0;
    let totalDifference = 0;
    let agreementCount = 0; // Разница <= 0.5 балла
    let disagreementCount = 0; // Разница >= 2.0 балла

    const comparisons = poetsRatedByBoth.map(poet => {
      const maximScore = calculateScore('maxim', poet.id);
      const olegScore = calculateScore('oleg', poet.id);
      const difference = maximScore - olegScore;
      const absDifference = Math.abs(difference);

      maximTotal += maximScore;
      olegTotal += olegScore;
      totalDifference += absDifference;

      if (absDifference <= 10) agreementCount++; // 10 баллов = 0.5 в 5-балльной
      if (absDifference >= 40) disagreementCount++; // 40 баллов = 2.0 в 5-балльной

      // Разногласия по категориям
      const categoryDifferences = {};
      Object.keys(CATEGORIES).forEach(key => {
        const maximRating = ratings.maxim?.[poet.id]?.[key] || 0;
        const olegRating = ratings.oleg?.[poet.id]?.[key] || 0;
        categoryDifferences[key] = maximRating - olegRating;
      });

      return {
        poet,
        maximScore,
        olegScore,
        difference,
        absDifference,
        categoryDifferences
      };
    });

    const count = poetsRatedByBoth.length;
    const maximAverage = maximTotal / count;
    const olegAverage = olegTotal / count;
    const avgDifference = totalDifference / count;
    
    // Вкусовая совместимость (100% - процент расхождения)
    const compatibility = Math.max(0, 100 - (avgDifference / 100 * 100));

    // Средние по категориям
    const categoryAverages = {};
    Object.keys(CATEGORIES).forEach(key => {
      let maximCatTotal = 0;
      let olegCatTotal = 0;
      let catCount = 0;

      poetsRatedByBoth.forEach(poet => {
        const maximRating = ratings.maxim?.[poet.id]?.[key] || 0;
        const olegRating = ratings.oleg?.[poet.id]?.[key] || 0;
        if (maximRating > 0 && olegRating > 0) {
          maximCatTotal += maximRating;
          olegCatTotal += olegRating;
          catCount++;
        }
      });

      if (catCount > 0) {
        categoryAverages[key] = {
          maxim: maximCatTotal / catCount,
          oleg: olegCatTotal / catCount,
          difference: Math.abs((maximCatTotal / catCount) - (olegCatTotal / catCount))
        };
      }
    });

    // Сортировка по разногласиям
    const sortedByDisagreement = [...comparisons].sort((a, b) => b.absDifference - a.absDifference);
    
    // Сортировка по согласию
    const sortedByAgreement = [...comparisons].sort((a, b) => a.absDifference - b.absDifference);

    return {
      count,
      maximAverage,
      olegAverage,
      avgDifference,
      compatibility,
      agreementCount,
      disagreementCount,
      comparisons,
      sortedByDisagreement,
      sortedByAgreement,
      categoryAverages,
      stricterJudge: maximAverage < olegAverage ? 'maxim' : 'oleg'
    };
  }, [poets, ratings, calculateScore]);

  if (!statistics) {
    return (
      <div className="head-to-head-page fade-in">
        <div className="empty-state">
          <img src="/images/poet2.png" alt="Нет данных" className="empty-icon" />
          <p>Недостаточно данных для сравнения</p>
          <p className="empty-hint">Оба пользователя должны оценить хотя бы одного поэта</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h2h-page fade-in">
      {/* Секция 1: Общая статистика */}
      <div className="h2h-stats-cards">
        <div className="h2h-stat-card">
          <div className="h2h-stat-label">Совместимость вкусов</div>
          <div className="h2h-stat-value">{statistics.compatibility.toFixed(0)}%</div>
          <div className="h2h-stat-hint">{statistics.count} поэтов оценены обоими</div>
        </div>

        <div className="h2h-stat-card">
          <div className="h2h-stat-label">Строже судья</div>
          <div className="h2h-stat-value">
            {statistics.stricterJudge === 'maxim' ? 'Максим' : 'Олег'}
          </div>
          <div className="h2h-stat-hint">
            {(statistics.maximAverage / 20).toFixed(2)} vs {(statistics.olegAverage / 20).toFixed(2)}
          </div>
        </div>

        <div className="h2h-stat-card">
          <div className="h2h-stat-label">Разногласия</div>
          <div className="h2h-stat-value">{statistics.disagreementCount}</div>
          <div className="h2h-stat-hint">Поэтов с разницей ≥2.0 балла</div>
        </div>
      </div>

      {/* Секция 2: Категориальный анализ */}
      <div className="h2h-section-card">
        <h2 className="h2h-section-title">Сравнение по категориям</h2>
        <div className="h2h-category-comparison">
          {Object.entries(CATEGORIES).map(([key, cat]) => {
            const catAvg = statistics.categoryAverages[key];
            if (!catAvg) return null;

            const maximPercent = (catAvg.maxim / 5) * 100;
            const olegPercent = (catAvg.oleg / 5) * 100;

            return (
              <div key={key} className="h2h-category-bar">
                <div className="h2h-category-name">{cat.name}</div>
                <div className="h2h-bar-container">
                  <div className="h2h-bar maxim">
                    <div className="h2h-bar-fill" style={{ width: `${maximPercent}%` }}>
                      <span className="h2h-bar-value">{catAvg.maxim.toFixed(2)}</span>
                    </div>
                    <span className="h2h-bar-label">М</span>
                  </div>
                  <div className="h2h-bar oleg">
                    <div className="h2h-bar-fill" style={{ width: `${olegPercent}%` }}>
                      <span className="h2h-bar-value">{catAvg.oleg.toFixed(2)}</span>
                    </div>
                    <span className="h2h-bar-label">О</span>
                  </div>
                </div>
                <div className="h2h-category-diff">Δ {catAvg.difference.toFixed(2)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Секция 3: Согласие/Несогласие */}
      <div className="h2h-agreement-section">
        <div className="h2h-section-card half-width">
          <h2 className="h2h-section-title">Полное согласие</h2>
          <div className="h2h-agreement-list">
            {statistics.sortedByAgreement.slice(0, 10).map(comp => (
              <div 
                key={comp.poet.id} 
                className="h2h-agreement-item"
                onClick={() => navigate(`/poet/${comp.poet.id}`)}
              >
                <span className="h2h-poet-name">{comp.poet.name}</span>
                <span className="h2h-scores">
                  {(comp.maximScore / 20).toFixed(1)} / {(comp.olegScore / 20).toFixed(1)}
                </span>
                <span className="h2h-diff success">({(comp.absDifference / 20).toFixed(1)})</span>
              </div>
            ))}
          </div>
        </div>

        <div className="h2h-section-card half-width">
          <h2 className="h2h-section-title">Разногласия</h2>
          <div className="h2h-agreement-list">
            {statistics.sortedByDisagreement.slice(0, 10).map(comp => (
              <div 
                key={comp.poet.id} 
                className="h2h-agreement-item"
                onClick={() => navigate(`/poet/${comp.poet.id}`)}
              >
                <span className="h2h-poet-name">{comp.poet.name}</span>
                <span className="h2h-scores">
                  {(comp.maximScore / 20).toFixed(1)} / {(comp.olegScore / 20).toFixed(1)}
                </span>
                <span className="h2h-diff error">({(comp.absDifference / 20).toFixed(1)})</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeadToHeadPage;

