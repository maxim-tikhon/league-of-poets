import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePoets, CATEGORIES } from '../context/PoetsContext';
import './HeadToHeadPage.css';

const HeadToHeadPage = () => {
  const { poets, ratings, calculateScore, likes } = usePoets();
  const navigate = useNavigate();

  // Расчет AI балла для поэта
  const calculateAIScore = (poet) => {
    if (!poet || !poet.aiRatings) return 0;
    const aiRatings = poet.aiRatings;
    const totalCoefficient = Object.values(CATEGORIES).reduce((sum, cat) => sum + cat.coefficient, 0);
    const weightedSum = 
      (aiRatings.creativity || 0) * CATEGORIES.creativity.coefficient +
      (aiRatings.influence || 0) * CATEGORIES.influence.coefficient +
      (aiRatings.drama || 0) * CATEGORIES.drama.coefficient +
      (aiRatings.beauty || 0) * CATEGORIES.beauty.coefficient;
    return totalCoefficient > 0 ? weightedSum / totalCoefficient : 0;
  };

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

    // AI совместимость
    let maximAIDiffTotal = 0;
    let olegAIDiffTotal = 0;
    let aiComparisonCount = 0;

    const comparisons = poetsRatedByBoth.map(poet => {
      const maximScore = calculateScore('maxim', poet.id);
      const olegScore = calculateScore('oleg', poet.id);
      const aiScore = calculateAIScore(poet);
      const difference = maximScore - olegScore;
      const absDifference = Math.abs(difference);
      
      // Общий балл (среднее Максима и Олега)
      const combinedScore = (maximScore + olegScore) / 2;
      const aiDifference = Math.abs(combinedScore - aiScore);

      maximTotal += maximScore;
      olegTotal += olegScore;
      totalDifference += absDifference;

      // AI сравнение
      if (aiScore > 0) {
        maximAIDiffTotal += Math.abs(maximScore - aiScore);
        olegAIDiffTotal += Math.abs(olegScore - aiScore);
        aiComparisonCount++;
      }

      if (absDifference <= 0.5) agreementCount++; // Разница <= 0.5 балла
      if (absDifference >= 0.5) disagreementCount++; // Разница >= 2.0 балла

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
        aiScore,
        combinedScore,
        aiDifference,
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
    // avgDifference теперь в 5-балльной системе, поэтому делим на 5
    const compatibility = Math.max(0, 100 - (avgDifference / 5 * 100));

    // AI совместимость
    const maximAICompatibility = aiComparisonCount > 0 
      ? Math.max(0, 100 - ((maximAIDiffTotal / aiComparisonCount) / 5 * 100))
      : null;
    const olegAICompatibility = aiComparisonCount > 0 
      ? Math.max(0, 100 - ((olegAIDiffTotal / aiComparisonCount) / 5 * 100))
      : null;

    // Средние по категориям
    const categoryAverages = {};
    Object.keys(CATEGORIES).forEach(key => {
      let maximCatTotal = 0;
      let olegCatTotal = 0;
      let aiCatTotal = 0;
      let catCount = 0;
      let aiCatCount = 0;

      poetsRatedByBoth.forEach(poet => {
        const maximRating = ratings.maxim?.[poet.id]?.[key] || 0;
        const olegRating = ratings.oleg?.[poet.id]?.[key] || 0;
        const aiRating = poet.aiRatings?.[key] || 0;
        if (maximRating > 0 && olegRating > 0) {
          maximCatTotal += maximRating;
          olegCatTotal += olegRating;
          catCount++;
          if (aiRating > 0) {
            aiCatTotal += aiRating;
            aiCatCount++;
          }
        }
      });

      if (catCount > 0) {
        const maximAvg = maximCatTotal / catCount;
        const olegAvg = olegCatTotal / catCount;
        const aiAvg = aiCatCount > 0 ? aiCatTotal / aiCatCount : 0;
        const diff = maximAvg - olegAvg;
        categoryAverages[key] = {
          maxim: maximAvg,
          oleg: olegAvg,
          ai: aiAvg,
          difference: Math.abs(diff),
          signedDiff: diff, // положительное = Максим выше, отрицательное = Олег выше
          winner: diff > 0.1 ? 'maxim' : (diff < -0.1 ? 'oleg' : 'tie')
        };
      }
    });

    // Группировка по строгости (кто ставит НИЖЕ - тот строже)
    // signedDiff = maximAvg - olegAvg
    // signedDiff < 0 → Максим ставит ниже → Максим строже
    // signedDiff > 0 → Олег ставит ниже → Олег строже
    const maximStricterIn = Object.entries(categoryAverages)
      .filter(([_, data]) => data.signedDiff < -0.1)
      .map(([key]) => CATEGORIES[key].name);

    const olegStricterIn = Object.entries(categoryAverages)
      .filter(([_, data]) => data.signedDiff > 0.1)
      .map(([key]) => CATEGORIES[key].name);

    // Единодушны (разница < 0.5)
    const unanimous = [...comparisons]
      .filter(c => c.absDifference < 0.5)
      .sort((a, b) => a.absDifference - b.absDifference);
    
    // Расходятся (разница ≥ 0.5)
    const divergent = [...comparisons]
      .filter(c => c.absDifference >= 0.5)
      .sort((a, b) => b.absDifference - a.absDifference);

    // ТОП-3 самых спорных поэтов между Максимом и Олегом
    const topControversialMO = [...comparisons]
      .sort((a, b) => b.absDifference - a.absDifference)
      .slice(0, 3);

    // ТОП-3 самых спорных поэтов между Максимом и AI
    const topControversialMaximAI = comparisons
      .filter(c => c.aiScore > 0)
      .map(c => ({
        ...c,
        maximAIDiff: Math.abs(c.maximScore - c.aiScore)
      }))
      .sort((a, b) => b.maximAIDiff - a.maximAIDiff)
      .slice(0, 3);

    // ТОП-3 самых спорных поэтов между Олегом и AI
    const topControversialOlegAI = comparisons
      .filter(c => c.aiScore > 0)
      .map(c => ({
        ...c,
        olegAIDiff: Math.abs(c.olegScore - c.aiScore)
      }))
      .sort((a, b) => b.olegAIDiff - a.olegAIDiff)
      .slice(0, 3);

    return {
      count,
      maximAverage,
      olegAverage,
      avgDifference,
      compatibility,
      maximAICompatibility,
      olegAICompatibility,
      agreementCount,
      disagreementCount,
      comparisons,
      unanimous,
      divergent,
      categoryAverages,
      maximStricterIn,
      olegStricterIn,
      topControversialMO,
      topControversialMaximAI,
      topControversialOlegAI,
      stricterJudge: maximAverage < olegAverage ? 'maxim' : 'oleg',
      // Общая статистика
      totalPoets: poets.length,
      ratedPoets: count,
      ratedByUser: {
        maxim: poets.filter(p => {
          const r = ratings.maxim?.[p.id];
          return r && (r.creativity > 0 || r.influence > 0 || r.drama > 0 || r.beauty > 0);
        }).length,
        oleg: poets.filter(p => {
          const r = ratings.oleg?.[p.id];
          return r && (r.creativity > 0 || r.influence > 0 || r.drama > 0 || r.beauty > 0);
        }).length
      },
      likedPoets: {
        maxim: likes?.maxim ? Object.keys(likes.maxim).filter(id => likes.maxim[id] && poets.some(p => String(p.id) === String(id))).length : 0,
        oleg: likes?.oleg ? Object.keys(likes.oleg).filter(id => likes.oleg[id] && poets.some(p => String(p.id) === String(id))).length : 0
      },
      poemStats: (() => {
        let totalPoems = 0;
        let viewedUnique = 0;
        let viewedMaxim = 0, viewedOleg = 0;
        let likedMaxim = 0, likedOleg = 0;
        let memorizedMaxim = 0, memorizedOleg = 0;
        
        poets.forEach(poet => {
          if (poet.poems) {
            const poemsList = Object.values(poet.poems);
            totalPoems += poemsList.length;
            poemsList.forEach(poem => {
              if (poem.viewed?.maxim || poem.viewed?.oleg) viewedUnique++;
              if (poem.viewed?.maxim) viewedMaxim++;
              if (poem.viewed?.oleg) viewedOleg++;
              if (poem.liked?.maxim) likedMaxim++;
              if (poem.liked?.oleg) likedOleg++;
              if (poem.memorized?.maxim) memorizedMaxim++;
              if (poem.memorized?.oleg) memorizedOleg++;
            });
          }
        });
        
        return { 
          totalPoems,
          viewedUnique,
          viewed: { total: viewedMaxim + viewedOleg, maxim: viewedMaxim, oleg: viewedOleg },
          liked: { total: likedMaxim + likedOleg, maxim: likedMaxim, oleg: likedOleg },
          memorized: { total: memorizedMaxim + memorizedOleg, maxim: memorizedMaxim, oleg: memorizedOleg }
        };
      })()
    };
  }, [poets, ratings, calculateScore, likes]);

  if (!statistics) {
    return (
      <div className="head-to-head-page">
        <div className="empty-state">
          <img src="/images/poet2.png" alt="Нет данных" className="empty-icon" />
          <p>Недостаточно данных для сравнения</p>
          <p className="empty-hint">Оба пользователя должны оценить хотя бы одного поэта</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h2h-page">
      {/* Секция 0: Статистика */}
      <div className="h2h-section">
        <h2 className="h2h-section-title">Статистика <span className="h2h-legend"><span className="legend-maxim">Максим</span> / <span className="legend-oleg">Олег</span></span></h2>
        <div className="h2h-overview-combined">
          {/* Блок ПОЭТЫ */}
          <div className="h2h-combined-card">
            <div className="h2h-stat-label">Поэты</div>
            <div className="h2h-combined-content no-dividers">
              <div className="h2h-combined-section">
                <div className="h2h-stat-value">{statistics.totalPoets}</div>
                <div className="h2h-stat-hint">всего</div>
              </div>
              <div className="h2h-combined-section">
                <div className="h2h-combined-duo">
                  <div className="h2h-stat-duo-item maxim">
                    <div className="h2h-stat-value">{statistics.ratedByUser.maxim}</div>
                  </div>
                  <span className="h2h-duo-separator">/</span>
                  <div className="h2h-stat-duo-item oleg">
                    <div className="h2h-stat-value">{statistics.ratedByUser.oleg}</div>
                  </div>
                </div>
                <div className="h2h-stat-hint">оценено</div>
              </div>
              <div className="h2h-combined-section">
                <div className="h2h-combined-duo">
                  <div className="h2h-stat-duo-item maxim">
                    <div className="h2h-stat-value">{statistics.likedPoets.maxim}</div>
                  </div>
                  <span className="h2h-duo-separator">/</span>
                  <div className="h2h-stat-duo-item oleg">
                    <div className="h2h-stat-value">{statistics.likedPoets.oleg}</div>
                  </div>
                </div>
                <div className="h2h-stat-hint">любимые</div>
              </div>
            </div>
          </div>

          {/* Блок СТИХИ */}
          <div className="h2h-combined-card">
            <div className="h2h-stat-label">Стихи</div>
            <div className="h2h-combined-content no-dividers">
              <div className="h2h-combined-section">
                <div className="h2h-stat-value">{statistics.poemStats.totalPoems}</div>
                <div className="h2h-stat-hint">всего</div>
              </div>
              <div className="h2h-combined-section">
                <div className="h2h-combined-duo">
                  <div className="h2h-stat-duo-item maxim">
                    <div className="h2h-stat-value">{statistics.poemStats.viewed.maxim}</div>
                  </div>
                  <span className="h2h-duo-separator">/</span>
                  <div className="h2h-stat-duo-item oleg">
                    <div className="h2h-stat-value">{statistics.poemStats.viewed.oleg}</div>
                  </div>
                </div>
                <div className="h2h-stat-hint">прочитано</div>
              </div>
              <div className="h2h-combined-section">
                <div className="h2h-combined-duo">
                  <div className="h2h-stat-duo-item maxim">
                    <div className="h2h-stat-value">{statistics.poemStats.liked.maxim}</div>
                  </div>
                  <span className="h2h-duo-separator">/</span>
                  <div className="h2h-stat-duo-item oleg">
                    <div className="h2h-stat-value">{statistics.poemStats.liked.oleg}</div>
                  </div>
                </div>
                <div className="h2h-stat-hint">любимые</div>
              </div>
              <div className="h2h-combined-section">
                <div className="h2h-combined-duo">
                  <div className="h2h-stat-duo-item maxim">
                    <div className="h2h-stat-value">{statistics.poemStats.memorized.maxim}</div>
                  </div>
                  <span className="h2h-duo-separator">/</span>
                  <div className="h2h-stat-duo-item oleg">
                    <div className="h2h-stat-value">{statistics.poemStats.memorized.oleg}</div>
                  </div>
                </div>
                <div className="h2h-stat-hint">выучено</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Секция 1: Категории и оценки */}
      <div className="h2h-section">
        <h2 className="h2h-section-title">Категории и оценки</h2>
        
        {/* Карточки категорий с графиками */}
        <div className="h2h-stats-cards category-cards">
          {['creativity', 'influence', 'drama', 'beauty'].map(key => {
            const cat = CATEGORIES[key];
            const catAvg = statistics.categoryAverages[key];
            if (!catAvg) return null;
            
            // signedDiff < 0 = Максим строже, signedDiff > 0 = Олег строже
            const stricter = catAvg.signedDiff < -0.1 ? 'Максим' : 
                            catAvg.signedDiff > 0.1 ? 'Олег' : null;
            const isMaxim = stricter === 'Максим';
            const isOleg = stricter === 'Олег';
            
            const maximPercent = (catAvg.maxim / 5) * 100;
            const olegPercent = (catAvg.oleg / 5) * 100;
            
            return (
              <div key={key} className="h2h-stat-card with-bars">
                <div className="h2h-stat-label">{cat.name}</div>
                <div className={`h2h-stat-value ${isMaxim ? 'maxim-value' : ''} ${isOleg ? 'oleg-value' : ''}`}>
                  {stricter || '—'}
                </div>
                <div className="h2h-stat-hint">строже</div>
                <div className="h2h-bars-separator"></div>
                <div className="h2h-mini-bars">
                  <div className="h2h-mini-bar maxim">
                    <span className="h2h-mini-label">М</span>
                    <div className="h2h-mini-track">
                      <div className="h2h-mini-fill" style={{ width: `${maximPercent}%` }}></div>
                    </div>
                    <span className="h2h-mini-value">{catAvg.maxim.toFixed(1)}</span>
                  </div>
                  <div className="h2h-mini-bar oleg">
                    <span className="h2h-mini-label">О</span>
                    <div className="h2h-mini-track">
                      <div className="h2h-mini-fill" style={{ width: `${olegPercent}%` }}></div>
                    </div>
                    <span className="h2h-mini-value">{catAvg.oleg.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Секция 2: Совместимость */}
      <div className="h2h-section">
        <h2 className="h2h-section-title">Совместимость</h2>
        <div className="h2h-stats-cards three-cols">
          <div className="h2h-stat-card">
            <div className="h2h-stat-label">Максим и Олег</div>
            <div className="h2h-stat-value">{statistics.compatibility.toFixed(0)}%</div>
            {statistics.topControversialMO.length > 0 && (
              <div className="h2h-controversial-inline">
                {statistics.topControversialMO.map((item, idx) => (
                  <div key={idx} className="h2h-controversial-row">
                    <span className="h2h-controversial-name">
                      {item.poet.name.split(' ').length === 1 
                        ? item.poet.name 
                        : `${item.poet.name.split(' ')[0][0]}. ${item.poet.name.split(' ').slice(1).join(' ')}`}
                    </span>
                    <span className="h2h-controversial-scores">
                      {item.maximScore.toFixed(2)} vs {item.olegScore.toFixed(2)}
                    </span>
                    <span className={`h2h-controversial-diff ${item.absDifference < 0.5 ? 'low' : ''}`}>
                      Δ{item.absDifference.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {statistics.maximAICompatibility !== null && (
            <div className="h2h-stat-card ai-card">
              <div className="h2h-stat-label">Максим и AI</div>
              <div className="h2h-stat-value ai-value">
                {statistics.maximAICompatibility.toFixed(0)}%
              </div>
              {statistics.topControversialMaximAI.length > 0 && (
                <div className="h2h-controversial-inline">
                  {statistics.topControversialMaximAI.map((item, idx) => (
                    <div key={idx} className="h2h-controversial-row">
                      <span className="h2h-controversial-name">
                        {item.poet.name.split(' ').length === 1 
                          ? item.poet.name 
                          : `${item.poet.name.split(' ')[0][0]}. ${item.poet.name.split(' ').slice(1).join(' ')}`}
                      </span>
                      <span className="h2h-controversial-scores">
                        {item.maximScore.toFixed(2)} vs {item.aiScore.toFixed(2)}
                      </span>
                      <span className={`h2h-controversial-diff ${item.maximAIDiff < 0.5 ? 'low' : ''}`}>
                        Δ{item.maximAIDiff.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {statistics.olegAICompatibility !== null && (
            <div className="h2h-stat-card ai-card">
              <div className="h2h-stat-label">Олег и AI</div>
              <div className="h2h-stat-value ai-value">
                {statistics.olegAICompatibility.toFixed(0)}%
              </div>
              {statistics.topControversialOlegAI.length > 0 && (
                <div className="h2h-controversial-inline">
                  {statistics.topControversialOlegAI.map((item, idx) => (
                    <div key={idx} className="h2h-controversial-row">
                      <span className="h2h-controversial-name">
                        {item.poet.name.split(' ').length === 1 
                          ? item.poet.name 
                          : `${item.poet.name.split(' ')[0][0]}. ${item.poet.name.split(' ').slice(1).join(' ')}`}
                      </span>
                      <span className="h2h-controversial-scores">
                        {item.olegScore.toFixed(2)} vs {item.aiScore.toFixed(2)}
                      </span>
                      <span className={`h2h-controversial-diff ${item.olegAIDiff < 0.5 ? 'low' : ''}`}>
                        Δ{item.olegAIDiff.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default HeadToHeadPage;

