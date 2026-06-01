import sys
import json
import cv2
import os

def analyze_video(video_path, start_time, duration):
    # Set up face cascade
    cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    face_cascade = cv2.CascadeClassifier(cascade_path)
    
    if not os.path.exists(video_path):
        print(json.dumps({"error": "Video not found"}))
        sys.exit(1)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(json.dumps({"error": "Cannot open video"}))
        sys.exit(1)

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0: fps = 30
    
    start_frame = int(start_time * fps)
    end_frame = int((start_time + duration) * fps)
    
    cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
    
    frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    # 9:16 crop width
    target_width = int(frame_height * 9 / 16)
    
    # default to center if no face found
    default_x = int((frame_width - target_width) / 2)
    
    face_x_positions = []
    
    frame_count = 0
    while True:
        ret, frame = cap.read()
        if not ret or (cap.get(cv2.CAP_PROP_POS_FRAMES) > end_frame):
            break
            
        # process every 10th frame to speed up (approx 3 fps)
        if frame_count % 10 == 0:
            # Resize frame for faster detection
            small_frame = cv2.resize(frame, (0,0), fx=0.5, fy=0.5)
            gray = cv2.cvtColor(small_frame, cv2.COLOR_BGR2GRAY)
            # detect face
            faces = face_cascade.detectMultiScale(gray, 1.3, 5)
            if len(faces) > 0:
                # pick the largest face
                faces = sorted(faces, key=lambda f: f[2]*f[3], reverse=True)
                x, y, w, h = faces[0]
                
                # Scale back up
                x, y, w, h = x*2, y*2, w*2, h*2
                
                center_x = x + w / 2
                
                # Calculate optimal crop start x
                crop_x = int(center_x - target_width / 2)
                
                # keep within bounds
                crop_x = max(0, min(crop_x, frame_width - target_width))
                face_x_positions.append(crop_x)
                
        frame_count += 1
        
    cap.release()
    
    if len(face_x_positions) > 0:
        # median x
        face_x_positions.sort()
        optimal_x = face_x_positions[len(face_x_positions) // 2]
    else:
        optimal_x = default_x
        
    print(json.dumps({
        "crop_x": optimal_x,
        "crop_y": 0,
        "crop_w": target_width,
        "crop_h": frame_height,
        "found_faces": len(face_x_positions) > 0
    }))

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(json.dumps({"error": "Usage: auto_reframe.py <video_path> <start_time> <duration>"}))
        sys.exit(1)
        
    video_path = sys.argv[1]
    start_time = float(sys.argv[2])
    duration = float(sys.argv[3])
    
    analyze_video(video_path, start_time, duration)
