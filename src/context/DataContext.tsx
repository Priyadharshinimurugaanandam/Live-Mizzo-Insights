import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import type { ProcessedSurgery, SurgicalData } from '../types/index';

// Define the context type
interface DataContextType {
  surgeries: ProcessedSurgery[];
  setSurgeries: React.Dispatch<React.SetStateAction<ProcessedSurgery[]>>;
  filteredSurgeries: ProcessedSurgery[];
  uniqueProcedures: string[];
  uniqueSurgeons: string[];
  hasData: boolean;
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  filters: { procedure: string; surgeon: string };
  setFilters: React.Dispatch<React.SetStateAction<{ procedure: string; surgeon: string }>>;
  fetchData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

// API base URL
const API_BASE_URL = 'http://127.0.0.1:8001';

export const processSurgicalData = (data: SurgicalData[]): ProcessedSurgery[] => {
  return data.map((item) => {
    const instruments = item.instruments_names
      ? item.instruments_names.split(',').map((name: string, index: number) => ({
          name: name.trim(),
          duration: item.instruments_durations
            ? parseInt(item.instruments_durations.split(',')[index], 10) || 0
            : 0,
          image: item.instruments_images
            ? item.instruments_images.split(',')[index]?.trim() || null
            : null,
        }))
      : [];

    const clutches = item.clutch_names
      ? item.clutch_names.split(',').map((name: string, index: number) => ({
          name: name.trim(),
          count: item.clutch_counts
            ? parseInt(item.clutch_counts.split(',')[index], 10) || 0
            : 0,
        }))
      : [];

    const datetime = new Date(`${item.date}T${item.time}`);

    return {
      ...item,
      duration: typeof item.duration === 'string' ? parseInt(item.duration, 10) : item.duration,
      instruments,
      clutches,
      datetime,
    };
  });
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [surgeries, setSurgeries] = useState<ProcessedSurgery[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState({ procedure: '', surgeon: '' });

  // Compute filtered surgeries
  const filteredSurgeries = surgeries.filter((surgery) =>
    (filters.procedure ? surgery.procedure_name.toLowerCase().includes(filters.procedure.toLowerCase()) : true) &&
    (filters.surgeon ? surgery.surgeon_name.toLowerCase().includes(filters.surgeon.toLowerCase()) : true)
  );

  // Compute unique procedures and surgeons
  const uniqueProcedures = Array.from(new Set(surgeries.map((surgery) => surgery.procedure_name))).sort();
  const uniqueSurgeons = Array.from(new Set(surgeries.map((surgery) => surgery.surgeon_name))).sort();

  // Track if data exists
  const hasData = surgeries.length > 0;

  // Fetch data from local SQLite backend
  const fetchData = async () => {
    setIsLoading(true);
    try {
      console.log('Fetching data from local SQLite database...');
      const response = await axios.get(`${API_BASE_URL}/surgeries`);
      const processedData = processSurgicalData(response.data || []);
      console.log('Processed data:', processedData);
      setSurgeries(processedData);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []);

  return (
    <DataContext.Provider
      value={{
        surgeries,
        setSurgeries,
        filteredSurgeries,
        uniqueProcedures,
        uniqueSurgeons,
        hasData,
        isLoading,
        setIsLoading,
        filters,
        setFilters,
        fetchData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};