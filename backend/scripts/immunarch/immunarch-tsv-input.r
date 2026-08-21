suppressPackageStartupMessages({
  library(immunarch)
  library(dplyr)
  library(tidyr)
  library(tibble)
  library(readr)
  library(stringdist)
})

# ===== CLI =====
args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 1) stop("Usage: Rscript immunarch-tsv-input.r <input_dir> [keywords...]")
input_dir <- args[[1]]
keywords  <- if (length(args) > 1) args[-1] else character(0)

ALL_KEYS <- c(
  "number_clonotypes",
  "distro_clonotypes",
  "distro_cdr3_length",
  "basic_clonal_proportion",
  "top_clones",
  "track_clonotypes",
  "gene_usage",
  "repertoire_overlap",
  "overlap_public",
  "overlap_jaccard",
  "diversity",
  "clonal_networks",
  "phylo_trees",
  "clonal_expansion_trees"
)

if (!length(keywords)) keywords <- ALL_KEYS

# ===== Helpers =====
pick_col <- function(cands, df) {
  c <- intersect(cands, names(df))
  if (length(c)) c[[1]] else NA_character_
}

nonempty_n <- function(x) {
  x <- trimws(as.character(x))
  sum(!is.na(x) & nzchar(x))
}

pick_nonempty_col <- function(cands, df) {
  c <- intersect(cands, names(df))
  if (!length(c)) return(NA_character_)
  nn <- vapply(c, function(cc) nonempty_n(df[[cc]]), integer(1))
  if (max(nn, na.rm = TRUE) <= 0) return(c[[1]])
  c[[which.max(nn)]]
}

clean_chr <- function(x) {
  x <- trimws(as.character(x))
  x[x == ""] <- NA_character_
  x
}

pick_vec <- function(cands, df, default = NA_character_) {
  col <- pick_col(cands, df)
  if (!is.na(col)) as.character(df[[col]]) else rep(default, nrow(df))
}

is_true <- function(x) {
  if (is.logical(x)) return(!is.na(x) & x)
  lx <- tolower(trimws(as.character(x)))
  !is.na(lx) & lx %in% c("t", "true", "1", "yes", "y")
}

trim_gene <- function(x) sub("\\*.*", "", as.character(x))

safe_counts <- function(df, default_zero = FALSE) {
  cand <- c("Clones", "duplicate_count", "umi_count", "consensus_count", "read_count", "Reads")
  col <- intersect(cand, names(df))
  if (length(col)) {
    v <- suppressWarnings(as.numeric(df[[col[1]]]))
  } else {
    v <- rep(1, nrow(df))
  }
  replacement <- if (default_zero) 0 else 1
  v[!is.finite(v) | is.na(v)] <- replacement
  v[v < 0] <- 0
  v
}

coalesce_counts <- function(df) {
  df$Clones <- safe_counts(df, default_zero = FALSE)
  df
}

normalize_for_immunarch <- function(df) {
  aa <- pick_nonempty_col(c(
    "cdr3_aa", "junction_aa", "sequence_aa", "Clonotype.aa",
    "CDR3.aa", "cdr3", "Clonotype", "aaSeqCDR3", "aminoAcid", "amino_acid"
  ), df)
  if (!is.na(aa)) df$CDR3.aa <- clean_chr(df[[aa]])

  nt <- pick_nonempty_col(c("junction", "sequence", "cdr3_nt", "CDR3.nt", "nSeqCDR3"), df)
  if (!is.na(nt)) df$CDR3.nt <- clean_chr(df[[nt]])

  v <- pick_nonempty_col(c("v_call", "v_gene", "V.name", "v", "V", "V.region"), df)
  if (!is.na(v)) df$V.name <- clean_chr(df[[v]])

  j <- pick_nonempty_col(c("j_call", "j_gene", "J.name", "j", "J", "J.region"), df)
  if (!is.na(j)) df$J.name <- clean_chr(df[[j]])

  df
}

filter_productive <- function(df) {
  keep <- rep(TRUE, nrow(df))

  if ("productive" %in% names(df)) {
    p <- is_true(df$productive)
    if (any(p, na.rm = TRUE)) keep <- keep & p
  }

  if ("vj_in_frame" %in% names(df)) {
    f <- is_true(df$vj_in_frame)
    if (any(f, na.rm = TRUE)) keep <- keep & f
  }

  df[keep, , drop = FALSE]
}

