"""
VPN Config Checker for Windows
- Paste messy Telegram text and extract proxy links / JSON configs.
- Tests Xray-compatible links with Xray Core.
- Tests Hysteria2 and TUIC with sing-box.
- Verifies https://aistudio.google.com/ returns HTTP 200 through each proxy.
- Includes a Setup button to locate or download the required core binaries.

Install:
    py -m pip install PySide6

Run:
    py vpn_config_checker.py

Notes:
- Core downloads are fetched from official GitHub release APIs when Setup > Download is used.
- Xray and sing-box are run as separate local processes per test with unique local ports.
- A successful result means the AI Studio URL returned HTTP 200 through that proxy.
"""

from __future__ import annotations

import base64
import concurrent.futures
import json
import os
import platform
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

from PySide6.QtCore import QObject, QThread, Signal, Qt
from PySide6.QtGui import QFont
from PySide6.QtWidgets import (
    QApplication, QCheckBox, QComboBox, QDialog, QFileDialog, QFormLayout,
    QGridLayout, QGroupBox, QHBoxLayout, QLabel, QLineEdit, QMainWindow,
    QMessageBox, QPlainTextEdit, QProgressBar, QPushButton, QSpinBox,
    QTableWidget, QTableWidgetItem, QVBoxLayout, QWidget, QHeaderView
)

APP_NAME = "VPN Config Checker"
AI_STUDIO_URL = "https://aistudio.google.com/"
CONNECT_TIMEOUT = 8
HTTP_TIMEOUT = 15
MAX_TEXT_CHARS = 8_000_000

# ----------------------------- Extraction -----------------------------

URI_RE = re.compile(
    r'(?i)(?:vmess|vless|trojan|ss|socks|socks5|http|https|hysteria2|hy2|tuic)://[^\s<>"\'`]+'
)
JSON_START_RE = re.compile(r'[\[{]')


def clean_candidate(s: str) -> str:
    return s.strip().strip("()[]{}<>,;\"'`").rstrip(".,!?，。；")


def decode_b64(s: str) -> bytes:
    s = s.strip()
    s += "=" * ((4 - len(s) % 4) % 4)
    try:
        return base64.urlsafe_b64decode(s.encode())
    except Exception:
        return base64.b64decode(s.encode())


def parse_json_candidates(text: str) -> list[dict]:
    """Find complete JSON objects/arrays embedded in arbitrary chat text."""
    found = []
    decoder = json.JSONDecoder()
    for m in JSON_START_RE.finditer(text):
        try:
            obj, end = decoder.raw_decode(text[m.start():])
            if isinstance(obj, dict):
                # Avoid treating arbitrary Telegram JSON fragments as Xray configs.
                if any(k in obj for k in ("outbounds", "inbounds", "outbound", "server", "proxies")):
                    found.append(obj)
        except Exception:
            continue
    unique = {}
    for obj in found:
        key = json.dumps(obj, sort_keys=True, ensure_ascii=False)
        unique[key] = obj
    return list(unique.values())


def extract_configs(text: str) -> tuple[list[str], list[str]]:
    if len(text) > MAX_TEXT_CHARS:
        raise ValueError(f"Input is too large (maximum {MAX_TEXT_CHARS:,} characters).")
    candidates = []
    for match in URI_RE.finditer(text):
        item = clean_candidate(match.group(0))
        if item:
            candidates.append(item)

    # Some Telegram posts contain base64-encoded vmess:// payloads on their own lines;
    # normal vmess links are already caught by URI_RE.
    json_items = []
    for obj in parse_json_candidates(text):
        json_items.append(json.dumps(obj, ensure_ascii=False, separators=(",", ":")))

    # Deduplicate while preserving order.
    seen, unique = set(), []
    for item in candidates + json_items:
        key = item.strip()
        if key and key not in seen:
            seen.add(key)
            unique.append(key)
    return unique, json_items


# ----------------------------- Config conversion -----------------------------

def parse_qs_fragment(raw: str) -> dict[str, str]:
    return {k: v[-1] for k, v in urllib.parse.parse_qs(raw, keep_blank_values=True).items()}


def decode_vmess(uri: str) -> dict:
    payload = uri.split("://", 1)[1].split("#", 1)[0]
    data = json.loads(decode_b64(payload).decode("utf-8", "replace"))
    return data


