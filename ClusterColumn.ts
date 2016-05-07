/**
 * Created by Michael Kern on 29.02.2016.
 */

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// libraries
import d3 = require('d3');
import $ = require('jquery');
import C = require('../caleydo_core/main');
import idtypes = require('../caleydo_core/idtype');
import link_m = require('../caleydo_d3/link');
import datatypes = require('../caleydo_core/datatype');
//import datas = require('../caleydo_core/data');
import prov = require('../caleydo_clue/prov');
import ranges = require('../caleydo_core/range');
import stratification = require('../caleydo_core/stratification');
import stratification_impl = require('../caleydo_core/stratification_impl');

// my own libraries
import columns = require('./Column');
import clusterView = require('./ClusterDetailView');
import utility = require('./utility');

// popup manager helper pointer
var mergePopupHelper = null;
var similarityPopupHelper = null;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function createCmd(id:string) {
  switch (id) {
    case 'createStratomeXClusterColumn':
      return createClusterColumn;
    case 'createStratomeXHierarchicalClusterColumn':
      return createHierarchicalClusterColumn;
    case 'createStratomeXFuzzyClusterColumn':
      return createFuzzyClusterColumn;
    case 'showStratomeXStats' :
      return showStats;
    case 'showStratomeXProbs' :
      return clusterView.showProbs;
    case 'regroupStratomeXColumn':
      return regroupColumn;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------

function createClusterColumn(inputs, parameter, graph, within) {
  var stratomex = inputs[0].value,
    partitioning = ranges.parse(parameter.partitioning),
    index = parameter.hasOwnProperty('index') ? parameter.index : -1,
    name = parameter.name || inputs[1].name,
    distMetric = parameter.distMetric;

  //console.log(ranges.parse(parameter.partitioning));

  return inputs[1].v.then(function (data) {
    //console.log(new Date(), 'create column', data.desc.name, index);
    var c = new ClusterColumn(stratomex, data, partitioning, inputs[1], {
      width: (data.desc.type === 'stratification') ? 60 : (data.desc.name.toLowerCase().indexOf('death') >= 0 ? 110 : 160),
      name: name, distanceMetric: distMetric
    }, within);
    var r = prov.ref(c, c.name, prov.cat.visual, c.hashString);
    c.changeHandler = function (event, to, from) {
      if (from) { //have a previous one so not the default
        graph.push(columns.createChangeVis(r, to.id, from ? from.id : null));
      }
    };
    c.optionHandler = function (event, name, value, bak) {
      graph.push(columns.createSetOption(r, name, value, bak));
    };
    c.on('changed', c.changeHandler);
    c.on('option', c.optionHandler);

    //console.log(new Date(), 'add column', data.desc.name, index);
    return stratomex.addColumn(c, index, within).then(() => {
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

function createHierarchicalClusterColumn(inputs, parameter, graph, within) {
  var stratomex = inputs[0].value,
    partitioning = ranges.parse(parameter.partitioning),
    index = parameter.hasOwnProperty('index') ? parameter.index : -1,
    name = parameter.name || inputs[1].name,
    dendrogram = inputs[2].value.tree,
    distMetric = parameter.distMetric;

  return inputs[1].v.then(function (data) {
    //console.log(new Date(), 'create column', data.desc.name, index);
    var c = new HierarchicalClusterColumn(stratomex, data, partitioning, dendrogram, inputs[1], {
      width: (data.desc.type === 'stratification') ? 60 : (data.desc.name.toLowerCase().indexOf('death') >= 0 ? 110 : 160),
      name: name, distanceMetric: distMetric
    }, within);
    var r = prov.ref(c, c.name, prov.cat.visual, c.hashString);
    c.changeHandler = function (event, to, from) {
      if (from) { //have a previous one so not the default
        graph.push(columns.createChangeVis(r, to.id, from ? from.id : null));
      }
    };
    c.optionHandler = function (event, name, value, bak) {
      graph.push(columns.createSetOption(r, name, value, bak));
    };
    c.on('changed', c.changeHandler);
    c.on('option', c.optionHandler);

    //console.log(new Date(), 'add column', data.desc.name, index);
    return stratomex.addColumn(c, index, within).then(() => {
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

function createFuzzyClusterColumn(inputs, parameter, graph, within) {
  var stratomex = inputs[0].value,
    partitioning = ranges.parse(parameter.partitioning),
    index = parameter.hasOwnProperty('index') ? parameter.index : -1,
    name = parameter.name || inputs[1].name,
    partitionMatrix = inputs[2].value.partition,
    maxProbability = parameter.maxProb,
    distMetric = parameter.distMetric;

  return inputs[1].v.then(function (data) {
    //console.log(new Date(), 'create column', data.desc.name, index);
    var c = new FuzzyClusterColumn(stratomex, data, partitioning, partitionMatrix, inputs[1], {
      width: (data.desc.type === 'stratification') ? 60 : (data.desc.name.toLowerCase().indexOf('death') >= 0 ? 110 : 160),
      name: name, maxProb: maxProbability, distanceMetric: distMetric
    }, within);
    var r = prov.ref(c, c.name, prov.cat.visual, c.hashString);
    c.changeHandler = function (event, to, from) {
      if (from) { //have a previous one so not the default
        graph.push(columns.createChangeVis(r, to.id, from ? from.id : null));
      }
    };
    c.optionHandler = function (event, name, value, bak) {
      graph.push(columns.createSetOption(r, name, value, bak));
    };
    c.on('changed', c.changeHandler);
    c.on('option', c.optionHandler);

    //console.log(new Date(), 'add column', data.desc.name, index);
    return stratomex.addColumn(c, index, within).then(() => {
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

export function createClusterColumnCmd(stratomex, data, partitioning, distMetric:string,
                                       name:string, index:number = -1) {
  return prov.action(prov.meta(name, prov.cat.data, prov.op.create),
    'createStratomeXClusterColumn', createClusterColumn, [stratomex, data], {
      partitioning: partitioning.toString(),
      name: name,
      index: index,
      distMetric: distMetric
    });
}

// ---------------------------------------------------------------------------------------------------------------------

export function createHierarchicalClusterColumnCmd(stratomex, data, partitioning, distMetric:string, dendrogram,
                                                   name:string, index:number = -1) {
  return prov.action(prov.meta(name, prov.cat.data, prov.op.create),
    'createStratomeXHierarchicalClusterColumn', createHierarchicalClusterColumn, [stratomex, data, dendrogram], {
      partitioning: partitioning.toString(),
      name: name,
      index: index,
      distMetric: distMetric
    });
}

// ---------------------------------------------------------------------------------------------------------------------

export function createFuzzyClusterColumnCmd(stratomex, data, partitioning, distMetric:string, partitionMatrix,
                                            maxProb:number, name:string, index:number = -1) {
  return prov.action(prov.meta(name, prov.cat.data, prov.op.create),
    'createStratomeXFuzzyClusterColumn', createFuzzyClusterColumn, [stratomex, data, partitionMatrix], {
      partitioning: partitioning.toString(),
      name: name,
      index: index,
      maxProb: maxProb,
      distMetric: distMetric
    });
}

// ---------------------------------------------------------------------------------------------------------------------

export function regroupColumn(inputs, parameter, graph, within) {
  var column:any = inputs[0].value;

  const noStatsUpdate = parameter.noStatsUpdate;
  var rangeString = parameter.range;
  var range:ranges.CompositeRange1D = <ranges.CompositeRange1D>ranges.parse(rangeString).dim(0);

  var r:Promise<any>;

  var oldRange = column.getRange().dim(0);
  r = column.updateGrid(range, noStatsUpdate);

  // update dependent column if available
  if (column.dependentColumn !== null) {
    var obj = graph.findObject(column.dependentColumn);

    if (obj !== null) {
      var ran = ranges.list(range);
      var m = column.dependentColumn.data;
      column.data.ids(ran).then(m.fromIdRange.bind(m)).then((target) => {
        column.dependentColumn.updateGrid(target.dim(0));
      });
    }
  }

  return r.then(() => {
    return {
      inverse: createRegroupColumnCmd(inputs[0], oldRange, false),
      consumed: within
    };
  });
}

// ---------------------------------------------------------------------------------------------------------------------

export function createRegroupColumnCmd(column, range, noStatsUpdate = false) {
  return prov.action(prov.meta('Regrouping of ' + column.toString(), prov.cat.layout),
    'regroupStratomeXColumn', regroupColumn, [column], {
      noStatsUpdate: noStatsUpdate, range: range.toString()
    });
}

// ---------------------------------------------------------------------------------------------------------------------

function showStats(inputs, parameter, graph, within) {
  var column:ClusterColumn = inputs[0].value;
  var cluster = parameter.cluster;
  var show = parameter.action === 'show';
  var metric = parameter.metric;
  var sorted = parameter.sorted;

  var r:Promise<any>;
  if (show) {
    r = column.showStats(cluster, within, true, false, metric, sorted);
  } else {
    r = column.hideStats(cluster, within);
  }
  return r.then(() => {
    return {
      inverse: createToggleStatsCmd(inputs[0], cluster, !show, metric, sorted),
      consumed: within
    };
  });
}

// ---------------------------------------------------------------------------------------------------------------------

export function createToggleStatsCmd(column, cluster, show, metric:string='euclidean', sorted:boolean=true) {
  var act = show ? 'Show' : 'Hide';
  return prov.action(prov.meta(act + ' Distances of ' + column.toString() + ' Cluster "' + cluster + '"', prov.cat.layout),
    'showStratomeXStats', showStats, [column], {
      cluster: cluster,
      action: show ? 'show' : 'hide',
      metric: metric,
      sorted: sorted
    });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// class definition

/**
 * Represents a column created by any cluster algorithm. Provides tools to analyze clusters / stratifications within
 * that column.
 */
export class ClusterColumn extends columns.Column {
  protected statsViews:clusterView.ClusterDetailView[] = []; // array of all distance views for this column TODO: rename to distanceViews
  protected activeDivision:ClusterColumn[] = []; // TODO!: check if we still need the tracking of active divisions
  protected distancesRange:[number, number] = null;

  // NEW collect all previous / preceding stratifications
  public prevStratis:any[] = [];
  public nextStratis:any[] = [];

  constructor(protected stratomex, public data, partitioning:ranges.Range, public dataRef, options:any = {}, within = -1) {
    super(stratomex, data, partitioning, dataRef, options, within);

    this.options = C.mixin({
      summaryHeight: 90,
      width: 160,
      detailWidth: 500,
      statsWidth: 50, // this is the default width for the distance view TODO: rename to distanceWidth
      extOffset: 30,
      matrixWidth: 140,
      padding: 2,
      name: null,
      distanceMetric: 'euclidean'
    }, this.options);

    this.on('relayouted', this.relayoutAfterHandler);
    const numGroups = (<any>this.range.dim(0)).groups.length;
    this.statsViews = Array.apply(null, Array(numGroups)).map((_, i) => {
      return null;
    });
  }

  /**
   * Create the toolbar of the column.
   */
  createToolBar() {
    const that = this;
    var $t = this.$toolbar;

    super.createToolBar();

    $t.insert('i', '.fa-close').attr('class', 'fa fa-rotate-left').attr('title','Get previous stratification')
      .on('click', () => {
      var compositeRange = that.prevStratis.splice(0, 1)[0];

      if (compositeRange != null || typeof compositeRange !== 'undefined') {
        // copy composite range
        var oldCompositeRange = <any>that.range.dim(0);
        var copyCompositeRange = $.extend(true, {}, oldCompositeRange);
        that.nextStratis.splice(0, 0, copyCompositeRange);

        var graph = that.stratomex.provGraph;
        var obj = graph.findObject(that);

        // regroup column
        graph.push(createRegroupColumnCmd(obj, compositeRange));
      }
    });

    $t.insert('i', '.fa-close').attr('class', 'fa fa-rotate-right').attr('title','Get next stratification')
      .on('click', () => {
      var compositeRange = that.nextStratis.splice(0, 1)[0];

      if (compositeRange != null || typeof compositeRange !== 'undefined') {
        // copy composite range
        var oldCompositeRange = <any>that.range.dim(0);
        var copyCompositeRange = $.extend(true, {}, oldCompositeRange);
        that.prevStratis.splice(0, 0, copyCompositeRange);

        var graph = that.stratomex.provGraph;
        var obj = graph.findObject(that);

        // regroup column
        graph.push(createRegroupColumnCmd(obj, compositeRange));
      }
    });
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Update this column by means of a new stratification (compositeRange).
   * @param range
   * @param noStatsUpdate
   * @returns {Promise<TResult>|Promise<U>}
   */
  updateGrid(range:ranges.CompositeRange1D, noStatsUpdate = false) {
    //d3.select(this.node).transition().duration(animationTime(-1)).style('opacity', 0);
    d3.select(this.grid.node).transition().duration(columns.animationTime(-1)).style('opacity', 0);
    this.grid.destroy();

    var that = this;

    var compositeRange = <ranges.CompositeRange1D>that.range.dim(0);
    that.range = ranges.parse(range.toString());

    const oldNumGroups = range.groups.length;
    const newNumGroups = compositeRange.groups.length;
    const groupsChanged = (newNumGroups !== oldNumGroups);

    // reset layout of column
    that.setColumnWidth(!noStatsUpdate);

    var promise = that.stratomex.relayout();

    // recreate grid and fire changed option
    that.createMultiGrid(that.range, that.data);

    return promise.then((_:any) => {
      var promises = (!noStatsUpdate) ? that.onUpdate(groupsChanged) : [];

      return Promise.all(promises).then((_) => {
        return that.stratomex.relayout();
      });

    });
  }

  // -------------------------------------------------------------------------------------------------------------------

  protected onUpdate(groupsChanged:boolean) {
    const that = this;

    const numGroups = (<any>that.range.dim(0)).groups.length;

    if (groupsChanged) {
      this.distancesRange = null;
    }

    var oldStatsViews = this.statsViews.slice();
    this.statsViews = Array.apply(null, Array(numGroups)).map(() => {
      return null;
    });

    var promises:any[] = [];

    for (var i = 0; i < oldStatsViews.length; ++i) {
      var statsView = oldStatsViews[i];

      if (statsView != null) {
        statsView.distanceView.destroy();
        statsView.$mainNode.remove();
        statsView.matrixView.destroy();
        statsView.$matrixNode.remove();

        var metric = statsView.metric;

        for (var k = 0; k < statsView.$extNodes.length; ++k) {
          if (statsView.externalViews[k]) {
            statsView.externalViews[k].destroy();
          }
          statsView.$extNodes[k].remove();
        }

        if (statsView.visible && !groupsChanged) {
          promises.push(this.showStats(i, -1, false, statsView.matrixMode, metric));
        }
      }
    }

    Promise.all(promises).then(() => {
      that.statsViews.forEach((d:clusterView.ClusterDetailView) => {
        if (d && d.visible) {
          d.show(-1);
        }
      });
    });

    return promises;
  }

  // -------------------------------------------------------------------------------------------------------------------

  protected createGridToolbar(elem, data, cluster, pos, $toolbar:d3.Selection<any>) {
    const that = this;
    const numGroups = (<any>this.range.dim(0)).groups.length;

    function toggleDistanceView(metric: string, sorted: boolean) {
      // first obtain the provenance graph
      var graph = that.stratomex.provGraph;
      // next find the current object / selection / cluster
      var obj = graph.findObject(that);
      // push new command to graph
      graph.push(createToggleStatsCmd(obj, pos[0], true, metric, sorted));
    }

    // create new cluster stats command
    $toolbar.append('i').attr('class', 'fa fa-sort-amount-asc').attr('title', 'Show within-cluster distances')
      .on('click', () => {

      if (similarityPopupHelper != null) {
        similarityPopupHelper.destroy();
      }

      // first show popup to select similarity metric
      similarityPopupHelper = utility.createSimilarityPopup(elem, that, pos[0], {
        similarityMetric: that.options.distanceMetric, triggerFunc: toggleDistanceView});

      // stop propagation to disable further event triggering
      d3.event.stopPropagation();
    });

    // add new command with symbol fa-expand
    $toolbar.append('i').attr('class', 'fa fa-expand').attr('title', 'Detail View')
      .on('click', () => {
      // first obtain the provenance graph
      var graph = that.stratomex.provGraph;
      // next find the current object / selection / cluster
      var obj = graph.findObject(that);
      // push new command to graph
      graph.push(columns.createToggleDetailCmd(obj, pos[0], true));
      // stop propagation to disable further event triggering
      d3.event.stopPropagation();
    });

    if (numGroups > 1) {
      // create new cluster merge command
      $toolbar.append('i').attr('class', 'fa fa-link').attr('title', 'Merge with other cluster')
        .on('click', () => {

        if (mergePopupHelper != null) {
          mergePopupHelper.destroy();
        }
        mergePopupHelper = utility.createMergePopup(data, elem, this, pos[0], numGroups, {});

        // stop propagation to disable further event triggering
        d3.event.stopPropagation();
      });

      // enable possibility to remove group from column
      $toolbar.append('i').attr('class', 'fa fa-times-circle').attr('title', 'Exclude from stratification')
        .on('click', () => {
        const groupID = pos[0];

        var oldCompositeRange = (<any>that.range.dim(0));
        var copyCompositeRange = $.extend(true, {}, oldCompositeRange);
        that.prevStratis.splice(0, 0, copyCompositeRange);
        var groups = oldCompositeRange.groups.slice();
        groups.splice(groupID, 1);

        for (var i = groupID; i < numGroups - 1; ++i) {
          var groupCopy = $.extend(true, {}, groups[i]);
          groupCopy.name = 'Group ' + i;
          groups[i] = groupCopy;
        }

        var compositeRange = ranges.composite(oldCompositeRange.name, groups);

        var graph = that.stratomex.provGraph;
        var obj = graph.findObject(that);

        // regroup column
        graph.push(createRegroupColumnCmd(obj, compositeRange));

        d3.event.stopPropagation();
      });
    }
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Defines building process of multigrid.
   * @param partitioning
   * @returns {function(any, any, any, any): EventTarget}
   */
  protected multiGridWrapper(partitioning) {
    var that = this;
    this.range = partitioning;

    var createWrapper = function (elem, data, cluster, pos) {
      // select element of current multigrid
      const $elem = d3.select(elem);
      // set to group classed
      $elem.classed('group', true).datum(data);
      // create new toolbar
      var $toolbar = $elem.append('div').attr('class', 'gtoolbar');
      that.createGridToolbar(elem, data, cluster, pos, $toolbar);

      const toggleSelection = () => {
        var isSelected = $elem.classed('caleydo-select-selected');
        if (isSelected) {
          data.select(0, ranges.none());
        } else {
          data.select(0, ranges.all());
        }
        $elem.classed('caleydo-select-selected', !isSelected);
      };

      $elem.append('div').attr('class', 'title').style('max-width', (that.options.width - that.options.padding * 2) + 'px')
        .text(cluster.dim(0).name).on('click', toggleSelection);
      var $body = $elem.append('div').attr('class', 'body');
      $body.on('click', toggleSelection);

      const ratio = cluster.dim(0).length / that.range.dim(0).length;
      $elem.append('div').attr('class', 'footer').append('div').style('width', Math.round(ratio * 100) + '%');
      return $body.node();

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
  protected resizeDetail(within, hide = false) {
    this.setColumnWidth();
    return this.stratomex.relayout(within);
  }

  // -------------------------------------------------------------------------------------------------------------------

  protected determineColumnWidth(reset = false) {
    var layoutWidth = this.options.width;
    if (this.detail) {
      layoutWidth += this.options.detailWidth;
    }

    var statsWidth = Math.max.apply(Math, this.statsViews.map((stat) => {
      return (stat) ? stat.getWidth() : 0;
    }));
    statsWidth = Math.max(statsWidth, 0);
    layoutWidth += statsWidth;

    return (reset) ? this.options.width : layoutWidth;
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Update width of this column for relayouting.
   * @param reset
   */
  protected setColumnWidth(reset = false) {
    const layoutWidth = this.determineColumnWidth(reset);

    this.$parent.style('width', layoutWidth + 'px');
    this.$layoutHelper.style('width', layoutWidth + 'px');
  }

  // -------------------------------------------------------------------------------------------------------------------

  mergeClusters(clusterID:number, otherClusterID:number) {
    // get old stratification
    var oldCompositeRange = (<any>this.range.dim(0));
    var numGroups = oldCompositeRange.groups.length;
    // make a copy of the composite range via JQuery
    var copyCompositeRange = $.extend(true, {}, oldCompositeRange);
    // add to previous stratifications
    this.prevStratis.splice(0, 0, copyCompositeRange);
    // make copy of groups
    var groups = oldCompositeRange.groups.slice();
    // merge clusters
    var group1 = groups[clusterID];
    var group2 = groups[otherClusterID];

    // create new group
    var newLabels = group1.asList().concat(group2.asList());

    // filter redundant indices for fuzzy-clustering
    function sortNumbers(a, b) {
      return a - b;
    }

    newLabels.sort(sortNumbers);

    // for that purpose, use an hash table
    var seen = {};
    // and filter all unique indices
    // see http://stackoverflow.com/questions/9229645/remove-duplicates-from-javascript-array
    newLabels = newLabels.filter((item:any) => {
      return seen.hasOwnProperty(item) ? false : (seen[item] = true);
    });

    groups[clusterID] = new ranges.Range1DGroup('Group ' + clusterID, 'grey', ranges.parse(newLabels).dim(0));
    // remove other group
    groups.splice(otherClusterID, 1);

    for (var i = otherClusterID; i < numGroups - 1; ++i) {
      var groupCopy = $.extend(true, {}, groups[i]);
      groupCopy.name = 'Group ' + i;
      groups[i] = groupCopy;
    }

    var compositeRange = ranges.composite(oldCompositeRange.name, groups);

    var graph = this.stratomex.provGraph;
    var obj = graph.findObject(this);

    // regroup column
    graph.push(createRegroupColumnCmd(obj, compositeRange));

    d3.event.stopPropagation();
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Show detailed cluster view for certain stratification.
   * @param cluster
   * @param within
   * @param relayout
   * @param matrixMode
   * @param metric
   * @returns {any}
   */
  showStats(cluster, within = -1, relayout = true, matrixMode:boolean = false, metric:string = 'euclidean',
            sorted:boolean=true) {
    var statsView = this.statsViews[cluster];

    if (statsView != null) {

      if (statsView.metric !== metric) {
        statsView.distanceView.destroy();
        statsView.$mainNode.remove();
        statsView.matrixView.destroy();
        statsView.$matrixNode.remove();

        for (var k = 0; k < statsView.$extNodes.length; ++k) {
          if (statsView.externalViews[k]) {
            statsView.externalViews[k].destroy();
          }
          statsView.$extNodes[k].remove();
        }

      } else {
        statsView.show(within);

        this.setColumnWidth();
        return (relayout) ? this.stratomex.relayout(within) : Promise.resolve([]);
      }
    }

    const that = this;

    var newStatsView:clusterView.ClusterDetailView = new clusterView.ClusterDetailView(cluster, this.data, this.range,
      metric, {matrixWidth: this.options.matrixWidth, matrixMode: matrixMode, sorted: sorted});
    var promise = newStatsView.build(this.$parent, this);

    this.statsViews[cluster] = newStatsView;

    that.setColumnWidth();

    return promise.then((args) => {
      //that.createClusterDetailToolbar(cluster, newStatsView.$toolbar, matrixMode, within);
      if (!relayout) {
        newStatsView.$mainNode.classed('hidden', true);
        newStatsView.$matrixNode.classed('hidden', true);
        newStatsView.$extNodes.forEach((d:d3.Selection<any>) => {
          d.classed('hidden', true);
        });
      }
      const compositeRange = args[0];
      if (relayout) {
        var graph = that.stratomex.provGraph;
        var obj = graph.findObject(that);

        // regroup column
        graph.push(createRegroupColumnCmd(obj, compositeRange, true));
      } else {
        Promise.resolve([]);
      }
    });
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Hide cluster detail view.
   * @param cluster
   * @param within
   * @returns {Promise<void>}
   */
  hideStats(cluster, within) {
    var statsView = this.statsViews[cluster];
    statsView.hide(within);

    this.setColumnWidth();
    return this.stratomex.relayout(within);
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Divides current stratification into three groups and creates new column.
   * @param view
   * @param cluster
   * @param column
   * @returns {Promise<Array>}
   */
  showDivisions(view:any, cluster:number, column:ClusterColumn = null) {
    //const subData = (cluster < 0) ? this.data : this.grid.getData(cluster);
    const data = this.data;
    const dataName = data.desc.name;
    const dataFQ = data.desc.fqname;
    const dataID = data.desc.id;

    //var statsView = this.statsViews[cluster];

    if (view == null) {
      return Promise.resolve([]);
    }

    var index = this.activeDivision.indexOf(view.column);
    if (index !== -1 && column == null) {
      return Promise.resolve([]);
    }

    var divider = (view instanceof clusterView.ClusterDetailView) ? view.distanceView : view.probabilityView;
    const numDivs = divider.getNumberDivisions();
    var that = this;

    var dataClusters = <ranges.CompositeRange1D>this.range.dim(0);
    var clusterName = dataClusters.groups[cluster].name;
    var numClusters = dataClusters.groups.length;

    var rStart = clusterName.search(/\(/);
    var rEnd = clusterName.search(/\)/);

    var groupName = (rStart === -1) ? clusterName : clusterName.slice(0, rStart);
    var method = clusterName.slice(rStart, rEnd);

    // obtain sub-ranges from cluster divider, either real labels or ranges (min:max) if there's no column
    var subRanges = divider.getDivisionRanges(column == null);

    // create new range groups
    var rangeGroups = [];
    var groups = [];
    var groupsDesc = [];
    var stratiSize = 0;
    for (var i = 0; i < numDivs; ++i) {
      var groupSize = subRanges[i].length;
      stratiSize += groupSize;

      rangeGroups.push(ranges.parse(subRanges[i]));
      groups.push(new ranges.Range1DGroup(groupName + ' Div ' + String(i),
        'grey', rangeGroups[i].dim(0)));

      groupsDesc.push({name: 'Division ' + String(i), size: groupSize});
    }

    var compositeRange = ranges.composite(dataName + 'divisions', groups);

    // create a new stratification description
    var descStrati = {
      id: dataID + method + String(numClusters) + 'Division' + String(cluster),
      fqname: 'none', name: dataName + '/' + method + '_' + String(numClusters) + '_Division_' + String(cluster),
      origin: dataFQ, size: stratiSize, ngroups: numDivs, type: 'stratification', groups: groupsDesc,
      idtype: 'patient',
      ws: 'random' // TODO: figure out what this parameter is
    };

    Promise.all([(<any>data).rows(), (<any>data).rowIds()]).then((args) => {
      // obtain the rows and rowIDs of the data
      var rows = args[0];
      var rowIds = args[1];

      var rowLabels = rowIds.dim(0).asList();
      var labels = dataClusters.groups[cluster].asList();

      // create a new startification of the data
      var strati:stratification.IStratification;

      if (column == null) {
        // It is important to rearrange the rows and rowIds since we create a new column since matrix is resolved
        // by means of these ids (rowMatrix.fromIds()), otherwise clusters are not displayed correctly
        var newRows = [];
        var newRowIds = [];

        for (var j = 0; j < labels.length; ++j) {
          newRows.push(rows[labels[j]]);
          newRowIds.push(rowLabels[labels[j]]);
        }

        // create the new stratification and add the column to StratomeX
        strati = stratification_impl.wrap(<datatypes.IDataDescription>descStrati, newRows, newRowIds, <any>compositeRange);
        that.stratomex.addClusterData(strati, data, that.options.distanceMetric);
        that.connectSignal = {view: view, cluster: cluster};

      } else {
        //strati = stratification_impl.wrap(<datatypes.IDataDescription>descStrati, rows, rowIds, <any>compositeRange);
        var graph = that.stratomex.provGraph;
        var obj = graph.findObject(column);

        // regroup column
        graph.push(createRegroupColumnCmd(obj, compositeRange));
      }
    });
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Regroups all the stratifications of this column by analyzing distances of patients to each cluster centroid.
   * @param cluster
   * @returns {Promise<Array>}
   */
  protected regroupCluster(cluster:number, metric:string) {
    var statsView = this.statsViews[cluster];
    var that = this;
    console.log(that);

    if (statsView == null) {
      return Promise.resolve([]);
    }

    const clusterLabels = statsView.distanceView.getLabels();

    var distanceVec:any[] = [];

    for (var j = 0; j < statsView.externalViews.length; ++j) {
      if (j === cluster) {
        continue;
      }

      distanceVec.push(statsView.externalViews[j].data);
    }

    // insert cluster into distance vectors
    distanceVec.splice(cluster, 0, statsView.distanceView.data);

    var oldCompositeRange = <ranges.CompositeRange1D>this.range.dim(0);
    var copyCompositeRange = $.extend(true, {}, oldCompositeRange);
    that.prevStratis.splice(0, 0, copyCompositeRange);

    const numGroups = copyCompositeRange.groups.length;
    //compositeRange.groups.splice(cluster, 1);

    var newLabels:any[] = Array.apply(null, Array(numGroups)).map((_, i) => {
      return [];
    });

    const correlationUsed = (['pearson', 'spearman', 'kendall'].indexOf(metric) >= 0);
    //console.log("Correlation is used:", correlationUsed);

    for (var i = 0; i < distanceVec[0].length; ++i) {
      var tempArray = [];

      for (var k = 0; k < distanceVec.length; ++k) {
        tempArray.push(distanceVec[k][i]);
      }

      var chosenDist = 0;

      if (correlationUsed) {
        chosenDist = Math.max.apply(Math, tempArray);
      } else {
        chosenDist = Math.min.apply(Math, tempArray);
      }

      var chosenIndex = tempArray.indexOf(chosenDist);

      newLabels[chosenIndex].push(clusterLabels[i]);
    }

    //console.log("New sorted labels:", newLabels);

    var finalLabels = Array.apply(null, new Array(numGroups)).map((_, i) => {
      return [];
    });

    for (var i = 0; i < numGroups; ++i) {
      if (i !== cluster) {
        // create new group
        let labels = copyCompositeRange.groups[i].asList();
        finalLabels[i] = labels.concat(newLabels[i]);
        //console.log("New labels of cluster ", i, finalLabels);
      } else {
        finalLabels[i] = newLabels[i];
      }

      // remove redundant entries for fuzzy-clustering case
      function sortNumbers(a, b) {
        return a - b;
      }

      finalLabels[i].sort(sortNumbers);

      // for that purpose, use an hash table
      var seen = {};
      // and filter all unique indices
      // see http://stackoverflow.com/questions/9229645/remove-duplicates-from-javascript-array
      finalLabels[i] = finalLabels[i].filter((item:any) => {
        return seen.hasOwnProperty(item) ? false : (seen[item] = true);
      });
    }

    //console.log('Final labels:', finalLabels);

    // first from groups
    var groups = <any>[];
    var groupsDesc = <any>[];
    var clusterRanges = <any>[];

    for (var j = 0; j < numGroups; ++j) {
      let labels = finalLabels[j];
      clusterRanges.push(ranges.parse(labels));
    }

    for (var i = 0; i < numGroups; ++i) {
      //clusterRanges.push(ranges.parse(finalLabels[i]));
      groups.push(new ranges.Range1DGroup('Group ' + String(i),
        'red', clusterRanges[i].dim(0)));
      groupsDesc.push({name: 'Group ' + String(i), size: finalLabels[i].length});
    }

    const dataName = this.data.desc.name;

    var newCompositeRange = ranges.composite(dataName + 'cluster', groups);

    // update this column
    var graph = that.stratomex.provGraph;
    var obj = graph.findObject(that);

    // regroup column
    graph.push(createRegroupColumnCmd(obj, newCompositeRange));

    // update dependent column
    // obj = graph.findObject(that.dependentColumn);
    //
    // if (obj !== null) {
    //   console.log(newCompositeRange);
    //
    //   var r = ranges.list(newCompositeRange);
    //   var m = that.dependentColumn.data;
    //   that.data.ids(r).then(m.fromIdRange.bind(m)).then((target) => {
    //     console.log(target.dim(0));
    //
    //     that.dependentColumn.updateGrid(target.dim(0));
    //   });
      //graph.push(createRegroupColumnCmd(obj, compositeRange));
    //}
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Relayout column.
   * @param within
   */
  layouted(within = -1) {
    super.layouted(within);
  }

  // -------------------------------------------------------------------------------------------------------------------

  protected resizeColumn(size:any, within = -1) {
    // Resize if statistics are shown
    const numGroups = (<any>this.range.dims[0]).groups.length;

    // Obtain maximum size of all stats views
    var statsWidth = Math.max.apply(Math, this.statsViews.map((stat) => {
      return (stat) ? stat.getWidth() : 0;
    }));
    statsWidth = Math.max(statsWidth, 0);

    size.x -= statsWidth;

    // check if any column was removed and update active divisions
    for (var j = 0; j < numGroups; ++j) {
      var statsView = this.statsViews[j];
      if (statsView == null) {
        continue;
      }

      if (statsView.column != null) {
        if (statsView.column.destroyed) {
          var index = this.activeDivision.indexOf(statsView.column);
          statsView.removeColumn(this);
          this.activeDivision.splice(index, 1);
        }
      }
    }
  }

  // -------------------------------------------------------------------------------------------------------------------

  protected onActionLoader(size:any) {
    const that = this;
    const numGroups = (<any>this.range.dims[0]).groups.length;

    // go through all stats view and determine their position
    // resize cluster windows since their height should correspond to the heatmap height
    for (var j = 0; j < numGroups; ++j) {
      var statsView = this.statsViews[j];

      if (statsView == null) {
        continue;
      }
      if (statsView.visible === true) {

        var clusterGrid = $(this.$parent.node()).find('div.gridrow')[j];
        var clusterPosY = $(clusterGrid).position().top;
        var clusterHeight = $(clusterGrid).height() - 10;
        var boxChartHeight = $(clusterGrid).height() - 18 - 10 - 2 * this.options.padding;

        if (!statsView.$mainNode) {
          continue;
        }

        statsView.$mainNode.style(
          {
            width: this.options.statsWidth + 'px',
            height: clusterHeight + 'px',
            top: clusterPosY + 'px',
            left: (size.x + this.options.padding * 2) + 'px'
          });

        statsView.mainZoom.zoomTo(this.options.statsWidth - this.options.padding * 2, boxChartHeight);

        if (statsView.matrixMode) {
          statsView.$matrixNode.style(
            {
              width: this.options.matrixWidth + 'px',
              height: clusterHeight + 'px',
              top: clusterPosY + 'px',
              left: (size.x + this.options.statsWidth + this.options.extOffset + this.options.padding * 2) + 'px'
            });

          statsView.zoomMatrixView.zoomTo(this.options.matrixWidth - this.options.padding * 2, boxChartHeight);
        } else {
          if (statsView.externVisible) {
            for (var k = 0; k < statsView.$extNodes.length; ++k) {
              if (k !== statsView.cluster) {
                statsView.extZooms[k].zoomTo(this.options.statsWidth - this.options.padding * 2, boxChartHeight);
              }

              statsView.$extNodes[k].style({
                width: this.options.statsWidth + 'px',
                height: clusterHeight + 'px',
                top: clusterPosY + 'px',
                left: (size.x + this.options.statsWidth + this.options.padding * 2 + this.options.statsWidth * k + this.options.extOffset) + 'px'
              });
            }
          }
        }
      }
    }

    if (this.connectSignal != null) {
      var view = this.connectSignal.view;
      var divider = (view instanceof clusterView.ClusterDetailView) ? view.distanceView : view.probabilityView;

      function refreshColumn(view:any, cluster:number, column:ClusterColumn) {
        if (column == null) {
          return;
        }
        if (divider.hasChanged()) {
          that.showDivisions(view, cluster, column);
        }
      }

      function onClickSlider(view:any, cluster:number, column:ClusterColumn) {
        return function (d) {
          return refreshColumn(view, cluster, column);
        };
      }

      var newColumn = this.stratomex.getLastColumn();
      view.column = newColumn;

      d3.select(divider.node)
        .on('mouseup', onClickSlider(view, this.connectSignal.cluster, newColumn));

      this.connectSignal = null;

      this.activeDivision.push(newColumn);
    }
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Kind of hack to handle coloring of bands (column to divisions) after the relayout process.
   * @param event
   */
  relayoutAfterHandler(event) {
    var that = event.target;

    const numGroups = (<any>that.range.dims[0]).groups.length;
    if (that.statsViews.length === 0) {
      return;
    }

    for (var j = 0; j < numGroups; ++j) {
      var statsView = that.statsViews[j];

      if (statsView == null) {
        continue;
      }
      if (statsView.visible === true) {
        Promise.resolve(statsView).then((stats:any) => {
          // 500ms is chosen as it takes time to switch column IDs
          C.resolveIn(500).then(() => {
            if (stats.column == null) {
              return;
            }

            //var linkSVG = d3.select('.link-container svg');

            var colID = that.id;
            var nextID = stats.column.id;

            var minID = Math.min(colID, nextID);
            var maxID = Math.max(colID, nextID);
            //console.log('column:',minID, maxID);

            if (Math.abs(colID - nextID) !== 1) {
              return;
            }

            // get current links between column minID and maxID and look for the bands
            var idRequest = 'g[data-id="' + String(minID) + '-' + String(maxID) + '"]';
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

            if (divBands.length !== 3) {
              //console.log('three bands not found --> restarting again');
              that.fire('relayouted');
              return;
            }

            // sort bands by means of their y-position
            divBands.sort((l:any, r:any) => {
              return $(l).position().top - $(r).position().top;
            });

            var tempBackgrounds = ['#66c2a4', '#b2e2e2', '#edf8fb'];

            for (var j = 0; j < 3; ++j) {
              d3.select(divBands[j]).style('fill', tempBackgrounds[j]);
            }
          });
        });
      }
    }
  }

}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export class FuzzyClusterColumn extends ClusterColumn implements idtypes.IHasUniqueId, link_m.IDataVis {
  private probsViews:clusterView.ClusterProbView[] = [];
  private noProbs:boolean = false;

  // -------------------------------------------------------------------------------------------------------------------

  constructor(protected stratomex, public data, partitioning:ranges.Range, private partitionMatrix:any, public dataRef,
              options:any = {}, within = -1) {
    super(stratomex, data, partitioning, dataRef, options, within);
    this.options = C.mixin({maxProb: 0.5}, this.options);

    const numGroups = (<any>partitioning.dim(0)).groups.length;
    this.probsViews = Array.apply(null, Array(numGroups)).map((_, i) => {
      return null;
    });
  }

  // -------------------------------------------------------------------------------------------------------------------

  protected createGridToolbar(elem, data, cluster, pos, $toolbar:d3.Selection<any>) {
    const that = this;

    super.createGridToolbar(elem, data, cluster, pos, $toolbar);

    if (!this.noProbs) {
      $toolbar.insert('i', '.fa-sort-amount-asc').attr('class', 'fa fa-align-left').attr('title', 'Show probabilities')
        .on('click', () => {
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
  }

  // -------------------------------------------------------------------------------------------------------------------

  protected onUpdate(groupsChanged:boolean) {
    const that = this;

    var promises = super.onUpdate(groupsChanged);

    var numGroups = (<any>that.range.dim(0)).groups.length;

    var oldProbsViews = this.probsViews.slice();
    this.probsViews = Array.apply(null, Array(numGroups)).map(() => {
      return null;
    });

    for (var i = 0; i < oldProbsViews.length; ++i) {
      var probsView = oldProbsViews[i];

      if (probsView != null) {
        probsView.probabilityView.destroy();
        probsView.$mainNode.remove();
        probsView.$matrixNode.remove();

        for (var k = 0; k < probsView.$extNodes.length; ++k) {
          if (k !== probsView.cluster) {
            probsView.externalViews[k].destroy();
          }
          probsView.$extNodes[k].remove();
        }

        if (probsView.visible && !groupsChanged) {
          promises.push(this.showProbs(i, -1, false));
        }
      }
    }

    Promise.all(promises).then(() => {
      if (!groupsChanged) {
        that.probsViews.forEach((d:clusterView.ClusterProbView) => {
          if (d && d.visible) {
            d.show(-1);
          }
        });
      } else {
        that.noProbs = true;
      }

      for (var i = 0; i < numGroups && groupsChanged; ++i) {
        var gridRow = that.$parent.select('.gridrow:nth-child(' + String(i + 1) + ')');
        gridRow.select('.gtoolbar').select('.fa-align-left').remove();
      }
    });

    return promises;
  }

  // -------------------------------------------------------------------------------------------------------------------

  protected determineColumnWidth(reset = false) {
    var layoutWidth = this.options.width;
    if (this.detail) {
      layoutWidth += this.options.detailWidth;
    }


    const numGroups = (<any>this.range.dims[0]).groups.length;
    var statsProbsWidth = 0;

    for (var i = 0; i < numGroups; ++i) {
      var width = (this.statsViews[i]) ? this.statsViews[i].getWidth() : 0;
      width += (this.probsViews[i]) ? this.probsViews[i].getWidth() : 0;

      statsProbsWidth = Math.max(statsProbsWidth, width);
    }

    layoutWidth += statsProbsWidth;

    return (reset) ? this.options.width : layoutWidth;
  }

  // -------------------------------------------------------------------------------------------------------------------

  protected resizeColumn(size:any, within = -1) {
    super.resizeColumn(size);

    var restSize = 0;
    var maxStatsWidth = Math.max.apply(Math, this.statsViews.map((stat) => {
      return (stat) ? stat.getWidth() : 0;
    }));
    maxStatsWidth = Math.max(maxStatsWidth, 0);

    const numGroups = (<any>this.range.dims[0]).groups.length;
    for (var i = 0; i < numGroups; ++i) {
      var probsWidth = (this.probsViews[i]) ? this.probsViews[i].getWidth() : 0;
      var statsWidth = (this.statsViews[i]) ? this.statsViews[i].getWidth() : 0;

      const groupWidth = probsWidth + statsWidth;

      const width = Math.max(groupWidth - maxStatsWidth, 0);
      restSize = Math.max(restSize, width);
    }

    // remove pointer to destroyed columns related to any prob view
    for (var j = 0; j < numGroups; ++j) {
      var probView = this.probsViews[j];
      if (probView == null) {
        continue;
      }

      if (probView.column != null) {
        if (probView.column.destroyed) {
          var index = this.activeDivision.indexOf(probView.column);
          probView.removeColumn(this);
          this.activeDivision.splice(index, 1);
        }
      }
    }

    size.x -= restSize;
  }

  // -------------------------------------------------------------------------------------------------------------------

  protected onActionLoader(size:any, within = -1) {
    super.onActionLoader(size);

    const that = this;
    const numGroups = (<any>this.range.dims[0]).groups.length;

    // go through all stats view and determine their position
    // resize cluster windows since their height should correspond to the heatmap height
    for (var j = 0; j < numGroups; ++j) {
      var probsView = this.probsViews[j];

      if (probsView == null) {
        continue;
      }
      if (probsView.visible === true) {
        var clusterGrid = $(this.$parent.node()).find('div.gridrow')[j];
        var clusterPosY = $(clusterGrid).position().top;
        var clusterHeight = $(clusterGrid).height() - 10;
        var boxChartHeight = $(clusterGrid).height() - 18 - 10 - 2 * this.options.padding;

        probsView.mainZoom.zoomTo(this.options.statsWidth - this.options.padding * 2, boxChartHeight);
        // position of view in x-dimension
        var viewPosX = size.x + this.options.padding * 2;
        // check if distance views are visible at the same time
        const statsView = that.statsViews[j];
        viewPosX += (statsView != null) ? statsView.getWidth() : 0;

        // shift main probability view
        probsView.$mainNode.style(
          {
            width: (this.options.statsWidth) + 'px',
            height: clusterHeight + 'px',
            top: clusterPosY + 'px',
            left: String(viewPosX) + 'px'
          });

        viewPosX += this.options.extOffset;

        if (probsView.matrixMode) {
          viewPosX += this.options.statsWidth;

          probsView.$matrixNode.style(
            {
              width: this.options.matrixWidth + 'px',
              height: clusterHeight + 'px',
              top: clusterPosY + 'px',
              left: String(viewPosX) + 'px'
            });

          probsView.zoomMatrixView.zoomTo(this.options.matrixWidth - this.options.padding * 2, boxChartHeight);
        } else {
          if (probsView.externVisible) {
            for (var i = 0; i < numGroups; ++i) {
              if (i !== probsView.cluster) {
                probsView.extZooms[i].zoomTo(this.options.statsWidth - this.options.padding * 2, boxChartHeight);
              }

              viewPosX += this.options.statsWidth;

              probsView.$extNodes[i].style({
                  width: (this.options.statsWidth) + 'px',
                  height: clusterHeight + 'px',
                  top: clusterPosY + 'px',
                  left: String(viewPosX) + 'px'
                });
            }

          }
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
  showProbs(cluster, within = -1, relayout = true) {
    var probsView = this.probsViews[cluster];

    if (probsView != null) {
      probsView.show(within);

      this.setColumnWidth();
      return (relayout) ? this.stratomex.relayout(within) : Promise.resolve([]);
    }

    var probView = new clusterView.ClusterProbView(cluster, this.range, this.partitionMatrix,
      {maxProb: this.options.maxProb});
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
  hideProbs(cluster, within) {
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
export class HierarchicalClusterColumn extends ClusterColumn implements idtypes.IHasUniqueId, link_m.IDataVis {
  constructor(protected stratomex, public data, partitioning:ranges.Range, protected dendrogram:any, public dataRef,
              options:any = {}, within = -1) {
    super(stratomex, data, partitioning, dataRef, options, within);
  }

  createToolBar() {
    var that = this;
    var $t = this.$toolbar;

    super.createToolBar();

    $t.insert('i', '.fa-close').attr('class', 'fa fa-angle-double-up').attr('title', 'Increase number of clusters')
      .on('click', () => {
      const oldNumGroups = (<any>that.range.dims[0]).groups.length;
      const numGroups = Math.min(oldNumGroups + 1, 10);

      if (oldNumGroups === numGroups) {
        return;
      }

      that.createNewStratification(numGroups);
    });

    $t.insert('i', '.fa-close').attr('class', 'fa fa-angle-double-down').attr('title', 'Decrease number of clusters')
      .on('click', () => {
      const oldNumGroups = (<any>that.range.dims[0]).groups.length;
      const numGroups = Math.max(oldNumGroups - 1, 1);

      if (oldNumGroups === numGroups) {
        return;
      }

      that.createNewStratification(numGroups);
    });

  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Cut dendrogram to create k-number of clusters.
   * @param k
   * @returns {Promise<Array>}
   */
  private cutDendrogramToClusters(k:number) {
    const dendrogram = this.dendrogram;

    var queue = [dendrogram];
    var clusters = [];

    while (queue.length < k) {
      var node = queue.shift();
      queue.push(node.children[0]);
      queue.push(node.children[1]);

      function sortFunc(a:any, b:any) {
        const valueA = (a.children == null) ? 0 : -a.value;
        const valueB = (b.children == null) ? 0 : -b.value;

        return valueA - valueB;
      }

      queue.sort(sortFunc);
    }

    var responses = [];

    for (var ii = 0; ii < k; ++ii) {
      clusters.push(queue[ii].indices);
    }

    function compareCluster(a, b) {
      return (a.length < b.length) ? -1 : (a.length > b.length) ? 1 : 0;
    }

    clusters = clusters.sort(compareCluster);

    return Promise.all(responses).then((args:any) => {
      return clusters;
    });
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Create a new stratification with numGroups clusters.
   * @param numGroups
   */
  private createNewStratification(numGroups) {
    const that = this;

    var response = that.cutDendrogramToClusters(numGroups);

    const dataName = that.data.desc.name;

    response.then((result:any) => {
      const clusterLabels = result;

      var rangeGroups = [];
      var groups = [];
      var groupsDesc = [];
      for (var i = 0; i < numGroups; ++i) {
        var groupSize = clusterLabels[i].length;

        rangeGroups.push(ranges.parse(clusterLabels[i]));
        groups.push(new ranges.Range1DGroup('Group ' + String(i),
          'grey', rangeGroups[i].dim(0)));

        groupsDesc.push({name: 'Group ' + String(i), size: groupSize});
      }

      var compositeRange = ranges.composite(dataName + 'groups', groups);

      var graph = that.stratomex.provGraph;
      var obj = graph.findObject(that);

      // regroup column
      graph.push(createRegroupColumnCmd(obj, compositeRange));
      that.prevStratis.splice(0, 0, compositeRange);
    });
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// TODO! To support provenance graph --> dendrogram needs to be added to server for api/dataset request
export interface IDendrogram extends C.IPersistable {
  desc:datatypes.IDataDescription;
}

// ---------------------------------------------------------------------------------------------------------------------

export class Dendrogram implements IDendrogram {
  constructor(public tree:any, public desc:datatypes.IDataDescription) {

  }

  persist():any {
    return this.desc.id;
  }

  restore(persisted:any) {
    return this;
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// TODO! To support provenance graph --> partition matrix needs to be added to server for api/dataset request
export interface IPartitionMatrix extends C.IPersistable {
  desc:datatypes.IDataDescription;
}

// ---------------------------------------------------------------------------------------------------------------------

export class PartitionMatrix implements IPartitionMatrix {
  constructor(public partition:any, public desc:datatypes.IDataDescription) {

  }

  persist():any {
    return this.desc.id;
  }

  restore(persisted:any) {
    return this;
  }
}
