import sys
import json
import os
import re

try:
    from youtube_transcript_api import YouTubeTranscriptApi
except Exception:
    YouTubeTranscriptApi = None


def _normalize_entry(item):
    """Return a plain dict {text, start, duration} from either a dict or an
    object, tolerating the API changes across youtube_transcript_api versions."""
    if isinstance(item, dict):
        return {
            "text": item.get("text", ""),
            "start": float(item.get("start", 0) or 0),
            "duration": float(item.get("duration", 0) or 0),
        }
    # Newer versions return FetchedTranscriptSnippet objects with attributes.
    return {
        "text": getattr(item, "text", "") or "",
        "start": float(getattr(item, "start", 0) or 0),
        "duration": float(getattr(item, "duration", 0) or 0),
    }


def fetch_transcript(video_id):
    """Fetch a transcript across the many youtube_transcript_api versions.
    Returns a list of {text, start, duration} dicts (possibly empty)."""
    if YouTubeTranscriptApi is None:
        return []

    languages = ["id", "en"]

    # Strategy 1: legacy static get_transcript()
    try:
        raw = YouTubeTranscriptApi.get_transcript(video_id, languages=languages)
        return [_normalize_entry(x) for x in raw]
    except Exception:
        pass

    # Strategy 2: new instance API .fetch()
    try:
        api = YouTubeTranscriptApi()
        raw = api.fetch(video_id, languages=languages)
        return [_normalize_entry(x) for x in raw]
    except Exception:
        pass

    # Strategy 3: list_transcripts() then take the first available
    try:
        listing = YouTubeTranscriptApi.list_transcripts(video_id)
        for t in listing:
            try:
                return [_normalize_entry(x) for x in t.fetch()]
            except Exception:
                continue
    except Exception:
        pass

    return []


def score_segment(seg):
    """Score a segment by word count and sentence completeness — higher = better."""
    words = seg['text'].split()
    word_count = len(words)
    text = seg['text']
    # Prefer segments that end with punctuation (complete thought)
    completeness_bonus = 1.5 if text.rstrip().endswith(('.', '!', '?')) else 1.0
    # Prefer segments longer than 20s
    duration_bonus = 1.3 if seg['duration'] >= 25.0 else 1.0
    return word_count * completeness_bonus * duration_bonus


# Words that tend to signal a strong hook / high-retention moment.
HOOK_KEYWORDS = [
    "rahasia", "ternyata", "jangan", "kesalahan", "penting", "hati-hati",
    "terbaik", "gratis", "cara", "tips", "trik", "kenapa", "bagaimana",
    "harus", "wajib", "gila", "shock", "viral", "fakta", "bukti", "hasil",
    "secret", "mistake", "never", "always", "best", "how", "why", "stop",
    "warning", "proven", "truth", "hack", "money", "free", "you", "now"
]


def compute_virality_score(seg, total_duration):
    """
    Estimate a 0-10 virality/engagement score from real transcript signals:
      - speaking density (words per second) → energetic, information-rich
      - hook keyword presence → attention grabbers
      - sentence completeness → clean, self-contained clip
      - ideal duration window (25-50s) → best for Shorts/Reels retention
    Deterministic (no randomness) so results are stable and explainable.
    """
    text = (seg.get('text') or '').strip()
    words = text.split()
    word_count = len(words)
    duration = max(1.0, float(seg.get('duration') or 1.0))

    if word_count == 0:
        return 6.5  # neutral baseline for non-transcript fallback clips

    # 1. Speaking density: ~2.2 words/sec is lively; normalise around that.
    wps = word_count / duration
    density_score = max(0.0, min(1.0, wps / 2.6))

    # 2. Hook keywords present in the segment.
    lowered = text.lower()
    hook_hits = sum(1 for kw in HOOK_KEYWORDS if kw in lowered)
    hook_score = min(1.0, hook_hits / 4.0)

    # 3. Sentence completeness.
    completeness = 1.0 if text.rstrip().endswith(('.', '!', '?')) else 0.55

    # 4. Duration sweet spot (peaks around 25-50s).
    if 25.0 <= duration <= 50.0:
        duration_score = 1.0
    elif duration < 25.0:
        duration_score = max(0.4, duration / 25.0)
    else:
        duration_score = max(0.5, 1.0 - (duration - 50.0) / 60.0)

    # Weighted blend → 0..1
    blended = (
        0.34 * density_score +
        0.30 * hook_score +
        0.16 * completeness +
        0.20 * duration_score
    )

    # Map to a friendly 7.0 - 9.9 range (matches the product's scoring UI).
    score = 7.0 + blended * 2.9
    return round(min(9.9, max(6.5, score)), 1)