cdr3_col <- function(df) pick_nonempty_col(c("CDR3.aa", "cdr3_aa", "junction_aa", "sequence_aa", "Clonotype.aa", "cdr3", "Clonotype", "aaSeqCDR3", "aminoAcid", "amino_acid"), df)
v_col    <- function(df) pick_nonempty_col(c("V.name", "v_call", "v_gene", "v", "V", "V.region"), df)
j_col    <- function(df) pick_nonempty_col(c("J.name", "j_call", "j_gene", "j", "J", "J.region"), df)

empty_csv <- function(path, df) write.csv(df, path, row.names = FALSE)

chao1_abund <- function(counts) {
  counts <- counts[counts > 0]
  S  <- length(counts)
  f1 <- sum(counts == 1)
  f2 <- sum(counts == 2)
  if (f2 > 0) S + (f1^2) / (2 * f2) else S + f1 * (f1 - 1) / 2
}

# ===== Load AIRR =====

read_airr_file <- function(f) {
  readr::read_tsv(
    f,
    col_types = readr::cols(.default = readr::col_character()),
    show_col_types = FALSE,
    progress = FALSE,
    trim_ws = TRUE
  ) |> as.data.frame()
}

read_airr_dir <- function(input_dir) {
  files <- list.files(input_dir, full.names = TRUE, recursive = FALSE)
  files <- files[file.info(files)$isdir == FALSE]

  if (!length(files)) stop("No input files found in: ", input_dir)

  data <- lapply(files, read_airr_file)
  names(data) <- basename(files)
  list(data = data)
}

imm <- read_airr_dir(input_dir)

sample_label <- function(i) {
  df <- imm$data[[i]]
  for (cc in c("repertoire_id", "sample_id", "subject_id")) {
    if (cc %in% names(df)) {
      vals <- unique(na.omit(as.character(df[[cc]])))
      vals <- vals[nzchar(vals)]
      if (length(vals)) return(vals[1])
    }
  }
  nm <- names(imm$data)[i]
  if (!is.na(nm) && nzchar(nm)) return(basename(nm))
  paste0("sample_", i)
}

imm$data <- lapply(imm$data, coalesce_counts)
names(imm$data) <- sapply(seq_along(imm$data), sample_label, USE.NAMES = FALSE)
imm$data <- lapply(imm$data, normalize_for_immunarch)

## debug
message("Detected columns after normalization:")
print(lapply(imm$data, names))

message("Detected CDR3 columns:")
print(lapply(imm$data, cdr3_col))

# ===== 1) Number of clonotypes =====
if ("number_clonotypes" %in% keywords) {
  n_clono <- bind_rows(lapply(seq_along(imm$data), function(i) {
    df <- imm$data[[i]]
    s <- names(imm$data)[i]
    aa <- cdr3_col(df)
    if (is.na(aa)) return(tibble(Sample = s, Volume = 0L))
    x <- clean_chr(df[[aa]])
    tibble(Sample = s, Volume = sum(!is.na(x) & nzchar(x)))
  }))
  write.csv(n_clono, "basic_stats_cdr3_1_number_of_clonotypes.csv", row.names = FALSE)
}

# ===== 2) Clone-size distribution =====
if ("distro_clonotypes" %in% keywords) {
  clone_hist <- bind_rows(lapply(seq_along(imm$data), function(i) {
    df <- imm$data[[i]]
    s <- names(imm$data)[i]
    aa <- cdr3_col(df)
    if (is.na(aa)) return(tibble(Sample = character(), Clone.num = numeric(), Clonotypes = integer()))

    tibble(cdr3 = clean_chr(df[[aa]]), count = safe_counts(df, default_zero = FALSE)) |>
      filter(!is.na(cdr3), nzchar(cdr3)) |>
      group_by(cdr3) |>
      summarise(Clone.num = sum(count, na.rm = TRUE), .groups = "drop") |>
      count(Clone.num, name = "Clonotypes") |>
      mutate(Sample = s, .before = 1)
  }))
  if (!nrow(clone_hist)) clone_hist <- tibble(Sample = character(), Clone.num = numeric(), Clonotypes = integer())
  write.csv(clone_hist, "basic_stats_cdr3_2_distro_of_clonotype_abundance.csv", row.names = FALSE)
}

