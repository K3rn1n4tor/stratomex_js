/**
 * Created by Michael Kern on 29.02.2016.
 */

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// libraries
import d3 = require('d3');
import $ = require('jquery');
import ajax = require('../caleydo_core/ajax');
import C = require('../caleydo_core/main');
import multiform = require('../caleydo_core/multiform');
import geom = require('../caleydo_core/geom');
import idtypes = require('../caleydo_core/idtype');
import behaviors = require('../caleydo_core/behavior');
import events = require('../caleydo_core/event');
import link_m = require('../caleydo_links/link');
import datatypes = require('../caleydo_core/datatype');
import datas = require('../caleydo_core/data');
import prov = require('../caleydo_provenance/main');
import ranges = require('../caleydo_core/range');
import stratification = require('../caleydo_core/stratification');
import stratification_impl = require('../caleydo_core/stratification_impl');
import parser = require('../caleydo_d3/parser');
import vis = require('../caleydo_core/vis');
import heatmap = require('../caleydo_vis/heatmap');

// my own libraries
import columns = require('./Column');
import boxSlider = require('./boxslider');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// class definition

/**
 * Represents a detailed view of the current cluster / stratification.
 */
export class ClusterDetailView
{
  public dividers: boxSlider.BoxSlider[] = [];
  public $nodes: d3.Selection<any>[] = [];
  public column: any = null;
  public zooms: behaviors.ZoomLogic[] = [];
  public matrix: heatmap.HeatMap;
  public zoomMatrix: behaviors.ZoomLogic;
  public $tooltipMatrix: d3.Selection<any>;
  public visible: boolean = true;
  public externVisible: boolean = false;
  public $toolbar: d3.Selection<any>;

  private distancesRange: [number, number];
  private numGroups: number;

  // -------------------------------------------------------------------------------------------------------------------