def build_word_timeline(entries, seg_start, hook_keywords):
    """
    Convert raw transcript entries (each {text,start,duration}) into subtitle
    lines with REAL per-word timings relative to the clip start.
    Groups words into readable <=45-char lines and estimates per-word timing
    by distributing each transcript entry's duration across its own words.
    Returns a list of {text, emphasis, start, end, words:[{word,start,end,emphasized}]}.
    """
    lines = []
    cur_words = []          # [{word, start, end, emphasized}]
    cur_chars = 0

    def flush():
        nonlocal cur_words, cur_chars
        if not cur_words:
            return
        text = " ".join(w["word"] for w in cur_words)
        emphasis = [w["word"] for w in cur_words if w["emphasized"]]
        if not emphasis:
            emphasis = [cur_words[0]["word"]]
        lines.append({
            "text": text,
            "emphasis": emphasis,
            "start": round(cur_words[0]["start"], 2),
            "end": round(cur_words[-1]["end"], 2),
            "words": cur_words
        })
        cur_words = []
        cur_chars = 0

    for entry in entries or []:
        etext = re.sub(r'\[.*?\]', '', entry.get("text", "")).strip()
        ewords = etext.split()
        if not ewords:
            continue
        e_start = float(entry.get("start", 0) or 0) - seg_start
        e_dur = float(entry.get("duration", 0) or 0)
        if e_dur <= 0:
            e_dur = max(0.6, len(ewords) * 0.28)
        per = e_dur / len(ewords)

        for wi, word in enumerate(ewords):
            w_start = max(0.0, e_start + wi * per)
            w_end = w_start + per
            clean = re.sub(r'[^\w-]', '', word, flags=re.UNICODE).lower()
            is_caps = word.isupper() and len(re.sub(r'[^\w]', '', word)) > 2
            emphasized = is_caps or any(kw == clean or kw in clean for kw in hook_keywords)

            if cur_chars + len(word) + 1 > 45 and cur_words:
                flush()
            cur_words.append({
                "word": word,
                "start": round(w_start, 2),
                "end": round(w_end, 2),
                "emphasized": bool(emphasized)
            })
            cur_chars += len(word) + 1

    flush()
    return lines[:8]  # cap lines to keep captions readable