# ===== 3) CDR3 length distribution + KPI summary =====
if ("distro_cdr3_length" %in% keywords) {
  len_long <- bind_rows(lapply(seq_along(imm$data), function(i) {
    df <- filter_productive(imm$data[[i]])
    s <- names(imm$data)[i]
    aa <- cdr3_col(df)
    if (is.na(aa)) return(NULL)
    x <- clean_chr(df[[aa]])
    x <- x[!is.na(x) & nzchar(x)]
    if (!length(x)) return(NULL)
    tibble(Sample = s, Length = nchar(x))
  }))

  if (nrow(len_long)) {
    write.csv(len_long |> count(Sample, Length, name = "Count"),
              "basic_stats_cdr3_3_distro_of_cdr3_lengths.csv", row.names = FALSE)

    kpi <- len_long |>
      group_by(Sample) |>
      summarise(
        n = n(),
        mean = mean(Length),
        median = median(Length),
        q25 = as.numeric(quantile(Length, 0.25, names = FALSE)),
        q75 = as.numeric(quantile(Length, 0.75, names = FALSE)),
        min = min(Length),
        max = max(Length),
        sd = sd(Length),
        .groups = "drop"
      ) |>
      mutate(across(c(mean, median, q25, q75), ~round(.x, 2))) |>
      rename(sample = Sample)
    write.csv(kpi, "cdr3_length_summary_per_sample.csv", row.names = FALSE)
  } else {
    empty_csv("basic_stats_cdr3_3_distro_of_cdr3_lengths.csv", tibble(Sample = character(), Length = integer(), Count = integer()))
    empty_csv("cdr3_length_summary_per_sample.csv", tibble(sample = character(), n = integer(), mean = numeric(), median = numeric(), q25 = numeric(), q75 = numeric(), min = integer(), max = integer(), sd = numeric()))
  }
}

# ===== 4) Basic clonal proportion =====
if ("basic_clonal_proportion" %in% keywords) {
  K <- c(10, 100, 1000, 3000, 10000)
  topk_df <- bind_rows(lapply(seq_along(imm$data), function(i) {
    df <- filter_productive(imm$data[[i]])
    s <- names(imm$data)[i]
    aa <- cdr3_col(df)
    if (is.na(aa) || !nrow(df)) return(as_tibble(as.list(c(Sample = s, setNames(rep(NA_real_, length(K)), as.character(K))))))

    tab <- tibble(clonotype = clean_chr(df[[aa]]), count = safe_counts(df, default_zero = TRUE)) |>
      filter(!is.na(clonotype), nzchar(clonotype)) |>
      group_by(clonotype) |>
      summarise(count = sum(count, na.rm = TRUE), .groups = "drop") |>
      arrange(desc(count))

    if (!nrow(tab) || sum(tab$count) <= 0) {
      return(as_tibble(as.list(c(Sample = s, setNames(rep(NA_real_, length(K)), as.character(K))))))
    }

    cum <- cumsum(tab$count) / sum(tab$count)
    vals <- sapply(K, function(k) cum[min(k, nrow(tab))])
    as_tibble(as.list(c(Sample = s, setNames(as.numeric(vals), as.character(K)))))
  }))
  for (k in as.character(K)) topk_df[[k]] <- as.numeric(topk_df[[k]])
  write.csv(topk_df, "basic_stats_cdr3_4_basic_clonal_proportion.csv", row.names = FALSE)
}

# ===== 5) Top clonotypes per sample =====
if ("top_clones" %in% keywords || "basic_clonal_proportion" %in% keywords) {
  top_n <- 200
  top_df <- bind_rows(lapply(seq_along(imm$data), function(i) {
    df <- imm$data[[i]]
    s <- names(imm$data)[i]
    aa <- cdr3_col(df)
    vv <- v_col(df)
    jj <- j_col(df)
    if (is.na(aa) || !nrow(df)) return(NULL)

    work <- df |>
      mutate(
        .count = safe_counts(df, default_zero = TRUE),
        .cdr3 = clean_chr(.data[[aa]]),
        .v = if (!is.na(vv)) as.character(.data[[vv]]) else NA_character_,
        .j = if (!is.na(jj)) as.character(.data[[jj]]) else NA_character_
      ) |>
      filter(!is.na(.cdr3), nzchar(.cdr3)) |>
      group_by(.cdr3, .v, .j) |>
      summarise(count = sum(.count, na.rm = TRUE), .groups = "drop") |>
      arrange(desc(count))

    if (!nrow(work)) return(NULL)
    total <- sum(work$count, na.rm = TRUE)
    work |>
      mutate(prop = if (total > 0) count / total else NA_real_) |>
      slice_head(n = top_n) |>
      transmute(sample = s, cdr3 = .cdr3, v = .v, j = .j, count = count, prop = prop)
  }))

  if (!nrow(top_df)) top_df <- tibble(sample = character(), cdr3 = character(), v = character(), j = character(), count = numeric(), prop = numeric())
  write.csv(top_df, "top_clones_per_sample.csv", row.names = FALSE)
}

