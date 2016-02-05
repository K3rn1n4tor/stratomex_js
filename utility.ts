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
// class definition

/**
 * Implementation of a simple popup to select a cluster algorithm applied to any matrix with
 * corresponding parameter settings.
 */
export class ClusterPopup
{
  private $node : d3.Selection<any>;
  private destroyed: boolean = false;

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
  constructor(private data: datatypes.IDataType, private parent: Element,
              private stratomex : any, rowID : number,
              private options: any)
  {
    this.options = C.mixin(
      {
        width: 420,
        animationTime: 200,
        'kmeans':
        {
          range: [2, 20, 2],
          inits: ['forgy', 'uniform', 'random', 'kmeans++'], // initialization method for k-means
          initSelect: 3
        },
        'affinity':
        {
          rangeDamping: [0, 1, 0.5], // damping avoids oscillations of algorithm [min, max, value]
          rangeFactor: [0.1, 10, 1.0], // influences the preference value (influences number of clusters)
          prefs: ['median', 'minimum'], // median produces moderate number, minimum a small number of clusters
          prefSelect: 1
        }
      }, options);
    this.$node = this._build(d3.select(parent), rowID);
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Returns the html node.
   * @returns {d3.Selection<any>}
     */
  get node()
  {
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
  private _build($parent : d3.Selection<any>, rowID : number)
  {
    var that = this;

    // find the current rows section in lineup
    var $rows = $($parent.node()).find('g.rows')[0];
    var $currentRow = $($rows).find('g.row')[rowID];
    var $action = $($currentRow).find("tspan[title='cluster']")[0];

    // obtain current position of cluster button
    var position = $($action).position();

    // compute offsets
    var offsetX = 15;
    var windowHeight = 80; // 2 * 35px row height + title_height / 2


    // move window to cluster button
    var $root = $parent.append('div').classed('clusterPopup', true);
    $root.style({
      'opacity': 0, left: String(position.left + offsetX) + 'px',
      top: String(position.top - windowHeight) + 'px'
    });

    // start animation of popup
    $root.transition().duration(this.options.animationTime).style('opacity', 0.5);

    // create title
    $root.append('div').classed('title', true).text('\u2756 Apply Clustering Algorithm');

    // create toolbar
    var $toolbar = $root.append('div').classed('toolbar', true);
    $toolbar.append('i').attr('class', 'fa fa-close')
      .on('click', (_ : any) => { that.destroy(); });

    // create body
    var $body = $root.append('div').classed('body', true);
    $body.transition().duration(this.options.animationTime).style('width', String(this.options.width) + 'px');

    // create k-means row
    this._buildKMeansRow($body);

    // create affinity row
    this._buildAffinityRow($body);

    return $root;
  }

  // -------------------------------------------------------------------------------------------------------------------

  private _buildKMeansRow($body: d3.Selection<any>)
  {
    var that = this;

    var rowKMeans = $body.append('div').classed('method', true);
    var buttonKMeans = rowKMeans.append('button').text('k-Means');
    var inputKMeans = rowKMeans.append('input').attr({
      class: 'k-number', type: 'number',
      min: this.options.kmeans.range[0], max: this.options.kmeans.range[1],
      value: this.options.kmeans.range[2], step: 1, title: "Number of Clusters"
    });

    var selectKMeans = rowKMeans.append('select').attr({ title: 'Initialization Method' });
    selectKMeans.selectAll('option').data(this.options.kmeans.inits)
      .enter().append('option').attr('value', (d: any) => { return d; })
      .text( (d: string) => { return d });

    selectKMeans.property('value', this.options.kmeans.inits[this.options.kmeans.initSelect]);

    buttonKMeans.on('mouseup', (_ : any) => {
      var input = $(rowKMeans.node()).find('input');
      var select = $(rowKMeans.node()).find('select');
      const k = parseInt($(input).val());
      const initMethod = $(select).val();

      that.stratomex.clusterData(that.data, 'k-means', [k, initMethod]);
    });
  }

  // -------------------------------------------------------------------------------------------------------------------

  private _buildAffinityRow($body: d3.Selection<any>)
  {
    var that = this;

    var rowAffinity = $body.append('div').classed('method', true);
    var buttonAffinity = rowAffinity.append('button').text('Affinity');
    var inputDamping = rowAffinity.append('input').attr({
      class: 'aff-number', type: 'number', name: 'damping',
      min: this.options.affinity.rangeDamping[0], max: this.options.affinity.rangeDamping[1],
      value: 0.5, step: 0.05, title: "Damping Value"
    });
    var inputFactor = rowAffinity.append('input').attr({
      class: 'aff-number', type: 'number', name: 'factor',
      min: this.options.affinity.rangeFactor[0], max: this.options.affinity.rangeFactor[1],
      value: this.options.affinity.rangeFactor[2], step: 0.05, title: "Factor Value"
    });

    var selectAffinity = rowAffinity.append('select').attr({ title: 'Initial Preference' });
    selectAffinity.selectAll('option').data(this.options.affinity.prefs)
      .enter().append('option').attr('value', (d: any) => { return d; })
      .text( (d: string) => { return d });

    selectAffinity.property('value', this.options.affinity.prefs[this.options.affinity.prefSelect]);

    buttonAffinity.on('mouseup', (_ : any) =>
    {
      var inputDamping = $(rowAffinity.node()).find("input[name='damping']");
      var inputFactor = $(rowAffinity.node()).find("input[name='factor']");
      var inputSelect = $(rowAffinity.node()).find("select");

      const affDamping = parseFloat($(inputDamping).val());
      const affFactor = parseFloat($(inputFactor).val());
      const affPref = $(inputSelect).val();

      that.stratomex.clusterData(that.data, 'affinity', [affDamping, affFactor, affPref]);
    });
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Destroys the node and all its children.
   */
  destroy()
  {
    if (this.destroyed) { return; }

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
 * @param clusterCallBack
 * @param rowID
 * @param options
 * @returns {ClusterPopup}
 */
export function createClusterPopup(data: matrix.IMatrix, parent: Element, clusterCallBack : any, rowID : number,
              options: any)
{
  return new ClusterPopup(data, parent, clusterCallBack, rowID, options);
}
