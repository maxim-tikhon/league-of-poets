import React, { useState } from 'react';
import './UserSelector.css';
import { USERS, USER_LABELS } from '../constants';

const UserSelector = ({ onSelectUser }) => {
  const ACCESS_WORD = 'пушкин';
  const [selectedUser, setSelectedUser] = useState('');
  const [accessWord, setAccessWord] = useState('');
  const [accessError, setAccessError] = useState('');

  const handleSelect = (user) => {
    setSelectedUser(user);
  };

  const handleConfirm = () => {
    if (!selectedUser) return;

    if (accessWord.trim().toLowerCase() !== ACCESS_WORD) {
      setAccessError('Неверное кодовое слово');
      return;
    }

    localStorage.setItem('currentUser', selectedUser);
    onSelectUser(selectedUser);
  };

  return (
    <div className="user-selector-overlay">
      <div className="user-selector-modal">
        <div className="user-selector-header">
          <img src="/images/logo.png" alt="Лига Поэтов" className="selector-logo" />
          <h1 className="user-selector-title">Лига Поэтов</h1>
        </div>
        <h2 className="user-selector-subtitle">Выберите пользователя</h2>
        
        <div className="user-buttons">
          {USERS.map((user) => (
            <button
              key={user}
              className={`user-btn user-btn-${user} ${selectedUser === user ? 'selected' : ''}`}
              onClick={() => handleSelect(user)}
            >
              <span className="user-name">{USER_LABELS[user]}</span>
            </button>
          ))}
        </div>

        <div className="user-access-row">
          <input
            value={accessWord}
            onChange={(e) => {
              setAccessWord(e.target.value);
              if (accessError) setAccessError('');
            }}
            className="user-access-input"
            placeholder="Кодовое слово"
          />
          {accessError && <div className="user-access-error">{accessError}</div>}
        </div>
        
        <button
          className="confirm-btn"
          onClick={handleConfirm}
          disabled={!selectedUser || !accessWord.trim()}
        >
          Продолжить
        </button>
      </div>
    </div>
  );
};

export default UserSelector;

