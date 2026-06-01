import sys
import json
import os
import re
from youtube_transcript_api import YouTubeTranscriptApi

def analyze_video_content(video_id, title, description, total_duration):
    # Detect if video is educational/narrative based on title & description
    edu_keywords = [
        "belajar", "tutorial", "cara", "class", "kursus", "edukasi", "kuliah", 
        "sejarah", "explanation", "narrative", "audiobook", "podcast", "buku",
        "lesson", "education", "teacher", "guru", "dosen", "pendidikan", "sekolah"
    ]
    
    text_to_scan = (title + " " + description).lower()
    is_educational = any(kw in text_to_scan for kw in edu_keywords)
    
    transcript = []
    try:
        # Fetch transcript, try Indonesian first, fallback to English
        transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=['id', 'en'])
    except Exception as e:
        # Gracefully handle if no transcript is available
        pass
        
    clips = []
    
    if transcript and len(transcript) > 5:
        # Heuristic segment finder based on punctuation/pauses in transcript
        # We group transcripts into sentences or groups of ~10-15 seconds
        segments = []
        current_segment = []
        segment_start = transcript[0]['start']
        
        for i, item in enumerate(transcript):
            current_segment.append(item)
            text = item['text']
            
            # Check for punctuation indicating sentence end or a substantial silent pause
            is_end_sentence = text.endswith('.') or text.endswith('?') or text.endswith('!')
            time_gap = 0
            if i < len(transcript) - 1:
                time_gap = transcript[i+1]['start'] - (item['start'] + item['duration'])
                
            segment_duration = (item['start'] + item['duration']) - segment_start
            
            # If pause is > 0.6 seconds or sentence ended and segment is > 8s, or if segment exceeds 15s
            if (time_gap > 0.6 or is_end_sentence) and segment_duration >= 6.0 or segment_duration > 15.0:
                full_text = " ".join([t['text'] for t in current_segment])
                segments.append({
                    "start": segment_start,
                    "duration": segment_duration,
                    "text": full_text
                })
                # Start next segment
                if i < len(transcript) - 1:
                    segment_start = transcript[i+1]['start']
                    current_segment = []
        
        # Add the last segment if any left
        if current_segment:
            full_text = " ".join([t['text'] for t in current_segment])
            segments.append({
                "start": segment_start,
                "duration": (current_segment[-1]['start'] + current_segment[-1]['duration']) - segment_start,
                "text": full_text
            })
            
        # Select 5 best segments distributed across the video
        if len(segments) >= 5:
            step = len(segments) / 5
            selected_indices = [int(i * step) for i in range(5)]
            picked_segments = [segments[idx] for idx in selected_indices]
        else:
            # Not enough segments, fallback to default math division
            picked_segments = []
    else:
        picked_segments = []
        
    # If transcript division failed, fall back to duration-based division
    if not picked_segments:
        clip_len = min(12.0, max(6.0, total_duration / 5.5))
        for i in range(5):
            start = min(max(0.0, (total_duration - clip_len) * i / 4.0), max(0.0, total_duration - clip_len - 0.5))
            picked_segments.append({
                "start": start,
                "duration": clip_len,
                "text": f"Momen kunci ke-{i+1} dari video."
            })
            
    # Process segment into final clips
    categories = ["Hero Clip", "Primary Cut", "Primary Cut", "Support Cut", "Support Cut"]
    clip_labels = ["Primary Cut", "Primary Cut", "Primary Cut", "Secondary Cut", "Secondary Cut"]
    
    for i, seg in enumerate(picked_segments):
        # Extract a punchy text sentence for title
        clean_text = re.sub(r'\[.*?\]', '', seg['text']).strip() # remove bracket info
        words = clean_text.split()
        if len(words) > 8:
            punchy_title = " ".join(words[:8]) + "..."
        else:
            punchy_title = clean_text if clean_text else f"Klip Terbaik #{i+1}"
            
        # Capitalize first letter
        punchy_title = punchy_title[0].upper() + punchy_title[1:] if punchy_title else f"Klip Terbaik #{i+1}"
        
        # Prefix type of cut in title
        if is_educational:
            prefix = "[EDUKASI]"
        else:
            prefix = "[NARRATIVE]" if i % 2 == 0 else "[SPIKE]"
            
        title_format = f"{prefix} {punchy_title}"
        
        # Subtitles simulation/timings formatting
        simulated_subs = [{"text": clean_text[:45], "emphasis": [words[0]] if words else []}]
        
        clips.append({
            "start": round(seg['start'], 2),
            "duration": round(seg['duration'], 2),
            "title": title_format,
            "category": "Educational Value" if is_educational else "Hook & Retention",
            "editorialPriority": categories[i],
            "clipLabel": clip_labels[i],
            "subtitles": simulated_subs,
            "hook_text": f"Hook terkuat: {title_format} | {title}"
        })
        
    print(json.dumps({
        "is_educational": is_educational,
        "clips": clips
    }))

if __name__ == "__main__":
    if len(sys.argv) < 5:
        print(json.dumps({"error": "Usage: analyze_content.py <video_id> <title> <description> <duration>"}))
        sys.exit(1)
        
    video_id = sys.argv[1]
    title = sys.argv[2]
    description = sys.argv[3]
    duration = float(sys.argv[4])
    
    analyze_video_content(video_id, title, description, duration)
