"""
tests/helpers.py
────────────────
Shared mock utilities for the J.A.R.V.I.S test suite.
"""

from unittest.mock import MagicMock


def mock_qdrant_search_response(hits):
    """Create a mock requests.Response for Qdrant REST API /points/search.

    Args:
        hits: list of objects with .id, .score, .payload attributes
              (SimpleNamespace, MagicMock, or any object with those attrs)
    """
    result = []
    for h in hits:
        result.append({
            "id": h.id,
            "score": h.score,
            "payload": h.payload,
        })
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"result": result, "status": "ok", "time": 0.001}
    return mock_resp
