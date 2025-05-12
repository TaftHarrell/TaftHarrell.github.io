class map {
  constructor(_config, _data) {
    this.config = {
      parentElement: _config.parentElement,
      containerWidth: _config.containerWidth || 900,
      containerHeight: _config.containerHeight || 600,
      margin: _config.margin || {top: 0, right: 0, bottom: 0, left: 0},
      projection: d3.geoMercator()
    };
    this.data = _data;
    this._cachedProjectionSettings = null;
    this._cachedMask = null;
    this.hurricanes = []; // Store the full hurricane dataset
    this.filteredHurricanes = null; // Store filtered hurricanes
    this.hurricaneGroups = null; // Store grouped hurricanes
    this.currentStep = 0;
    this.animationInterval2 = null;
    this.hurricaneData = [];
    this.visitedCoords = [];
    this.pathElement = null;
    this.initVis();
  }

  initVis() {
    const vis = this;
    const legendWidth = 300;
    const legendHeight = 30;
    vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
    vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

    const container = d3.select(vis.config.parentElement)
      .style('position', 'relative');

    vis.canvas = container.append('canvas')
      .attr('width', vis.config.containerWidth)
      .attr('height', vis.config.containerHeight)
      .style('position', 'absolute')
      .style('top', 0)
      .style('left', 0)
      .style('z-index', 0)
      .style('transform', 'translateZ(0)'); // Enable hardware acceleration

    vis.ctx = vis.canvas.node().getContext('2d', { alpha: true }); // Optimize canvas context
    vis.ctx.imageSmoothingEnabled = false; // Disable smoothing for better performance

    vis.svg = container.append('svg')
      .attr('width', vis.config.containerWidth)
      .attr('height', vis.config.containerHeight)
      .style('position', 'absolute')
      .style('top', 0)
      .style('left', 0)
      .style('z-index', 1);

    vis.geoPath = d3.geoPath().projection(vis.config.projection);

    vis.hurricaneFrequency = new Uint16Array(this.config.containerWidth * this.config.containerHeight);

    

    vis.colorSvg = d3.select("#colorElement")
      .append("svg")
      .attr("width", legendWidth)
      .attr("height", 40);

    vis.gradient = vis.colorSvg.append("defs")
      .append("linearGradient")
      .attr("id", "legendGradient");

    vis.gradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "white");

    vis.gradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "darkRed");

    vis.colorSvg.append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("fill", "url(#legendGradient)");
    
    


    

    vis.renderVis();
  }

  renderVis() {
    const vis = this;

    vis.states = topojson.feature(vis.data, vis.data.objects.states);

    if (!this._cachedProjectionSettings) {
      vis.config.projection
        .fitSize([vis.width * 6.5, vis.height * 6.5], vis.states)
        .translate([vis.width * 2.25, vis.height * 1.7]);
      this._cachedProjectionSettings = {
        scale: vis.config.projection.scale(),
        translate: vis.config.projection.translate()
      };
    } else {
      vis.config.projection
        .scale(this._cachedProjectionSettings.scale)
        .translate(this._cachedProjectionSettings.translate);
    }

    const mergedUS = topojson.merge(vis.data, vis.data.objects.states.geometries);
    const usGeoJSON = {
      type: "Feature",
      geometry: {
        type: "MultiPolygon",
        coordinates: mergedUS.coordinates
      }
    };
    const simplifiedUS = turf.simplify(usGeoJSON, { tolerance: 0.1, highQuality: false });
    vis.usPolygons = this.getAllPolygons(simplifiedUS);

    // Create a simple hash of the polygons for change detection
    const polygonHash = JSON.stringify(vis.usPolygons);

    // Only recompute the mask if any relevant property has changed
    if (
      !this._cachedMask ||
      this._cachedMaskWidth !== vis.config.containerWidth ||
      this._cachedMaskHeight !== vis.config.containerHeight ||
      this._cachedMaskProjection !== vis.config.projection ||
      this._cachedMaskPolygonHash !== polygonHash
    ) {
      vis.usMask = this.createUSMaskArray(
        vis.config.containerWidth,
        vis.config.containerHeight,
        vis.config.projection,
        vis.usPolygons
      );
      this._cachedMask = vis.usMask;
      this._cachedMaskWidth = vis.config.containerWidth;
      this._cachedMaskHeight = vis.config.containerHeight;
      this._cachedMaskProjection = vis.config.projection;
      this._cachedMaskPolygonHash = polygonHash;
      this.currentGroupIndex = 0;
      this.animationInterval = null;
      this.isPlaying = false;
    } else {
      vis.usMask = this._cachedMask;
    }

    vis.svg.selectAll('.geo-boundary-path')
      .data([topojson.mesh(vis.data, vis.data.objects.states)])
      .join('path')
      .attr('class', 'geo-boundary-path')
      .attr('d', vis.geoPath)
      .attr('fill', 'none')
      .attr('stroke', '#000')
      .attr('stroke-width', 3)
      .attr('pointer-events', 'none');

    d3.json("data/state-capitals.json").then(capitalsData => {
      const capitals = capitalsData.features;
    
      vis.svg.selectAll('.capital-dot')
        .data(capitals)
        .join('circle')
        .attr('class', 'capital-dot')
        .attr('cx', d => vis.config.projection(d.geometry.coordinates)[0])
        .attr('cy', d => vis.config.projection(d.geometry.coordinates)[1])
        .attr('r', 2)
        .attr('fill', 'black')
        .attr('stroke', 'white')
        .attr('stroke-width', 0.5); 

      vis.svg.selectAll('.capital-label')
        .data(capitals)
        .join('text')
        .attr('class', 'capital-label')
        .attr('x', d => {
        const x = vis.config.projection(d.geometry.coordinates)[0];
        // Adjust specific cities
        if (d.properties.name === "Asheville") return x - 10;
        if (d.properties.name === "Annapolis") return x - 45;
        if (d.properties.name === "Hartford") return x - 40;
        if (d.properties.name === "Montpelier") return x - 15;
        if (d.properties.name === "Columbus") return x + 4;
        if (d.properties.name === "Tallahassee") return x - 12;
        return x - 2;
      })
      .attr('y', d => {
        const y = vis.config.projection(d.geometry.coordinates)[1];
        if (d.properties.name === "Charlotte") return y + 10;
        if (d.properties.name === "Asheville") return y - 5;
        if (d.properties.name === "Harrisburg") return y - 5;
        if (d.properties.name === "Providence") return y + 12;
        if (d.properties.name === "Athens") return y - 4;
        if (d.properties.name === "Baton Rouge") return y - 4;
        return y + 9;
      })
        .text(d => d.properties.name)
        .attr('font-size', 10)
        .attr('fill', 'white')
    });
  }

  filterHurricanesByTimeRange(startYear, endYear) {
    let vis = this;

    if (!vis.hurricanes) return;
    
    vis.filteredHurricanes = this.hurricanes.filter(h => {
      const year = Math.floor(h.Date / 10000);
      return year >= startYear && year <= endYear;
    });

    // Group the filtered hurricanes
    vis.groupHurricanes();
    
    // Update the visualization
    vis.updateVisualization();
    return vis.filteredHurricanes;
  }

  // New method to group hurricanes
  groupHurricanes() {
    if (!this.filteredHurricanes) return;
  
    const totalHurricanes = this.filteredHurricanes.length;
    const groupSize = Math.ceil(totalHurricanes / 5);
    
    const remainder = totalHurricanes % 5;
    const numLargerGroups = remainder ;
    const numSmallerGroups = 5 - numLargerGroups;
    const smallerGroupSize = Math.floor(totalHurricanes / 5);
  
    // Sort hurricanes by date
    const sortedHurricanes = [...this.filteredHurricanes].sort((a, b) => a.Date - b.Date);
  
    this.hurricaneGroups = [];
    this.groupYearRanges = [];
    let currentIndex = 0;
  
    // Add larger groups
    for (let i = 0; i < numLargerGroups; i++) {
      const group = sortedHurricanes.slice(currentIndex, currentIndex + groupSize);
      this.hurricaneGroups.push(group);
      this.groupYearRanges.push({
        start: Math.floor(group[0].Date / 10000),
        end: Math.floor(group[group.length - 1].Date / 10000)
      });
      currentIndex += groupSize;
    }
  
    // Add smaller groups
    for (let i = 0; i < numSmallerGroups; i++) {
      const group = sortedHurricanes.slice(currentIndex, currentIndex + smallerGroupSize);
      this.hurricaneGroups.push(group);
      this.groupYearRanges.push({
        start: Math.floor(group[0].Date / 10000),
        end: Math.floor(group[group.length - 1].Date / 10000)
      });
      currentIndex += groupSize;
    }
    // Add broad time interval group
     this.hurricaneGroups.push(this.filteredHurricanes);
  }

  // New method to update the visualization
  updateVisualization() {
    // Clear previous visualization
    this.hurricaneFrequency.fill(0);

    // Update frequency for each group
    this.hurricaneGroups.forEach((group, groupIndex) => {
      group.forEach(hurricane => {
        const [cx, cy] = this.config.projection([hurricane.Longitude, hurricane.Latitude]);
        const radiusKm = this.windToRadius(hurricane.maxWind);
        const [ex, ey] = this.config.projection([hurricane.Longitude + (radiusKm / 111), hurricane.Latitude]);
        const dx = ex - cx;
        const dy = ey - cy;
        const pixelRadiusSq = dx * dx + dy * dy;

        // Bounding box for the circle
        const x0 = Math.max(0, Math.floor(cx - Math.sqrt(pixelRadiusSq)));
        const x1 = Math.min(this.config.containerWidth - 1, Math.ceil(cx + Math.sqrt(pixelRadiusSq)));
        const y0 = Math.max(0, Math.floor(cy - Math.sqrt(pixelRadiusSq)));
        const y1 = Math.min(this.config.containerHeight - 1, Math.ceil(cy + Math.sqrt(pixelRadiusSq)));

        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            const idx = y * this.config.containerWidth + x;
            if (this.usMask[idx] !== 1) continue;
            const distSq = (x - cx) * (x - cx) + (y - cy) * (y - cy);
            if (distSq <= pixelRadiusSq) {
              if (groupIndex != 5) {
                 this.hurricaneFrequency[idx] += (groupIndex + 1); // Use group index as weight
              }
            }
          }
        }
      });
    });

    // Update the color scale based on the new frequency data
    const maxFreq = d3.max(this.hurricaneFrequency);
    const colorScale = d3.scaleLinear()
      .domain([0, maxFreq])
      .range(['white', 'darkred']);

      d3.select("#highNumber").text(maxFreq.toString())
      
    
    
    
    

    // Update the visualization
    this.fillUSWithPerPixelData(i => {
      const freq = this.hurricaneFrequency[i];
      if (freq === 0) return [255, 255, 255, 0];
      const color = d3.color(colorScale(freq));
      return [color.r, color.g, color.b, 255];
    });
  }

  /**
 * Updates hurricane frequency for each pixel based on hurricane dataset.
 * @param {Array} hurricanes - Array of hurricane objects.
 */
  updateHurricaneFrequency(hurricaneArray) {
    let vis = this;
    vis.hurricanes = hurricaneArray; // Store the full dataset
    vis.filterHurricanesByTimeRange(1851, 2024); // Initial visualization with full range
  }

  /**
   * Generates the bounding box of the polygons (US)
   * 
   * @param {*} polygons - the polygons the bounding box is to be generated for.
   * 
   * @returns the min and max dimensions of the box.
   */
  getBoundingBoxOfAllPolygons(polygons) {
    let minLongitude = Infinity, minLatitude = Infinity, maxLongitude = -Infinity, maxLatitude = -Infinity;
    polygons.forEach(poly => {
      poly.forEach(([Longitude, Latitude]) => {
        if (Longitude < minLongitude) minLongitude = Longitude;
        if (Latitude < minLatitude) minLatitude = Latitude;
        if (Longitude > maxLongitude) maxLongitude = Longitude;
        if (Latitude > maxLatitude) maxLatitude = Latitude;
      });
    });
    return [minLongitude, minLatitude, maxLongitude, maxLatitude];
  }

  /**
   * Finds the bounding box of one polygon.
   * 
   * @param {*} polygon - the polygon the bounding box is to be generated for.
   * 
   * @returns the min and max dimensions of the box.
   */
  getBoundingBox(polygon) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    polygon.forEach(([x, y]) => {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    });
    return [minX, minY, maxX, maxY];
  }

  /**
   * Determines whether or not a point is within the U.S. json file.
   * 
   * @param {*} point - the point whose position is to be determined.
   * @param {*} polygon - the polygon that represents the bounding area.
   * 
   * @returns true if inside the polygon and false otherwise.
   */
  pointInPolygon(point, polygon) {
    var x = point[0], y = point[1];
    var inside = false;
    for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      var xi = polygon[i][0], yi = polygon[i][1];
      var xj = polygon[j][0], yj = polygon[j][1];
      var intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-12) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Gets all the polygons from the json file.
   * 
   * @param {*} usGeoJSON - the file from which polygons are to be extracted.
   * 
   * @returns all the polygons within the file.
   */
  getAllPolygons(usGeoJSON) {
    let polygons = [];
    usGeoJSON.geometry.coordinates.forEach(multi => {
      multi.forEach(ring => {
        polygons.push(ring);
      });
    });
    return polygons;
  }

  

  /**
   * Creates a mask for easy filtering of the canvas.
   * 
   * @param {*} width - the width of the canvas.
   * @param {*} height - the height of the canvas.
   * @param {*} projection - the projection used for the map.
   * @param {*} polygons - the polygons that create the bounding box of the canvas.
   * 
   * @returns the created mask.
   */
  createUSMaskArray(width, height, projection, polygons) {
    const mask = new Uint8Array(width * height);
    const bboxes = polygons.map(poly => this.getBoundingBox(poly));
    const [minLongitude, minLatitude, maxLongitude, maxLatitude] = this.getBoundingBoxOfAllPolygons(polygons);
    const [minX, minY] = projection([minLongitude, maxLatitude]);
    const [maxX, maxY] = projection([maxLongitude, minLatitude]);
    const xStart = Math.max(0, Math.floor(Math.min(minX, maxX)));
    const xEnd = Math.min(width - 1, Math.ceil(Math.max(minX, maxX)));
    const yStart = Math.max(0, Math.floor(Math.min(minY, maxY)));
    const yEnd = Math.min(height - 1, Math.ceil(Math.max(minY, maxY)));

    for (let y = yStart; y <= yEnd; y++) {
      for (let x = xStart; x <= xEnd; x++) {
        const coords = projection.invert([x, y]);
        if (!coords) continue;
        let inside = false;
        for (let p = 0; p < polygons.length; p++) {
          const poly = polygons[p];
          const [minX, minY, maxX, maxY] = bboxes[p];
          if (
            coords[0] >= minX && coords[0] <= maxX &&
            coords[1] >= minY && coords[1] <= maxY
          ) {
            if (this.pointInPolygon(coords, poly)) {
              inside = true;
              break;
            }
          }
        }
        if (inside) mask[y * width + x] = 1;
      }
    }
    return mask;
  }


  /**
   * Fills the canvas with color data based on a bounding box.
   * 
   * @param {*} colorFunc - the function used to determine pixel color.
   */
  fillUSWithPerPixelData(colorFunc) {
    const vis = this;
    const width = vis.config.containerWidth;
    const height = vis.config.containerHeight;
    const mask = vis.usMask;
  
    // Create a typed array for all pixel data
    const colorArray = new Uint8ClampedArray(width * height * 4);
  
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] === 1) {
        const color = colorFunc(i); // [r, g, b, a]
        const idx = i * 4;
        colorArray[idx] = color[0];
        colorArray[idx + 1] = color[1];
        colorArray[idx + 2] = color[2];
        colorArray[idx + 3] = color[3];
      }
    }
  
    // Create ImageData and set all pixel data at once
    const imageData = new ImageData(colorArray, width, height);
    vis.ctx.putImageData(imageData, 0, 0);
  }