def parse_server_port(netloc: str) -> tuple[str, int]:
    host, sep, port = netloc.rpartition(":")
    if not sep:
        raise ValueError("Missing server port")
    host = host.strip("[]")
    return host, int(port)


def tls_settings(query: dict[str, str], server_name: str = "") -> Optional[dict]:
    security = query.get("security", "")
    if security in ("tls", "reality") or query.get("tls") in ("true", "1"):
        tls = {"enabled": True}
        sni = query.get("sni") or query.get("servername") or server_name
        if sni:
            tls["server_name"] = sni
        if query.get("alpn"):
            tls["alpn"] = query["alpn"].split(",")
        if security == "reality":
            reality = {
                "enabled": True,
                "public_key": query.get("pbk", ""),
                "short_id": query.get("sid", ""),
            }
            if query.get("fp"):
                tls["utls"] = {"enabled": True, "fingerprint": query["fp"]}
            tls["reality"] = reality
        return tls
    return None


def uri_to_singbox(uri: str, tag: str = "proxy") -> tuple[dict, str]:
    scheme, rest = uri.split("://", 1)
    scheme = scheme.lower()
    name = urllib.parse.unquote(rest.split("#", 1)[1]) if "#" in rest else scheme.upper()
    body = rest.split("#", 1)[0]

    if scheme == "vmess":
        d = decode_vmess(uri)
        outbound = {
            "type": "vmess", "tag": tag,
            "server": d.get("add", ""), "server_port": int(d.get("port", 443)),
            "uuid": d.get("id", ""), "alter_id": int(d.get("aid", 0) or 0),
            "security": d.get("scy", "auto") or "auto",
        }
        net = d.get("net", "tcp")
        if net == "ws":
            outbound["transport"] = {"type": "ws", "path": d.get("path", "")}
            if d.get("host"):
                outbound["transport"]["headers"] = {"Host": d["host"]}
        elif net == "grpc":
            outbound["transport"] = {"type": "grpc", "service_name": d.get("path", "")}
        if d.get("tls") == "tls":
            outbound["tls"] = {"enabled": True, "server_name": d.get("sni") or d.get("host") or d.get("add")}
        return outbound, name

    parsed = urllib.parse.urlsplit(uri)
    q = parse_qs_fragment(parsed.query)
    if scheme in ("vless", "trojan", "hysteria2", "hy2", "tuic"):
        host = parsed.hostname
        port = parsed.port
        if not host or not port:
            raise ValueError("Invalid host or port")
        user = urllib.parse.unquote(parsed.username or "")
        password = urllib.parse.unquote(parsed.password or "")
        if scheme == "vless":
            out = {"type": "vless", "tag": tag, "server": host, "server_port": port, "uuid": user}
            if q.get("flow"):
                out["flow"] = q["flow"]
            tls = tls_settings(q, host)
            if tls:
                out["tls"] = tls
            net = q.get("type", "tcp")
            if net == "ws":
                transport = {"type": "ws", "path": q.get("path", "")}
                if q.get("host"):
                    transport["headers"] = {"Host": q["host"]}
                out["transport"] = transport
            elif net == "grpc":
                out["transport"] = {"type": "grpc", "service_name": q.get("serviceName", q.get("service_name", ""))}
            return out, name
        if scheme == "trojan":
            out = {"type": "trojan", "tag": tag, "server": host, "server_port": port, "password": user or password}
            tls = tls_settings(q, host) or {"enabled": True, "server_name": q.get("sni", host)}
            out["tls"] = tls
            if q.get("type") == "ws":
                transport = {"type": "ws", "path": q.get("path", "")}
                if q.get("host"):
                    transport["headers"] = {"Host": q["host"]}
                out["transport"] = transport
            return out, name
        if scheme in ("hysteria2", "hy2"):
            out = {"type": "hysteria2", "tag": tag, "server": host, "server_port": port, "password": user or password}
            tls = {"enabled": True, "server_name": q.get("sni", host)}
            if q.get("insecure") in ("1", "true"):
                tls["insecure"] = True
            if q.get("obfs"):
                tls["obfs"] = {"type": q["obfs"], "password": q.get("obfs-password", "")}
            out["tls"] = tls
            return out, name
        if scheme == "tuic":
            out = {
                "type": "tuic", "tag": tag, "server": host, "server_port": port,
                "uuid": user, "password": password,
                "congestion_control": q.get("congestion_control", "bbr"),
                "udp_relay_mode": q.get("udp_relay_mode", "native"),
                "tls": {"enabled": True, "server_name": q.get("sni", host)},
            }
            return out, name

    if scheme == "ss":
        # SIP002: ss://userinfo@host:port or base64(method:password@host:port)
        if "@" not in body:
            decoded = decode_b64(body.split("?", 1)[0]).decode("utf-8", "replace")
            body = decoded + (("?" + body.split("?", 1)[1]) if "?" in body else "")
        p = urllib.parse.urlsplit("ss://" + body)
        host, port = p.hostname, p.port
        userinfo = urllib.parse.unquote(p.username or "")
        if ":" in userinfo:
            method, password = userinfo.split(":", 1)
        else:
            decoded = decode_b64(userinfo).decode("utf-8", "replace")
            method, password = decoded.split(":", 1)
        return {"type": "shadowsocks", "tag": tag, "server": host, "server_port": port,
                "method": method, "password": password}, name

    if scheme in ("socks", "socks5", "http", "https"):
        p = urllib.parse.urlsplit(uri)
        if not p.hostname or not p.port:
            raise ValueError("Invalid proxy address")
        typ = "socks" if scheme.startswith("socks") else "http"
        out = {"type": typ, "tag": tag, "server": p.hostname, "server_port": p.port}
        if p.username:
            out["username"] = urllib.parse.unquote(p.username)
        if p.password:
            out["password"] = urllib.parse.unquote(p.password)
        if scheme == "https":
            out["tls"] = {"enabled": True}
        return out, name

    raise ValueError(f"Unsupported scheme: {scheme}")


