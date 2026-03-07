import React, { useEffect, useMemo, useState } from 'react';
import { Music4, Swords } from 'lucide-react';
import Tooltip from '../components/Tooltip';
import { usePoets } from '../context/PoetsContext';
import './TournamentsPage.css';
import '../components/BattleModal.css';

const TournamentsPage = () => {
  const BRACKET_ROW_HEIGHT = 44;
  const BRACKET_CARD_HEIGHT = 40;
  const {
    tournaments,
    poets,
    addTournamentParticipant,
    deleteTournamentParticipant,
    ensureTournamentMatch,
    submitTournamentVote,
    ensureTournamentPlayIn,
    submitTournamentPlayInVote,
    promoteTournamentWinnerByBye
  } = usePoets();
  const [activeTournamentId, setActiveTournamentId] = useState('');
  const [showAddParticipantModal, setShowAddParticipantModal] = useState(false);
  const [participantQuery, setParticipantQuery] = useState('');
  const [selectedPoetId, setSelectedPoetId] = useState('');
  const [selectedPoemIds, setSelectedPoemIds] = useState([]);
  const [participantError, setParticipantError] = useState('');
  const [currentUser, setCurrentUser] = useState('maxim');
  const [battleModal, setBattleModal] = useState(null);
  const [battleError, setBattleError] = useState('');
  const [isBattleSubmitting, setIsBattleSubmitting] = useState(false);
  const [promotingMatchKey, setPromotingMatchKey] = useState('');
  const [deletingParticipantId, setDeletingParticipantId] = useState('');
  const [contextMenu, setContextMenu] = useState(null); // { x, y, poet, participant, match, canPromote }

  useEffect(() => {
    const user = localStorage.getItem('currentUser');
    if (user === 'maxim' || user === 'oleg') {
      setCurrentUser(user);
    }
  }, []);

  useEffect(() => {
    if (tournaments.length === 0) {
      setActiveTournamentId('');
      return;
    }
    const exists = tournaments.some((t) => t.id === activeTournamentId);
    if (!activeTournamentId || !exists) {
      setActiveTournamentId(tournaments[0].id);
    }
  }, [tournaments, activeTournamentId]);

  const activeTournament = useMemo(
    () => tournaments.find((t) => t.id === activeTournamentId) || null,
    [tournaments, activeTournamentId]
  );

  const participants = useMemo(() => {
    if (!activeTournament?.participants) return [];
    return Object.keys(activeTournament.participants).map((id) => ({
      id,
      ...activeTournament.participants[id]
    }));
  }, [activeTournament]);

  const size = activeTournament?.size === 32 ? 32 : 16;
  const sideSize = size / 2;
  const roundsPerSide = Math.max(1, Math.log2(sideSize));

  const slotToParticipant = useMemo(() => {
    const map = new Map();
    participants.forEach((p) => {
      if (Number.isInteger(p.slot)) map.set(p.slot, p);
    });
    return map;
  }, [participants]);

  const poetById = useMemo(() => {
    const map = new Map();
    poets.forEach((poet) => map.set(poet.id, poet));
    return map;
  }, [poets]);

  const filteredPoets = useMemo(() => {
    const query = participantQuery.trim().toLowerCase();
    if (!query) return poets.slice(0, 10);
    return poets
      .filter((p) => p.name?.toLowerCase().includes(query))
      .slice(0, 12);
  }, [poets, participantQuery]);

  const selectedPoet = selectedPoetId ? poetById.get(selectedPoetId) : null;
  const winnerPoet = activeTournament?.winnerPoetId
    ? (poetById.get(activeTournament.winnerPoetId) || null)
    : null;
  const finalPoets = useMemo(() => {
    const ids = [];
    if (Array.isArray(activeTournament?.finalists)) {
      ids.push(...activeTournament.finalists);
    }
    if (activeTournament?.finalistAId) ids.push(activeTournament.finalistAId);
    if (activeTournament?.finalistBId) ids.push(activeTournament.finalistBId);
    if (activeTournament?.final?.poetAId) ids.push(activeTournament.final.poetAId);
    if (activeTournament?.final?.poetBId) ids.push(activeTournament.final.poetBId);
    return ids
      .map((id) => poetById.get(id))
      .filter(Boolean)
      .slice(0, 2);
  }, [activeTournament, poetById]);
  const winnerPoemTitles = useMemo(() => {
    if (!winnerPoet) return [];
    const finalMatch = activeTournament?.finalMatch || null;
    if (!finalMatch) return [];

    let poemIds = [];
    if (Array.isArray(finalMatch.winnerPoemIds) && finalMatch.winnerPoemIds.length > 0) {
      poemIds = finalMatch.winnerPoemIds;
    } else if (finalMatch.winnerSide === 'A') {
      poemIds = finalMatch.poetAPoemIds || [];
    } else if (finalMatch.winnerSide === 'B') {
      poemIds = finalMatch.poetBPoemIds || [];
    } else if (String(finalMatch.winnerPoetId) === String(finalMatch.poetAId) && String(finalMatch.poetAId) !== String(finalMatch.poetBId)) {
      poemIds = finalMatch.poetAPoemIds || [];
    } else if (String(finalMatch.winnerPoetId) === String(finalMatch.poetBId)) {
      poemIds = finalMatch.poetBPoemIds || [];
    }

    return poemIds
      .map((poemId) => winnerPoet?.poems?.[poemId]?.title)
      .filter(Boolean);
  }, [activeTournament, winnerPoet]);
  const resolveBadgeFilename = (badgeValue) => {
    const raw = String(badgeValue || '').trim();
    if (!raw) return 'overall.png';
    return raw.toLowerCase().endsWith('.png') ? raw : `${raw}.png`;
  };
  const activeBadgeFilename = resolveBadgeFilename(activeTournament?.badge);
  const selectedPoetPoems = useMemo(() => {
    if (!selectedPoet?.poems) return [];
    return Object.keys(selectedPoet.poems).map((id) => ({
      id,
      ...selectedPoet.poems[id]
    }));
  }, [selectedPoet]);

  const closeAddParticipantModal = () => {
    setShowAddParticipantModal(false);
    setParticipantQuery('');
    setSelectedPoetId('');
    setSelectedPoemIds([]);
    setParticipantError('');
  };

  const handleAddParticipant = async () => {
    if (!activeTournament) return;
    if (!selectedPoetId) {
      setParticipantError('Выберите поэта');
      return;
    }

    try {
      await addTournamentParticipant(activeTournament.id, {
        poetId: selectedPoetId,
        poemIds: selectedPoemIds.slice(0, 1)
      });
      closeAddParticipantModal();
    } catch (error) {
      console.error('Ошибка добавления участника:', error);
      if (String(error?.message || '').includes('No free slots')) {
        const candidates = participants.filter((p) => String(p.poetId) !== String(selectedPoetId));
        const pool = candidates.length > 0 ? candidates : participants;
        if (pool.length === 0) {
          setParticipantError('Нет доступных участников для дуэли за слот');
          return;
        }
        const incumbentParticipant = pool[Math.floor(Math.random() * pool.length)];
        try {
          await ensureTournamentPlayIn(activeTournament.id, {
            incumbentParticipantId: incumbentParticipant.id,
            incumbentPoetId: incumbentParticipant.poetId,
            incumbentPoemIds: (incumbentParticipant.poemIds || []).slice(0, 1),
            challengerPoetId: selectedPoetId,
            challengerPoemIds: selectedPoemIds.slice(0, 1)
          }, {
            waitForAi: false,
            triggerAi: currentUser === 'maxim'
          });
          closeAddParticipantModal();
          setBattleError('');
          setBattleModal({ type: 'playIn' });
        } catch (playInError) {
          setParticipantError(playInError?.message || 'Не удалось запустить дуэль за слот');
        }
        return;
      }
      setParticipantError(error?.message || 'Не удалось добавить участника');
    }
  };

  const getPoetBySlot = (slot) => {
    const participant = slotToParticipant.get(slot);
    if (!participant) return null;
    return poetById.get(participant.poetId) || null;
  };

  const handleDeleteParticipant = async (participant) => {
    if (!activeTournament || !participant?.id) {
      setBattleError('Этого поэта нельзя удалить из сетки: он уже в результатах раундов.');
      return;
    }

    const poet = poetById.get(participant.poetId);
    const poetName = poet?.name || 'участника';
    const poemTitles = (Array.isArray(participant.poemIds) ? participant.poemIds.slice(0, 1) : [])
      .map((poemId) => poet?.poems?.[poemId]?.title)
      .filter(Boolean);
    const poemsLabel = poemTitles.length > 0
      ? `\nСтих: ${poemTitles[0]}`
      : '\nСтих: не выбран';
    const confirmed = window.confirm(`Удалить ${poetName} из турнира?${poemsLabel}`);
    if (!confirmed) return;

    setDeletingParticipantId(participant.id);
    setBattleError('');
    try {
      await deleteTournamentParticipant(activeTournament.id, participant.id);
    } catch (error) {
      setBattleError(error?.message || 'Не удалось удалить участника');
    } finally {
      setDeletingParticipantId('');
    }
  };

  const renderPoetSquare = (poet, key, matchCtx = null, participant = null, poemIdsOverride = null, stateClass = '') => {
    const sourcePoemIds = Array.isArray(poemIdsOverride)
      ? poemIdsOverride.slice(0, 1)
      : (participant?.poemIds || []).slice(0, 1);
    const poemTitles = poet && Array.isArray(sourcePoemIds)
      ? sourcePoemIds
        .map((poemId) => poet.poems?.[poemId]?.title)
        .filter(Boolean)
      : [];
    const hoverTitle = !poet
      ? 'Свободный слот'
      : poemTitles.length > 0
        ? `${poet.name}\nСтих: ${poemTitles[0]}`
        : poet.name;

    return (
    <div
      key={key}
      className={`tournament-poet-square ${poet ? 'filled' : ''} ${stateClass}`.trim()}
      title={hoverTitle}
      onContextMenu={(e) => {
        if (!poet) return;
        e.preventDefault();
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          poet,
          participant,
          match: matchCtx?.match || null,
          canPromote: matchCtx?.canPromote || false
        });
      }}
    >
      <img
        src={poet?.imageUrl || '/images/poet.png'}
        alt={poet?.name || 'Свободный слот'}
        style={poet?.imageUrl ? { objectPosition: `center ${poet.imagePositionY ?? 25}%` } : undefined}
      />
    </div>
    );
  };

  const renderMatchNodeContent = (poets, match, firstSlot = null) => {
    const filledPoets = poets.filter(Boolean);
    const matchData = getMatchData(match);
    const isFirstRoundMatch = match?.type === 'round' && match?.roundIndex === 0 && Number.isInteger(firstSlot);
    const leftParticipant = isFirstRoundMatch ? (slotToParticipant.get(firstSlot) || null) : null;
    const rightParticipant = isFirstRoundMatch ? (slotToParticipant.get(firstSlot + 1) || null) : null;
    const leftPoemIds = Array.isArray(matchData?.poetAPoemIds)
      ? matchData.poetAPoemIds
      : (leftParticipant?.poemIds || []);
    const rightPoemIds = Array.isArray(matchData?.poetBPoemIds)
      ? matchData.poetBPoemIds
      : (rightParticipant?.poemIds || []);

    if (filledPoets.length === 0) {
      return <div className="tournament-match-empty" />;
    }

    if (filledPoets.length === 1) {
      const alreadyPromoted = matchData?.status === 'finished';
      const singleParticipant = isFirstRoundMatch
        ? (poets[0] ? leftParticipant : rightParticipant)
        : null;
      const singlePoemIds = poets[0] ? leftPoemIds : rightPoemIds;
      return (
        <div className="tournament-match-content one-poet">
          {renderPoetSquare(
            filledPoets[0],
            'single',
            { match, canPromote: !alreadyPromoted },
            singleParticipant,
            singlePoemIds
          )}
        </div>
      );
    }

    const votes = matchData?.votes || {};
    const isFinished = Boolean(matchData?.status === 'finished' && matchData?.winnerPoetId);
    const leftPoetId = filledPoets[0]?.id;
    const rightPoetId = filledPoets[1]?.id;
    const hasWinnerSide = matchData?.winnerSide === 'A' || matchData?.winnerSide === 'B';
    const winnerSide = !isFinished
      ? null
      : hasWinnerSide
        ? matchData.winnerSide
        : (String(leftPoetId) !== String(rightPoetId) && String(matchData?.winnerPoetId) === String(leftPoetId) ? 'A' : 'B');
    const leftStateClass = isFinished && winnerSide === 'B' ? 'is-loser' : '';
    const rightStateClass = isFinished && winnerSide === 'A' ? 'is-loser' : '';

    const voteSides = Object.values(votes)
      .map((vote) => resolveVoteSide(vote, matchData))
      .filter(Boolean);
    let leftScore = voteSides.filter((side) => side === 'A').length;
    let rightScore = voteSides.filter((side) => side === 'B').length;
    if (isFinished && leftScore === 0 && rightScore === 0) {
      if (matchData.winnerSide === 'A' || (matchData.winnerPoetId === leftPoetId && String(leftPoetId) !== String(rightPoetId))) {
        leftScore = 1;
      } else if (matchData.winnerSide === 'B' || matchData.winnerPoetId === rightPoetId) {
        rightScore = 1;
      }
    }

    return (
      <div className="tournament-match-content two-poets">
        {renderPoetSquare(filledPoets[0], 'left', null, leftParticipant, leftPoemIds, leftStateClass)}
        {isFinished ? (
          <div className="tournament-match-score" title="Счет матча">
            <span className={`score-left ${leftScore >= rightScore ? 'winner' : 'loser'}`}>{leftScore}</span>
            <span className="score-separator">:</span>
            <span className={`score-right ${rightScore >= leftScore ? 'winner' : 'loser'}`}>{rightScore}</span>
          </div>
        ) : (
          <button
            className="tournament-battle-btn"
            title="Начать битву"
            onClick={() => openBattleModal(match)}
          >
            <Swords size={14} />
          </button>
        )}
        {renderPoetSquare(filledPoets[1], 'right', null, rightParticipant, rightPoemIds, rightStateClass)}
      </div>
    );
  };

  const getMatchPoets = (side, logicalRoundIndex, nodeIndex, firstSlot) => {
    if (logicalRoundIndex === 0) {
      return [getPoetBySlot(firstSlot), getPoetBySlot(firstSlot + 1)];
    }

    const fromRounds = activeTournament?.rounds?.[logicalRoundIndex]?.[side]?.[nodeIndex];
    if (!fromRounds) return [];

    const ids = [];
    if (Array.isArray(fromRounds.poetIds)) ids.push(...fromRounds.poetIds);
    if (fromRounds.poetAId) ids.push(fromRounds.poetAId);
    if (fromRounds.poetBId) ids.push(fromRounds.poetBId);
    return ids
      .map((id) => poetById.get(id))
      .filter(Boolean)
      .slice(0, 2);
  };

  const getMatchData = (match) => {
    if (!activeTournament || !match) return null;
    if (match.type === 'playIn') return activeTournament.playIn || null;
    if (match.type === 'final') return activeTournament.finalMatch || null;
    return activeTournament?.rounds?.[match.roundIndex]?.[match.side]?.[match.nodeIndex] || null;
  };

  const getPoemsForMatchSide = (matchData, sideKey) => {
    if (!matchData) return [];
    const poetId = sideKey === 'A' ? matchData.poetAId : matchData.poetBId;
    const poemIds = sideKey === 'A' ? (matchData.poetAPoemIds || []) : (matchData.poetBPoemIds || []);
    const poet = poetById.get(poetId);
    if (!poet || !poet.poems || poemIds.length === 0) return [];
    return poemIds
      .map((id) => ({ id, ...(poet.poems[id] || {}) }))
      .filter((poem) => poem?.title);
  };

  const resolveVoteSide = (voteValue, matchData) => {
    if (!matchData) return null;
    const raw = String(voteValue || '').trim();
    if (!raw) return null;
    if (raw === 'A' || raw === 'B') return raw;
    const a = String(matchData.poetAId || '').trim();
    const b = String(matchData.poetBId || '').trim();
    if (!a || !b || a === b) return null;
    if (raw === a) return 'A';
    if (raw === b) return 'B';
    return null;
  };

  const openBattleModal = (match) => {
    if (!activeTournament) return;
    setBattleError('');
    setBattleModal(match);
    ensureTournamentMatch(activeTournament.id, match, {
      waitForAi: false,
      triggerAi: currentUser === 'maxim'
    }).catch((error) => {
      setBattleError(error?.message || 'Нельзя начать бой: не хватает участников');
    });
  };

  const openPlayInModal = () => {
    if (!activeTournament?.playIn || activeTournament.playIn.status !== 'active') return;
    setBattleError('');
    setBattleModal({ type: 'playIn' });
    ensureTournamentPlayIn(activeTournament.id, {}, {
      waitForAi: false,
      triggerAi: currentUser === 'maxim'
    }).catch((error) => {
      setBattleError(error?.message || 'Не удалось открыть дуэль за слот');
    });
  };

  const closeBattleModal = () => {
    setBattleModal(null);
    setBattleError('');
    setIsBattleSubmitting(false);
  };

  const handleVote = async (winnerPoetId, winnerSide) => {
    if (!activeTournament || !battleModal || !winnerPoetId) return;
    setIsBattleSubmitting(true);
    setBattleError('');
    try {
      if (battleModal.type === 'playIn') {
        await submitTournamentPlayInVote(activeTournament.id, currentUser, winnerPoetId, winnerSide);
      } else {
        await submitTournamentVote(activeTournament.id, battleModal, currentUser, winnerPoetId, winnerSide);
      }
    } catch (error) {
      setBattleError(error?.message || 'Не удалось сохранить голос');
    } finally {
      setIsBattleSubmitting(false);
    }
  };

  const getMatchKey = (match) =>
    match?.type === 'final'
      ? 'final'
      : `${match?.side || 'x'}_${match?.roundIndex ?? -1}_${match?.nodeIndex ?? -1}`;

  const handlePromoteWinner = async (match, winnerPoetId) => {
    if (!activeTournament || !match || !winnerPoetId) return;
    const key = getMatchKey(match);
    setPromotingMatchKey(key);
    setBattleError('');
    try {
      await promoteTournamentWinnerByBye(activeTournament.id, match, winnerPoetId);
    } catch (error) {
      setBattleError(error?.message || 'Не удалось перенести победителя');
    } finally {
      setPromotingMatchKey('');
    }
  };

  const renderRoundColumn = (side, logicalRoundIndex, visualKey) => {
    const nodeCount = sideSize / Math.pow(2, logicalRoundIndex + 1);
    const baseSlot = side === 'left' ? 0 : sideSize;

    return (
      <div
        key={`${side}-round-${visualKey}`}
        className={`tournament-round-column ${side === 'right' ? 'is-right' : ''}`}
      >
        <div className="tournament-round-list">
          {Array.from({ length: nodeCount }, (_, nodeIndex) => {
            const firstSlot = baseSlot + nodeIndex * 2;
            const groupRows = Math.pow(2, logicalRoundIndex + 1);
            const centerRow = nodeIndex * groupRows + groupRows / 2;
            const hasInConnector = logicalRoundIndex > 0;
            const hasOutConnector = true;
            const connectorSpan = groupRows * BRACKET_ROW_HEIGHT - BRACKET_CARD_HEIGHT;
            const match = {
              type: 'round',
              side,
              roundIndex: logicalRoundIndex,
              nodeIndex
            };
            const nodePoets = getMatchPoets(side, logicalRoundIndex, nodeIndex, firstSlot);
            const isReadyToBattle = nodePoets.filter(Boolean).length === 2;
            const isUpperBranch = nodeIndex % 2 === 0;
            const connectorMode = nodeCount === 1 ? 'is-straight' : (isUpperBranch ? 'is-upper' : 'is-lower');

            return (
              <div
                key={`${side}-round-${visualKey}-node-${nodeIndex}`}
                className={`tournament-round-node ${isReadyToBattle ? 'duel-ready' : ''}`}
                title={logicalRoundIndex === 0 ? 'Матч раунда' : 'Следующий раунд'}
                style={{
                  '--node-top': `${centerRow * BRACKET_ROW_HEIGHT - BRACKET_CARD_HEIGHT / 2}px`,
                  '--connector-span': `${connectorSpan}px`,
                  '--connector-half': `${(groupRows * BRACKET_ROW_HEIGHT) / 2}px`
                }}
              >
                {hasInConnector && (
                  <span className={`tournament-connector-in ${side === 'right' ? 'is-right' : ''}`} />
                )}
                <div className="tournament-round-node-body">
                  {renderMatchNodeContent(nodePoets, match, logicalRoundIndex === 0 ? firstSlot : null)}
                </div>
                {hasOutConnector && (
                  <span
                    className={`tournament-connector-out ${side === 'right' ? 'is-right' : ''} ${connectorMode}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const battleMatchData = battleModal ? getMatchData(battleModal) : null;
  const battlePoetA = battleMatchData?.poetAId ? (poetById.get(battleMatchData.poetAId) || null) : null;
  const battlePoetB = battleMatchData?.poetBId ? (poetById.get(battleMatchData.poetBId) || null) : null;
  const battlePoemsA = getPoemsForMatchSide(battleMatchData, 'A');
  const battlePoemsB = getPoemsForMatchSide(battleMatchData, 'B');
  const battleVotes = battleMatchData?.votes || {};
  const battleWinnerId = battleMatchData?.winnerPoetId || null;
  const isBattleRevealReady = Boolean(battleVotes.maxim && battleVotes.oleg && battleVotes.ai);
  const battleAiReason = battleVotes.aiReason || null;
  const isPlayInBattle = battleModal?.type === 'playIn';
  const activePlayIn = activeTournament?.playIn?.status === 'active' ? activeTournament.playIn : null;
  const activePlayInPoetA = activePlayIn?.poetAId ? (poetById.get(activePlayIn.poetAId) || null) : null;
  const activePlayInPoetB = activePlayIn?.poetBId ? (poetById.get(activePlayIn.poetBId) || null) : null;
  const hasCurrentUserPlayInVote = Boolean(activePlayIn?.votes?.[currentUser]);

  return (
    <div className="tournaments-page">
      {tournaments.length === 0 ? (
        <div className="empty-state">
          <img src="/images/poet2.png" alt="Нет турниров" className="empty-icon" />
          <p>Пока нет созданных турниров</p>
          <p className="empty-hint">Создайте турнир в админке</p>
        </div>
      ) : (
        <>
          <div className="tournament-controls sorting-controls likes-tabs-controls">
            <div className="tournament-tabs">
              {tournaments.map((tournament) => (
                <button
                  key={tournament.id}
                  className={`sort-btn ${activeTournamentId === tournament.id ? 'active' : ''}`}
                  onClick={() => setActiveTournamentId(tournament.id)}
                >
                  {tournament.name}
                </button>
              ))}
            </div>
            <button className="btn-add-poet" onClick={() => setShowAddParticipantModal(true)}>
              Добавить участника
            </button>
          </div>

          {activeTournament && (
            <>
              <div className="tournament-stage">
                <div
                  className="tournament-bracket"
                  style={{
                    '--side-height': `${sideSize * BRACKET_ROW_HEIGHT}px`,
                    '--connector-in-len': `${size === 16 ? 55 : 15}px`,
                    '--semifinal-final-len': `${size === 16 ? 21 : 11}px`
                  }}
                >
                  <div className="tournament-side tournament-side-left">
                    {Array.from({ length: roundsPerSide }, (_, i) => renderRoundColumn('left', i, i))}
                  </div>

                  <div className="tournament-center-column">
                    <div className="tournament-center-top">
                      {activeTournament.badge ? (
                        <img
                          src={`/images/badges/${activeBadgeFilename}`}
                          alt={activeTournament.name}
                          className="tournament-badge"
                          onError={(e) => {
                            e.currentTarget.src = '/images/badges/overall.png';
                          }}
                        />
                      ) : (
                        <div className="tournament-badge tournament-badge-placeholder">🏆</div>
                      )}
                    </div>

                    <div className="tournament-center-main-row">
                      {/* <div className="tournament-final-label">Финал</div> */}
                      <div className="tournament-final-node">
                        <div className="tournament-round-node-body">
                          {renderMatchNodeContent(finalPoets, { type: 'final' }, null)}
                        </div>
                      </div>
                    </div>

                    {winnerPoet && (
                      <div className="tournament-center-bottom">
                        <div
                          className="tournament-winner-node"
                          title={winnerPoemTitles.length > 0
                            ? `${winnerPoet.name}\nСтих: ${winnerPoemTitles[0]}`
                            : winnerPoet.name}
                        >
                          <img
                            src={winnerPoet.imageUrl || '/images/poet.png'}
                            alt={winnerPoet.name}
                            style={winnerPoet.imageUrl ? { objectPosition: `center ${winnerPoet.imagePositionY ?? 25}%` } : undefined}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="tournament-side tournament-side-right">
                    {Array.from({ length: roundsPerSide }, (_, i) =>
                      renderRoundColumn('right', roundsPerSide - 1 - i, i)
                    )}
                  </div>
                </div>
              </div>

              {activePlayIn && activePlayInPoetA && activePlayInPoetB && (
                <div className="active-playin-panel">
                  <div className="active-playin-title">Активная дуэль за место</div>
                  <div className="active-playin-subtitle">
                    {activePlayInPoetA.name} vs {activePlayInPoetB.name}
                  </div>
                  <button className="btn-add-poet" onClick={openPlayInModal}>
                    {hasCurrentUserPlayInVote ? 'Открыть дуэль' : 'Проголосовать в дуэли'}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {showAddParticipantModal && (
        <div className="modal-overlay" onClick={closeAddParticipantModal}>
          <div className="modal-content tournament-add-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeAddParticipantModal}>✕</button>
            <h2 className="modal-title">Добавить участника</h2>

            <div className="form-field">
              <label htmlFor="tournament-poet-search">Поэт</label>
              <input
                id="tournament-poet-search"
                type="text"
                value={participantQuery}
                onChange={(e) => {
                  setParticipantQuery(e.target.value);
                  setParticipantError('');
                }}
                className="form-input"
                placeholder="Начните вводить имя поэта"
              />
            </div>

            <div className="tournament-poet-search-list">
              {filteredPoets.map((poet) => (
                <button
                  key={poet.id}
                  className={`tournament-poet-option ${selectedPoetId === poet.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedPoetId(poet.id);
                    setParticipantQuery(poet.name);
                    setParticipantError('');
                    setSelectedPoemIds([]);
                  }}
                >
                  {poet.name}
                </button>
              ))}
            </div>

            {selectedPoet && (
              <div className="form-field">
                <label>Стих для участия (опционально)</label>
                <div className="tournament-poems-list">
                  {selectedPoetPoems.length === 0 ? (
                    <span className="empty-message">У поэта нет стихов</span>
                  ) : (
                    selectedPoetPoems.map((poem) => (
                      <label key={poem.id} className="tournament-poem-option">
                        <input
                          type="checkbox"
                          checked={selectedPoemIds[0] === poem.id}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPoemIds([poem.id]);
                            } else {
                              setSelectedPoemIds([]);
                            }
                          }}
                        />
                        <span>{poem.title}</span>
                        {poem.songUrl && (
                          <a href={poem.songUrl} target="_blank" rel="noreferrer" className="tournament-poem-song-link" title="Открыть песню" onClick={(e) => e.stopPropagation()}>
                            <Music4 size={13} />
                          </a>
                        )}
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}

            {participantError && <div className="field-error">{participantError}</div>}

            <div className="form-actions">
              <button className="btn-cancel" onClick={closeAddParticipantModal}>Отмена</button>
              <button className="btn-add-confirm" onClick={handleAddParticipant}>Добавить</button>
            </div>
          </div>
        </div>
      )}

      {battleModal && (
        <div className="battle-modal-overlay" onClick={closeBattleModal}>
          <div className="battle-modal tournament-duel-modal" onClick={(e) => e.stopPropagation()}>
            <button className="battle-close-btn" onClick={closeBattleModal}>✕</button>

            <div className="battle-header">
              <h2 className="battle-title">{isPlayInBattle ? 'ДУЭЛЬ ЗА МЕСТО' : 'ДУЭЛЬ'}</h2>
              <p className="battle-subtitle">
                {isPlayInBattle
                  ? <>Победитель занимает слот в турнире: <strong>{activeTournament?.name || 'Турнир'}</strong></>
                  : <>Выберите победителя в категории: <strong>{activeTournament?.name || 'Турнир'}</strong></>}
              </p>
            </div>

            {!battlePoetA || !battlePoetB ? (
              <div className="field-error">Матч пока не готов: нужно два участника.</div>
            ) : (() => {
              const currentUserVoted = !!battleVotes[currentUser];
              const renderPoetCard = (poet, side, poems) => {
                const sideKey = side === 'left' ? 'A' : 'B';
                const hasWinnerBySide = battleMatchData?.winnerSide === 'A' || battleMatchData?.winnerSide === 'B';
                const isWinner = isBattleRevealReady && (
                  hasWinnerBySide
                    ? battleMatchData?.winnerSide === sideKey
                    : String(battleWinnerId) === String(poet.id)
                );
                const isLoser = isBattleRevealReady && (
                  hasWinnerBySide
                    ? battleMatchData?.winnerSide !== sideKey
                    : (battleWinnerId && String(battleWinnerId) !== String(poet.id))
                );
                const nameParts = poet.name.split(' ');
                return (
                  <div className="tournament-duel-col">
                    <button
                      className={`battle-poet-card ${side}${isWinner ? ' duel-winner' : ''}${isLoser ? ' duel-loser' : ''}`}
                      onClick={() => {
                        if (currentUserVoted || isBattleSubmitting) return;
                        handleVote(poet.id, side === 'left' ? 'A' : 'B');
                      }}
                      style={{ cursor: currentUserVoted ? 'default' : 'pointer' }}
                    >
                      <div className="battle-poet-image">
                        {poet.imageUrl ? (
                          <>
                            <img
                              src={poet.imageUrl}
                              alt={poet.name}
                              style={{ objectPosition: `center ${poet.imagePositionY ?? 25}%` }}
                            />
                            <div className="battle-poet-overlay">
                              <h3 className="battle-poet-name">
                                {nameParts.length >= 2 ? (
                                  <><span className="first-name">{nameParts[0]}</span><br /><span className="last-name">{nameParts.slice(1).join(' ')}</span></>
                                ) : (
                                  <span className="last-name">{nameParts[0]}</span>
                                )}
                              </h3>
                            </div>
                          </>
                        ) : (
                          <div className="battle-poet-placeholder">
                            <img src="/images/poet.png" alt="Поэт" className="placeholder-icon" />
                            <h3 className="battle-poet-name">{poet.name}</h3>
                          </div>
                        )}
                      </div>
                    </button>
                    {poems.length > 0 && (
                      <div className="tournament-duel-poems">
                        {poems.map((poem) => (
                          <div key={poem.id} className="tournament-duel-poem">
                            {poem.url ? (
                              <a href={poem.url} target="_blank" rel="noreferrer" className="poem-card">{poem.title}</a>
                            ) : (
                              <span className="poem-card">{poem.title}</span>
                            )}
                            {poem.songUrl && (
                              <a href={poem.songUrl} target="_blank" rel="noreferrer" className="tournament-poem-song-link" title="Открыть песню">
                                <Music4 size={13} />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              };
              return (
                <>
                  <div className="battle-arena tournament-duel-arena">
                    {renderPoetCard(battlePoetA, 'left', battlePoemsA)}
                    <div className="battle-prize">
                      <img
                        src={`/images/badges/${activeBadgeFilename}`}
                        alt={activeTournament?.name}
                        className="battle-prize-icon"
                        onError={(e) => {
                          e.currentTarget.src = '/images/badges/overall.png';
                        }}
                      />
                    </div>
                    {renderPoetCard(battlePoetB, 'right', battlePoemsB)}
                  </div>

                  <div className="tournament-vote-section">
                    <p className="tournament-vote-label">Результаты голосования</p>
                    {(() => {
                      const voters = [
                        { key: 'maxim', label: 'Максим' },
                        { key: 'oleg', label: 'Олег' },
                        { key: 'ai', label: 'ИИ' },
                      ];
                      if (isBattleRevealReady) {
                        const leftVoters = voters.filter((v) => resolveVoteSide(battleVotes[v.key], battleMatchData) === 'A');
                        const rightVoters = voters.filter((v) => resolveVoteSide(battleVotes[v.key], battleMatchData) === 'B');
                        const leftScore = leftVoters.length;
                        const rightScore = rightVoters.length;
                        const renderBadge = ({ key, label }) => {
                          const badge = (
                            <div key={key} data-voter={key} className="tournament-voter-badge voted revealed">
                              <span className="tournament-voter-name">{label}</span>
                            </div>
                          );
                          if (key === 'ai' && battleAiReason) {
                            return <Tooltip key={key} text={battleAiReason}>{badge}</Tooltip>;
                          }
                          return badge;
                        };
                        return (
                          <div className="tournament-votes-revealed">
                            <div className="tournament-votes-side left">{leftVoters.map(renderBadge)}</div>
                            <div className="tournament-votes-score">
                              <span className={leftScore >= rightScore ? 'score-winner' : 'score-loser'}>{leftScore}</span>
                              <span className="score-sep">:</span>
                              <span className={rightScore >= leftScore ? 'score-winner' : 'score-loser'}>{rightScore}</span>
                            </div>
                            <div className="tournament-votes-side right">{rightVoters.map(renderBadge)}</div>
                          </div>
                        );
                      }
                      return (
                        <div className="tournament-vote-badges">
                          {voters.map(({ key, label }) => (
                            <div key={key} data-voter={key} className={`tournament-voter-badge${battleVotes[key] ? ' voted' : ''}`}>
                              <span className="tournament-voter-name">{label}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </>
              );
            })()}

            {battleError && <div className="field-error">{battleError}</div>}
          </div>
        </div>
      )}

      {contextMenu && (
        <div className="tournament-context-overlay" onClick={() => setContextMenu(null)}>
          <div
            className="tournament-context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            {contextMenu.canPromote && (
              <button
                className="tournament-context-item"
                onClick={() => {
                  setContextMenu(null);
                  handlePromoteWinner(contextMenu.match, contextMenu.poet.id);
                }}
              >
                Перенести в следующий этап
              </button>
            )}
            <button
              className="tournament-context-item danger"
              onClick={() => {
                setContextMenu(null);
                handleDeleteParticipant(contextMenu.participant);
              }}
              disabled={!contextMenu.participant?.id}
            >
              Удалить из турнира
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentsPage;
