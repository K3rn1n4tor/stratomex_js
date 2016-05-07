StratomeX - Clustering [Fork]
=============================

This is a fork of the original StratomeX repository to integrate dynamic, server-side clustering on
genomic data and analyze the confidence or ambiguity of cluster assignments.
It is implemented as Caleydo web plugin: https://github.com/Caleydo/caleydo_web

Features:
--------
- Supports application of clustering algorithms (k-means, hierarchical, affinity propagation, fuzzy) to genomic data.
- Creates views showing the distances/correlation/probability of each record in one cluster to the cluster centroid and the distances/correlation/probability
of each patient to all other cluster.
- Provides splitting of one cluster into three different subsets (well-fitting, uncertain, bad-fitting) to further analyze how well the records fit into one cluster.
- Supports refinement of clusters/groups (shifting to better fits, merging, exclusion) 
- Support dynamical increase/reduction of the number of clusters in hierarchical cluster results.

Installation:
------------
- Checkout caleydo_web_container: https://github.com/Caleydo/caleydo_web_container
- Checkout calyedo_clustering: https://github.com/K3rn1n4tor/stratomex_js
- Update all other repos to the latest version (at least from March 21st).
- Make sure you have the caleydo_data_hdf (required for TCGA data) and caleydo_vis_lineup plugin.

Future Work:
-----------
- See Issues section for further information.