windToRadius(maxWind) {
  // Example: 1 knot = 1.852 km/h, and a simple mapping
  // You should use a more accurate formula if you have one
  if (maxWind < 34) return 10 //tropical depression 10
  if (maxWind < 64) return 50; // tropical storm 50
  if (maxWind < 83) return 100; // Cat 1 100
  if (maxWind < 96) return 150; // Cat 2 150
  if (maxWind < 113) return 200; // Cat 3 200
  if (maxWind < 137) return 250; // Cat 4 250
  return 300; // Cat 5 300
}

showGroup(groupIndex) {
  let vis = this;
  
  if (groupIndex == 5) {
    const startYear = Math.floor(this.hurricaneGroups[5][0].Date / 10000)
    const endYear = Math.floor(this.hurricaneGroups[5][this.hurricaneGroups[5].length - 1].Date / 10000)
    vis.filterHurricanesByTimeRange(startYear, endYear);
    document.getElementById('groupLabel').textContent = startYear + " - " + endYear;

  }
  else {
    this.hurricaneFrequency.fill(0);
  if (!this.hurricaneGroups[groupIndex]) return;

  this.hurricaneGroups[groupIndex].forEach(hurricane => {
    const [cx, cy] = this.config.projection([hurricane.Longitude, hurricane.Latitude]);
    const radiusKm = this.windToRadius(hurricane["Maximum Sustained Wind"]);
    const [ex, ey] = this.config.projection([hurricane.Longitude + (radiusKm / 111), hurricane.Latitude]);
    const dx = ex - cx;
    const dy = ey - cy;
    const pixelRadiusSq = dx * dx + dy * dy;

    const x0 = Math.max(0, Math.floor(cx - Math.sqrt(pixelRadiusSq)));
    const x1 = Math.min(this.config.containerWidth - 1, Math.ceil(cx + Math.sqrt(pixelRadiusSq)));
    const y0 = Math.max(0, Math.floor(cy - Math.sqrt(pixelRadiusSq)));
    const y1 = Math.min(this.config.containerHeight - 1, Math.ceil(cy + Math.sqrt(pixelRadiusSq)));

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const idx = y * this.config.containerWidth + x;
        if (this.usMask[idx] !== 1) continue;
        const distSq = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        if (distSq <= pixelRadiusSq) {
          this.hurricaneFrequency[idx]++;
        }
      }
    }
  });

  // Update the color scale and map
  const maxFreq = d3.max(this.hurricaneFrequency);
  const colorScale = d3.scaleLinear()
    .domain([0, maxFreq])
    .range(['white', 'darkred']);
  
  d3.select("#highNumber").text(maxFreq.toString())
  

  this.fillUSWithPerPixelData(i => {
    const freq = this.hurricaneFrequency[i];
    if (freq === 0) return [255, 255, 255, 0];
    const color = d3.color(colorScale(freq));
    return [color.r, color.g, color.b, 255];
  });
}
  }

