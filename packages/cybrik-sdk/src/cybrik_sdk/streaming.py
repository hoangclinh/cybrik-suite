"""Unified real-time streaming client and Server-Sent Events (SSE) parser for CYBRIK SDK."""

from __future__ import annotations

import asyncio
import json
import threading
import time
import urllib.request
from collections.abc import AsyncIterator, Iterator
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import httpx


@dataclass
class StreamEvent:
    """Server-Sent Event (SSE) model representing real-time streaming data."""

    event_type: str = "message"
    data: dict[str, Any] | str = ""
    event_id: str | None = None
    retry: int | None = None
    timestamp: str = ""
    raw: str = ""

    def __post_init__(self) -> None:
        if not self.timestamp:
            self.timestamp = datetime.now(timezone.utc).isoformat()

    @property
    def id(self) -> str | None:
        """Alias for event_id."""
        return self.event_id

    @property
    def event(self) -> str:
        """Alias for event_type."""
        return self.event_type

    def to_dict(self) -> dict[str, Any]:
        """Serialize event to a plain dictionary."""
        return {
            "event_type": self.event_type,
            "data": self.data,
            "event_id": self.event_id,
            "retry": self.retry,
            "timestamp": self.timestamp,
            "raw": self.raw,
        }


class SSEParser:
    """Pure Python zero-dependency parser for Server-Sent Events (W3C standard)."""

    def __init__(self) -> None:
        self._buffer: str = ""
        self._current_event_type: str | None = None
        self._data_lines: list[str] = []
        self._has_data: bool = False
        self._current_id: str | None = None
        self._current_retry: int | None = None
        self._raw_lines: list[str] = []
        self.last_event_id: str | None = None

    def reset(self) -> None:
        """Reset parser state and buffers to initial state."""
        self._buffer = ""
        self._current_event_type = None
        self._data_lines = []
        self._has_data = False
        self._current_id = None
        self._current_retry = None
        self._raw_lines = []
        self.last_event_id = None

    def feed_chunk(self, chunk: str | bytes) -> list[StreamEvent]:
        """Feed a text or byte chunk into the parser and return completed events.

        Accumulates incoming buffer, parses W3C SSE lines ('event:', 'data:', 'id:',
        'retry:', and comments ':'), and dispatches completed StreamEvent objects on
        double newline.
        """
        if isinstance(chunk, bytes):
            text = chunk.decode("utf-8", errors="replace")
        else:
            text = chunk

        self._buffer += text
        events: list[StreamEvent] = []

        lines = self._extract_lines()
        for line in lines:
            event = self._process_line(line)
            if event is not None:
                events.append(event)

        return events

    def flush(self) -> list[StreamEvent]:
        """Flush any remaining data in the buffer and dispatch any pending event."""
        events: list[StreamEvent] = []
        if self._buffer:
            lines = self._extract_lines()
            for line in lines:
                ev = self._process_line(line)
                if ev is not None:
                    events.append(ev)
            if self._buffer:
                ev = self._process_line(self._buffer)
                if ev is not None:
                    events.append(ev)
                self._buffer = ""

        ev = self._dispatch_event()
        if ev is not None:
            events.append(ev)
        return events

    def _extract_lines(self) -> list[str]:
        """Extract complete lines from the internal buffer, handling \\r\\n, \\n, and \\r."""
        lines: list[str] = []
        buf = self._buffer
        n = len(buf)
        i = 0
        start = 0

        while i < n:
            c = buf[i]
            if c == "\r":
                if i + 1 < n:
                    if buf[i + 1] == "\n":
                        lines.append(buf[start:i])
                        i += 2
                        start = i
                        continue
                    else:
                        lines.append(buf[start:i])
                        i += 1
                        start = i
                        continue
                else:
                    # '\\r' at the very end of buffer; wait for next chunk
                    break
            elif c == "\n":
                lines.append(buf[start:i])
                i += 1
                start = i
                continue
            i += 1

        self._buffer = buf[start:]
        return lines

    def _process_line(self, line: str) -> StreamEvent | None:
        """Process a single SSE line according to W3C specification."""
        if len(line) == 0:
            return self._dispatch_event()

        if line.startswith(":"):
            # Comment line per W3C spec - ignore
            return None

        self._raw_lines.append(line)

        if ":" in line:
            field, _, value = line.partition(":")
            if value.startswith(" "):
                value = value[1:]
        else:
            field = line
            value = ""

        if field == "event":
            self._current_event_type = value
        elif field == "data":
            self._has_data = True
            self._data_lines.append(value)
        elif field == "id":
            if "\x00" not in value:
                self._current_id = value
                self.last_event_id = value
        elif field == "retry":
            try:
                parsed_retry = int(value.strip())
                if parsed_retry >= 0:
                    self._current_retry = parsed_retry
            except ValueError:
                pass

        return None

    def _dispatch_event(self) -> StreamEvent | None:
        """Dispatch accumulated event on empty line."""
        if (
            not self._has_data
            and self._current_event_type is None
            and self._current_id is None
            and self._current_retry is None
        ):
            self._raw_lines = []
            return None

        data_text = "\n".join(self._data_lines) if self._has_data else ""
        parsed_data: dict[str, Any] | str
        if self._has_data and data_text:
            try:
                parsed_data = json.loads(data_text)
            except (json.JSONDecodeError, UnicodeDecodeError):
                parsed_data = data_text
        else:
            parsed_data = data_text

        raw_text = "\n".join(self._raw_lines)

        event = StreamEvent(
            event_type=(
                self._current_event_type
                if self._current_event_type is not None
                else "message"
            ),
            data=parsed_data,
            event_id=self._current_id,
            retry=self._current_retry,
            timestamp=datetime.now(timezone.utc).isoformat(),
            raw=raw_text,
        )

        # Reset current event buffers
        self._current_event_type = None
        self._data_lines = []
        self._has_data = False
        self._current_id = None
        self._current_retry = None
        self._raw_lines = []

        return event


