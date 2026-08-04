import os
import io
import re
import base64
import sqlite3
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from PIL import Image
import numpy as np
import pytesseract
from utils import preprocess_image

# Configuration
BASE_DIR = os.path.dirname(__file__)
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
DB_PATH = os.path.join(BASE_DIR, 'tess_results.db')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# --- Database helpers ---

def get_db_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute('''
        CREATE TABLE IF NOT EXISTS processed_photos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            punch_id TEXT,
            filename TEXT,
            extracted_text TEXT,
            confidence REAL,
            created_at TEXT
        )
    ''')
    conn.commit()
    conn.close()


init_db()


# --- Utilities ---

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def extract_digits_and_confidence(pil_image):
    """
    Run Tesseract OCR configured to read digits and return the digit string + a simple confidence metric.
    """
    # Ensure image is in RGB mode for pytesseract
    img_rgb = pil_image.convert("RGB")

    # Full OCR (digits-only) using image_to_string
    config = '-c tessedit_char_whitelist=0123456789 --psm 7'
    raw = pytesseract.image_to_string(img_rgb, config=config)
    digits = re.sub(r"[^0-9]", "", raw)

    # For confidence, use image_to_data and compute mean confidence of boxes containing digits
    try:
        data = pytesseract.image_to_data(img_rgb, config=config, output_type=pytesseract.Output.DICT)
        confs = []
        for text, conf in zip(data.get('text', []), data.get('conf', [])):
            if not text:
                continue
            if re.search(r"[0-9]", text):
                try:
                    c = float(conf)
                    if c >= 0:
                        confs.append(c)
                except Exception:
                    continue
        confidence = float(np.mean(confs)) if confs else None
    except Exception:
        confidence = None

    return digits, confidence


# --- Image processing + storage ---

def process_and_store(image_bytes, punch_id=None):
    # Preprocess image and run OCR
    pil = preprocess_image(image_bytes)

    digits, confidence = extract_digits_and_confidence(pil)

    # Save processed image to uploads
    timestamp = datetime.utcnow().strftime('%Y%m%dT%H%M%S%f')
    filename = f"photo_{timestamp}.jpg"
    path = os.path.join(UPLOAD_FOLDER, filename)
    pil.convert('RGB').save(path, format='JPEG', quality=85)

    # Store result
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute(
        'INSERT INTO processed_photos (punch_id, filename, extracted_text, confidence, created_at) VALUES (?, ?, ?, ?, ?)',
        (punch_id, filename, digits if digits else None, confidence, datetime.utcnow().isoformat())
    )
    conn.commit()
    inserted_id = cur.lastrowid
    conn.close()

    return {
        'id': inserted_id,
        'punch_id': punch_id,
        'filename': filename,
        'extracted_text': digits,
        'confidence': confidence,
    }


# --- API Endpoints ---

@app.route('/process-photo', methods=['POST'])
def process_photo():
    """
    Accepts either multipart/form-data with file field 'photo' or JSON {"photo_base64": "..."}.
    Optional form field / query param 'punch_id' to link result to a punch.
    Returns extracted digits (if any) and confidence.
    """
    punch_id = request.form.get('punch_id') or request.args.get('punch_id')

    # Multipart file
    if 'photo' in request.files:
        f = request.files['photo']
        if f.filename == '':
            return jsonify({'error': 'No selected file'}), 400
        if not allowed_file(f.filename):
            return jsonify({'error': 'File type not allowed'}), 400
        image_bytes = f.read()

    else:
        # JSON base64
        data = request.get_json(silent=True) or {}
        b64 = data.get('photo_base64')
        if not b64:
            return jsonify({'error': 'No photo provided'}), 400
        # Accept data URLs like data:image/jpeg;base64,...
        if b64.startswith('data:'):
            b64 = b64.split(',', 1)[1]
        try:
            image_bytes = base64.b64decode(b64)
        except Exception:
            return jsonify({'error': 'Invalid base64 image data'}), 400

    try:
        result = process_and_store(image_bytes, punch_id=punch_id)
        return jsonify({'ok': True, 'result': result}), 200
    except Exception as e:
        return jsonify({'error': 'Processing failed', 'details': str(e)}), 500


@app.route('/results', methods=['GET'])
def list_results():
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute('SELECT id, punch_id, filename, extracted_text, confidence, created_at FROM processed_photos ORDER BY created_at DESC')
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return jsonify({'results': rows})


@app.route('/results/<int:result_id>', methods=['GET'])
def get_result(result_id):
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute('SELECT id, punch_id, filename, extracted_text, confidence, created_at FROM processed_photos WHERE id = ?', (result_id,))
    row = cur.fetchone()
    conn.close()
    if not row:
        return jsonify({'error': 'Not found'}), 404
    return jsonify({'result': dict(row)})


@app.route('/uploads/<path:filename>', methods=['GET'])
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
