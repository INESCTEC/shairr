from pathlib import Path
from typing import List

MAX_FILE_BYTES = 512 * 1024        # 512 KiB per file
MAX_TOTAL_BYTES = 2 * 1024 * 1024  # 2 MiB total response


class NextflowLogReader:
    @staticmethod
    def collect(work_dir: Path, include_stderr: bool) -> List[Path]:
        patterns = ["*/*/.command.log"]
        if include_stderr:
            patterns.append("*/*/.command.err")

        matches: List[Path] = []
        for pat in patterns:
            matches.extend(work_dir.glob(pat))

        files: List[Path] = []
        for p in matches:
            try:
                # Discard empty logs no point in appending them
                if p.is_file() and p.stat().st_size > 0:
                    files.append(p)

            except OSError:
                continue

        # Order by mtime (oldest -> newest). If you want newest first, set reverse=True.
        files.sort(key=lambda p: p.stat().st_mtime)
        return files

    @staticmethod
    def render(files: List[Path], base_dir: Path, max_file_bytes: int = MAX_FILE_BYTES, max_total_bytes: int = MAX_TOTAL_BYTES) -> str:
        out: list[str] = []
        used = 0

        for p in files:
            if used >= max_total_bytes:
                break

            header = f"\n===== {p.relative_to(base_dir)} =====\n"
            header_bytes = header.encode("utf-8", errors="replace")
            if used + len(header_bytes) > max_total_bytes:
                break

            out.append(header)
            used += len(header_bytes)

            try:
                with p.open("rb") as f:
                    # Per-file cap
                    data = f.read(max_file_bytes)
            except OSError:
                continue

            if not data:
                continue

            remaining = max_total_bytes - used
            if len(data) > remaining:
                # Total size cap
                data = data[:remaining]

            text = data.decode("utf-8", errors="replace")
            out.append(text)
            used += len(data)

            if used < max_total_bytes and not text.endswith("\n"):
                out.append("\n")
                used += 1

        return "".join(out).lstrip("\n")
