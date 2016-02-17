/**
 * Created by sam on 30.01.2015.
 * Modifield by Michael Kern on 01.02.2016
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
import vis = require('../caleydo_core/vis');

// my own libraries
import clusterDivider = require('../gene_vis/clusterdivider');
import boxSlider = require('../gene_vis/boxslider');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Column utility functions

/**
 *
 * @param within
 * @returns {number}
 */
export function animationTime(within = -1)
{
  return within < 0 ? 50 : within;
}

// ---------------------------------------------------------------------------------------------------------------------

/**
 * Guess the initial visualization method suited to the type of a specific data.
 * @param desc: description of the data
 * @returns {any}
 */
function guessInitial(desc):any
{
  if (desc.type === 'matrix')
  {
    return 'caleydo-vis-heatmap';
  }
  if (desc.type === 'vector' && desc.value.type === 'int' && desc.name.toLowerCase().indexOf('daystodeath') >= 0)
  {
    return 'caleydo-vis-kaplanmeier';
  }
  if (desc.type === 'vector')
  {
    return desc.value.type === 'categorical' ? 'caleydo-vis-mosaic' : 'caleydo-vis-heatmap1d';
  }
  if (desc.type === 'stratification')
  {
    return 'caleydo-vis-mosaic';
  }
  return -1;
}

// ---------------------------------------------------------------------------------------------------------------------

//create a manager for all columns
export const manager = new idtypes.ObjectManager<Column>('_column', 'Column');


/**
 * Creates a new column to display stratifications and their link to the data.
 * @param inputs
 * @param parameter
 * @param graph
 * @param within
 * @returns {Promise<TResult>|Promise<U>}
 */
function createColumn(inputs, parameter, graph, within)
{
  var stratomex = inputs[0].value,
    partitioning = ranges.parse(parameter.partitioning),
    index = parameter.hasOwnProperty('index') ? parameter.index : -1,
    name = parameter.name || inputs[1].name;

  //console.log(ranges.parse(parameter.partitioning));

  return inputs[1].v.then(function (data)
  {
    //console.log(new Date(), 'create column', data.desc.name, index);
    var c = new Column(stratomex, data, partitioning, inputs[1], {
      width: (data.desc.type === 'stratification') ? 60 : (data.desc.name.toLowerCase().indexOf('death') >= 0 ? 110 : 160),
      name: name
    }, within);
    var r = prov.ref(c, c.name, prov.cat.visual, c.hashString);
    c.changeHandler = function (event, to, from)
    {
      if (from)
      { //have a previous one so not the default
        graph.push(createChangeVis(r, to.id, from ? from.id : null));
      }
    };
    c.optionHandler = function (event, name, value, bak)
    {
      graph.push(createSetOption(r, name, value, bak));
    };
    c.on('changed', c.changeHandler);
    c.on('option', c.optionHandler);

    //console.log(new Date(), 'add column', data.desc.name, index);
    return stratomex.addColumn(c, index, within).then(() =>
    {
      //console.log(new Date(), 'added column', data.desc.name, index);
      return {
        created: [r],
        inverse: (inputs, created) => createRemoveCmd(inputs[0], created[0]),
        consumed: within
      };
    });
  });
}

// ---------------------------------------------------------------------------------------------------------------------

function removeColumn(inputs, parameter, graph, within)
{
  var column:Column = inputs[1].value;
  const dataRef = column.dataRef;
  const partitioning = column.range.toString();
  const columnName = column.name;
  //console.log(new Date(), 'remove column', column.data.desc.name);

  return inputs[0].value.removeColumn(column, within).then((index) =>
  {
    //console.log(new Date(), 'removed column', dataRef.value.desc.name, index);
    return {
      removed: [inputs[1]],
      inverse: (inputs, created) => createColumnCmd(inputs[0], dataRef, partitioning, columnName, index),
      consumed: within
    };
  });
}

// ---------------------------------------------------------------------------------------------------------------------

function swapColumns(inputs, parameter, graph, within)
{
  return (inputs[0].value).swapColumn(inputs[1].value, inputs[2].value, within).then(() =>
  {
    return {
      inverse: createSwapColumnCmd(inputs[0], inputs[2], inputs[1]),
      consumed: within
    };
  });
}

// ---------------------------------------------------------------------------------------------------------------------

function changeVis(inputs, parameter)
{
  var column = inputs[0].value,
    to = parameter.to,
    from = parameter.from || column.grid.act.id;
  column.off('changed', column.changeHandler);
  return column.grid.switchTo(to).then(function ()
  {
    column.on('changed', column.changeHandler);
    return {
      inverse: createChangeVis(inputs[0], from, to)
    };
  });
}

// ---------------------------------------------------------------------------------------------------------------------

export function showInDetail(inputs, parameter, graph, within)
{
  var column:Column = inputs[0].value,
    cluster = parameter.cluster,
    show = parameter.action === 'show';
  var r:Promise<any>;
  if (show)
  {
    r = column.showInDetail(cluster, within);
  } else
  {
    r = column.hideDetail(cluster, within);
  }
  return r.then(() =>
  {
    return {
      inverse: createToggleDetailCmd(inputs[0], cluster, !show),
      consumed: within
    };
  });
}

export function createToggleDetailCmd(column, cluster, show)
{
  var act = show ? 'Show' : 'Hide';
  return prov.action(prov.meta(act + ' Details of ' + column.toString() + ' Cluster "' + cluster + '"', prov.cat.layout),
    'showStratomeXInDetail', showInDetail, [column], {
      cluster: cluster,
      action: show ? 'show' : 'hide'
    });
}

// ---------------------------------------------------------------------------------------------------------------------

