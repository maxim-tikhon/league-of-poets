import React, { useState, useEffect, useRef } from 'react';
import { ref, set, onValue, remove, get, update } from 'firebase/database';
import { database } from '../firebase/config';
import './DuelGame.css';

const DuelGame = ({ poet1, poet2, category, currentUser, onGameEnd, onClose }) => {
  // Создаем уникальный ID игры на основе поэтов и категории
  // Сортируем ID поэтов, чтобы gameId был одинаковым для обоих игроков
  const poetIds = [poet1.id, poet2.id].sort();
  const [gameId] = useState(`duel_${category}_${poetIds[0]}_${poetIds[1]}`);
  
  const [gameState, setGameState] = useState(null);
  const [phase, setPhase] = useState('waiting'); // 'placing_pistol', 'placing_sabre', 'waiting_opponent', 'playing', 'finished'
  const [myPistolPosition, setMyPistolPosition] = useState(null);
  const [mySabrePosition, setMySabrePosition] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [isMusicMuted, setIsMusicMuted] = useState(false); // Состояние музыки
  
  const opponent = currentUser === 'maxim' ? 'oleg' : 'maxim';
  const TOTAL_CELLS = 25; // 5×5 grid
  const TRAP_CELLS_COUNT = 3; // Ловушки - заставляют ходить еще раз!
  const audioRef = useRef(null); // Реф для хранения аудио объекта
  
  // Определяем, кто создает игру (всегда 'maxim', чтобы избежать race condition)
  const isGameCreator = currentUser === 'maxim';

  // Инициализация игры
  useEffect(() => {
    const gameRef = ref(database, `duelGames/${gameId}`);
    let unsubscribe = null;
    
    // Создаем игру и подписываемся на изменения
    const initGame = async () => {
      // Добавляем задержку для второго игрока, чтобы избежать race condition
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Проверяем, существует ли игра
      const snapshot = await get(gameRef);
      const existingGame = snapshot.val();
      
      // Если игры нет, создаем новую
      // Если игра завершена - НЕ удаляем её автоматически, пусть игрок видит результат
      if (!existingGame) {
        // Ловушки, письмо и бомба будут сгенерированы позже,
        // после размещения всего оружия, чтобы не пересекались
        const trapCells = [];
        const loveLetterPos = -1; // Пока нет
        const bombPos = -1; // Пока нет

        // Определяем, кто ходит первым (случайно)
        const firstTurn = Math.random() < 0.5 ? 'maxim' : 'oleg';

        const initialGameState = {
          poet1Id: poet1.id,
          poet1Name: poet1.name,
          poet2Id: poet2.id,
          poet2Name: poet2.name,
          category,
          pistols: {
            maxim: -1,  // -1 вместо null (Firebase не сохраняет null)
            oleg: -1
          },
          // sabres НЕ создаём - будут созданы после размещения пистолетов
          trapCells,
          loveLetter: loveLetterPos,
          bomb: bombPos,
          hasLoveLetter: {
            maxim: false,
            oleg: false
          },
          loveLetterPickedBy: {
            maxim: -1,
            oleg: -1
          },
          defusedCells: {
            maxim: [], // Клетки, обезвреженные письмом (бомба/сабля)
            oleg: []
          },
          wounded: {
            maxim: null, // null или номер хода игрока, когда был ранен
            oleg: null
          },
          turnCount: 0, // Счетчик общих ходов
          playerTurns: { // Счетчик ходов каждого игрока
            maxim: 0,
            oleg: 0
          },
          currentTurn: firstTurn,
          // Отдельные массивы для клеток каждого игрока
          // Firebase удаляет пустые массивы, создадим при первом открытии
          status: 'waiting', // 'waiting', 'playing', 'finished'
          winner: null,
          createdAt: Date.now(),
          createdBy: currentUser // Кто создал игру
        };

        await set(gameRef, initialGameState);
      }
      
      // После создания игры подписываемся на изменения
      unsubscribe = onValue(gameRef, (snapshot) => {
        const data = snapshot.val();
        
        if (data) {
          setGameState(data);
          
          // Синхронизируем локальные позиции оружия с Firebase
          if (data.pistols && data.pistols[currentUser] >= 0) {
            setMyPistolPosition(data.pistols[currentUser]);
          }
          if (data.sabres && data.sabres[currentUser] >= 0) {
            setMySabrePosition(data.sabres[currentUser]);
          }
          
          // Автоматически переключаем статусы
          // Создаем sabres если их нет
          if (data.status === 'waiting' && data.pistols && 
              data.pistols.maxim >= 0 && data.pistols.oleg >= 0 && !data.sabres) {
            // Оба пистолета размещены → создаем объект для сабель
            set(ref(database, `duelGames/${gameId}/sabres`), { maxim: -1, oleg: -1 });
          }
          
          // Проверяем, все ли оружие размещено
          if (data.status === 'waiting' && data.pistols && data.sabres &&
              data.pistols.maxim >= 0 && data.pistols.oleg >= 0 &&
              data.sabres.maxim >= 0 && data.sabres.oleg >= 0) {
            // Все оружие размещено → генерируем ловушки, письмо, бомбу и начинаем игру
            
            // Собираем все занятые оружием клетки
            const occupiedCells = [
              data.pistols.maxim,
              data.pistols.oleg,
              data.sabres.maxim,
              data.sabres.oleg
            ].filter(pos => pos >= 0);
            
            // Генерируем ловушки (3 шт)
            const trapCells = [];
            const TRAP_COUNT = 3;
            while (trapCells.length < TRAP_COUNT) {
              const pos = Math.floor(Math.random() * TOTAL_CELLS);
              if (!occupiedCells.includes(pos) && !trapCells.includes(pos)) {
                trapCells.push(pos);
                occupiedCells.push(pos);
              }
            }
            
            // Генерируем позицию любовного письма
            let loveLetterPos = Math.floor(Math.random() * TOTAL_CELLS);
            while (occupiedCells.includes(loveLetterPos)) {
              loveLetterPos = Math.floor(Math.random() * TOTAL_CELLS);
            }
            occupiedCells.push(loveLetterPos);
            
            // Генерируем позицию бомбы
            let bombPos = Math.floor(Math.random() * TOTAL_CELLS);
            while (occupiedCells.includes(bombPos)) {
              bombPos = Math.floor(Math.random() * TOTAL_CELLS);
            }
            
            // Обновляем игру: добавляем ловушки, письмо, бомбу и начинаем играть
            update(ref(database, `duelGames/${gameId}`), {
              status: 'playing',
              trapCells: trapCells,
              loveLetter: loveLetterPos,
              bomb: bombPos
            });
            return;
          }
          
          // Определяем фазу игры для UI
          if (data.status === 'waiting') {
            // Во время ожидания показываем, что нужно разместить
            const myPistolPlaced = data.pistols && data.pistols[currentUser] >= 0;
            const mySabrePlaced = data.sabres && data.sabres[currentUser] >= 0;
            
            if (!myPistolPlaced) {
              setPhase('placing_pistol');
            } else if (!mySabrePlaced) {
              setPhase('placing_sabre');
            } else {
              setPhase('waiting_opponent'); // Оба оружия размещены, ждем соперника
            }
          } else if (data.status === 'playing') {
            setPhase('playing');
          } else if (data.status === 'finished') {
            setPhase('finished');
          }
        }
      });
    };

    initGame();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      // НЕ удаляем игру здесь - она может быть активна для другого игрока!
      // Игра автоматически очистится через TTL в Firebase или вручную
    };
  }, [gameId]);

  // Управление музыкой дуэли
  useEffect(() => {
    // Проигрываем музыку при открытии дуэли
    const playDuelMusic = () => {
      if (isMusicMuted) return;
      
      const audio = new Audio('/audio/duel-theme.wav');
      audio.volume = 0.5;
      audio.loop = true; // Музыка играет в цикле пока идёт дуэль
      audioRef.current = audio;
      
      audio.addEventListener('playing', () => {
        // Музыка начала играть
      });
      
      audio.addEventListener('error', () => {
        console.warn('Не удалось загрузить музыку дуэли');
      });
      
      audio.play().catch(err => {
        console.warn('Не удалось запустить музыку дуэли:', err);
      });
    };
    
    playDuelMusic();
    
    // Останавливаем музыку при размонтировании компонента
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
    };
  }, [isMusicMuted]);

  // Функция переключения музыки
  const toggleMusic = () => {
    if (isMusicMuted) {
      // Включаем музыку
      setIsMusicMuted(false);
    } else {
      // Выключаем музыку
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsMusicMuted(true);
    }
  };

  // Размещение пистолета
  const placePistol = async (position) => {
    if (myPistolPosition !== null) return; // Уже поставили
    
    setMyPistolPosition(position);
    
    // Обновляем позицию пистолета в Firebase
    await set(ref(database, `duelGames/${gameId}/pistols/${currentUser}`), position);
  };
  
  // Размещение сабли
  const placeSabre = async (position) => {
    if (mySabrePosition !== null) return; // Уже поставили
    if (position === myPistolPosition) return; // Нельзя на пистолет
    
    setMySabrePosition(position);
    
    // Обновляем позицию сабли в Firebase
    await set(ref(database, `duelGames/${gameId}/sabres/${currentUser}`), position);
  };

  // Открытие клетки
  const openCell = async (position) => {
    if (!gameState || !('pistols' in gameState)) return;
    if (phase !== 'playing') return;
    if (gameState.currentTurn !== currentUser) return; // Не наш ход
    
    // Читаем актуальные данные ПРЯМО ИЗ FIREBASE перед записью
    const gameRef = ref(database, `duelGames/${gameId}`);
    const freshSnapshot = await get(gameRef);
    const freshData = freshSnapshot.val();
    
    if (!freshData) return;
    
    // Преобразуем в массивы и фильтруем -1
    const maximOpenedCells = freshData.maximOpenedCells && Array.isArray(freshData.maximOpenedCells)
      ? freshData.maximOpenedCells.filter(cell => cell >= 0) 
      : [];
    const olegOpenedCells = freshData.olegOpenedCells && Array.isArray(freshData.olegOpenedCells)
      ? freshData.olegOpenedCells.filter(cell => cell >= 0) 
      : [];
    const allOpenedCells = [...maximOpenedCells, ...olegOpenedCells];
    const trapCells = Array.isArray(freshData.trapCells) ? freshData.trapCells : [];
    
    if (allOpenedCells.includes(position)) return; // Уже открыта
    if (position === myPistolPosition || position === mySabrePosition) return; // Свои оружие нельзя открыть
    
    // Добавляем клетку в массив открытых клеток текущего игрока
    const myOpenedCells = currentUser === 'maxim' ? maximOpenedCells : olegOpenedCells;
    const newMyOpenedCells = [...myOpenedCells, position];
    await set(ref(database, `duelGames/${gameId}/${currentUser}OpenedCells`), newMyOpenedCells);
    
    // Увеличиваем счетчик ходов (общий и персональный)
    const newTurnCount = (freshData.turnCount || 0) + 1;
    await set(ref(database, `duelGames/${gameId}/turnCount`), newTurnCount);
    
    // Увеличиваем персональный счетчик ходов текущего игрока
    const playerTurns = freshData.playerTurns || { maxim: 0, oleg: 0 };
    const newPlayerTurnCount = (playerTurns[currentUser] || 0) + 1;
    await set(ref(database, `duelGames/${gameId}/playerTurns/${currentUser}`), newPlayerTurnCount);
    
    // Проверяем, не подобрали ли любовное письмо
    const loveLetterPickedBy = freshData.loveLetterPickedBy || { maxim: -1, oleg: -1 };
    const isLoveLetter = freshData.loveLetter === position && 
                         loveLetterPickedBy.maxim !== position && 
                         loveLetterPickedBy.oleg !== position;
    if (isLoveLetter) {
      // Подобрали любовное письмо!
      await set(ref(database, `duelGames/${gameId}/hasLoveLetter/${currentUser}`), true);
      // Запоминаем, откуда было подобрано письмо
      await set(ref(database, `duelGames/${gameId}/loveLetterPickedBy/${currentUser}`), position);
      
      // Если ранен - лечим
      if (freshData.wounded && typeof freshData.wounded[currentUser] === 'number') {
        await set(ref(database, `duelGames/${gameId}/wounded/${currentUser}`), null);
      }
    }

    // Проверяем, попали ли в пистолет соперника
    const opponentPistol = freshData.pistols && freshData.pistols[opponent];
    if (opponentPistol >= 0 && position === opponentPistol) {
      // Попали в пистолет! Мгновенная смерть (письмо НЕ спасает!)
      await set(ref(database, `duelGames/${gameId}/status`), 'finished');
      await set(ref(database, `duelGames/${gameId}/winner`), opponent);
      return;
    }
    
    // Проверяем, попали ли в бомбу
    const bombPosition = freshData.bomb;
    if (bombPosition >= 0 && position === bombPosition) {
      // Попали в бомбу!
      const hasLetter = freshData.hasLoveLetter && freshData.hasLoveLetter[currentUser];
      
      if (hasLetter) {
        // Любовное письмо спасло от взрыва! Используем его
        await set(ref(database, `duelGames/${gameId}/hasLoveLetter/${currentUser}`), false);
        await set(ref(database, `duelGames/${gameId}/bomb`), -1); // Бомба взорвалась
        
        // Сохраняем, что эта клетка была обезврежена письмом
        const defusedCells = freshData.defusedCells || { maxim: [], oleg: [] };
        const currentDefused = Array.isArray(defusedCells[currentUser]) ? defusedCells[currentUser] : [];
        await set(ref(database, `duelGames/${gameId}/defusedCells/${currentUser}`), [...currentDefused, position]);
        
        // Продолжаем игру
      } else {
        // Нет письма - взрыв! Проиграли
        await set(ref(database, `duelGames/${gameId}/status`), 'finished');
        await set(ref(database, `duelGames/${gameId}/winner`), opponent);
        return;
      }
    }
    
    // Проверяем, попали ли в саблю соперника
    const opponentSabre = freshData.sabres && freshData.sabres[opponent];
    if (opponentSabre >= 0 && position === opponentSabre) {
      // Попали в саблю!
      const hasLetter = freshData.hasLoveLetter && freshData.hasLoveLetter[currentUser];
      
      if (hasLetter) {
        // Любовное письмо защитило от ранения! Используем его
        await set(ref(database, `duelGames/${gameId}/hasLoveLetter/${currentUser}`), false);
        
        // Сохраняем, что эта клетка (сабля) была обезврежена письмом
        const defusedCells = freshData.defusedCells || { maxim: [], oleg: [] };
        const currentDefused = Array.isArray(defusedCells[currentUser]) ? defusedCells[currentUser] : [];
        await set(ref(database, `duelGames/${gameId}/defusedCells/${currentUser}`), [...currentDefused, position]);
        
        // Продолжаем игру без ранения
      } else {
        // Ранены! Запоминаем текущий счетчик ходов ЭТОГО игрока
        await set(ref(database, `duelGames/${gameId}/wounded/${currentUser}`), newPlayerTurnCount);
      }
    }
    
    // Проверяем, не умер ли игрок от ранения (прошло 3 его хода)
    if (freshData.wounded && typeof freshData.wounded[currentUser] === 'number') {
      const woundedAtTurn = freshData.wounded[currentUser];
      const playerTurnsSinceWound = newPlayerTurnCount - woundedAtTurn;
      
      if (playerTurnsSinceWound >= 3) {
        // Умер от ран после 3 своих ходов!
        await set(ref(database, `duelGames/${gameId}/status`), 'finished');
        await set(ref(database, `duelGames/${gameId}/winner`), opponent);
        return;
      }
    }

    // Проверяем, это клетка-ловушка?
    const isTrapCell = trapCells.includes(position);
    
    if (isTrapCell) {
      // Ловушка! Придётся ходить ещё раз (ход остаётся за нами)
      // Ничего не делаем, currentTurn не меняем
    } else {
      // Обычная клетка - передаём ход сопернику
      await set(ref(database, `duelGames/${gameId}/currentTurn`), opponent);
    }
  };

  // Обработка завершения игры
  const handleClose = async () => {
    if (phase === 'finished' && gameState) {
      const winner = gameState.winner;
      if (winner) {
        // Определяем поэта-победителя по тому, кто выиграл игру
        const winnerPoet = winner === 'maxim' ? poet1 : poet2;
        
        // Удаляем завершенную игру из Firebase перед закрытием
        const gameRef = ref(database, `duelGames/${gameId}`);
        await remove(gameRef);
        
        onGameEnd(winnerPoet);
        return;
      }
    }
    onClose();
  };

  // Рендер поля
  const renderGrid = () => {
    // Защита от undefined - проверяем только обязательные ключи
    // trapCells, loveLetter, bomb могут быть еще не сгенерированы (они создаются после размещения оружия)
    if (!gameState || !('pistols' in gameState)) {
      return null;
    }
    
    // Преобразуем в массивы, если Firebase вернул null или объект
    const maximOpenedCells = gameState.maximOpenedCells && Array.isArray(gameState.maximOpenedCells)
      ? gameState.maximOpenedCells.filter(cell => cell >= 0) 
      : [];
    const olegOpenedCells = gameState.olegOpenedCells && Array.isArray(gameState.olegOpenedCells)
      ? gameState.olegOpenedCells.filter(cell => cell >= 0) 
      : [];
    const trapCells = Array.isArray(gameState.trapCells) ? gameState.trapCells : [];
    
    const cells = [];
    for (let i = 0; i < TOTAL_CELLS; i++) {
      const isOpenedByMaxim = maximOpenedCells.includes(i);
      const isOpenedByOleg = olegOpenedCells.includes(i);
      const isOpened = isOpenedByMaxim || isOpenedByOleg;
      const isMyPistol = i === myPistolPosition;
      const isMySabre = i === mySabrePosition;
      const isOpponentPistol = gameState.pistols && gameState.pistols[opponent] >= 0 && i === gameState.pistols[opponent] && (phase === 'finished' || isOpened);
      const isOpponentSabre = gameState.sabres && gameState.sabres[opponent] >= 0 && i === gameState.sabres[opponent] && (phase === 'finished' || isOpened);
      const isTrap = trapCells.includes(i) && isOpened;
      
      // Письмо видно, если оно еще на поле или кто-то подобрал его с этой позиции
      const loveLetterPickedBy = gameState.loveLetterPickedBy || {};
      const isLoveLetter = isOpened && (
        gameState.loveLetter === i || 
        loveLetterPickedBy.maxim === i || 
        loveLetterPickedBy.oleg === i
      );
      
      const isBomb = gameState.bomb >= 0 && gameState.bomb === i && isOpened;
      
      // Проверяем, была ли клетка обезврежена письмом
      const defusedCells = gameState.defusedCells || { maxim: [], oleg: [] };
      const maximDefused = Array.isArray(defusedCells.maxim) ? defusedCells.maxim : [];
      const olegDefused = Array.isArray(defusedCells.oleg) ? defusedCells.oleg : [];
      const isDefusedByMaxim = maximDefused.includes(i);
      const isDefusedByOleg = olegDefused.includes(i);
      const isDefused = isDefusedByMaxim || isDefusedByOleg;
      
      const canClick = 
        (phase === 'placing_pistol' && myPistolPosition === null) ||
        (phase === 'placing_sabre' && mySabrePosition === null && i !== myPistolPosition) ||
        (phase === 'playing' && gameState.currentTurn === currentUser && !isOpened && i !== myPistolPosition && i !== mySabrePosition);

      let cellClass = 'duel-cell';
      if (isOpened) cellClass += ' opened';
      if (isOpenedByMaxim) cellClass += ' opened-by-maxim';
      if (isOpenedByOleg) cellClass += ' opened-by-oleg';
      
      // Моё оружие
      if (isMyPistol) {
        cellClass += ' my-pistol';
        if (isOpened) cellClass += ' opponent-weapon-revealed'; // Соперник нашел мой пистолет!
      }
      if (isMySabre) {
        cellClass += ' my-sabre';
        if (isOpened) cellClass += ' opponent-weapon-revealed'; // Соперник нашел мою саблю!
      }
      
      // Оружие соперника
      if (isOpponentPistol) {
        cellClass += ' opponent-pistol';
        if (isOpened) cellClass += ' opponent-weapon-revealed'; // Я нашел пистолет соперника
      }
      if (isOpponentSabre) {
        cellClass += ' opponent-sabre';
        if (isOpened) cellClass += ' opponent-weapon-revealed'; // Я нашел саблю соперника
      }
      
      if (isTrap) cellClass += ' trap';
      if (isLoveLetter) cellClass += ' love-letter';
      if (isBomb) cellClass += ' bomb';
      if (isDefused) cellClass += ' defused'; // Обезврежено письмом
      if (canClick) cellClass += ' clickable';
      if (selectedCell === i) cellClass += ' selected';

      let cellContent = '';
      if (phase === 'placing_pistol') {
        if (isMyPistol) cellContent = '🔫';
      } else if (phase === 'placing_sabre' || phase === 'waiting_opponent') {
        if (isMyPistol) cellContent = '🔫';
        if (isMySabre) cellContent = '🗡';
      } else {
        // Сначала проверяем, открыта ли клетка соперником
        if (isOpened) {
          // Если это моё оружие И оно открыто соперником
          if (isMyPistol) {
            cellContent = '🔫💥'; // Соперник нашел мой пистолет!
          } else if (isMySabre) {
            cellContent = isDefused ? '🗡💌' : '🗡💀'; // Обезврежена письмом или нет
          } else if (isBomb) {
            cellContent = isDefused ? '💣💌' : '💣'; // Обезврежена письмом или нет
          } else if (isLoveLetter) {
            cellContent = '💌';
          } else if (isTrap) {
            cellContent = '🕸️';
          } else if (isOpponentPistol) {
            cellContent = '🔫💥'; // Я нашел пистолет соперника
          } else if (isOpponentSabre) {
            cellContent = isDefused ? '🗡💌' : '🗡💀'; // Обезврежена письмом или нет
          } else {
            cellContent = '✓';
          }
        } else {
          // Клетка не открыта - показываем моё оружие
          if (isMyPistol) {
            cellContent = '🔫';
          } else if (isMySabre) {
            cellContent = '🗡';
          }
        }
      }

      cells.push(
        <div
          key={i}
          className={cellClass}
          onClick={() => {
            if (phase === 'placing_pistol' && myPistolPosition === null) {
              placePistol(i);
            } else if (phase === 'placing_sabre' && mySabrePosition === null && i !== myPistolPosition) {
              placeSabre(i);
            } else if (phase === 'playing' && canClick) {
              openCell(i);
            }
          }}
          onMouseEnter={() => canClick && setSelectedCell(i)}
          onMouseLeave={() => setSelectedCell(null)}
        >
          <span className="cell-content">{cellContent}</span>
        </div>
      );
    }
    return cells;
  };

  // Показываем загрузку, пока игра не создана
  if (!gameState) {
    return (
      <div className="duel-game-overlay">
        <div className="duel-game-container">
          <h2>⏳ Создание игры...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="duel-game-overlay">
      <div className="duel-game-container">
        <button className="close-duel-btn" onClick={handleClose} title="Закрыть">✕</button>
        <button 
          className="toggle-music-btn" 
          onClick={toggleMusic} 
          title={isMusicMuted ? "Включить музыку" : "Выключить музыку"}
        >
          {isMusicMuted ? '🔇' : '🎵'}
        </button>
        <div className="duel-game-header">
          <h2>⚔️ Дуэль: {category} ⚔️</h2>
          <p className="duel-poets">
            <span className="poet-maxim">{poet1.name}</span>
            {' VS '}
            <span className="poet-oleg">{poet2.name}</span>
          </p>
        </div>

        {phase === 'placing_pistol' && (
          <div className="duel-instructions">
            <p>🔫 Разместите свой пистолет на поле</p>
            <p className="hint">Попадание в него = мгновенная смерть</p>
          </div>
        )}
        
        {phase === 'placing_sabre' && (
          <div className="duel-instructions">
            <p>🗡 Разместите свою саблю на поле</p>
            <p className="hint">Попадание в неё = ранение (смерть через 3 хода или спасет письмо)</p>
          </div>
        )}
        
        {phase === 'waiting_opponent' && gameState && (
          <div className="duel-instructions">
            <p>⏳ Ожидание соперника...</p>
            <p className="hint">
              {(() => {
                const opponentPistolPlaced = gameState.pistols && gameState.pistols[opponent] >= 0;
                const opponentSabrePlaced = gameState.sabres && gameState.sabres[opponent] >= 0;
                
                if (!opponentPistolPlaced && !opponentSabrePlaced) {
                  return 'Соперник размещает пистолет и саблю';
                } else if (!opponentPistolPlaced) {
                  return 'Соперник размещает пистолет';
                } else if (!opponentSabrePlaced) {
                  return 'Соперник размещает саблю';
                } else {
                  return 'Ожидание начала игры...';
                }
              })()}
            </p>
          </div>
        )}

        {phase === 'playing' && gameState && (
          <div className="duel-instructions">
            {gameState.currentTurn === currentUser ? (
              <>
                <p className="your-turn">🎯 Ваш ход!</p>
                <p className="hint">
                  💥 Пистолет = смерть | 💣 Бомба = смерть | ⚔️ Сабля = ранение | 💌 Письмо = спасение | 🕸️ Ловушка = доп.ход
                </p>
              </>
            ) : (
              <>
                <p className="opponent-turn">⏳ Ход соперника...</p>
                <p className="hint">Ожидайте хода {opponent === 'maxim' ? 'Максима' : 'Олега'}</p>
              </>
            )}
          </div>
        )}

        {phase === 'finished' && gameState && (
          <div className="duel-result">
            {gameState.winner === currentUser ? (
              <h3 className="winner">🕊️ Он рифмовал — и победил</h3>
            ) : gameState.winner === opponent ? (
              <h3 className="loser">💥 Он был хорош… пока не встретил соперника получше</h3>
            ) : (
              <h3 className="draw">🤝 Ничья!</h3>
            )}
          </div>
        )}

        <div className="game-field-wrapper">
          <div className="duel-grid">
            {renderGrid()}
          </div>
          
          {phase === 'playing' && gameState && (
            <div className="field-status">
              {/* Информация о текущем игроке */}
              <div className={`status-compact player-info ${currentUser}`}>
                <div className={`player-color-indicator ${currentUser}`}></div>
                <span className="status-text-compact">
                  {currentUser === 'maxim' ? poet1.name : poet2.name}
                </span>
              </div>
              
              <div className={`status-compact ${gameState.wounded && typeof gameState.wounded[currentUser] === 'number' ? 'wounded' : 'healthy'}`}>
                <span className="status-icon-compact">
                  {gameState.wounded && typeof gameState.wounded[currentUser] === 'number' ? '🩸' : '💚'}
                </span>
                <span className="status-text-compact">
                  {gameState.wounded && typeof gameState.wounded[currentUser] === 'number' ? (
                    (() => {
                      const playerTurns = gameState.playerTurns || { maxim: 0, oleg: 0 };
                      const currentPlayerTurns = playerTurns[currentUser] || 0;
                      const woundedAtTurn = gameState.wounded[currentUser];
                      const turnsLeft = 3 - (currentPlayerTurns - woundedAtTurn);
                      return `Ранен (${turnsLeft})`;
                    })()
                  ) : (
                    'Здоров'
                  )}
                </span>
              </div>
              
              <div className={`status-compact ${gameState.hasLoveLetter && gameState.hasLoveLetter[currentUser] ? 'has-letter' : 'no-letter'}`}>
                <span className="status-icon-compact">
                  {gameState.hasLoveLetter && gameState.hasLoveLetter[currentUser] ? '💌' : '📭'}
                </span>
                <span className="status-text-compact">
                  {gameState.hasLoveLetter && gameState.hasLoveLetter[currentUser] ? 'Письмо' : 'Нет письма'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DuelGame;

