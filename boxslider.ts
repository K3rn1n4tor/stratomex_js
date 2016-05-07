/**
 * Created by Michael Kern on 15.12.2015.
 */

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// libraries
import d3 = require('d3');
import $ = require('jquery');
import C = require('../caleydo_core/main');
import vis = require('../caleydo_core/vis');

import vector = require('../caleydo_core/vector');
import geom = require('../caleydo_core/geom');
import ranges = require('../caleydo_core/range');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// class declaration
/**
 * This is both a box chart and a range slider to analyze the distribution of a given vector
 * and to divide these chart in divisions via sliders.
 */
export class BoxSlider extends vis.AVisInstance implements vis.IVisInstance {
  private $node:d3.Selection<any>;
  private divisions:any[] = [];
  private changed = false;
  private numBars = 0;
  private sliders:any[] = [];
  private labels:any[] = [];
  private boxValues:any[] = [];
  private $tooltip:d3.Selection<any>;
  private isDragging:boolean = false; // way to detect dragging behavior

  /**
   * Initialize the visualization.
   * @param data vector of distances
   * @param parent HTML element / node where the vis should be created in
   * @param options additional settings
   */
  constructor(public data:any, public parent:Element, private options:any) {
    super();
    this.options = C.mixin({
      scale: [1, 1],
      rotate: 0,
      numAvg: 10, // default number of elements averaged and grouped in one box element
      numSlider: 2, // number of sliders
      sliderColor: 'black', // default color for sliders
      sliderHeight: 4, // height of slider in px
      duration: 50, // duration of animations in ms
      precision: 2, // precision of values in tooltip box
      valueName: 'Distance', // name of data element
    }, options);

    if (this.options.scaleTo) {
      var scaling = this.options.scaleTo;
      var raw = this.rawSize;
      this.options.scale = raw.map((d, i) => {
        return scaling[i] / d;
      });
    }

    this.$node = this.build(d3.select(this.parent));
    this.$node.datum(data);
    vis.assignVis(<Element>this.$node.node(), this);
    this.colorizeBars();
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Obtain the initial size of this visualization.
   * @returns {number[]}
   */
  get rawSize():[number, number] {
    return [50, 300];
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Return the root node of this visualization.
   * @returns {Element}
   */
  get node() {
    return <Element>this.$node.node();
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Return the number of divisions
   * @returns {any}
   */
  public getNumberDivisions() {
    return this.options.numSlider + 1;
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Signals that the status has changed (e.g. slider was moved).
   * @returns {boolean}
   */
  hasChanged() {
    var temp = this.changed;
    this.changed = false;
    return temp;
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Return the labels of the divider
   * @returns {any[]}
   */
  getLabels() {
    return this.labels;
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   *
   * @param name
   * @param val
   * @returns {*}
   */
  option(name:string, val?:any) {
    if (arguments.length === 1) {
      return this.options[name];
    } else {
      this.fire('option', name, val, this.options[name]);
      this.fire('option.' + name, val, this.options[name]);
      this.options[name] = val;
    }
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Set labels corresponding to the distance values.
   * @param labels
   */
  setLabels(labels:any[]) {
    this.labels = labels;
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Set divisions manually and colorize bars accordingly
   * @param divisions
   */
  setDivisions(divisions:number[]) {
    this.divisions = divisions;
    this.colorizeBars();
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Returns the raw division arrays, containing indices of each slider.
   * @returns {any[]}
   */
  getCurrentDivisions() {
    return this.divisions;
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   *
   * @param range
   * @returns {Promise<Rect>}
   */
  locateImpl(range:ranges.Range) {
    var size = this.size;

    return Promise.resolve(geom.rect(0, 0, size[0], size[1]));
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Transforms and rotates visualization by given scale and rotation angle.
   * @param scale
   * @param rotate
   * @returns {any}
   */
  transform(scale?:number[], rotate:number = 0) {
    var opts = {
      scale: this.options.scale || [1, 1],
      rotate: this.options.rotate || 0
    };
    // default way to check how many arguments were passed into the function
    if (arguments.length === 0) {
      return opts;
    }

    // get raw size of image
    var raw = this.rawSize;
    this.$node.style('transform', 'rotate(' + rotate + 'deg)');
    this.$node.attr('width', raw[0] * scale[0]).attr('height', raw[1] * scale[1]);
    this.$node.select('g').attr('transform', 'scale(' + scale[0] + ',' + scale[1] + ')');

    var newSize = {
      scale: scale,
      rotate: rotate
    };

    // fire new event with transform signal
    this.fire('transform', newSize, opts);
    // set new values for options
    this.options.scale = scale;
    this.options.rotate = rotate;

    this.zoomSlider();

    return newSize;
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Determines labels of each division if labels are set or returns index intervals.
   * @returns {Array}
   */
  getDivisionRanges(indexRange = true):any[] {
    // if slices of labels are required but no labels are set, return immediately
    if (this.labels.length === 0 && !indexRange) {
      return [];
    }

    var ranges = [];

    var numRanges = this.options.numSlider + 1;

    for (var j = 0; j < numRanges; ++j) {
      var minIndex = (j === 0) ? 0 : this.divisions[j - 1];
      var maxIndex = (j === numRanges - 1) ? this.numBars : this.divisions[j];

      var minI = minIndex * this.options.numAvg;
      var maxI = Math.min(maxIndex * this.options.numAvg, this.labels.length);

      //ranges.push(this.labels.slice(minI, maxI));
      if (indexRange) {
        ranges.push('(' + String(minI) + ':' + String(maxI) + ')');
      } else {
        ranges.push(this.labels.slice(minI, maxI));
      }
    }

    return ranges;
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Build all the graphical components.
   * @param $parent
   * @param sliderStarts
   * @returns {Selection<any>}
   */
  private build($parent:d3.Selection<any>, sliderStarts:number[] = null) {
    var scaling = this.options.scale;
    var size = this.size;
    //var rawSize = this.rawSize;

    var $svg = $parent.append('svg').attr({
      width: size[0], height: size[1], 'class': 'boxslider'
    });

    var $root = $svg.append('g').attr('transform', 'scale(' + scaling[0] + ',' + scaling[1] + ')');

    const that = this;

    // helper function to build components
    function buildComponents(vec:any) {
      that.buildBoxChart($root, vec);
      that.buildSlider($root, vec, sliderStarts);

      that.markReady();
    }

    if (this.data instanceof Array) {
      buildComponents(this.data);
    } else {
      this.data.data().then((vec:any) => {
        buildComponents(vec);
      });
    }

    return $svg;
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Function that handles all mouse events for this visualization.
   * @param type type of mouse event
   * @param $root root of this visualization
   * @param args additional arguments
   * @returns {function(any): undefined}
   * @private
   */
  private _mouseHandler(type:string, $root:d3.Selection<any>, args:any) {
    var that = this;
    const tooltipHeight = 17;

    if (type === 'mouseover' || type === 'mousemove') {
      var scaleY = args[0];

      return function (_:any) {
        if (that.isDragging) {
          return;
        }

        const mousePos = d3.mouse($root.node());
        const posY = mousePos[1];

        const absPos = d3.mouse(that.parent);
        const absPosX = absPos[0];
        //const absPosY = absPos[1];

        var index = d3.round(scaleY.invert(posY) - 0.5);
        index = Math.min(that.numBars - 1, Math.max(0, index));
        var value = d3.round(that.boxValues[index], that.options.precision);

        var $bar = $(that.$node.select('.bar' + index).node());
        // HINT! use this technique to compute relative distance to parent, works for both Firefox and Chrome!
        var absPosY = $bar.offset().top - $bar.parent().parent().offset().top + 18 - tooltipHeight / 2;

        if (type === 'mousemove') {
          that.colorizeBars();
        }

        that.$node.select('.bar' + index).datum(value)
          .transition().duration(that.options.duration).attr('fill', 'darkorange');

        that.$tooltip.style('opacity', 1);
        that.$tooltip.html(that.options.valueName + ': ' + String(value));
        that.$tooltip.style({left: (absPosX + 5) + 'px', top: (absPosY) + 'px'});

        for (var i = 0; i < that.options.numSlider; ++i) {
          var slider = that.sliders[i].select('.sliderBar' + String(i));
          slider.attr('opacity', 0.5);
        }

      };
    } else if (type === 'mouseout') {
      return function (_:any) {
        // prevent removing tooltip when dragging is active
        if (that.isDragging) {
          return;
        }

        that.$tooltip.style('opacity', 0);
        that.colorizeBars();

        for (var i = 0; i < that.options.numSlider; ++i) {
          var slider = that.sliders[i].select('.sliderBar' + String(i));
          slider.attr('opacity', 0.25);
        }
      };
    }
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Build the box chart for this visualization.
   * @param $root
   * @param vec raw data
   */
  private buildBoxChart($root:d3.Selection<any>, vec:any) {
    const that = this;

    const rawSize = this.rawSize;
    const numElems = vec.length;

    // if number of elements is too small and number of bars is smaller than the number of sliders, use
    // and average value of 1 instead
    this.options.numAvg = (numElems < this.options.numAvg * (this.options.numSlider + 3)) ? 1 : this.options.numAvg;
    const numBars = Math.ceil(numElems / this.options.numAvg);
    this.numBars = numBars;
    // compute height of bars
    const barHeight = rawSize[1] / numElems * that.options.numAvg;
    var lastBarHeight = 0;

    for (var i = 0; i < numBars; ++i) {
      var startIndex = i * this.options.numAvg;
      var endIndex = Math.min(startIndex + this.options.numAvg, vec.length);
      var subSlice = vec.slice(startIndex, endIndex);
      // get the box values (needed if values are averaged)
      this.boxValues.push(d3.mean(subSlice));
      // get the last bar height to adjust the scaleY at the end
      lastBarHeight = (endIndex - startIndex) / this.options.numAvg * barHeight;
    }

    var range = (this.options.range) ? this.options.range : d3.extent(this.boxValues);

    var scaleY = d3.scale.linear().domain([0, numBars - 1]).range([0, rawSize[1] - lastBarHeight]);
    var scaleX = d3.scale.linear().domain(range).range([0, rawSize[0]]);

    // create dummy rect to detect hovering event
    var dummyData = Array.apply(null, new Array(this.options.numSlider + 1)).map((_, i) => {
      return i;
    });

    $root.selectAll('rect').data(dummyData).enter()
      .append('rect').attr({
      width: rawSize[0], height: rawSize[1], opacity: 1,
      class: (_, i) => {
        return 'sliderBack' + String(i);
      }, fill: 'white'
    })
      .on('mousemove', this._mouseHandler('mousemove', $root, [scaleY]))
      .on('mouseout', this._mouseHandler('mouseout', $root, []));

    // create groups that contain the bars
    var bars = $root.selectAll('g').data(this.boxValues)
      .enter().append('g').attr({
        id: 'barGroup', class: 'bar', 'transform': (d:any, i:number) => {
          return 'translate(0, ' + scaleY(i) + ')';
        },
      });

    // create a custom tooltip object to display distances
    this.$tooltip = d3.select(this.parent).append('div').attr({
      class: 'tooltip'
    }).style({
      opacity: 0, position: 'absolute !important', 'background': '#60AA85', width: '100px',
      'font-size:': '14px', 'border-radius': '4px', 'text-align': 'center', padding: 0, margin: 0,
      'pointer-events': 'none', left: 0, top: 0, 'color': 'white'
    });


    // create the bars
    bars.append('rect').attr({
      x: 0, y: 0,
      width: (d:any) => {
        return scaleX(d);
      }, height: barHeight,
      'fill': this.options.sliderColor, id: 'bar', class: (_:any, i:number) => {
        return 'bar' + String(i);
      },
      'shape-rendering': 'crispEdges', stroke: 'black', 'stroke-width': '2px', 'stroke-alignment': 'inner',
      'stroke-opacity': 0.05
    }).on('mousemove', this._mouseHandler('mousemove', $root, [scaleY]))
      .on('mouseout', this._mouseHandler('mouseout', $root, []));
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Function that handles all the drag events for this visualization.
   * @param type type of drag event
   * @param $root root element of this vis
   * @param args additional arguments
   * @returns {function(any): undefined}
   * @private
   */
  private _dragHandler(type:string, $root:d3.Selection<any>, args:any) {
    var that = this;
    const tooltipHeight = 17;

    if (type === 'dragstart' || type === 'drag') {
      var barCover = args[0];
      var barHeight = args[1];
      var scaleY = args[2];

      return function (_:any) {
        that.isDragging = true;

        const rawSize = that.rawSize;
        const scaling = that.options.scale;
        const width = rawSize[0] * scaling[0];

        const id = d3.select(this).attr('id');
        const number = parseInt(id.slice(-1), 10);
        const index = that.divisions[number];

        $root.select('.sliderBar' + number).transition().duration(that.options.duration)
          .attr('fill', 'darkorange');

        var mousePos = d3.mouse($root.node());
        var posY = mousePos[1];
        //console.log('AbsoluteMousePos', posY);

        // new index
        var newIndex = d3.round(scaleY.invert(posY));
        // indices around slider
        var minIndex, maxIndex;

        // handle indices differently
        if (type === 'dragstart') {
          maxIndex = Math.max(0, Math.min(that.numBars - 1, newIndex));
          minIndex = Math.max(0, Math.min(that.numBars - 1, newIndex - 1));
        } else {// type == 'drag'
          var borders = [0, that.numBars];
          if (that.options.numSlider > 1) {
            var leftIndex = (number === 0) ? 0 : that.divisions[number - 1] + 1;
            var rightIndex = (number === that.options.numSlider - 1) ? that.numBars : that.divisions[number + 1] - 1;
            borders = [leftIndex, rightIndex];
          }

          newIndex = Math.min(borders[1], Math.max(borders[0], newIndex));

          // obtain two values nearby slider
          minIndex = Math.max(0, newIndex - 1);
          minIndex = Math.min(borders[1], Math.max(Math.max(borders[0] - 1, 0), minIndex));
          maxIndex = Math.min(that.numBars - 1, newIndex);
          maxIndex = Math.min(borders[1], Math.max(borders[0], maxIndex));

          if (newIndex !== index) {
            that.sliders[number]//.transition().duration(that.options.duration)
              .attr('transform', 'translate(0,' + (scaleY(newIndex) - barCover / 2) + ')');

            that.divisions[number] = newIndex;
            that.changed = true;
          }

          // colorize bars before recoloring
          that.colorizeBars();

          // color backgrounds
          for (var i = 0; i < (that.options.numSlider + 1); ++i) {
            var prevSliderPos = (i === 0) ? 0 : scaleY(that.divisions[i - 1]);
            var currSliderPos = (i === that.options.numSlider) ? rawSize[1] : scaleY(that.divisions[i]);

            $root.select('.sliderBack' + String(i)).attr({
              y: prevSliderPos, height: (currSliderPos - prevSliderPos),
              fill: (that.options.backgrounds) ? that.options.backgrounds[i] : 'white'
            });
          }
        }

        const value = d3.round((that.boxValues[minIndex] + that.boxValues[maxIndex]) / 2, that.options.precision);
        //const sliderPosY = $(that.sliders[number].node()).position().top;
        //console.log('SliderPosY', sliderPosY);

        var $slider = $(that.sliders[number].node());
        var sliderPosY = $slider.offset().top - $slider.parent().offset().top + 18;
        //console.log(posYTest);

        const sliderHeight = barHeight * scaling[1];

        that.$tooltip.style('opacity', 1);
        that.$tooltip.html(that.options.valueName + ': ' + String(value));
        that.$tooltip.style({left: width + 'px', top: (sliderPosY + sliderHeight * 1.5 - tooltipHeight / 2) + 'px'});

        that.$node.select('.bar' + minIndex).datum(that.boxValues[minIndex])
          .transition().duration(that.options.duration).attr('fill', 'darkorange');
        that.$node.select('.bar' + maxIndex).datum(that.boxValues[maxIndex])
          .transition().duration(that.options.duration).attr('fill', 'darkorange');
      };
    } else if (type === 'dragend') {
      return function (_:any) {
        that.isDragging = false;

        var id = d3.select(this).attr('id');
        var number = parseInt(id.slice(-1), 10);

        that.$tooltip.style('opacity', 0);
        that.colorizeBars();

        $root.select('.sliderBar' + number).transition().duration(that.options.duration)
          .attr('fill', that.options.sliderColor);
      };
    }
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Update vector data and rebuild boxchart and sliders again.
   * @param data
   */
  public updateData(data:any) {
    this.$node.remove();
    this.$node = this.build(d3.select(this.parent), this.divisions);
    this.$node.datum(data);
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Find the start indices of each slider by analyzing the distribution of the data.
   * @param vec raw data
   * @returns {number[]}
   * @private
   */
  private _findSliderStarts(vec:any):number[] {
    // set slider indices for given number of sliders
    var sliderStarts:number[] = [];

    // sort vector
    var sortedVec = vec.slice().sort((a, b) => {
      return a - b;
    });

    if (this.options.numSlider > 1) {
      const Q1 = d3.quantile(sortedVec, 0.5);
      const Q2 = d3.quantile(sortedVec, 0.75);
      //const Q2 = d3.quantile(vec, 0.5);
      //const IQR = 1.5 * (Q3 - Q1);
      const minValue = Q1;
      const maxValue = Q2;
      const stepSize = (maxValue - minValue) / (this.options.numSlider - 1);

      for (var j = 0; j < this.options.numSlider; ++j) {
        const currentValue = minValue + j * stepSize;
        var index = (sliderStarts.length === 0) ? 0 : sliderStarts[j - 1];

        for (var i = index; i < sortedVec.length; ++i) {
          var value = sortedVec[i];

          if (value >= currentValue) {
            index = Math.floor(i / this.options.numAvg);
            sliderStarts.push(index);
            break;
          }
        }
      }
    } else {
      const Q2 = d3.quantile(sortedVec, 0.50);

      for (var i = 0; i < sortedVec.length; ++i) {
        var value = sortedVec[i];

        if (value >= Q2) {
          index = Math.floor(i / this.options.numAvg);
          sliderStarts.push(index);
          break;
        }
      }
    }

    return sliderStarts;
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Build all the sliders for the bar chart to divide bars into numSlider + 1 groups.
   * @param $root
   * @param vec
   * @param currSliderStarts
   */
  private buildSlider($root:d3.Selection<any>, vec:any, currSliderStarts:number[] = null) {
    const that = this;

    const rawSize = this.rawSize;
    const scaling = this.options.scale;
    if (scaling[1] === 0) {
      scaling[1] = 1;
    }

    const barHeight = this.options.sliderHeight / scaling[1];
    const barCover = 3 * barHeight;

    const numElems = vec.length;
    var histoBarHeight = rawSize[1] / numElems * that.options.numAvg;
    var sliderIndices = [];
    var sliderTicks = [];

    for (var i = 0; i < this.numBars; ++i) {
      sliderIndices.push(i);
      sliderTicks.push(i * histoBarHeight);
    }

    sliderIndices.push(this.numBars);
    sliderTicks.push(rawSize[1]);

    var scaleY = d3.scale.linear().domain(sliderIndices).range(sliderTicks);

    var dragSlider = d3.behavior.drag()
      .on('dragstart', this._dragHandler('dragstart', $root, [barCover, barHeight, scaleY]))
      .on('drag', this._dragHandler('drag', $root, [barCover, barHeight, scaleY]))
      .on('dragend', this._dragHandler('dragend', $root, []));

    // find starting indices of each slider
    var sliderStarts = currSliderStarts;
    if (!sliderStarts) {
      sliderStarts = this._findSliderStarts(vec);
    }

    // create slider element
    for (var i = 0; i < this.options.numSlider; ++i) {
      const sliderIndex = sliderStarts[i];
      const sliderRadius = 10 + 'px';

      var group = $root.append('g').attr(
        {
          id: 'slider' + String(i), class: 'sliderGroup',
          'transform': 'translate(0,' + (scaleY(sliderIndex) - barCover / 2) + ')',
        });

      var container = group.append('rect').attr(
        {
          id: 'slider' + String(i), class: 'sliderRect' + String(i),
          width: rawSize[0], height: barCover, opacity: 0
        }).on('mousemove', this._mouseHandler('mousemove', $root, [scaleY]))
        .on('mouseout', this._mouseHandler('mouseout', $root, []));

      var slider = group.append('rect').attr(
        {
          id: 'slider' + String(i),
          class: 'sliderBar' + String(i),
          y: barCover / 2 - barHeight / 2,
          height: String(barHeight) + 'px',
          width: rawSize[0],
          fill: that.options.sliderColor,
          rx: sliderRadius,
          ry: sliderRadius,
          opacity: 0.25
        });

      container.call(dragSlider);
      slider.call(dragSlider);

      function hoverSlider(action, slider) {
        if (action === 'mousemove') {
          return () => {
            slider.attr('opacity', 1);
          };
        } else if (action === 'mouseout') {
          return () => {
            slider.attr('opacity', 0.25);
          };
        }
      }

      group.on('mousemove', hoverSlider('mousemove', slider));
      group.on('mouseout', hoverSlider('mouseout', slider));

      this.sliders[i] = group;

      if (!currSliderStarts) {
        this.divisions.push(sliderIndex);
      }
    }

    // color backgrounds
    for (var i = 0; i < (this.options.numSlider + 1); ++i) {
      var prevSliderPos = (i === 0) ? 0 : scaleY(sliderStarts[i - 1]);
      var currSliderPos = (i === this.options.numSlider) ? rawSize[1] : scaleY(sliderStarts[i]);


      $root.select('.sliderBack' + String(i)).attr({
        y: prevSliderPos, height: (currSliderPos - prevSliderPos),
        fill: (that.options.backgrounds) ? this.options.backgrounds[i] : 'white'
      });
    }
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Rebuild slider if any transformation is applied.
   */
  zoomSlider() {
    var that = this;

    var $root = this.$node.select('g');

    for (var i = 0; i < this.options.numSlider; ++i) {
      $root.selectAll('g.sliderBar' + String(i)).remove();
      $root.selectAll('g.sliderRect' + String(i)).remove();
    }

    $root.selectAll('g.sliderGroup').remove();

    if (this.data instanceof Array) {
      that.buildSlider($root, that.data, this.divisions);
      that.colorizeBars();

      that.markReady();
    } else {
      this.data.data().then((vec:any) => {
        that.buildSlider($root, vec, this.divisions);
        that.colorizeBars();

        that.markReady();
      });
    }
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Color the bars with given, pre-defined colors.
   */
  private colorizeBars() {
    // TODO! change colorizing code and make it easier to control coloring of bars and background

    const greenColor = '#cbc9e2';//'#009900';//'#45AA55'; ['#cbc9e2', '#9e9ac8', '#756bb1']
    const yellowColor = '#9e9ac8';//'#AAAA00';//'#AAAA40';
    const redColor = '#756bb1';//'#BB0000';//'#AA4040';

    var colors:string[] = [];

    if (this.options.numSlider === 0 && this.divisions.length === 0) {
      // TODO toggle colorByValue / colorByRange
      const midRange = (this.options.range[0] + this.options.range[1]) / 2.0;
      colors = (this.options.colorScheme) ? <string[]>this.options.colorScheme : ['red', 'yellow', 'green'];

      var cScale = d3.scale.linear().domain([this.options.range[0], midRange, this.options.range[1]])
        .range((<any>colors));

      var colorByValue = function (d:any) {
        return cScale(d);
      };
      var colorFunc = (this.options.colorFunction) ? this.options.colorFunction : colorByValue;

      this.$node.selectAll('#bar').transition().duration(this.options.duration).attr('fill', colorFunc);//this.options.sliderColor);
    } else {
      const numDivs = this.divisions.length;

      var descs:any[] = [];

      colors = (numDivs === 1) ? [greenColor, redColor] : [greenColor, yellowColor, redColor];
      if (this.options.colorScheme) {
        colors = this.options.colorScheme;
      }

      var sliderIndices = Array.apply(null, Array(numDivs + 1)).map((_, i:number) => {
        return i;
      });
      var colorScale = d3.scale.linear().domain(sliderIndices).range(<any>colors);

      // build descriptions
      for (var i = 0; i < numDivs + 1; ++i) {
        var minIndex = (i === 0) ? 0 : this.divisions[i - 1];
        var maxIndex = (i === numDivs) ? this.numBars : this.divisions[i];
        var range = [minIndex, maxIndex];

        descs.push({range: range, color: colorScale(i)});
        minIndex = maxIndex;
      }

      // TODO! replace this by discrete scaling function (d3)
      function colorize(_:any, i:number) {
        for (var j = 0; j < descs.length; ++j) {
          var colDesc = descs[j];
          if (i < colDesc.range[1] && i >= colDesc.range[0]) {
            return colDesc.color;
          }
        }
      }

      var colorFunc = (this.options.colorFunction) ? this.options.colorFunction : colorize;
      this.$node.selectAll('#bar').transition().duration(this.options.duration).attr('fill', colorFunc);
    }
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Destroys the node of this object.
   */
  destroy() {
    this.$node.remove();
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// creator functions

/**
 * Create a new bar chart + slider object.
 * @param data
 * @param parent
 * @param options
 * @returns {ClusterDivider}
 */
export function create(data:vector.IVector, parent:Element, options:any):vis.AVisInstance {
  return new BoxSlider(data, parent, options);
}

export function createRaw(data:Array<any>, parent:Element, options:any):vis.AVisInstance {
  return new BoxSlider(data, parent, options);
}