def json_to_singbox(raw: str, tag: str = "proxy") -> tuple[dict, str]:
    obj = json.loads(raw)
    # First recognize sing-box's outbound schema (it uses "type").
    if isinstance(obj, dict) and isinstance(obj.get("outbounds"), list):
        singbox_outs = [x for x in obj["outbounds"] if isinstance(x, dict) and x.get("type")]
        if singbox_outs:
            for outbound in singbox_outs:
                if outbound.get("type") not in ("direct", "block", "dns"):
                    outbound = dict(outbound)
                    outbound["tag"] = tag
                    return outbound, "sing-box JSON"
            raise ValueError("No usable outbound found in sing-box JSON")
    if isinstance(obj, dict) and isinstance(obj.get("outbound"), dict):
        outbound = dict(obj["outbound"])
        if outbound.get("type"):
            outbound["tag"] = tag
            return outbound, "JSON config"
    # Otherwise interpret the document as an Xray JSON config.
    outs = obj.get("outbounds", []) if isinstance(obj, dict) else []
    for x in outs:
        if x.get("protocol") in ("vless", "vmess", "trojan", "shadowsocks", "socks", "http"):
            settings = x.get("settings", {})
            servers = settings.get("vnext") or settings.get("servers") or []
            if x["protocol"] in ("vless", "vmess") and servers:
                srv = servers[0]
                user = (srv.get("users") or [{}])[0]
                out = {"type": x["protocol"], "tag": tag, "server": srv["address"],
                       "server_port": int(srv["port"]), "uuid": user.get("id", ""),
                       "alter_id": int(user.get("alterId", 0)), "security": user.get("security", "auto")}
                stream = obj.get("streamSettings", {})
                if stream.get("security") == "tls":
                    out["tls"] = {"enabled": True, "server_name": stream.get("tlsSettings", {}).get("serverName", "")}
                return out, "Xray JSON"
            if x["protocol"] == "trojan" and servers:
                srv = servers[0]
                return {"type": "trojan", "tag": tag, "server": srv["address"], "server_port": int(srv["port"]),
                        "password": (srv.get("password") or "") , "tls": {"enabled": True}}, "Xray JSON"
            if x["protocol"] == "shadowsocks" and servers:
                srv = servers[0]
                return {"type": "shadowsocks", "tag": tag, "server": srv["address"], "server_port": int(srv["port"]),
                        "method": srv.get("method", "aes-128-gcm"), "password": srv.get("password", "")}, "Xray JSON"
    raise ValueError("Could not identify a supported outbound in JSON")


def make_singbox_config(outbound: dict, port: int) -> dict:
    return {
        "log": {"level": "error"},
        "inbounds": [{"type": "mixed", "tag": "local-in", "listen": "127.0.0.1", "listen_port": port}],
        "outbounds": [outbound, {"type": "direct", "tag": "direct"}],
        "route": {"final": outbound.get("tag", "proxy")}
    }


