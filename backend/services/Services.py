import math
from email.message import Message
from urllib.parse import unquote

import numpy
import requests


class Services:
    @staticmethod
    def extract_request_filename(request: requests.models.Response) -> str | None:
        """ 
        Get filename from a download request
        """
        cd = request.headers.get("Content-Disposition")
        if not cd:
            return None

        msg = Message()
        msg["Content-Disposition"] = cd

        fn_star = msg.get_param("filename*", header="Content-Disposition")
        if fn_star:
            charset, _, rest = fn_star.partition("'")
            _, _, encoded = rest.partition("'")
            if encoded:
                return unquote(encoded, encoding=(charset or "utf-8"), errors="replace")

        # Fallback to plain "filename"
        return msg.get_param("filename", header="Content-Disposition")


    @staticmethod
    def list_to_str(list_of_str: list[str]):
        return ','.join(str(x) for x in list_of_str)

    @staticmethod
    def _is_non_finite_number(x):
        # Works for Python floats and NumPy float types
        try:
            return isinstance(x, (float, numpy.floating)) and not math.isfinite(float(x))
        except Exception:
            return False

    @staticmethod
    def sanitize_numpy(obj):
        """
        Recursively convert:
          - np.ndarray -> list
          - NumPy scalars -> Python scalars
          - NaN/Inf/-Inf -> None
          - dict/list/tuple -> sanitized equivalents
        """
        if isinstance(obj, dict):
            return {k: Services.sanitize_numpy(v) for k, v in obj.items()}
        if isinstance(obj, (list, tuple)):
            return [Services.sanitize_numpy(v) for v in obj]
        if isinstance(obj, numpy.ndarray):
            return Services.sanitize_numpy(obj.tolist())
        if Services._is_non_finite_number(obj):
            return None
        if isinstance(obj, (numpy.integer,)):
            return int(obj)
        if isinstance(obj, (numpy.floating,)):
            # At this point it's finite
            return float(obj)
        if isinstance(obj, (numpy.bool_,)):
            return bool(obj)
        return obj  # str, int, float (finite), bool, None, etc.
