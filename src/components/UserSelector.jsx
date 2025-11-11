import React, { useState } from 'react';
import './UserSelector.css';

const UserSelector = ({ onSelectUser }) => {
  const [selectedUser, setSelectedUser] = useState('');

  const handleSelect = (user) => {
    setSelectedUser(user);
  };

  const handleConfirm = () => {
    if (selectedUser) {
      localStorage.setItem('currentUser', selectedUser);
      onSelectUser(selectedUser);
    }
  };

  return (
    <div className="user-selector-overlay">
      <div className="user-selector-modal">
        <h1 className="user-selector-title">
          <span className="title-icon">📜</span>
          League of Poets
        </h1>
        <h2 className="user-selector-subtitle">Выберите пользователя</h2>
        
        <div className="user-buttons">
          <button
            className={`user-btn ${selectedUser === 'maxim' ? 'selected' : ''}`}
            onClick={() => handleSelect('maxim')}
          >
            <span className="user-icon">🧟‍♂️</span>
            <span className="user-name">Максим</span>
          </button>
          
          <button
            className={`user-btn ${selectedUser === 'oleg' ? 'selected' : ''}`}
            onClick={() => handleSelect('oleg')}
          >
            <span className="user-icon">🧛‍♂️</span>
            <span className="user-name">Олег</span>
          </button>
        </div>
        
        <button
          className="confirm-btn"
          onClick={handleConfirm}
          disabled={!selectedUser}
        >
          Продолжить
        </button>
      </div>
    </div>
  );
};

export default UserSelector;

