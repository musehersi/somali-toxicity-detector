import { audioService } from "../../services/audioService"; // Adjust path if needed
import React, { useState, useRef, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Mic, MicOff, Video, File, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

interface AudioInputProps {
  onAudioSelect: (
    file: File | null,
    url: string,
    type: "uploaded" | "recorded" | "video_extracted"
  ) => void;
  selectedAudio: {
    file: File;
    url: string;
    type: "uploaded" | "recorded" | "video_extracted";
  } | null;
}

export default function AudioInput({
  onAudioSelect,
  selectedAudio,
}: AudioInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      if (audioService.isAudioFile(file)) {
        const url = URL.createObjectURL(file);
        onAudioSelect(file, url, "uploaded");
        setVideoPreviewUrl(null);
        toast.success("Audio file uploaded");
      } else if (audioService.isVideoFile(file)) {
        toast.loading("Extracting audio from video...");

        try {
          const { audioBlob, duration } =
            await audioService.convertVideoToAudio(file);
          const extractedFile = new window.File(
            [audioBlob as Blob],
            `video_audio_${Date.now()}.wav`,
            { type: "audio/wav" }
          );
          const url = URL.createObjectURL(audioBlob);
          onAudioSelect(extractedFile, url, "video_extracted");
          setVideoPreviewUrl(URL.createObjectURL(file));
          toast.success("Audio extracted from video");
        } catch (err) {
          console.error(err);
          toast.error("Failed to extract audio from video");
        }
      } else {
        toast.error("Only audio or video files are allowed");
      }
    },
    [onAudioSelect]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "audio/*": [".wav", ".mp3", ".m4a", ".ogg"],
      "video/*": [".mp4", ".avi", ".mov", ".mkv"],
    },
    maxFiles: 1,
    disabled: isRecording,
  });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      chunksRef.current = [];
      mediaRecorder.ondataavailable = (event) =>
        chunksRef.current.push(event.data);

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/wav" });
        const file = new (window as any).File(
          [blob],
          `recording-${Date.now()}.wav`,
          {
            type: "audio/wav",
          }
        );

        const url = URL.createObjectURL(blob);
        onAudioSelect(file, url, "recorded");
        stream.getTracks().forEach((track) => track.stop());
        setRecordingDuration(0);
        setVideoPreviewUrl(null);
        toast.success("Recording complete");
      };

      mediaRecorder.start();
      setIsRecording(true);
      intervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
      toast.success("Recording started");
    } catch {
      toast.error("Mic permission denied or device unavailable");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  };

  const togglePlayback = () => {
    if (!selectedAudio || !audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      {selectedAudio && (
        <div className="bg-white dark:bg-gray-800 border p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded bg-blue-100 dark:bg-blue-900">
                {selectedAudio.file.name.startsWith("recording") ? (
                  <Mic />
                ) : selectedAudio.file.name.endsWith(".mp4") ? (
                  <Video />
                ) : (
                  <File />
                )}
              </div>
              <div>
                <p className="font-medium">{selectedAudio.file.name}</p>
                <p className="text-sm text-gray-500">
                  {(selectedAudio.file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <button
              onClick={togglePlayback}
              className="p-2 rounded-md bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-600"
            >
              <Play className="w-4 h-4" />
            </button>
          </div>
          {videoPreviewUrl && (
            <div className="mt-4">
              <video
                src={videoPreviewUrl}
                controls
                className="w-full rounded"
              />
            </div>
          )}
          <audio
            ref={audioRef}
            src={selectedAudio.url}
            controls
            onEnded={() => setIsPlaying(false)}
            className="w-full mt-4"
          />
        </div>
      )}

      <AnimatePresence>
        {!selectedAudio && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div
              {...getRootProps()}
              className={`border-2 border-dashed p-6 text-center rounded-lg cursor-pointer ${
                isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="mx-auto mb-2 text-gray-400" />
              <p className="font-medium">Upload audio or video</p>
              <p className="text-sm text-gray-500">WAV, MP3, MP4, etc.</p>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-500 mb-2">Or record audio</p>
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="w-12 h-12 rounded-full bg-blue-600 text-white hover:bg-blue-700"
                >
                  <Mic className="w-5 h-5 mx-auto" />
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="w-12 h-12 rounded-full bg-red-600 text-white hover:bg-red-700 animate-pulse"
                >
                  <MicOff className="w-5 h-5 mx-auto" />
                </button>
              )}
              {isRecording && (
                <p className="mt-2 text-sm font-mono text-red-500">
                  {formatDuration(recordingDuration)}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
