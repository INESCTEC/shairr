#!/usr/bin/env nextflow

process runGeneUsage {
    input:
        val repertoires
        val length
        val container_workdir
        val container_input_datasets_dir
        val docker_volumes_command
        val stats_keywords

    script:
    """
        shared_root="${System.getenv('SHARED_DATA_ROOT') ?: '/shared'}"
        shared_host="${System.getenv('SHARED_DATA_HOST_PATH') ?: (System.getenv('SHARED_DATA_ROOT') ?: '/shared')}"

        WORKDIR_ABS_PATH=\$(realpath "\$PWD")

        if [[ "\$WORKDIR_ABS_PATH" == "\$shared_root"* ]]; then
            WORKDIR_HOST_PATH="\${WORKDIR_ABS_PATH/\$shared_root/\$shared_host}"
        else
            WORKDIR_HOST_PATH="\$WORKDIR_ABS_PATH"
        fi

        docker run --rm ${docker_volumes_command} -v \$WORKDIR_HOST_PATH:${container_workdir} \
        immunarch ../immunarch-tsv-input.r ${container_input_datasets_dir} \
        ${stats_keywords}
    """
}


workflow {
    def sharedRoot = System.getenv('SHARED_DATA_ROOT') ?: '/shared'
    def sharedHost = System.getenv('SHARED_DATA_HOST_PATH') ?: sharedRoot
    def toHostPath = { String p ->
        p.startsWith(sharedRoot) ? "${sharedHost}${p.substring(sharedRoot.length())}" : p
    }

    try {
        params.repertoires_length = params.repertoires_length.toInteger()
    } catch (Exception e) {
        error "Length must be an integer, got: ${params.repertoires_length}"
    }

    def repertoires_list = params.repertoire.split(",")*.trim()  // split by comma and trim spaces
    def repertoires_count = repertoires_list.size()
    println repertoires_list
    println "Repertoire count: ${repertoires_count}"
    //missing check if files exist
        /*
    def repertoiresPaths = file((params.repertoire ?: '').toString())

    if( !repertoiresPaths.exists() )
        error "Repertoires files not found: ${repertoiresPaths}"
    */

    // Define target folder inside the container
    container_workdir = "/workspace"
    container_input_datasets_dir = "/input_datasets"

    // Generate the docker volume mapping string
    docker_volumes_command = repertoires_list.collect { f ->
        "-v ${f}:${container_input_datasets_dir}/${f.tokenize('/').last()}"
    }.join(' ')

    // Print the result
    println "Immunarch docker volume string:"
    println docker_volumes_command

    params.gene_usage              = params.gene_usage ?: false
    params.repertoire_overlap      = params.repertoire_overlap ?: false
    params.number_clonotypes       = params.number_clonotypes ?: false
    params.distro_clonotypes       = params.distro_clonotypes ?: false
    params.track_clonotypes        = params.track_clonotypes ?: false
    params.distro_cdr3_length      = params.distro_cdr3_length ?: false
    params.basic_clonal_proportion = params.basic_clonal_proportion ?: false
    params.diversity               = params.diversity ?: false
    params.clonal_networks         = params.clonal_networks ?: false
    params.phylo_trees             = params.phylo_trees ?: false



    //Build string with stats keywords to pass to immunarch to select which ones to compute
    def stats_keywords = ''

    // Append keywords if their params are true
    if (params.gene_usage)              stats_keywords += ' gene_usage'
    if (params.repertoire_overlap)      stats_keywords += ' repertoire_overlap'
    if (params.number_clonotypes)       stats_keywords += ' number_clonotypes'
    if (params.distro_clonotypes)       stats_keywords += ' distro_clonotypes'
    if (params.track_clonotypes)        stats_keywords += ' track_clonotypes'
    if (params.distro_cdr3_length)      stats_keywords += ' distro_cdr3_length'
    if (params.basic_clonal_proportion) stats_keywords += ' basic_clonal_proportion'
    if (params.diversity)               stats_keywords += ' diversity'
    if (params.clonal_networks)         stats_keywords += ' clonal_networks'
    if (params.phylo_trees)             stats_keywords += ' phylo_trees'


    // Trim leading/trailing spaces
    stats_keywords = stats_keywords.trim()

    println "Active keywords: '${stats_keywords}'"


    runGeneUsage(repertoires_list, params.repertoires_length, container_workdir,
                    container_input_datasets_dir, docker_volumes_command,
                    stats_keywords)
}