def make_xray_config(outbound: dict, port: int) -> dict:
    # Convert supported sing-box outbound objects to Xray outbound protocol format.
    typ = outbound["type"]
    server = {"address": outbound["server"], "port": int(outbound["server_port"])}
    settings = {}
    stream = {"network": "tcp"}
    tls = outbound.get("tls", {})
    if tls.get("enabled"):
        if tls.get("reality", {}).get("enabled"):
            stream["security"] = "reality"
            reality = tls["reality"]
            stream["realitySettings"] = {
                "serverName": tls.get("server_name", ""),
                "publicKey": reality.get("public_key", ""),
                "shortId": reality.get("short_id", ""),
                "fingerprint": tls.get("utls", {}).get("fingerprint", "chrome"),
            }
        else:
            stream["security"] = "tls"
            stream["tlsSettings"] = {"serverName": tls.get("server_name", "")}
            if tls.get("alpn"):
                stream["tlsSettings"]["alpn"] = tls["alpn"]
    if typ in ("vless", "vmess"):
        user = {"id": outbound.get("uuid", ""), "encryption": "none"}
        if outbound.get("flow"):
            user["flow"] = outbound["flow"]
        if typ == "vmess":
            user["alterId"] = int(outbound.get("alter_id", 0))
            user["security"] = outbound.get("security", "auto")
        settings = {"vnext": [{**server, "users": [user]}]}
    elif typ == "trojan":
        settings = {"servers": [{**server, "password": outbound.get("password", "")}]}
    elif typ == "shadowsocks":
        settings = {"servers": [{**server, "method": outbound.get("method", "aes-128-gcm"),
                                  "password": outbound.get("password", "")}]}
    elif typ in ("socks", "http"):
        settings = {"servers": [{**server, "users": ([{"user": outbound["username"], "pass": outbound.get("password", "")}]
                                                     if outbound.get("username") else [])}]}
    else:
        raise ValueError(f"{typ} requires sing-box")
    transport = outbound.get("transport", {})
    if transport:
        if transport.get("type") == "ws":
            stream["network"] = "ws"
            stream["wsSettings"] = {"path": transport.get("path", ""),
                                    "headers": transport.get("headers", {})}
        elif transport.get("type") == "grpc":
            stream["network"] = "grpc"
            stream["grpcSettings"] = {"serviceName": transport.get("service_name", "")}
    return {
        "log": {"loglevel": "error"},
        "inbounds": [{"listen": "127.0.0.1", "port": port, "protocol": "http",
                      "settings": {"allowTransparent": False}}],
        "outbounds": [{"tag": "proxy", "protocol": typ, "settings": settings, "streamSettings": stream}],
    }


# ----------------------------- Core setup -----------------------------

