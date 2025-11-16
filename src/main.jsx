import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { applyTheme, getCurrentTheme } from './themes'
import './index.css'

// Применяем сохраненную тему при загрузке
applyTheme(getCurrentTheme());

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