playAnimation() {
  if (this.isPlaying) return;
  this.isPlaying = true;
  document.getElementById('playPauseBtn').textContent = 'Pause';
  this.animationInterval = setInterval(() => {
    this.currentGroupIndex = (this.currentGroupIndex + 1) % this.hurricaneGroups.length;
    this.showGroup(this.currentGroupIndex);
    const range = this.groupYearRanges[this.currentGroupIndex];
    document.getElementById('groupLabel').textContent = `${range.start} - ${range.end}`;
    
  }, 2000);
}

pauseAnimation() {
  this.isPlaying = false;
  document.getElementById('playPauseBtn').textContent = 'Play';
  if (this.animationInterval) clearInterval(this.animationInterval);
  this.animationInterval = null;
}

toggleAnimation() {
  if (this.isPlaying) {
    this.pauseAnimation();
  } else {
    this.playAnimation();
  }
}

goToGroup(index) {
  this.currentGroupIndex = index;
  this.showGroup(index);
  const range = this.groupYearRanges[index];
  document.getElementById('groupLabel').textContent = `${range.start} - ${range.end}`;
  if (this.isPlaying) {
    this.pauseAnimation();
  }
}



/**
 * Finds a hurricane in the dataset and returns an array with all the
 * instances of that hurricane.
 * 
 * @param {*} name - the name of the hurricane
 * @param {*} year - the year of the hurricane
 * 
 * @returns an array of hurricane objects that represents that hurricane's path.
 */
