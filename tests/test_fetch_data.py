import contextlib
import io
import json
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch

import fetch_data


class FetchDataTests(unittest.TestCase):
    def test_zero_latitude_and_longitude_are_kept(self):
        responses = [
            {"results": [
                {"decimalLatitude": 0.0, "decimalLongitude": 10.0, "species": "Aves one"},
                {"decimalLatitude": float("nan"), "decimalLongitude": 10.0, "species": "Invalid coordinate"},
            ], "endOfRecords": True},
            {"results": [
                {"decimalLatitude": 60.0, "decimalLongitude": 0.0, "species": "Aves two"},
                {"decimalLatitude": 91.0, "decimalLongitude": 10.0, "species": "Out of range"},
            ], "endOfRecords": True},
        ] + [{"results": []} for _ in range(10)]

        with patch("fetch_data.fetch_json", side_effect=responses):
            records = fetch_data.fetch_observations(limit_total=12, page_size=1)

        self.assertEqual(len(records), 2)
        self.assertEqual((records[0]["lat"], records[0]["lon"]), (0.0, 10.0))
        self.assertEqual((records[1]["lat"], records[1]["lon"]), (60.0, 0.0))

    def test_transient_http_error_is_retried(self):
        transient = urllib.error.HTTPError("https://api.gbif.org/test", 503, "Unavailable", {}, None)
        success = io.BytesIO(b'{"results": []}')
        with patch("fetch_data.urllib.request.urlopen", side_effect=[transient, success]) as urlopen, \
                patch("fetch_data.time.sleep") as sleep:
            result = fetch_data.fetch_json("https://api.gbif.org/test")

        self.assertEqual(result, {"results": []})
        self.assertEqual(urlopen.call_count, 2)
        self.assertEqual(urlopen.call_args.kwargs["timeout"], fetch_data.API_TIMEOUT_SECONDS)
        sleep.assert_called_once_with(fetch_data.API_RETRY_BACKOFF_SECONDS)

    def test_permanent_http_error_is_not_retried(self):
        permanent = urllib.error.HTTPError("https://api.gbif.org/test", 400, "Bad request", {}, None)
        with patch("fetch_data.urllib.request.urlopen", side_effect=permanent) as urlopen, \
                patch("fetch_data.time.sleep") as sleep:
            with self.assertRaisesRegex(fetch_data.GBIFRequestError, "HTTP 400"):
                fetch_data.fetch_json("https://api.gbif.org/test")

        urlopen.assert_called_once()
        sleep.assert_not_called()

    def test_transient_http_errors_stop_after_the_retry_budget(self):
        transient = urllib.error.HTTPError("https://api.gbif.org/test", 503, "Unavailable", {}, None)
        with patch("fetch_data.urllib.request.urlopen", side_effect=transient) as urlopen, \
                patch("fetch_data.time.sleep") as sleep:
            with self.assertRaisesRegex(fetch_data.GBIFRequestError, "after 3 attempt"):
                fetch_data.fetch_json("https://api.gbif.org/test")

        self.assertEqual(urlopen.call_count, fetch_data.API_MAX_ATTEMPTS)
        self.assertEqual(sleep.call_count, fetch_data.API_MAX_ATTEMPTS - 1)

    def test_invalid_json_is_rejected(self):
        response = io.BytesIO(b'<html>error</html>')
        with patch("fetch_data.urllib.request.urlopen", return_value=response):
            with self.assertRaisesRegex(fetch_data.GBIFRequestError, "invalid JSON"):
                fetch_data.fetch_json("https://api.gbif.org/test")

    def test_failed_refresh_preserves_existing_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            snapshot = Path(directory) / "birds.json"
            snapshot.write_text('{"last_good": true}\n', encoding="utf-8")

            with patch.object(fetch_data, "OUTPUT_PATH", snapshot), \
                    patch.object(fetch_data, "fetch_observations", return_value=[]), \
                    patch.object(fetch_data, "fetch_species_summary", side_effect=fetch_data.GBIFRequestError("temporary outage")), \
                    contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                result = fetch_data.main()

            self.assertEqual(result, 1)
            self.assertEqual(snapshot.read_text(encoding="utf-8"), '{"last_good": true}\n')
            self.assertEqual(list(Path(directory).iterdir()), [snapshot])

    def test_atomic_write_replaces_snapshot_with_valid_json(self):
        expected = {"observations": [], "metadata": {"sample_size": 0}}
        with tempfile.TemporaryDirectory() as directory:
            snapshot = Path(directory) / "birds.json"
            snapshot.write_text('{"old": true}\n', encoding="utf-8")

            fetch_data.write_output_atomic(expected, snapshot)

            self.assertEqual(json.loads(snapshot.read_text(encoding="utf-8")), expected)
            self.assertEqual(list(Path(directory).iterdir()), [snapshot])

    def test_failed_atomic_serialization_keeps_existing_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            snapshot = Path(directory) / "birds.json"
            snapshot.write_text('{"old": true}\n', encoding="utf-8")

            with self.assertRaises(TypeError):
                fetch_data.write_output_atomic({"not_json": object()}, snapshot)

            self.assertEqual(snapshot.read_text(encoding="utf-8"), '{"old": true}\n')
            self.assertEqual(list(Path(directory).iterdir()), [snapshot])


if __name__ == "__main__":
    unittest.main()
