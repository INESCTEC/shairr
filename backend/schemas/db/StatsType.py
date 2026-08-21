from enum import Enum

class StatsType(Enum):
    GENE_USAGE = 'gene_usage'
    REPERTOIRE_OVERLAP = 'repertoire_overlap'
    NUMBER_CLONOTYPES = 'number_clonotypes'
    DISTRO_CLONOTYPES = 'distro_clonotypes'
    CDR3_LEN = 'distro_cdr3_length'
    TOP_CLONES = 'top_clones'
    TRACK_CLONOTYPES = 'track_clonotypes'
    CLONAL_PROPORTION = 'basic_clonal_proportion'
    DIVERSITY = 'diversity'
    CLONAL_NETWORKS = 'clonal_networks'
    PHYLO_TREES = 'phylo_trees'
