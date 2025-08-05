# This is the new, full content for backend/models/toxicity_classifier.py

from pydub import AudioSegment
import io

# The sample rate your models on Hugging Face expect
TARGET_SR = 16000

def prepare_audio_for_api(file_path, file_format):
    """
    This function takes an audio or video file, converts it to the correct
    format for the Hugging Face API, and returns the raw audio data (bytes).
    """
    # Load the file using pydub. It can handle both audio and video files.
    if file_format == 'mp4':
        audio = AudioSegment.from_file(file_path, format="mp4")
    else:
        # Works for wav, mp3, etc.
        audio = AudioSegment.from_file(file_path)

    # 1. Convert to a single channel (mono)
    audio = audio.set_channels(1)
    # 2. Set the sample rate to 16kHz
    audio = audio.set_frame_rate(TARGET_SR)

    # Export the processed audio into an in-memory file (a buffer)
    # instead of saving it to disk.
    buffer = io.BytesIO()
    audio.export(buffer, format="wav") # Export as WAV format
    
    # Get the raw bytes from the buffer
    processed_bytes = buffer.getvalue()
    buffer.close()

    return processed_bytes