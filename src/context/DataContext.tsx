import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import type { ProcessedSurgery, SurgicalData } from '../types/index';
import { useWebSocket } from '../hooks/useWebSocket';

interface DataContextType {
  surgeries: ProcessedSurgery[];
  filteredSurgeries: ProcessedSurgery[];
  uniqueProcedures: string[];
  surgeonName: string;
  hasData: boolean;
  isLoading: boolean;
  liveSurgery: ProcessedSurgery | null;
  filters: { procedure: string };
  setFilters: React.Dispatch<React.SetStateAction<{ procedure: string }>>;
  fetchData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within a DataProvider');
  return context;
};

const API_BASE_URL = 'http://127.0.0.1:8001';
const WS_URL = 'ws://127.0.0.1:8001/ws';

export const processSurgicalData = (data: SurgicalData[]): ProcessedSurgery[] => {
  return data.map((item) => {
    const instruments = item.instruments_names
      ? item.instruments_names.split(',').map((name: string, index: number) => ({
          name: name.trim(),
          duration: item.instruments_durations
            ? parseFloat(item.instruments_durations.split(',')[index]) || 0
            : 0,
          image: null,
        }))
      : [];

    const datetime = new Date(`${item.date}T${item.time}`);

    return {
      ...item,
      duration: typeof item.duration === 'string' ? parseInt(item.duration, 10) : item.duration,
      instruments,
      clutches: [],
      datetime,
    };
  });
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [surgeries, setSurgeries] = useState<ProcessedSurgery[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState({ procedure: '' });
  const [surgeonName, setSurgeonName] = useState('');
  const [liveSurgery, setLiveSurgery] = useState<ProcessedSurgery | null>(null);

  const filteredSurgeries = surgeries.filter((surgery) =>
    filters.procedure ? surgery.procedure_name.toLowerCase().includes(filters.procedure.toLowerCase()) : true
  );

  const uniqueProcedures = Array.from(new Set(surgeries.map((surgery) => surgery.procedure_name))).sort();
  const hasData = surgeries.length > 0;

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [surgeriesRes, configRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/surgeries`),
        axios.get(`${API_BASE_URL}/config`)
      ]);
      
      const processedData = processSurgicalData(surgeriesRes.data || []);
      setSurgeries(processedData);
      setSurgeonName(configRes.data.surgeon_name);
      
      const live = processedData.find((s: any) => s.is_live === 1);
      setLiveSurgery(live || null);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleWebSocketMessage = useCallback((data: any) => {
    console.log('📨 WebSocket message:', data);
    
    if (data.type === 'surgery_update') {
      const processed = processSurgicalData([{
        ...data.surgery,
        instruments_names: Object.keys(data.surgery.instruments).join(','),
        instruments_durations: Object.values(data.surgery.instruments).map((i: any) => i.duration).join(','),
        is_live: 1
      }])[0];
      
      setLiveSurgery(processed);
      
      setSurgeries(prev => {
        const filtered = prev.filter((s: any) => s.is_live !== 1);
        return [processed, ...filtered];
      });
    } else if (data.type === 'surgery_complete') {
      setLiveSurgery(null);
      fetchData();
    }
  }, [fetchData]);

  useWebSocket(WS_URL, handleWebSocketMessage);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <DataContext.Provider
      value={{
        surgeries,
        filteredSurgeries,
        uniqueProcedures,
        surgeonName,
        hasData,
        isLoading,
        liveSurgery,
        filters,
        setFilters,
        fetchData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};