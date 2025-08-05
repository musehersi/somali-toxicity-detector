# This is the new, full content for backend/app.py

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import tempfile
import requests # <-- We use this to call the API
from datetime import datetime

# Note: You may need to add your supabase imports if they are not here
# from supabase import create_client, Client
# from uuid import uuid4

app = Flask(__name__)
CORS(app)

# --- Load Credentials from Environment Variables ---
HF_TOKEN = os.getenv("HF_TOKEN")
# You will also need to add your SUPABASE_URL and SUPABASE_KEY in Render
# supabase_url = os.getenv("SUPABASE_URL")
# supabase_key = os.getenv("SUPABASE_KEY")
# supabase = create_client(supabase_url, supabase_key)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def query_hf_api(data, model_id):
    """Helper function to call the Hugging Face Inference API."""
    API_URL = f"https://api-inference.huggingface.co/models/{model_id}"
    headers = {"Authorization": f"Bearer {HF_TOKEN}"}
    response = requests.post(API_URL, headers=headers, data=data)
    response.raise_for_status() # This will raise an error for bad responses
    return response.json()

# --- THIS IS THE FIXED ENDPOINT ---
@app.route('/api/process', methods=['POST'])
def process_audio():
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files['audio']
    model_type = request.form.get('model_type', 'asr_classification')

    # Map the frontend request to the actual Hugging Face model ID
    if model_type == 'asr_classification':
        model_id = "ooloteam/wav2vec2-somali"
    elif model_type == 'audio_to_audio':
        model_id = "ooloteam/SomaliSpeechToxicityClassifier"
    else:
        return jsonify({"error": f"Invalid model type specified"}), 400

    # We read the bytes from the uploaded file to send to the API
    audio_bytes = audio_file.read()

    try:
        result = query_hf_api(audio_bytes, model_id)
        return jsonify({"status": "success", "result": result})
    except Exception as e:
        return jsonify({"error": f"Error calling Hugging Face API: {str(e)}"}), 500

# --- YOUR OTHER ENDPOINTS (UNCHANGED) ---

@app.route('/api/upload', methods=['POST'])
def upload_audio():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400

    file = request.files['audio']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    filename = secure_filename(f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}")
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)
    return jsonify({'url': f'/uploads/{filename}'})


@app.route('/uploads/<path:filename>')
def serve_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


@app.route('/api/feedback', methods=['POST'])
def submit_feedback():
    # This endpoint should work as long as you have initialized the 'supabase' client correctly
    # using your environment variables.
    data = request.json
    # ... (your existing feedback logic) ...
    return jsonify({"message": "Feedback endpoint called - implement Supabase logic here"})


if __name__ == '__main__':
    app.run(port=5000, debug=True)