import importlib.util
import io
import os
import sys
import types
import unittest
from unittest.mock import patch


class FakeModel:
    def __init__(self, *args, **kwargs):
        pass

    def transcribe(self, path, **kwargs):
        assert os.path.exists(path)
        self.last_path = path
        return [types.SimpleNamespace(text=" Añade tomate", start=0, end=1)], types.SimpleNamespace(language="es")


sys.modules["faster_whisper"] = types.SimpleNamespace(WhisperModel=FakeModel)
spec = importlib.util.spec_from_file_location("whisper_api", os.path.join(os.path.dirname(__file__), "..", "whisper_api.py"))
whisper_api = importlib.util.module_from_spec(spec)
spec.loader.exec_module(whisper_api)


class WhisperUploadTest(unittest.TestCase):
    def setUp(self):
        self.client = whisper_api.app.test_client()
        self.token = patch.dict(os.environ, {"INTERNAL_SERVICE_TOKEN": "test-token"})
        self.token.start()
        self.probe = patch.object(whisper_api.subprocess, 'run', return_value=types.SimpleNamespace(returncode=0, stdout='{"streams":[{"codec_name":"mp3"}],"format":{"duration":"5"}}'))
        self.probe.start()

    def tearDown(self):
        self.token.stop()
        self.probe.stop()

    def upload(self, content, authorized=True):
        response = self.client.post(
            "/transcribe",
            data={"audio": (io.BytesIO(content), "audio.mp3", "audio/mpeg")},
            headers={"Authorization": "Bearer test-token"} if authorized else {},
        )
        response.request.environ["wsgi.input"].close()
        return response

    def test_upload_transcribes_without_url(self):
        response = self.upload(b"ID3synthetic-audio")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["text"], "Añade tomate")
        self.assertEqual(response.json["language"], "es")
        self.assertEqual(response.json["contract"], "transcription-v2")
        self.assertEqual(response.json["model"], "base")
        self.assertEqual(response.json["segments"][0]["start"], 0)
        self.assertIsNone(response.json["segments"][0]["avg_logprob"])
        self.assertFalse(os.path.exists(whisper_api.model.last_path))

    def test_upload_requires_authentication(self):
        self.assertEqual(self.upload(b"ID3synthetic-audio", authorized=False).status_code, 401)

    def test_invalid_audio_is_rejected(self):
        self.assertEqual(self.upload(b"not an mp3").status_code, 400)

    def test_corrupt_mp3_is_rejected_before_model(self):
        with patch.object(whisper_api.subprocess, 'run', return_value=types.SimpleNamespace(returncode=1, stdout='')):
            self.assertEqual(self.upload(b"ID3corrupt").status_code, 400)

    def test_model_failure_cleans_audio(self):
        paths = []
        def fail(path, **kwargs):
            paths.append(path)
            raise RuntimeError("synthetic failure")
        with patch.object(whisper_api.model, "transcribe", side_effect=fail):
            response = self.upload(b"ID3synthetic-audio")
        self.assertEqual(response.status_code, 500)
        self.assertTrue(paths)
        self.assertFalse(os.path.exists(paths[0]))

    def test_oversize_audio_is_rejected(self):
        self.assertEqual(self.upload(b"ID3" + b"x" * (20 * 1024 * 1024)).status_code, 413)

    def test_oversize_request_is_not_reported_as_server_failure(self):
        self.assertEqual(self.upload(b"ID3" + b"x" * (21 * 1024 * 1024)).status_code, 413)

    def test_legacy_url_request_remains_supported(self):
        def fake_download(_url, directory):
            path = os.path.join(directory, "legacy.mp3")
            with open(path, "wb") as audio:
                audio.write(b"ID3legacy")
            return path

        with patch.object(whisper_api, "_download_direct_audio", side_effect=fake_download):
            response = self.client.post("/transcribe", json={"url": "https://example.com/audio.mp3"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["text"], "Añade tomate")


if __name__ == "__main__":
    unittest.main()
