from __future__ import annotations
import hashlib
import json
from typing import Any, Mapping

def _normalize(value: Any) -> Any:
    """Make inputs deterministic:
    - trim strings; coerce 'true'/'false' (case-insensitive) to real booleans
    - sort dict keys
    - sort list/tuple/set contents by their JSON representation
    """
    if isinstance(value, str):
        s = value.strip()
        sl = s.lower()
        if sl == "true":
            return True
        if sl == "false":
            return False
        return s
    if isinstance(value, Mapping):
        return {k: _normalize(value[k]) for k in sorted(value)}
    if isinstance(value, (list, tuple, set)):
        items = [_normalize(v) for v in value]
        # sort by JSON so mixed types remain stable
        items_sorted = sorted(items, key=lambda v: json.dumps(v, sort_keys=True, separators=(",", ":")))
        return items_sorted
    return value

def compute_task_hash(action_codename: str, params: dict | None, datasets: dict | None) -> str:
    """
    Deterministic SHA256 over the action + normalized params + normalized datasets.
    Pass dataset *IDs* here (not paths) so the key stays stable across machines.
    """
    payload = {
        "action": action_codename,
        "params": _normalize(params or {}),
        "datasets": _normalize(datasets or {}),
    }
    blob = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(blob).hexdigest()
