import io
import json
import os
import base64
import urllib.request
import cv2
import numpy as np
from PIL import Image, ImageOps

class FaceRecognitionService:
    """
    Production Deep AI Face Recognition Engine using OpenCV YuNet Face Detector
    (with 5-landmark alignment) & SFace Deep Feature Extractor.
    
    Features:
    1. EXIF orientation correction for mobile/webcam uploads.
    2. YuNet 5-landmark facial detection and canonical crop alignment.
    3. SFace 128-dimensional deep feature embedding generation.
    4. Versioned JSON embedding serialization (version 2).
    5. Backward compatibility support for legacy template fallback.
    """

    # Configurable matching threshold for SFace (Cosine Similarity range: 0.0 to 1.0)
    # SFace benchmark threshold for intra-person verification across lighting/cameras is 0.55
    FACE_SIMILARITY_THRESHOLD = 0.55

    def __init__(self):
        self.weights_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'models', 'weights'))
        self.yunet_path = os.path.join(self.weights_dir, 'face_detection_yunet_2023mar.onnx')
        self.sface_path = os.path.join(self.weights_dir, 'face_recognition_sface_2021dec.onnx')
        self._detector = None
        self._recognizer = None

    def _ensure_models(self):
        """Ensures YuNet and SFace models exist; downloads from official OpenCV releases if missing."""
        os.makedirs(self.weights_dir, exist_ok=True)
        
        yunet_url = "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
        sface_url = "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx"

        if not os.path.exists(self.yunet_path) or os.path.getsize(self.yunet_path) < 10000:
            print("[FACE-SERVICE] Downloading YuNet face detector model...")
            urllib.request.urlretrieve(yunet_url, self.yunet_path)

        if not os.path.exists(self.sface_path) or os.path.getsize(self.sface_path) < 1000000:
            print("[FACE-SERVICE] Downloading SFace face recognizer model...")
            urllib.request.urlretrieve(sface_url, self.sface_path)

        if self._detector is None:
            self._detector = cv2.FaceDetectorYN.create(
                model=self.yunet_path,
                config="",
                input_size=(300, 300),
                score_threshold=0.60,
                nms_threshold=0.30,
                top_k=5000
            )

        if self._recognizer is None:
            self._recognizer = cv2.FaceRecognizerSF.create(
                model=self.sface_path,
                config=""
            )

    @staticmethod
    def decode_image_data(image_data_str: str) -> Image.Image:
        """Decodes base64 data URL or raw base64 string to a PIL Image with EXIF orientation correction."""
        if not image_data_str or not isinstance(image_data_str, str):
            raise ValueError("Invalid image data provided.")

        raw_str = image_data_str.strip()
        if raw_str.lower().startswith("%pdf") or "application/pdf" in raw_str.lower():
            raise ValueError("PDF files are not supported. Please upload a JPG, JPEG, PNG, or WEBP image.")

        if "," in raw_str:
            header, base64_data = raw_str.split(",", 1)
            if "pdf" in header.lower():
                raise ValueError("PDF files are not supported. Please upload a JPG, JPEG, PNG, or WEBP image.")
        else:
            base64_data = raw_str

        try:
            image_bytes = base64.b64decode(base64_data)
        except Exception:
            raise ValueError("Corrupted or invalid base64 image data.")

        if image_bytes.startswith(b"%PDF"):
            raise ValueError("PDF files are not supported. Please upload a JPG, JPEG, PNG, or WEBP image.")

        try:
            img = Image.open(io.BytesIO(image_bytes))
            img.verify()
            img = Image.open(io.BytesIO(image_bytes))
            img.load()
            # Correct EXIF orientation for mobile phone/camera photos
            img = ImageOps.exif_transpose(img)
            return img
        except Exception:
            raise ValueError("Please upload a valid JPG, JPEG, PNG, or WEBP image.")

    def extract_face_vector(self, img: Image.Image) -> np.ndarray:
        """
        Detects, aligns, and extracts a normalized 128-dimensional SFace deep feature vector.
        Performs 5-landmark alignment using YuNet and enforces strict single-face & quality checks.
        """
        self._ensure_models()

        rgb_img = img.convert("RGB")
        w, h = rgb_img.size

        if w < 40 or h < 40:
            raise ValueError("Image resolution is too low. Please try again with a clearer photo.")

        bgr_img = cv2.cvtColor(np.array(rgb_img), cv2.COLOR_RGB2BGR)

        # Update input size for current image
        self._detector.setInputSize((w, h))

        _, faces = self._detector.detect(bgr_img)

        if faces is None or len(faces) == 0:
            raise ValueError("No face detected. Please ensure your face is clearly visible and well-lit.")

        if len(faces) > 1:
            raise ValueError("Multiple faces detected. Please make sure only one face is visible.")

        face = faces[0]
        confidence = float(face[14])
        bbox_w, bbox_h = float(face[2]), float(face[3])

        if confidence < 0.60:
            raise ValueError("No clear face detected. Please face the camera directly under good lighting.")

        if bbox_w < 35 or bbox_h < 35:
            raise ValueError("Face is too far away. Please move closer to the camera.")

        # Perform 5-landmark facial alignment & crop
        aligned_face = self._recognizer.alignCrop(bgr_img, face)

        # Extract 128-dimensional SFace deep feature embedding
        feature_embedding = self._recognizer.feature(aligned_face)
        vec = feature_embedding.flatten()

        # Unit L2 normalization
        vec_norm = np.linalg.norm(vec)
        if vec_norm > 0:
            vec = vec / vec_norm

        return vec

    @classmethod
    def compute_similarity(cls, vec1: np.ndarray, vec2: np.ndarray) -> float:
        """Computes Cosine Similarity between two normalized 128-dim SFace vectors (range: 0.0 to 1.0)."""
        if vec1 is None or vec2 is None or len(vec1) == 0 or len(vec2) == 0:
            return 0.0

        if len(vec1) != len(vec2):
            return 0.0

        dot = float(np.dot(vec1, vec2))
        return max(0.0, min(1.0, dot))

    @classmethod
    def serialize_vector(cls, vec: np.ndarray, version: int = 2) -> str:
        """Serializes numpy vector to versioned JSON string for database storage."""
        payload = {
            "version": version,
            "model": "SFace",
            "vector": vec.tolist()
        }
        return json.dumps(payload)

    @classmethod
    def deserialize_vector(cls, json_str: str) -> tuple:
        """
        Deserializes JSON string to a tuple: (version: int, vector: np.ndarray).
        Supports both version 2 SFace JSON objects and legacy version 1 JSON lists.
        """
        if not json_str:
            raise ValueError("Empty face embedding string.")

        parsed = json.loads(json_str)
        if isinstance(parsed, dict) and "version" in parsed:
            ver = parsed.get("version", 2)
            vec = np.array(parsed.get("vector", []), dtype=np.float32)
            return (ver, vec)

        if isinstance(parsed, list):
            return (1, np.array(parsed, dtype=np.float32))

        raise ValueError("Unknown face embedding format.")

face_service = FaceRecognitionService()
