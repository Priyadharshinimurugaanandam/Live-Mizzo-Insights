import React from 'react';
import { useData } from '../context/DataContext';

const ProcedureView: React.FC = () => {
  const { hasData } = useData();

  if (!hasData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-300">
          No procedure data available.
        </p>
      </div>
    );
  }

  return (
    <div className="text-center py-12">
      <p className="text-gray-600 dark:text-gray-300">
        Procedure view - Not in use
      </p>
    </div>
  );
};

export default ProcedureView;