/**
 * Created by sam on 24.02.2015.
 */
define(function (require, exports) {
  var views = require('../caleydo_core/layout_view');
  var C = require('../caleydo_core/main');
  var events = require('../caleydo_core/event');
  var layouts = require('../caleydo_core/layout');
  var vis = require('../caleydo_core/vis');
  var tables = require('../caleydo_core/table_impl');
  var d3 = require('d3');

  function StratomeXLineUp(parent, onAdd) {
    views.AView.call(this);
    this._data = [];
    this.parent = parent;
    this.onAdd = onAdd;
  }
  C.extendClass(StratomeXLineUp, views.AView);

  Object.defineProperty(StratomeXLineUp.prototype, 'data', {
    get : function() {
      return this._data;
    }
  });
  StratomeXLineUp.prototype.setBounds = function(x,y,w,h) {
    views.AView.prototype.setBounds.call(this, x, y, w, h);
    if (this.lineup) {
      this.lineup.up
    }
  }
  function col(name, width) {
    return { column: name,  width: width };
  }
  function convertToTable(list) {
      return tables.wrapObjects({
          id : '_stratification',
          name: 'stratifications',
          type: 'table',
          rowtype: '_stratification',
          size: [list.length, 4],
          columns: [
            {
              name: 'Dataset',
              value: { type: 'string' },
              getter: function(d) {
                var s = d.desc.fqname.lastIndexOf('/');
                if (s < 0) {
                  return d.desc.name;
                }
                return d.desc.fqname.substr(0,s);
              }
            },
            {
              name: 'Name',
              value: { type: 'string' },
              getter: function(d) {
                var s = d.desc.fqname.lastIndexOf('/');
                if (s < 0) {
                  return d.desc.name;
                }
                return d.desc.fqname.substr(s+1);
              }
            }, {
              name: 'Dimensions',
              value: { type: 'string' },
              getter: function(d) { return d.length; }
            }, {
              name: 'ID Type',
              value: { type: 'string' },
              getter: function(d) { return d.idtype.name; }
            }, {
              name: '# Groups',
              value: { type: 'string' },
              getter: function(d) { return d.ngroups || d.valuetype.categories.length; }
            }
          ]
    }, list, function(d) { return d.desc.name });
  }
  StratomeXLineUp.prototype.setData = function(stratifications) {
    var that = this;
    var data = convertToTable(stratifications);
    this._data = [data];
    this.parent.__data__  = data;
    var v = vis.list(data);
    v = v.filter(function (v) { return v.id === 'caleydo-vis-lineup';})[0];
    v.load().then(function (plugin) {
      that.lineup = plugin.factory(data, that.parent, {
        lineup: {
          svgLayout: {
            mode: 'separate',
            rowActions: [
              {
                name: 'add',
                icon: '\uf067',
                action: function(row) { that.onAdd(row._); }
              }
            ]
          },
          manipulative: true,
          interaction: {
            tooltips: false
          }
        },
        dump: {
          layout: {
            primary: [{type: 'actions', width: 40}, {
              type: 'rank',
              width: 40
            }, col('Dataset', 220), col('Name', 220), col('Dimensions', 90), col('ID Type', 80), col('# Groups', 80)]
          }
        }
      });
    });
  };

  exports.StratomeXLineUp = StratomeXLineUp;
  exports.create = function (parent, onAdd) {
    return new StratomeXLineUp(parent, onAdd);
  }
});
