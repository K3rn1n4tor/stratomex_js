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
        width: 580,
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
            'mahalanobis', 'correlation', 'pearson', 'spearman', 'kendall'],
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

    // find the current rows section in lineup
    //var $rows = $($parent.node()).find('g.rows')[0];
    //var $currentRow = $($rows).find('g.row[data-index="' + String(rowID) + '"]')[0];
    //var $action = $($currentRow).find('tspan[title="cluster"]')[0];

    // this works for both Firefox and Chrome
    var mousePos = d3.mouse($parent.node());

    var $root = $parent.append('div').classed('clusterPopup', true);

    // start animation of popup
    $root.transition().duration(this.options.animationTime).style('opacity', 0.5);

    // create title
    var $titleBar = $root.append('div').classed('title', true);
    $titleBar.append('i').classed('fa fa-gears', true);
    $titleBar.append('text').text('Apply Clustering (' + this.data.desc.name + ')').style('margin-left', '5px');

    // create toolbar
    var $toolbar = $root.append('div').classed('toolbar', true);
    $toolbar.append('i').attr('class', 'fa fa-close')
      .on('click', (_:any) => {
        that.destroy();
      });

    // create body
    var $body = $root.append('div').classed('body', true);
    $body.transition().duration(this.options.animationTime).style('width', String(this.options.width) + 'px');

    // create k-means row
    this._buildKMeansRow($body);

    // create hierarchical row
    this._buildHierarchicalRow($body);

    // create affinity row
    this._buildAffinityRow($body);

    // create fuzzy row
    this._buildFuzzyRow($body);

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

  private _buildKMeansRow($body:d3.Selection<any>) {
    var that = this;
    this.height += this.options.rowHeight;

    var row = $body.append('div').classed('method', true);
    var button = row.append('button').text('k-Means');
    var inputK = row.append('input').attr({
      'class': 'k-number', type: 'number',
      min: this.options.general.numClusters[0], max: this.options.general.numClusters[1],
      value: this.options.general.numClusters[2], step: 1, title: 'Number of Clusters'
    });

    var inputInit = row.append('select').attr({title: 'Initialization Method'});
    inputInit.selectAll('option').data(this.options.kmeans.inits)
      .enter().append('option').attr('value', (d:any) => {
      return d;
    })
      .text((d:string) => d);

    inputInit.property('value', this.options.kmeans.inits[this.options.kmeans.initSelect]);

    button.on('mouseup', (_:any) => {
      const k = parseInt($(inputK.node()).val(), 10);
      const initMethod = $(inputInit.node()).val();

      that.stratomex.clusterData(that.data, 'k-means', [k, initMethod]);
    });
  }

  // -------------------------------------------------------------------------------------------------------------------

  private _buildHierarchicalRow($body:d3.Selection<any>) {
    var that = this;
    this.height += this.options.rowHeight;

    var row = $body.append('div').classed('method', true);
    var button = row.append('button').text('Hierarchical');
    var inputClusters = row.append('input').attr({
      'class': 'k-number', type: 'number',
      min: this.options.general.numClusters[0], max: this.options.general.numClusters[1],
      value: this.options.general.numClusters[2], step: 1, title: 'Number of Clusters'
    });

    var inputLinkage = row.append('select').attr({title: 'Linkage Method'}).classed('linkage', true);
    inputLinkage.selectAll('option').data(this.options.hierarchical.methods)
      .enter().append('option').attr('value', (d:any) => {
      return d;
    })
      .text((d:string) => d);

    inputLinkage.property('value', this.options.hierarchical.methods[this.options.hierarchical.methodSelect]);

    var inputDistance = row.append('select').attr({title: 'Distance Measurement'}).classed('dist', true);
    inputDistance.selectAll('option').data(this.options.general.distances)
      .enter().append('option').attr('value', (d:any) => {
      return d;
    })
      .text((d:string) => d);

    inputDistance.property('value', this.options.general.distances[this.options.hierarchical.distSelect]);

    button.on('mouseup', (_:any) => {
      const k = parseInt($(inputClusters.node()).val(), 10);
      const method = $(inputLinkage.node()).val();
      const dist = $(inputDistance.node()).val();

      that.stratomex.clusterData(that.data, 'hierarchical', [k, method, dist]);
    });
  }

  // -------------------------------------------------------------------------------------------------------------------

  private _buildAffinityRow($body:d3.Selection<any>) {
    var that = this;
    this.height += this.options.rowHeight;

    var row = $body.append('div').classed('method', true);
    var button = row.append('button').text('Affinity');
    var inputDamping = row.append('input').attr({
      'class': 'aff-number', type: 'number', name: 'damping',
      min: this.options.affinity.rangeDamping[0], max: this.options.affinity.rangeDamping[1],
      value: 0.5, step: 0.05, title: 'Damping Value'
    });
    var inputFactor = row.append('input').attr({
      'class': 'aff-number', type: 'number', name: 'factor',
      min: this.options.affinity.rangeFactor[0], max: this.options.affinity.rangeFactor[1],
      value: this.options.affinity.rangeFactor[2], step: 0.05, title: 'Factor Value'
    });

    var inputSelect = row.append('select').attr({title: 'Initial Preference'}).classed('init', true);
    inputSelect.selectAll('option').data(this.options.affinity.prefs)
      .enter().append('option').attr('value', (d:any) => {
      return d;
    })
      .text((d:string) => d);

    inputSelect.property('value', this.options.affinity.prefs[this.options.affinity.prefSelect]);

    var inputDistance = row.append('select').attr({title: 'Distance Measurement'}).classed('dist', true);
    inputDistance.selectAll('option').data(this.options.general.distances)
      .enter().append('option').attr('value', (d:any) => {
      return d;
    })
      .text((d:string) => d);

    inputDistance.property('value', this.options.general.distances[this.options.affinity.distSelect]);

    button.on('mouseup', (_:any) => {
      const affDamping = parseFloat($(inputDamping.node()).val());
      const affFactor = parseFloat($(inputFactor.node()).val());
      const affPref = $(inputSelect.node()).val();
      const dist = $(inputDistance.node()).val();

      that.stratomex.clusterData(that.data, 'affinity', [affDamping, affFactor, affPref, dist]);
    });
  }

  // -------------------------------------------------------------------------------------------------------------------

  private _buildFuzzyRow($body:d3.Selection<any>) {
    var that = this;
    this.height += this.options.rowHeight;

    var row = $body.append('div').classed('method', true);
    var button = row.append('button').text('Fuzzy');

    var inputC = row.append('input').attr({
      'class': 'c-number', type: 'number', name: 'c-number',
      min: this.options.general.numClusters[0], max: this.options.general.numClusters[1],
      value: this.options.general.numClusters[2], step: 1, title: 'Number of Clusters'
    });

    var inputT = row.append('input').attr({
      'class': 'threshold', type: 'number', name: 'threshold',
      min: this.options.fuzzy.threshold[0], max: this.options.fuzzy.threshold[1],
      value: 0.2, step: 0.01, title: 'Probability Threshold'
    });

    var inputM = row.append('input').attr({
      'class': 'fuzzifier', type: 'number', name: 'fuzzifier',
      min: this.options.fuzzy.fuzzifier[0], max: this.options.fuzzy.fuzzifier[1],
      value: this.options.fuzzy.fuzzifier[2], step: 0.001, title: 'Fuzzifier Factor'
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

    button.on('mouseup', (_:any) => {
      const c = parseInt($(inputC.node()).val(), 10);
      const m = parseFloat($(inputM.node()).val());
      const t = parseFloat($(inputT.node()).val());

      that.stratomex.clusterData(that.data, 'fuzzy', [c, m, t]);
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
// Class definition of mergePopup

export class MergePopup {
  private $node:d3.Selection<any> = null;
  private destroyed:boolean = false;
  private height:number = 60;

  constructor(private data:datatypes.IDataType, private parent:Element,
              private column:any, clusterID:number, private numClusters:number,
              private options:any) {
    this.options = C.mixin(
      {
        width: 150,
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

    var clusterNums = Array.apply(null, Array(this.numClusters)).map((_, i) => i);
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
      const otherClusterID = parseFloat($(clusterSelect.node()).val());

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