findHurricane(name, year) {
  let vis = this;
  
  let hurricanePathArray = [];  // Create empty array to store hurricane objects

  vis.hurricanes.forEach(hurricane => { 
    if (hurricane.NAME != "UNNAMED") {
      const trimmedName = hurricane.NAME.trim();
      if(trimmedName == name && Math.floor(hurricane.Date / 10000) == year) {
        hurricanePathArray.push(hurricane);
      }
    }
  });

  return hurricanePathArray;
} 

/**
 * Displays the characteristics of a certain hurricane in the textbox and animates the hurricane.
 * 
 * @param {*} hurricaneArray - all data rows of the hurricane that will create the hurricane path.
 * 
 *  */

displayHurricane(hurricaneArray) {
  let vis = this;

  vis.hurricaneData = hurricaneArray;
  vis.currentStep = 0;

  // Clear previous
  d3.select(".hurricane").remove();
  d3.select(".hurricane-path").remove();

  const projection = vis.config.projection;

  // Initialize visitedCoords with only the first position
    const firstHurricane = hurricaneArray[0];
    vis.visitedCoords = [projection([firstHurricane.Longitude, firstHurricane.Latitude])];

  // Also ensure pathElement is cleared if re-running
  if (vis.pathElement) {
    vis.pathElement.remove();
    vis.pathElement = null;
  }

  // Draw hurricane path (line)
  const lineGenerator = d3.line()
    .x(d => projection([d.Longitude, d.Latitude])[0])
    .y(d => projection([d.Longitude, d.Latitude])[1]);

  vis.svg.append("path")
    .datum(hurricaneArray)
    .attr("class", "hurricane-path")
    .attr("fill", "none")
    .attr("stroke", "steelblue")
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "10,10")
    .attr("d", lineGenerator);

  // Draw initial circle
  vis.hurricaneCircle = vis.svg.append("circle")
    .attr("class", "hurricane")
    .attr("r", 4)
    .attr("fill", "blue");

  vis.updateHurricaneStep(vis, vis.currentStep);
}

