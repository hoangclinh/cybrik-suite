"""Unit tests for Server-Sent Events (SSE) parser and real-time streaming client."""

from __future__ import annotations

import threading
from dataclasses import asdict
from unittest.mock import MagicMock, patch

import pytest

from cybrik_sdk.client import CybrikClient, SyncCybrikClient
from cybrik_sdk.config import CybrikConfig
from cybrik_sdk.streaming import EventStreamClient, SSEParser, StreamEvent


class TestStreamEvent:
    """Validates StreamEvent dataclass properties, defaults, and serialization."""

    def test_default_values(self) -> None:
        event = StreamEvent()
        assert event.event_type == "message"
        assert event.data == ""
        assert event.event_id is None
        assert event.retry is None
        assert event.raw == ""
        assert event.timestamp != ""
        assert event.id is None
        assert event.event == "message"

    def test_custom_values(self) -> None:
        event = StreamEvent(
            event_type="alert.created",
            data={"id": "alt-1", "severity": "CRITICAL"},
            event_id="evt-100",
            retry=5000,
            timestamp="2026-09-08T00:00:00Z",
            raw="event: alert.created\ndata: ...",
        )
        assert event.event_type == "alert.created"
        assert event.data == {"id": "alt-1", "severity": "CRITICAL"}
        assert event.event_id == "evt-100"
        assert event.id == "evt-100"
        assert event.event == "alert.created"
        assert event.retry == 5000
        assert event.timestamp == "2026-09-08T00:00:00Z"

    def test_to_dict_and_asdict_serialization(self) -> None:
        event = StreamEvent(
            event_type="reasoning_delta",
            data={"node_id": "n1", "delta_type": "add_node"},
            event_id="d-01",
            retry=1000,
            timestamp="2026-09-08T00:00:00Z",
            raw="event: reasoning_delta\ndata: ...",
        )
        d = event.to_dict()
        assert d == {
            "event_type": "reasoning_delta",
            "data": {"node_id": "n1", "delta_type": "add_node"},
            "event_id": "d-01",
            "retry": 1000,
            "timestamp": "2026-09-08T00:00:00Z",
            "raw": "event: reasoning_delta\ndata: ...",
        }
        assert asdict(event) == d


