import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { PoetsProvider } from './context/PoetsContext';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import PoetsPage from './pages/PoetsPage';
import PoetDetailPage from './pages/PoetDetailPage';
import MaximRankingPage from './pages/MaximRankingPage';
import OlegRankingPage from './pages/OlegRankingPage';
import OverallRankingPage from './pages/OverallRankingPage';
import UserSelector from './components/UserSelector';
import './App.css';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Проверяем, выбран ли пользователь ранее
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      setCurrentUser(savedUser);
    }
    setIsChecking(false);
  }, []);

  const handleSelectUser = (user) => {
    setCurrentUser(user);
  };

  if (isChecking) {
    return <div>Загрузка...</div>;
  }

  if (!currentUser) {
    return <UserSelector onSelectUser={handleSelectUser} />;
  }

  return (
    <PoetsProvider>
      <Router>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<PoetsPage />} />
            <Route path="poet/:id" element={<PoetDetailPage />} />
            <Route path="maxim-ranking" element={<MaximRankingPage />} />
            <Route path="oleg-ranking" element={<OlegRankingPage />} />
            <Route path="overall-ranking" element={<OverallRankingPage />} />
          </Route>
        </Routes>
      </Router>
    </PoetsProvider>
  );
}

export default App;

