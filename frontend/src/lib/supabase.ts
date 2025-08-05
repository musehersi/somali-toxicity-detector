import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      audio_analyses: {
        Row: {
          id: string;
          user_id: string;
          audio_url: string;
          model_type: "asr_classification" | "end_to_end";
          prediction: "toxic" | "non_toxic";
          confidence: number;
          transcript: string | null;
          latency: number;
          created_at: string;
          audio_type: "uploaded" | "recorded" | "video_extracted";
          tags: string[] | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          audio_url: string;
          model_type: "asr_classification" | "end_to_end";
          prediction: "toxic" | "non_toxic";
          confidence: number;
          transcript?: string | null;
          latency: number;
          created_at?: string;
          audio_type: "uploaded" | "recorded" | "video_extracted";
          tags?: string[] | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          audio_url?: string;
          model_type?: "asr_classification" | "end_to_end";
          prediction?: "toxic" | "non_toxic";
          confidence?: number;
          transcript?: string | null;
          latency?: number;
          created_at?: string;
          audio_type?: "uploaded" | "recorded" | "video_extracted";
          tags?: string[] | null;
        };
      };
      feedback: {
        Row: {
          id: string;
          analysis_id: string;
          user_id: string;
          is_correct: boolean;
          corrected_label: "toxic" | "non_toxic";
          comment: string | null;
          created_at: string;
          final_label: "toxic" | "non_toxic";
          audio_storage_path: string;
          model_output_label: "toxic" | "non_toxic";
          model_type: "asr_classification" | "end_to_end";
          model_confidence: number;
        };
        Insert: {
          id?: string;
          analysis_id: string;
          user_id: string;
          is_correct: boolean;
          corrected_label: "toxic" | "non_toxic";
          comment?: string | null;
          created_at?: string;
          final_label: "toxic" | "non_toxic";
          audio_storage_path: string;
          model_output_label: "toxic" | "non_toxic";
          model_type: "asr_classification" | "end_to_end";
          model_confidence: number;
        };
        Update: {
          id?: string;
          analysis_id?: string;
          user_id?: string;
          is_correct?: boolean;
          corrected_label?: "toxic" | "non_toxic";
          comment?: string | null;
          created_at?: string;
          final_label?: "toxic" | "non_toxic";
          audio_storage_path?: string;
          model_output_label?: "toxic" | "non_toxic";
          model_type?: "asr_classification" | "end_to_end";
          model_confidence?: number;
        };
      };

      profiles: {
        Row: {
          id: string;
          email: string;
          role: "public" | "admin";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          role?: "public" | "admin";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          role?: "public" | "admin";
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};
