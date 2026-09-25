import os
import urllib.request

def download_models():
    weights_dir = os.path.join(os.path.dirname(__file__), 'app', 'models', 'weights')
    os.makedirs(weights_dir, exist_ok=True)
    
    yunet_path = os.path.join(weights_dir, 'face_detection_yunet_2023mar.onnx')
    sface_path = os.path.join(weights_dir, 'face_recognition_sface_2021dec.onnx')
    
    yunet_url = 'https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx'
    sface_url = 'https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx'
    
    if not os.path.exists(yunet_path):
        print("Downloading YuNet face detector model...")
        urllib.request.urlretrieve(yunet_url, yunet_path)
        print("YuNet model downloaded successfully!")
    else:
        print("YuNet model already exists.")
        
    if not os.path.exists(sface_path):
        print("Downloading SFace face recognizer model...")
        urllib.request.urlretrieve(sface_url, sface_path)
        print("SFace model downloaded successfully!")
    else:
        print("SFace model already exists.")

if __name__ == '__main__':
    download_models()
