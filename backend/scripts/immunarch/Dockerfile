FROM rocker/r-ver:4.3.1

# System dependencies for R packages
RUN apt-get update && apt-get install -y \
    libcurl4-openssl-dev \
    libssl-dev \
    libxml2-dev \
    libxt-dev \
    libfontconfig1-dev \
    libharfbuzz-dev \
    libfribidi-dev \
    libhdf5-dev \
    && rm -rf /var/lib/apt/lists/*

# Install remotes for version pinning
RUN R -e "install.packages('remotes', repos='https://cloud.r-project.org')"

# Pin compatible dplyr + dtplyr versions
RUN R -e "remotes::install_version('dplyr', version='1.0.10', repos='https://cloud.r-project.org')"
RUN R -e "remotes::install_version('dtplyr', version='1.2.2', repos='https://cloud.r-project.org')"

# Install remaining CRAN dependencies
RUN R -e "install.packages(c( \
    'tidyr', \
    'data.table', \
    'ggplot2', \
    'stringr', \
    'igraph', \
    'readr', \
    'tibble', \
    'purrr', \
    'stringdist', \
    'ape', \
    'scales', \
    'forcats' \
    ), repos='https://cloud.r-project.org')"

# Install BiocManager
RUN R -e "install.packages('BiocManager', repos='https://cloud.r-project.org')"

# Install immunarch
RUN R -e "BiocManager::install('immunarch', ask=FALSE)"

# Re-pin versions because immunarch dependencies may force upgrade them
RUN R -e "remotes::install_version('dplyr', version='1.0.10', repos='https://cloud.r-project.org')"
RUN R -e "remotes::install_version('dtplyr', version='1.2.2', repos='https://cloud.r-project.org')"

# Copy script
WORKDIR /
COPY immunarch-tsv-input.r .

# Workspace
WORKDIR /workspace

# Always run via Rscript
ENTRYPOINT ["Rscript"]
