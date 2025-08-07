# Final, corrected code for backend/app.py with proper CORS

from flask import Flask, request, jsonify
from flask_cors import CORS # Make sure CORS is imported
from werkzeug.utils import secure_filename
import os
import tempfile
from datetime import datetime
from gradio_client import Client

app = Flask(__name__)

# --- THIS IS THE CRUCIAL FIX ---
# We are explicitly telling the server to allow requests from your Vercel frontend.
CORS(app, resources={r"/api/*": {"origins": "https://somali-toxicity-detector.vercel.app"}})
# -----------------------------


# --- API Endpoints ---
@app.route('/api/process', methods=['POST'])
def process_audio():
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400
    
    audio_file = request.files['audio']
    model_type = request.form.get('model_type')

    # Define the names of your Spaces
    toxicity_space = "ooloteam/SomaliSpeechToxicityClassifier"
    asr_space = "ooloteam/wav2vec2-somali-api" # Make sure this is the correct name

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
        
        # The .predict() method calls the API correctly
        result = client.predict(
            temp_path,
            api_name="/predict" 
        )
        
        os.remove(temp_path)
        return jsonify({"status": "success", "result": result})
        
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

# --- Your Other Endpoints ---
# (No other changes are needed)

if __name__ == '__main__':
    app.run(port=5000, debug=True)