def github_latest_asset(repo: str, patterns: tuple[str, ...]) -> tuple[str, str]:
    url = f"https://api.github.com/repos/{repo}/releases/latest"
    req = urllib.request.Request(url, headers={"User-Agent": APP_NAME, "Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(req, timeout=20) as r:
        data = json.load(r)
    assets = data.get("assets", [])
    for asset in assets:
        name = asset.get("name", "").lower()
        if all(p.lower() in name for p in patterns):
            return asset["browser_download_url"], asset["name"]
    raise RuntimeError(f"No Windows release asset found for {repo}. Check its release page manually.")


def download_and_extract(repo: str, patterns: tuple[str, ...], destination: Path, exe_name: str) -> Path:
    url, archive_name = github_latest_asset(repo, patterns)
    destination.mkdir(parents=True, exist_ok=True)
    archive = destination / archive_name
    req = urllib.request.Request(url, headers={"User-Agent": APP_NAME})
    with urllib.request.urlopen(req, timeout=60) as response, open(archive, "wb") as out:
        shutil.copyfileobj(response, out)
    with zipfile.ZipFile(archive) as zf:
        members = [m for m in zf.namelist() if Path(m).name.lower() == exe_name.lower()]
        if not members:
            raise RuntimeError(f"{exe_name} was not found in downloaded archive.")
        member = members[0]
        target = destination / exe_name
        with zf.open(member) as src, open(target, "wb") as dst:
            shutil.copyfileobj(src, dst)
    try:
        archive.unlink()
    except OSError:
        pass
    return destination / exe_name


def find_core(exe: str, configured: str) -> Optional[str]:
    if configured and Path(configured).is_file():
        return configured
    found = shutil.which(exe)
    if found:
        return found
    candidates = []
    if os.environ.get("PROGRAMFILES"):
        candidates += list(Path(os.environ["PROGRAMFILES"]).glob(f"*/{exe}"))
    if os.environ.get("LOCALAPPDATA"):
        candidates += list(Path(os.environ["LOCALAPPDATA"]).glob(f"*/{exe}"))
    for base in [Path.cwd(), Path.home() / "AppData/Local", Path("C:/v2rayN"), Path("C:/Program Files")]:
        if base.exists():
            try:
                candidates += list(base.glob(f"**/{exe}"))
            except OSError:
                pass
    return str(candidates[0]) if candidates else None


# ----------------------------- Testing -----------------------------

@dataclass
class TestResult:
    index: int
    name: str
    config: str
    delay_ms: Optional[int]
    status: str
    detail: str


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def wait_port(port: int, process: subprocess.Popen, timeout: float = 7.0) -> bool:
    end = time.time() + timeout
    while time.time() < end:
        if process.poll() is not None:
            return False
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.25):
                return True
        except OSError:
            time.sleep(0.12)
    return False


def request_via_local_proxy(port: int) -> tuple[int, int]:
    proxy = f"http://127.0.0.1:{port}"
    opener = urllib.request.build_opener(
        urllib.request.ProxyHandler({"http": proxy, "https": proxy})
    )
    req = urllib.request.Request(AI_STUDIO_URL, headers={"User-Agent": "Mozilla/5.0 VPNConfigChecker"})
    start = time.perf_counter()
    with opener.open(req, timeout=HTTP_TIMEOUT) as response:
        status = response.getcode()
        response.read(2048)
    return status, int((time.perf_counter() - start) * 1000)


def run_one(index: int, config_text: str, xray_path: str, singbox_path: str) -> TestResult:
    name = f"Config {index}"
    temp_dir = Path(tempfile.mkdtemp(prefix="vpncheck_"))
    process = None
    try:
        if config_text.lstrip().startswith("{"):
            outbound, name = json_to_singbox(config_text)
        else:
            outbound, name = uri_to_singbox(config_text)
        use_singbox = outbound["type"] in ("hysteria2", "tuic")
        core = singbox_path if use_singbox else xray_path
        if not core or not Path(core).is_file():
            raise RuntimeError("Required core is not configured. Open Setup.")
        port = free_port()
        if use_singbox:
            cfg = make_singbox_config(outbound, port)
            cfg_path = temp_dir / "config.json"
            cfg_path.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
            args = [core, "run", "-c", str(cfg_path)]
        else:
            cfg = make_xray_config(outbound, port)
            cfg_path = temp_dir / "config.json"
            cfg_path.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
            args = [core, "run", "-c", str(cfg_path)]
        creationflags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        process = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                   stdin=subprocess.DEVNULL, creationflags=creationflags)
        if not wait_port(port, process):
            raise RuntimeError("Proxy core failed to start or local proxy did not open.")
        status, delay = request_via_local_proxy(port)
        if status == 200:
            return TestResult(index, name, config_text, delay, "WORKING", "AI Studio returned HTTP 200")
        return TestResult(index, name, config_text, delay, "FAILED", f"AI Studio returned HTTP {status}")
    except urllib.error.HTTPError as e:
        return TestResult(index, name, config_text, None, "FAILED", f"AI Studio returned HTTP {e.code}")
    except Exception as e:
        return TestResult(index, name, config_text, None, "FAILED", str(e)[:180])
    finally:
        if process:
            try:
                process.terminate()
                process.wait(timeout=2)
            except Exception:
                try:
                    process.kill()
                except Exception:
                    pass
        shutil.rmtree(temp_dir, ignore_errors=True)


class TestWorker(QObject):
    progress = Signal(int, int)
    result = Signal(object)
    finished = Signal()

    def __init__(self, configs: list[str], xray: str, singbox: str, concurrency: int):
        super().__init__()
        self.configs, self.xray, self.singbox = configs, xray, singbox
        self.concurrency = concurrency
        self.cancel_event = threading.Event()

    def cancel(self):
        self.cancel_event.set()

    def run(self):
        total = len(self.configs)
        completed = 0
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.concurrency) as pool:
            futures = {
                pool.submit(run_one, i + 1, cfg, self.xray, self.singbox): (i + 1, cfg)
                for i, cfg in enumerate(self.configs)
            }
            for future in concurrent.futures.as_completed(futures):
                if self.cancel_event.is_set():
                    for f in futures:
                        f.cancel()
                    break
                try:
                    self.result.emit(future.result())
                except Exception as e:
                    i, cfg = futures[future]
                    self.result.emit(TestResult(i, f"Config {i}", cfg, None, "FAILED", str(e)))
                completed += 1
                self.progress.emit(completed, total)
        self.finished.emit()