// Update display at a given step
updateHurricaneStep(vis, step) {
  if (step < 0 || step >= vis.hurricaneData.length) return;
  const hurricane = vis.hurricaneData[step];
  const projection = vis.config.projection;
  const coords = projection([hurricane.Longitude, hurricane.Latitude]);

 // Slice the hurricane data from 0 to the current step
vis.visitedCoords = vis.hurricaneData
.slice(0, step + 1)
.map(d => projection([d.Longitude, d.Latitude]));


  // Update text box
  document.getElementById('name').textContent = "Name: " + hurricane.NAME;
  const formattedDate = hurricane.Date.toString();
  const displayDate = formattedDate.substring(4, 6) + '/' + formattedDate.substring(6, 8) + '/' + formattedDate.substring(0, 4);
  document.getElementById('date').textContent = "Date: " + displayDate;
  const knot_to_MPH = (hurricane.Maximum_Sustained_Wind * 6076) / 5280;
  const formattedWind = Math.round(knot_to_MPH * 100) / 100;
  document.getElementById('maxWind').textContent = "Maximum Sustained Wind: " + formattedWind + " miles per hour";
  const classification = vis.classifyHurricane(hurricane.Status_of_System, hurricane.Maximum_Sustained_Wind)
  document.getElementById('classification').textContent = "Storm classification: " + classification;



  // Move circle
  vis.hurricaneCircle
    .transition()
    .duration(500)
    .attr("cx", coords[0])
    .attr("cy", coords[1])
    .attr("r", d => {
      if (classification == "Extratropical Cyclone") return 4;
      if (classification == "Tropical Depression") return 4;
      if (classification == "Tropical Storm") return 6;
      if (classification == "Category 1 Hurricane") return 10; 
      if (classification == "Category 2 Hurricane") return 12;
      if (classification == "Category 3 Hurricane") return 14; 
      if (classification == "Category 4 Hurricane") return 16;
      if (classification == "Category 5 Hurricane") return 20;
      if (classification == "Subtropical cyclone") return 4;
      if (classification == "Low-pressure system") return 4;
      if (classification == "Tropical Wave") return 4;
      if (classification == "Disturbance") return 4;
    });

  // Draw/update path
  if (!vis.pathElement) { 
    vis.pathElement = vis.svg.append("path")
      .attr("class", "hurricane-trail")
      .attr("fill", "none")
      .attr("stroke", "steelblue")
      .attr("stroke-width", 2)
  }

  const trailLine = d3.line()
    .x(d => d[0])
    .y(d => d[1]);

  vis.pathElement
    .attr("d", trailLine(vis.visitedCoords));

  vis.currentStep = step;

}

