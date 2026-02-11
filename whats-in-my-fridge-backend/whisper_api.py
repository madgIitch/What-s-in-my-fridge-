from flask import Flask, request, jsonify
from faster_whisper import WhisperModel
import requests
import tempfile
import os
import logging
import subprocess
import glob
from urllib.parse import urlparse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

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
        data = request.get_json()

        if not data:
            return jsonify({"error": "No data provided"}), 400

        audio_url = data.get('url')
        # Default solicitado: inglés
        language = data.get('language', 'en')

        if not audio_url:
            return jsonify({"error": "URL is required"}), 400

        logger.info(f"🎵 Resolviendo fuente de audio: {audio_url}")
        temp_dir = tempfile.mkdtemp(prefix="whisper-")
        audio_source = "direct_url"

        try:
            if _is_direct_audio_url(audio_url):
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
            logger.error(f"❌ Error resolviendo audio: {str(e)}")
            return jsonify({"error": f"Failed to resolve audio: {str(e)}"}), 400

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

    except requests.RequestException as e:
        logger.error(f"❌ Error descargando audio: {str(e)}")
        return jsonify({"error": f"Failed to download audio: {str(e)}"}), 400

    except Exception as e:
        logger.error(f"❌ Error en transcripción: {str(e)}")
        return jsonify({"error": f"Transcription failed: {str(e)}"}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)
