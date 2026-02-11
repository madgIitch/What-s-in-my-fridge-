from flask import Flask, request, jsonify
from faster_whisper import WhisperModel
import requests
import tempfile
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Cargar modelo al iniciar (ya descargado durante build)
logger.info("🔄 Cargando modelo Whisper...")
model = WhisperModel("base", device="cpu", compute_type="int8")
logger.info("✅ Modelo Whisper cargado")

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
        "language": "es"       // Opcional, default: auto-detect
    }

    Response:
    {
        "text": "transcripción completa...",
        "language": "es",
        "segments": [...]
    }
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({"error": "No data provided"}), 400

        audio_url = data.get('url')
        language = data.get('language', None)  # None = auto-detect

        if not audio_url:
            return jsonify({"error": "URL is required"}), 400

        logger.info(f"🎵 Descargando audio desde: {audio_url}")

        # Descargar audio a archivo temporal
        response = requests.get(audio_url, timeout=60)
        response.raise_for_status()

        # Guardar en archivo temporal
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as temp_file:
            temp_file.write(response.content)
            temp_path = temp_file.name

        try:
            logger.info(f"🎤 Transcribiendo audio (language: {language or 'auto'})...")

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
            # Limpiar archivo temporal
            if os.path.exists(temp_path):
                os.remove(temp_path)

    except requests.RequestException as e:
        logger.error(f"❌ Error descargando audio: {str(e)}")
        return jsonify({"error": f"Failed to download audio: {str(e)}"}), 400

    except Exception as e:
        logger.error(f"❌ Error en transcripción: {str(e)}")
        return jsonify({"error": f"Transcription failed: {str(e)}"}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)