# ===== 6) Tracking-ready clonotype table =====
if ("track_clonotypes" %in% keywords) {
  sample_order <- setNames(seq_along(names(imm$data)), names(imm$data))
  tracking_df <- bind_rows(lapply(seq_along(imm$data), function(i) {
    df <- filter_productive(imm$data[[i]])
    s <- names(imm$data)[i]
    aa <- cdr3_col(df)
    vv <- v_col(df)
    jj <- j_col(df)
    if (is.na(aa) || !nrow(df)) return(NULL)

    work <- df |>
      mutate(
        .count = safe_counts(df, default_zero = TRUE),
        .cdr3 = clean_chr(.data[[aa]]),
        .v = if (!is.na(vv)) trim_gene(.data[[vv]]) else NA_character_,
        .j = if (!is.na(jj)) trim_gene(.data[[jj]]) else NA_character_
      ) |>
      filter(!is.na(.cdr3), nzchar(.cdr3)) |>
      group_by(.cdr3, .v, .j) |>
      summarise(count = sum(.count, na.rm = TRUE), .groups = "drop")

    if (!nrow(work)) return(NULL)
    total <- sum(work$count, na.rm = TRUE)
    work |>
      mutate(prop = if (total > 0) count / total else NA_real_) |>
      transmute(
        sample = s,
        order = unname(sample_order[s]),
        cdr3 = .cdr3,
        v = ifelse(is.na(.v) | .v == "", NA_character_, .v),
        j = ifelse(is.na(.j) | .j == "", NA_character_, .j),
        count = as.numeric(count),
        prop = as.numeric(prop)
      )
  }))

  if (!nrow(tracking_df)) tracking_df <- tibble(sample = character(), order = integer(), cdr3 = character(), v = character(), j = character(), count = double(), prop = double())
  write.csv(tracking_df, "clonotype_tracking_long.csv", row.names = FALSE)
}

# ===== 7) V and J gene usage =====
if ("gene_usage" %in% keywords) {
  v_long <- bind_rows(lapply(seq_along(imm$data), function(i) {
    df <- imm$data[[i]]
    s <- names(imm$data)[i]
    vv <- v_col(df)
    if (is.na(vv)) return(NULL)
    tibble(sample = s, v_gene = as.character(df[[vv]]))
  })) |>
    filter(!is.na(v_gene), v_gene != "") |>
    count(sample, v_gene, name = "count") |>
    group_by(sample) |>
    mutate(prop = if (sum(count) > 0) count / sum(count) else NA_real_) |>
    ungroup()
  if (!nrow(v_long)) v_long <- tibble(sample = character(), v_gene = character(), count = integer(), prop = numeric())
  write.csv(v_long, "v_usage_long.csv", row.names = FALSE)

  j_long <- bind_rows(lapply(seq_along(imm$data), function(i) {
    df <- imm$data[[i]]
    s <- names(imm$data)[i]
    jj <- j_col(df)
    if (is.na(jj)) return(NULL)
    tibble(sample = s, j_gene = as.character(df[[jj]]))
  })) |>
    filter(!is.na(j_gene), j_gene != "") |>
    count(sample, j_gene, name = "count") |>
    group_by(sample) |>
    mutate(prop = if (sum(count) > 0) count / sum(count) else NA_real_) |>
    ungroup()
  if (!nrow(j_long)) j_long <- tibble(sample = character(), j_gene = character(), count = integer(), prop = numeric())
  write.csv(j_long, "j_usage_long.csv", row.names = FALSE)
}

