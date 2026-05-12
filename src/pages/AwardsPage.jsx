import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePoets, CATEGORIES } from '../context/PoetsContext';
import { USERS, USER_LABELS, USER_LABELS_GENITIVE, DEFAULT_USER } from '../constants';
import './OverallRankingPage.css'; // Для стилей наград
import './AwardsPage.css';

const AwardsPage = () => {
  const {
    poets,
    ratings,
    likes,
    calculateScore,
    calculateAverageScore,
    hasFullRating,
    categoryLeaders,
    overallDuelWinners,
    aiChoiceTiebreaker,
    tournaments
  } = usePoets();

  const currentUser = localStorage.getItem('currentUser') || DEFAULT_USER;
  const otherUsers = USERS.filter((u) => u !== currentUser);

  // activeTab: 'overall' | 'my' | <user-key for each other user>
  const [activeTab, setActiveTab] = useState('overall');

  // ============ ОБЩИЕ НАГРАДЫ ============

  const calculateReadersChoiceScore = (poetId) => {
    const poet = poets.find(p => p.id === poetId);
    if (!poet || !poet.poems) return 0;

    const poemsArray = Object.values(poet.poems);
    let score = 0;
    poemsArray.forEach(poem => {
      USERS.forEach((u) => {
        if (poem.viewed?.[u]) score += 1;
        if (poem.liked?.[u]) score += 15;
        if (poem.memorized?.[u]) score += 50;
      });
    });
    return score;
  };

  const calculateAIScore = (poetId) => {
    const poet = poets.find(p => p.id === poetId);
    if (!poet || !poet.aiRatings) return 0;

    const aiRatings = poet.aiRatings;
    const score =
      (aiRatings.creativity || 0) * CATEGORIES.creativity.coefficient +
      (aiRatings.influence || 0) * CATEGORIES.influence.coefficient +
      (aiRatings.drama || 0) * CATEGORIES.drama.coefficient +
      (aiRatings.beauty || 0) * CATEGORIES.beauty.coefficient;

    const totalCoefficient =
      CATEGORIES.creativity.coefficient +
      CATEGORIES.influence.coefficient +
      CATEGORIES.drama.coefficient +
      CATEGORIES.beauty.coefficient;

    return totalCoefficient > 0 ? score / totalCoefficient : 0;
  };

  // Помощник: разрешение победителя из топовых поэтов с учётом пиков пользователей
  const resolveTopWinner = (topPoets, leaderKey, duelKey) => {
    const userPicksInTop = USERS
      .map((u) => categoryLeaders[u]?.[leaderKey])
      .filter((pid) => pid && topPoets.some((p) => p.id === pid));
    const distinctPicks = [...new Set(userPicksInTop)];

    if (distinctPicks.length === 1) return [distinctPicks[0]];

    if (distinctPicks.length >= 2) {
      const duelData = overallDuelWinners?.[duelKey];
      if (duelData) {
        const winnerId = duelData.winner || duelData;
        if (topPoets.some((p) => p.id === winnerId)) return [winnerId];
      }
      return [];
    }
    return [];
  };

  const overallCategoryWinners = useMemo(() => {
    const winners = {};

    ['creativity', 'drama', 'influence', 'beauty'].forEach(category => {
      const rankedPoets = poets
        .map(poet => {
          const userRatings = USERS
            .map((u) => ratings[u]?.[poet.id]?.[category] || 0)
            .filter((r) => r > 0);
          if (userRatings.length === 0) return null;
          const avg = userRatings.reduce((s, r) => s + r, 0) / userRatings.length;
          return { id: poet.id, rating: avg };
        })
        .filter(item => item && item.rating > 0)
        .sort((a, b) => b.rating - a.rating);

      if (rankedPoets.length === 0) {
        winners[category] = [];
        return;
      }

      const topRating = rankedPoets[0].rating;
      const topPoets = rankedPoets.filter(p => Math.abs(p.rating - topRating) < 0.01);

      if (topPoets.length === 1) {
        winners[category] = [topPoets[0].id];
      } else {
        winners[category] = resolveTopWinner(topPoets, category, category);
      }
    });

    // Overall (лучший поэт) — все поэты с любой оценкой
    const overallRankings = poets
      .map(poet => ({ id: poet.id, score: calculateAverageScore(poet.id) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);

    if (overallRankings.length > 0) {
      const topScore = overallRankings[0].score;
      const topPoets = overallRankings.filter(r => Math.abs(r.score - topScore) < 0.01);

      if (topPoets.length === 1) {
        winners.overall = [topPoets[0].id];
      } else {
        winners.overall = resolveTopWinner(topPoets, 'overall', 'overall');
      }
    } else {
      winners.overall = [];
    }

    return winners;
  }, [poets, ratings, calculateAverageScore, hasFullRating, overallDuelWinners, categoryLeaders]);

  const overallLoser = useMemo(() => {
    const overallRankings = poets
      .map(poet => ({ id: poet.id, score: calculateAverageScore(poet.id) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);

    if (overallRankings.length <= 3) return [];

    const lowestScore = overallRankings[overallRankings.length - 1].score;
    const lowestPoets = overallRankings.filter(r => Math.abs(r.score - lowestScore) < 0.01);

    if (lowestPoets.length === 1) return [lowestPoets[0].id];

    return resolveTopWinner(lowestPoets, 'overall_worst', 'overall_worst');
  }, [poets, hasFullRating, calculateAverageScore, overallDuelWinners, categoryLeaders]);

  const readersChoiceWinner = useMemo(() => {
    const readersRankings = poets
      .map(poet => ({ id: poet.id, score: calculateReadersChoiceScore(poet.id) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);

    return readersRankings.length > 0 ? [readersRankings[0].id] : [];
  }, [poets]);

  const aiChoiceWinner = useMemo(() => {
    if (aiChoiceTiebreaker && aiChoiceTiebreaker.winner) {
      return [aiChoiceTiebreaker.winner];
    }

    const aiRankings = poets
      .map(poet => ({ id: poet.id, score: calculateAIScore(poet.id) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);

    return aiRankings.length > 0 ? [aiRankings[0].id] : [];
  }, [poets, aiChoiceTiebreaker]);

  // Нобелевская премия: лайк от всех трёх пользователей.
  // Если лауреатов будет слишком много — ужесточим.
  const nobelWinners = useMemo(() => {
    return poets
      .filter((poet) => USERS.every((u) => Boolean(likes[u]?.[poet.id])))
      .map((poet) => poet.id);
  }, [poets, likes]);

  const overallBelarusianWinner = useMemo(() => {
    const scored = poets
      .filter(p => p.belarusian)
      .map(p => ({ id: p.id, score: calculateAverageScore(p.id) }))
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored.length > 0 ? [scored[0].id] : [];
  }, [poets, calculateAverageScore]);

  // ============ ПЕРСОНАЛЬНЫЕ НАГРАДЫ ============

  const getPersonalWinners = (rater) => {
    const winners = {};

    ['creativity', 'drama', 'influence', 'beauty'].forEach(category => {
      const poetsWithRatings = poets
        .map(poet => ({
          id: poet.id,
          rating: ratings[rater]?.[poet.id]?.[category] || 0
        }))
        .filter(p => p.rating > 0)
        .sort((a, b) => b.rating - a.rating);

      if (poetsWithRatings.length === 0) {
        winners[category] = [];
        return;
      }

      const topRating = poetsWithRatings[0].rating;
      const topPoets = poetsWithRatings.filter(p => Math.abs(p.rating - topRating) < 0.01);
      const explicitLeader = categoryLeaders[rater]?.[category];

      if (explicitLeader && topPoets.some(p => p.id === explicitLeader)) {
        winners[category] = [explicitLeader];
      } else if (topPoets.length === 1) {
        winners[category] = [topPoets[0].id];
      } else {
        winners[category] = [];
      }
    });

    const poetsWithScores = poets
      .map(poet => ({ id: poet.id, score: calculateScore(rater, poet.id) }))
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score);

    if (poetsWithScores.length > 0) {
      const topScore = poetsWithScores[0].score;
      const topPoets = poetsWithScores.filter(p => Math.abs(p.score - topScore) < 0.01);
      const explicitLeader = categoryLeaders[rater]?.['overall'];

      if (explicitLeader && topPoets.some(p => p.id === explicitLeader)) {
        winners.overall = [explicitLeader];
      } else if (topPoets.length === 1) {
        winners.overall = [topPoets[0].id];
      } else {
        winners.overall = [];
      }
    } else {
      winners.overall = [];
    }

    return winners;
  };

  const getPersonalLoser = (rater) => {
    const poetsWithScores = poets
      .map(poet => ({ id: poet.id, score: calculateScore(rater, poet.id) }))
      .filter(p => p.score > 0)
      .sort((a, b) => a.score - b.score);

    if (poetsWithScores.length <= 3) return [];

    const lowestScore = poetsWithScores[0].score;
    const lowestPoets = poetsWithScores.filter(p => Math.abs(p.score - lowestScore) < 0.01);
    const explicitLoser = categoryLeaders[rater]?.['overall_worst'];

    if (explicitLoser && lowestPoets.some(p => p.id === explicitLoser)) {
      return [explicitLoser];
    }
    if (lowestPoets.length === 1) return [lowestPoets[0].id];
    return [];
  };

  const getPersonalBelarusianWinner = (rater) => {
    const scored = poets
      .filter(p => p.belarusian)
      .map(p => ({ id: p.id, score: calculateScore(rater, p.id) }))
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored.length > 0 ? [scored[0].id] : [];
  };

  const personalAwardsByUser = useMemo(() => {
    return USERS.reduce((acc, u) => {
      acc[u] = {
        winners: getPersonalWinners(u),
        loser: getPersonalLoser(u),
        belarusian: getPersonalBelarusianWinner(u)
      };
      return acc;
    }, {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poets, ratings, categoryLeaders, calculateScore]);

  const renderAwardCard = (award, winners) => {
    if (winners.length === 0) return null;

    return winners.map(poetId => {
      const poet = poets.find(p => p.id === poetId);
      if (!poet) return null;
      const isTournamentAward = String(award.key || '').startsWith('tournament-');
      const bottomTitle = isTournamentAward && award.winnerPoemTitle
        ? award.winnerPoemTitle
        : (award.winnerPoemTitle ? `${poet.name} — ${award.winnerPoemTitle}` : poet.name);

      return (
        <div key={`${award.key}-${poetId}`} className="award-item-wrapper">
          <Link to={`/poet/${poetId}`} className="award-winner-card">
            <div className="award-winner-composition">
              <div className="award-badge-section">
                <img
                  src={`/images/badges/${award.badge}`}
                  alt={award.name}
                  className="award-badge-large-img"
                />
              </div>
              <div className="award-poet-section">
                {poet.imageUrl && (
                  <img
                    src={poet.imageUrl}
                    alt={poet.name}
                    className="award-winner-avatar"
                    style={{
                      objectPosition: `center ${poet.imagePositionY !== undefined ? poet.imagePositionY : 25}%`
                    }}
                  />
                )}
              </div>
            </div>
            <div className="award-winner-overlay">
              <div className="award-category-title">{award.name}</div>
              <div className={`award-winner-name${isTournamentAward ? ' tournament-poem-title' : ''}`}>
                {bottomTitle}
              </div>
            </div>
          </Link>
        </div>
      );
    });
  };

  const overallAwards = [
    { key: 'overall', name: 'Лучший поэт', badge: 'overall.png' },
    { key: 'creativity', name: CATEGORIES.creativity.name, badge: 'creativity.png' },
    { key: 'drama', name: CATEGORIES.drama.name, badge: 'drama.png' },
    { key: 'influence', name: CATEGORIES.influence.name, badge: 'influence.png' },
    { key: 'beauty', name: CATEGORIES.beauty.name, badge: 'beauty.png' },
    { key: 'belarus', name: 'Лучший беларуский поэт', badge: 'belarus.png' },
    { key: 'nobel', name: 'Нобелевская премия', badge: 'nobel.png' },
    { key: 'readers-choice', name: 'Выбор читателей', badge: 'readers-choice.png' },
    { key: 'ai-choice', name: 'Выбор ИИ', badge: 'ai-choice.png' },
    { key: 'last', name: 'Худший поэт', badge: 'last.png' }
  ];

  const personalAwards = [
    { key: 'overall', name: 'Лучший поэт', badge: 'overall.png' },
    { key: 'creativity', name: CATEGORIES.creativity.name, badge: 'creativity.png' },
    { key: 'drama', name: CATEGORIES.drama.name, badge: 'drama.png' },
    { key: 'influence', name: CATEGORIES.influence.name, badge: 'influence.png' },
    { key: 'beauty', name: CATEGORIES.beauty.name, badge: 'beauty.png' },
    { key: 'belarus', name: 'Лучший беларуский поэт', badge: 'belarus.png' },
    { key: 'last', name: 'Худший поэт', badge: 'last.png' }
  ];

  const tournamentAwards = useMemo(() => {
    if (!Array.isArray(tournaments)) return [];
    return tournaments
      .filter((tournament) => Boolean(tournament?.winnerPoetId) && Boolean(tournament?.badge))
      .map((tournament) => {
        const winnerPoet = poets.find((p) => String(p.id) === String(tournament.winnerPoetId));
        const finalMatch = tournament.finalMatch || null;
        let winnerPoemTitle = '';

        if (winnerPoet && finalMatch) {
          let winnerPoemIds = [];
          if (Array.isArray(finalMatch.winnerPoemIds) && finalMatch.winnerPoemIds.length > 0) {
            winnerPoemIds = finalMatch.winnerPoemIds;
          } else if (finalMatch.winnerSide === 'A') {
            winnerPoemIds = finalMatch.poetAPoemIds || [];
          } else if (finalMatch.winnerSide === 'B') {
            winnerPoemIds = finalMatch.poetBPoemIds || [];
          }

          if (winnerPoemIds.length > 0) {
            winnerPoemTitle = winnerPoet.poems?.[winnerPoemIds[0]]?.title || '';
          }
        }

        return {
          key: `tournament-${tournament.id}`,
          name: `Турнир «${tournament.name || 'Без названия'}»`,
          badge: tournament.badge,
          winners: [tournament.winnerPoetId],
          winnerPoemTitle
        };
      });
  }, [tournaments, poets]);

  const getWinnersForAward = (awardKey) => {
    if (activeTab === 'overall') {
      if (awardKey === 'last') return overallLoser;
      if (awardKey === 'nobel') return nobelWinners;
      if (awardKey === 'readers-choice') return readersChoiceWinner;
      if (awardKey === 'ai-choice') return aiChoiceWinner;
      if (awardKey === 'belarus') return overallBelarusianWinner;
      return overallCategoryWinners[awardKey] || [];
    }

    // Personal tabs: 'my' OR a specific other-user key
    const ratingUser = activeTab === 'my' ? currentUser : activeTab;
    const data = personalAwardsByUser[ratingUser];
    if (!data) return [];
    if (awardKey === 'last') return data.loser;
    if (awardKey === 'belarus') return data.belarusian;
    return data.winners[awardKey] || [];
  };

  const currentAwards = activeTab === 'overall'
    ? (() => {
      const worstAward = overallAwards.find((award) => award.key === 'last');
      const otherOverallAwards = overallAwards.filter((award) => award.key !== 'last');
      return worstAward
        ? [...otherOverallAwards, ...tournamentAwards, worstAward]
        : [...otherOverallAwards, ...tournamentAwards];
    })()
    : personalAwards;

  return (
    <div className="awards-page">

      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === 'overall' ? 'active' : ''}`}
          onClick={() => setActiveTab('overall')}
        >
          Общие
        </button>
        <button
          className={`tab-btn ${activeTab === 'my' ? 'active' : ''}`}
          onClick={() => setActiveTab('my')}
        >
          Мои
        </button>
        {otherUsers.map((u) => (
          <button
            key={u}
            className={`tab-btn ${activeTab === u ? 'active' : ''}`}
            onClick={() => setActiveTab(u)}
          >
            {USER_LABELS_GENITIVE[u]}
          </button>
        ))}
      </div>

      <div className="awards-list-new">
        <div className="award-winners">
          {currentAwards.map(award =>
            renderAwardCard(award, award.winners || getWinnersForAward(award.key))
          ).flat().filter(Boolean)}

          {currentAwards.every(award => (award.winners || getWinnersForAward(award.key)).length === 0) && (
            <div className="no-awards-message">
              Пока нет наград для отображения
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AwardsPage;
