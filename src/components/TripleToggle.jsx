import React from 'react';
import './TripleToggle.css';

const TripleToggle = ({ options, value, onChange, className = '' }) => {
  const activeIndex = options.findIndex((opt) => opt.value === value);
  const safeIndex = activeIndex >= 0 ? activeIndex : 0;

  return (
    <div className={`triple-toggle ${className}`}>
      <div className="triple-toggle-track">
        <div
          className="triple-toggle-thumb"
          style={{ transform: `translateX(${safeIndex * 100}%)` }}
        />
        {options.map((opt, i) => (
          <button
            key={`${opt.label}-${i}`}
            type="button"
            className={`triple-toggle-segment ${safeIndex === i ? 'active' : ''}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TripleToggle;
