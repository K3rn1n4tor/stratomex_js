StratomeX - Clustering [Fork]
=============================

This is a fork of the original StratomeX repository to integrate dynamic, server-side clustering on
genomic data and analyze the variation / uncertainty of clustering.

Features:
--------
- Supports application of clustering algorithms (k-means, hierarchical, affinity propagation, fuzzy) to genomic data.
- Creates views showing the distances of each patient in one cluster to the cluster centroid and the distance
of each patient to all other cluster.
- Provides separating one cluster into three different clusters to further analyze how well the divisions 
fit into one cluster.
- Supports refinement of clusters / groups of a column (by using the column created by the cluster division), 
including incrementing/reducing number of clusters of a hierarchical clustering based on its histogram.
- Enables re-sorting of cluster groups by distance / probability

Installation:
------------
- Checkout this and the caleydo_clustering repository.
- Update all other repos to the latest version (at least from March 21st).
- Make sure you have the caleydo_data_hdf plugin (required for TCGA data).

Future Work:
-----------
- See Issues section for further information.
