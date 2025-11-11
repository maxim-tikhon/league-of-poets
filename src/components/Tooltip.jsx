import React, { useState } from 'react';
import './Tooltip.css';

const Tooltip = ({ children, text }) => {
  const [show, setShow] = useState(false);

  return (
    <div 
      className="tooltip-wrapper"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && text && (
        <div className="tooltip-content">
          {text}
        </div>
      )}
    </div>
  );
};

export default Tooltip;

