import sys
import json
import os

try:
    import cv2
except Exception as e:  # pragma: no cover - env without opencv
    print(json.dumps({"error": "opencv-not-available: %s" % e}))
    sys.exit(0)


def analyze_video(video_path, start_time, duration):
    cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    face_cascade = cv2.CascadeClassifier(cascade_path)

    if not os.path.exists(video_path):
        print(json.dumps({"error": "Video not found"}))
        return

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(json.dumps({"error": "Cannot open video"}))
        return

    fps = cap.get(cv2.CAP_PROP_FPS)
    if not fps or fps <= 0:
        fps = 30.0

    frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1920
    frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 1080

    # 9:16 crop width based on full height.
    target_width = int(frame_height * 9 / 16)

    # If the source is already narrower than 9:16 there is nothing to pan.
    if target_width >= frame_width:
        print(json.dumps({
            "crop_x": 0,
            "crop_y": 0,
            "crop_w": frame_width,
            "crop_h": frame_height,
            "found_faces": False,
            "note": "source-narrower-than-9x16"
        }))
        cap.release()
        return

    default_x = int((frame_width - target_width) / 2)

    start_frame = int(start_time * fps)
    end_frame = int((start_time + duration) * fps)
    cap.set(cv2.CAP_PROP_POS_FRAMES, max(0, start_frame))

    face_x_positions = []
    frame_count = 0
    # Sample roughly 3 frames/sec regardless of source fps.
    sample_step = max(1, int(round(fps / 3.0)))

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if cap.get(cv2.CAP_PROP_POS_FRAMES) > end_frame:
            break

        if frame_count % sample_step == 0:
            small_frame = cv2.resize(frame, (0, 0), fx=0.5, fy=0.5)
            gray = cv2.cvtColor(small_frame, cv2.COLOR_BGR2GRAY)
            gray = cv2.equalizeHist(gray)
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=5, minSize=(30, 30))
            if len(faces) > 0:
                # Largest (closest) face wins.
                faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
                x, y, w, h = faces[0]
                x, w = x * 2, w * 2  # undo the 0.5 resize
                center_x = x + w / 2.0
                crop_x = int(center_x - target_width / 2.0)
                crop_x = max(0, min(crop_x, frame_width - target_width))
                face_x_positions.append(crop_x)

        frame_count += 1

    cap.release()

    found = len(face_x_positions) > 0
    if found:
        # Temporal smoothing: trimmed mean reduces jitter from spurious
        # detections while still tracking real subject movement.
        face_x_positions.sort()
        n = len(face_x_positions)
        trim = n // 10  # drop the most extreme 10% on each side
        core = face_x_positions[trim:n - trim] if n - 2 * trim > 0 else face_x_positions
        optimal_x = int(round(sum(core) / len(core)))
        optimal_x = max(0, min(optimal_x, frame_width - target_width))
    else:
        optimal_x = default_x

    print(json.dumps({
        "crop_x": optimal_x,
        "crop_y": 0,
        "crop_w": target_width,
        "crop_h": frame_height,
        "found_faces": found,
        "samples": len(face_x_positions)
    }))


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(json.dumps({"error": "Usage: auto_reframe.py <video_path> <start_time> <duration>"}))
        sys.exit(1)

    video_path = sys.argv[1]
    try:
        start_time = float(sys.argv[2])
        duration = float(sys.argv[3])
    except ValueError:
        print(json.dumps({"error": "start_time and duration must be numbers"}))
        sys.exit(1)

    analyze_video(video_path, start_time, duration)
