# Final, corrected code for backend/app.py with the definitive fix

from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import tempfile
from datetime import datetime
from gradio_client import Client

app = Flask(__name__)

# --- Correct CORS Configuration ---
# This explicitly allows your Vercel frontend to make requests.
CORS(app, resources={r"/api/*": {"origins": "https://somali-toxicity-detector.vercel.app"}})

# --- API Endpoints ---
@app.route('/api/process', methods=['POST'])
def process_audio():
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400
    
    audio_file = request.files['audio']
    model_type = request.form.get('model_type')

    # Define the names of your Spaces
    toxicity_space = "ooloteam/SomaliSpeechToxicityClassifier"
    # Make sure this is the correct name for your ASR space when you create it
    asr_space = "ooloteam/wav2vec2-somali-api" 

    if model_type == 'audio_to_audio':
        space_to_call = toxicity_space
    elif model_type == 'asr_classification':
        space_to_call = asr_space
    else:
        return jsonify({"error": "Invalid model type"}), 400

    # Save the uploaded file to a temporary path to send to the client
    temp_dir = tempfile.gettempdir()
    temp_path = os.path.join(temp_dir, secure_filename(audio_file.filename))
    audio_file.save(temp_path)

    try:
        # Connect to the Space using the gradio_client
        client = Client(space_to_call)
        
        # --- THIS IS THE FINAL FIX ---
        # We are now explicitly telling the API that the file is for the 'audio' argument.
        result = client.predict(
            audio=temp_path,
            api_name="/predict" 
        )
        # ---------------------------
        
        os.remove(temp_path)
        return jsonify({"status": "success", "result": result})
        
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500


# --- Your Other Endpoints (No changes needed) ---
@app.route('/api/upload', methods=['POST'])
def upload_audio():
    if 'audio' not in request.files: return jsonify({'error': 'No audio file provided'}), 400
    file = request.files['audio']
    if file.filename == '': return jsonify({'error': 'No file selected'}), 400
    filename = secure_filename(f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}")
    # This UPLOAD_FOLDER logic is for a different feature and can be kept or removed
    UPLOAD_FOLDER = "uploads"
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)
    return jsonify({'url': f'/uploads/{filename}'})


@app.route('/api/feedback', methods=['POST'])
def submit_feedback():
    return jsonify({"message": "Feedback endpoint called"})


if __name__ == '__main__':
    app.run(port=5000, debug=True)
