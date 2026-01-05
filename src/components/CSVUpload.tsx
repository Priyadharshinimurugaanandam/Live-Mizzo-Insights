import React, { useRef } from 'react';
import { Upload } from 'lucide-react';
import { useData } from '../context/DataContext';
import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8001';

const CSVUpload: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setIsLoading, fetchData } = useData();

  const showNotification = (message: string, isError = false) => {
    const n = document.createElement('div');
    n.textContent = message;
    n.className = `fixed top-20 right-4 px-6 py-3 rounded-lg shadow-lg z-50 text-white font-bold ${isError ? 'bg-red-600' : 'bg-[#00938e]'}`;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 4000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post(`${API_BASE_URL}/upload/json`, formData);
      showNotification('Uploaded successfully!');
      
      // Refresh data from SQLite
      await fetchData();

    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Network error';
      showNotification(`Upload failed: ${msg}`, true);
      console.error("Upload error:", err);
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="p-4">
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 p-3 border-2 border-[#00938e] rounded-lg bg-white hover:bg-[#00938e] hover:text-white transition-colors font-medium"
      >
        <Upload size={20} />
        <span className="text-sm">Upload Data</span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.csv"
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  );
};

export default CSVUpload;