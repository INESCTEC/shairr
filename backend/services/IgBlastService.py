import receptor_utils

class IgBlastService:
    # Registry of endpoint paths and their corresponding enums
    enum_registry = {
        "download_germline": receptor_utils.download_germline_set,
        "output_ndm": receptor_utils.make_igblast_ndm,
        "annotate": receptor_utils.annotate_j
    }

