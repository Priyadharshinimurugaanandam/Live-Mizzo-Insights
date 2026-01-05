// src/types/index.ts
export interface SurgicalData {
  id?: number;
  procedure_name: string;
  date: string;
  time: string;
  duration: number | string;
  surgeon_name: string;
  surgeon_image: string;
  instruments_names: string;
  instruments_images: string;
  instruments_durations: string;
  clutch_names: string;
  clutch_counts: string;
  created_at?: string;
}

export interface Instrument {
  name: string;
  duration: number;
  image: string | null;
}

export interface Clutch {
  name: string;
  count: number;
}

export interface ProcessedSurgery extends Omit<SurgicalData, 'duration' | 'instruments_names' | 'instruments_images' | 'instruments_durations' | 'clutch_names' | 'clutch_counts'> {
  duration: number;
  instruments: Instrument[];
  clutches: Clutch[];
  datetime: Date;
}