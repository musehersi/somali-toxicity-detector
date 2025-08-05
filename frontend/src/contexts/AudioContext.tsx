import React, { createContext, useContext, useReducer, ReactNode } from "react";

interface AudioState {
  recordings: AudioRecording[];
  currentRecording: AudioRecording | null;
  isRecording: boolean;
  selectedModel: "asr-text" | "end-to-end";
  results: DetectionResult | null;
  isProcessing: boolean;
}

interface AudioRecording {
  id: string;
  name: string;
  blob: Blob;
  url: string;
  duration: number;
  timestamp: Date;
  results?: DetectionResult;
}

interface DetectionResult {
  isToxic: boolean;
  confidence: number;
  model: "asr-text" | "end-to-end";
  transcription?: string | null;
  categories?: string[];
  timestamp: Date;
  latency?: number; // optional, not all models return it
}

type AudioAction =
  | { type: "START_RECORDING" }
  | { type: "STOP_RECORDING" }
  | { type: "ADD_RECORDING"; payload: AudioRecording }
  | { type: "DELETE_RECORDING"; payload: string }
  | { type: "CLEAR_RECORDING" }
  | { type: "SELECT_RECORDING"; payload: AudioRecording }
  | { type: "SET_MODEL"; payload: "asr-text" | "end-to-end" }
  | { type: "SET_RESULTS"; payload: DetectionResult }
  | { type: "SET_PROCESSING"; payload: boolean }
  | { type: "CLEAR_RESULTS" };

const initialState: AudioState = {
  recordings: [],
  currentRecording: null,
  isRecording: false,
  selectedModel: "asr-text",
  results: null,
  isProcessing: false,
};

function audioReducer(state: AudioState, action: AudioAction): AudioState {
  switch (action.type) {
    case "START_RECORDING":
      return { ...state, isRecording: true };
    case "STOP_RECORDING":
      return { ...state, isRecording: false };
    case "ADD_RECORDING":
      return {
        ...state,
        recordings: [action.payload, ...state.recordings],
        currentRecording: action.payload,
      };
    case "DELETE_RECORDING":
      return {
        ...state,
        recordings: state.recordings.filter((r) => r.id !== action.payload),
        currentRecording:
          state.currentRecording?.id === action.payload
            ? null
            : state.currentRecording,
      };
    case "CLEAR_RECORDING":
      return { ...state, currentRecording: null };
    case "SELECT_RECORDING":
      return { ...state, currentRecording: action.payload };
    case "SET_MODEL":
      return { ...state, selectedModel: action.payload, results: null };
    case "SET_RESULTS":
      return { ...state, results: action.payload, isProcessing: false };
    case "SET_PROCESSING":
      return { ...state, isProcessing: action.payload };
    case "CLEAR_RESULTS":
      return { ...state, results: null };

    default:
      return state;
  }
}

export const AudioContext = createContext<{
  state: AudioState;
  dispatch: React.Dispatch<AudioAction>;
} | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(audioReducer, initialState);

  return (
    <AudioContext.Provider value={{ state, dispatch }}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error("useAudio must be used within an AudioProvider");
  }
  return context;
}

export type { AudioRecording, DetectionResult };