# ----------------------------- UI -----------------------------

class SetupDialog(QDialog):
    paths_changed = Signal(str, str)

    def __init__(self, xray: str, singbox: str, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Core setup")
        self.setMinimumWidth(620)
        self.xray_path, self.singbox_path = xray, singbox
        layout = QVBoxLayout(self)
        note = QLabel("The app needs Xray Core for common Xray protocols and sing-box for Hysteria2/TUIC. "
                      "You can locate existing binaries or download the latest Windows builds.")
        note.setWordWrap(True)
        layout.addWidget(note)
        form = QFormLayout()
        self.xray_edit = QLineEdit(xray)
        self.singbox_edit = QLineEdit(singbox)
        form.addRow("xray.exe", self._path_row(self.xray_edit, "xray.exe"))
        form.addRow("sing-box.exe", self._path_row(self.singbox_edit, "sing-box.exe"))
        layout.addLayout(form)
        buttons = QHBoxLayout()
        self.download_btn = QPushButton("Download missing cores")
        self.download_btn.clicked.connect(self.download_missing)
        save_btn = QPushButton("Save")
        save_btn.clicked.connect(self.save)
        buttons.addWidget(self.download_btn)
        buttons.addStretch()
        buttons.addWidget(save_btn)
        layout.addLayout(buttons)
        self.status = QLabel("")
        self.status.setWordWrap(True)
        layout.addWidget(self.status)

    def _path_row(self, edit, label):
        w = QWidget()
        l = QHBoxLayout(w); l.setContentsMargins(0, 0, 0, 0)
        l.addWidget(edit)
        b = QPushButton("Browse…")
        b.clicked.connect(lambda: self.browse(edit, label))
        l.addWidget(b)
        return w

    def browse(self, edit, label):
        path, _ = QFileDialog.getOpenFileName(self, f"Select {label}", "", "Executable (*.exe)")
        if path:
            edit.setText(path)

    def download_missing(self):
        self.download_btn.setEnabled(False)
        self.status.setText("Downloading official release archives…")
        QApplication.processEvents()
        try:
            dest = Path.home() / "AppData/Local/VPNConfigChecker/cores"
            if not self.xray_edit.text() or not Path(self.xray_edit.text()).is_file():
                p = download_and_extract("XTLS/Xray-core", ("windows", "64", ".zip"), dest / "xray", "xray.exe")
                self.xray_edit.setText(str(p))
            if not self.singbox_edit.text() or not Path(self.singbox_edit.text()).is_file():
                p = download_and_extract("SagerNet/sing-box", ("windows", "amd64", ".zip"), dest / "sing-box", "sing-box.exe")
                self.singbox_edit.setText(str(p))
            self.status.setText("Core setup complete. Review the paths and click Save.")
        except Exception as e:
            self.status.setText(f"Setup failed: {e}")
        finally:
            self.download_btn.setEnabled(True)

    def save(self):
        self.paths_changed.emit(self.xray_edit.text().strip(), self.singbox_edit.text().strip())
        self.accept()


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle(APP_NAME)
        self.resize(1120, 780)
        self.settings_path = Path.home() / "AppData/Local/VPNConfigChecker/settings.json"
        self.settings_path.parent.mkdir(parents=True, exist_ok=True)
        settings = {}
        try:
            settings = json.loads(self.settings_path.read_text(encoding="utf-8"))
        except Exception:
            pass
        self.xray_path = settings.get("xray", "") or find_core("xray.exe", "")
        self.singbox_path = settings.get("singbox", "") or find_core("sing-box.exe", "")
        self.configs: list[str] = []
        self.results: list[TestResult] = []
        self.worker_thread = None
        self.worker = None

        root = QWidget()
        self.setCentralWidget(root)
        layout = QVBoxLayout(root)

        top = QHBoxLayout()
        title = QLabel("VPN Configuration Checker")
        title.setFont(QFont("Segoe UI", 17, QFont.Bold))
        top.addWidget(title)
        top.addStretch()
        self.setup_btn = QPushButton("⚙ Setup cores")
        self.setup_btn.clicked.connect(self.open_setup)
        top.addWidget(self.setup_btn)
        layout.addLayout(top)

        paste_group = QGroupBox("1. Paste Telegram messages")
        pg = QVBoxLayout(paste_group)
        self.paste_box = QPlainTextEdit()
        self.paste_box.setPlaceholderText("Paste any amount of Telegram text here — links, captions, emojis, JSON, mixed messages…")
        self.paste_box.setMinimumHeight(190)
        pg.addWidget(self.paste_box)
        row = QHBoxLayout()
        self.extract_btn = QPushButton("Extract configurations")
        self.extract_btn.clicked.connect(self.extract)
        self.load_btn = QPushButton("Load .txt file")
        self.load_btn.clicked.connect(self.load_file)
        self.clear_btn = QPushButton("Clear")
        self.clear_btn.clicked.connect(self.paste_box.clear)
        row.addWidget(self.extract_btn); row.addWidget(self.load_btn); row.addWidget(self.clear_btn); row.addStretch()
        pg.addLayout(row)
        layout.addWidget(paste_group)

        test_row = QHBoxLayout()
        self.count_label = QLabel("No configurations extracted")
        test_row.addWidget(self.count_label)
        test_row.addStretch()
        test_row.addWidget(QLabel("Concurrent tests:"))
        self.concurrency = QSpinBox()
        self.concurrency.setRange(1, 50); self.concurrency.setValue(10)
        test_row.addWidget(self.concurrency)
        self.test_btn = QPushButton("Test AI Studio (HTTP 200)")
        self.test_btn.clicked.connect(self.start_tests)
        self.test_btn.setEnabled(False)
        test_row.addWidget(self.test_btn)
        self.stop_btn = QPushButton("Stop")
        self.stop_btn.clicked.connect(self.stop_tests)
        self.stop_btn.setEnabled(False)
        test_row.addWidget(self.stop_btn)
        layout.addLayout(test_row)

        self.progress = QProgressBar()
        self.progress.setValue(0)
        layout.addWidget(self.progress)

        self.table = QTableWidget(0, 5)
        self.table.setHorizontalHeaderLabels(["#", "Configuration name", "Delay", "AI Studio", "Details"])
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(4, QHeaderView.Stretch)
        self.table.setSelectionBehavior(QTableWidget.SelectRows)
        self.table.setEditTriggers(QTableWidget.NoEditTriggers)
        layout.addWidget(self.table, 1)

        bottom = QHBoxLayout()
        self.summary = QLabel("Working: 0 | Failed: 0")
        bottom.addWidget(self.summary)
        bottom.addStretch()
        self.copy_working_btn = QPushButton("Copy working")
        self.copy_working_btn.clicked.connect(self.copy_working)
        self.copy_working_btn.setEnabled(False)
        self.copy_all_btn = QPushButton("Copy all extracted")
        self.copy_all_btn.clicked.connect(self.copy_all)
        self.copy_all_btn.setEnabled(False)
        self.export_btn = QPushButton("Export working .txt")
        self.export_btn.clicked.connect(self.export_working)
        self.export_btn.setEnabled(False)
        bottom.addWidget(self.copy_working_btn)
        bottom.addWidget(self.copy_all_btn)
        bottom.addWidget(self.export_btn)
        layout.addLayout(bottom)

        self.statusBar().showMessage("Ready. Configure cores if they were not detected automatically.")

    def open_setup(self):
        dlg = SetupDialog(self.xray_path, self.singbox_path, self)
        dlg.paths_changed.connect(self.save_paths)
        dlg.exec()

    def save_paths(self, xray, singbox):
        self.xray_path, self.singbox_path = xray, singbox
        self.settings_path.write_text(json.dumps({"xray": xray, "singbox": singbox}, indent=2), encoding="utf-8")
        self.statusBar().showMessage("Core paths saved.")

    def extract(self):
        try:
            self.configs, _ = extract_configs(self.paste_box.toPlainText())
        except Exception as e:
            QMessageBox.warning(self, "Extraction error", str(e)); return
        self.results.clear()
        self.table.setRowCount(0)
        self.count_label.setText(f"{len(self.configs)} unique configurations extracted")
        self.test_btn.setEnabled(bool(self.configs))
        self.copy_all_btn.setEnabled(bool(self.configs))
        self.copy_working_btn.setEnabled(False)
        self.export_btn.setEnabled(False)
        self.summary.setText("Working: 0 | Failed: 0")
        self.statusBar().showMessage(f"Extracted {len(self.configs)} unique configurations.")

    def load_file(self):
        path, _ = QFileDialog.getOpenFileName(self, "Open text file", "", "Text files (*.txt *.log *.md);;All files (*.*)")
        if path:
            try:
                self.paste_box.setPlainText(Path(path).read_text(encoding="utf-8", errors="replace"))
            except Exception as e:
                QMessageBox.warning(self, "File error", str(e))

    def start_tests(self):
        if not self.configs:
            return
        # Ensure a suitable engine exists before scheduling a large batch.
        if not self.xray_path and not self.singbox_path:
            QMessageBox.information(self, "Setup required", "Open Setup cores and download or locate Xray and sing-box.")
            self.open_setup()
        self.results.clear()
        self.table.setRowCount(0)
        self.progress.setMaximum(len(self.configs)); self.progress.setValue(0)
        self.test_btn.setEnabled(False); self.stop_btn.setEnabled(True)
        self.worker_thread = QThread()
        self.worker = TestWorker(self.configs, self.xray_path, self.singbox_path, self.concurrency.value())
        self.worker.moveToThread(self.worker_thread)
        self.worker_thread.started.connect(self.worker.run)
        self.worker.result.connect(self.add_result)
        self.worker.progress.connect(self.update_progress)
        # Stop the worker thread independently; keep the main window alive.
        self.worker.finished.connect(self.worker_thread.quit)
        self.worker.finished.connect(self.worker.deleteLater)
        self.worker_thread.finished.connect(self.tests_finished)
        self.worker_thread.start()
        self.statusBar().showMessage("Testing configurations through AI Studio…")

    def stop_tests(self):
        if self.worker:
            self.worker.cancel()
            self.stop_btn.setEnabled(False)
            self.statusBar().showMessage("Stopping after active checks finish…")

    def add_result(self, result: TestResult):
        self.results.append(result)
        row = self.table.rowCount(); self.table.insertRow(row)
        values = [str(result.index), result.name, f"{result.delay_ms} ms" if result.delay_ms is not None else "—",
                  result.status, result.detail]
        for col, value in enumerate(values):
            item = QTableWidgetItem(value)
            if col == 3:
                item.setForeground(Qt.darkGreen if result.status == "WORKING" else Qt.red)
            self.table.setItem(row, col, item)
        working = sum(r.status == "WORKING" for r in self.results)
        failed = len(self.results) - working
        self.summary.setText(f"Working: {working} | Failed: {failed}")
        self.copy_working_btn.setEnabled(working > 0)
        self.export_btn.setEnabled(working > 0)

    def update_progress(self, done, total):
        self.progress.setValue(done)
        self.statusBar().showMessage(f"Tested {done}/{total} configurations…")

    def tests_finished(self):
        # Called after the background thread has fully stopped.
        # Keep the window open so results remain available.
        self.test_btn.setEnabled(bool(self.configs))
        self.stop_btn.setEnabled(False)
        self.statusBar().showMessage("Testing finished. You can review, copy, or test another batch.")
        thread = self.worker_thread
        self.worker = None
        self.worker_thread = None
        if thread:
            thread.deleteLater()

    def copy_working(self):
        working = [r.config for r in self.results if r.status == "WORKING"]
        QApplication.clipboard().setText("\n".join(working))
        self.statusBar().showMessage(f"Copied {len(working)} working configurations.")

    def copy_all(self):
        QApplication.clipboard().setText("\n".join(self.configs))
        self.statusBar().showMessage(f"Copied {len(self.configs)} extracted configurations.")

    def export_working(self):
        working = [r.config for r in self.results if r.status == "WORKING"]
        path, _ = QFileDialog.getSaveFileName(self, "Export working configurations", "working_configs.txt", "Text files (*.txt)")
        if path:
            Path(path).write_text("\n".join(working), encoding="utf-8")
            self.statusBar().showMessage(f"Exported {len(working)} configurations.")

    def closeEvent(self, event):
        if self.worker:
            self.worker.cancel()
        event.accept()


def main():
    if platform.system() != "Windows":
        print("This application is designed for Windows, but may run elsewhere.")
    app = QApplication(sys.argv)
    app.setQuitOnLastWindowClosed(False)
    app.setStyle("Fusion")
    window = MainWindow()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