  constructor(private cluster: number, private data: datatypes.IDataType, private range: ranges.Range,
              private options: any)
  {
    this.options = C.mixin({ matrixMode: false, matrixWidth: 140 }, options);
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Build the view and sub-views.
   * @param $parent
   * @param column
   * @param within
   * @returns {Promise<TResult>|Promise<U>}
     */
  build($parent :d3.Selection<any>, column: any, within=-1)
  {
    const that = this;
    const cluster = this.cluster;
    const data = this.data;
    const compositeRange = (<any>this.range.dims[0]);
    const numGroups = compositeRange.groups.length;
    this.numGroups = numGroups;

    // collect all server requests
    var responses = [];

    if (this.distancesRange == null)
    {
      // show mouse waiting icon
      $('body').addClass('waiting');

      // request all inner cluster-distances (no external distances)
      for (var j = 0; j < numGroups; ++j)
      {
        var labelList = compositeRange.groups[j].asList();
        var request = { group: JSON.stringify({ labels: labelList }) };
        responses.push(ajax.send('/api/clustering/distances/' + data.desc.id, request, 'post'));
      }

      // concat all distances and compute min/max value along all distances
      Promise.all(responses).then( (args: any) =>
      {
        var values = [];

        for (var j = 0; j < numGroups; ++j)
        {
          values = values.concat(args[j].distances);
        }

        that.distancesRange = d3.extent(values);
      });
    }

    // request inner and external distances of current cluster
    var labelList = compositeRange.groups[cluster].asList();

    // gather all other clusters and their labels
    var externLabelList = [];
    var externLabelIDs = [];
    for (var j = 0; j < numGroups; ++j)
    {
      if (j == cluster) { continue; }
      externLabelList.push(compositeRange.groups[j].asList());
      externLabelIDs.push(j);
    }

    // request cluster distance data from server
    $('body').addClass('waiting');
    var request = { group: JSON.stringify({ labels: labelList, externLabels: externLabelList }) };
    var response = ajax.send('/api/clustering/distances/' + this.data.desc.id, request, 'post');
    console.log("Requested distances of data set:", this.data.desc.id);

    // resolve all promises, including the promises where the distance range is determined
    return Promise.all(responses.concat(response)).then( (args: any) =>
    {
      var distanceData = args[responses.length];
      if (distanceData === null) { return Promise.resolve([]); }

      var distances = distanceData.distances;
      var externDistances = distanceData.externDistances;
      var labels = distanceData.labels;

      // create a new matrix view
      // 1) create matrix data
      var rawDistMatrix = [];

      var header = ['ID'];
      for (var j = 0; j < numGroups; ++j)
      {
        header.push(String(j));
      }
      rawDistMatrix.push(header);

      for (var i = 0; i < distances.length; ++i)
      {
        var row = [String(i), distances[i]];
        for (var j = 0; j < externDistances.length; ++j)
        {
          row.push(externDistances[j][i])
        }

        rawDistMatrix.push(row);
      }
      // 2) parse matrix
      var distMatrix = parser.parseMatrix(rawDistMatrix);

      // build main node of the view
      const $elem = $parent.append('div').classed('stats', true).style('opacity', 0);
      $elem.classed('group', true).datum(data);

      // create the toolbar of the detail view
      this.$toolbar = $elem.append('div').attr('class', 'gtoolbar');

      // build title and body of all subviews -> build skeleton
      $elem.append('div').attr('class', 'title').text('Distances');
      const $body = $elem.append('div').attr('class', 'body');
      that.$nodes.push($elem);

      if (externDistances != null)
      {
        for (var j = 0; j < externDistances.length; ++j)
        {
          const $elemNext = $parent.append('div').classed('stats', true).style('opacity', 0);
          $elemNext.classed('group', true).datum(data);
          $elemNext.append('div').attr('class', 'title').text('Ext ' + String(externLabelIDs[j]));
          $elemNext.append('div').attr('class', 'body');
          that.$nodes.push($elemNext);
        }
      }

      // update statistics view
      var allDistances = [distances].concat(externDistances);
      that.update(allDistances, labels, distMatrix);

      // activate matrix handler
      d3.select(that.matrix.node).on('click', that._onClickMatrix(rawDistMatrix, numGroups, labels, column));

      // update all dividers after mouse click
      $elem.on('mouseup', that._mouseOutHandler());
      // and color each extern distance box chart at the beginning
      that._mouseOutHandler()({});

      // remove waiting icon
      $('body').removeClass('waiting');
      // make first view visible
      that.$nodes[0].transition().duration(columns.animationTime(within)).style('opacity', 1);

      // re-sort labels so that patients correspond to bar rows / matrix rows
      var rangeGroup = ranges.parse(labels);
      var newGroups = (<any>that.range.dims[0]).groups;
      newGroups.splice(cluster, 1, new ranges.Range1DGroup('Group ' + String(cluster), 'grey', rangeGroup.dim(0)));

      const dataName = that.data.desc.name;
      const newCompositeRange = ranges.composite(dataName + 'groups', newGroups);

      return Promise.resolve([newCompositeRange]);
    });

  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Handle mouseout event of dividers.
   * @returns {function(any): undefined}
   * @private
     */
  private _mouseOutHandler()
  {
    const that = this;

    return (_: any) =>
    {
      var extDividers = that.dividers.slice(1, that.dividers.length);
      var innerDivider = that.dividers[0];

      var divs = innerDivider.getCurrentDivisions();
      extDividers.forEach((d: boxSlider.BoxSlider) => { d.setDivisions(divs); });
    };
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Handle mouse events of matrix view.
   * @param mode
   * @returns {any}
   * @private
     */
  private _matrixMouseHandler(mode)
  {
    const that = this;

    var IDs = Array.apply(null, Array(that.numGroups)).map( (_, i) => { return i; });
    IDs.splice(that.cluster, 1);
    IDs.splice(0, 0, that.cluster);

    if (mode == 'mousemove')
    {
      return function(_: any)
      {
        if (!that.matrixMode) { return; }

        var $target = $(event.target);
        if ($target.is('.title') || $target.is('.gtoolbar')) { return; }

        var mousePos = d3.mouse(that.$nodes[0].node());

        that.$tooltipMatrix.style('opacity', 0.75);
        that.$tooltipMatrix.style({ left: (mousePos[0] - 25) + 'px', top: (mousePos[1] - 20) + 'px' });

        const mousePosX = mousePos[0];
        const padding = 4;
        const columnWidth = (that.options.matrixWidth - padding) / that.numGroups;

        var index = -1;
        for (var pos = 0; pos <= mousePosX; pos += columnWidth) { index++; }

        if (index < 0 || index >= that.numGroups) { return; }
        that.$tooltipMatrix.html('Group ' + String(IDs[index]));
      }
    }

    if (mode == 'mouseout')
    {
      return function(_: any)
      {
        that.$tooltipMatrix.style('opacity', 0);
      }
    }

    return null;
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Handle click event of matrix view.
   * @param rawMatrix
   * @param numGroups
   * @param rawLabels
   * @param column
   * @returns {function(): undefined}
     * @private
     */
  private _onClickMatrix(rawMatrix, numGroups, rawLabels, column: any)
  {
    const that = this;

    return function()
    {
      that.matrix.destroy();
      var mousePos = d3.mouse(that.$nodes[0].node());
      const mousePosX = mousePos[0];
      const padding = 4;
      var columnWidth = (that.options.matrixWidth - padding) / numGroups;

      var index = 0;
      for (var pos = 0; pos < mousePosX; pos += columnWidth) { index++; }

      // 1) sort matrix by selected column
      function sortMatrix(a, b)
      {
        if (a[0] == 'ID') { return -1; }
        if (b[0] == 'ID') { return 1; }

        return a[index] - b[index];
      }

      var sortedMatrix = rawMatrix.slice();
      sortedMatrix.sort(sortMatrix);
      var newDistMatrix = parser.parseMatrix(sortedMatrix);

      var $body = that.$nodes[0].select('.body');

      // 2) resort corresponding group and its labels and redraw grid
      var oldGroups = (<any>that.range.dim(0)).groups;

      var newLabels = [];
      // copy old distances to new distances
      var newDistances = Array.apply(null, Array(numGroups)).map( (d,i) => { return []; });

      for (var j = 0; j < rawLabels.length; ++j)
      {
        var ID = parseInt(sortedMatrix[j + 1][0]);
        newLabels.push(rawLabels[ID]);
        for (var i = 0; i < newDistances.length; ++i)
        {
          newDistances[i].push(sortedMatrix[j + 1][i + 1]);
        }
      }

      var newRange = ranges.parse(newLabels);
      var newGroup = new ranges.Range1DGroup('Group ' + String(that.cluster), 'grey', newRange.dim(0));
      oldGroups.splice(that.cluster, 1, newGroup);

      const newCompositeRange = ranges.composite(oldGroups.name, oldGroups);

      that.update(newDistances, newLabels, newDistMatrix);
      d3.select(that.matrix.node).on('click', that._onClickMatrix(rawMatrix, numGroups, rawLabels, column));

      that.$nodes[0].on('mouseup', that._mouseOutHandler());
      that._mouseOutHandler()({});

      // 4) finally update the grid
      C.resolveIn(5).then( () =>
      {
        column.updateGrid(newCompositeRange, true);
      });
    };
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Obtain current mode of view.
   * @returns {boolean|any}
     */
  get matrixMode()
  {
    return this.options.matrixMode;
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Switch matrix mode.
   */
  toggleMatrixMode()
  {
    this.options.matrixMode = !this.options.matrixMode;
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Update matrix / divider views.
   * @param distances
   * @param labels
   * @param distMatrix
     */
  update(distances: any, labels: number[], distMatrix)
  {
    const that = this;

    var $body = this.$nodes[0].select('.body');

    this.matrix = heatmap.create(distMatrix, <Element>$body.node(), { selectAble: false });
    this.zoomMatrix = new behaviors.ZoomLogic(this.matrix, null);
    d3.select(this.matrix.node).classed('hidden', true);

    if (this.$tooltipMatrix) { this.$tooltipMatrix.remove(); }
    this.$tooltipMatrix = $body.append('div').classed('tooltip', true)
      .style({ opacity: 0, position: 'absolute !important', left: 0, top: 0, color: 'black', width: '50px',
            padding: 0, margin: 0, 'text-align': 'center', 'border-radius': '4px', 'background': '#60AA85'});

    this.$nodes[0].on('mousemove', this._matrixMouseHandler('mousemove'));
    this.$nodes[0].on('mouseout', this._matrixMouseHandler('mouseout'));

    for (var i = 0; i < distances.length; ++i)
    {
      var divider = <boxSlider.BoxSlider>this.dividers[i];
      if (divider) { d3.select(divider.node).remove(); }

      var $currentNode = this.$nodes[i].select('.body');
      this.dividers[i] = <boxSlider.BoxSlider>boxSlider.createRaw(distances[i], <Element>$currentNode.node(), {
        range: this.distancesRange, numAvg: 1, numSlider: (i == 0) ? 2 : 0 });
      this.zooms[i] = new behaviors.ZoomLogic(this.dividers[i], null);
      this.dividers[i].setLabels(labels);
    }

    if (this.options.matrixMode)
    {
      d3.select(this.dividers[0].node).classed('hidden', true);

      C.resolveIn(5).then( () =>
      {
        d3.select(that.matrix.node).classed('hidden', false);
      });
    }
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Show this detail view.
   * @param within
     */
  show(within=-1)
  {
    this.$nodes[0].classed('hidden', false);
    this.$nodes[0].transition().duration(columns.animationTime(within)).style('opacity', 1);
    this.visible = true;

    d3.select(this.dividers[0].node).classed('hidden', this.matrixMode);
    d3.select(this.matrix.node).classed('hidden', !this.matrixMode);

    if (this.$nodes.length - 1 > 0 && this.externVisible)
    {
      for (var k = 1; k < this.$nodes.length; ++k)
      {
        this.$nodes[k].transition().duration(columns.animationTime(within)).style('opacity', 1);
        this.$nodes[k].classed('hidden', this.matrixMode);
      }
    }
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Hide this detail view.
   * @param within
     */
  hide(within=-1)
  {
    this.visible = false;
    this.$nodes[0].transition().duration(columns.animationTime(within)).style('opacity', 0);
    this.$nodes[0].classed('hidden', true);

    if (this.$nodes.length - 1 > 0)
    {
      for (var k = 1; k < this.$nodes.length; ++k)
      {
        this.$nodes[k].transition().duration(columns.animationTime(within)).style('opacity', 0);
        this.$nodes[k].classed('hidden', true);
      }
    }
  }
}