// Wait for DOM to be loaded
document.addEventListener('DOMContentLoaded', function() {

// Simple D3.js implementation
const svg = d3.select("#svg");

// Debug: Check if SVG element was found
if (svg.empty()) {
  console.error("SVG element with id 'svg' not found!");
  return;
} else {
  console.log("SVG element found successfully");
}

const width = 1000;
const height = 700;

// Set up SVG viewBox
svg.attr("viewBox", `0 0 ${width} ${height}`);

// Create zoom behavior with limits (will be updated dynamically)
const zoom = d3.zoom()
  .scaleExtent([0.3, 8]) // zoom limits
  .extent([[0, 0], [width, height]])
  .on("zoom", (event) => {
    container.attr("transform", event.transform);
  });

// Apply zoom to SVG
svg.call(zoom);

// Create main container for zoomable content
const container = svg.append("g");

// Variables
let selectedId = null;
const TOTAL_RECTANGLES = 120; // Anzahl der Rechtecke - hier ändern!
const SPECIAL_POSITION = 40; // Spezielle Position - hier ändern!

// Function to update zoom and pan limits based on pyramid size
function updateZoomAndPanLimits(totalRectangles) {
  const rectW = 30;
  const rectH = 20;
  const gap = 10;
  const startY = 48;
  
  // Calculate how many rows we need for all rectangles
  const maxRows = Math.ceil((-1 + Math.sqrt(1 + 8 * totalRectangles)) / 2);
  
  // Calculate pyramid dimensions
  const maxRowWidth = maxRows * rectW + (maxRows - 1) * gap;
  const pyramidHeight = startY + (maxRows - 1) * (rectH + gap) + rectH;
  
  // Calculate minimum zoom to fit entire pyramid with padding
  const padding = 100;
  const fullWidth = maxRowWidth + padding * 2;
  const fullHeight = pyramidHeight + padding * 2;
  
  const scaleX = width / fullWidth;
  const scaleY = height / fullHeight;
  const minScale = Math.min(scaleX, scaleY) * 0.8; // Add 20% buffer for zoom out
  
  // Update zoom scale extent with dynamic minimum
  zoom.scaleExtent([minScale, 8]);
  
  // Add generous margins around the actual pyramid for panning
  const margin = 400;
  const minX = (width - maxRowWidth) / 2 - margin;
  const maxX = (width + maxRowWidth) / 2 + margin;
  const minY = startY - margin;
  const maxY = pyramidHeight + margin;
  
  // Update zoom translate extent
  zoom.translateExtent([[minX, minY], [maxX, maxY]]);
  
  // Re-apply zoom behavior to update limits
  svg.call(zoom);
}

// Function to calculate parent positions for a given position
function getParentPositions(position) {
  const parents = [];
  
  // Find which row this position is in
  let currentRow = 1;
  let positionStart = 1;
  
  while (positionStart + currentRow - 1 < position) {
    positionStart += currentRow;
    currentRow++;
  }
  
  // Calculate position within the row (0-based)
  const positionInRow = position - positionStart;
  
  // Add ALL positions to the left in the same row
  for (let i = 0; i < positionInRow; i++) {
    parents.push(positionStart + i);
  }
  
  // Add ALL positions to the right in the row above
  if (currentRow > 1) {
    const prevRowStart = positionStart - (currentRow - 1);
    const prevRowLength = currentRow - 1;
    
    // Add all positions from positionInRow to end of previous row
    for (let i = positionInRow; i < prevRowLength; i++) {
      parents.push(prevRowStart + i);
    }
  }
  
  return parents;
}

// Create pyramid based on total number of rectangles
function drawPyramid(totalRectangles) {
  // Clear existing content
  container.selectAll("*").remove();
  
  // Rectangle dimensions
  const rectW = 30;
  const rectH = 20;
  const gap = 10;
  const centerX = width / 2;
  const startY = 48;
  
  // Update zoom and pan limits for this pyramid size
  updateZoomAndPanLimits(totalRectangles);
  
  let globalCounter = 1; // Global position counter starting from 1
  let currentRow = 1;
  
  // Continue until we've placed all rectangles
  while (globalCounter <= totalRectangles) {
    const rowWidth = currentRow * rectW + (currentRow - 1) * gap;
    const xStart = centerX - rowWidth / 2;
    const y = startY + (currentRow - 1) * (rectH + gap);
    
    // Place rectangles in this row (up to row number or remaining rectangles)
    const rectanglesInThisRow = Math.min(currentRow, totalRectangles - globalCounter + 1);
    
    for (let i = 0; i < rectanglesInThisRow; i++) {
      const x = xStart + i * (rectW + gap);
      const cellId = `cell-${globalCounter}`; // Use global counter as ID
      const currentPosition = globalCounter; // Capture current position for closure
      
      // Create group for each cell
      const cellGroup = container.append("g")
        .attr("data-id", cellId);
      
      // Create rectangle
      const rect = cellGroup.append("rect")
        .attr("x", x)
        .attr("y", y)
        .attr("width", rectW)
        .attr("height", rectH)
        .attr("fill", "transparent")
        .attr("stroke", "#40407A")
        .attr("stroke-width", 4)
        .attr("class", "pyr-rect")
        .style("cursor", "pointer")
        .on("click", function(event) {
          event.stopPropagation();
          selectCell(cellId, this, currentPosition); // Use captured position
        });
      
      // Create selected indicator first (bottom layer)
      cellGroup.append("rect")
        .attr("x", x + rectW/2 - 10) // center horizontally
        .attr("y", y + rectH/2 - 5)  // center vertically
        .attr("width", 20)
        .attr("height", 10)
        .attr("class", "selected-indicator");
      
      // Create special position indicator (red)
      cellGroup.append("rect")
        .attr("x", x + rectW/2 - 10) // center horizontally
        .attr("y", y + rectH/2 - 5)  // center vertically
        .attr("width", 20)
        .attr("height", 10)
        .attr("class", "special-indicator");
      
      // Create parent indicator (orange)
      cellGroup.append("rect")
        .attr("x", x + rectW/2 - 10) // center horizontally
        .attr("y", y + rectH/2 - 5)  // center vertically
        .attr("width", 20)
        .attr("height", 10)
        .attr("class", "parent-indicator");
      
      // Create hover indicator last (top layer - always visible on hover)
      cellGroup.append("rect")
        .attr("x", x + rectW/2 - 10) // center horizontally (20px width / 2 = 10px offset)
        .attr("y", y + rectH/2 - 5)  // center vertically (10px height / 2 = 5px offset)
        .attr("width", 20)
        .attr("height", 10)
        .attr("class", "hover-indicator");
      
      globalCounter++;
    }
    
    currentRow++;
  }
  
  // Apply special position and parent indicators
  applySpecialIndicators();
}

// Function to apply special position and parent indicators
function applySpecialIndicators() {
  // Reset all special indicators
  container.selectAll(".special-indicator").classed("active", false);
  container.selectAll(".parent-indicator").classed("active", false);
  
  // Activate special position indicator
  if (SPECIAL_POSITION <= TOTAL_RECTANGLES) {
    container.select(`[data-id="cell-${SPECIAL_POSITION}"] .special-indicator`)
      .classed("active", true);
    
    // Get and activate parent positions
    const parentPositions = getParentPositions(SPECIAL_POSITION);
    parentPositions.forEach(parentPos => {
      if (parentPos >= 1 && parentPos <= TOTAL_RECTANGLES) {
        container.select(`[data-id="cell-${parentPos}"] .parent-indicator`)
          .classed("active", true);
      }
    });
  }
}

// Select cell function
function selectCell(id, rectElement, globalPosition) {
  // Remove previous selection
  if (selectedId) {
    container.select(`[data-id="${selectedId}"] .selected-indicator`)
      .classed("active", false);
  }
  
  // Add new selection
  selectedId = id;
  // Find the parent group and activate its selected indicator
  d3.select(rectElement.parentNode).select(".selected-indicator")
    .classed("active", true);
  
  // Log selected position to console
  console.log(`Ausgewählte Position: ${globalPosition}`);
  
  // Automatically center on selected cell
  centerOnSelected();
}

// Center on selected cell
function centerOnSelected() {
  if (!selectedId) return;
  
  const cellGroup = container.select(`[data-id="${selectedId}"]`);
  if (cellGroup.empty()) return;
  
  const rect = cellGroup.select("rect");
  const x = +rect.attr("x");
  const y = +rect.attr("y");
  const w = +rect.attr("width");
  const h = +rect.attr("height");
  
  const centerX = x + w/2;
  const centerY = y + h/2;
  
  // Calculate transform to center the cell
  const transform = d3.zoomIdentity
    .translate(width/2 - centerX, height/2 - centerY);
  
  // Animate to center
  svg.transition()
    .duration(750)
    .call(zoom.transform, transform);
}

// Function to fit the entire pyramid in view
function fitPyramidToView() {
  // Get the bounding box of all content
  const contentBBox = container.node().getBBox();
  
  if (contentBBox.width === 0 || contentBBox.height === 0) return;
  
  // Add some padding around the pyramid
  const padding = 50;
  const fullWidth = contentBBox.width + padding * 2;
  const fullHeight = contentBBox.height + padding * 2;
  
  // Calculate the scale needed to fit the pyramid
  const scaleX = width / fullWidth;
  const scaleY = height / fullHeight;
  const scale = Math.min(scaleX, scaleY);
  
  // Calculate the center of the pyramid
  const centerX = contentBBox.x + contentBBox.width / 2;
  const centerY = contentBBox.y + contentBBox.height / 2;
  
  // Calculate transform to center and scale the pyramid
  const transform = d3.zoomIdentity
    .translate(width / 2, height / 2)
    .scale(scale)
    .translate(-centerX, -centerY);
  
  // Apply the transform
  svg.call(zoom.transform, transform);
}

// Button event listeners - removed unused buttons

// Initial draw and fit to view
drawPyramid(TOTAL_RECTANGLES);

// Wait a moment for the DOM to be ready, then fit pyramid to view
setTimeout(() => {
  fitPyramidToView();
}, 100);

}); // End of DOMContentLoaded