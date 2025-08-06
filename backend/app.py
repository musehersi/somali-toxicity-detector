# Final, corrected code for backend/app.py

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import requests
from datetime import datetime
import base64 # Import for encoding audio

app = Flask(__name__)
CORS(app)

# --- Configuration ---
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
# You will need to add your SUPABASE_URL and SUPABASE_KEY to Render
# supabase_url = os.getenv("SUPABASE_URL")
# supabase_key = os.getenv("SUPABASE_KEY")
# supabase = create_client(supabase_url, supabase_key)


def call_space_api(audio_bytes, space_url):
    """
    Helper function to correctly call a Gradio Space API.
    It encodes the audio in Base64 and sends it in the required JSON format.
    """
    # Encode the raw audio bytes into a Base64 string
    b64_audio = base64.b64encode(audio_bytes).decode()
    
    # The Gradio API expects data in this specific JSON structure
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

    # --- IMPORTANT: UPDATE THESE URLS ---
    # Get these from the "Embed this Space" option on your HF Spaces
    if model_type == 'audio_to_audio':
        # Paste the API URL for your TOXICITY CLASSIFIER SPACE here
        # It should end with /api/predict/
        space_api_url = "YOUR_TOXICITY_CLASSIFIER_SPACE_API_URL_HERE" 
    elif model_type == 'asr_classification':
        # Paste the API URL for your ASR SPACE here
        # It should also end with /api/predict/
        space_api_url = "YOUR_ASR_SPACE_API_URL_HERE" 
    else:
        return jsonify({"error": "Invalid model type"}), 400
    # ------------------------------------

    audio_bytes = audio_file.read()

    try:
        # Call your new Space API with the correct helper function
        api_response = call_space_api(audio_bytes, space_api_url)
        
        # Extract the actual prediction from the Gradio API response
        prediction_data = api_response.get("data", [{}])[0]
        
        return jsonify({"status": "success", "result": prediction_data})
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500


# --- Your Other Endpoints ---

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
    # Your feedback logic here. Make sure to initialize the Supabase client.
    return jsonify({"message": "Feedback endpoint called"})


if __name__ == '__main__':
    app.run(port=5000, debug=True)
