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
import clusterView = require('./ClusterDetailView');
import boxSlider = require('./boxslider');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function createCmd(id:string)
{
  switch (id)
  {
    case 'createStratomeXClusterColumn':
      return createClusterColumn;
    case 'createStratomeXHierarchicalClusterColumn':
      return createHierarchicalClusterColumn;
    case 'showStratomeXStats' :
      return showStats;
    case 'showStratomeXProbs' :
      return clusterView.showProbs;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------

function createClusterColumn(inputs, parameter, graph, within)
{
  var stratomex = inputs[0].value,
    partitioning = ranges.parse(parameter.partitioning),
    index = parameter.hasOwnProperty('index') ? parameter.index : -1,
    name = parameter.name || inputs[1].name;

  //console.log(ranges.parse(parameter.partitioning));

  return inputs[1].v.then(function (data)
  {
    //console.log(new Date(), 'create column', data.desc.name, index);
    var c = new ClusterColumn(stratomex, data, partitioning, inputs[1], {
      width: (data.desc.type === 'stratification') ? 60 : (data.desc.name.toLowerCase().indexOf('death') >= 0 ? 110 : 160),
      name: name
    }, within);
    var r = prov.ref(c, c.name, prov.cat.visual, c.hashString);
    c.changeHandler = function (event, to, from)
    {
      if (from)
      { //have a previous one so not the default
        graph.push(columns.createChangeVis(r, to.id, from ? from.id : null));
      }
    };
    c.optionHandler = function (event, name, value, bak)
    {
      graph.push(columns.createSetOption(r, name, value, bak));
    };
    c.on('changed', c.changeHandler);
    c.on('option', c.optionHandler);

    //console.log(new Date(), 'add column', data.desc.name, index);
    return stratomex.addColumn(c, index, within).then(() =>
    {
      //console.log(new Date(), 'added column', data.desc.name, index);
      return {
        created: [r],
        inverse: (inputs, created) => columns.createRemoveCmd(inputs[0], created[0]),
        consumed: within
      };
    });
  });
}

// ---------------------------------------------------------------------------------------------------------------------

function createHierarchicalClusterColumn(inputs, parameter, graph, within)
{
  var stratomex = inputs[0].value,
    partitioning = ranges.parse(parameter.partitioning),
    index = parameter.hasOwnProperty('index') ? parameter.index : -1,
    name = parameter.name || inputs[1].name,
    dendrogram = inputs[2].value.tree;

  return inputs[1].v.then(function (data)
  {
    //console.log(new Date(), 'create column', data.desc.name, index);
    var c = new HierarchicalClusterColumn(stratomex, data, partitioning, dendrogram, inputs[1], {
      width: (data.desc.type === 'stratification') ? 60 : (data.desc.name.toLowerCase().indexOf('death') >= 0 ? 110 : 160),
      name: name
    }, within);
    var r = prov.ref(c, c.name, prov.cat.visual, c.hashString);
    c.changeHandler = function (event, to, from)
    {
      if (from)
      { //have a previous one so not the default
        graph.push(columns.createChangeVis(r, to.id, from ? from.id : null));
      }
    };
    c.optionHandler = function (event, name, value, bak)
    {
      graph.push(columns.createSetOption(r, name, value, bak));
    };
    c.on('changed', c.changeHandler);
    c.on('option', c.optionHandler);

    //console.log(new Date(), 'add column', data.desc.name, index);
    return stratomex.addColumn(c, index, within).then(() =>
    {
      //console.log(new Date(), 'added column', data.desc.name, index);
      return {
        created: [r],
        inverse: (inputs, created) => columns.createRemoveCmd(inputs[0], created[0]),
        consumed: within
      };
    });
  });
}

// ---------------------------------------------------------------------------------------------------------------------

function createFuzzyClusterColumn(inputs, parameter, graph, within)
{
  var stratomex = inputs[0].value,
    partitioning = ranges.parse(parameter.partitioning),
    index = parameter.hasOwnProperty('index') ? parameter.index : -1,
    name = parameter.name || inputs[1].name,
    partitionMatrix = inputs[2].value.partition;

  return inputs[1].v.then(function (data)
  {
    //console.log(new Date(), 'create column', data.desc.name, index);
    var c = new FuzzyClusterColumn(stratomex, data, partitioning, partitionMatrix, inputs[1], {
      width: (data.desc.type === 'stratification') ? 60 : (data.desc.name.toLowerCase().indexOf('death') >= 0 ? 110 : 160),
      name: name
    }, within);
    var r = prov.ref(c, c.name, prov.cat.visual, c.hashString);
    c.changeHandler = function (event, to, from)
    {
      if (from)
      { //have a previous one so not the default
        graph.push(columns.createChangeVis(r, to.id, from ? from.id : null));
      }
    };
    c.optionHandler = function (event, name, value, bak)
    {
      graph.push(columns.createSetOption(r, name, value, bak));
    };
    c.on('changed', c.changeHandler);
    c.on('option', c.optionHandler);

    //console.log(new Date(), 'add column', data.desc.name, index);
    return stratomex.addColumn(c, index, within).then(() =>
    {
      //console.log(new Date(), 'added column', data.desc.name, index);
      return {
        created: [r],
        inverse: (inputs, created) => columns.createRemoveCmd(inputs[0], created[0]),
        consumed: within
      };
    });
  });
}

// ---------------------------------------------------------------------------------------------------------------------

export function createClusterColumnCmd(stratomex, data, partitioning, name:string, index:number = -1)
{
  return prov.action(prov.meta(name, prov.cat.data, prov.op.create),
    'createStratomeXClusterColumn', createClusterColumn, [stratomex, data], {
    partitioning: partitioning.toString(),
    name: name,
    index: index
  });
}

// ---------------------------------------------------------------------------------------------------------------------

export function createHierarchicalClusterColumnCmd(stratomex, data, partitioning, dendrogram, name:string, index:number = -1)
{
  return prov.action(prov.meta(name, prov.cat.data, prov.op.create),
    'createStratomeXHierarchicalClusterColumn', createHierarchicalClusterColumn, [stratomex, data, dendrogram], {
    partitioning: partitioning.toString(),
    name: name,
    index: index
  });
}

// ---------------------------------------------------------------------------------------------------------------------

export function createFuzzyClusterColumnCmd(stratomex, data, partitioning, partitionMatrix, name:string, index:number = -1)
{
  return prov.action(prov.meta(name, prov.cat.data, prov.op.create),
    'createStratomeXHierarchicalClusterColumn', createFuzzyClusterColumn, [stratomex, data, partitionMatrix], {
    partitioning: partitioning.toString(),
    name: name,
    index: index
  });
}


// ---------------------------------------------------------------------------------------------------------------------

function showStats(inputs, parameter, graph, within)
{
  var column: ClusterColumn = inputs[0].value;
  var cluster = parameter.cluster;
  var show = parameter.action === 'show';

  var r: Promise<any>;
  if (show)
  {
    r = column.showStats(cluster, within);
  } else
  {
    r = column.hideStats(cluster, within);
  }
  return r.then(() =>
  {
    return {
      inverse: createToggleStatsCmd(inputs[0], cluster, !show),
      consumed: within
    };
  });
}

// ---------------------------------------------------------------------------------------------------------------------

export function createToggleStatsCmd(column, cluster, show)
{
  var act = show ? 'Show' : 'Hide';
  return prov.action(prov.meta(act + ' Distances of ' + column.toString() + ' Cluster "' + cluster + '"', prov.cat.layout),
    'showStratomeXStats', showStats, [column], {
      cluster: cluster,
      action: show ? 'show' : 'hide'
    });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// class definition

/**
 * Represents a column created by any cluster algorithm. Provides tools to analyze clusters / stratifications within
 * that column.
 */
export class ClusterColumn extends columns.Column implements idtypes.IHasUniqueId, link_m.IDataVis
{
  protected options = {
    summaryHeight: 90,
    width: 160,
    detailWidth: 500,
    statsWidth: 50, // this is the default width for the distance view TODO: rename to distanceWidth
    matrixWidth: 140,
    padding: 2,
    name: null
  };

  protected statsViews: clusterView.ClusterDetailView[] = []; // array of all distance views for this column TODO: rename to distanceViews
  protected activeDivision: ClusterColumn[] = []; // TODO!: check if we still need the tracking of active divisions
  protected distancesRange: [number, number] = null;

  constructor(protected stratomex, public data, partitioning:ranges.Range, public dataRef, options:any = {}, within = -1)
  {
    super(stratomex, data, partitioning, dataRef, options, within);

    this.on('relayouted', this.relayoutAfterHandler);
  }

  /**
   * Create the toolbar of the column.
   */
  createToolBar()
  {
    const that = this;
    var $t = this.$toolbar;

    super.createToolBar();

    $t.insert('i', '.fa-close').attr('class', 'fa fa-bars').on('click', () =>
    {
      const dataID = this.data.desc.id;
      const dataDiffID = dataID.replace('Mean', 'Difference');

      //var response = ajax.getAPIJSON('/dataset/' + dataDiffID);
      datas.list().then( (list) =>
      {
        for (var i = 0; i < list.length; ++i)
        {
          var data = list[i];
          if (data.desc.id == dataDiffID)
          {
            that.stratomex.addColumnWithRange(data, that.range.dim(0));
          }
        }
      });
    });
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Update this column by means of a new stratification (compositeRange).
   * @param range
   * @param noStatsUpdate
   * @returns {Promise<TResult>|Promise<U>}
     */
  updateGrid(range: ranges.CompositeRange1D, noStatsUpdate=false)
  {
    //d3.select(this.node).transition().duration(animationTime(-1)).style('opacity', 0);
    d3.select(this.grid.node).transition().duration(columns.animationTime(-1)).style('opacity', 0);
    this.grid.destroy();

    var that = this;

    const numStatsViews = that.statsViews.length;
    var compositeRange = <ranges.CompositeRange1D>that.range.dim(0);
    that.range = ranges.parse(range.toString());

    const oldNumGroups = range.groups.length;
    const newNumGroups = compositeRange.groups.length;
    const groupsChanged = (newNumGroups != oldNumGroups);

    // reset layout of column
    that.setColumnWidth(!noStatsUpdate);

    var promise = that.stratomex.relayout();

    // recreate grid and fire changed option
    that.createMultiGrid(that.range, that.data);

    return promise.then((_: any) =>
    {
      var promises: any[] = [];
      // destroy current stats views

      for (var i = 0; i < numStatsViews; ++i)
      {
        // do not update if showStats has been invoked before
        if (noStatsUpdate) { break; }

        var statsView = that.statsViews[i];
        that.statsViews[i] = null;
        if (statsView != null)
        {
          statsView.dividers[0].destroy();
          statsView.$nodes[0].remove();

          if (statsView.$nodes.length - 1 > 0)
          {
            for (var k = 1; k < statsView.$nodes.length; ++k)
            {
              statsView.dividers[k].destroy();
              statsView.$nodes[k].remove();
            }
          }

          if (groupsChanged) { that.distancesRange = null; }

          if (statsView.visible && !groupsChanged)
          {
            promises.push(that.showStats(i, -1, false));
          }
        }
      }

      // update grid after all views are recreated
      return Promise.all(promises).then((_) =>
      {
        that.statsViews.forEach( (d: clusterView.ClusterDetailView) => { if (d && d.visible) { d.show(-1); } });

        return that.stratomex.relayout();
      });
    });
  }

  // -------------------------------------------------------------------------------------------------------------------

  protected createGridToolbar(elem, data, cluster, pos, $toolbar: d3.Selection<any>)
  {
    const that = this;

    // add new command with symbol fa-expand
    $toolbar.append('i').attr('class', 'fa fa-expand').on('click', () =>
    {
      // first obtain the provenance graph
      var graph = that.stratomex.provGraph;
      // next find the current object / selection / cluster
      var obj = graph.findObject(that);
      // push new command to graph
      graph.push(columns.createToggleDetailCmd(obj, pos[0], true));
      // stop propagation to disable further event triggering
      d3.event.stopPropagation();
    });

    // create new cluster stats command
    $toolbar.append('i').attr('class', 'fa fa-sort-amount-asc').on('click', () =>
    {
      // first obtain the provenance graph
      var graph = that.stratomex.provGraph;
      // next find the current object / selection / cluster
      var obj = graph.findObject(that);
      // push new command to graph
      graph.push(createToggleStatsCmd(obj, pos[0], true));
      // stop propagation to disable further event triggering
      d3.event.stopPropagation();
    });

    // re-cluster column command
    $toolbar.append('i').attr('class', 'fa fa-refresh').on('click', () =>
    {
      var clusterIndex = pos[0];

      var statsView = that.statsViews[clusterIndex];
      if (statsView == null) { return; }

      var rangeColumn = <ranges.CompositeRange1D>statsView.column.getRange().dim(0);
      var groupsColumn = rangeColumn.groups;
      var newGroups = [];

      var compRange = <ranges.CompositeRange1D>that.range.dim(0);

      for (var i = 0; i < compRange.groups.length; ++i)
      {
        if (i == clusterIndex) { continue; }
        var groupIndex = i;
        if (i > clusterIndex) { groupIndex = i + groupsColumn.length - 1; }

        compRange.groups[i].name = "Group " + String(groupIndex) + '(Custom)';
        newGroups.push(compRange.groups[i]);
      }

      for (var k = groupsColumn.length - 1; k >= 0; --k)
      {
        groupsColumn[k].name = "Group " + String(k + clusterIndex) + '(Custom)';
        newGroups.splice(clusterIndex, 0, groupsColumn[k]);
      }

      const dataName = that.data.desc.name;
      var compositeRange = ranges.composite(dataName + 'cluster', newGroups);

      that.updateGrid(compositeRange);

      // stop propagation to disable further event triggering
      d3.event.stopPropagation();
    });
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Defines building process of multigrid.
   * @param partitioning
   * @returns {function(any, any, any, any): EventTarget}
     */
  protected multiGridWrapper(partitioning)
  {
    var that = this;
    this.range = partitioning;

    var createWrapper = function(elem, data, cluster, pos)
    {
      // select element of current multigrid
      const $elem = d3.select(elem);
      // set to group classed
      $elem.classed('group', true).datum(data);
      // create new toolbar
      var $toolbar = $elem.append('div').attr('class', 'gtoolbar');
      that.createGridToolbar(elem, data, cluster, pos, $toolbar);

      const toggleSelection = () =>
      {
        var isSelected = $elem.classed('select-selected');
        if (isSelected)
        {
          data.select(0, ranges.none());
        }
        else
        {
          data.select(0, ranges.all());
        }
        $elem.classed('select-selected', !isSelected);
      };

      $elem.append('div').attr('class', 'title').style('max-width', (that.options.width - that.options.padding * 2) + 'px')
        .text(cluster.dim(0).name).on('click', toggleSelection);
      $elem.append('div').attr('class', 'body').on('click', toggleSelection);

      const ratio = cluster.dim(0).length / that.range.dim(0).length;
      $elem.append('div').attr('class', 'footer').append('div').style('width', Math.round(ratio * 100) + '%');
      return $elem.select('div.body').node();

    };

    return createWrapper;
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Resize detail view.
   * @param within
   * @param hide
   * @returns {Promise<void>}
     */
  protected resizeDetail(within, hide=false)
  {
    this.setColumnWidth();
    return this.stratomex.relayout(within);
  }

  // -------------------------------------------------------------------------------------------------------------------

  protected determineColumnWidth(reset=false)
  {
    var layoutWidth = this.options.width;
    if (this.detail) { layoutWidth += this.options.detailWidth; }

    var numVisibleGroups = 0;
    var matrixWidth = 0;
    const numGroups = (<any>this.range.dims[0]).groups.length;

    if (this.statsViews.some( (d : any) => { if (d == null) { return false; } return !d.matrixMode && d.visible; } ))
    {
      numVisibleGroups = 1;

      if (this.statsViews.some( (d: any) =>
        { if (d == null) { return false; } return !d.matrixMode && d.visible && d.externVisible; } ))
      {
        numVisibleGroups = numGroups;
      }
    }

    if (this.statsViews.some( (d : any) => { if (d == null) { return false; } return d.matrixMode && d.visible; } ))
    {
      matrixWidth = this.options.matrixWidth;
    }

    layoutWidth += Math.max(this.options.statsWidth * numVisibleGroups, matrixWidth);

    if (reset)
    {
      layoutWidth = this.options.width;
    }

    return layoutWidth;
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Update width of this column for relayouting.
   * @param reset
     */
  protected setColumnWidth(reset=false)
  {
    const layoutWidth = this.determineColumnWidth(reset);

    this.$parent.style('width', layoutWidth + 'px');
    this.$layoutHelper.style('width', layoutWidth + 'px');
  }

  // -------------------------------------------------------------------------------------------------------------------

  private createClusterDetailToolbar(cluster: number, $toolbar: d3.Selection<any>, matrixMode: boolean, within)
  {
    const that = this;

    // first remove all old icons
    $toolbar.selectAll('i').remove();

    // then build new icons
    var icon = (matrixMode) ? 'fa fa-bar-chart' : 'fa fa-th';

    $toolbar.append('i').attr('class', icon).on('click', () =>
    {
      var statsView = that.statsViews[cluster];
      var distHeatmap = statsView.matrix;

      statsView.toggleMatrixMode();

      d3.select(distHeatmap.node).classed('hidden', !statsView.matrixMode);

      d3.select(statsView.dividers[0].node).classed('hidden', statsView.matrixMode);
      for (var j = 1; j < statsView.$nodes.length; ++j)
      {
        statsView.$nodes[j].classed('hidden', statsView.matrixMode);
      }

      that.setColumnWidth();

      that.stratomex.relayout();

      that.createClusterDetailToolbar(cluster, $toolbar, statsView.matrixMode, within);
    });

    if (!matrixMode)
    {

      // tool to divide current cluster and create new divisions / stratifications displayed in a new column
      $toolbar.append('i').attr('class', 'fa fa-share-alt').on('click', () => {
        that.showDivisions(cluster);
        // stop propagation to disable further event triggering
        d3.event.stopPropagation();
      });
    }

    // tool to recluster current column
    $toolbar.append('i').attr('class', 'fa fa-refresh').on('click', () =>
    {
      that.regroupCluster(cluster);

      // stop propagation to disable further event triggering
      d3.event.stopPropagation();
    });

    if (!matrixMode)
    {
      // tool to show external distances
      $toolbar.append('i').attr('class', 'fa fa-expand').on('click', () =>
      {
        var statsView = that.statsViews[cluster];
        const numGroups = (<any>that.range.dims[0]).groups.length;

        statsView.externVisible = !statsView.externVisible;

        for (var j = 1; j < numGroups; ++j)
        {
          var externNode = statsView.$nodes[j];
          if (statsView.externVisible)
          {
            externNode.classed('hidden', false);
            externNode.transition().duration(columns.animationTime(within)).style('opacity', 1);
          }
          else
          {
            externNode.classed('hidden', true);
            externNode.transition().duration(columns.animationTime(within)).style('opacity', 0);
          }
        }

        that.setColumnWidth();

        that.stratomex.relayout();
      });
    }

    // close / hide statistics views
    $toolbar.append('i').attr('class', 'fa fa-close').on('click', () =>
    {
      var g = that.stratomex.provGraph;
      var s = g.findObject(that);
      g.push(createToggleStatsCmd(s, cluster, false));
    });
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Show detailed cluster view for certain stratification.
   * @param cluster
   * @param within
   * @param relayout
   * @returns {any}
     */
  showStats(cluster, within = -1, relayout = true)
  {
    var statsView = this.statsViews[cluster];

    if (statsView != null)
    {
      statsView.show(within);

      this.setColumnWidth();
      return (relayout) ? this.stratomex.relayout(within) : Promise.resolve([]);
    }

    const that = this;

    var newStatsView: clusterView.ClusterDetailView = new clusterView.ClusterDetailView(cluster, this.data, this.range,
      { matrixWidth: this.options.matrixWidth });
    var promise = newStatsView.build(this.$parent, this);

    this.statsViews[cluster] = newStatsView;

    that.setColumnWidth();

    return promise.then( (args) =>
    {
      that.createClusterDetailToolbar(cluster, newStatsView.$toolbar, false, within);
      if (!relayout) { newStatsView.$nodes.forEach((d: d3.Selection<any>) => {d.classed('hidden', true); }); }
      const compositeRange = args[0];
      return (relayout) ? that.updateGrid(compositeRange, true) : Promise.resolve([]);
    });
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Hide cluster detail view.
   * @param cluster
   * @param within
   * @returns {Promise<void>}
     */
  hideStats(cluster, within)
  {
    var statsView = this.statsViews[cluster];
    statsView.hide(within);

    this.setColumnWidth();
    return this.stratomex.relayout(within);
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Divides current stratification into three groups and creates new column.
   * @param cluster
   * @param column
   * @returns {Promise<Array>}
     */
  showDivisions(cluster, column : ClusterColumn = null)
  {
    //const subData = (cluster < 0) ? this.data : this.grid.getData(cluster);
    const data = this.data;
    const dataName = data.desc.name;
    const dataFQ = data.desc.fqname;
    const dataID = data.desc.id;

    var statsView = this.statsViews[cluster];

    if (statsView == null)
    {
      return Promise.resolve([]);
    }

    var index = this.activeDivision.indexOf(statsView.column);
    if (index != -1 && column == null)
    {
      return Promise.resolve([]);
    }

    var divider = statsView.dividers[0];
    var that = this;

    if (cluster >= 0)
    {
      var dataClusters = <ranges.CompositeRange1D>this.range.dim(0);
      var clusterName = dataClusters.groups[cluster].name;
      var numClusters = dataClusters.groups.length;

      var rStart = clusterName.search(/\(/);
      var rEnd = clusterName.search(/\)/);

      var groupName = (rStart == -1) ? clusterName : clusterName.slice(0, rStart);
      var method = clusterName.slice(rStart, rEnd);

      // obtain sub-ranges from cluster divider, either real labels or ranges (min:max) if there's no column
      var subRanges = divider.getDivisionRanges(column == null);

      // create new range groups
      var rangeGroups = [];
      var groups = [];
      var groupsDesc = [];
      var stratiSize = 0;
      for (var i = 0; i < 3; ++i)
      {
        var groupSize = subRanges[i].length;
        stratiSize += groupSize;

        rangeGroups.push(ranges.parse(subRanges[i]));
        groups.push(new ranges.Range1DGroup(groupName + ' Div ' + String(i),
          'grey', rangeGroups[i].dim(0)));

        groupsDesc.push({ name: 'Division ' + String(i), size: groupSize});
      }

      var compositeRange = ranges.composite(dataName + 'divisions', groups);

      // create a new stratification description
      var descStrati =
      {
        id: dataID + method + String(numClusters) + 'Division' + String(cluster),
        fqname: 'none', name: dataName + '/' + method + '_' + String(numClusters) + '_Division_' + String(cluster),
        origin: dataFQ, size: stratiSize, ngroups: 3, type: 'stratification', groups: groupsDesc,
        idtype: 'patient',
        ws: 'random' // TODO: figure out what this parameter is
      };

      Promise.all([(<any>data).rows(), (<any>data).rowIds()]).then((args) =>
      {
        // obtain the rows and rowIDs of the data
        var rows = args[0];
        var rowIds = args[1];

        var rowLabels = rowIds.dim(0).asList();
        var labels = dataClusters.groups[cluster].asList();

        // create a new startification of the data
        var strati : stratification.IStratification;

        if (column == null)
        {
          // It is important to rearrange the rows and rowIds since we create a new column since matrix is resolved
          // by means of these ids (rowMatrix.fromIds()), otherwise clusters are not displayed correctly
          var newRows = [];
          var newRowIds = [];

          for (var j = 0; j < labels.length; ++j)
          {
            newRows.push(rows[labels[j]]);
            newRowIds.push(rowLabels[labels[j]]);
          }

          // create the new stratification and add the column to StratomeX
          strati = stratification_impl.wrap(<datatypes.IDataDescription>descStrati, newRows, newRowIds, <any>compositeRange);
          that.stratomex.addClusterData(strati, data, null);
          that.connectSignal = { cluster: cluster };

        } else {
          //strati = stratification_impl.wrap(<datatypes.IDataDescription>descStrati, rows, rowIds, <any>compositeRange);
          column.updateGrid(compositeRange);
        }
      });
    }
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Regroups all the stratifications of this column by analyzing distances of patients to each cluster centroid.
   * @param cluster
   * @returns {Promise<Array>}
     */
  protected regroupCluster(cluster: number)
  {
    var statsView = this.statsViews[cluster];
    var that = this;

    if (statsView == null)
    {
      return Promise.resolve([]);
    }

    const clusterLabels = statsView.dividers[0].getLabels();

    var distanceVec: any[] = [];

    for (var j = 1; j < statsView.dividers.length; ++j)
    {
      distanceVec.push(statsView.dividers[j].data);
    }

    // insert cluster into distance vectors
    distanceVec.splice(cluster, 0, statsView.dividers[0].data);

    var compositeRange = <ranges.CompositeRange1D>this.range.dim(0);
    const numGroups = compositeRange.groups.length;
    //compositeRange.groups.splice(cluster, 1);

    var newLabels: any[] = Array.apply(null, Array(numGroups)).map((_, i) => { return []; });

    for (var i = 0; i < distanceVec[0].length; ++i)
    {
      var tempArray = [];

      for (var k = 0; k < distanceVec.length; ++k)
      {
        tempArray.push(distanceVec[k][i]);
      }

      var minDist = Math.min.apply(Math, tempArray);
      var minIndex = tempArray.indexOf(minDist);

      newLabels[minIndex].push(clusterLabels[i]);
    }

    for (var i = 0; i < numGroups; ++i)
    {
      if (i != cluster)
      {
        // create new group
        var labels = compositeRange.groups[i].asList();
        newLabels[i] = labels.concat(newLabels[i]);
      }
    }

    // first from groups
    var groups = <any>[];
    var groupsDesc = <any>[];
    var clusterRanges = <any>[];

    for (var i = 0; i < numGroups; ++i)
    {
      clusterRanges.push(ranges.parse(newLabels[i]));
      groups.push(new ranges.Range1DGroup('Group ' + String(i),
        'red', clusterRanges[i].dim(0)));
      groupsDesc.push({name: String(i), size: newLabels[i].length});
    }

    const dataName = this.data.desc.name;

    var compositeRange = ranges.composite(dataName + 'cluster', groups);

    // update this column
    this.updateGrid(compositeRange);
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Relayout column.
   * @param within
     */
  layouted(within = -1)
  {
    super.layouted(within);
  }

  // -------------------------------------------------------------------------------------------------------------------

  protected resizeColumn(size: any, within=-1)
  {
    // Resize if statistics are shown
    const numGroups = (<any>this.range.dims[0]).groups.length;

    var numVisibleGroups = 0;
    var matrixWidth = 0;

    if (this.statsViews.some((d:any) =>
      {
        if (d == null) { return false; }
        return !d.matrixMode && d.visible;
      }))
    {
      numVisibleGroups = 1;

      if (this.statsViews.some((d:any) =>
        {
          if (d == null) { return false; }
          return !d.matrixMode && d.visible && d.externVisible;
        }))
      {
        numVisibleGroups = numGroups;
      }
    }

    if (this.statsViews.some((d:any) =>
      {
        if (d == null) { return false; }
        return d.matrixMode && d.visible;
      }))
    {
      matrixWidth = this.options.matrixWidth;
    }

    size.x -= Math.max(this.options.statsWidth * numVisibleGroups, matrixWidth);

    // check if any column was removed and update active divisions
    for (var j = 0; j < numGroups; ++j)
    {
      var statsView = this.statsViews[j];
      if (statsView == null)
      {
        continue;
      }

      if (statsView.column != null)
      {
        if (statsView.column.destroyed)
        {
          var index = this.activeDivision.indexOf(statsView.column);
          statsView.column = null;
          this.activeDivision.splice(index, 1);
        }
      }
    }
  }

  // -------------------------------------------------------------------------------------------------------------------

  protected onActionLoader(size: any)
  {
    const that = this;
    const numGroups = (<any>this.range.dims[0]).groups.length;

    // go through all stats view and determine their position
    // resize cluster windows since their height should correspond to the heatmap height
    for (var j = 0; j < numGroups; ++j)
    {
      var statsView = this.statsViews[j];

      if (statsView == null) { continue; }
      if (statsView.visible == true)
      {

        var clusterGrid = $(this.$parent.node()).find('div.gridrow')[j];
        var clusterPosY = $(clusterGrid).position().top;
        var clusterHeight = $(clusterGrid).height() - 10;
        var boxChartHeight = $(clusterGrid).height() - 18 - 10 - 2 * this.options.padding;

        if (!statsView.$nodes[0]) { continue; }

        statsView.$nodes[0].style(
          {
            width: ((statsView.matrixMode) ? this.options.matrixWidth : this.options.statsWidth) + 'px',
            height: clusterHeight + 'px', // TODO Hack for matrix bug!
            top: clusterPosY + 'px',
            left: (size.x + this.options.padding * 2) + 'px'
          });

        if (statsView.matrixMode)
        {
            statsView.zoomMatrix.zoomTo(this.options.matrixWidth - this.options.padding * 2, boxChartHeight);
        }
        else
        {
          statsView.zooms[0].zoomTo(this.options.statsWidth - this.options.padding * 2, boxChartHeight);

          if (statsView.externVisible)
          {
            for (var k = 1; k < statsView.$nodes.length; ++k)
            {
              statsView.zooms[k].zoomTo(this.options.statsWidth - this.options.padding * 2, boxChartHeight);
              statsView.$nodes[k].style({
                width: this.options.statsWidth + 'px',
                height: clusterHeight + 'px',
                top: clusterPosY + 'px',
                left: (size.x + this.options.padding * 2 + this.options.statsWidth * (k)) + 'px'
              });
            }
          }
        }

        if (this.connectSignal != null && this.connectSignal.cluster == j) {

          function refreshColumn(cluster, column: ClusterColumn) {
            var statsView = that.statsViews[cluster];

            if (column == null) { return; }
            if (statsView.dividers[0].hasChanged())
            {
              that.showDivisions(cluster, column);
            }
          }

          function onClickSlider(cluster, column) {
            return function (d) {
              return refreshColumn(cluster, column);
            }
          }

          var newColumn = this.stratomex.getLastColumn();
          statsView.column = newColumn;

          d3.select((<boxSlider.BoxSlider>statsView.dividers[0]).node)
            .on('mouseup', onClickSlider(j, newColumn));

          this.connectSignal = null;

          this.activeDivision.push(newColumn);
        }
      }
    }
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Kind of hack to handle coloring of bands (column to divisions) after the relayout process.
   * @param event
     */
  relayoutAfterHandler(event)
  {
    var that = event.target;

    const numGroups = (<any>that.range.dims[0]).groups.length;
    if (that.statsViews.length == 0) { return; }

    for (var j = 0; j < numGroups; ++j)
    {
      var statsView = that.statsViews[j];

      if (statsView == null) { continue; }
      if (statsView.visible == true)
      {
        Promise.resolve(statsView).then( (stats: any) =>
        {
          // 500ms is chosen as it takes time to switch column IDs
          C.resolveIn(500).then( () =>
          {
            if (stats.column == null) { return; }

            //var linkSVG = d3.select('.link-container svg');

            var colID = that.id;
            var nextID = stats.column.id;

            var minID = Math.min(colID, nextID);
            var maxID = Math.max(colID, nextID);
            //console.log('column:',minID, maxID);

            if (Math.abs(colID - nextID) != 1) { return; }

            // get current links between column minID and maxID and look for the bands
            var idRequest = "g[data-id=\"" + String(minID) + '-' + String(maxID) +  "\"]";
            //var bandsGroup = linkSVG.selectAll(idRequest);
            var bandsGroup = d3.select($(idRequest).get(0));
            //console.log(bandsGroup);
            var bands = bandsGroup.selectAll('.rel-group');

            if (bands.length < 1) {
              //console.log('no bands found --> restarting again');
              that.fire('relayouted');
              return;
            }

            var divBands = bands[0];

            if (divBands.length != 3)
            {
              //console.log('three bands not found --> restarting again');
              that.fire('relayouted');
              return;
            }

            // sort bands by means of their y-position
            divBands.sort( (l: any, r: any) => { return $(l).position().top - $(r).position().top; });

            d3.select(divBands[0]).style('fill', 'darkgreen');
            d3.select(divBands[1]).style('fill', '#aa8800');
            d3.select(divBands[2]).style('fill', 'darkred');
          });
        });
      }
    }
  }

}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export class FuzzyClusterColumn extends ClusterColumn implements idtypes.IHasUniqueId, link_m.IDataVis
{
  private probsViews : clusterView.ClusterProbView[] = [];

  // -------------------------------------------------------------------------------------------------------------------

  constructor(protected stratomex, public data, partitioning:ranges.Range, private partitionMatrix: any, public dataRef,
              options:any = {}, within = -1)
  {
    super(stratomex, data, partitioning, dataRef, options, within);
  }

  // -------------------------------------------------------------------------------------------------------------------

  protected createGridToolbar(elem, data, cluster, pos, $toolbar: d3.Selection<any>)
  {
    const that = this;

    super.createGridToolbar(elem, data, cluster, pos, $toolbar);

    $toolbar.insert('i', '.fa-expand').attr('class', 'fa fa-align-left').on('click', () =>
    {
      // first obtain the provenance graph
      var graph = that.stratomex.provGraph;
      // next find the current object / selection / cluster
      var obj = graph.findObject(that);
      // push new command to graph
      graph.push(clusterView.createToggleProbsCmd(obj, pos[0], true));
      // stop propagation to disable further event triggering
      d3.event.stopPropagation();
    });
  }

  // -------------------------------------------------------------------------------------------------------------------

  protected determineColumnWidth(reset=false)
  {
    var layoutWidth = super.determineColumnWidth(reset);
    if (reset) { return layoutWidth; }

    var numVisibleGroups = 0;
    const numGroups = (<any>this.range.dims[0]).groups.length;

    if (this.probsViews.some((d:any) =>
        {
          if (d == null) { return false; }
          return d.visible;
        }))
    {
      numVisibleGroups = 1;

      if (this.probsViews.some((d:any) =>
        {
          if (d == null) { return false; }
          return d.visible && d.externVisible;
        }))
      {
        numVisibleGroups = numGroups;
      }
    }

    layoutWidth += this.options.statsWidth * numVisibleGroups;

    return layoutWidth;
  }

  // -------------------------------------------------------------------------------------------------------------------

  protected resizeColumn(size: any, within=-1)
  {
    super.resizeColumn(size);

    const numGroups = (<any>this.range.dims[0]).groups.length;
    var numVisibleGroups = 0;

    if (this.probsViews.some((d:any) =>
        {
          if (d == null) { return false; }
          return d.visible;
        }))
    {
      numVisibleGroups = 1;

      if (this.probsViews.some((d:any) =>
        {
          if (d == null) { return false; }
          return d.visible && d.externVisible;
        }))
      {
        numVisibleGroups = numGroups;
      }
    }

    size.x -= this.options.statsWidth * numVisibleGroups;
  }

  // -------------------------------------------------------------------------------------------------------------------

  protected onActionLoader(size: any, within=-1)
  {
    super.onActionLoader(size);

    const that = this;
    const numGroups = (<any>this.range.dims[0]).groups.length;

    // go through all stats view and determine their position
    // resize cluster windows since their height should correspond to the heatmap height
    for (var j = 0; j < numGroups; ++j)
    {
      var probsView = this.probsViews[j];

      if (probsView == null) { continue; }
      if (probsView.visible == true)
      {
        var clusterGrid = $(this.$parent.node()).find('div.gridrow')[j];
        var clusterPosY = $(clusterGrid).position().top;
        var clusterHeight = $(clusterGrid).height() - 10;
        var boxChartHeight = $(clusterGrid).height() - 18 - 10 - 2 * this.options.padding;

        for (var i = 0; i < numGroups; ++i)
        {
          if (!probsView.$nodes[i]) { continue; }
          if (i > 0 && !probsView.externVisible) { break; }

          probsView.zooms[i].zoomTo(this.options.statsWidth - this.options.padding * 2, boxChartHeight);

          probsView.$nodes[i].style(
            {
              width: (this.options.statsWidth) + 'px',
              height: clusterHeight + 'px',
              top: clusterPosY + 'px',
              left: (size.x + this.options.padding * 2 + this.options.statsWidth * i) + 'px'
            });
        }
      }
    }
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Show detailed probability view for certain stratification.
   * @param cluster
   * @param within
   * @param relayout
   * @returns {any}
     */
  showProbs(cluster, within = -1, relayout = true)
  {
    var probsView = this.probsViews[cluster];

    if (probsView != null)
    {
      probsView.show(within);

      this.setColumnWidth();
      return (relayout) ? this.stratomex.relayout(within) : Promise.resolve([]);
    }

    var probView = new clusterView.ClusterProbView(cluster, this.range, this.partitionMatrix, {});
    probView.build(this.$parent, this);
    this.probsViews[cluster] = probView;

    this.setColumnWidth();

    return (relayout) ? this.stratomex.relayout(within) : Promise.resolve([]);
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Hide cluster probability view.
   * @param cluster
   * @param within
   * @returns {Promise<void>}
     */
  hideProbs(cluster, within)
  {
    var probsView = this.probsViews[cluster];
    probsView.hide(within);

    this.setColumnWidth();
    return this.stratomex.relayout(within);
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Represents column created by hierarchical clustering algorithm. Contains dendrogram that can be used to increment
 * or to decrement number of clusters.
 */
export class HierarchicalClusterColumn extends ClusterColumn implements idtypes.IHasUniqueId, link_m.IDataVis
{
  constructor(protected stratomex, public data, partitioning:ranges.Range, protected dendrogram: any, public dataRef,
              options:any = {}, within = -1)
  {
    super(stratomex, data, partitioning, dataRef, options, within);
  }

  createToolBar()
  {
    var that = this;
    var $t = this.$toolbar;

    super.createToolBar();

    $t.insert('i', '.fa-close').attr('class', 'fa fa-angle-double-up').on('click', () =>
    {
      const oldNumGroups = (<any>that.range.dims[0]).groups.length;
      const numGroups = Math.min(oldNumGroups + 1, 10);

      if (oldNumGroups == numGroups) { return; }

      that.createNewStratification(numGroups);
    });

    $t.insert('i', '.fa-close').attr('class', 'fa fa-angle-double-down').on('click', () =>
    {
      const oldNumGroups = (<any>that.range.dims[0]).groups.length;
      const numGroups = Math.max(oldNumGroups - 1, 1);

      if (oldNumGroups == numGroups) { return; }

      that.createNewStratification(numGroups);
    });

  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Cut dendrogram to create k-number of clusters.
   * @param k
   * @returns {Promise<Array>}
     */
  private cutDendrogramToClusters(k: number)
  {
    const dendrogram = this.dendrogram;

    var queue = [dendrogram];
    var clusters = [];

    while (queue.length < k)
    {
      var node = queue.shift();
      queue.push(node.children[0]);
      queue.push(node.children[1]);

      function sortFunc(a: any, b: any)
      {
        const valueA = (a.children == null) ? 0 : -a.value;
        const valueB = (b.children == null) ? 0 : -b.value;

        return valueA - valueB;
      }

      queue.sort(sortFunc);
    }

    var responses = [];

    for (var ii = 0; ii < k; ++ii)
    {
      clusters.push(queue[ii].indices);
    }

    function compareCluster(a, b)
    {
      return (a.length < b.length) ? -1 : (a.length > b.length) ? 1 : 0;
    }

    clusters = clusters.sort(compareCluster);

    return Promise.all(responses).then( (args: any) =>
    {
      return clusters;
    });
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Create a new stratification with numGroups clusters.
   * @param numGroups
     */
  private createNewStratification(numGroups)
  {
    const that = this;

    var response = that.cutDendrogramToClusters(numGroups);

    const dataName = that.data.desc.name;

    response.then( (result: any) =>
    {
      const clusterLabels = result;

      var rangeGroups = [];
      var groups = [];
      var groupsDesc = [];
      for (var i = 0; i < numGroups; ++i)
      {
        var groupSize = clusterLabels[i].length;

        rangeGroups.push(ranges.parse(clusterLabels[i]));
        groups.push(new ranges.Range1DGroup('Group ' + String(i),
          'grey', rangeGroups[i].dim(0)));

        groupsDesc.push({ name: 'Group ' + String(i), size: groupSize});
      }

      var compositeRange = ranges.composite(dataName + 'groups', groups);
      that.updateGrid(compositeRange);
    });
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// TODO! To support provenance graph --> dendrogram needs to be added to server for api/dataset request
export interface IDendrogram extends C.IPersistable
{
  desc: datatypes.IDataDescription;
}

// ---------------------------------------------------------------------------------------------------------------------

export class Dendrogram implements IDendrogram
{
  constructor(public tree: any, public desc: datatypes.IDataDescription)
  {

  }

  persist() : any
  {
    return this.desc.id;
  }

  restore(persisted: any)
  {
    return this;
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// TODO! To support provenance graph --> partition matrix needs to be added to server for api/dataset request
export interface IPartitionMatrix extends C.IPersistable
{
  desc: datatypes.IDataDescription;
}

// ---------------------------------------------------------------------------------------------------------------------

export class PartitionMatrix implements IPartitionMatrix
{
  constructor(public partition: any, public desc: datatypes.IDataDescription)
  {

  }

  persist() : any
  {
    return this.desc.id;
  }

  restore(persisted: any)
  {
    return this;
  }
}
