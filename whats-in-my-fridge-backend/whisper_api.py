from flask import Flask, request, jsonify
from faster_whisper import WhisperModel
import requests
import tempfile
import os
import logging
import subprocess
import glob
import hmac
import shutil
import json
from werkzeug.exceptions import RequestEntityTooLarge
from urllib.parse import urlparse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 21 * 1024 * 1024


@app.errorhandler(RequestEntityTooLarge)
def audio_too_large(_error):
    return jsonify({"error": "AUDIO_TOO_LARGE"}), 413

# Cargar modelo al iniciar (ya descargado durante build)
logger.info("🔄 Cargando modelo Whisper...")
model = WhisperModel("base", device="cpu", compute_type="int8")
logger.info("✅ Modelo Whisper cargado")

DIRECT_AUDIO_EXTENSIONS = (".mp3", ".m4a", ".aac", ".wav", ".ogg", ".flac", ".webm")
SOCIAL_HOST_HINTS = (
    "youtube.com",
    "youtu.be",
    "tiktok.com",
    "instagram.com",
    "facebook.com",
)


def _is_direct_audio_url(url: str) -> bool:
    return url.lower().split("?")[0].endswith(DIRECT_AUDIO_EXTENSIONS)


def _is_social_url(url: str) -> bool:
    host = (urlparse(url).netloc or "").lower()
    return any(h in host for h in SOCIAL_HOST_HINTS)


def _download_direct_audio(url: str, temp_dir: str) -> str:
    response = requests.get(url, timeout=90)
    response.raise_for_status()

    audio_path = os.path.join(temp_dir, "audio_input.mp3")
    with open(audio_path, "wb") as f:
        f.write(response.content)

    return audio_path


def _download_audio_with_ytdlp(url: str, temp_dir: str) -> str:
    output_template = os.path.join(temp_dir, "audio.%(ext)s")
    command = [
        "yt-dlp",
        "-f",
        "bestaudio/best",
        "--no-playlist",
        "--extract-audio",
        "--audio-format",
        "mp3",
        "--audio-quality",
        "0",
        "--restrict-filenames",
        "--no-warnings",
        "--socket-timeout",
        "30",
        "--retries",
        "3",
        "-o",
        output_template,
        url,
    ]

    logger.info("🎬 Descargando audio con yt-dlp...")
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        stderr = (result.stderr or "").strip()
        stdout = (result.stdout or "").strip()
        raise RuntimeError(f"yt-dlp failed. stderr={stderr[:500]} stdout={stdout[:500]}")

    matches = glob.glob(os.path.join(temp_dir, "audio.*"))
    if not matches:
        raise RuntimeError("yt-dlp no generó archivo de audio")

    return matches[0]

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy", "model": "whisper-base"}), 200

