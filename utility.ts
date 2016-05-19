/**
 * Created by Michael Kern on 02.02.2016
 */

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// libraries

import $ = require('jquery');
import d3 = require('d3');
import datatypes = require('../caleydo_core/datatype');
import C = require('../caleydo_core/main');
import matrix = require('../caleydo_core/matrix');
import {animationTime} from "./Column";

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// class definition of cluster popup

/**
 * Implementation of a simple popup to select a cluster algorithm applied to any matrix with
 * corresponding parameter settings.
 */
export class ClusterPopup {
  private $node:d3.Selection<any> = null;
  private destroyed:boolean = false;
  public height:number = 0;
  private $tabs: d3.Selection<any>[] = [];
  private $pages: d3.Selection<any>[] = [];

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Creates a new popup window that contains controls and buttons for all supported clustering algorithms in
   * StratomeX.
   * @param data genomic data / matrix
   * @param parent parent node
   * @param stratomex application
   * @param rowID index of row
   * @param options options for algorithms
   */
  constructor(private data:datatypes.IDataType, private parent:Element,
              private stratomex:any, rowID:number,
              private options:any) {
    this.options = C.mixin(
      {
        width: 450,
        rowHeight: 35,
        animationTime: 200,
        'kmeans': {
          inits: ['forgy', 'uniform', 'random', 'kmeans++'], // initialization method for k-means
          initSelect: 3
        },
        'hierarchical': {
          methods: ['single', 'complete', 'weighted', 'median', 'average', 'centroid'], // linkage method for k-means
          methodSelect: 1,
          distSelect: 0
        },
        'affinity': {
          rangeDamping: [0, 1, 0.5], // damping avoids oscillations of algorithm [min, max, value]
          rangeFactor: [0.1, 10, 1.0], // influences the preference value (influences number of clusters)
          prefs: ['median', 'minimum'], // median produces moderate number, minimum a small number of clusters
          prefSelect: 1,
          distSelect: 1
        },
        'fuzzy': {
          threshold: [0.01, 1.0],
          fuzzifier: [1.001, 100, 1.2]
        },
        'general': {
          distances: ['euclidean', 'sqeuclidean', 'cityblock', 'chebyshev', 'canberra', 'correlation', 'hamming',
            'mahalanobis', 'pearson', 'spearman', 'kendall'],
          numClusters: [2, 10, 2]
        }
      }, options);
    this.$node = this._build(d3.select(parent), rowID);
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Returns the html node.
   * @returns {d3.Selection<any>}
   */
  get node() {
    return this.$node;
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Build the layout.
   * @param $parent
   * @param rowID
   * @returns {Selection<any>}
   * @private
   */
  private _build($parent:d3.Selection<any>, rowID:number) {
    var that = this;

    // this works for both Firefox and Chrome
    var mousePos = d3.mouse($parent.node());

    var $root = $parent.append('div').classed('clusterPopup', true);

    // start animation of popup
    $root.transition().duration(this.options.animationTime).style('opacity', 0.5);

    // create title
    var $titleBar = $root.append('div').classed('title', true);
    $titleBar.append('i').classed('fa fa-gears', true);
    $titleBar.append('text').text('Clustering Control Window (' + this.data.desc.name + ')').style('margin-left', '5px');

    // create toolbar
    var $toolbar = $root.append('div').classed('toolbar', true);
    $toolbar.append('i').attr('class', 'fa fa-close')
      .on('click', (_:any) => {
        that.destroy();
      });

    // create body
    this.height = 200;

    var $body = $root.append('div').classed('body', true);
    $body.transition().duration(this.options.animationTime).style('width', String(this.options.width) + 'px')
      .style('height', String(this.height) + 'px');

    var $header = $body.append('div').attr('class', 'header');

    var algorithms = ['k-Means', 'Hierarchical', 'Affinity Prop.', 'Fuzzy c-Means'];
    const numTabs = algorithms.length;

    function onClickTab(index: number) {
      return () => {
        for (var j = 0; j < numTabs; ++j)
        {
          that.$tabs[j].classed('active', j === index);
          that.$pages[j].classed('hidden', !(j === index));
        }
      }
    }

    for (var i = 0; i < numTabs; ++i) {
      var $tab = $header.append('label').attr('class', 'tab').text(algorithms[i]);
      this.$tabs.push($tab);
      $tab.on('click', onClickTab(i));
    }

    // create k-means row
    this._buildKMeansContent($body);
    // create hierarchical row
    this._buildHierarchicalContent($body);
    // create affinity row
    this._buildAffinityContent($body);
    // create fuzzy row
    this._buildFuzzyContent($body);

    onClickTab(0)();

    // use custom offsets
    const offsetX = 5;
    const offsetY = 15;

    // move window to cluster button
    $root.style({
      'opacity': 0, left: String(mousePos[0] - offsetX) + 'px',
      top: String(mousePos[1] - this.height - offsetY) + 'px'
    });

    return $root;
  }

  // -------------------------------------------------------------------------------------------------------------------

  private _buildKMeansContent($body:d3.Selection<any>) {
    var that = this;

    var $page = $body.append('div').attr('class', 'tab-content page-kmeans hidden');
    this.$pages.push($page);

    // ----------------------------------

    var $paramK = $page.append('div').attr('class', 'parameter');

    $paramK.append('label').text('Number of Clusters:');

    var inputK = $paramK.append('input').attr({'class': 'k-number', type: 'number',
      min: this.options.general.numClusters[0], max: this.options.general.numClusters[1],
      value: this.options.general.numClusters[2], step: 1,
      title: 'Number (k-Value) of disjoint clusters computed by k-Means'
    });

    // ----------------------------------

    var $paramInit = $page.append('div').attr('class', 'parameter');

    $paramInit.append('label').text('Initialization Method:');

    var inputInit = $paramInit.append('select').attr({title: 'Method to choose initial cluster centroids'});
    inputInit.selectAll('option').data(this.options.kmeans.inits)
      .enter().append('option').attr('value', (d:any) => {
      return d;
    }).text((d:string) => d);

    inputInit.property('value', this.options.kmeans.inits[this.options.kmeans.initSelect]);

    // ----------------------------------

    var $paramMetric = $page.append('div').attr('class', 'parameter');

    $paramMetric.append('label').text('Distance Metric:');

    var inputDistance = $paramMetric.append('select')
      .attr({title: 'Distance metric to measure similarity between two records'}).classed('dist', true);
    inputDistance.selectAll('option').data(this.options.general.distances)
      .enter().append('option').attr('value', (d:any) => {
      return d;
    }).text((d:string) => d);

    // ----------------------------------

    var $controlRun = $page.append('div').attr('class', 'control');
    var button = $controlRun.append('button').text('Apply Clustering');

    button.on('mouseup', (_:any) => {
      const k = parseInt($(inputK.node()).val(), 10);
      const initMethod = $(inputInit.node()).val();
      const dist = $(inputDistance.node()).val();

      that.stratomex.clusterData(that.data, 'k-means', [k, initMethod, dist]);
    });
  }

  // -------------------------------------------------------------------------------------------------------------------

  private _buildHierarchicalContent($body:d3.Selection<any>) {
    var that = this;

    var $page = $body.append('div').attr('class', 'tab-content page-hierarchical hidden');
    this.$pages.push($page);

    // ----------------------------------

    var $paramNum = $page.append('div').attr('class', 'parameter');

    $paramNum.append('label').text('Number of Clusters:');

    var inputClusters = $paramNum.append('input').attr({
      'class': 'k-number', type: 'number',
      min: this.options.general.numClusters[0], max: this.options.general.numClusters[1],
      value: this.options.general.numClusters[2], step: 1, title:
        'Number of disjoint clusters after cutting the generated dendrogram tree'
    });

    // ----------------------------------

    var $paramLinkage = $page.append('div').attr('class', 'parameter');

    $paramLinkage.append('label').text('Linkage Method:');

    var inputLinkage = $paramLinkage.append('select')
      .attr({title: 'Method to link two clusters (compute similarity) when building the dendrogram'})
      .classed('linkage', true);
    inputLinkage.selectAll('option').data(this.options.hierarchical.methods)
      .enter().append('option').attr('value', (d:any) => {
      return d;
    }).text((d:string) => d);

    inputLinkage.property('value', this.options.hierarchical.methods[this.options.hierarchical.methodSelect]);

    // ----------------------------------

    var $paramMetric = $page.append('div').attr('class', 'parameter');

    $paramMetric.append('label').text('Similarity Metric:');

    var inputDistance = $paramMetric.append('select')
      .attr({title: 'Distance metric to measure similarity between two records'}).classed('dist', true);
    inputDistance.selectAll('option').data(this.options.general.distances)
      .enter().append('option').attr('value', (d:any) => {
      return d;
    }).text((d:string) => d);

    inputDistance.property('value', this.options.general.distances[this.options.hierarchical.distSelect]);

    // ----------------------------------

    var $controlRun = $page.append('div').attr('class', 'control');
    var button = $controlRun.append('button').text('Apply Clustering');

    button.on('mouseup', (_:any) => {
      const k = parseInt($(inputClusters.node()).val(), 10);
      const method = $(inputLinkage.node()).val();
      const dist = $(inputDistance.node()).val();

      that.stratomex.clusterData(that.data, 'hierarchical', [k, method, dist]);
    });
  }

  // -------------------------------------------------------------------------------------------------------------------

  private _buildAffinityContent($body:d3.Selection<any>) {
    var that = this;

    var $page = $body.append('div').attr('class', 'tab-content page-affinity hidden');
    this.$pages.push($page);

    // ----------------------------------

    var $paramPref = $page.append('div').attr('class', 'parameter');

    $paramPref.append('label').text('Initial Preference Method:');

    var inputSelect = $paramPref.append('select')
      .attr({title: 'Initial preference for all records (minimum value of similarities creates a small number of ' +
      'clusters, the median of similarities generates an ordinary number of clusters'}).classed('init', true);
    inputSelect.selectAll('option').data(this.options.affinity.prefs)
      .enter().append('option').attr('value', (d:any) => {
      return d;
    }).text((d:string) => d);

    inputSelect.property('value', this.options.affinity.prefs[this.options.affinity.prefSelect]);

    // ----------------------------------

    var $paramFactor = $page.append('div').attr('class', 'parameter');

    $paramFactor.append('label').text('Factor of Preferences:');

    var inputFactor = $paramFactor.append('input').attr({
      'class': 'aff-number', type: 'number', name: 'factor',
      min: this.options.affinity.rangeFactor[0], max: this.options.affinity.rangeFactor[1],
      value: this.options.affinity.rangeFactor[2], step: 0.05,
      title: 'Multiplies the preference value by a factor (also influences the produced number of clusters)'
    });

    // ----------------------------------

    var $paramDamping = $page.append('div').attr('class', 'parameter');

    $paramDamping.append('label').text('Damping Value:');

    var inputDamping = $paramDamping.append('input').attr({
      'class': 'aff-number', type: 'number', name: 'damping',
      min: this.options.affinity.rangeDamping[0], max: this.options.affinity.rangeDamping[1],
      value: 0.5, step: 0.05, title: 'Dampens updated values after each iteration step to avoid oscillations'
    });

    // ----------------------------------

    var $paramMetric = $page.append('div').attr('class', 'parameter');

    $paramMetric.append('label').text('Similarity Metric:');

    var inputDistance = $paramMetric.append('select')
      .attr({title: 'Distance metric to measure similarity between two records'}).classed('dist', true);
    inputDistance.selectAll('option').data(this.options.general.distances)
      .enter().append('option').attr('value', (d:any) => {
      return d;
    }).text((d:string) => d);

    inputDistance.property('value', this.options.general.distances[this.options.affinity.distSelect]);

    // ----------------------------------

    var $controlRun = $page.append('div').attr('class', 'control');
    var button = $controlRun.append('button').text('Apply Clustering');

    button.on('mouseup', (_:any) => {
      const affDamping = parseFloat($(inputDamping.node()).val());
      const affFactor = parseFloat($(inputFactor.node()).val());
      const affPref = $(inputSelect.node()).val();
      const dist = $(inputDistance.node()).val();

      that.stratomex.clusterData(that.data, 'affinity', [affDamping, affFactor, affPref, dist]);
    });
  }

  // -------------------------------------------------------------------------------------------------------------------

  private _buildFuzzyContent($body:d3.Selection<any>) {
    var that = this;

    var $page = $body.append('div').attr('class', 'tab-content page-fuzzy hidden');
    this.$pages.push($page);

    // ----------------------------------

    var $paramC = $page.append('div').attr('class', 'parameter');

    $paramC.append('label').text('Number of Clusters:');

    var inputC = $paramC.append('input').attr({
      'class': 'c-number', type: 'number', name: 'c-number',
      min: this.options.general.numClusters[0], max: this.options.general.numClusters[1],
      value: this.options.general.numClusters[2], step: 1, title: 'Number of fuzzy clusters'
    });

    // ----------------------------------

    var $paramThres = $page.append('div').attr('class', 'parameter');

    $paramThres.append('label').text('Probability Threshold:');

    var inputT = $paramThres.append('input').attr({
      'class': 'threshold', type: 'number', name: 'threshold',
      min: this.options.fuzzy.threshold[0], max: this.options.fuzzy.threshold[1],
      value: 0.2, step: 0.01,
      title: 'All records with a probability above or equal this threshold are assigned to a cluster'
    });

    function onClusterChange() {
      var k = parseInt($(inputC.node()).val(), 10);

      if (isNaN(k)) {
        return;
      }

      const threshold = d3.round(1.0 / k, 2);
      $(inputT.node()).val(String(threshold));
    }

    inputC.on('keyup', onClusterChange);
    inputC.on('mouseup', onClusterChange);
    onClusterChange();

    // ----------------------------------

    var $paramFuzzy = $page.append('div').attr('class', 'parameter');

    $paramFuzzy.append('label').text('Fuzziness Factor:');

     var inputM = $paramFuzzy.append('input').attr({
      'class': 'fuzzifier', type: 'number', name: 'fuzzifier',
      min: this.options.fuzzy.fuzzifier[0], max: this.options.fuzzy.fuzzifier[1],
      value: this.options.fuzzy.fuzzifier[2], step: 0.001,
       title: 'The fuzzifier determines the degree of fuzziness in each cluster.' +
     ' A value close to 1 creates nearly disjoint clusters, whereas greater values produce more fuzzy (random) clusters'
    });

    // ----------------------------------

    var $paramMetric = $page.append('div').attr('class', 'parameter');

    $paramMetric.append('label').text('Distance Metric:');

    var inputDistance = $paramMetric.append('select')
      .attr({title: 'Distance metric to measure similarity between two records'}).classed('dist', true);
    inputDistance.selectAll('option').data(this.options.general.distances)
      .enter().append('option').attr('value', (d:any) => {
      return d;
    }).text((d:string) => d);

    inputDistance.property('value', this.options.general.distances[this.options.affinity.distSelect]);

    // ----------------------------------

    var $controlRun = $page.append('div').attr('class', 'control');
    var button = $controlRun.append('button').text('Apply Clustering');

    button.on('mouseup', (_:any) => {
      const c = parseInt($(inputC.node()).val(), 10);
      const m = parseFloat($(inputM.node()).val());
      const t = parseFloat($(inputT.node()).val());
      const dist = $(inputDistance.node()).val();

      that.stratomex.clusterData(that.data, 'fuzzy', [c, m, t, dist]);
    });
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Destroys the node and all its children.
   */
  destroy() {
    if (this.destroyed) {
      return;
    }

    this.$node.transition().duration(this.options.animationTime).style('opacity', 0).remove();
    this.destroyed = true;
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Class definition of similarityPopup

export class SimilarityPopup {
  private $node:d3.Selection<any> = null;
  private destroyed:boolean = false;
  private height:number = 60;

  constructor(private parent:Element, private column:any, clusterID:number,
              private options:any) {
    this.options = C.mixin(
      {
        width: 235,
        animationTime: 200,
        similarityMetric: 'euclidean',
        triggerFunc: null
      }, options);

    this.$node = this._build(d3.select(parent), clusterID);
  }

  // -------------------------------------------------------------------------------------------------------------------

  get node() {
    return this.$node;
  }

  // -------------------------------------------------------------------------------------------------------------------

  private _build($parent:d3.Selection<any>, clusterID:number) {
    var that = this;

    // this works for both Firefox and Chrome
    var mousePos = d3.mouse($parent.node());

    // create root division
    var $root = $parent.append('div').classed('similarityPopup', true);
    // start animation of popup
    $root.transition().duration(this.options.animationTime).style('opacity', 1.0);

    // create title
    var $titleBar = $root.append('div').classed('title', true);
    $titleBar.append('text').text('Choose similarity metric');

    // create toolbar
    var $toolbar = $root.append('div').classed('gtoolbar', true);
    $toolbar.append('i').attr('class', 'fa fa-close')
      .on('click', (_:any) => {
        that.destroy();
      });

    // create body
    var $body = $root.append('div').classed('body', true);
    $body.transition().duration(this.options.animationTime).style('width', String(this.options.width) + 'px');

    // row
    var row = $body.append('div').classed('content', true);

    // button to trigger merge
    var sortButton = row.append('button').attr('title', 'Sort patients by distance').text('Sort');
    var showButton = row.append('button').attr('title', 'Show cluster-patient distances without sorting').text('Show');

    // create selection of similarity metrics
    var sims = ['euclidean', 'sqeuclidean', 'cityblock', 'chebyshev', 'canberra', 'correlation', 'hamming',
                'mahalanobis', 'pearson', 'spearman', 'kendall'];


    var clusterSelect = row.append('select').attr({title: 'Select similarity metric'}).classed('similaritySelect', true);
    clusterSelect.selectAll('option').data(sims)
      .enter().append('option').attr('value', String)
      .text(String);

    // select first cluster by default
    clusterSelect.property('value', this.options.similarityMetric);

    // button event
    function onClick(sorted:boolean) {

      return () => {
        // obtain selected similarity metric
        const simMetric = $(clusterSelect.node()).val();

        // return similarity metric
        that.options.triggerFunc(simMetric, sorted);

        // remove this window
        this.destroy();
      };
    }

    sortButton.on('mouseup', onClick(true));
    showButton.on('mouseup', onClick(false));

    // use custom offsets
    const offsetX = 10;
    const offsetY = -6;

    // move window to cluster button
    $root.style({
      'opacity': 0, left: String(mousePos[0] - offsetX) + 'px',
      top: String(mousePos[1] - this.height - offsetY) + 'px'
    });

    return $root;
  }

  // -------------------------------------------------------------------------------------------------------------------

  destroy() {
    if (this.destroyed) {
      return;
    }

    this.$node.transition().duration(this.options.animationTime).style('opacity', 0).remove();
    this.destroyed = true;
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Class definition of MergePopup

export class MergePopup {
  private $node:d3.Selection<any> = null;
  private destroyed:boolean = false;
  private height:number = 60;

  constructor(private data:datatypes.IDataType, private parent:Element,
              private column:any, clusterID:number, private numClusters:number,
              private options:any) {
    this.options = C.mixin(
      {
        width: 170,
        animationTime: 200
      }, options);

    this.$node = this._build(d3.select(parent), clusterID);
  }

  // -------------------------------------------------------------------------------------------------------------------

  get node() {
    return this.$node;
  }

  // -------------------------------------------------------------------------------------------------------------------

  private _build($parent:d3.Selection<any>, clusterID:number) {
    var that = this;

    // this works for both Firefox and Chrome
    var mousePos = d3.mouse($parent.node());

    // create root division
    var $root = $parent.append('div').classed('mergePopup', true);
    // start animation of popup
    $root.transition().duration(this.options.animationTime).style('opacity', 1.0);

    // create title
    var $titleBar = $root.append('div').classed('title', true);
    $titleBar.append('text').text('Merge Group ' + clusterID);

    // create toolbar
    var $toolbar = $root.append('div').classed('gtoolbar', true);
    $toolbar.append('i').attr('class', 'fa fa-close')
      .on('click', (_:any) => {
        that.destroy();
      });

    // create body
    var $body = $root.append('div').classed('body', true);
    $body.transition().duration(this.options.animationTime).style('width', String(this.options.width) + 'px');

    // row
    var row = $body.append('div').classed('content', true);

    // button to trigger merge
    var button = row.append('button').text('Merge');

    var clusterNums = Array.apply(null, Array(this.numClusters)).map((_, i) => 'Group ' + String(i));
    clusterNums.splice(clusterID, 1);

    // create selection of cluster ids
    var clusterSelect = row.append('select').attr({title: 'select second group'}).classed('clusterSelect', true);
    clusterSelect.selectAll('option').data(clusterNums)
      .enter().append('option').attr('value', String)
      .text(String);

    // select first cluster by default
    clusterSelect.property('value', clusterNums[0]);

    // button event
    button.on('mouseup', () => {
      // obtain selected cluster index
      const otherClusterID = parseFloat($(clusterSelect.node()).val().slice(-1));

      // merge clusters
      this.column.mergeClusters(clusterID, otherClusterID);

      // remove this window
      this.destroy();
    });

    // use custom offsets
    const offsetX = 10;
    const offsetY = -6;

    // move window to cluster button
    $root.style({
      'opacity': 0, left: String(mousePos[0] - offsetX) + 'px',
      top: String(mousePos[1] - this.height - offsetY) + 'px'
    });

    return $root;
  }

  // -------------------------------------------------------------------------------------------------------------------

  destroy() {
    if (this.destroyed) {
      return;
    }

    this.$node.transition().duration(this.options.animationTime).style('opacity', 0).remove();
    this.destroyed = true;
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Creation methods

/**
 *
 * @param data
 * @param parent
 * @param stratomex
 * @param rowID
 * @param options
 * @returns {ClusterPopup}
 */
export function createClusterPopup(data:matrix.IMatrix, parent:Element, stratomex:any, rowID:number,
                                   options:any) {
  return new ClusterPopup(data, parent, stratomex, rowID, options);
}

export function createMergePopup(data:matrix.IMatrix, parent:Element, column:any, rowID:number, numClusters:number,
                                 options:any) {
  return new MergePopup(data, parent, column, rowID, numClusters, options);
}

export function createSimilarityPopup(parent:Element, column:any, rowID:number,
                                 options:any) {
  return new SimilarityPopup(parent, column, rowID, options);
}
