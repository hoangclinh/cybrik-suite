import socket
import threading
import time

def handle(conn):
    try:
        conn.sendall(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nOK")
    except Exception:
        pass
    finally:
        conn.close()

def serve(port):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(("0.0.0.0", port))
    s.listen(5)
    while True:
        c, _ = s.accept()
        threading.Thread(target=handle, args=(c,)).start()

if __name__ == "__main__":
    for p in [5432, 6379, 8000, 8600, 9000, 8080]:
        t = threading.Thread(target=serve, args=(p,), daemon=True)
        t.start()
    while True:
        time.sleep(1)
