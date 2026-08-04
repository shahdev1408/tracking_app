# Tesseract OCR prototype (Flask)

This small prototype service accepts uploaded punch photos, runs pre-processing and Tesseract OCR (digits-only), stores results in a local SQLite DB, and exposes endpoints to fetch results.

Prerequisites
- Python 3.8+
- Tesseract binary installed on the host machine
  - Windows: https://github.com/UB-Mannheim/tesseract/wiki
  - Linux: apt install tesseract-ocr
  - macOS: brew install tesseract
- (Optional) Create and activate a Python virtualenv

Install Python deps
  pip install -r requirements.txt

Run the Flask app (development)
  python app.py

API
- POST /process-photo
  - multipart/form-data: field 'photo' (file), optional field 'punch_id'
  - OR JSON: { "photo_base64": "data:image/jpeg;base64,...", "punch_id": "..." }
  - Returns: { ok: true, result: { id, punch_id, filename, extracted_text, confidence } }

- GET /results
  - Lists processed photos and extracted values

- GET /results/<id>
  - Returns single processed result

Notes
- This prototype saves processed (preprocessed) images in uploads/ and stores OCR results in a local SQLite DB tess_results.db.
- Tesseract accuracy improves when images are cropped to the odometer/ticket region and when good lighting is used.
- Later improvements: add region-of-interest detection, allow admin to define templates, run async worker (worker.py) for heavy loads.