// Controls
nextStep(vis) {
  if (vis.currentStep < vis.hurricaneData.length - 1) {
    vis.currentStep++;
    vis.updateHurricaneStep(vis, vis.currentStep);
  }
}

prevStep(vis) {
  if (vis.currentStep > 0) {
    vis.currentStep--;
    vis.updateHurricaneStep(vis, vis.currentStep);
  }
}

togglePlay(vis) {
  const button = document.getElementById("playPause");
  if (vis.animationInterval2) {
    clearInterval(vis.animationInterval2);
    vis.animationInterval2 = null;
    button.textContent = "Play";
  } else {
    vis.animationInterval2 = setInterval(() => {
      if (vis.currentStep < vis.hurricaneData.length - 1) {
        vis.currentStep++;
        vis.updateHurricaneStep(vis, vis.currentStep);
      } else {
        clearInterval(vis.animationInterval2);
        vis.animationInterval2 = null;
        button.textContent = "Play";
      }
    }, 1000);
    button.textContent = "Pause";
  }
}



/**
 * Classifies a hurricane based on the hurricane's status and maximum sustained wind.
 * 
 * @param {*} status - the dataset's status of the hurricane.
 * @param {*} maxWind - maximum sustined wind of the hurricane
 * 
 * @returns the status of the system in an understandable format.
 */
