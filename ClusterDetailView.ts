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
import link_m = require('../caleydo_d3/link');
import datatypes = require('../caleydo_core/datatype');
import datas = require('../caleydo_core/data');
import prov = require('../caleydo_clue/prov');
import ranges = require('../caleydo_core/range');
import stratification = require('../caleydo_core/stratification');
import stratification_impl = require('../caleydo_core/stratification_impl');
import parser = require('../caleydo_d3/parser');
import vis = require('../caleydo_core/vis');
import heatmap = require('../caleydo_vis/heatmap');

// my own libraries
import columns = require('./Column');
import boxSlider = require('./boxslider');
import {createToggleStatsCmd} from './ClusterColumn';
import {createRegroupColumnCmd} from './ClusterColumn';


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function showProbs(inputs, parameter, graph, within)
{
  var column: any = inputs[0].value;
  var cluster = parameter.cluster;
  var show = parameter.action === 'show';

  var r: Promise<any>;
  if (show)
  {
    r = column.showProbs(cluster, within);
  }
  else
  {
    r = column.hideProbs(cluster, within);
  }
  return r.then(() =>
  {
    return {
      inverse: createToggleProbsCmd(inputs[0], cluster, !show),
      consumed: within
    };
  });
}

// ---------------------------------------------------------------------------------------------------------------------

export function createToggleProbsCmd(column, cluster, show)
{
  var act = show ? 'Show' : 'Hide';
  return prov.action(prov.meta(act + ' Probabilities of ' + column.toString() + ' Cluster "' + cluster + '"', prov.cat.layout),
    'showStratomeXProbs', showProbs, [column], {
      cluster: cluster,
      action: show ? 'show' : 'hide'
    });
}

// ---------------------------------------------------------------------------------------------------------------------

