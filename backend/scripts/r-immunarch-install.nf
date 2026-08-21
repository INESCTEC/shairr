#!/usr/bin/env nextflow

process installImmunArch {
    script:
   
    """
    docker build -t immunarch:latest ${projectDir}/immunarch
    """
}

workflow {
    installImmunArch()
}