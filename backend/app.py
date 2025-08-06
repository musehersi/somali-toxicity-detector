# Final, complete code for backend/app.py

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import requests
from datetime import datetime
import base64 # Required to encode audio for the API call

app = Flask(__name__)
CORS(app)

# --- Configuration ---
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def call_space_api(audio_bytes, space_url):
    """
    Helper function to correctly call a Gradio Space API.
    """
    b64_audio = base64.b64encode(audio_bytes).decode()
    
    response = requests.post(
        space_url,
        json={"data": [ f"data:audio/wav;base64,{b64_audio}" ]}
    )
    response.raise_for_status()
    return response.json()

# --- API Endpoints ---
@app.route('/api/process', methods=['POST'])
def process_audio():
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400
    
    audio_file = request.files['audio']
    model_type = request.form.get('model_type')

    # --- YOUR SPACE URL IS ADDED HERE ---
    if model_type == 'audio_to_audio':
        # This is the direct API URL for your working Space.
        space_api_url = "https://ooloteam-somalitoxicityclassifier.hf.space/api/predict/"
    elif model_type == 'asr_classification':
        # We will add the ASR Space URL here later.
        return jsonify({"error": "ASR model is not connected yet. Please test the End-to-End model."}), 400
    else:
        return jsonify({"error": "Invalid model type"}), 400
    # ------------------------------------

    audio_bytes = audio_file.read()

    try:
        api_response = call_space_api(audio_bytes, space_api_url)
        prediction_data = api_response.get("data", [{}])[0]
        return jsonify({"status": "success", "result": prediction_data})
    except Exception as e:
        return jsonify({"error": f"An error occurred while calling the Space API: {str(e)}"}), 500


# --- Your Other Endpoints (No changes needed) ---
@app.route('/api/upload', methods=['POST'])
def upload_audio():
    if 'audio' not in request.files: return jsonify({'error': 'No audio file provided'}), 400
    file = request.files['audio']
    if file.filename == '': return jsonify({'error': 'No file selected'}), 400
    filename = secure_filename(f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}")
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)
    return jsonify({'url': f'/uploads/{filename}'})


@app.route('/uploads/<path:filename>')
def serve_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


@app.route('/api/feedback', methods=['POST'])
def submit_feedback():
    return jsonify({"message": "Feedback endpoint called"})


if __name__ == '__main__':
    app.run(port=5000, debug=True)