# ===== 8) Repertoire overlap =====
if ("repertoire_overlap" %in% keywords) {
  method <- if ("overlap_public" %in% keywords) "public" else "jaccard"
  ov <- tryCatch(
    repOverlap(imm$data, .method = method, .verbose = FALSE),
    error = function(e) {
      warning("repOverlap failed; writing AIRR-safe Jaccard fallback. Original error: ", conditionMessage(e))
      samples <- names(imm$data)
      sets <- lapply(imm$data, function(df) {
        aa <- cdr3_col(df)
        if (is.na(aa)) return(character(0))
        x <- clean_chr(df[[aa]])
        unique(x[!is.na(x) & nzchar(x)])
      })
      m <- matrix(0, nrow = length(sets), ncol = length(sets), dimnames = list(samples, samples))
      for (i in seq_along(sets)) for (j in seq_along(sets)) {
        u <- union(sets[[i]], sets[[j]])
        m[i, j] <- if (length(u)) length(intersect(sets[[i]], sets[[j]])) / length(u) else NA_real_
      }
      diag(m) <- 1
      m
    }
  )
  if (is.matrix(ov)) {
    diag(ov) <- 1
    rownames(ov) <- colnames(ov) <- names(imm$data)
  }
  write.csv(ov, "rep_overlap_default.csv", row.names = TRUE)
}

# ===== 9) Diversity =====
if ("diversity" %in% keywords) {
  Dq <- function(p, q) {
    p <- p[p > 0]
    if (!length(p)) return(NA_real_)
    if (abs(q - 1) < 1e-12) exp(-sum(p * log(p))) else (sum(p^q))^(1 / (1 - q))
  }

  Q_MAX <- as.numeric(Sys.getenv("DIVERSITY_QMAX", "4"))
  Q_STEP <- as.numeric(Sys.getenv("DIVERSITY_QSTEP", "0.25"))
  N_BOOT <- as.integer(Sys.getenv("DIVERSITY_BOOT", "0"))
  ALPHA <- as.numeric(Sys.getenv("DIVERSITY_ALPHA", "0.05"))
  q_vals <- seq(0, Q_MAX, by = Q_STEP)

  div_rows <- list()
  prof_rows <- list()

  for (i in seq_along(imm$data)) {
    df <- imm$data[[i]]
    s <- names(imm$data)[i]
    aa <- cdr3_col(df)
    if (is.na(aa)) next

    vv <- v_col(df)
    jj <- j_col(df)
    key <- paste(
      if (!is.na(vv)) trim_gene(df[[vv]]) else NA_character_,
      if (!is.na(jj)) trim_gene(df[[jj]]) else NA_character_,
      clean_chr(df[[aa]]),
      sep = "|"
    )
    w <- safe_counts(df, default_zero = TRUE)

    tab <- tibble(key = key, w = w) |>
      filter(!is.na(key), key != "", !grepl("\\|NA$", key)) |>
      group_by(key) |>
      summarise(n = sum(w, na.rm = TRUE), .groups = "drop") |>
      filter(n > 0)

    if (!nrow(tab)) next

    N <- sum(tab$n)
    p <- tab$n / N
    H <- -sum(p * log(p))
    lambda <- sum(p^2)

    div_rows[[length(div_rows) + 1]] <- tibble(
      sample_id = s,
      file = s,
      reads = N,
      richness = nrow(tab),
      chao1 = chao1_abund(tab$n),
      shannon = H,
      hill_1 = exp(H),
      simpson = 1 - lambda,
      invsimpson = ifelse(lambda > 0, 1 / lambda, NA_real_),
      gini_simpson = lambda,
      evenness = ifelse(nrow(tab) > 0, exp(H) / nrow(tab), NA_real_)
    )

    D_mean <- sapply(q_vals, function(q) Dq(p, q))
    if (N_BOOT > 0) {
      boots <- replicate(N_BOOT, {
        nb <- as.numeric(rmultinom(1, size = N, prob = p))
        pb <- nb / sum(nb)
        sapply(q_vals, function(q) Dq(pb, q))
      })
      lo <- apply(boots, 1, function(x) quantile(x, probs = ALPHA / 2, na.rm = TRUE))
      hi <- apply(boots, 1, function(x) quantile(x, probs = 1 - ALPHA / 2, na.rm = TRUE))
    } else {
      lo <- rep(NA_real_, length(q_vals))
      hi <- rep(NA_real_, length(q_vals))
    }

    prof_rows[[length(prof_rows) + 1]] <- tibble(sample_id = s, q = q_vals, D = as.numeric(D_mean), lo = as.numeric(lo), hi = as.numeric(hi))
  }

  div <- bind_rows(div_rows)
  if (!nrow(div)) div <- tibble(sample_id = character(), file = character(), reads = double(), richness = integer(), chao1 = double(), shannon = double(), hill_1 = double(), simpson = double(), invsimpson = double(), gini_simpson = double(), evenness = double())
  readr::write_csv(div, "diversity_by_file.csv")

  prof <- bind_rows(prof_rows)
  if (!nrow(prof)) prof <- tibble(sample_id = character(), q = double(), D = double(), lo = double(), hi = double())
  readr::write_csv(prof, "diversity_profile.csv")
}

