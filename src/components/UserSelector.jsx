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
        <div className="user-selector-header">
          <img src="/images/logo2.png" alt="Лига Поэтов" className="selector-logo" />
          <h1 className="user-selector-title">Лига Поэтов</h1>
        </div>
        <h2 className="user-selector-subtitle">Выберите пользователя</h2>
        
        <div className="user-buttons">
          <button
            className={`user-btn ${selectedUser === 'maxim' ? 'selected' : ''}`}
            onClick={() => handleSelect('maxim')}
          >
            <span className="user-name">Максим</span>
          </button>
          
          <button
            className={`user-btn ${selectedUser === 'oleg' ? 'selected' : ''}`}
            onClick={() => handleSelect('oleg')}
          >
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

