// src/components/Header.tsx
import React from 'react';

import DarkModeToggle from './DarkModeToggle';

const Header: React.FC = () => {
  return (
    <header className="fixed top-0 left-0 right-0 bg-white dark:bg-gray-800 shadow-sm z-50 h-16 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center h-full px-6">
        <img 
          src="public/placeholder.png" 
          alt="MIZZO System Insights Logo" 
          className="w-8 h-8 mr-3"
          onError={(e) => (e.currentTarget.src = 'public/Image.png')}
        />
        <h1 className="text-2xl font-bold text-[#00938e] dark:text-[#00a8a1] uppercase tracking-wide">
          MIZZO SYSTEM INSIGHTS
        </h1>
        <div className="ml-auto flex items-center space-x-4">
          <DarkModeToggle />
          
        </div>
      </div>
    </header>
  );
};

export default Header;

