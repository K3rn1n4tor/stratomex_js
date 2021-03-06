/**
 * Created by Samuel Gratzl on 15.12.2014.
 * Extended by Michael Kern on 22.01.2016.
 */

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

define(function (require) {
  'use strict';

  // -------------------------------------------------------------------------------------------------------------------
  // requirements

  var $ = require('jquery');
  var d3 = require('d3');
  var data = require('../caleydo_core/data');
  var vis = require('../caleydo_core/vis');
  var C = require('../caleydo_core/main');
  var template = require('../caleydo_clue/template');
  var cmode = require('../caleydo_clue/mode');
  var lineupModule = require('./lineup');
  var stratomeModule = require('./StratomeX');
  var utility = require('./utility');


  // -------------------------------------------------------------------------------------------------------------------

  // selects the first element with given selector
  var helper = document.querySelector('#mainhelper');

  // popup manager helper pointer
  var clusterPopupHelper = null;

  // -------------------------------------------------------------------------------------------------------------------

  // create clue template
  var elems = template.create(document.body, {
    app: 'StratomeX.js',
    application: '/stratomex_js',
    id: 'clue_stratomex'
  });
  {
    while(helper.firstChild) {
      elems.$main.node().appendChild(helper.firstChild);
    }
    helper.remove();
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * choose what method will be called and what kind of column will be added
   */
  elems.graph.then(function(graph) {
    var datavalues;
    var stratomex = stratomeModule.create(document.getElementById('stratomex'), graph);

    function openClusterMenu(row, parent)
    {
      var rowData = row._;
      var rowID = row._id;

      if (clusterPopupHelper != null) { clusterPopupHelper.destroy(); }
      clusterPopupHelper = utility.createClusterPopup(rowData, parent, stratomex, rowID, {});
    }

    // -----------------------------------------------------------------------------------------------------------------

    var lineup = lineupModule.create(document.getElementById('tab_stratifications'), function (rowStrat) {
      if (rowStrat.desc.type === 'stratification') {

        // TODO! set original file of stratification and load it with origin method
        rowStrat.origin().then(function (d) {
          // create connection of matrix and this stratification
          // TODO! important for our clustering
          if (d.desc.type === 'matrix')
          {
            if (rowStrat.idtypes[0] !== d.idtypes[0]) {
              d = d.t; //transpose
            }
          }
          if (d.desc.type === 'table') {
            stratomex.addData(rowStrat, rowStrat);
          } else {
            // TODO! and call addData to draw connection
            stratomex.addClusterData(rowStrat, d);
          }
        });
      } else if (rowStrat.desc.type === 'vector') {
        rowStrat.stratification().then(function (d) {
          stratomex.addData(d, d);
        });
      }
    }, null);

    // -----------------------------------------------------------------------------------------------------------------
    // methods called per data tab

    var lineupData = lineupModule.createData(document.getElementById('tab_data'),
      function (vector) { stratomex.addDependentData(vector); }, openClusterMenu);

    // -----------------------------------------------------------------------------------------------------------------

    var $left_data = $('#databrowser');
    if (cmode.getMode().exploration < 0.8) {
      $left_data.hide();
    } else {
      $left_data.show();
    }
    stratomex.setInteractive(cmode.getMode().exploration >= 0.8);
    function updateLineUp() {
      if (lineup.lineup) {
        lineup.lineup.update();
      }
      if (lineupData.lineup) {
        lineupData.lineup.update();
      }
    }

    $('a[data-toggle="tab"]').on('shown.bs.tab', function () {
      updateLineUp();
    });

    // -----------------------------------------------------------------------------------------------------------------

    function updateBounds() {
      var bounds = C.bounds(stratomex.parent);
      stratomex.setBounds(bounds.x, bounds.y, bounds.w, bounds.h);
      updateLineUp();
    }

    elems.on('modeChanged', function (event, new_) {
      if (new_.exploration < 0.8) {
        $left_data.animate({height: 'hide'}, 'fast');
      } else {
        $left_data.animate({height: 'show'}, 'fast');
      }
      stratomex.setInteractive(new_.exploration >= 0.8);

      //for the animations to end
      updateBounds();
      setTimeout(updateBounds, 300);
    });
    $(window).on('resize', updateBounds);
    updateBounds();
    //var notes = require('./notes').create(document.getElementById('notes'), graph);

    // -----------------------------------------------------------------------------------------------------------------

    function splitAndConvert(arr) {
      var strat = arr.filter(function (d) {
        return d.desc.type === 'stratification'
      });

      strat = strat.concat(arr.filter(function (d) {
        return d.desc.type === 'vector'
      }));

      //convert all matrices to slices with their corresponding name
      return Promise.all(arr.filter(function (d) {
        return d.desc.type === 'matrix'
      }).map(function (d) {
        return d.cols().then(function (colNames) {
          var cols = d.ncol, r = [];
          for (var i = 0; i < cols; ++i) {
            var v = d.slice(i);
            v.desc.name = colNames[i];
            v.desc.fqname = d.desc.fqname + '/' + colNames[i];
            r.push(v);
          }
          return r;
        });
      })).then(function (colsarray) {
        return strat.concat.apply(strat, colsarray);
      });
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Create lineUp for stratification

    function createLineUp(r) {
      lineup.setData(r);
    }

    function filterTypes(arr) {
      return arr.filter(function (d) {
        var desc = d.desc;

        if (desc.type === 'matrix' && desc.fqname.startsWith('stratomex_js')) {
          return false;
        }

        if (!desc.fqname.startsWith('TCGA') && !desc.fqname.startsWith('stratomex_js')) {
          return false;
        }

        //if (desc.fqname.startsWith('TCGA')) { return false; }

        if (desc.type === 'matrix' || desc.type === 'vector') {
          return desc.value.type === 'categorical';
        }

        return desc.type === 'stratification' && desc.origin != null;
      });
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Create lineUp for data types

    function createDataLineUp(r) {
      lineupData.setData(r);
    }

    function filterDataTypes(arr) {
      return arr.filter(function (d) {
        var desc = d.desc;

        if (desc.fqname.startsWith('stratomex_js')) {
          return false;
        }

        if (!desc.fqname.startsWith('TCGA')) {
          return false;
        }

        if (desc.type === 'matrix' || desc.type == 'vector') {
          return desc.value.type === 'real' || desc.value.type === 'int';
        }
        return false;
      });
    }
    

    // -----------------------------------------------------------------------------------------------------------------
    // Create filebrowser tabs for each data types

    var vectors = data.list().then(data.convertTableToVectors);
    vectors.then(filterTypes).then(splitAndConvert).then(createLineUp);
    vectors.then(filterDataTypes).then(createDataLineUp);

    elems.jumpToStored();
  });
});
