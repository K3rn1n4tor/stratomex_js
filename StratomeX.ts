/**
 * Created by sam on 24.02.2015.
 */

import views = require('../caleydo_core/layout_view');
import datatypes = require('../caleydo_core/datatype');
import stratification = require('../caleydo_core/stratification');
import stratification_impl = require('../caleydo_core/stratification_impl');
import C = require('../caleydo_core/main');
import link_m = require('../caleydo_links/link');
import ranges = require('../caleydo_core/range');
import prov = require('../caleydo_provenance/main');
import ajax = require('../caleydo_core/ajax');

import columns = require('./Column');
import {getFirstByFQName} from "../caleydo_core/data";

export var debug : any;
export var debug2 : any;

//type ColumnRef = prov.IObjectRef<columns.Column>;

function toName(data: string, par: string) {
  const n : string= data;
  const i = n.lastIndexOf('/');
  var base =  i >= 0 ? n.slice(i+1) : n;

  var c = par.replace(' Clustering','');
  const j = c.lastIndexOf('/');
  c = j >= 0 ? c.slice(j+1) : c;
  if (base === c) {
    return base;
  }
  return base + ' ('+c+')';
}

function toMiddle(n: string) {
  const l = n.split('/');
  return l.length > 1 ? l[l.length-2] : n;
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

  setInteractive(interactive: boolean) {
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
        that._columns.forEach((d) => d.layouted(within));
        if (that.relayoutTimer >= 0) {
          clearTimeout(that.relayoutTimer);
        }
        that.relayoutTimer = setTimeout(that._links.update.bind(that._links), within + 400);
        return C.resolveIn(within);
      });
  }

  /**
   * adds a new column displaying data from the "data" section related to stratifications
   * @param m
   * @returns {boolean}
     */
  addDependentData(m: datatypes.IDataType) {
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
        this.provGraph.push(columns.createColumnCmd(this.ref, mref, target, toName(m.desc.name, base.range.dim(0).name)));
      });
      return true;
    }
    return false;
  }

  /**
   * add Orly's genomic data to the lineup
   * @param m
   * @returns {boolean}
     */
  addDependentOrlyData(m: datatypes.IDataType) {
    const base = columns.manager.selectedObjects()[0];

    console.log('Adding Orlys data: ', m.desc.fqname);
    //nothing selected
    if (!base) {
      return false;
    }

    //check if idtypes match otherwise makes no sense
    if (base.data.idtypes[0] === m.idtypes[0]) {
      let mref = this.provGraph.findOrAddObject(m, m.desc.name, 'orlydata');
      //console.log(base, mref);
      var r = ranges.list(base.range.dim(0));
      base.data.ids(r).then(m.fromIdRange.bind(m)).then((target) => {
        this.provGraph.push(columns.createColumnCmd(this.ref, mref, target, toName(m.desc.name, base.range.dim(0).name)));
      });
      return true;
    }
    return false;
  }

  /**
   * apply clustering to any data, by now only matrix supported
   * @param data
   * @param method
     */
  clusterData(data: datatypes.IDataType, method: string, arg: string)
  {
    const dataFQ = data.desc.fqname;
    console.log("Requesting dataset: ", dataFQ);

    (<any>data).data().then(() =>
    {
      console.log("Starting clustering of data ", dataFQ);

      if (method === 'kmeans') {
        const k = parseInt(arg);
        this.applyKMeans(data, k);
      }
      else if (method === 'hierarchical') {
        const linkage = arg;
        // TODO
      }
      else if (method === 'affinity') {
        // TODO
      }
      else {
        // TODO
      }
    });
  }

  /**
   * apply k-Means clustering algorithm to data
   * @param data: genomic data
   * @param k: number of desired clusters
     */
  private applyKMeans(data: datatypes.IDataType, k: number)
  {
    const dataFQ = data.desc.fqname;
    const dataID = data.desc.id;
    const dataName = data.desc.name;

    // TODO! figure out what the difference between APIData and APIJson is
    var response = ajax.getAPIJSON('/gene_clustering/kmeans/' + String(k) + '/' + dataID, {});

    var that = this;

    response.then(function(result)
    {
      var clusterLabels = result.clusterLabels;
      var clusterDists = result.clusterDistances;

      //console.log('k-means result: ', result);

      // first from groups
      var groups = <any>[];
      var groupsDesc = <any>[];
      var clusterRanges = <any>[];

      // sort groups in ascending order
      function compareCluster(a, b)
      {
        return (a.length < b.length) ? -1 : (a.length > b.length) ? 1 : 0;
      }

      clusterLabels = clusterLabels.sort(compareCluster);

      for (var i = 0; i < k; ++i)
      {
        clusterRanges.push(ranges.parse(clusterLabels[i]));
        groups.push(new ranges.Range1DGroup('Cluster ' + String(i) + ' [' + String(k) + '-means]',
          'red', clusterRanges[i].dim(0)));
        groupsDesc.push({name: String(i), size: clusterLabels[i].length});
      }

      var compositeRange = ranges.composite(dataName + 'cluster', groups);
      var clusterRange = ranges.parse(<any>compositeRange);

      // create new stratification with description
      var desc =
      {
        id: dataID + "KMeans" + String(k),
        fqname: 'none',
        name: dataName + " K-Means " + String(k),
        origin: dataFQ,
        size: (<any>data).dim[0],
        ngroups: k,
        type: 'stratification',
        groups: groupsDesc, // TODO: use this as desc
        idtype: 'patient', // TODO: figure out what idtypes are important for
        ws: 'random' // TODO: figure out what this parameter is

      };

      //debug = data;
      //console.log('data: ', data, desc);

      Promise.all([(<any>data).rows(), (<any>data).rowIds()]).then((args) =>
      {
        var rows = args[0];
        var rowIds = args[1];

        var strati = stratification_impl.wrap(<datatypes.IDataDescription>desc, rows, rowIds, compositeRange);
        //console.log(strati);
        //console.log(that);

        that.addOrlyData(strati, data, null);
      });



    });
  }

  addOrlyData(rowStrat: stratification.IStratification, m: datatypes.IDataType, colStrat?: stratification.IStratification)
  {
    var that = this;
    var mref = this.provGraph.findOrAddObject(m, m.desc.name, 'orlydata');
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

  /**
   * adds a new column displaying the stratifications of a cluster data
   * @param rowStrat
   * @param m
   * @param colStrat
     */
  addData(rowStrat: stratification.IStratification, m: datatypes.IDataType, colStrat?: stratification.IStratification)
  {
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

  addColumn(column:columns.Column, index: number = -1, within = -1) {
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
      return this.relayout(within).then(() => i);
    } else {
      console.error('cant find column');
    }
    return Promise.resolve(-1);
  }

  swapColumn(columnA: columns.Column, columnB: columns.Column, within = -1) {
    const i = this.indexOf(columnA),
      j = this.indexOf(columnB);
    this._columns[i] = columnB;
    this._columns[j] = columnA;
    if (i < j) {
      this.parent.insertBefore(columnB.layoutNode, columnA.layoutNode);
    } else {
      this.parent.insertBefore(columnA.layoutNode, columnB.layoutNode);
    }
    return this.relayout(within);
  }

  indexOf(column:columns.Column) {
    return C.indexOf(this._columns, function (elem) {
      return elem === column;
    });
  }

  at(index) {
    return this._columns[index];
  }

  atRef(index: number) {
    const c = this.at(index);
    return this.provGraph.findObject(c);
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
