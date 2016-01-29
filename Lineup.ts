/**
 *  Created by Michael Kern on 29.01.2016
 *  Originally taken from Samuel Gratzl
 */

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Libraries

import views = require('../caleydo_core/layout_view');
import C = require('../caleydo_core/main');
import vis = require('../caleydo_core/vis');
import tables = require('../caleydo_core/table_impl');
import d3 = require('d3');
import $ = require('jquery');
import strati = require('../caleydo_core/stratification');
import matrix = require('../caleydo_core/matrix');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Utility functions

/**
 * Helper function to create new column description for lineup.
 * @param name name of column
 * @param width width of column
 * @returns {{column: string, width: number}}
 */
function col(name: string, width: number)
{
  return { column: name, width: width };
}

// ---------------------------------------------------------------------------------------------------------------------

/**
 * converts list of data (stratifications) to lineup-conform table description.
 * @param list
 * @returns {any}
 */
function convertToTable(list: any[])
{
  return tables.wrapObjects(<any>{
    id : '_stratification',
    name: 'stratifications',
    type: 'table',
    rowtype: '_stratification',
    size: [list.length, 4],
    columns: [
      {
        name: 'Package',
        value: { type: 'string' },
        getter: function(d)
        {
          var s = d.desc.fqname.split('/');
          return s[0];
        }
      },
      {
        name: 'Dataset',
        value: { type: 'string' },
        getter: function(d)
        {
          var s = d.desc.fqname.split('/');
          return s.length === 2 ? s[0] : s[1];
        }
      },
      {
        name: 'Name',
        value: { type: 'string' },
        getter: function(d)
        {
          var s = d.desc.fqname.split('/');
          return s[s.length-1];
        }
      },
      {
        name: 'Dimensions',
        value: { type: 'string' },
        getter: function(d) { return d.dim.join(' x '); },
        lineup:
        {
          alignment: 'right'
        }
      },
      {
        name: 'ID Type',
        value: { type: 'string' },
        getter: function(d) { return (d.idtypes.map(String).join(', ')); }
      },
      {
        name: 'Type',
        value: { type: 'string' },
        getter: function(d) { return d.desc.type; }
      },
      {
        name: '# Groups',
        value: { type: 'string' },
        getter: function(d) { return d.ngroups || (d.valuetype.categories ? d.valuetype.categories.length : 0); },
        lineup:
        {
          alignment: 'right'
        }
      }
    ]
  }, list, (d: any) => { return d.desc.name; });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// class declaration

/**
 * This is an implementation of a custom LineUp view for StratomeX. It creates the file browser for this application
 * to list all available stratifications and data and connect actions for each row with a special function.
 */
export class StratomeXLineUp extends views.AView
{
  private _data: any = [];
  public lineup: any;
  public rawData: any[] = [];

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Create a new LineUp for StratomeX.
   * @param parent: HTML element
   * @param showGroups:
   * @param onAdd: pointer to function that is called when '+' sign is clicked at certain row
   * @param onCluster: pointer to function that is called when 'K' sign is clicked at certain row
     */
  constructor(private parent: Element, public showGroups: boolean, public onAdd: any, public onCluster: any)
  {
    super();
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Return data of LineUp.
   * @returns {any}
     */
  get data()
  {
    return this._data;
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Set boundaries of LineUp.
   * @param x
   * @param y
   * @param w
     * @param h
     */
  setBounds(x, y, w, h)
  {
    super.setBounds(x, y, w, h);

    if (this.lineup)
    {
      this.lineup.update();
    }
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Convert list of stratifications to lineup-conform description and set the data of this LineUp.
   * @param stratifications
     */
  setData(stratifications: any[])
  {
    var that = this;
    var data = convertToTable(stratifications);

    this.rawData = stratifications;
    this._data = [data];
    (<any>this.parent).__data__ = data;

    // list all plugins that are able to visualize this data table
    var v = vis.list(data);
    // select the vis-lineup that uses the linup library since we only need this plugin
    var lineup = v.filter((v: any) => { return v.id === 'caleydo-vis-lineup'; })[0];

    // define the icons for the actions
    var addIcon = '\uf067';
    var clusterIcon = (this.onCluster === null) ? '' : '\u2756'; //'\u26d5';

    // load the plugin and define the description
    lineup.load().then((plugin) =>
    {
      that.lineup = plugin.factory(data, that.parent, {
        lineup:
        {
          svgLayout:
          {
            mode: 'separate',
            // define types of actions and set callback functions
            rowActions:
            [
              {
                name: 'add',
                icon: addIcon,
                action: (row: any) => { that.onAdd(row._) }
              },
              {
                name: 'cluster',
                icon: clusterIcon,
                action: (row: any) => { that.onCluster(row._) }
              }
            ]
          },
          manipulative: true,
          interaction:
          {
            tooltips: false
          }
        },
        dump:
        {
          layout:
          {
            // define columns layout
            primary:
            [
              { type: 'actions', width: 60, label: 'Actions'},
              { type: 'rank', width: 40 },
              col('Package', 150),
              col('Dataset', 220),
              col('Name', 220),
              col('Dimensions', 90),
              col('ID Type', that.showGroups ? 250 : 120),
              col(that.showGroups ? '# Groups' : 'Type', 80)
            ]
          }
        }
      });
    });
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// creation functions

/**
 * Creates LineUp for stratifications.
 * @param parent
 * @param onAdd
 * @param onCluster
 * @returns {StratomeXLineUp}
 */
export function create(parent: Element, onAdd: any, onCluster: any)
{
  return new StratomeXLineUp(parent, true, onAdd, onCluster);
}

// ---------------------------------------------------------------------------------------------------------------------

/**
 * Creates LineUp for normal data.
 * @param parent
 * @param onAdd
 * @param onCluster
 * @returns {StratomeXLineUp}
 */
export function createData(parent: Element, onAdd: any, onCluster: any)
{
  return new StratomeXLineUp(parent, false, onAdd, onCluster);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