class EventStreamClient:
    """Thread-safe and asyncio-compatible streaming client for Server-Sent Events."""

    def __init__(
        self,
        client: httpx.Client | None = None,
        async_client: httpx.AsyncClient | None = None,
        last_event_id: str | None = None,
    ) -> None:
        self._sync_client = client
        self._async_client = async_client
        self._last_event_id = last_event_id
        self._lock = threading.Lock()

    @property
    def last_event_id(self) -> str | None:
        """The most recently observed event ID."""
        with self._lock:
            return self._last_event_id

    @last_event_id.setter
    def last_event_id(self, value: str | None) -> None:
        with self._lock:
            self._last_event_id = value

    def _prepare_headers(
        self,
        headers: dict[str, str] | None = None,
    ) -> dict[str, str]:
        req_headers: dict[str, str] = {
            "Accept": "text/event-stream",
            "Cache-Control": "no-cache",
        }
        with self._lock:
            if self._last_event_id is not None:
                req_headers["Last-Event-ID"] = self._last_event_id
        if headers:
            req_headers.update(headers)
            if "Last-Event-ID" in headers:
                with self._lock:
                    self._last_event_id = headers["Last-Event-ID"]
        return req_headers

    def stream(
        self,
        url: str,
        headers: dict[str, str] | None = None,
        timeout: float = 30.0,
        reconnect: bool = False,
        max_reconnect_attempts: int = 3,
        reconnect_delay: float = 0.1,
    ) -> Iterator[StreamEvent]:
        """Synchronously stream Server-Sent Events from the specified URL.

        Uses standard library urllib.request or existing SDK HTTP infrastructure
        with chunked read. Tracks Last-Event-ID across received events and injects
        it on reconnect.
        """
        attempts = 0
        while True:
            req_headers = self._prepare_headers(headers)
            parser = SSEParser()
            with self._lock:
                parser.last_event_id = self._last_event_id

            try:
                if self._sync_client is not None:
                    with self._sync_client.stream(
                        "GET", url, headers=req_headers, timeout=timeout
                    ) as resp:
                        for chunk in resp.iter_text():
                            for event in parser.feed_chunk(chunk):
                                if event.event_id is not None:
                                    with self._lock:
                                        self._last_event_id = event.event_id
                                yield event
                        for event in parser.flush():
                            if event.event_id is not None:
                                with self._lock:
                                    self._last_event_id = event.event_id
                            yield event
                else:
                    req = urllib.request.Request(url, headers=req_headers, method="GET")
                    with urllib.request.urlopen(req, timeout=timeout) as resp:
                        if hasattr(resp, "read") and callable(resp.read):
                            while True:
                                chunk = resp.read(1024)
                                if not chunk or not isinstance(chunk, (bytes, str)):
                                    break
                                text = (
                                    chunk.decode("utf-8", errors="replace")
                                    if isinstance(chunk, bytes)
                                    else str(chunk)
                                )
                                for event in parser.feed_chunk(text):
                                    if event.event_id is not None:
                                        with self._lock:
                                            self._last_event_id = event.event_id
                                    yield event
                        elif hasattr(resp, "__iter__"):
                            for line in resp:
                                text = (
                                    line.decode("utf-8", errors="replace")
                                    if isinstance(line, bytes)
                                    else str(line)
                                )
                                for event in parser.feed_chunk(text):
                                    if event.event_id is not None:
                                        with self._lock:
                                            self._last_event_id = event.event_id
                                    yield event

                        for event in parser.flush():
                            if event.event_id is not None:
                                with self._lock:
                                    self._last_event_id = event.event_id
                            yield event
                return
            except Exception:
                if not reconnect or attempts >= max_reconnect_attempts:
                    raise
                attempts += 1
                time.sleep(reconnect_delay)

    async def stream_async(
        self,
        url: str,
        headers: dict[str, str] | None = None,
        timeout: float = 30.0,
        reconnect: bool = False,
        max_reconnect_attempts: int = 3,
        reconnect_delay: float = 0.1,
    ) -> AsyncIterator[StreamEvent]:
        """Asynchronously stream Server-Sent Events from the specified URL."""
        attempts = 0
        while True:
            req_headers = self._prepare_headers(headers)
            parser = SSEParser()
            with self._lock:
                parser.last_event_id = self._last_event_id

            try:
                if self._async_client is not None:
                    async with self._async_client.stream(
                        "GET", url, headers=req_headers, timeout=timeout
                    ) as resp:
                        async for chunk in resp.aiter_text():
                            for event in parser.feed_chunk(chunk):
                                if event.event_id is not None:
                                    with self._lock:
                                        self._last_event_id = event.event_id
                                yield event
                        for event in parser.flush():
                            if event.event_id is not None:
                                with self._lock:
                                    self._last_event_id = event.event_id
                            yield event
                else:
                    async with httpx.AsyncClient(timeout=timeout) as client:
                        async with client.stream(
                            "GET", url, headers=req_headers, timeout=timeout
                        ) as resp:
                            async for chunk in resp.aiter_text():
                                for event in parser.feed_chunk(chunk):
                                    if event.event_id is not None:
                                        with self._lock:
                                            self._last_event_id = event.event_id
                                    yield event
                            for event in parser.flush():
                                if event.event_id is not None:
                                    with self._lock:
                                        self._last_event_id = event.event_id
                                yield event
                return
            except Exception:
                if not reconnect or attempts >= max_reconnect_attempts:
                    raise
                attempts += 1
                await asyncio.sleep(reconnect_delay)