class TestSSEParser:
    """Validates SSEParser compliance with W3C Server-Sent Events standard."""

    def test_single_line_event(self) -> None:
        parser = SSEParser()
        raw = "event: message\ndata: hello world\nid: 1\nretry: 3000\n\n"
        events = parser.feed_chunk(raw)
        assert len(events) == 1
        ev = events[0]
        assert ev.event_type == "message"
        assert ev.data == "hello world"
        assert ev.event_id == "1"
        assert ev.retry == 3000
        assert parser.last_event_id == "1"

    def test_multi_line_data_joined_with_newlines(self) -> None:
        parser = SSEParser()
        raw = "data: line 1\ndata: line 2\ndata: line 3\n\n"
        events = parser.feed_chunk(raw)
        assert len(events) == 1
        assert events[0].data == "line 1\nline 2\nline 3"
        assert events[0].event_type == "message"

    def test_multiple_events_in_single_chunk(self) -> None:
        parser = SSEParser()
        raw = "event: ev1\ndata: d1\n\nevent: ev2\ndata: d2\n\n"
        events = parser.feed_chunk(raw)
        assert len(events) == 2
        assert events[0].event_type == "ev1"
        assert events[0].data == "d1"
        assert events[1].event_type == "ev2"
        assert events[1].data == "d2"

    def test_chunked_byte_and_partial_line_delivery(self) -> None:
        parser = SSEParser()
        chunks = [
            "ev",
            "ent: custo",
            "m\nid: 4",
            "2\nda",
            "ta: pa",
            "rtial chunked pay",
            "load\n",
            "\n",
        ]
        collected: list[StreamEvent] = []
        for i, ch in enumerate(chunks):
            evs = parser.feed_chunk(ch)
            if i < len(chunks) - 1:
                assert evs == [], f"Expected no events before chunk {i}"
            else:
                collected.extend(evs)

        assert len(collected) == 1
        assert collected[0].event_type == "custom"
        assert collected[0].event_id == "42"
        assert collected[0].data == "partial chunked payload"

    def test_chunked_bytes_input(self) -> None:
        parser = SSEParser()
        evs1 = parser.feed_chunk(b"event: ping\n")
        assert evs1 == []
        evs2 = parser.feed_chunk(b"data: pong\n\n")
        assert len(evs2) == 1
        assert evs2[0].event_type == "ping"
        assert evs2[0].data == "pong"

    def test_crlf_line_endings(self) -> None:
        parser = SSEParser()
        raw = "event: win\r\ndata: windows newline\r\nid: w1\r\n\r\n"
        events = parser.feed_chunk(raw)
        assert len(events) == 1
        assert events[0].event_type == "win"
        assert events[0].data == "windows newline"
        assert events[0].event_id == "w1"

    def test_split_crlf_boundary(self) -> None:
        parser = SSEParser()
        evs1 = parser.feed_chunk("data: split\r")
        assert evs1 == []
        evs2 = parser.feed_chunk("\n\r\n")
        assert len(evs2) == 1
        assert evs2[0].data == "split"

    def test_json_payload_decoding(self) -> None:
        parser = SSEParser()
        json_raw = 'data: {"alert_id": "alt-01", "score": 99.4, "active": true}\n\n'
        events = parser.feed_chunk(json_raw)
        assert len(events) == 1
        assert events[0].data == {"alert_id": "alt-01", "score": 99.4, "active": True}

    def test_json_array_decoding(self) -> None:
        parser = SSEParser()
        json_raw = 'data: ["ioc-1", "ioc-2", "ioc-3"]\n\n'
        events = parser.feed_chunk(json_raw)
        assert len(events) == 1
        assert events[0].data == ["ioc-1", "ioc-2", "ioc-3"]

    def test_invalid_json_fallback_to_string(self) -> None:
        parser = SSEParser()
        invalid_json = "data: {not valid json: true\n\n"
        events = parser.feed_chunk(invalid_json)
        assert len(events) == 1
        assert events[0].data == "{not valid json: true"

    def test_comment_line_handling(self) -> None:
        parser = SSEParser()
        # Standalone comment (e.g. keepalive / ping) must not emit any event
        evs1 = parser.feed_chunk(":keepalive\n\n")
        assert evs1 == []

        # Comment interleaved inside an event block must be ignored
        evs2 = parser.feed_chunk(": initial comment\nevent: notice\n: keepalive\ndata: payload\n\n")
        assert len(evs2) == 1
        assert evs2[0].event_type == "notice"
        assert evs2[0].data == "payload"

    def test_consecutive_empty_lines_ignored(self) -> None:
        parser = SSEParser()
        evs = parser.feed_chunk("\n\n\n\n")
        assert evs == []

    def test_reset_method(self) -> None:
        parser = SSEParser()
        parser.feed_chunk("event: uncompleted\ndata: partial")
        parser.reset()
        assert parser._buffer == ""
        assert parser.last_event_id is None
        assert parser.flush() == []

        # Fresh event works after reset
        evs = parser.feed_chunk("data: fresh\n\n")
        assert len(evs) == 1
        assert evs[0].data == "fresh"

    def test_flush_dispatches_pending_event(self) -> None:
        parser = SSEParser()
        parser.feed_chunk("data: trailing without double newline\n")
        flushed = parser.flush()
        assert len(flushed) == 1
        assert flushed[0].data == "trailing without double newline"


