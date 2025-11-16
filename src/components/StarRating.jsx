import React from 'react';
import './StarRating.css';

const StarRating = ({ value, onChange, readOnly = false, maxRating = 5 }) => {
  const [hoverValue, setHoverValue] = React.useState(null);

  const handleClick = (rating) => {
    if (!readOnly && onChange) {
      onChange(rating);
    }
  };

  const handleMouseEnter = (rating) => {
    if (!readOnly) {
      setHoverValue(rating);
    }
  };

  const handleMouseLeave = () => {
    if (!readOnly) {
      setHoverValue(null);
    }
  };

  const renderStar = (index) => {
    const rating = index + 0.5;
    const fullRating = index + 1;
    const displayValue = hoverValue !== null ? hoverValue : value;

    const isFullStar = displayValue >= fullRating;
    const isHalfStar = displayValue >= rating && displayValue < fullRating;
    const showFilled = isHalfStar || isFullStar;

    return (
      <div
        key={index}
        className={`star-wrapper ${readOnly ? 'read-only' : ''}`}
      >
        <span className={`star star-empty`}>★</span>
        {showFilled && (
          <span 
            className={`star star-filled`}
            style={{
              clipPath: isHalfStar ? 'inset(0 50% 0 0)' : 'none'
            }}
          >
            ★
          </span>
        )}
        <div
          className="star-click-area left"
          onMouseEnter={() => handleMouseEnter(rating)}
          onClick={() => handleClick(rating)}
        />
        <div
          className="star-click-area right"
          onMouseEnter={() => handleMouseEnter(fullRating)}
          onClick={() => handleClick(fullRating)}
        />
      </div>
    );
  };

  return (
    <div className="star-rating" onMouseLeave={handleMouseLeave}>
      {Array.from({ length: maxRating }, (_, i) => renderStar(i))}
      {/* <span className="rating-value">{value.toFixed(1)}</span> */}
    </div>
  );
};

export default StarRating;