export function showStats(inputs, parameter, graph, within)
{
  var column:Column = inputs[0].value;
  var cluster = parameter.cluster;
  var show = parameter.action === 'show';

  var r:Promise<any>;
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

// TODO create stats cmd
export function createToggleStatsCmd(column, cluster, show)
{
  var act = show ? 'Show' : 'Hide';
  return prov.action(prov.meta(act + ' Distances of ' + column.toString() + ' Cluster "' + cluster + '"', prov.cat.layout),
    'showStratomeXStats', showStats, [column], {
      cluster: cluster,
      action: show ? 'show' : 'hide'
    });
}

// ---------------------------------------------------------------------------------------------------------------------

export function createChangeVis(column, to, from)
{
  const visses = column.value.grid.visses;
  const vis_desc = visses.filter((v) => v.id === to)[0];
  return prov.action(prov.meta(column.value.name + ' as ' + vis_desc.name,
    prov.cat.visual), 'changeStratomeXColumnVis', changeVis, [column], {
    to: to,
    from: from
  });
}

// ---------------------------------------------------------------------------------------------------------------------

function setOption(inputs, parameter)
{
  var column = inputs[0].value,
    name = parameter.name,
    value = parameter.value,
    bak = parameter.old || column.grid.option(name);
  column.grid.off('option', column.optionHandler);
  column.grid.option(name, value);
  column.grid.on('option', column.optionHandler);
  return {
    inverse: createSetOption(inputs[0], name, bak, value)
  };
}

// ---------------------------------------------------------------------------------------------------------------------

export function createSetOption(column, name, value, old)
{
  return prov.action(prov.meta('set option "' + name + +'" of "' + column.name + ' to "' + value + '"', prov.cat.visual),
    'setStratomeXColumnOption', setOption, [column], {
    name: name,
    value: value,
    old: old
  });
}

// ---------------------------------------------------------------------------------------------------------------------

export function createColumnCmd(stratomex, data, partitioning, name:string, index:number = -1)
{
  return prov.action(prov.meta(name, prov.cat.data, prov.op.create),
    'createStratomeXColumn', createColumn, [stratomex, data], {
    partitioning: partitioning.toString(),
    name: name,
    index: index
  });
}

// ---------------------------------------------------------------------------------------------------------------------

export function createRemoveCmd(stratomex, column)
{
  return prov.action(prov.meta(column.name, prov.cat.data, prov.op.remove),
    'removeStratomeXColumn', removeColumn, [stratomex, column]);
}

// ---------------------------------------------------------------------------------------------------------------------

export function createSwapColumnCmd(stratomex, columnA, columnB)
{
  return prov.action(prov.meta(`${columnA.name}⇄${columnB.name}`, prov.cat.layout, prov.op.update),
    'swapStratomeXColumns', swapColumns, [stratomex, columnA, columnB]);
}

// ---------------------------------------------------------------------------------------------------------------------

export function createCmd(id:string)
{
  switch (id)
  {
    case 'setStratomeXColumnOption' :
      return setOption;
    case 'createStratomeXColumn':
      return createColumn;
    case 'swapStratomeXColumns':
      return swapColumns;
    case 'removeStratomeXColumn' :
      return removeColumn;
    case 'changeStratomeXColumnVis':
      return changeVis;
    case 'showStratomeXInDetail' :
      return showInDetail;
  /** This is a new feature **/
    case 'showStratomeXStats' :
      return showStats;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------

/**
 * annihilate two swap operations: A-B and B-A
 * @param path
 * @returns {prov.ActionNode[]}
 */
export function compressCreateRemove(path:prov.ActionNode[])
{
  const to_remove:number[] = [];
  path.forEach((p, i) =>
  {
    if (p.f_id === 'removeStratomeXColumn')
    {
      const col = p.removes[0]; //removed column
      //find the matching createStatement and mark all changed in between
      for (let j = i - 1; j >= 0; --j)
      {
        let q = path[j];
        if (q.f_id === 'createStratomeXColumn')
        {
          let created_col = q.creates[0];
          if (created_col === col)
          {
            //I found my creation
            to_remove.push(j, i); //remove both
            break;
          }
        } else if (q.f_id.match(/(changeStratomeXColumnVis|showStratomeXInDetail|setStratomeXColumnOption|swapStratomeXColumns)/))
        {
          if (q.requires.some((d) => d === col))
          {
            to_remove.push(j); //uses the element
          }
        }
      }
    }
  });
  //decreasing order for right indices
  for (let i of to_remove.sort((a, b) => b - a))
  {
    path.splice(i, 1);
  }
  return path;
}

// ---------------------------------------------------------------------------------------------------------------------

export function compressSwap(path:prov.ActionNode[])
{
  const to_remove:number[] = [];
  path.forEach((p, i) =>
  {
    if (p.f_id === 'swapStratomeXColumns')
    {
      const inputs = p.requires;
      //assert inputs.length === 3
      for (let j = i + 1; j < path.length; ++j)
      {
        let q = path[j];
        if (q.f_id === 'swapStratomeXColumns')
        {
          let otherin = q.requires;
          if (inputs[1] === otherin[2] && inputs[2] === otherin[1])
          {
            //swapped again
            to_remove.push(i, j);
            break;
          }
        }
      }
    }
  });
  //decreasing order for right indices
  for (let i of to_remove.sort((a, b) => b - a))
  {
    path.splice(i, 1);
  }
  return path;
}

// ---------------------------------------------------------------------------------------------------------------------

export function compressHideShowDetail(path:prov.ActionNode[])
{
  const to_remove:number[] = [];
  path.forEach((p, i) =>
  {
    if (p.f_id === 'showStratomeXInDetail' && p.parameter.action === 'show')
    {
      const column = p.requires[0];
      const cluster = p.parameter.cluster;
      for (let j = i + 1; j < path.length; ++j)
      {
        let q = path[j];
        if (q.f_id === 'showStratomeXInDetail' && q.parameter.action === 'hide'
          && q.parameter.cluster === cluster && column === q.requires[0])
        {
          //hide again
          to_remove.push(i, j);
          break;
        }
      }
    }
  });
  //decreasing order for right indices
  for (let i of to_remove.sort((a, b) => b - a))
  {
    path.splice(i, 1);
  }
  return path;
}

// ---------------------------------------------------------------------------------------------------------------------

function shiftBy(r, shift)
{
  if (Array.isArray(r))
  {
    return r.map(function (loc)
    {
      return loc ? geom.wrap(loc).shift(shift) : loc;
    });
  }
  return r ? geom.wrap(r).shift(shift) : r;
}

// ---------------------------------------------------------------------------------------------------------------------

/**
 * utility to sync histograms over multiple instances
 * @param expectedNumberOfHists
 */
function groupTotalAggregator(expectedNumberOfPlots:number, agg:(v:any) => number)
{
  var acc = 0;
  var resolvers = [];
  return (v) =>
  {
    return new Promise((resolve) =>
    {
      acc = Math.max(agg(v), acc);
      resolvers.push(resolve);
      if (resolvers.length === expectedNumberOfPlots)
      {
        resolvers.forEach((r) => r(acc));
        acc = 0;
        resolvers = [];
      }
    });
  };
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Class definition

/**
 *
 */
export class Column extends events.EventHandler implements idtypes.IHasUniqueId, link_m.IDataVis
{
  id:number;

  private options = {
    summaryHeight: 90,
    width: 180,
    detailWidth: 500,
    statsWidth: 200,
    padding: 2,
    name: null
  };

  private $parent : d3.Selection<any>;
  private $toolbar : d3.Selection<any>;
  private $summary : d3.Selection<any>;
  private $clusters : d3.Selection<any>;

  range : ranges.Range;
  private summary : multiform.MultiForm;
  private grid : multiform.MultiFormGrid;

  private grid_zoom:behaviors.ZoomLogic;
  private summary_zoom:behaviors.ZoomLogic;

  private detail:
  {
    $node : d3.Selection<any>;
    multi : multiform.IMultiForm;
    zoom : behaviors.ZoomBehavior;
    cluster : number;
  };

  private statsViews : any[] = [];
  private activeDivision : Column[] = [];
  private distancesRange : [number, number] = null;
  public destroyed : boolean;

  private $layoutHelper:d3.Selection<any>;

  changeHandler:any;
  optionHandler:any;

  private connectSignal : any = null;

  // -------------------------------------------------------------------------------------------------------------------

  private highlightMe = (event:events.IEvent, type:string, act:ranges.Range) =>
  {
    this.$parent.classed('select-' + type, act.dim(0).contains(this.id));
  };

  // -------------------------------------------------------------------------------------------------------------------

  constructor(private stratomex, public data, partitioning:ranges.Range, public dataRef, options:any = {}, within = -1)
  {
    super();
    C.mixin(this.options, options);

    var that = this;
    this.$parent = d3.select(stratomex.parent).append('div').attr('class', 'column').style('opacity', 0);
    this.$parent.style('top', '20px');

    {
      let parentBounds = C.bounds(stratomex.parent);
      this.$parent.style('left', (parentBounds.w - this.options.width - 20) + 'px');
      this.$parent.style('height', (parentBounds.h - 20) + 'px');
    }

    this.$layoutHelper = d3.select(stratomex.parent).append('div').attr('class', 'column-layout');
    this.$parent.style('width', this.options.width + 'px');
    this.$layoutHelper.style('width', this.options.width + 'px');

    this.$toolbar = this.$parent.append('div').attr('class', 'toolbar');

    this.$summary = this.$parent.append('div').attr('class', 'summary').style({
      padding: this.options.padding + 'px',
      'border-color': data.desc.color || 'gray',
      'background-color': data.desc.bgColor || 'lightgray'
    });
    this.$summary.append('div').attr('class', 'title').style('max-width', (that.options.width - this.options.padding * 2) + 'px')
      .text(this.name).style('background-color', data.desc.bgColor || 'lightgrey');

    this.$clusters = this.$parent.append('div').attr('class', 'clusters');
    this.range = partitioning;
    console.log("Range  of column:", this.range);
    //console.log("Range Group 0 of column:", (<any>this.range.dims[0]).groups[0].asList());
    //console.log("Range Group 1 of column:", (<any>this.range.dims[0]).groups[1].asList());

    //create summary visualization as a multiform to display all compatible visualization
    this.summary = multiform.create(data.desc.type !== 'stratification' ? data.view(partitioning) : data, <Element>this.$summary.node(), {
      initialVis: 'caleydo-vis-histogram',
      'caleydo-vis-histogram': {
        total: false,
        nbins: Math.sqrt(data.dim[0])
      },
      all: {
        selectAble: false
      }
    });

    this.$summary.on('click', () =>
    {
      manager.select([this.id], idtypes.toSelectOperation(d3.event));
    });

    //console.log("Normal partitioning:", partitioning);
    this.createMultiGrid(partitioning, data);
    this.createToolBar();

    this.id = manager.nextId(this);
    manager.on('select', this.highlightMe);
    manager.select([this.id]);

    this.destroyed = false;

    this.$parent.transition().duration(animationTime(within)).style('opacity', 1);
  }

  // -------------------------------------------------------------------------------------------------------------------

  private multiGridWrapper(partitioning)
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

      // add new command with symbol fa-expand
      $toolbar.append('i').attr('class', 'fa fa-expand').on('click', () =>
      {
        // first obtain the provenance graph
        var graph = that.stratomex.provGraph;
        // next find the current object / selection / cluster
        var obj = graph.findObject(that);
        // push new command to graph
        graph.push(createToggleDetailCmd(obj, pos[0], true));
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

      // recluster column command
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

  private createMultiGrid(partitioning, data)
  {
    const r = (<ranges.CompositeRange1D>partitioning.dim(0));
    const initialHeight = 500 / (r.groups || []).length;

    d3.select(this.$clusters.node()).style('opacity', 0);

    this.grid = multiform.createGrid(data, partitioning, <Element>this.$clusters.node(), function (data, range, pos)
    {
      if (data.desc.type === 'stratification')
      {
        return (<any>data).group(pos[0]);
      }
      return (<any>data).view(range);
    }, {
      initialVis: guessInitial(data.desc),
      singleRowOptimization: false,
      wrap: this.multiGridWrapper(partitioning),
      all: {
        selectAble: false,
        total: groupTotalAggregator((<ranges.CompositeRange1D>partitioning.dim(0)).groups.length, (v) => v.largestBin),
        nbins: Math.sqrt(data.dim[0]),
        heightTo: initialHeight
      },
      'caleydo-vis-mosaic': {
        width: this.options.width - this.options.padding * 2
      },
      'caleydo-vis-heatmap1d': {
        width: this.options.width - this.options.padding * 2
      },
      'caleydo-vis-heatmap': {
        scaleTo: [this.options.width - this.options.padding * 2, initialHeight],
        forceThumbnails: true
      },
      'caleydo-vis-kaplanmeier': {
        maxTime: groupTotalAggregator((<ranges.CompositeRange1D>partitioning.dim(0)).groups.length, (v) => v.length === 0 ? 0 : v[v.length - 1])
      }
    });
    //zooming
    this.grid_zoom = new behaviors.ZoomLogic(this.grid, this.grid.asMetaData);
    this.summary_zoom = new behaviors.ZoomLogic(this.summary, this.summary.asMetaData);

    d3.select(this.$clusters.node()).transition().duration(animationTime(-1) * 2).style('opacity', 1);

    var that = this;

    that.grid.on('changed', function (event, to, from)
    {
      that.fire('changed', to, from);
    });
  }

  // -------------------------------------------------------------------------------------------------------------------

  updateGrid(range: ranges.CompositeRange1D)
  {
    d3.select(this.grid.node).transition().duration(animationTime(-1)).style('opacity', '0');
    this.grid.destroy();

    var that = this;

    //console.log(strati);

    //strati.range().then((range) =>
    //{
    //  console.log(range);

    const numStatsViews = that.statsViews.length;
    var compositeRange = <ranges.CompositeRange1D>that.range.dim(0);
    that.range = ranges.parse(range.toString());
    that.createMultiGrid(that.range, that.data);

    this.$parent.style('width', this.options.width + 'px');
    this.$layoutHelper.style('width', this.options.width + 'px');

    var promise = this.stratomex.relayout();

    promise.then((_: any) =>
    {
      var promises = [];
      // destroy current stats views
      for (var i = 0; i < numStatsViews; ++i)
      {
        var statsView = that.statsViews[i];
        that.statsViews[i] = null;
        if (statsView != null)
        {
          statsView.divider.destroy();
          statsView.$node.remove();

          if (statsView.externNodes.length > 0)
          {
            for (var k = 0; k < statsView.externNodes.length; ++k)
            {
              statsView.externDividers[k].destroy();
              statsView.externNodes[k].remove();
            }
          }

          //that.hideStats(i, null);
          if (statsView.visible && compositeRange.groups.length == range.groups.length)
          {
            promises.push(that.showStats(i));
          }
        }
      }
    });

    //});
  }

  // -------------------------------------------------------------------------------------------------------------------

  setInteractive(interactive:boolean)
  {
    this.$toolbar.style('display', interactive ? null : 'none');
    this.$parent.selectAll('.gtoolbar').style('display', interactive ? null : 'none');

    this.$parent.selectAll('.group .title, .group .body').classed('readonly', !interactive);
  }

  // -------------------------------------------------------------------------------------------------------------------

  get node()
  {
    return <Element>this.$parent.node();
  }

  // -------------------------------------------------------------------------------------------------------------------

  get layoutNode()
  {
    return <Element>this.$layoutHelper.node();
  }

  // -------------------------------------------------------------------------------------------------------------------

  get hashString()
  {
    return this.data.desc.name + '_' + this.range.toString();
  }

  // -------------------------------------------------------------------------------------------------------------------

  get name()
  {
    if (this.options.name)
    {
      return this.options.name;
    }
    const n:string = this.data.desc.name;
    const i = n.lastIndexOf('/');
    return i >= 0 ? n.slice(i + 1) : n;
  }

  // -------------------------------------------------------------------------------------------------------------------

  ids()
  {
    return this.data.ids(this.range);
  }

  // -------------------------------------------------------------------------------------------------------------------

  getRange()
  {
    return this.range;
  }

  // -------------------------------------------------------------------------------------------------------------------

  get location()
  {
    const abspos = C.bounds(<Element>this.$layoutHelper.node());
    const parent = C.bounds((<Element>this.$layoutHelper.node()).parentElement);
    return geom.rect(abspos.x - parent.x, abspos.y - parent.y, abspos.w, abspos.h);
  }

  // -------------------------------------------------------------------------------------------------------------------

  visPos()
  {
    var l = this.location;
    var offset = $(this.$parent.node()).find('div.multiformgrid').position();
    return {
      x: l.x + offset.left,
      y: l.y + offset.top
    };
  }

  // -------------------------------------------------------------------------------------------------------------------

  locateImpl(range:ranges.Range)
  {
    var cluster = range.dim(0);
    cluster = cluster.toSet();
    for (let i = this.grid.dimSizes[0] - 1; i >= 0; --i)
    {
      let r = this.grid.getRange(i).dim(0).toSet();
      if (r.eq(cluster))
      {
        return shiftBy(this.grid.getBounds(i), this.visPos());
      }
    }
    return null; //not a cluster
  }

  // -------------------------------------------------------------------------------------------------------------------

  locate(...args:any[])
  {
    if (args.length === 1)
    {
      return this.locateImpl(args[0]);
    }
    return args.map((arg) => this.locateImpl(arg));
  }

  // -------------------------------------------------------------------------------------------------------------------

  private locateHack(groups:ranges.Range[])
  {
    const nGroups = this.grid.dimSizes[0];
    if (groups.length !== nGroups)
    {
      return null;
    }
    return groups.map((g, i) =>
    {
      return shiftBy(this.grid.getBounds(i), this.visPos());
    });
  }

  // -------------------------------------------------------------------------------------------------------------------

  locateById(...args:any[])
  {
    const that = this;
    //TODO use the real thing not a heuristic.
    var r = this.locateHack(args);
    if (r)
    {
      return r;
    }
    return this.data.ids().then(function (ids)
    {
      return that.locate.apply(that, args.map(function (r)
      {
        return ids.indexOf(r);
      }));
    });
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * creates new window with larger multiform window
   * @param cluster
   * @param within
   * @returns {Promise<void>}
   */
  showInDetail(cluster, within = -1)
  {
    // don't build detail view twice
    if (this.detail)
    {
      return Promise.resolve([]);
    }

    const data = cluster < 0 ? this.data : this.grid.getData(cluster);

    const $elem = this.$parent.append('div').classed('detail', true).style('opacity', 0);
    $elem.classed('group', true).datum(data);

    var $toolbar = $elem.append('div').attr('class', 'gtoolbar');
    $elem.append('div').attr('class', 'title')
      .text(cluster < 0 ? this.data.desc.name : (<ranges.CompositeRange1D>this.range.dim(0)).groups[cluster].name);

    const $body = $elem.append('div').attr('class', 'body');

    const multi = multiform.create(data, <Element>$body.node(), {
      initialVis: guessInitial(data.desc)
    });
    multiform.addIconVisChooser(<Element>$toolbar.node(), multi);

    $toolbar.append('i').attr('class', 'fa fa-close').on('click', () =>
    {
      var g = this.stratomex.provGraph;
      var s = g.findObject(this);
      g.push(createToggleDetailCmd(s, cluster, false));
    });

    this.detail = {
      $node: $elem,
      multi: multi,
      zoom: new behaviors.ZoomBehavior(<Element>$elem.node(), multi, multi.asMetaData),
      cluster: cluster
    };


    const numGroups = (<any>this.range.dims[0]).groups.length;
    var width = this.options.width + this.options.detailWidth;
    if (this.statsViews.some( (d : any) => { if (d == null) { return false; } return d.visible == true; } ))
    {
      width += this.options.statsWidth * numGroups;
    }


    this.$parent.style('width', width + 'px');
    this.$layoutHelper.style('width', width + 'px');
    $elem.transition().duration(animationTime(within)).style('opacity', 1);
    return this.stratomex.relayout(within);
  }

  hideDetail(cluster, within)
  {
    if (!this.detail)
    {
      return Promise.resolve([]);
    }
    //this.detail.multi.destroy();
    this.detail.$node.transition().duration(animationTime(within)).style('opacity', 0).remove();

    this.detail = null;

    var width = this.options.width;
    const numGroups = (<any>this.range.dims[0]).groups.length;
    if (this.statsViews.some( (d : any) => { if (d == null) { return false; } return d.visible == true; } ))
    {
      width += this.options.statsWidth * numGroups;
    }

    this.$parent.style('width', width + 'px');
    this.$layoutHelper.style('width', width + 'px');
    return this.stratomex.relayout(within);
  }

  // -------------------------------------------------------------------------------------------------------------------

  showStats(cluster, within = -1)
  {
    var statsView = this.statsViews[cluster];

    if (statsView != null)
    {
      const numGroups = (<any>this.range.dims[0]).groups.length;

      var layoutWidth = this.options.statsWidth * numGroups + this.options.width;
      if (this.detail) { layoutWidth += this.options.detailWidth; }

      this.$parent.style('width', layoutWidth + 'px');
      this.$layoutHelper.style('width', layoutWidth + 'px');
      statsView.$node.transition().duration(animationTime(within)).style('opacity', 1);
      statsView.visible = true;

      if (statsView.externNodes.length > 0)
      {
        for (var k = 0; k < statsView.externNodes.length; ++k)
        {
          statsView.externNodes[k].transition().duration(animationTime(within)).style('opacity', 1);
        }
      }

      return this.stratomex.relayout(within);
    }

    const that = this;

    // obtain either full data (if cluster index < 0) or cluster data
    const data = cluster < 0 ? this.data : this.grid.getData(cluster);

    const $elem = this.$parent.append('div').classed('stats', true).style('opacity', 0);
    $elem.classed('group', true).datum(data);

    var dataClusters = <ranges.CompositeRange1D>this.range.dim(0);
    var clusterName = cluster < 0 ? this.data.desc.name : dataClusters.groups[cluster].name;

    var $toolbar = $elem.append('div').attr('class', 'gtoolbar');
    $elem.append('div').attr('class', 'title')
      .text('Distances');

    // tool to divide current cluster and create new divisions / stratifications displayed in a new column
    $toolbar.append('i').attr('class', 'fa fa-share-alt').on('click', () =>
    {
      that.showDivisions(cluster);
      // stop propagation to disable further event triggering
      d3.event.stopPropagation();
    });

    $toolbar.append('i').attr('class', 'fa fa-refresh').on('click', () =>
    {
      that.regroupCluster(cluster);

      // stop propagation to disable further event triggering
      d3.event.stopPropagation();
    });

    const $body = $elem.append('div').attr('class', 'body');

    $toolbar.append('i').attr('class', 'fa fa-close').on('click', () =>
    {
      var g = this.stratomex.provGraph;
      var s = g.findObject(this);
      g.push(createToggleStatsCmd(s, cluster, false));
    });

    const numGroups = (<any>this.range.dims[0]).groups.length;

    var responses = [];
    if (this.distancesRange == null)
    {
      for (var j = 0; j < numGroups; ++j)
      {
        var labelList = (<any>this.range.dims[0]).groups[j].asList();
        var request = { group: JSON.stringify({ labels: labelList }) };
        responses.push(ajax.send('/api/gene_clustering/distances/' + that.data.desc.id, request, 'post'));
      }

      Promise.all(responses).then((args: any) => {
        var values = [];

        for (var j = 0; j < numGroups; ++j)
        {
          values = values.concat(args[j].distances);
        }

        that.distancesRange = d3.extent(values);
      });
    }

    var labelList = (<any>this.range.dims[0]).groups[cluster].asList();

    // gather all other clusters and their labels
    var externLabelList = [];
    for (var j = 0; j < numGroups; ++j)
    {
      if (j == cluster) { continue; }
      externLabelList.push((<any>this.range.dims[0]).groups[j].asList());
    }


    // request cluster distance data from server
    var request = { group: JSON.stringify({ labels: labelList, externLabels: externLabelList }) };
    var response = ajax.send('/api/gene_clustering/distances/' + this.data.desc.id, request, 'post');
    console.log("Requested distances of data set:", this.data.desc.id);

    // resolve all promises, including the promises where the distance range is determined
    return Promise.all(responses.concat(response)).then((args: any) =>
    {
      var distanceData = args[responses.length];

      if (distanceData === null) { return Promise.resolve([]); }

      var distances = distanceData.distances;
      var externDistances = distanceData.externDistances;
      var labels = distanceData.labels;
      var dividerWidth = this.options.statsWidth - this.options.padding * 2;

      this.options.statsWidth = 100;
      var clusterGrid = $(this.$parent.node()).find('div.gridrow')[cluster];
      var height = $(clusterGrid).height() - 18 - 10 - 2 * this.options.padding;

      var divider = boxSlider.createRaw(distances, <Element>$body.node(), {
        scaleTo: [dividerWidth, height], range: that.distancesRange, numAvg: 1
      });
      (<boxSlider.BoxSlider>divider).setLabels(labels);

      var externDividers = [];
      var externZooms = [];
      var externNodes = [];

      if (externDistances != null)
      {
        for (var j = 0; j < externDistances.length; ++j)
        {
          const $elemNext = this.$parent.append('div').classed('stats', true).style('opacity', 0);
          $elemNext.classed('group', true).datum(data);
          $elemNext.append('div').attr('class', 'title').text('External Distances');
          const $bodyNext = $elemNext.append('div').attr('class', 'body');

          var externDivider = boxSlider.createRaw(externDistances[j], <Element>$bodyNext.node(), {
            scaleTo: [dividerWidth, height], range: that.distancesRange, numAvg: 1, numSlider: 0
          });
          (<boxSlider.BoxSlider>externDivider).setLabels(labels);
          externDividers.push(externDivider);
          $elemNext.transition().duration(animationTime(within)).style('opacity', 1);
          externZooms.push(new behaviors.ZoomLogic((<boxSlider.BoxSlider>externDivider), null));
          externNodes.push($elemNext);
        }
      }

      function mouseOutHandler(divider: vis.AVisInstance, extDividers: vis.AVisInstance[])
      {
        return (_: any) =>
        {
          var divs = (<boxSlider.BoxSlider>divider).getCurrentDivisions();
          extDividers.forEach((d: boxSlider.BoxSlider) => { d.setDivisions(divs); });
        };
      }

      $elem.on('mouseup', mouseOutHandler(divider, externDividers));
      // and color each extern distance box chart at the beginning
      mouseOutHandler(divider, externDividers)({});

      this.statsViews[cluster] =
      {
        $node: $elem, divider: divider, externDividers: externDividers,
        cluster: cluster, visible: true, column: null,
        zoom: new behaviors.ZoomLogic((<boxSlider.BoxSlider>divider), null), externZooms: externZooms,
        externNodes: externNodes
      };

      var layoutWidth = this.options.statsWidth * numGroups + this.options.width;
      if (this.detail) { layoutWidth += this.options.detailWidth; }

      this.$parent.style('width', layoutWidth + 'px');
      this.$layoutHelper.style('width', layoutWidth + 'px');
      $elem.transition().duration(animationTime(within)).style('opacity', 1);

      return this.stratomex.relayout(within);
    });
  }

  hideStats(cluster, within)
  {
    var statsView = this.statsViews[cluster];

    statsView.visible = false;
    statsView.$node.transition().duration(animationTime(within)).style('opacity', 0); //.remove();

    const numGroups = (<any>this.range.dims[0]).groups.length;

    if (statsView.externNodes.length > 0)
    {
      for (var k = 0; k < statsView.externNodes.length; ++k)
      {
        statsView.externNodes[k].transition().duration(animationTime(within)).style('opacity', 0);
      }
    }

    var layoutWidth = this.options.width;

    if (this.statsViews.some( (d : any) => { if (d == null) { return false; } return d.visible == true; } ))
    {
      layoutWidth += this.options.statsWidth * numGroups;
    }

    if (this.detail) { layoutWidth += this.options.detailWidth; }

    this.$parent.style('width', layoutWidth + 'px');
    this.$layoutHelper.style('width', layoutWidth + 'px');

    return this.stratomex.relayout(within);
  }

  // -------------------------------------------------------------------------------------------------------------------

  showDivisions(cluster, column : Column = null)
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

    var divider = statsView.divider;
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

      // obtain subranges from cluster divider
      var subRanges = (<boxSlider.BoxSlider>divider).getDivisionRanges();

      var rangeGroups = [];
      var groups = [];
      var groupsDesc = [];
      var stratiSize = 0;
      for (var i = 0; i < 3; ++i)
      {
        var groupSize = subRanges[i].length;
        stratiSize += groupSize;

        rangeGroups.push(ranges.parse(subRanges[i]));
        groups.push(new ranges.Range1DGroup(groupName + ' (Div ' + String(i) + ')',
          'grey', rangeGroups[i].dim(0)));

        groupsDesc.push({ name: 'Division ' + String(i), size: groupSize});
      }

      var compositeRange = ranges.composite(dataName + 'divisions', groups);

      var descStrati =
      {
        id: dataID + method + String(numClusters) + 'Division' + String(cluster),
        fqname: 'none', name: dataName + '/' + method + '_' + String(numClusters) + '_Division_' + String(cluster),
        origin: dataFQ, size: stratiSize, ngroups: 3,
        type: 'stratification', groups: groupsDesc, // TODO: use this as desc
        idtype: 'patient', // TODO: figure out what idtypes are important for
        ws: 'random' // TODO: figure out what this parameter is
      };

      Promise.all([(<any>data).rows(), (<any>data).rowIds()]).then((args) =>
      {
        // obtain the rows and rowIDs of the data
        var rows = args[0];
        var rowIds = args[1];

        // create a new startification of the data
        var strati : stratification.IStratification;
        strati = stratification_impl.wrap(<datatypes.IDataDescription>descStrati, rows, rowIds, <any>compositeRange);

        if (column === null)
        {
          that.stratomex.addData(strati, data, null);
          that.connectSignal = { cluster: cluster };

        } else {
          column.updateGrid(compositeRange);
        }
      });
    }
  }

  // -------------------------------------------------------------------------------------------------------------------

  private regroupCluster(cluster: number)
  {
    var statsView = this.statsViews[cluster];
    var that = this;

    if (statsView == null)
    {
      return Promise.resolve([]);
    }

    const clusterLabels = statsView.divider.getLabels();

    var distanceVec: any[] = [];

    for (var j = 0; j < statsView.externDividers.length; ++j)
    {
      distanceVec.push(statsView.externDividers[j].data);
    }

    // insert cluster into distance vectors
    distanceVec.splice(cluster, 0, statsView.divider.data);

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

  layouted(within = -1)
  {
    //sync the scaling
    let bounds = C.bounds(<Element>this.$layoutHelper.node());
    var size = {x: bounds.w, y: bounds.h - 5}; //no idea why but needed avoiding an overflow

    size.y -= this.options.summaryHeight;
    size.y -= (<any>this.range.dim(0)).groups.length * 32; //remove the grid height

    this.$parent.interrupt().style('opacity', 1).transition().style({
      left: bounds.x + 'px',
      //top: (bounds.y - 20) + 'px', //for the padding applied in the style to the stratomex
      width: bounds.w + 'px',
      height: (bounds.h - 5) + 'px' //no idea why but needed avoiding an overflow
    });

    // -----------------------------------------------------------------------------------------------------------------
    // Resize if detail is shown


    if (this.detail)
    {
      var clusterGrid = $(this.$parent.node()).find('div.gridrow')[this.detail.cluster];
      //var clusterPosY = $(clusterGrid).position().top;
      var clusterPosY = this.options.summaryHeight + 32;

      size.x -= this.options.detailWidth;
      this.detail.$node.style({
        width: this.options.detailWidth + 'px',
        height: size.y + 'px',
        top: clusterPosY + 'px',
        left: (size.x + this.options.padding * 2) + 'px'
      });
      this.detail.zoom.zoomTo(this.options.detailWidth - this.options.padding * 4, size.y - this.options.padding * 2 - 30);
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Resize if statistics are shown

    const numGroups = (<any>this.range.dims[0]).groups.length;

    if (this.statsViews.some( (d : any) => { if (d == null) { return false; } return d.visible == true; } ))
    {
      size.x -= this.options.statsWidth * numGroups;
    }

    // check if any column was removed and update active divisions
    for (var j = 0; j < numGroups; ++j)
    {
      var statsView = this.statsViews[j];
      if (statsView == null) { continue; }

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

    // -----------------------------------------------------------------------------------------------------------------
    // Resize rest of column

    this.$summary.style('width', size.x + 'px');

    this.summary.actLoader.then(() =>
    {
      this.summary_zoom.zoomTo(size.x - this.options.padding * 3, this.options.summaryHeight - this.options.padding * 3 - 30);
    });
    this.grid.actLoader.then(() =>
    {
      this.grid_zoom.zoomTo(size.x - this.options.padding * 2, size.y);

      //shift the content for the aspect ratio
      var shift = [null, null];
      if (this.grid_zoom.isFixedAspectRatio)
      {
        var act = this.grid.size;
        shift[0] = ((size.x - act[0]) / 2) + 'px';
        shift[1] = ((size.y - act[1]) / 2) + 'px';
      }
      this.$parent.select('div.multiformgrid').style({
        left: shift[0],
        top: shift[1]
      });

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

          statsView.zoom.zoomTo(this.options.statsWidth - this.options.padding * 2, boxChartHeight);

          statsView.$node.style({
            width: this.options.statsWidth + 'px',
            height: clusterHeight + 'px',
            top: clusterPosY + 'px',
            left: (size.x + this.options.padding * 2) + 'px'
          });

          if (statsView.externNodes != null)
          {
            for (var k = 0; k < statsView.externNodes.length; ++k)
            {
              statsView.externZooms[k].zoomTo(this.options.statsWidth - this.options.padding * 2, boxChartHeight);
              statsView.externNodes[k].style({
                width: this.options.statsWidth + 'px',
                height: clusterHeight + 'px',
                top: clusterPosY + 'px',
                left: (size.x + this.options.padding * 2 + this.options.statsWidth * (k + 1)) + 'px'
              });
            }
          }

          if (this.connectSignal != null && this.connectSignal.cluster == j) {
            var that = this;

            function refreshColumn(cluster, column:Column) {
              var statsView = that.statsViews[cluster];

              if (column == null) { return; }
              if (statsView.divider.hasChanged())
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

            d3.select((<clusterDivider.ClusterDivider>statsView.divider).node)
              .on('mouseup', onClickSlider(statsView.cluster, newColumn));

            this.connectSignal = null;

            this.activeDivision.push(newColumn);
          }
        }

        // hack to update ribbons
        Promise.resolve(statsView).then( (stats: any) =>
        {
          C.resolveIn(1000).then( () =>
          {
            var linkSVG = d3.select('.link-container svg');
            if (stats.column == null) { return; }

            //console.log(linkSVG);
            var colID = this.id;
            var nextID = stats.column.id;

            var minID = Math.min(colID, nextID);
            var maxID = Math.max(colID, nextID);

            if (Math.abs(colID - nextID) != 1) { return; }

            var idRequest = "g[data-id='" + String(minID) + '-' + String(maxID) +  "']";
            //console.log(idRequest);
            var bandsGroup = linkSVG.selectAll(idRequest);
            //console.log(bandsGroup);
            var bands = bandsGroup.selectAll('.rel-group');
            //console.log(bands);
            if (bands.length < 1) { return; }
            var divBands = bands[0];

            divBands.sort( (l: any, r: any) => { return $(l).position().top - $(r).position().top; });

            d3.select(divBands[0]).style('fill', 'darkgreen');
            d3.select(divBands[1]).style('fill', '#aa8800');
            d3.select(divBands[2]).style('fill', 'darkred');
          });
        });
      }

    });

  }

  // -------------------------------------------------------------------------------------------------------------------

  createToolBar()
  {
    var $t = this.$toolbar,
      that = this;
    multiform.addIconVisChooser(<Element>$t.node(), this.grid);
    $t.append('i').attr('class', 'fa fa-chevron-left').on('click', ()=>
    {
      var g = that.stratomex.provGraph;
      var s = g.findObject(that);
      if (this.stratomex.canShift(that).left > 0)
      {
        g.push(createSwapColumnCmd(this.stratomex.ref, s, this.stratomex.atRef(that.stratomex.indexOf(that) - 1)));
      }
    });
    $t.append('i').attr('class', 'fa fa-chevron-right').on('click', ()=>
    {
      var g = that.stratomex.provGraph;
      var s = g.findObject(that);
      if (that.stratomex.canShift(that).right < 0)
      {
        g.push(createSwapColumnCmd(this.stratomex.ref, s, that.stratomex.atRef(that.stratomex.indexOf(that) + 1)));
      }
    });
    $t.append('i').attr('class', 'fa fa-expand').on('click', () =>
    {
      var g = this.stratomex.provGraph;
      var s = g.findObject(this);
      g.push(createToggleDetailCmd(s, -1, true));
    });

    $t.append('i').attr('class', 'fa fa-bars').on('click', () =>
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

      //this.stratomex.addColumnWithRange(this.range.dim(0));
    });

    $t.append('i').attr('class', 'fa fa-close').on('click', ()=>
    {
      var g = that.stratomex.provGraph;
      g.push(createRemoveCmd(this.stratomex.ref, g.findObject(that)));
    });
    var w = (18 * (1 + this.grid.visses.length));
    $t.style('min-width', w + 'px');
  }

  // -------------------------------------------------------------------------------------------------------------------

  destroy(within)
  {
    manager.off('select', this.highlightMe);
    manager.remove(this);
    this.$parent.style('opacity', 1).transition().duration(animationTime(within)).style('opacity', 0).remove();
    this.$layoutHelper.remove();
    this.destroyed = true;
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// class for detail view
// TODO! Is this obsolete?

export class DetailView
{
  private $node:d3.Selection<any>;
  private multi:multiform.IMultiForm;

  constructor($parent:d3.Selection<any>, private cluster:number, private data:datatypes.IDataType)
  {

  }

  destroy()
  {
    this.multi.destroy();
    this.$node.remove();
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// class for statistics view
// TODO! Is this obsolete?

export class StatsView
{
  private $node : d3.Selection<any>;
  private divider : clusterDivider.ClusterDivider;

  constructor($parent: d3.Selection<any>, private cluster: number, private data : datatypes.IDataType)
  {

  }

  destroy()
  {
    this.divider.destroy();
    this.$node.remove();
  }
}