# ===== 10) Clonal networks & clustering =====
if ("clonal_networks" %in% keywords) {
  suppressPackageStartupMessages({
    library(stringdist)
    library(igraph)
  })

  NET_MAX_EDIT <- as.integer(Sys.getenv("NET_MAX_EDIT", "1"))
  NET_TOP_N <- as.integer(Sys.getenv("NET_TOP_N", "1500"))
  NET_BLOCK_BY_GENES <- tolower(Sys.getenv("NET_BLOCK_BY_GENES", "true")) %in% c("1", "true", "t", "yes", "y")

  build_edges_block <- function(keys, max_edit) {
    if (length(keys) < 2) return(tibble(source = character(), target = character(), dist = integer()))
    dmat <- stringdist::stringdistmatrix(keys, keys, method = "hamming", useNames = TRUE)
    idx <- which(dmat > 0 & dmat <= max_edit, arr.ind = TRUE)
    if (!nrow(idx)) return(tibble(source = character(), target = character(), dist = integer()))
    idx <- idx[idx[, 1] < idx[, 2], , drop = FALSE]
    tibble(source = keys[idx[, "row"]], target = keys[idx[, "col"]], dist = as.integer(dmat[idx]))
  }

  summary_tbl <- bind_rows(lapply(seq_along(imm$data), function(i) {
    df <- imm$data[[i]]
    s <- names(imm$data)[i]
    seq_col <- cdr3_col(df)
    if (is.na(seq_col)) return(tibble(sample = s, file = s, chosen_key = NA_character_, n_rows = nrow(df), n_nodes = 0, n_edges = 0, n_components = 0, median_degree = NA_real_, reason = "no_sequence_column"))

    nodes0 <- tibble(
      id = clean_chr(df[[seq_col]]),
      abund = safe_counts(df, default_zero = TRUE),
      v_gene = pick_vec(c("V.name", "v_call", "v_gene", "v", "V", "V.region"), df),
      j_gene = pick_vec(c("J.name", "j_call", "j_gene", "j", "J", "J.region"), df)
    ) |>
      filter(!is.na(id), nzchar(id)) |>
      group_by(id) |>
      summarise(
        abund = sum(abund, na.rm = TRUE),
        v_gene = first(na.omit(v_gene)),
        j_gene = first(na.omit(j_gene)),
        .groups = "drop"
      )

    if (!nrow(nodes0)) return(tibble(sample = s, file = s, chosen_key = seq_col, n_rows = nrow(df), n_nodes = 0, n_edges = 0, n_components = 0, median_degree = NA_real_, reason = "no_nonempty"))

    nodes0 <- nodes0 |>
      arrange(desc(abund)) |>
      slice_head(n = min(nrow(nodes0), NET_TOP_N)) |>
      mutate(len = nchar(id))

    nodes0 <- if (NET_BLOCK_BY_GENES) {
      nodes0 |> mutate(.block = paste0(len, "|", coalesce(v_gene, "?"), "|", coalesce(j_gene, "?")))
    } else {
      nodes0 |> mutate(.block = as.character(len))
    }

    edges <- nodes0 |>
      group_split(.block, .keep = FALSE) |>
      lapply(function(blk) build_edges_block(blk$id, NET_MAX_EDIT)) |>
      bind_rows()

    g <- igraph::graph_from_data_frame(
      edges |> select(source, target),
      directed = FALSE,
      vertices = nodes0 |> transmute(name = id, abund, v_gene, j_gene, len)
    )

    comp <- igraph::components(g)
    igraph::V(g)$component <- comp$membership[match(igraph::V(g)$name, names(comp$membership))]
    if (igraph::ecount(g) > 0) {
      comm <- igraph::cluster_louvain(g)
      igraph::V(g)$community <- igraph::membership(comm)[match(igraph::V(g)$name, names(igraph::membership(comm)))]
    } else {
      igraph::V(g)$community <- seq_len(igraph::vcount(g))
    }

    nodes_out <- igraph::as_data_frame(g, what = "vertices") |>
      as_tibble() |>
      transmute(id = name, label = name, size = as.numeric(abund), v_gene = v_gene, j_gene = j_gene, len = as.integer(len), component = as.integer(component), community = as.integer(community))

    edges_out <- igraph::as_data_frame(g, what = "edges") |>
      as_tibble() |>
      transmute(source = from, target = to) |>
      distinct()

    readr::write_csv(nodes_out, paste0(s, "_nodes.csv"))
    readr::write_csv(edges_out, paste0(s, "_edges.csv"))
    readr::write_csv(nodes_out |> group_by(community) |> summarise(total_abund = sum(size, na.rm = TRUE), n_members = n(), .groups = "drop") |> arrange(desc(total_abund)), paste0(s, "_clusters.csv"))

    deg <- if (igraph::vcount(g)) igraph::degree(g) else numeric(0)
    tibble(sample = s, file = s, chosen_key = seq_col, n_rows = nrow(df), n_nodes = nrow(nodes_out), n_edges = nrow(edges_out), n_components = n_distinct(nodes_out$component), median_degree = if (length(deg)) median(as.numeric(deg)) else NA_real_, reason = NA_character_)
  }))

  readr::write_csv(summary_tbl, "clonal_network_summary.csv")
}