@app.route('/transcribe', methods=['POST'])
def transcribe():
    """
    Transcribe audio desde URL o archivo

    Request body:
    {
        "url": "https://...",  // URL del video/audio
        "language": "en"       // Opcional, default: en
    }

    Response:
    {
        "text": "transcripción completa...",
        "language": "en",
        "segments": [...]
    }
    """
    try:
        is_upload = request.mimetype == 'multipart/form-data'
        if is_upload:
            expected_token = os.environ.get('INTERNAL_SERVICE_TOKEN')
            bearer = request.headers.get('Authorization', '')
            supplied_token = bearer[7:] if bearer.startswith('Bearer ') else ''
            if not expected_token:
                return jsonify({"error": "SERVICE_UNAVAILABLE"}), 503
            if not hmac.compare_digest(supplied_token.encode('utf-8'), expected_token.encode('utf-8')):
                return jsonify({"error": "UNAUTHORIZED"}), 401
            audio_file = request.files.get('audio')
            if not audio_file or audio_file.mimetype != 'audio/mpeg':
                return jsonify({"error": "AUDIO_INVALID"}), 415
            language = request.form.get('language') or None
        else:
            data = request.get_json(silent=True)
            if not data or not data.get('url'):
                return jsonify({"error": "URL is required"}), 400
            audio_url = data['url']
            language = data.get('language', 'en')

        temp_dir = tempfile.mkdtemp(prefix="whisper-")
        audio_source = "upload" if is_upload else "direct_url"

        try:
            if is_upload:
                temp_path = os.path.join(temp_dir, "audio.mp3")
                audio_file.save(temp_path)
                if os.path.getsize(temp_path) == 0 or os.path.getsize(temp_path) > 20 * 1024 * 1024:
                    size = os.path.getsize(temp_path)
                    shutil.rmtree(temp_dir, ignore_errors=True)
                    return jsonify({"error": "AUDIO_TOO_LARGE" if size else "AUDIO_INVALID"}), 413 if size else 400
                with open(temp_path, 'rb') as source:
                    header = source.read(3)
                if header != b'ID3' and not (len(header) >= 2 and header[0] == 0xff and (header[1] & 0xe0) == 0xe0):
                    shutil.rmtree(temp_dir, ignore_errors=True)
                    return jsonify({"error": "AUDIO_INVALID"}), 400
                probe = subprocess.run(
                    ['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_name:format=duration', '-of', 'json', temp_path],
                    capture_output=True, text=True, timeout=30,
                )
                metadata = json.loads(probe.stdout) if probe.returncode == 0 else {}
                duration = float(metadata.get('format', {}).get('duration', 0))
                streams = metadata.get('streams', [])
                if not streams or streams[0].get('codec_name') != 'mp3' or not 0 < duration <= 600:
                    shutil.rmtree(temp_dir, ignore_errors=True)
                    return jsonify({"error": "AUDIO_INVALID"}), 400
            elif _is_direct_audio_url(audio_url):
                temp_path = _download_direct_audio(audio_url, temp_dir)
                audio_source = "direct_url"
            elif _is_social_url(audio_url):
                temp_path = _download_audio_with_ytdlp(audio_url, temp_dir)
                audio_source = "yt-dlp"
            else:
                # Fallback: intentar URL directa y luego yt-dlp
                try:
                    temp_path = _download_direct_audio(audio_url, temp_dir)
                    audio_source = "direct_url"
                except Exception:
                    temp_path = _download_audio_with_ytdlp(audio_url, temp_dir)
                    audio_source = "yt-dlp"
        except Exception as e:
            shutil.rmtree(temp_dir, ignore_errors=True)
            logger.error("Audio resolution failed (%s)", type(e).__name__)
            return jsonify({"error": "AUDIO_INVALID"}), 400

        try:
            logger.info(f"🎤 Transcribiendo audio (source: {audio_source}, language: {language or 'auto'})...")

            # Transcribir
            segments, info = model.transcribe(
                temp_path,
                language=language,
                beam_size=5,
                vad_filter=True,  # Voice Activity Detection
                word_timestamps=False
            )

            # Convertir segmentos a lista y extraer texto
            segments_list = list(segments)
            full_text = " ".join([segment.text for segment in segments_list])

            detected_language = info.language

            logger.info(f"✅ Transcripción completada ({len(segments_list)} segmentos, idioma: {detected_language})")

            return jsonify({
                "text": full_text.strip(),
                "language": detected_language,
                "audio_source": audio_source,
                "segments": [
                    {
                        "text": segment.text,
                        "start": segment.start,
                        "end": segment.end
                    }
                    for segment in segments_list
                ]
            }), 200

        finally:
            # Limpiar archivos temporales
            try:
                if 'temp_path' in locals() and os.path.exists(temp_path):
                    os.remove(temp_path)
                if os.path.exists(temp_dir):
                    for f in glob.glob(os.path.join(temp_dir, "*")):
                        try:
                            os.remove(f)
                        except Exception:
                            pass
                    os.rmdir(temp_dir)
            except Exception:
                pass

    except RequestEntityTooLarge:
        return jsonify({"error": "AUDIO_TOO_LARGE"}), 413

    except requests.RequestException as e:
        logger.error("Audio download failed (%s)", type(e).__name__)
        return jsonify({"error": "AUDIO_INVALID"}), 400

    except Exception as e:
        logger.error("Transcription failed (%s)", type(e).__name__)
        return jsonify({"error": "TRANSCRIPTION_FAILED"}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)
