import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import type { ProcessedSurgery, SurgicalData } from '../types/index';
import { useWebSocket } from '../hooks/useWebSocket';

interface DataContextType {
  surgeries: ProcessedSurgery[];
  filteredSurgeries: ProcessedSurgery[];
  surgeonName: string;
  hasData: boolean;
  isLoading: boolean;
  liveSurgery: ProcessedSurgery | null;
  selectedHistorySurgery: ProcessedSurgery | null;
  setSelectedHistorySurgery: React.Dispatch<React.SetStateAction<ProcessedSurgery | null>>;
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
  const [surgeonName, setSurgeonName] = useState('');
  const [liveSurgery, setLiveSurgery] = useState<ProcessedSurgery | null>(null);
  const [selectedHistorySurgery, setSelectedHistorySurgery] = useState<ProcessedSurgery | null>(null);

  const filteredSurgeries = surgeries;

  const hasData = surgeries.length > 0;

  const fetchData = useCallback(async (specificSurgeon?: string) => {
    setIsLoading(true);
    try {
      const surgeon = specificSurgeon || surgeonName;
      
      if (!surgeon) {
        console.log('No surgeon name available yet');
        setIsLoading(false);
        return;
      }
      
      console.log(`Fetching surgeries for: ${surgeon}`);
      const surgeriesRes = await axios.get(`${API_BASE_URL}/surgeries/${surgeon}`);
      
      const processedData = processSurgicalData(surgeriesRes.data || []);
      setSurgeries(processedData);
      
      const live = processedData.find((s: any) => s.is_live === 1);
      setLiveSurgery(live || null);
      
      console.log(`Loaded ${processedData.length} surgeries, live: ${live ? 'Yes' : 'No'}`);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [surgeonName]);

  const handleWebSocketMessage = useCallback((data: any) => {
    console.log('📨 WebSocket message:', data);
    
    const surgeryData = data.surgery;
    const messageSurgeon = data.surgeon_name || surgeryData.surgeon_name;
    
    if (!surgeonName) {
      setSurgeonName(messageSurgeon);
    }
    
    if (surgeonName && messageSurgeon !== surgeonName) {
      console.log(`Ignoring update for different surgeon: ${messageSurgeon}`);
      return;
    }
    
    if (data.type === 'surgery_update') {
      const processed = processSurgicalData([{
        ...surgeryData,
        instruments_names: Object.keys(surgeryData.instruments).join(','),
        instruments_durations: Object.values(surgeryData.instruments).map((i: any) => i.duration).join(','),
        is_live: 1
      }])[0];
      
      setLiveSurgery(processed);
      
      setSurgeries(prev => {
        const filtered = prev.filter((s: any) => s.is_live !== 1);
        return [processed, ...filtered];
      });
    } else if (data.type === 'surgery_complete') {
      setLiveSurgery(null);
      fetchData(messageSurgeon);
    }
  }, [fetchData, surgeonName]);

  useWebSocket(WS_URL, handleWebSocketMessage);

  useEffect(() => {
    if (surgeonName) {
      fetchData();
    }
  }, [surgeonName]);

  return (
    <DataContext.Provider
      value={{
        surgeries,
        filteredSurgeries,
        surgeonName,
        hasData,
        isLoading,
        liveSurgery,
        selectedHistorySurgery,
        setSelectedHistorySurgery,
        fetchData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};