# ===== 11) Phylogenetic / distance trees =====
if ("phylo_trees" %in% keywords) {
  suppressPackageStartupMessages({
    library(stringdist)
    library(ape)
  })

  TREES_MAX_TIPS <- as.integer(Sys.getenv("TREES_MAX_TIPS", "150"))

  to_edges_nodes <- function(tr, tip_info = NULL) {
    n_tip <- ape::Ntip(tr)
    total <- n_tip + tr$Nnode
    ids <- paste0("n", seq_len(total))

    ed <- as.data.frame(tr$edge, stringsAsFactors = FALSE)
    names(ed) <- c("parent_idx", "child_idx")
    edges_out <- tibble(
      parent_id = ids[ed$parent_idx],
      child_id = ids[ed$child_idx],
      branch_length = if (!is.null(tr$edge.length)) as.numeric(tr$edge.length) else NA_real_
    )

    nodes_out <- tibble(node_id = ids, is_tip = seq_len(total) <= n_tip, label = NA_character_, abundance = NA_real_)
    nodes_out$label[seq_len(n_tip)] <- tr$tip.label
    if (!is.null(tip_info) && "count" %in% names(tip_info)) nodes_out$abundance[seq_len(n_tip)] <- tip_info$count
    list(nodes = nodes_out, edges = edges_out)
  }

  build_log <- list()
  for (i in seq_along(imm$data)) {
    df <- imm$data[[i]]
    s <- names(imm$data)[i]
    key <- cdr3_col(df)
    if (is.na(key)) {
      build_log[[length(build_log) + 1]] <- tibble(sample = s, used = 0, key = NA_character_, reason = "no_sequence_column")
      next
    }

    is_aa <- key %in% c("CDR3.aa", "junction_aa", "cdr3_aa", "sequence_aa", "Clonotype.aa")
    seqs <- toupper(clean_chr(df[[key]]))
    seqs <- gsub("[*?\\-\\. ]", "", seqs)
    if (is_aa) seqs <- gsub("[^ACDEFGHIKLMNPQRSTVWY]", "", seqs) else seqs <- gsub("[^ACGTN]", "", seqs)

    tab <- tibble(seq = seqs, count = safe_counts(df, default_zero = TRUE)) |>
      filter(!is.na(seq), nchar(seq) > 0) |>
      count(seq, wt = count, name = "count", sort = TRUE)

    if (nrow(tab) < 3) {
      build_log[[length(build_log) + 1]] <- tibble(sample = s, used = nrow(tab), key = key, reason = "too_few_unique")
      next
    }

    tab <- tab |> slice_head(n = TREES_MAX_TIPS)
    dm <- stringdist::stringdistmatrix(tab$seq, tab$seq, method = "lv") |> as.dist()
    tr <- suppressWarnings(ape::nj(dm)) |> ape::ladderize()
    tr$tip.label <- paste0(seq_len(length(tr$tip.label)), ":n=", tab$count)

    readr::write_file(ape::write.tree(tr), paste0(s, ".nwk"))
    readr::write_tsv(tibble(tip = tr$tip.label, seq = tab$seq, count = tab$count), paste0(s, "_tips.tsv"))

    ne <- to_edges_nodes(tr, tip_info = tibble(label = tr$tip.label, count = tab$count))
    readr::write_csv(ne$nodes, paste0(s, "_tree_nodes.csv"))
    readr::write_csv(ne$edges, paste0(s, "_tree_edges.csv"))

    build_log[[length(build_log) + 1]] <- tibble(sample = s, used = nrow(tab), key = key, reason = "ok")
  }

  readr::write_csv(bind_rows(build_log), "tree_build_summary.csv")
}


