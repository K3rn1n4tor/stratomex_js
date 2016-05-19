/**
 * Created by sam on 24.02.2015.
 */

import views = require('../caleydo_core/layout_view');
import datatypes = require('../caleydo_core/datatype');
import stratification = require('../caleydo_core/stratification');
import stratification_impl = require('../caleydo_core/stratification_impl');
import C = require('../caleydo_core/main');
import link_m = require('../caleydo_d3/link');
import ranges = require('../caleydo_core/range');
import prov = require('../caleydo_clue/prov');
import ajax = require('../caleydo_core/ajax');

import columns = require('./Column');
import clustercolumns = require('./ClusterColumn');

//type ColumnRef = prov.IObjectRef<columns.Column>;

function toName(data:string, par:string) {
  const n:string = data;
  const i = n.lastIndexOf('/');
  var base = i >= 0 ? n.slice(i + 1) : n;

  var c = par.replace(' Clustering', '');
  const j = c.lastIndexOf('/');
  c = j >= 0 ? c.slice(j + 1) : c;
  if (base === c) {
    return base;
  }
  return base + ' (' + c + ')';
}

function toMiddle(n:string) {
  const l = n.split('/');
  return l.length > 1 ? l[l.length - 2] : n;
}

class StratomeX extends views.AView {
  private _columns:columns.Column[] = [];

  private dim:[number, number];
  private _links:link_m.LinkContainer;
  ref:prov.IObjectRef<StratomeX>;

  private interactive = true;

  constructor(private parent:Element, private provGraph:prov.ProvenanceGraph) {
    super();
    this.ref = provGraph.findOrAddObject(this, 'StratomeX', 'visual');
    this._links = new link_m.LinkContainer(parent, ['changed'], {
      interactive: false,
      filter: this.areNeighborColumns.bind(this),
      mode: 'link-group',
      idTypeFilter: function (idtype, i) {
        return i === 0; //just the row i.e. first one
      },
      hover: false,
      canSelect: () => this.interactive
    });
  }

  setInteractive(interactive:boolean) {
    this.interactive = interactive;
    this._columns.forEach((c) => c.setInteractive(interactive));
  }

  reset() {
    this._columns.forEach((c) => {
      c.destroy(-1);
    });
    this._columns = [];
    this._links.clear();
  }

  setBounds(x, y, w, h) {
    super.setBounds(x, y, w, h);
    this.dim = [w, h];
    return this.relayout();
  }

  private relayoutTimer = -1;

