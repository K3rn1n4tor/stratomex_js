/**
 * Created by sam on 30.01.2015.
 */
import d3 = require('d3');
import $ = require('jquery');
import C = require('../caleydo_core/main');
import multiform = require('../caleydo_core/multiform');
import geom = require('../caleydo_core/geom');
import idtypes = require('../caleydo_core/idtype');
import behaviors = require('../caleydo_core/behavior');
import events = require('../caleydo_core/event');
import link_m = require('../caleydo_links/link');
import datatypes = require('../caleydo_core/datatype');
import prov = require('../caleydo_provenance/main');
import ranges = require('../caleydo_core/range');
import vis = require('../caleydo_core/vis');

// my own libraries
import geneHisto = require('../gene_vis/histogram');
import geneSlider = require('../gene_vis/slider');

export function animationTime(within = -1)
{
  return within < 0 ? 50 : within;
}

//guess initial vis method
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

//create a manager for all columns
export const manager = new idtypes.ObjectManager<Column>('_column', 'Column');


/**
 * creates a new column to display stratifications and their link to the data
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
  var column:Column = inputs[0].value,
    cluster = parameter.cluster,
    show = parameter.action === 'show';
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
  return prov.action(prov.meta(act + ' Statistics of ' + column.toString() + ' Cluster "' + cluster + '"', prov.cat.layout),
    'showStratomeXStats', showStats, [column], {
      cluster: cluster,
      action: show ? 'show' : 'hide'
    });
}

// ---------------------------------------------------------------------------------------------------------------------

export function showDivisions(inputs, parameter, graph, within)
{
  var column:Column = inputs[0].value,
    cluster = parameter.cluster,
    show = parameter.action === 'show';
  var r:Promise<any>;
  if (show)
  {
    r = column.showDivisions(cluster, within);
  } else
  {
    r = column.hideDivisions(cluster, within);
  }
  return r.then(() =>
  {
    return {
      inverse: createToggleDivsCmd(inputs[0], cluster, !show),
      consumed: within
    };
  });
}

// TODO create stats cmd
export function createToggleDivsCmd(column, cluster, show)
{
  var act = show ? 'Show' : 'Hide';
  return prov.action(prov.meta(act + ' Divisions of ' + column.toString() + ' Cluster "' + cluster + '"', prov.cat.layout),
    'showStratomeXDivs', showDivisions, [column], {
      cluster: cluster,
      action: show ? 'show' : 'hide'
    });
}

// ---------------------------------------------------------------------------------------------------------------------

export function createChangeVis(column, to, from)
{
  const visses = column.value.grid.visses;
  const vis_desc = visses.filter((v) => v.id === to)[0];
  return prov.action(prov.meta(column.value.name + ' as ' + vis_desc.name, prov.cat.visual), 'changeStratomeXColumnVis', changeVis, [column], {
    to: to,
    from: from
  });
}

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

export function createSetOption(column, name, value, old)
{
  return prov.action(prov.meta('set option "' + name + +'" of "' + column.name + ' to "' + value + '"', prov.cat.visual), 'setStratomeXColumnOption', setOption, [column], {
    name: name,
    value: value,
    old: old
  });
}
export function createColumnCmd(stratomex, data, partitioning, name:string, index:number = -1)
{
  return prov.action(prov.meta(name, prov.cat.data, prov.op.create), 'createStratomeXColumn', createColumn, [stratomex, data], {
    partitioning: partitioning.toString(),
    name: name,
    index: index
  });
}
export function createRemoveCmd(stratomex, column)
{
  return prov.action(prov.meta(column.name, prov.cat.data, prov.op.remove), 'removeStratomeXColumn', removeColumn, [stratomex, column]);
}
export function createSwapColumnCmd(stratomex, columnA, columnB)
{
  return prov.action(prov.meta(`${columnA.name}⇄${columnB.name}`, prov.cat.layout, prov.op.update), 'swapStratomeXColumns', swapColumns, [stratomex, columnA, columnB]);
}

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
    case 'showStratomeXDivs' :
      return showDivisions;
  }
  return null;
}

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
        if (q.f_id === 'showStratomeXInDetail' && q.parameter.action === 'hide' && q.parameter.cluster === cluster && column === q.requires[0])
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

export class Column extends events.EventHandler implements idtypes.IHasUniqueId, link_m.IDataVis
{
  id:number;

  private options = {
    summaryHeight: 90,
    width: 180,
    detailWidth: 500,
    padding: 2,
    name: null
  };

  private $parent:d3.Selection<any>;
  private $toolbar:d3.Selection<any>;
  private $summary:d3.Selection<any>;
  private $clusters:d3.Selection<any>;

  range:ranges.Range;
  private summary:multiform.MultiForm;
  private grid:multiform.MultiFormGrid;

  private grid_zoom:behaviors.ZoomLogic;
  private summary_zoom:behaviors.ZoomLogic;

  private detail:{
    $node: d3.Selection<any>;
    multi: multiform.IMultiForm;
    zoom: behaviors.ZoomBehavior;
    cluster: number;
  };
  /** NEW! statistics view for data */
  private stats:{
    $node: d3.Selection<any>;
    histo: vis.AVisInstance;
    slider: vis.AVisInstance;
    cluster: number;
  };

  /** NEW! divisions view for data */
  private divisions:{
    $node: d3.Selection<any>;
    grid: multiform.MultiFormGrid;
    zoom: behaviors.ZoomLogic;
    cluster: number;
  };

  private $layoutHelper:d3.Selection<any>;


  changeHandler:any;
  optionHandler:any;

  private highlightMe = (event:events.IEvent, type:string, act:ranges.Range) =>
  {
    this.$parent.classed('select-' + type, act.dim(0).contains(this.id));
  };

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
    this.$summary.append('div').attr('class', 'title').style('max-width', (that.options.width - this.options.padding * 2) + 'px').text(this.name).style('background-color', data.desc.bgColor || 'lightgray');
    this.$clusters = this.$parent.append('div').attr('class', 'clusters');
    this.range = partitioning;
    //create the vis
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

    function createWrapper(elem, data, cluster, pos)
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
      $toolbar.append('i').attr('class', 'fa fa-arrows').on('click', () =>
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

      const toggleSelection = () =>
      {
        var isSelected = $elem.classed('select-selected');
        if (isSelected)
        {
          data.select(0, ranges.none());
        } else
        {
          data.select(0, ranges.all());
        }
        $elem.classed('select-selected', !isSelected);
      };
      $elem.append('div').attr('class', 'title').style('max-width', (that.options.width - that.options.padding * 2) + 'px').text(cluster.dim(0).name).on('click', toggleSelection);
      $elem.append('div').attr('class', 'body').on('click', toggleSelection);

      const ratio = cluster.dim(0).length / partitioning.dim(0).length;
      $elem.append('div').attr('class', 'footer').append('div').style('width', Math.round(ratio * 100) + '%');
      return $elem.select('div.body').node();
    }

    const r = (<ranges.CompositeRange1D>partitioning.dim(0));
    //console.log(this.range, r);
    const initialHeight = 500 / (r.groups || []).length;
    //console.log(initialHeight);
    //console.log(this.options.width);

    //console.log(data);
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
      wrap: createWrapper,
      all: {
        selectAble: false,
        total: groupTotalAggregator((<ranges.CompositeRange1D>partitioning.dim(0)).groups.length, (v) => v.largestBin),
        nbins: Math.sqrt(data.dim[0]),
        heightTo: initialHeight
      },
      'caleydo-vis-mosaic': {
        width: that.options.width - this.options.padding * 2
      },
      'caleydo-vis-heatmap1d': {
        width: that.options.width - this.options.padding * 2
      },
      'caleydo-vis-heatmap': {
        scaleTo: [that.options.width - this.options.padding * 2, initialHeight],
        forceThumbnails: true
      },
      'caleydo-vis-kaplanmeier': {
        maxTime: groupTotalAggregator((<ranges.CompositeRange1D>partitioning.dim(0)).groups.length, (v) => v.length === 0 ? 0 : v[v.length - 1])
      }
    });
    //zooming
    this.grid_zoom = new behaviors.ZoomLogic(this.grid, this.grid.asMetaData);
    this.summary_zoom = new behaviors.ZoomLogic(this.summary, this.summary.asMetaData);
    this.grid.on('changed', function (event, to, from)
    {
      that.fire('changed', to, from);
    });
    this.createToolBar();

    this.id = manager.nextId(this);
    manager.on('select', this.highlightMe);
    manager.select([this.id]);

    this.$parent.transition().duration(animationTime(within)).style('opacity', 1);
  }

  setInteractive(interactive:boolean)
  {
    this.$toolbar.style('display', interactive ? null : 'none');
    this.$parent.selectAll('.gtoolbar').style('display', interactive ? null : 'none');

    this.$parent.selectAll('.group .title, .group .body').classed('readonly', !interactive);
  }

  get node()
  {
    return <Element>this.$parent.node();
  }

  get layoutNode()
  {
    return <Element>this.$layoutHelper.node();
  }

  get hashString()
  {
    return this.data.desc.name + '_' + this.range.toString();
  }

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

  ids()
  {
    return this.data.ids(this.range);
  }

  get location()
  {
    const abspos = C.bounds(<Element>this.$layoutHelper.node());
    const parent = C.bounds((<Element>this.$layoutHelper.node()).parentElement);
    return geom.rect(abspos.x - parent.x, abspos.y - parent.y, abspos.w, abspos.h);
  }

  visPos()
  {
    var l = this.location;
    var offset = $(this.$parent.node()).find('div.multiformgrid').position();
    return {
      x: l.x + offset.left,
      y: l.y + offset.top
    };
  }

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

  locate(...args:any[])
  {
    if (args.length === 1)
    {
      return this.locateImpl(args[0]);
    }
    return args.map((arg) => this.locateImpl(arg));
  }

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
    this.$parent.style('width', this.options.width + this.options.detailWidth + 'px');
    this.$layoutHelper.style('width', this.options.width + this.options.detailWidth + 'px');
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
    this.$parent.style('width', this.options.width + 'px');
    this.$layoutHelper.style('width', this.options.width + 'px');
    return this.stratomex.relayout(within);
  }

  // -------------------------------------------------------------------------------------------------------------------

  showStats(cluster, within = -1)
  {
    if (this.stats)
    {
      return Promise.resolve([]);
    }

    var that = this;

    // obtain either full data (if cluster index < 0) or cluster data
    const data = cluster < 0 ? this.data : this.grid.getData(cluster);

    const $elem = this.$parent.append('div').classed('stats', true).style('opacity', 0);
    $elem.classed('group', true).datum(data);

    var dataClusters = <ranges.CompositeRange1D>this.range.dim(0);
    var clusterName = cluster < 0 ? this.data.desc.name : dataClusters.groups[cluster].name;

    var $toolbar = $elem.append('div').attr('class', 'gtoolbar');
    $elem.append('div').attr('class', 'title')
      .text('Statistics of ' + clusterName);

    // create new cluster stats command
    $toolbar.append('i').attr('class', 'fa fa-expand').on('click', () =>
    {
      // first obtain the provenance graph
      var graph = this.stratomex.provGraph;
      // next find the current object / selection / cluster
      var obj = graph.findObject(this);
      // push new command to graph
      graph.push(createToggleDivsCmd(obj, cluster, true));
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

    // try to find vector data

    if (cluster >= 0)
    {
      var r = clusterName.search('K-Means_');

      if (r)
      {
        //var k = parseInt(clusterName[r + 8]);
        var method = clusterName.slice(r, r + 9);

        var distName = data.desc.name + '/' + method + "_Distances_" + String(cluster);
        //console.log(data.desc.name);

        var distances = this.stratomex.findClusterDistancesByName(distName);
        var tempWidth = 196;

        var histo = geneHisto.create(distances, <Element>$body.node(), {
          bins: 10,
          scaleTo: [tempWidth, 50]
        });

        var slider = geneSlider.create(distances, <Element>$body.node(), 2, {
          scaleTo: [tempWidth, 50], bins: 10, starts: [1, 3]
        });


        var nodePosition = $($elem.node()).position();
        var nodeHeight = $($elem.node()).height();
        console.log("node position: ", nodePosition);
        console.log("node height: ", nodeHeight);
        //parentHeight -= this.options.summaryHeight;


        this.stats = {
          $node: $elem,
          histo: histo,
          slider: slider,
          cluster: cluster//nodePosition.top - nodeHeight
        };

      }
    }

    var tempStatsWidth = 200;
    this.$parent.style('width', this.options.width + tempStatsWidth + 'px');
    this.$layoutHelper.style('width', this.options.width + tempStatsWidth + 'px');
    $elem.transition().duration(animationTime(within)).style('opacity', 1);

    return this.stratomex.relayout(within);
  }

  hideStats(cluster, within)
  {
    this.stats.$node.transition().duration(animationTime(within)).style('opacity', 0).remove();
    this.stats = null;

    if (this.divisions)
    {
      this.divisions.$node.transition().duration(animationTime(within)).style('opacity', 0).remove();
      this.divisions = null;
    }

    this.$parent.style('width', this.options.width + 'px');
    this.$layoutHelper.style('width', this.options.width + 'px');

    return this.stratomex.relayout(within);
  }

  // -------------------------------------------------------------------------------------------------------------------

  showDivisions(cluster, within)
  {
    if (this.divisions)
    {
      return Promise.resolve([]);
    }

    // obtain either full data (if cluster index < 0) or cluster data
    const data = cluster < 0 ? this.data : this.grid.getData(cluster);

    const $elem = this.$parent.append('div').classed('divisions', true).style('opacity', 0);
    $elem.classed('group', true).datum(data);

    var dataClusters = <ranges.CompositeRange1D>this.range.dim(0);
    var clusterName = cluster < 0 ? this.data.desc.name : dataClusters.groups[cluster].name;

    var $toolbar = $elem.append('div').attr('class', 'gtoolbar');
    $elem.append('div').attr('class', 'title')
      .text('Divisions of ' + clusterName);

    const $body = $elem.append('div').attr('class', 'body');

    $toolbar.append('i').attr('class', 'fa fa-close').on('click', () =>
    {
      var g = this.stratomex.provGraph;
      var s = g.findObject(this);
      g.push(createToggleDivsCmd(s, cluster, false));
    });

    if (cluster >= 0)
    {
      var r = clusterName.search('K-Means_');

      if (r)
      {
        //var k = parseInt(clusterName[r + 8]);
        var method = clusterName.slice(r, r + 9);

        // divide cluster data in three groups
        var histo = this.stats.histo;
        var slider = this.stats.slider;

        var groups = [];

        var groupSize = dataClusters.groups[cluster].size();
        var sliderRange = <any>[(<geneSlider.DiscreteSlider>slider).getIndex(0), (
          <geneSlider.DiscreteSlider>slider).getIndex(1)];

        var numLikely = (<geneHisto.Histogram>histo).getNumBinElements([0, sliderRange[0]]);
        var numUncertain = (<geneHisto.Histogram>histo).getNumBinElements(sliderRange);
        var numUnlikely = (<geneHisto.Histogram>histo).getNumBinElements([sliderRange[1], 10]);

        var subRanges = [];

        subRanges.push(ranges.parse(Array.apply(null, Array(numLikely))
          .map(function (_, i)
          {
            return i;
          })));
        subRanges.push(ranges.parse(Array.apply(null, Array(numUncertain))
          .map(function (_, i)
          {
            return i + numLikely;
          })));
        subRanges.push(ranges.parse(Array.apply(null, Array(numUnlikely))
          .map(function (_, i)
          {
            return i + numLikely + numUncertain;
          })));

        (<geneHisto.Histogram>histo).colorBars([
          {range: [0, sliderRange[0]], color: 'darkgreen'},
          {range: [sliderRange[0], sliderRange[1]], color: 'darkorange'},
          {range: [sliderRange[1], 10], color: 'darkred'}]);

        var that = this;

        function refreshDivs(cluster, within)
        {
          // first delete old division
          that.divisions.$node.transition().duration(animationTime(within)).style('opacity', 0).remove();
          that.divisions = null;

          var graph = that.stratomex.provGraph;
          // next find the current object / selection / cluster
          var obj = graph.findObject(that);
          // push new command to graph
          graph.push(createToggleDivsCmd(obj, cluster, true));
        }

        function onClickSlider(cluster, within)
        {
          return function (d)
          {
            return refreshDivs(cluster, within);
          }
        }

        d3.select((<geneSlider.DiscreteSlider>slider).node).on('mouseup', onClickSlider(cluster, within));

        var colors = ['darkgreen', 'darkorange', 'darkred'];
        var divGroups = ['certain', 'uncertain', 'outliers'];
        for (var i = 0; i < 3; ++i)
        {
          groups.push(new ranges.Range1DGroup('Cluster Division' + String(i), colors[i], subRanges[i].dim(0)));
        }

        var compositeRange = ranges.composite('ClusterDivisions', groups);
        var divRange = ranges.parse(<any>compositeRange);
        var initHeight = 150;

        // draw multigrid
        function viewFunc(matrix, range, pos)
        {
          return matrix.view(range);
        }

        var that = this;

        function divisionWrapper(elem, data, cluster, pos)
        {
          // select element of current multigrid
          const $elem = d3.select(elem);
          // set to group classed
          $elem.attr('class', 'group ' + divGroups[pos[0]]).datum(data);
          // create new toolbar
          //var $toolbar = $elem.append('div').attr('class','gtoolbar');

          $elem.append('div').attr('class', 'title')
            .style('max-width', (that.options.width - that.options.padding * 4) + 'px')
            .text('Test');

          $elem.append('div').attr('class', 'body');

          return $elem.select('div.body').node();
        }

        var grid = multiform.createGrid(data, divRange, <Element>$body.node(), viewFunc, {
          initialVis: 'caleydo-vis-heatmap',
          singleRowOptimization: false,
          wrap: divisionWrapper,

          'all': {heightTo: initHeight},

          'caleydo-vis-heatmap': {
            initialScale: 1,
            scaleTo: [this.options.width - that.options.padding * 4, initHeight],
            forceThumbnails: true
          }
        });

        this.divisions =
        {
          $node: $elem,
          grid: grid,
          zoom: new behaviors.ZoomLogic(grid, grid.asMetaData),
          cluster: cluster
        };

        var that = this;

        grid.actLoader.then(function ()
        {
          that.divisions.zoom.zoomTo(that.options.width - that.options.padding * 4, initHeight);
        });
      }
    }

    $elem.transition().duration(animationTime(within)).style('opacity', 1);

    var statsWidth = 200;
    var thisWidth = this.options.width;

    this.$parent.style('width', this.options.width + thisWidth + statsWidth + 'px');
    this.$layoutHelper.style('width', this.options.width + thisWidth + statsWidth + 'px');

    return this.stratomex.relayout(within);
  }

  hideDivisions(cluster, within)
  {
    this.divisions.$node.transition().duration(animationTime(within)).style('opacity', 0).remove();
    this.divisions = null;

    var statsWidth = 200;
    this.$parent.style('width', this.options.width + statsWidth + 'px');
    this.$layoutHelper.style('width', this.options.width + statsWidth + 'px');

    return this.stratomex.relayout(within);
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

    //console.log('current sise-x:', size.x);

    if (this.detail)
    {
      var clusterGrid = $(this.$parent.node()).find('div.gridrow')[this.detail.cluster];
      var clusterPosY = $(clusterGrid).position().top;

      size.x -= this.options.detailWidth;
      this.$summary.style('width', size.x + 'px');
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
    if (this.stats)
    {
      var tempWidth = 200;

      var clusterGrid = $(this.$parent.node()).find('div.gridrow')[this.stats.cluster];
      var clusterPosY = $(clusterGrid).position().top;

      size.x -= tempWidth;
      if (this.divisions)
      {
        size.x -= this.options.width;
      }

      var tempStatsHeight = 100 + 22;
      this.$summary.style('width', size.x + 'px');
      this.stats.$node.style({
        width: tempWidth + 'px',
        height: tempStatsHeight + 'px',
        top: clusterPosY + 12 + 'px',
        left: (size.x + this.options.padding * 2) + 'px'
      });
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Resize if divisions are shown

    if (this.divisions)
    {
      var clusterGrid = $(this.$parent.node()).find('div.gridrow')[this.divisions.cluster];
      var clusterPosY = $(clusterGrid).position().top;

      var tempWidth = 200;
      var tempHeight = 150 + 22 + 30;

      //size.x -= tempWidth;
      this.$summary.style('width', size.x + 'px');
      this.divisions.$node.style({
        width: this.options.width + 'px',
        height: tempHeight + 'px',
        top: clusterPosY + 24 + 'px',
        left: (size.x + tempWidth + this.options.padding * 2) + 'px'
      });
    }

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
    });


    //center the toolbar
    //var w = (18 * (1 + this.grid.visses.length));
    //this.$toolbar.style('left', ((size.x - w) / 2) + 'px');
  }

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
    $t.append('i').attr('class', 'fa fa-close').on('click', ()=>
    {
      var g = that.stratomex.provGraph;
      g.push(createRemoveCmd(this.stratomex.ref, g.findObject(that)));
    });
    var w = (18 * (1 + this.grid.visses.length));
    $t.style('min-width', w + 'px');
  }

  destroy(within)
  {
    manager.off('select', this.highlightMe);
    manager.remove(this);
    this.$parent.style('opacity', 1).transition().duration(animationTime(within)).style('opacity', 0).remove();
    this.$layoutHelper.remove();
  }
}

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
