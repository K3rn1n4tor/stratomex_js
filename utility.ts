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
 * Implemenation of a simple popup to select a cluster algorithm applied to any matrix with
 * corresponding parameter settings.
 */
export class ClusterPopup
{
  private $node : d3.Selection<any>;
  private destroyed: boolean = false;

  // -------------------------------------------------------------------------------------------------------------------

  /**
   *
   * @param data
   * @param parent
   * @param stratomex
   * @param rowID
     * @param options
     */
  constructor(private data: datatypes.IDataType, private parent: Element,
              private stratomex : any, rowID : number,
              private options: any)
  {
    this.options = C.mixin(
      {
        width: 200,
        animationTime: 200,
        'kmeans':
        {
          range: [2, 10]
        },
        'affinity':
        {
          range: [0, 10]
        }
      }, options);
    this.$node = this._build(d3.select(parent), rowID);
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   *
   * @returns {d3.Selection<any>}
     */
  get node()
  {
    return this.$node;
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   *
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
    $root.transition().duration(this.options.animationTime).style('opacity', 1);

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
    var rowKMeans = $body.append('div').classed('method', true);
    var buttonKMeans = rowKMeans.append('button').text('k-Means');
    var inputKMeans = rowKMeans.append('input').attr({
      class: 'k-number', type: 'number', min: this.options.kmeans.range[0], max: this.options.kmeans.range[1],
      value: this.options.kmeans.range[0]
    });

    buttonKMeans.on('mouseup', (_ : any) => {
      var $input = $(rowKMeans.node()).find('input');
      const k = parseInt($($input).val());

      this.stratomex.clusterData(that.data, 'k-means', k);
    });

    // create affinity row
    var rowAffinity = $body.append('div').classed('method', true);
    var buttonAffinity = rowAffinity.append('button').text('Affinity');
    var inputAffinity = rowAffinity.append('input').attr({
      class: 'aff-number', type: 'number', min: this.options.affinity.range[0], max: this.options.affinity.range[1],
      value: this.options.affinity.range[0]
    });

    buttonAffinity.on('mouseup', (_ : any) => {
      var $input = $(rowAffinity.node()).find('input');
      const aff = parseFloat($($input).val());

      this.stratomex.clusterData(that.data, 'affinity', aff);
    });

    return $root;
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   *
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