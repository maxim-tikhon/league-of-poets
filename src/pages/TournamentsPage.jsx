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
  const [contextMenu, setContextMenu] = useState(null); // { x, y, poet, match, canPromote }

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
    const addedIds = new Set(participants.map((p) => String(p.poetId)));
    const query = participantQuery.trim().toLowerCase();
    const available = poets.filter((p) => !addedIds.has(String(p.id)));
    if (!query) return available.slice(0, 10);
    return available
      .filter((p) => p.name?.toLowerCase().includes(query))
      .slice(0, 12);
  }, [poets, participantQuery, participants]);

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

    const alreadyInTournament = participants.some((p) => String(p.poetId) === String(selectedPoetId));
    if (alreadyInTournament) {
      setParticipantError('Этот поэт уже участвует в турнире');
      return;
    }

    try {
      await addTournamentParticipant(activeTournament.id, {
        poetId: selectedPoetId,
        poemIds: selectedPoemIds
      });
      closeAddParticipantModal();
    } catch (error) {
      console.error('Ошибка добавления участника:', error);
      setParticipantError('Не удалось добавить участника');
    }
  };

  const getPoetBySlot = (slot) => {
    const participant = slotToParticipant.get(slot);
    if (!participant) return null;
    return poetById.get(participant.poetId) || null;
  };

  const handleDeleteParticipant = async (poetId) => {
    if (!activeTournament || !poetId) return;

    const participant = participants.find((item) => String(item.poetId) === String(poetId));
    if (!participant?.id) {
      setBattleError('Этого поэта нельзя удалить из сетки: он уже в результатах раундов.');
      return;
    }

    const poetName = poetById.get(poetId)?.name || 'участника';
    const confirmed = window.confirm(`Удалить ${poetName} из турнира?`);
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

  const renderPoetSquare = (poet, key, matchCtx = null) => (
    <div
      key={key}
      className={`tournament-poet-square ${poet ? 'filled' : ''}`}
      title={poet ? poet.name : 'Свободный слот'}
      onContextMenu={(e) => {
        if (!poet) return;
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, poet, match: matchCtx?.match || null, canPromote: matchCtx?.canPromote || false });
      }}
    >
      <img
        src={poet?.imageUrl || '/images/poet.png'}
        alt={poet?.name || 'Свободный слот'}
        style={poet?.imageUrl ? { objectPosition: `center ${poet.imagePositionY ?? 25}%` } : undefined}
      />
    </div>
  );

  const renderMatchNodeContent = (poets, match) => {
    const filledPoets = poets.filter(Boolean);
    const matchData = getMatchData(match);

    if (filledPoets.length === 0) {
      return <div className="tournament-match-empty" />;
    }

    if (filledPoets.length === 1) {
      const alreadyPromoted = matchData?.status === 'finished';
      return (
        <div className="tournament-match-content one-poet">
          {renderPoetSquare(filledPoets[0], 'single', { match, canPromote: !alreadyPromoted })}
        </div>
      );
    }

    const votes = matchData?.votes || {};
    const isFinished = Boolean(matchData?.status === 'finished' && matchData?.winnerPoetId);
    const leftPoetId = filledPoets[0]?.id;
    const rightPoetId = filledPoets[1]?.id;

    let leftScore = Object.values(votes).filter((id) => id === leftPoetId).length;
    let rightScore = Object.values(votes).filter((id) => id === rightPoetId).length;
    if (isFinished && leftScore === 0 && rightScore === 0) {
      if (matchData.winnerPoetId === leftPoetId) {
        leftScore = 1;
      } else if (matchData.winnerPoetId === rightPoetId) {
        rightScore = 1;
      }
    }

    return (
      <div className="tournament-match-content two-poets">
        {renderPoetSquare(filledPoets[0], 'left')}
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
        {renderPoetSquare(filledPoets[1], 'right')}
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

  const openBattleModal = (match) => {
    if (!activeTournament) return;
    setBattleError('');
    setBattleModal(match);
    ensureTournamentMatch(activeTournament.id, match, { waitForAi: false }).catch((error) => {
      setBattleError(error?.message || 'Нельзя начать бой: не хватает участников');
    });
  };

  const closeBattleModal = () => {
    setBattleModal(null);
    setBattleError('');
    setIsBattleSubmitting(false);
  };

  const handleVote = async (winnerPoetId) => {
    if (!activeTournament || !battleModal || !winnerPoetId) return;
    setIsBattleSubmitting(true);
    setBattleError('');
    try {
      await submitTournamentVote(activeTournament.id, battleModal, currentUser, winnerPoetId);
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
                  {renderMatchNodeContent(nodePoets, match)}
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
                        src={`/images/badges/${activeTournament.badge}`}
                        alt={activeTournament.name}
                        className="tournament-badge"
                      />
                    ) : (
                      <div className="tournament-badge tournament-badge-placeholder">🏆</div>
                    )}
                  </div>

                  <div className="tournament-center-main-row">
                    {/* <div className="tournament-final-label">Финал</div> */}
                    <div className="tournament-final-node">
                      <div className="tournament-round-node-body">
                        {renderMatchNodeContent(finalPoets, { type: 'final' })}
                      </div>
                    </div>
                  </div>

                  {winnerPoet && (
                    <div className="tournament-center-bottom">
                      <div className="tournament-winner-label">Победитель</div>
                      <div className="tournament-winner-node" title={winnerPoet.name}>
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
                <label>Стихи для участия (опционально)</label>
                <div className="tournament-poems-list">
                  {selectedPoetPoems.length === 0 ? (
                    <span className="empty-message">У поэта нет стихов</span>
                  ) : (
                    selectedPoetPoems.map((poem) => (
                      <label key={poem.id} className="tournament-poem-option">
                        <input
                          type="checkbox"
                          checked={selectedPoemIds.includes(poem.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPoemIds((prev) => [...prev, poem.id]);
                            } else {
                              setSelectedPoemIds((prev) => prev.filter((id) => id !== poem.id));
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
              <h2 className="battle-title">ДУЭЛЬ</h2>
              <p className="battle-subtitle">
                Выберите победителя в категории: <strong>{activeTournament?.name || 'Турнир'}</strong>
              </p>
            </div>

            {!battlePoetA || !battlePoetB ? (
              <div className="field-error">Матч пока не готов: нужно два участника.</div>
            ) : (() => {
              const currentUserVoted = !!battleVotes[currentUser];
              const renderPoetCard = (poet, side, poems) => {
                const isWinner = isBattleRevealReady && String(battleWinnerId) === String(poet.id);
                const isLoser = isBattleRevealReady && battleWinnerId && String(battleWinnerId) !== String(poet.id);
                const nameParts = poet.name.split(' ');
                return (
                  <div className="tournament-duel-col">
                    <button
                      className={`battle-poet-card ${side}${isWinner ? ' duel-winner' : ''}${isLoser ? ' duel-loser' : ''}`}
                      onClick={() => { if (!currentUserVoted && !isBattleSubmitting) handleVote(poet.id); }}
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
                        src={`/images/badges/${activeTournament?.badge || 'overall.png'}`}
                        alt={activeTournament?.name}
                        className="battle-prize-icon"
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
                        const leftVoters = voters.filter(v => String(battleVotes[v.key]) === String(battlePoetA.id));
                        const rightVoters = voters.filter(v => String(battleVotes[v.key]) === String(battlePoetB.id));
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
                handleDeleteParticipant(contextMenu.poet.id);
              }}
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