def analyze_video_content(video_id, title, description, total_duration, num_clips=5):
    # Detect if video is educational/narrative based on title & description
    edu_keywords = [
        "belajar", "tutorial", "cara", "class", "kursus", "edukasi", "kuliah",
        "sejarah", "explanation", "narrative", "audiobook", "podcast", "buku",
        "lesson", "education", "teacher", "guru", "dosen", "pendidikan", "sekolah"
    ]

    text_to_scan = (title + " " + description).lower()
    is_educational = any(kw in text_to_scan for kw in edu_keywords)

    # Fetch transcript, tolerant of every youtube_transcript_api version.
    transcript = fetch_transcript(video_id)

    # ----------------------------------------------------------------
    # Target clip duration: 30-60 seconds (ideal for Shorts/Reels)
    # ----------------------------------------------------------------
    TARGET_MIN = 25.0   # minimum clip duration in seconds
    TARGET_MAX = 60.0   # maximum clip duration in seconds
    TARGET_IDEAL = 40.0 # ideal target duration

    segments = []

    if transcript and len(transcript) > 5:
        # Build segments by accumulating transcript entries until we hit the target duration
        current_segment = []
        segment_start = transcript[0]['start']

        for i, item in enumerate(transcript):
            current_segment.append(item)
            segment_duration = (item['start'] + item.get('duration', 0)) - segment_start
            text = item['text']

            is_end_sentence = text.rstrip().endswith(('.', '?', '!'))
            time_gap = 0
            if i < len(transcript) - 1:
                time_gap = transcript[i + 1]['start'] - (item['start'] + item.get('duration', 0))

            # Commit segment when:
            # - Reached ideal duration AND at a sentence boundary or pause
            # - OR exceeded max duration
            at_boundary = is_end_sentence or time_gap > 0.8
            if (segment_duration >= TARGET_IDEAL and at_boundary) or segment_duration >= TARGET_MAX:
                full_text = " ".join([t['text'] for t in current_segment])
                segments.append({
                    "start": round(segment_start, 2),
                    "duration": round(min(segment_duration, TARGET_MAX), 2),
                    "text": full_text,
                    "entries": list(current_segment)
                })
                # Begin next segment after the gap
                if i < len(transcript) - 1:
                    segment_start = transcript[i + 1]['start']
                    current_segment = []

        # Flush remaining if it meets minimum
        if current_segment:
            seg_dur = (current_segment[-1]['start'] + current_segment[-1].get('duration', 0)) - segment_start
            if seg_dur >= TARGET_MIN:
                full_text = " ".join([t['text'] for t in current_segment])
                segments.append({
                    "start": round(segment_start, 2),
                    "duration": round(seg_dur, 2),
                    "text": full_text,
                    "entries": list(current_segment)
                })

    # ----------------------------------------------------------------
    # Select best N segments: score by content quality, spread evenly
    # ----------------------------------------------------------------
    if len(segments) >= num_clips:
        # Divide video into N equal zones, pick best-scored segment per zone
        picked_segments = []
        zone_size = len(segments) / num_clips
        for zone_i in range(num_clips):
            zone_start = int(zone_i * zone_size)
            zone_end = int((zone_i + 1) * zone_size)
            zone_segs = segments[zone_start:zone_end]
            if zone_segs:
                best = max(zone_segs, key=score_segment)
                picked_segments.append(best)
    elif len(segments) > 0:
        # Score and sort what we have, take top num_clips
        scored = sorted(segments, key=score_segment, reverse=True)
        picked_segments = sorted(scored[:num_clips], key=lambda s: s['start'])
    else:
        picked_segments = []

    # ----------------------------------------------------------------
    # Fallback: duration-based division with 30-60s clips
    # ----------------------------------------------------------------
    if not picked_segments:
        clip_len = min(TARGET_MAX, max(TARGET_MIN, total_duration / (num_clips * 0.8)))
        for i in range(num_clips):
            start_pos = (total_duration - clip_len) * i / max(1, num_clips - 1)
            start = round(min(max(0.0, start_pos), max(0.0, total_duration - clip_len - 0.5)), 2)
            picked_segments.append({
                "start": start,
                "duration": round(clip_len, 2),
                "text": f"Momen kunci ke-{i + 1} dari video."
            })

    # ----------------------------------------------------------------
    # Build final clip metadata
    # ----------------------------------------------------------------
    categories = ["Hero Clip", "Primary Cut", "Primary Cut", "Support Cut", "Support Cut"]
    clip_labels = ["Primary Cut", "Primary Cut", "Primary Cut", "Secondary Cut", "Secondary Cut"]

    # Clean the YouTube title
    clean_yt_title = re.sub(r'[\(\[\{].*?[\)\]\}]', '', title)
    clean_yt_title = re.sub(r'\s*\|\s*.*$', '', clean_yt_title)
    clean_yt_title = re.sub(r'\s*-\s*.*$', '', clean_yt_title)
    clean_yt_title = clean_yt_title.strip()
    if not clean_yt_title or clean_yt_title.lower() == "video youtube":
        clean_yt_title = "Klip Terpilih"

    clips = []
    for i, seg in enumerate(picked_segments):
        clean_text = re.sub(r'\[.*?\]', '', seg['text']).strip()
        is_fallback_text = "momen kunci" in clean_text.lower() or not clean_text

        words = clean_text.split()
        if words and not is_fallback_text:
            # Use first 8 words as punchy title excerpt
            punchy_text = " ".join(words[:8]) + ("..." if len(words) > 8 else "")
            punchy_text = punchy_text[0].upper() + punchy_text[1:]
        else:
            punchy_text = ""

        # Prefix by type
        if is_educational:
            prefix = "[EDUKASI]"
        else:
            prefix = "[NARRATIVE]" if i % 2 == 0 else "[SPIKE]"

        if punchy_text:
            yt_words = clean_yt_title.split()
            yt_snippet = " ".join(yt_words[:6]) + ("..." if len(yt_words) > 6 else "")
            title_format = f"{prefix} {yt_snippet}: {punchy_text}"
        else:
            title_format = f"{prefix} {clean_yt_title} (Part {i + 1})"

        # Prefer REAL per-word timing derived from the transcript entries so
        # burned-in captions stay in sync with the speech. Fall back to a
        # simple length-based chunking when timing isn't available.
        timed_lines = build_word_timeline(seg.get("entries"), seg.get("start", 0), HOOK_KEYWORDS)

        if timed_lines:
            simulated_subs = timed_lines
        else:
            subtitle_chunks = []
            chunk_words = []
            char_count = 0
            for word in words:
                if char_count + len(word) + 1 > 45 and chunk_words:
                    subtitle_chunks.append({
                        "text": " ".join(chunk_words),
                        "emphasis": [chunk_words[0]] if chunk_words else []
                    })
                    chunk_words = [word]
                    char_count = len(word)
                else:
                    chunk_words.append(word)
                    char_count += len(word) + 1
            if chunk_words:
                subtitle_chunks.append({
                    "text": " ".join(chunk_words),
                    "emphasis": [chunk_words[0]] if chunk_words else []
                })
            simulated_subs = subtitle_chunks[:6] if subtitle_chunks else [{"text": clean_text[:45], "emphasis": []}]

        # Real virality/engagement score from transcript signals.
        clip_score = compute_virality_score(seg, total_duration)

        clips.append({
            "start": seg['start'],
            "duration": seg['duration'],
            "title": title_format,
            "category": "Educational Value" if is_educational else "Hook & Retention",
            "editorialPriority": categories[min(i, len(categories) - 1)],
            "clipLabel": clip_labels[min(i, len(clip_labels) - 1)],
            "subtitles": simulated_subs,
            "score": clip_score,
            "has_word_timing": bool(timed_lines),
            "hook_text": f"Hook terkuat: {title_format} | {title}"
        })

    # Rank so the highest-scoring clip is presented first (Hero Clip).
    clips.sort(key=lambda c: c.get("score", 0), reverse=True)

    print(json.dumps({
        "is_educational": is_educational,
        "clips": clips
    }))

if __name__ == "__main__":
    if len(sys.argv) < 5:
        print(json.dumps({"error": "Usage: analyze_content.py <video_id> <title> <description> <duration> [num_clips]"}))
        sys.exit(1)

    video_id = sys.argv[1]
    title = sys.argv[2]
    description = sys.argv[3]
    duration = float(sys.argv[4])
    num_clips = int(sys.argv[5]) if len(sys.argv) > 5 else 5

    analyze_video_content(video_id, title, description, duration, num_clips)
