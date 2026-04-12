import backend.transcribe as transcribe


class _DummyQiniuAuth:
    def __init__(self, access_key, secret_key):
        self.access_key = access_key
        self.secret_key = secret_key

    def upload_token(self, bucket, key, expires):
        return "dummy-token"


def test_upload_to_qiniu_normalizes_domain_to_https(monkeypatch):
    monkeypatch.setattr(transcribe.settings, "qiniu_access_key", "test-ak")
    monkeypatch.setattr(transcribe.settings, "qiniu_secret_key", "test-sk")
    monkeypatch.setattr(transcribe.settings, "qiniu_bucket", "test-bucket")
    monkeypatch.setattr(transcribe.settings, "qiniu_domain", "example.com")
    monkeypatch.setattr(transcribe, "QiniuAuth", _DummyQiniuAuth)
    monkeypatch.setattr(
        transcribe,
        "put_file",
        lambda token, key, local_path: ({"key": "audio/test-file.webm"}, {"status": "ok"}),
    )

    url = transcribe._upload_to_qiniu("dummy-path.webm", ".webm")

    assert url == "http://example.com/audio/test-file.webm"


def test_upload_to_qiniu_preserves_explicit_scheme(monkeypatch):
    monkeypatch.setattr(transcribe.settings, "qiniu_access_key", "test-ak")
    monkeypatch.setattr(transcribe.settings, "qiniu_secret_key", "test-sk")
    monkeypatch.setattr(transcribe.settings, "qiniu_bucket", "test-bucket")
    monkeypatch.setattr(transcribe.settings, "qiniu_domain", "https://cdn.example.com/")
    monkeypatch.setattr(transcribe, "QiniuAuth", _DummyQiniuAuth)
    monkeypatch.setattr(
        transcribe,
        "put_file",
        lambda token, key, local_path: ({"key": "audio/test-file.webm"}, {"status": "ok"}),
    )

    url = transcribe._upload_to_qiniu("dummy-path.webm", ".webm")

    assert url == "https://cdn.example.com/audio/test-file.webm"
