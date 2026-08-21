from enum import Enum

class IgblastLocus(str, Enum):
    IGH = "IGH"
    IGK = "IGK"
    IGL = "IGL"
    TRA = "TRA"
    TRB = "TRB"
    TRD = "TRD"
    TRG = "TRG"

class IgblastDownloadOptions(str, Enum):
    SINGLE_FG = "SINGLE-FG"
    MULTI_F = "MULTI-F"
    MULTI_IGBLAST = "MULTI-IGBLAST"