  relayout(within = -1) {
    var that = this;
    that._links.hide();
    return C.resolveIn(5).then(() => {
      that._columns.forEach((d) => {
        d.layouted(within);
      });

      if (that.relayoutTimer >= 0) {
        clearTimeout(that.relayoutTimer);
      }

      that.relayoutTimer = setTimeout(that._links.update.bind(that._links), within + 400);
      that._columns.forEach((d) => {
        d.fire('relayouted');
      });
      return C.resolveIn(within);
    });
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * adds a new column displaying data from the "data" section related to stratifications
   * @param m
   * @returns {boolean}
   */
  addDependentData(m:datatypes.IDataType) {
    const base = columns.manager.selectedObjects()[0];

    //nothing selected
    if (!base) {
      return false;
    }
    //check if idtypes match otherwise makes no sense
    if (base.data.idtypes[0] === m.idtypes[0]) {
      let mref = this.provGraph.findOrAddObject(m, m.desc.name, 'data');
      var r = ranges.list(base.range.dim(0));
      base.data.ids(r).then(m.fromIdRange.bind(m)).then((target) => {
        this.provGraph.push(columns.createColumnCmd(this.ref, mref, target, toName(m.desc.name, base.range.dim(0).name), -1, 'C' + C.random_id(), base.hashString));
      });
      return true;
    }
    return false;
  }
  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Apply user-specified clustering algorithm to any data, by now only matrix supported.
   * @param data
   * @param method
   * @param arg
   */
  clusterData(data:datatypes.IDataType, method:string, args:any) {
    if (data.desc.type !== 'matrix') {
      console.log('clustering of data only supported for matrices, by now.');
      return;
    }

    //if (data.desc.type == 'vector')
    //{
    //  (<any>data).stratification().then( (d) => { console.log(d); })
    //}

    const dataID = data.desc.id;
    console.log('Cluster data set:', dataID);
    var that = this;
    var clusterResponse:Promise<any>;
    var methodName = '';
    var distMetric = '';

    $('body').addClass('waiting');

    if (method === 'k-means') {
      const k = String(args[0]);
      const initMethod = args[1];
      const distance = args[2];

      var argUrl = [k, initMethod, distance, dataID].join('/');
      clusterResponse = ajax.getAPIJSON('/clustering/kmeans/' + argUrl, {});
      methodName = 'K-Means';
      distMetric = distance;
    }

    if (method === 'affinity') {
      const damping = args[0];
      const factor = args[1];
      const pref = args[2];
      const distance = args[3];

      var argUrl = [damping, factor, pref, distance, dataID].join('/');
      clusterResponse = ajax.getAPIJSON('/clustering/affinity/' + argUrl, {});
      methodName = 'Affinity';
      distMetric = distance;
    } else if (method === 'hierarchical') {
      const k = String(args[0]);
      const method = args[1];
      const distance = args[2];

      var argUrl = [k, method, distance, dataID].join('/');
      clusterResponse = ajax.getAPIJSON('/clustering/hierarchical/' + argUrl, {});
      methodName = 'Hierarchical';
      distMetric = distance;
    } else if (method === 'fuzzy') {
      const c = String(args[0]);
      const m = String(args[1]);
      const t = String(args[2]);
      const distance = args[3];

      var argUrl = [c, m, t, distance, dataID].join('/');
      clusterResponse = ajax.getAPIJSON('/clustering/fuzzy/' + argUrl, {});
      methodName = 'Fuzzy';
      distMetric = distance;
    }

    clusterResponse.then((result:any) => {
      that.createClusterStratification(data, result, methodName, distMetric);
      $('body').removeClass('waiting');
    }).catch((e:any) => {
      console.log('Could not apply clustering algorithm to data set:', dataID);
      console.log('Error:', e);
      $('body').removeClass('waiting');
    });

    //});
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Create a new stratification from clustering outcome
   * @param data
   * @param result
   * @param method
   */
  private createClusterStratification(data:datatypes.IDataType, result:any, method:string, metric:string) {
    var that = this;

    // obtain data info
    const dataFQ = data.desc.fqname;
    const dataID = data.desc.id;
    const dataName = data.desc.name;

    var clusterLabels = result.clusterLabels;
    var numClusters = result.centroids.length;

    // first from groups
    var groups = <any>[];
    var groupsDesc = <any>[];
    var clusterRanges = <any>[];

    // sort groups in ascending order
    //function compareCluster(a, b)
    //{
    //  return (a.length < b.length) ? -1 : (a.length > b.length) ? 1 : 0;
    //}
    //
    ////clusterLabels.sort(compareCluster);

    Promise.all([(<any>data).rows(), (<any>data).rowIds()]).then((args) => {
      // obtain the rows and rowIDs of the data
      var rows = args[0];
      var rowIds = args[1];

      var newRows = [];
      var newRowIds = [];

      // rewrite cluster labels since some data sets do not follow a sequential order
      var rowLabels = rowIds.dim(0).asList();
      var sumLabels = 0;

      for (var i = 0; i < numClusters; ++i) {
        const numLabels = clusterLabels[i].length;

        for (var j = 0; j < numLabels; ++j) {
          // HINT! have a look at any CNMF clustering file, they rearrange all rows and rowIds instead of the groups
          newRows.push(rows[clusterLabels[i][j]]);
          newRowIds.push(rowLabels[clusterLabels[i][j]]);
        }
        clusterLabels[i] = '(' + String(sumLabels) + ':' + String(numLabels + sumLabels) + ')';

        sumLabels += numLabels;
      }

      for (var i = 0; i < numClusters; ++i) {
        clusterRanges.push(ranges.parse(clusterLabels[i]));
        groups.push(new ranges.Range1DGroup('Group ' + String(i),
          'red', clusterRanges[i].dim(0)));
        groupsDesc.push({name: String(i), size: clusterLabels[i].length});
      }

      var compositeRange = ranges.composite(dataName + 'cluster', groups);

      // create new stratification with description
      var descStrati = {
        id: dataID + 'method', fqname: 'none', name: dataName + '/' + method,
        origin: dataFQ, size: (<any>data).dim[0], ngroups: numClusters,
        type: 'stratification', groups: groupsDesc,
        idtype: 'patient',
        ws: 'random'
      };

      // create a new startification of the data
      var strati:stratification.IStratification;
      // provide newRows as number[] and newRowIds as string[]
      strati = stratification_impl.wrap(<datatypes.IDataDescription>descStrati, newRows, newRowIds, <any>compositeRange);

      // add new clustered data with its stratification to StratomeX
      if (method === 'Hierarchical') {
        that.addHierarchicalClusterData(strati, data, metric, result.dendrogram);
      } else if (method === 'Fuzzy') {
        const partitionMatrix = result.partitionMatrix;
        const maxProb = result.maxProbability;
        that.addFuzzyClusterData(strati, data, metric, partitionMatrix, maxProb);
      } else {
        that.addClusterData(strati, data, metric);
      }
    });
  }

  // -------------------------------------------------------------------------------------------------------------------

  addColumnWithRange(data:datatypes.IDataType, compositeRange:ranges.CompositeRange1D) {
    var that = this;

    const dataID = data.desc.id;
    const dataFQ = data.desc.fqname;
    const dataName = data.desc.name;

    const numGroups = compositeRange.groups.length;

    // create new stratification with description
    var descStrati = {
      id: dataID + 'method', fqname: 'none', name: dataName,
      origin: dataFQ, size: (<any>data).dim[0], ngroups: numGroups,
      type: 'stratification', groups: compositeRange.groups,
      idtype: 'patient',
      ws: 'random'
    };

    Promise.all([(<any>data).rows(), (<any>data).rowIds()]).then((args) => {
      // obtain the rows and rowIDs of the data
      var rows = args[0];
      var rowIds = args[1];

      // create a new startification of the data
      var strati:stratification.IStratification;
      strati = stratification_impl.wrap(<datatypes.IDataDescription>descStrati, rows, rowIds, <any>compositeRange);

      // add new clustered data with its stratification to StratomeX
      that.addClusterData(strati, data, null);
    });
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Add new (custom) cluster column
   * @param rowStrat
   * @param rowMatrix
   * @param distanceMetric
   */
  addClusterData(rowStrat:stratification.IStratification,
                 rowMatrix:datatypes.IDataType,
                 distanceMetric:string = 'euclidean') {
    var that = this;
    const objectName = rowMatrix.desc.name;
    var mref = this.provGraph.findOrAddObject(rowMatrix, objectName, 'data');

    Promise.all<ranges.Range1D>([rowStrat.idRange(), ranges.Range1D.all()])
      .then((range_list:ranges.Range1D[]) => {
        const idRange = ranges.list(range_list);
        return rowMatrix.fromIdRange(idRange);

      }).then((range) => {
      that.provGraph.push(clustercolumns.createClusterColumnCmd(that.ref, mref, range, distanceMetric,
        toName(objectName, rowStrat.desc.name)));
    });
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Add new (custom) cluster column
   * @param rowStrat
   * @param rowMatrix
   * @param distanceMetric
   * @param dendrogram
   */
  addHierarchicalClusterData(rowStrat:stratification.IStratification,
                             rowMatrix:datatypes.IDataType,
                             distanceMetric:string,
                             dendrogram:any) {
    var that = this;
    const objectName = rowMatrix.desc.name;
    var mref = this.provGraph.findOrAddObject(rowMatrix, objectName, 'data');

    Promise.all<ranges.Range1D>([rowStrat.idRange(), ranges.Range1D.all()])
      .then((range_list:ranges.Range1D[]) => {
        const idRange = ranges.list(range_list);
        return rowMatrix.fromIdRange(idRange);

      }).then((range) => {
      const newID = rowMatrix.desc.id + 'Dendrogram';
      const dendrogramName = rowMatrix.desc.name + '_Dendrogram';
      var dendrogramDesc = {id: newID, name: 'dendrogramName', 'fqname': 'null', type: 'tree'};
      var dendrogramData = new clustercolumns.Dendrogram(dendrogram, dendrogramDesc);

      var dendrogramRef = that.provGraph.findOrAddObject(dendrogramData, dendrogramName, 'data');

      that.provGraph.push(clustercolumns.createHierarchicalClusterColumnCmd(that.ref, mref, range, distanceMetric,
        dendrogramRef, toName(objectName, rowStrat.desc.name)));
    });
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Add new (custom) cluster column
   * @param rowStrat
   * @param rowMatrix
   * @param distanceMetric
   * @param partitionMatrix
   * @param maxProb
   */
  addFuzzyClusterData(rowStrat:stratification.IStratification,
                      rowMatrix:datatypes.IDataType,
                      distanceMetric:string,
                      partitionMatrix:any[],
                      maxProb:number) {
    var that = this;
    const objectName = rowMatrix.desc.name;
    var mref = this.provGraph.findOrAddObject(rowMatrix, objectName, 'data');

    Promise.all<ranges.Range1D>([rowStrat.idRange(), ranges.Range1D.all()])
      .then((range_list:ranges.Range1D[]) => {
        const idRange = ranges.list(range_list);
        return rowMatrix.fromIdRange(idRange);

      }).then((range) => {
      const newID = rowMatrix.desc.id + 'PartitionMatrix';
      const partitionName = rowMatrix.desc.name + '_PartitionMatrix';
      const partitionDesc = {id: newID, name: partitionName, fqname: 'null', type: 'tree'};
      const partitionData = new clustercolumns.PartitionMatrix(partitionMatrix, partitionDesc);
      const partitionRef = that.provGraph.findOrAddObject(partitionData, partitionName, 'data');

      that.provGraph.push(clustercolumns.createFuzzyClusterColumnCmd(that.ref, mref, range, distanceMetric,
        partitionRef, maxProb, toName(objectName, rowStrat.desc.name)));
    });
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * adds a new column displaying the stratifications of a cluster data
   * @param rowStrat
   * @param m
   * @param colStrat
   */
  addData(rowStrat:stratification.IStratification, m:datatypes.IDataType, colStrat?:stratification.IStratification) {
    var that = this;
    var mref = this.provGraph.findOrAddObject(m, m.desc.name, 'data');
    if (rowStrat === m) {
      //both are stratifications
      rowStrat.range().then((range) => {
        that.provGraph.push(columns.createColumnCmd(that.ref, mref, range, toName(toMiddle(m.desc.fqname), rowStrat.desc.name)));
      });
    } else {
      Promise.all<ranges.Range1D>([rowStrat.idRange(), colStrat ? colStrat.idRange() : ranges.Range1D.all()]).then((range_list:ranges.Range1D[]) => {
        const idRange = ranges.list(range_list);
        return m.fromIdRange(idRange);
      }).then((range) => {
        that.provGraph.push(columns.createColumnCmd(that.ref, mref, range, toName(m.desc.name, rowStrat.desc.name)));
      });
    }
  }

  // -------------------------------------------------------------------------------------------------------------------

  areNeighborColumns(ca, cb) {
    var loca = ca.location,
      locb = cb.location,
      t = null;
    if (loca.x > locb.x) { //swap order
      t = locb;
      locb = loca;
      loca = t;
    }
    //none in between
    return !this._columns.some(function (c) {
      if (c === ca || c === cb) {
        return false;
      }
      var l = c.location;
      return loca.x <= l.x && l.x <= locb.x;
    });
  }

  addColumn(column:columns.Column, index:number = -1, within = -1) {
    //console.log("new index", index);
    if (index < 0) {
      this._columns.push(column);
    } else {
      this._columns.splice(index, 0, column);
    }
    //console.log('add '+column.id);
    column.on('changed', C.bind(this.relayout, this));
    column.setInteractive(this.interactive);
    this._links.push(false, column);
    return this.relayout();
  }

  removeColumn(column:columns.Column, within = -1) {
    var i = this._columns.indexOf(column); //C.indexOf(this._columns, (elem) => elem === column);
    if (i >= 0) {
      //console.log('remove '+column.id);
      this._columns.splice(i, 1);

      this._links.remove(false, column);
      column.destroy(within);

      // kernm: modification to keep track of ids for each column.
      // First remove all columns from manager and add them with new ids.
      this._columns.forEach((col:any, _:number) => {
        columns.manager.remove(col);
      });

      this._columns.forEach((col:any, _:number) => {
        col.setColumnId(col.id);

        if (col.id > i) {
          col.setColumnId(col.id - 1);
        }
      });

      return this.relayout(within).then(() => {
        columns.manager.select([]);

        return i;
      });
    } else {
      console.error('cant find column');
    }

    return Promise.resolve(-1);
  }

  getLastColumn() {
    return this._columns.slice(-1)[0];
  }

  swapColumn(columnA:columns.Column, columnB:columns.Column, within = -1) {
    const i = this.indexOf(columnA);
    const j = this.indexOf(columnB);

    columns.manager.remove(columnA);
    columns.manager.remove(columnB);

    console.log(i, j);

    // swap column ids
    columnA.setColumnId(j);
    columnB.setColumnId(i);

    // swap columns
    this._columns[i] = columnB;
    this._columns[j] = columnA;

    if (i < j) {
      this.parent.insertBefore(columnB.layoutNode, columnA.layoutNode);
    } else {
      this.parent.insertBefore(columnA.layoutNode, columnB.layoutNode);
    }
    var promise = this.relayout(within);

    return promise.then(() => {
      columns.manager.select([j]);
      return Promise.resolve([]);
    });
  }

  indexOf(column:columns.Column) {
    return C.indexOf(this._columns, function (elem) {
      return elem === column;
    });
  }

  at(index) {
    return this._columns[index];
  }

  atRef(index:number) {
    const c = this.at(index);
    return this.provGraph.findObject(c);
  }

  findColumnByHash(hash:string) {
    for (var i = 0; i < this._columns.length; ++i) {
      var c = this._columns[i];
      if (hash === c.hashString) {
        return c;
      }
    }
  }

  canShift(column:columns.Column) {
    var i = C.indexOf(this._columns, function (elem) {
      return elem === column;
    });
    return {
      left: i,
      right: i - this._columns.length + 1
    };
  }
}
export function create(parent:Element, provGraph:prov.ProvenanceGraph) {
  return new StratomeX(parent, provGraph);
}