classifyHurricane(status, maxWind) {
  const formattedStatus = status.trim();
  if (formattedStatus == "EX") return "Extratropical Cyclone";
  if (formattedStatus == "TD") return "Tropical Depression";
  if (formattedStatus == "TS") return "Tropical Storm";
  if (formattedStatus == "HU") {
    if (maxWind < 83) return "Category 1 Hurricane"; 
    if (maxWind < 96) return "Category 2 Hurricane";
    if (maxWind < 113) return "Category 3 Hurricane"; 
    if (maxWind < 137) return "Category 4 Hurricane";
    return "Category 5 Hurricane";
  }
  if (formattedStatus == "SD" || formattedStatus == "SS") return "Subtropical cyclone";
  if (formattedStatus == "LO") return "Low-pressure system";
  if (formattedStatus == "WV") return "Tropical Wave";
  if (formattedStatus == "DB") return "Disturbance";
  console.log(formattedStatus);
  return "Unknown";
}

hurricaneNameFinder(hurricaneData){

  const uniqueNames = new Set();
  const hurricaneNames=[];
  hurricaneData.forEach(h => {
      const key = `${h.NAME.trim()} - ${h.Date.toString().slice(0,4)}`;
    
  if (!uniqueNames.has(key) && !key.includes("UNNAMED")) {
    
    uniqueNames.add(key);
    hurricaneNames.push(key);
  }
  })
  return hurricaneNames
}

hurricaneCounter(startYear,endYear,hurricaneData){
  const hurricanes= new Set();
  var hurricaneCounter=0;
  hurricaneData.forEach(h => {
    const id=h.ID.split(' ')[0];
    const year=h.Date.toString().slice(0,4);
    if (year >= startYear && year<=endYear && !hurricanes.has(id)){
        hurricanes.add(id);
        hurricaneCounter++;
    }
  })
  return hurricaneCounter;
}

loadHurricaneSearchBar(hurricaneNameData){
  const datalist = document.getElementById('hurricane keyword');
hurricaneNameData.forEach(name => {
  const option = document.createElement('option');
  option.value = name;
  datalist.appendChild(option);
});
}

}


  







  