function applyDivisions(view: any, cluster: number, column: any)
{
  var clusterIndex = view.cluster;

  var rangeColumn = <ranges.CompositeRange1D>view.column.getRange().dim(0);
  var copyCompositeRange = $.extend(true, {}, column.getRange().dim(0));
  column.prevStratis.splice(0, 0, copyCompositeRange);
  var groupsColumn = rangeColumn.groups;
  var newGroups = [];

  var compRange = <ranges.CompositeRange1D>column.getRange().dim(0);

  for (var i = 0; i < compRange.groups.length; ++i)
  {
    if (i == clusterIndex) { continue; }
    var groupIndex = i;
    if (i > clusterIndex) { groupIndex = i + groupsColumn.length - 1; }

    compRange.groups[i].name = "Group " + String(groupIndex);
    newGroups.push(compRange.groups[i]);
  }

  for (var k = groupsColumn.length - 1; k >= 0; --k)
  {
    groupsColumn[k].name = "Group " + String(k + clusterIndex);
    newGroups.splice(clusterIndex, 0, groupsColumn[k]);
  }

  const dataName = column.data.desc.name;
  var compositeRange = ranges.composite(dataName + 'cluster', newGroups);

  var graph = column.stratomex.provGraph;
  var obj = graph.findObject(column);

  // regroup column
  graph.push(createRegroupColumnCmd(obj, compositeRange));

  // stop propagation to disable further event triggering
  d3.event.stopPropagation();
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// class definition

/**
 * Represents a detailed view of the current cluster / stratification.
 */
export class ClusterDetailView
{
  // views that support cluster assignments distance analysis
  public distanceView: boxSlider.BoxSlider = null;
  public externalViews: boxSlider.BoxSlider[] = [];

  // zooms of external vies
  public mainZoom: behaviors.ZoomLogic = null;
  public extZooms: behaviors.ZoomLogic[] = [];

  // nodes of view windows
  public $mainNode: d3.Selection<any> = null;
  public $extNodes: d3.Selection<any>[] = [];
  public $matrixNode: d3.Selection<any> = null;

  // column associated with this view
  public column: any = null;

  public matrixView: heatmap.HeatMap;
  public zoomMatrixView: behaviors.ZoomLogic;
  public $tooltipMatrix: d3.Selection<any>;

  public visible: boolean = true;
  public externVisible: boolean = false;

  public $toolbar: d3.Selection<any>;

  private distancesRange: [number, number];
  private numGroups: number;
  private labels: number[] = [];
  private updated: boolean = false;

  // -------------------------------------------------------------------------------------------------------------------

  constructor(public cluster: number, private data: datatypes.IDataType, private range: ranges.Range,
              private options: any)
  {
    this.options = C.mixin({
      matrixMode: false, matrixWidth: 140, statsWidth: 50, extOffset: 30, distanceMetric: 'euclidean' }, options);
  }

  // -------------------------------------------------------------------------------------------------------------------

  getWidth()
  {
    if (this.visible)
    {
      var width = this.options.statsWidth;

      if (this.matrixMode) { width += this.options.extOffset + this.options.matrixWidth; }
      else
      {
        if (this.externVisible) { width += this.options.extOffset + this.numGroups * this.options.statsWidth; }
      }

      return width;
    }
    else { return 0; }
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
        responses.push(ajax.send('/api/clustering/distances/' + this.options.distanceMetric + '/' + data.desc.id,
          request, 'post'));
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
    var response = ajax.send('/api/clustering/distances/' + this.options.distanceMetric + '/' + this.data.desc.id,
      request, 'post');
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
        var row = [String(i)];//, distances[i]];
        row[that.cluster + 1] = distances[i];
        for (var j = 0; j < externDistances.length; ++j)
        {
          const extDist = externDistances[j][i];
          row[externLabelIDs[j] + 1] = extDist;
        }

        rawDistMatrix.push(row);
      }
      // 2) parse matrix
      var distMatrix = parser.parseMatrix(rawDistMatrix);

      // build main node of the view
      const $elem = $parent.append('div').classed('stats', true).style('opacity', 0);
      $elem.classed('group', true).datum(rawDistMatrix);

      // create the toolbar of the detail view
      this.$toolbar = $elem.append('div').attr('class', 'gtoolbar');
      this.createToolbar(column);

      // build title and body of all subviews -> build skeleton
      $elem.append('div').attr('class', 'title').text('Distances');
      const $body = $elem.append('div').attr('class', 'body');
      that.$mainNode = $elem;

      // check if external distances are available
      if (externDistances != null)
      {
        for (var j = 0; j < numGroups; ++j)
        {
          const $elemNext = $parent.append('div').classed('stats', true).style('opacity', 0);
          $elemNext.classed('group', true);//.datum(rawDistMatrix);
          $elemNext.append('div').attr('class', 'title').text('Group ' + String(j));
          $elemNext.append('div').attr('class', 'body');
          that.$extNodes.push($elemNext);
        }
      }
      // create hidden group for matrix view
      that.$matrixNode = $parent.append('div').classed('stats', true).classed('hidden', true);
      that.$matrixNode.classed('group', true);//.datum(rawDistMatrix);
      that.$matrixNode.append('div').attr('class', 'title').text('All Distances');
      that.$matrixNode.append('div').attr('class', 'body');

      // update statistics view
      var allDistances = externDistances.slice();
      allDistances.splice(that.cluster, 0, distances);//[distances].concat(externDistances);
      console.log(allDistances);

      that.update(allDistances, labels, distMatrix);
      that.updated = false;

      // activate matrix handler
      d3.select(that.matrixView.node).on('click', that._onClickMatrix(rawDistMatrix, numGroups, labels, column));

      // update all dividers after mouse click
      $elem.on('mouseup', that._mouseOutHandler());
      // and color each extern distance box chart at the beginning
      that._mouseOutHandler()({});

      // remove waiting icon
      $('body').removeClass('waiting');
      // make first view visible
      that.$mainNode.transition().duration(columns.animationTime(within)).style('opacity', 1);

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
   * Create toolbar of cluster detail view.
   * @param column
     */
  private createToolbar(column: any)
  {
    const that = this;

    // first remove all old icons
    this.$toolbar.selectAll('i').remove();

    // then build new icons
    var icon = (this.matrixMode) ? 'fa fa-bar-chart' : 'fa fa-th';


    if (this.column)
    {
      this.$toolbar.append('i').attr('class', 'fa fa-chevron-circle-left').on('click', () =>
      {
        applyDivisions(that, that.cluster, column);
      });
    }

    this.$toolbar.append('i').attr('class', icon).on('click', () =>
    {
      var distHeatmap = that.matrixView;

      that.toggleMatrixMode();

      //d3.select(distHeatmap.node).classed('hidden', !that.matrixMode);
      that.$matrixNode.classed('hidden', !that.matrixMode);

      //d3.select(that.distanceView.node).classed('hidden', that.matrixMode);
      for (var j = 0; j < that.$extNodes.length; ++j)
      {
        that.$extNodes[j].classed('hidden', that.matrixMode);
      }

      column.setColumnWidth();
      column.stratomex.relayout();

      that.createToolbar(column);
    });

    if (!this.matrixMode)
    {
      // tool to divide current cluster and create new divisions / stratifications displayed in a new column
      this.$toolbar.append('i').attr('class', 'fa fa-share-alt').on('click', () => {
        column.showDivisions(that, that.cluster);

        C.resolveIn(400).then( () =>
        {
          that.createToolbar(column);
        });

        // stop propagation to disable further event triggering
        d3.event.stopPropagation();
      });
    }

    // tool to recluster current column
    this.$toolbar.append('i').attr('class', 'fa fa-refresh').on('click', () =>
    {
      column.regroupCluster(that.cluster);

      // stop propagation to disable further event triggering
      d3.event.stopPropagation();
    });

    if (!this.matrixMode)
    {
      // tool to show external distances
      this.$toolbar.append('i').attr('class', 'fa fa-expand').on('click', () =>
      {
        const numGroups = (<any>column.range.dims[0]).groups.length;

        that.externVisible = !that.externVisible;

        for (var j = 0; j < numGroups; ++j)
        {
          that.$extNodes[j].classed('hidden', !that.externVisible);
          that.$extNodes[j].transition().duration(columns.animationTime(-1)).style('opacity', that.externVisible ? 1 : 0);
        }

        column.setColumnWidth();
        column.stratomex.relayout();
      });
    }

    // close / hide statistics views
    this.$toolbar.append('i').attr('class', 'fa fa-close').on('click', () =>
    {
      var g = column.stratomex.provGraph;
      var s = g.findObject(<columns.Column>column);
      g.push(createToggleStatsCmd(s, that.cluster, false));
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
      //var extDividers = that.dividers.slice(1, that.dividers.length);
      var externalViews = that.externalViews.slice();
      externalViews.splice(that.cluster, 1);
      var distanceView = that.distanceView;//that.dividers[0];

      var divs = distanceView.getCurrentDivisions();
      externalViews.forEach((d: boxSlider.BoxSlider) => { d.setDivisions(divs); });
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

    //var IDs = Array.apply(null, Array(that.numGroups)).map( (_, i) => { return i; });
    //IDs.splice(that.cluster, 1);
    //IDs.splice(0, 0, that.cluster);

    if (mode == 'mousemove')
    {
      return function(_: any)
      {
        if (!that.matrixMode) { return; }

        var $target = $(event.target);
        if ($target.is('.title') || $target.is('.gtoolbar') || $target.is('.fa')) { return; }

        var mousePos = d3.mouse(that.$matrixNode.node());

        that.$tooltipMatrix.style('opacity', 0.75);
        that.$tooltipMatrix.style({ left: (mousePos[0] - 25) + 'px', top: (mousePos[1] - 20) + 'px' });

        const mousePosX = mousePos[0];
        const padding = 4;
        const columnWidth = (that.options.matrixWidth - padding) / that.numGroups;

        var index = -1;
        for (var pos = 0; pos <= mousePosX; pos += columnWidth) { index++; }

        if (index < 0 || index >= that.numGroups) { return; }
        that.$tooltipMatrix.html('Group ' + String(index));
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
  private _onClickMatrix(rawMatrix: any, numGroups: number, rawLabels: any[], column: any)
  {
    const that = this;

    return function()
    {
      that.matrixView.destroy();
      var mousePos = d3.mouse(that.$matrixNode.node());
      const mousePosX = mousePos[0];
      const padding = 4;
      var columnWidth = (that.options.matrixWidth - padding) / numGroups;

      var index = 0;
      for (var pos = 0; pos < mousePosX; pos += columnWidth) { index++; }
      console.log(index);

      // 1) sort matrix by selected column
      function sortMatrix(a, b)
      {
        return a[index] - b[index];
      }

      var sortedMatrix = rawMatrix.slice();

      // insert header again as latest implementation removes header after matrix creation
      var header = ['ID'];
      for (var j = 0; j < numGroups; ++j)
      {
        header.push(String(j));
      }
      sortedMatrix.sort(sortMatrix);
      sortedMatrix.splice(0, 0, header);

      var newDistMatrix = parser.parseMatrix(sortedMatrix);

      //var $body = that.$nodes[0].select('.body');

      // 2) resort corresponding group and its labels and redraw grid
      var oldGroups = (<any>that.range.dim(0)).groups;

      var newLabels = [];
      // copy old distances to new distances
      var newDistances = Array.apply(null, Array(numGroups)).map( (d,i) => { return []; });

      for (var j = 0; j < rawLabels.length; ++j)
      {
        var ID = parseInt(sortedMatrix[j][0]);
        newLabels.push(rawLabels[ID]);
        for (var i = 0; i < newDistances.length; ++i)
        {
          newDistances[i].push(sortedMatrix[j][i + 1]);
        }
      }

      var newRange = ranges.parse(newLabels);
      var newGroup = new ranges.Range1DGroup('Group ' + String(that.cluster), 'grey', newRange.dim(0));
      oldGroups.splice(that.cluster, 1, newGroup);

      const newCompositeRange = ranges.composite(oldGroups.name, oldGroups);

      that.update(newDistances, newLabels, newDistMatrix);
      d3.select(that.matrixView.node).on('click', that._onClickMatrix(rawMatrix, numGroups, rawLabels, column));

      that.$mainNode.on('mouseup', that._mouseOutHandler());
      that._mouseOutHandler()({});

      // 4) finally update the grid
      C.resolveIn(5).then( () =>
      {
        var graph = column.stratomex.provGraph;
        var obj = graph.findObject(column);

        // regroup column
        graph.push(createRegroupColumnCmd(obj, newCompositeRange, true));
      });
    };
  }

  // -------------------------------------------------------------------------------------------------------------------

  public removeColumn(column: any)
  {
    this.column = null;
    this.createToolbar(column);
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

  isUpdated()
  {
    var updated = this.updated;
    this.updated = false;
    return updated;
  }

  // -------------------------------------------------------------------------------------------------------------------

  getLabels()
  {
    return this.labels;
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
    this.labels = labels;

    const that = this;

    // create matix view heatmap
    var $matrixBody = this.$matrixNode.select('.body');

    this.matrixView = heatmap.create(distMatrix, <Element>$matrixBody.node(), { selectAble: false });
    this.zoomMatrixView = new behaviors.ZoomLogic(this.matrixView, null);
    this.$matrixNode.classed('hidden', true);
    //d3.select(this.matrixView.node).classed('hidden', true);

    if (this.$tooltipMatrix) { this.$tooltipMatrix.remove(); }
    this.$tooltipMatrix = $matrixBody.append('div').classed('tooltip', true)
      .style({ opacity: 0, position: 'absolute !important', left: 0, top: 0, color: 'black', width: '50px',
            padding: 0, margin: 0, 'text-align': 'center', 'border-radius': '4px', 'background': '#60AA85'});

    this.$matrixNode.on('mousemove', this._matrixMouseHandler('mousemove'));
    this.$matrixNode.on('mouseout', this._matrixMouseHandler('mouseout'));

    // create distanceView for current cluster
    var $mainBody = this.$mainNode.select('.body');

    if (this.distanceView) { d3.select(this.distanceView.node).remove(); }
    this.distanceView = <boxSlider.BoxSlider>boxSlider.createRaw(distances[this.cluster],
        <Element>this.$mainNode.node(), { range: this.distancesRange, numAvg: 1, numSlider: 2 });
    this.mainZoom = new behaviors.ZoomLogic(this.distanceView, null);
    this.distanceView.setLabels(labels);

    // create distanceViews for external distances
    for (var i = 0; i < distances.length; ++i)
    {
      if (i == this.cluster) { continue; }

      var extView = <boxSlider.BoxSlider>this.externalViews[i];
      if (extView) { d3.select(extView.node).remove(); }

      var $currentNode = this.$extNodes[i].select('.body');
      this.externalViews[i] = <boxSlider.BoxSlider>boxSlider.createRaw(distances[i], <Element>$currentNode.node(), {
        range: this.distancesRange, numAvg: 1, numSlider: 0 });
      this.extZooms[i] = new behaviors.ZoomLogic(this.externalViews[i], null);
      this.externalViews[i].setLabels(labels);
    }

    if (this.options.matrixMode)
    {
      //d3.select(this.distanceView.node).classed('hidden', true);

      C.resolveIn(5).then( () =>
      {
        that.$matrixNode.classed('hidden', false);
        //d3.select(that.matrixView.node).classed('hidden', false);
      });
    }

    this.updated = true;
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Show this detail view.
   * @param within
     */
  show(within=-1)
  {
    this.visible = true;
    this.$mainNode.classed('hidden', false);
    this.$mainNode.transition().duration(columns.animationTime(within)).style('opacity', 1);

    //d3.select(this.distanceView.node).classed('hidden', this.matrixMode);
    this.$matrixNode.classed('hidden', !this.matrixMode);

    if (this.$extNodes.length - 1 > 0 && this.externVisible)
    {
      for (var k = 0; k < this.$extNodes.length; ++k)
      {
        this.$extNodes[k].transition().duration(columns.animationTime(within)).style('opacity', 1);
        this.$extNodes[k].classed('hidden', this.matrixMode);
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
    this.$mainNode.transition().duration(columns.animationTime(within)).style('opacity', 0);
    this.$mainNode.classed('hidden', true);

    // hide matrix view
    this.$matrixNode.classed('hidden', true);

    if (this.$extNodes.length - 1 > 0)
    {
      for (var k = 0; k < this.$extNodes.length; ++k)
      {
        this.$extNodes[k].transition().duration(columns.animationTime(within)).style('opacity', 0);
        this.$extNodes[k].classed('hidden', true);
      }
    }
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export class ClusterProbView
{
  public $nodes: d3.Selection<any>[] = [];
  public boxCharts: boxSlider.BoxSlider[] = [];
  public zooms: behaviors.ZoomLogic[] = [];
  public column: any = null;
  private partitionMatrix: any[] = [];

  private labels: number[] = [];
  private numGroups: number = 0;
  private updated: boolean = false;

  public visible: boolean = true;
  public externVisible: boolean = false;

  // -------------------------------------------------------------------------------------------------------------------

  constructor(private cluster: number, private range: ranges.Range, _partitionMatrix: any,
              private options: any)
  {
    this.options = C.mixin({ probsWidth: 50, maxProb: 0.5 }, options);

    this.labels = (<any>this.range.dims[0]).groups[cluster].asList();
    this.numGroups = (<any>this.range.dims[0]).groups.length;

    var partitionMatrix = _partitionMatrix.slice();
    this.partitionMatrix = [];

    const maxProb = this.options.maxProb;

    // zip values and sort
    for (var j = 0; j < this.labels.length; ++j)
    {
      const labelID = this.labels[j];
      let labelProbs = partitionMatrix[labelID].slice();
      var prob = labelProbs.splice(cluster, 1)[0];
      labelProbs.splice(0, 0, prob);

      var numOccurs = 0;
      for (var i = 0; i < this.numGroups; ++i) { numOccurs += (labelProbs[i] >= maxProb) ? 1 : 0; }

      this.partitionMatrix.push({ id: this.labels[j], probs: labelProbs, occurs: numOccurs});
    }
  }

  // -------------------------------------------------------------------------------------------------------------------

  getWidth()
  {
    if (this.visible)
    {
      return (this.externVisible) ? (this.numGroups * this.options.probsWidth) : this.options.probsWidth;
    }
    else { return 0; }
  }

  // -------------------------------------------------------------------------------------------------------------------

  isUpdated()
  {
    var updated = this.updated;
    this.updated = false;
    return updated;
  }

  // -------------------------------------------------------------------------------------------------------------------

  getLabels()
  {
    return this.labels;
  }

  // -------------------------------------------------------------------------------------------------------------------

  public build($parent: d3.Selection<any>, column: any)
  {

    const clusterID = this.cluster;
    const numGroups = this.numGroups;

    var probs = Array.apply(null, Array(numGroups)).map( (_, i) => { return []; });

    // determine order of cluster IDs
    var IDs = Array.apply(null, Array(numGroups)).map( (_, i) => { return i; });
    IDs.splice(clusterID, 1);
    IDs.splice(0, 0, clusterID);

    var partitionMat = this.partitionMatrix.slice();

    var clusterProbs = [];
    var labels = [];
    var occurs = [];

    // unzip and write back
    for (var j = 0; j < this.labels.length; ++j)
    {
      var zip = partitionMat[j];
      labels.push(zip.id);
      clusterProbs.push(zip.probs);
      occurs.push(zip.occurs);
    }

    for (var j = 0; j < labels.length; ++j)
    {
      var labelProbs = clusterProbs[j];

      for (var i = 0; i < numGroups; ++i)
      {
        probs[i].push(labelProbs[i]);
      }
    }

    // build main nodes of the view
    for (var j = 0; j < numGroups; ++j)
    {
      const index = j;
      let probabilities = probs[index];

      const $elem = $parent.append('div').classed('stats', true).style('opacity', 0);
      $elem.classed('group', true).datum(probabilities);
      $elem.append('div').attr('class', 'title').text('Probs' + String(IDs[j]));
      $elem.append('div').attr('class', 'body');
      this.$nodes.push($elem);
    }

    this.update(probs, labels, occurs);
    this.updated = false;

    // create toolbar
    this.createToolbar(column);
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Create toolbar of cluster probability view.
   * @param column
     */
  private createToolbar(column: any)
  {
    const that = this;

    for (var j = 0; j < that.numGroups; ++j)
    {
      // remove old toolbar first
      this.$nodes[j].select('.gtoolbar').remove();

      // create the toolbar of the detail view
      var $gtoolbar = this.$nodes[j].append('div').attr('class', 'gtoolbar');

      function OnSortDesc(index, column)
      {
        return () =>
        {
          that.sortByClusterID(index, column);
        }
      }

      if (j == 0 && this.column != null)
      {
        $gtoolbar.append('i').attr('class', 'fa fa-chevron-circle-left').on('click', () =>
        {
          applyDivisions(that, that.cluster, column);
        });
      }

      $gtoolbar.append('i').attr('class', 'fa fa-sort-amount-desc').on('click', OnSortDesc(j, column));

      if (j == 0)
      {
        $gtoolbar.append('i').attr('class', 'fa fa-expand').on('click', () =>
        {
          that.externVisible = !that.externVisible;

          for (var i = 1; i < that.numGroups; ++i)
          {
            that.$nodes[i].classed('hidden', !that.externVisible);
            that.$nodes[i].style('opacity', 1);
          }

          column.setColumnWidth();
          column.stratomex.relayout();
        });

        $gtoolbar.append('i').attr('class', 'fa fa-share-alt').on('click', () =>
        {
          column.showDivisions(that, that.cluster);
          // recreate toolbar
          C.resolveIn(400).then(() =>
          {
            that.createToolbar(column);
          });
          // stop propagation to disable further event triggering
          d3.event.stopPropagation();
        });

        $gtoolbar.append('i').attr('class', 'fa fa-close').on('click', () =>
        {
          var g = column.stratomex.provGraph;
          var s = g.findObject(column);
          g.push(createToggleProbsCmd(s, that.cluster, false));
        });
      }
    }
  }


  // -------------------------------------------------------------------------------------------------------------------

  public sortByClusterID(index: number, column: any)
  {
    var partitionMat = this.partitionMatrix.slice();

    function sortProbs(a, b)
    {
      return b.probs[index] - a.probs[index];
    }

    partitionMat.sort(sortProbs);

    var clusterProbs = [];
    var labels = [];
    var occurs = [];

    // unzip and write back
    for (var j = 0; j < this.labels.length; ++j)
    {
      var zip = partitionMat[j];
      labels.push(zip.id);
      clusterProbs.push(zip.probs);
      occurs.push(zip.occurs);
    }

    var probs = Array.apply(null, Array(this.numGroups)).map( (_, i) => { return []; });

    for (var j = 0; j < labels.length; ++j)
    {
      var labelProbs = clusterProbs[j];

      for (var i = 0; i < this.numGroups; ++i)
      {
        probs[i].push(labelProbs[i]);
      }
    }

    this.update(probs, labels, occurs);

    var oldGroups = (<any>this.range.dim(0)).groups;
    var newRange = ranges.parse(labels);
    var newGroup = new ranges.Range1DGroup('Group ' + String(this.cluster), 'grey', newRange.dim(0));
    oldGroups.splice(this.cluster, 1, newGroup);

    const newCompositeRange = ranges.composite(oldGroups.name, oldGroups);

    var graph = column.stratomex.provGraph;
    var obj = graph.findObject(column);

    // regroup column
    graph.push(createRegroupColumnCmd(obj, newCompositeRange, true));
  }

  // -------------------------------------------------------------------------------------------------------------------

  public update(probabilities: any, labels: any, occurs: any)
  {
    this.labels = labels;
    var that = this;

    for (var i = 0; i < this.numGroups; ++i)
    {
      var $body = this.$nodes[i].select('.body');

      var oldBoxChart = this.boxCharts[i];
      if (oldBoxChart) { oldBoxChart.destroy(); }

      function colorBars(numOccurs)
      {
        var cScale = d3.scale.linear().domain([0,1]).range(<any>['#449944', '#bbbb22']);

        return function(d: any, i: number)
        {
          return cScale(numOccurs[i] > 1 ? 1 : 0);
        }
      }

      var boxChart = <boxSlider.BoxSlider>boxSlider.createRaw(probabilities[i], <Element>$body.node(), {
        range: [0.0, 1.0], numAvg: 1, numSlider: (i == 0) ? 1 : 0, precision: 4, valueName: 'Prob.',
        colorFunction: colorBars(occurs)});
      boxChart.setLabels(labels);

      this.boxCharts[i] = boxChart;
      this.zooms[i] = new behaviors.ZoomLogic(boxChart, null);

      if (i == 0) { this.$nodes[i].classed('hidden', !this.visible); }
      else { this.$nodes[i].classed('hidden', !this.externVisible); }
      this.$nodes[i].transition().duration(columns.animationTime(-1)).style('opacity', 1);
    }

    this.updated = true;
  }

  // -------------------------------------------------------------------------------------------------------------------

  public removeColumn(column: any)
  {
    this.column = null;
    this.createToolbar(column);
  }

  // -------------------------------------------------------------------------------------------------------------------

  public show(within)
  {
    this.visible = true;

    for (var i = 0; i < this.numGroups; ++i)
    {
      if (i == 0) { this.$nodes[i].classed('hidden', !this.visible); }
      else { this.$nodes[i].classed('hidden', !this.externVisible); }
    }
  }

  // -------------------------------------------------------------------------------------------------------------------

  public hide(within)
  {
    this.visible = false;

    for (var i = 0; i < this.numGroups; ++i)
    {
      this.$nodes[i].classed('hidden', true);
    }
  }
}
