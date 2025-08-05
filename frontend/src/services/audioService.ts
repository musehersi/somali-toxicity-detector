class AudioService {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];

  async startRecording(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const options: MediaRecorderOptions = {
        audioBitsPerSecond: 128000,
      };

      // Try to use the best available audio format
      const mimeType = this.getBestAudioMimeType();
      if (mimeType) {
        options.mimeType = mimeType;
      }

      this.mediaRecorder = new MediaRecorder(this.stream, options);
      this.chunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };

      this.mediaRecorder.start(100); // Collect data every 100ms for better quality
    } catch (error) {
      console.error("Error starting recording:", error);
      throw new Error(
        "Failed to start recording. Please check microphone permissions."
      );
    }
  }

  async stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error("No recording in progress"));
        return;
      }

      this.mediaRecorder.onstop = async () => {
        const mimeType = this.mediaRecorder?.mimeType || "audio/webm";
        const blob = new Blob(this.chunks, { type: mimeType });
        this.cleanup();

        // Convert to 16kHz 16-bit PCM mono
        try {
          const convertedBlob = await this.convertTo16kHzMono(blob);
          resolve(convertedBlob);
        } catch (error) {
          console.warn("Failed to convert recording, using original:", error);
          resolve(blob);
        }
      };

      this.mediaRecorder.stop();
    });
  }

  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.chunks = [];
  }

  private getBestAudioMimeType(): string | null {
    const types = [
      "audio/webm;codecs=opus",
      "audio/webm;codecs=vorbis",
      "audio/webm",
      "audio/mp4;codecs=mp4a.40.2",
      "audio/mp4",
      "audio/ogg;codecs=opus",
      "audio/ogg;codecs=vorbis",
      "audio/wav",
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return null;
  }

  async convertVideoToAudio(
    videoFile: File
  ): Promise<{ audioBlob: Blob; duration: number }> {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)({
        sampleRate: 16000, // Set to 16kHz
      });

      let mediaRecorder: MediaRecorder | null = null;
      let chunks: Blob[] = [];
      let isProcessing = false;

      const cleanup = () => {
        if (video.src) {
          URL.revokeObjectURL(video.src);
        }
        if (audioContext.state !== "closed") {
          audioContext.close().catch(console.error);
        }
        video.remove();
      };

      const handleError = (error: string | Error) => {
        cleanup();
        const message = error instanceof Error ? error.message : error;
        reject(new Error(`Video to audio conversion failed: ${message}`));
      };

      video.crossOrigin = "anonymous";
      video.preload = "metadata";
      video.muted = false;
      video.volume = 1.0;

      // Set video source
      video.src = URL.createObjectURL(videoFile);

      video.onloadedmetadata = async () => {
        try {
          if (isProcessing) return;
          isProcessing = true;

          const duration = video.duration;

          if (!duration || duration === 0) {
            handleError("Video has no duration or is corrupted");
            return;
          }

          // Resume audio context if suspended
          if (audioContext.state === "suspended") {
            await audioContext.resume();
          }

          // Create audio processing chain for 16kHz mono conversion
          const source = audioContext.createMediaElementSource(video);
          const gainNode = audioContext.createGain();

          // Create a channel merger to convert to mono
          const channelMerger = audioContext.createChannelMerger(1);
          const destination = audioContext.createMediaStreamDestination();

          // Connect the audio processing chain
          source.connect(gainNode);
          gainNode.connect(channelMerger);
          channelMerger.connect(destination);

          // Set optimal gain
          gainNode.gain.value = 1.0;

          // Create MediaRecorder with WAV format for better quality
          const mimeType = "audio/wav";

          try {
            mediaRecorder = new MediaRecorder(destination.stream, {
              mimeType,
              audioBitsPerSecond: 256000, // Higher bitrate for 16-bit PCM
            });
          } catch (e) {
            // Fallback to basic MediaRecorder
            mediaRecorder = new MediaRecorder(destination.stream);
          }

          chunks = [];

          mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
              chunks.push(event.data);
            }
          };

          mediaRecorder.onstop = async () => {
            try {
              if (chunks.length === 0) {
                handleError("No audio data was captured from the video");
                return;
              }

              const rawAudioBlob = new Blob(chunks, { type: mimeType });

              if (rawAudioBlob.size === 0) {
                handleError("Extracted audio file is empty");
                return;
              }

              // Convert to 16kHz 16-bit PCM mono
              const audioBlob = await this.convertTo16kHzMono(rawAudioBlob);

              // Validate the extracted audio
              const isValid = await this.validateAudioBlob(audioBlob);
              if (!isValid) {
                handleError("Extracted audio is not playable");
                return;
              }

              cleanup();
              resolve({ audioBlob, duration });
            } catch (error) {
              handleError(
                error instanceof Error
                  ? error
                  : "Failed to process extracted audio"
              );
            }
          };

          mediaRecorder.onerror = (event) => {
            handleError("MediaRecorder error during audio extraction");
          };

          // Start recording
          mediaRecorder.start(100);

          // Play the video to extract audio
          try {
            await video.play();
          } catch (playError) {
            handleError("Failed to play video for audio extraction");
            return;
          }

          // Set up video event handlers
          video.onended = () => {
            if (mediaRecorder && mediaRecorder.state === "recording") {
              mediaRecorder.stop();
            }
          };

          video.onerror = () => {
            handleError("Video playback error during audio extraction");
          };

          // Fallback timeout (add 2 seconds buffer)
          setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state === "recording") {
              video.pause();
              mediaRecorder.stop();
            }
          }, (duration + 2) * 1000);
        } catch (error) {
          handleError(
            error instanceof Error
              ? error
              : "Unexpected error during audio extraction"
          );
        }
      };

      video.onerror = (event) => {
        const error = video.error;
        let message = "Failed to load video file";

        if (error) {
          switch (error.code) {
            case error.MEDIA_ERR_ABORTED:
              message = "Video loading was aborted";
              break;
            case error.MEDIA_ERR_NETWORK:
              message = "Network error while loading video";
              break;
            case error.MEDIA_ERR_DECODE:
              message = "Video format is not supported or file is corrupted";
              break;
            case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
              message = "Video format is not supported by this browser";
              break;
          }
        }

        handleError(message);
      };

      // Timeout for metadata loading
      setTimeout(() => {
        if (!isProcessing) {
          handleError("Timeout: Video metadata could not be loaded");
        }
      }, 10000);
    });
  }

  async convertTo16kHzMono(blob: Blob): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const fileReader = new FileReader();

      fileReader.onload = async (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          // Create offline context for 16kHz mono conversion
          const targetSampleRate = 16000;
          const targetChannels = 1;
          const duration = audioBuffer.duration;
          const targetLength = Math.ceil(duration * targetSampleRate);

          const offlineContext = new OfflineAudioContext(
            targetChannels,
            targetLength,
            targetSampleRate
          );

          // Create buffer source
          const source = offlineContext.createBufferSource();
          source.buffer = audioBuffer;

          // Create gain node for channel mixing if stereo
          const gainNode = offlineContext.createGain();
          source.connect(gainNode);
          gainNode.connect(offlineContext.destination);

          // Start processing
          source.start(0);

          const renderedBuffer = await offlineContext.startRendering();

          // Convert to 16-bit PCM WAV
          const wavBlob = this.audioBufferToWav(renderedBuffer, 16);

          audioContext.close();
          resolve(wavBlob);
        } catch (error) {
          console.error("Error converting audio:", error);
          audioContext.close();
          // Return original blob if conversion fails
          resolve(blob);
        }
      };

      fileReader.onerror = () => {
        audioContext.close();
        reject(new Error("Failed to read audio file"));
      };

      fileReader.readAsArrayBuffer(blob);
    });
  }

  private audioBufferToWav(buffer: AudioBuffer, bitDepth: number = 16): Blob {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numberOfChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = length * blockAlign;
    const bufferSize = 44 + dataSize;

    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, bufferSize - 8, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true); // PCM format
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, "data");
    view.setUint32(40, dataSize, true);

    // Convert audio data
    let offset = 44;
    const maxValue = Math.pow(2, bitDepth - 1) - 1;

    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = buffer.getChannelData(channel)[i];
        const intSample = Math.max(-1, Math.min(1, sample)) * maxValue;

        if (bitDepth === 16) {
          view.setInt16(offset, intSample, true);
          offset += 2;
        } else if (bitDepth === 8) {
          view.setUint8(offset, intSample + 128);
          offset += 1;
        }
      }
    }

    return new Blob([arrayBuffer], { type: "audio/wav" });
  }

  async convertToWav(blob: Blob): Promise<Blob> {
    // Convert to 16kHz mono first, then ensure it's WAV format
    return this.convertTo16kHzMono(blob);
  }

  async getAudioDuration(blob: Blob): Promise<number> {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.src = URL.createObjectURL(blob);

      audio.onloadedmetadata = () => {
        const duration = audio.duration;
        URL.revokeObjectURL(audio.src);
        resolve(isFinite(duration) ? duration : 0);
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audio.src);
        resolve(0);
      };

      // Timeout fallback
      setTimeout(() => {
        if (audio.src) {
          URL.revokeObjectURL(audio.src);
          resolve(0);
        }
      }, 5000);
    });
  }

  isVideoFile(file: File): boolean {
    const videoTypes = [
      "video/mp4",
      "video/avi",
      "video/mov",
      "video/mkv",
      "video/webm",
      "video/quicktime",
      "video/x-msvideo",
      "video/3gpp",
      "video/x-ms-wmv",
      "video/x-flv",
    ];

    const videoExtensions = /\.(mp4|avi|mov|mkv|webm|qt|3gp|wmv|flv|m4v)$/i;

    return videoTypes.includes(file.type) || videoExtensions.test(file.name);
  }

  isAudioFile(file: File): boolean {
    const audioTypes = [
      "audio/mp3",
      "audio/wav",
      "audio/m4a",
      "audio/ogg",
      "audio/flac",
      "audio/mpeg",
      "audio/webm",
      "audio/aac",
      "audio/x-wav",
      "audio/vnd.wav",
    ];

    const audioExtensions = /\.(mp3|wav|m4a|ogg|flac|aac|wma|opus)$/i;

    return audioTypes.includes(file.type) || audioExtensions.test(file.name);
  }

  formatDuration(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return "0:00";

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  async validateAudioBlob(blob: Blob): Promise<boolean> {
    return new Promise((resolve) => {
      const audio = new Audio();
      const url = URL.createObjectURL(blob);

      let resolved = false;

      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          URL.revokeObjectURL(url);
        }
      };

      audio.oncanplaythrough = () => {
        cleanup();
        resolve(true);
      };

      audio.onerror = () => {
        cleanup();
        resolve(false);
      };

      audio.onloadeddata = () => {
        // Additional check - if we can load data, it's likely valid
        if (!resolved && audio.readyState >= 2) {
          cleanup();
          resolve(true);
        }
      };

      // Timeout fallback
      setTimeout(() => {
        if (!resolved) {
          cleanup();
          resolve(false);
        }
      }, 3000);

      audio.src = url;
    });
  }

  // Get supported audio formats for this browser
  getSupportedAudioFormats(): string[] {
    const formats = [
      "audio/webm;codecs=opus",
      "audio/webm;codecs=vorbis",
      "audio/webm",
      "audio/mp4;codecs=mp4a.40.2",
      "audio/mp4",
      "audio/ogg;codecs=opus",
      "audio/ogg;codecs=vorbis",
      "audio/wav",
    ];

    return formats.filter((format) => MediaRecorder.isTypeSupported(format));
  }

  // Get browser capabilities info
  getBrowserCapabilities(): {
    supportsMediaRecorder: boolean;
    supportsWebAudio: boolean;
    supportedFormats: string[];
  } {
    return {
      supportsMediaRecorder: typeof MediaRecorder !== "undefined",
      supportsWebAudio:
        typeof AudioContext !== "undefined" ||
        typeof (window as any).webkitAudioContext !== "undefined",
      supportedFormats: this.getSupportedAudioFormats(),
    };
  }
}

export const audioService = new AudioService();