class TestEventStreamClient:
    """Validates synchronous and asynchronous streaming client operations."""

    def test_stream_sync_urllib_read(self) -> None:
        client = EventStreamClient()
        raw_sse = b"id: 1\nevent: alert\ndata: {\"msg\": \"ok\"}\n\n"

        mock_resp = MagicMock()
        mock_resp.read.side_effect = [raw_sse, b""]
        mock_resp.__enter__.return_value = mock_resp
        mock_resp.__exit__.return_value = False

        with patch("urllib.request.urlopen", return_value=mock_resp) as mock_urlopen:
            events = list(client.stream("http://127.0.0.1:8000/stream"))

            assert len(events) == 1
            assert events[0].event_type == "alert"
            assert events[0].data == {"msg": "ok"}
            assert events[0].event_id == "1"
            assert client.last_event_id == "1"

            # Verify request
            req = mock_urlopen.call_args[0][0]
            assert req.full_url == "http://127.0.0.1:8000/stream"
            assert req.headers["Accept"] == "text/event-stream"
            assert req.headers["Cache-control"] == "no-cache"

    def test_reconnection_and_last_event_id_header_injection(self) -> None:
        client = EventStreamClient(last_event_id="initial-99")
        raw_sse = b"id: next-100\ndata: payload\n\n"

        mock_resp = MagicMock()
        mock_resp.read.side_effect = [raw_sse, b""]
        mock_resp.__enter__.return_value = mock_resp
        mock_resp.__exit__.return_value = False

        with patch("urllib.request.urlopen", return_value=mock_resp) as mock_urlopen:
            events = list(client.stream("http://127.0.0.1:8000/events/stream"))
            assert len(events) == 1
            assert events[0].event_id == "next-100"
            assert client.last_event_id == "next-100"

            # Check that initial Last-Event-ID header was injected
            req = mock_urlopen.call_args[0][0]
            assert req.headers["Last-event-id"] == "initial-99"

        # Subsequent stream uses newly tracked last_event_id: next-100
        mock_resp2 = MagicMock()
        mock_resp2.read.side_effect = [b"data: second\n\n", b""]
        mock_resp2.__enter__.return_value = mock_resp2
        mock_resp2.__exit__.return_value = False

        with patch("urllib.request.urlopen", return_value=mock_resp2) as mock_urlopen2:
            events2 = list(client.stream("http://127.0.0.1:8000/events/stream"))
            assert len(events2) == 1
            req2 = mock_urlopen2.call_args[0][0]
            assert req2.headers["Last-event-id"] == "next-100"

    def test_automatic_reconnect_on_connection_error(self) -> None:
        client = EventStreamClient()

        # Call 1 yields an event then raises ConnectionResetError
        mock_resp1 = MagicMock()
        mock_resp1.read.side_effect = [b"id: evt-A\ndata: first\n\n", ConnectionResetError("reset")]
        mock_resp1.__enter__.return_value = mock_resp1
        mock_resp1.__exit__.return_value = False

        # Call 2 (reconnect) succeeds with second event
        mock_resp2 = MagicMock()
        mock_resp2.read.side_effect = [b"id: evt-B\ndata: second\n\n", b""]
        mock_resp2.__enter__.return_value = mock_resp2
        mock_resp2.__exit__.return_value = False

        with patch("urllib.request.urlopen", side_effect=[mock_resp1, mock_resp2]) as mock_urlopen:
            events = list(
                client.stream(
                    "http://127.0.0.1:8000/stream",
                    reconnect=True,
                    max_reconnect_attempts=2,
                    reconnect_delay=0.01,
                )
            )
            assert len(events) == 2
            assert events[0].event_id == "evt-A"
            assert events[1].event_id == "evt-B"
            assert mock_urlopen.call_count == 2
            # Second call sent Last-Event-ID: evt-A
            second_req = mock_urlopen.call_args_list[1][0][0]
            assert second_req.headers["Last-event-id"] == "evt-A"

    def test_thread_safe_last_event_id(self) -> None:
        client = EventStreamClient()

        def worker(ev_id: str) -> None:
            for _ in range(100):
                client.last_event_id = ev_id
                _ = client.last_event_id

        threads = [threading.Thread(target=worker, args=(f"id-{i}",)) for i in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert client.last_event_id is not None
        assert client.last_event_id.startswith("id-")

    @pytest.mark.asyncio
    async def test_stream_async_generator(self) -> None:
        mock_resp = MagicMock()

        async def mock_aiter_text():
            yield "event: update\n"
            yield 'data: {"status": "ACTIVE"}\n'
            yield "id: 77\n\n"

        mock_resp.aiter_text = mock_aiter_text

        class AsyncContextMgr:
            async def __aenter__(self):
                return mock_resp

            async def __aexit__(self, *args):
                pass

        mock_async_client = MagicMock()
        mock_async_client.stream.return_value = AsyncContextMgr()

        client = EventStreamClient(async_client=mock_async_client)
        collected: list[StreamEvent] = []
        async for event in client.stream_async("http://127.0.0.1:8000/stream"):
            collected.append(event)

        assert len(collected) == 1
        assert collected[0].event_type == "update"
        assert collected[0].data == {"status": "ACTIVE"}
        assert collected[0].event_id == "77"
        assert client.last_event_id == "77"


class TestCybrikClientStreamingIntegration:
    """Validates CybrikClient streaming methods and event dispatch."""

    def test_stream_reasoning_deltas_signature_and_dispatch(self) -> None:
        config = CybrikConfig(
            soc_url="http://soc.local:8000",
            ai_url="http://ai.local:8002",
            token="test-token",
        )
        client = CybrikClient(config=config)

        raw_payload = (
            b"event: reasoning_delta\n"
            b'data: {"node_id": "hypo-1", "delta_type": "add_node", "confidence": 0.85}\n'
            b"id: r-1\n\n"
        )

        mock_resp = MagicMock()
        mock_resp.read.side_effect = [raw_payload, b""]
        mock_resp.__enter__.return_value = mock_resp
        mock_resp.__exit__.return_value = False

        with patch("urllib.request.urlopen", return_value=mock_resp) as mock_open:
            events = list(client.stream_reasoning_deltas("inv-1234-uuid"))

            assert len(events) == 1
            ev = events[0]
            assert ev.event_type == "reasoning_delta"
            assert ev.data == {"node_id": "hypo-1", "delta_type": "add_node", "confidence": 0.85}
            assert ev.event_id == "r-1"

            # Verify target URL
            req = mock_open.call_args[0][0]
            expected_url = "http://ai.local:8002/api/v1/investigations/inv-1234-uuid/reasoning/stream"
            assert req.full_url == expected_url
            assert req.headers["Authorization"] == "Bearer test-token"

    def test_stream_alert_events_with_and_without_status_filter(self) -> None:
        config = CybrikConfig(
            soc_url="http://soc.local:8000",
            api_key="test-key",
        )
        client = CybrikClient(config=config)

        mock_resp = MagicMock()
        raw_created = b'event: alert.created\ndata: {"alert_id": "alt-9"}\n\n'
        mock_resp.read.side_effect = [raw_created, b""]
        mock_resp.__enter__.return_value = mock_resp
        mock_resp.__exit__.return_value = False

        # Test without status filter
        with patch("urllib.request.urlopen", return_value=mock_resp) as mock_open:
            events = list(client.stream_alert_events())
            assert len(events) == 1
            assert events[0].event_type == "alert.created"
            req = mock_open.call_args[0][0]
            assert req.full_url == "http://soc.local:8000/api/v1/alerts/stream"
            assert req.headers["X-api-key"] == "test-key"

        # Test with status filter
        mock_resp2 = MagicMock()
        raw_updated = b'event: alert.updated\ndata: {"alert_id": "alt-9"}\n\n'
        mock_resp2.read.side_effect = [raw_updated, b""]
        mock_resp2.__enter__.return_value = mock_resp2
        mock_resp2.__exit__.return_value = False

        with patch("urllib.request.urlopen", return_value=mock_resp2) as mock_open2:
            events = list(client.stream_alert_events(status="INVESTIGATING"))
            assert len(events) == 1
            req = mock_open2.call_args[0][0]
            assert req.full_url == "http://soc.local:8000/api/v1/alerts/stream?status=INVESTIGATING"

    def test_sync_cybrik_client_streaming(self) -> None:
        config = CybrikConfig(
            soc_url="http://soc.local:8000",
            ai_url="http://ai.local:8002",
        )
        sync_client = SyncCybrikClient(config=config)

        mock_resp = MagicMock()
        mock_resp.iter_text.return_value = ["event: reasoning_delta\ndata: {}\n\n"]
        sync_client._client.stream = MagicMock(return_value=mock_resp)
        mock_resp.__enter__ = MagicMock(return_value=mock_resp)
        mock_resp.__exit__ = MagicMock(return_value=False)

        events = list(sync_client.stream_reasoning_deltas("inv-55"))
        assert len(events) == 1
        assert events[0].event_type == "reasoning_delta"
