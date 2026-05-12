import React, { useMemo } from 'react';
import { usePoets, CATEGORIES } from '../context/PoetsContext';
import { USERS, USER_LABELS, USER_INITIALS } from '../constants';
import './HeadToHeadPage.css';

const STRICT_COMPARE_EPS = 0.001;

const PAIRS = [
  ['maxim', 'oleg'],
  ['maxim', 'lyuba'],
  ['oleg', 'lyuba']
];

const shortPoetName = (name) => {
  const parts = String(name || '').split(' ');
  return parts.length <= 1 ? parts[0] || '' : parts.slice(1).join(' ');
};

const HeadToHeadPage = () => {
  const { poets, ratings, calculateScore, likes, categoryCoefficients } = usePoets();

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

  const statistics = useMemo(() => {
    // Базовая статистика по поэтам
    const ratedByUser = USERS.reduce((acc, u) => {
      acc[u] = poets.filter((p) => {
        const r = ratings[u]?.[p.id];
        return r && (r.creativity > 0 || r.influence > 0 || r.drama > 0 || r.beauty > 0);
      }).length;
      return acc;
    }, {});

    const likedPoets = USERS.reduce((acc, u) => {
      acc[u] = likes?.[u]
        ? Object.keys(likes[u]).filter((id) => likes[u][id] && poets.some((p) => String(p.id) === String(id))).length
        : 0;
      return acc;
    }, {});

    // Если никто ещё ничего не оценил — пусто
    const anyRated = USERS.some((u) => ratedByUser[u] > 0);
    if (!anyRated) return null;

    // Статистика по стихам
    let totalPoems = 0;
    const poemStats = USERS.reduce((acc, u) => {
      acc[u] = { viewed: 0, liked: 0, memorized: 0 };
      return acc;
    }, {});

    poets.forEach((poet) => {
      if (poet.poems) {
        const poemsList = Object.values(poet.poems);
        totalPoems += poemsList.length;
        poemsList.forEach((poem) => {
          USERS.forEach((u) => {
            if (poem.viewed?.[u]) poemStats[u].viewed += 1;
            if (poem.liked?.[u]) poemStats[u].liked += 1;
            if (poem.memorized?.[u]) poemStats[u].memorized += 1;
          });
        });
      }
    });

    // Средние оценки по категориям для каждого пользователя (по поэтам которых он оценил)
    // Также определяем "самого строгого" по каждой категории среди тех, кто оценивал
    const categoryStats = {};
    Object.keys(CATEGORIES).forEach((key) => {
      const userAverages = {};
      USERS.forEach((u) => {
        let total = 0;
        let count = 0;
        poets.forEach((poet) => {
          const rating = ratings[u]?.[poet.id]?.[key] || 0;
          if (rating > 0) {
            total += rating;
            count += 1;
          }
        });
        userAverages[u] = count > 0 ? { avg: total / count, count } : null;
      });

      const ratingUsers = USERS.filter((u) => userAverages[u]);
      let strictest = null;
      if (ratingUsers.length > 0) {
        // Самый строгий — у кого средняя самая низкая (с заметной разницей)
        const sorted = [...ratingUsers].sort((a, b) => userAverages[a].avg - userAverages[b].avg);
        const lowest = userAverages[sorted[0]].avg;
        const secondLowest = sorted.length > 1 ? userAverages[sorted[1]].avg : null;
        if (secondLowest === null || lowest + STRICT_COMPARE_EPS < secondLowest) {
          strictest = sorted[0];
        }
      }

      categoryStats[key] = { userAverages, strictest };
    });

    // Совместимость по парам пользователей
    const pairCompatibility = PAIRS.map(([u1, u2]) => {
      const common = poets.filter((poet) => {
        const s1 = calculateScore(u1, poet.id);
        const s2 = calculateScore(u2, poet.id);
        return s1 > 0 && s2 > 0;
      });
      if (common.length === 0) {
        return { u1, u2, compatibility: null, topControversial: [], count: 0 };
      }

      let diffTotal = 0;
      const comparisons = common.map((poet) => {
        const s1 = calculateScore(u1, poet.id);
        const s2 = calculateScore(u2, poet.id);
        const absDiff = Math.abs(s1 - s2);
        diffTotal += absDiff;
        return { poet, s1, s2, absDiff };
      });

      const avgDiff = diffTotal / common.length;
      const compatibility = Math.max(0, 100 - (avgDiff / 5) * 100);
      const topControversial = [...comparisons].sort((a, b) => b.absDiff - a.absDiff).slice(0, 3);

      return { u1, u2, compatibility, topControversial, count: common.length };
    });

    // Совместимость пользователь ↔ AI
    const userAiCompatibility = USERS.map((u) => {
      const matched = poets
        .map((poet) => {
          const userScore = calculateScore(u, poet.id);
          const aiScore = calculateAIScore(poet);
          if (userScore > 0 && aiScore > 0) {
            return { poet, userScore, aiScore, absDiff: Math.abs(userScore - aiScore) };
          }
          return null;
        })
        .filter(Boolean);

      if (matched.length === 0) {
        return { user: u, compatibility: null, topControversial: [], count: 0 };
      }

      const diffTotal = matched.reduce((sum, m) => sum + m.absDiff, 0);
      const avgDiff = diffTotal / matched.length;
      const compatibility = Math.max(0, 100 - (avgDiff / 5) * 100);
      const topControversial = [...matched].sort((a, b) => b.absDiff - a.absDiff).slice(0, 3);

      return { user: u, compatibility, topControversial, count: matched.length };
    });

    return {
      totalPoets: poets.length,
      ratedByUser,
      likedPoets,
      totalPoems,
      poemStats,
      categoryStats,
      pairCompatibility,
      userAiCompatibility
    };
  }, [poets, ratings, calculateScore, likes, categoryCoefficients]);

  if (!statistics) {
    return (
      <div className="head-to-head-page">
        <div className="empty-state">
          <img src="/images/poet2.png" alt="Нет данных" className="empty-icon" />
          <p>Недостаточно данных для сравнения</p>
          <p className="empty-hint">Хотя бы один пользователь должен оценить поэта</p>
        </div>
      </div>
    );
  }

  const renderUserTrio = (getValue) => (
    <div className="h2h-combined-duo h2h-combined-trio">
      {USERS.map((u, idx) => (
        <React.Fragment key={u}>
          {idx > 0 && <span className="h2h-duo-separator">/</span>}
          <div className={`h2h-stat-duo-item ${u}`}>
            <div className="h2h-stat-value">{getValue(u)}</div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div className="h2h-page">
      {/* Секция 0: Статистика */}
      <div className="h2h-section">
        <h2 className="h2h-section-title">
          Статистика{' '}
          <span className="h2h-legend">
            {USERS.map((u, idx) => (
              <React.Fragment key={u}>
                {idx > 0 && ' / '}
                <span className={`legend-${u}`}>{USER_LABELS[u]}</span>
              </React.Fragment>
            ))}
          </span>
        </h2>
        <div className="h2h-overview-combined">
          <div className="h2h-combined-card">
            <div className="h2h-stat-label">Поэты</div>
            <div className="h2h-combined-content no-dividers">
              <div className="h2h-combined-section">
                <div className="h2h-stat-value">{statistics.totalPoets}</div>
                <div className="h2h-stat-hint">всего</div>
              </div>
              <div className="h2h-combined-section">
                {renderUserTrio((u) => statistics.ratedByUser[u])}
                <div className="h2h-stat-hint">оценено</div>
              </div>
              <div className="h2h-combined-section">
                {renderUserTrio((u) => statistics.likedPoets[u])}
                <div className="h2h-stat-hint">любимые</div>
              </div>
            </div>
          </div>

          <div className="h2h-combined-card">
            <div className="h2h-stat-label">Стихи</div>
            <div className="h2h-combined-content no-dividers">
              <div className="h2h-combined-section">
                <div className="h2h-stat-value">{statistics.totalPoems}</div>
                <div className="h2h-stat-hint">всего</div>
              </div>
              <div className="h2h-combined-section">
                {renderUserTrio((u) => statistics.poemStats[u].viewed)}
                <div className="h2h-stat-hint">прочитано</div>
              </div>
              <div className="h2h-combined-section">
                {renderUserTrio((u) => statistics.poemStats[u].liked)}
                <div className="h2h-stat-hint">любимые</div>
              </div>
              <div className="h2h-combined-section">
                {renderUserTrio((u) => statistics.poemStats[u].memorized)}
                <div className="h2h-stat-hint">выучено</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Секция 1: Категории и оценки */}
      <div className="h2h-section">
        <h2 className="h2h-section-title">Категории и оценки</h2>

        <div className="h2h-stats-cards category-cards">
          {['creativity', 'drama', 'influence', 'beauty'].map((key) => {
            const cat = CATEGORIES[key];
            const stat = statistics.categoryStats[key];
            const strictest = stat?.strictest;
            const strictestLabel = strictest ? USER_LABELS[strictest] : null;

            return (
              <div key={key} className="h2h-stat-card with-bars">
                <div className="h2h-stat-label">{cat.name}</div>
                <div className={`h2h-stat-value ${strictest ? `${strictest}-value` : ''}`}>
                  {strictestLabel || '—'}
                </div>
                <div className="h2h-stat-hint">строже</div>
                <div className="h2h-bars-separator"></div>
                <div className="h2h-mini-bars">
                  {USERS.map((u) => {
                    const data = stat?.userAverages?.[u];
                    const avg = data?.avg || 0;
                    const percent = (avg / 5) * 100;
                    return (
                      <div key={u} className={`h2h-mini-bar ${u}`}>
                        <span className="h2h-mini-label">{USER_INITIALS[u].toUpperCase()}</span>
                        <div className="h2h-mini-track">
                          <div className="h2h-mini-fill" style={{ width: `${percent}%` }}></div>
                        </div>
                        <span className="h2h-mini-value">{avg > 0 ? avg.toFixed(2) : '—'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Секция 2: Совместимость */}
      <div className="h2h-section">
        <h2 className="h2h-section-title">Совместимость</h2>

        {/* Человек ↔ Человек (3 блока) */}
        <div className="h2h-stats-cards three-cols">
          {statistics.pairCompatibility.map(({ u1, u2, compatibility, topControversial }) => (
            <div key={`${u1}-${u2}`} className="h2h-stat-card">
              <div className="h2h-stat-label">
                {USER_LABELS[u1]} и {USER_LABELS[u2]}
              </div>
              <div className="h2h-stat-value">
                {compatibility !== null ? `${compatibility.toFixed(0)}%` : '—'}
              </div>
              {topControversial.length > 0 && (
                <div className="h2h-controversial-inline">
                  {topControversial.map((item, idx) => (
                    <div key={idx} className="h2h-controversial-row">
                      <span className="h2h-controversial-name">{shortPoetName(item.poet.name)}</span>
                      <span className="h2h-controversial-scores">
                        {item.s1.toFixed(2)} vs {item.s2.toFixed(2)}
                      </span>
                      <span className={`h2h-controversial-diff ${item.absDiff < 0.5 ? 'low' : ''}`}>
                        Δ{item.absDiff.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Человек ↔ AI (3 блока) */}
        <div className="h2h-stats-cards three-cols h2h-ai-row">
          {statistics.userAiCompatibility.map(({ user, compatibility, topControversial }) => (
            <div key={`${user}-ai`} className="h2h-stat-card ai-card">
              <div className="h2h-stat-label">{USER_LABELS[user]} и AI</div>
              <div className="h2h-stat-value ai-value">
                {compatibility !== null ? `${compatibility.toFixed(0)}%` : '—'}
              </div>
              {topControversial.length > 0 && (
                <div className="h2h-controversial-inline">
                  {topControversial.map((item, idx) => (
                    <div key={idx} className="h2h-controversial-row">
                      <span className="h2h-controversial-name">{shortPoetName(item.poet.name)}</span>
                      <span className="h2h-controversial-scores">
                        {item.userScore.toFixed(2)} vs {item.aiScore.toFixed(2)}
                      </span>
                      <span className={`h2h-controversial-diff ${item.absDiff < 0.5 ? 'low' : ''}`}>
                        Δ{item.absDiff.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HeadToHeadPage;
