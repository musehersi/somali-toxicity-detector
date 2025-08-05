# from flask import Flask, request, jsonify
# from flask_cors import CORS
# from models.toxicity_classifier import analyze_audio
# import tempfile
# import os
from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from datetime import datetime
import tempfile, os
from flask_cors import CORS
from models.toxicity_classifier import analyze_audio
# from supabase_client import supabase
from uuid import uuid4
from datetime import datetime


app = Flask(__name__)

# Recommended: Use resources to limit CORS only to API routes and specify origins
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:5173",  # Local dev frontend
            "https://your-production-domain.com"  # Your deployed site
        ],
        "supports_credentials": True,
        "methods": ["POST", "GET"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


@app.route('/api/process', methods=['POST'])
def process_audio():
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400
    
    audio_file = request.files['audio']
    model_type = request.form.get('model_type', 'asr_classification')

    # Save to temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp:
        audio_file.save(tmp.name)
        result = analyze_audio(tmp.name, model_type)
    
    os.unlink(tmp.name)
    return jsonify({"status": "success", "result": result})

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
    data = request.json

    try:
        feedback_id = str(uuid4())
        feedback = {
            "id": feedback_id,
            "analysis_id": data.get("recordingId"),
            "user_id": data.get("userId"),  # if user is logged in
            "is_correct": data["feedback"]["correct"],
            "corrected_label": (
                "toxic" if data["feedback"].get("actualToxicity") else "non_toxic"
                if data["feedback"].get("actualToxicity") is not None
                else None
            ),
            "final_label": (
                "toxic" if data["feedback"].get("actualToxicity") else "non_toxic"
                if data["feedback"].get("actualToxicity") is not None
                else data["feedback"]["modelOutputLabel"]
            ),
            "model_output_label": data["feedback"]["modelOutputLabel"],
            "comment": data["feedback"].get("comments"),
            "audio_storage_path": data["feedback"].get("audioStoragePath"),
            "model_type": data["feedback"].get("modelType"),
            "created_at": datetime.utcnow().isoformat()
        }

        res = supabase.table("feedback").insert(feedback).execute()
        if res.error:
            return jsonify({"error": res.error.message}), 500

        return jsonify({"message": "Feedback submitted", "id": feedback_id})

    except Exception as e:
        print("Feedback error:", e)
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(port=5000, debug=True)
