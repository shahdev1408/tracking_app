import cv2
import numpy as np
from PIL import Image


def preprocess_image(image_bytes):
    """
    Receives raw image bytes, returns a PIL Image after preprocessing:
    - Convert to grayscale
    - Resize if very large
    - Apply denoise and adaptive threshold to improve OCR for digits
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError('Could not decode image bytes')

    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Resize to manageable width while keeping aspect ratio
    h, w = gray.shape[:2]
    max_w = 1200
    if w > max_w:
        scale = max_w / float(w)
        gray = cv2.resize(gray, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    # Denoise
    gray = cv2.fastNlMeansDenoising(gray, None, h=10, templateWindowSize=7, searchWindowSize=21)

    # Enhance contrast with CLAHE
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    gray = clahe.apply(gray)

    # Adaptive threshold to binarize (works well for digits)
    th = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 15)

    # Convert back to PIL Image
    pil_img = Image.fromarray(th)
    return pil_img