# ===== 12) Clonal expansion trees =====
if ("clonal_expansion_trees" %in% keywords) {

  build_log <- list()

  for (i in seq_along(imm$data)) {

    df <- imm$data[[i]]
    s <- names(imm$data)[i]

    aa <- cdr3_col(df)
    vv <- v_col(df)
    jj <- j_col(df)

    if (is.na(aa)) {
      build_log[[length(build_log) + 1]] <- tibble(
        sample = s,
        used = 0,
        key = NA_character_,
        reason = "no_cdr3_column"
      )
      next
    }

    clones <- tibble(
      cdr3 = clean_chr(df[[aa]]),
      count = safe_counts(df, default_zero = TRUE),
      v_gene = if (!is.na(vv)) trim_gene(df[[vv]]) else NA_character_,
      j_gene = if (!is.na(jj)) trim_gene(df[[jj]]) else NA_character_
    ) |>
      filter(!is.na(cdr3), nzchar(cdr3)) |>
      group_by(cdr3, v_gene, j_gene) |>
      summarise(
        abundance = sum(count, na.rm = TRUE),
        .groups = "drop"
      ) |>
      arrange(desc(abundance))

    if (nrow(clones) < 2) {
      build_log[[length(build_log) + 1]] <- tibble(
        sample = s,
        used = nrow(clones),
        key = aa,
        reason = "too_few_clones"
      )
      next
    }

    clones <- clones |>
      mutate(
        rank = row_number(),
        node_id = paste0("clone_", rank),
        prop = abundance / sum(abundance)
      )

    edges_list <- list()

    for (child_idx in seq_len(nrow(clones))) {
      child <- clones[child_idx, ]

      if (child$rank == 1) next

      candidates <- clones |>
        filter(
          abundance >= child$abundance,
          node_id != child$node_id,
          v_gene == child$v_gene,
          j_gene == child$j_gene
        )

      if (!nrow(candidates)) {
        candidates <- clones |>
          filter(
            abundance >= child$abundance,
            node_id != child$node_id
          )
      }

      d <- stringdist::stringdist(
        candidates$cdr3,
        child$cdr3,
        method = "lv"
      )

      parent <- candidates[which.min(d), ]

      edges_list[[length(edges_list) + 1]] <- tibble(
        parent_id = parent$node_id,
        child_id = child$node_id,
        branch_length = max(0.2, log1p(d[which.min(d)])),
        cdr3_distance = d[which.min(d)],
        expansion_delta = parent$abundance - child$abundance
      )
    }

    edges_out <- bind_rows(edges_list)

    nodes_out <- clones |>
      transmute(
        id = node_id,
        label = cdr3,
        abundance = abundance,
        prop = prop,
        rank = rank,
        v_gene = v_gene,
        j_gene = j_gene,
        cdr3 = cdr3,
        is_tip = TRUE
      )

    readr::write_csv(
      nodes_out,
      paste0(s, "_clonal_expansion_nodes.csv")
    )

    readr::write_csv(
      edges_out,
      paste0(s, "_clonal_expansion_edges.csv")
    )

    build_log[[length(build_log) + 1]] <- tibble(
      sample = s,
      used = nrow(clones),
      key = aa,
      reason = "ok"
    )
  }

  readr::write_csv(
    bind_rows(build_log),
    "clonal_expansion_tree_summary.csv"
  )
}


message("Done. CSVs written.")
