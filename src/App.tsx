// src/App.tsx
import React from 'react';
import { DataProvider } from './context/DataContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';

const App: React.FC = () => {
  return (
    <DataProvider>
      <div className="min-h-screen bg-[#d2e2eb] dark:bg-gray-800">
        
        {/* FIXED HEADER */}
        <Header />

        
        
          
          {/* FIXED SIDEBAR */}
          <Sidebar />
          
          {/* SCROLLABLE DASHBOARD */}
          <main className="min-h-screen bg-[#d2e2eb] dark:bg-gray-800">
            <div className="h-full p-6">
              <Dashboard />
            </div>
          </main>
        
      </div>
    </DataProvider>
  );
};

export default App;






