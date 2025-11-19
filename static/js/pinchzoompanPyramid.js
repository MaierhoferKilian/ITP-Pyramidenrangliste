function test(messgae){
    console.log("Test message: " + messgae);
}

document.addEventListener('DOMContentLoaded', function() {
const svg = d3.select("#svg");
if (svg.empty()) {
  console.error("SVG element with id 'svg' not found!");
  return;
} else {
  console.log("SVG element found successfully");
}

const width = 1000;
const height = 700;

svg.attr("viewBox", `0 0 ${width} ${height}`);

// Create zoom behavior with dynamic limits
const zoom = d3.zoom()
  .scaleExtent([0.3, 8])
  .extent([[0, 0], [width, height]])
  .on("zoom", (event) => {
    container.attr("transform", event.transform);
  });
svg.call(zoom);

const container = svg.append("g");

let selectedId = null;

const TOTAL_RECTANGLES = TOTAL_PLAYERS;
const SPECIAL_POSITION = CURRENT_USER_RANK;
let IS_CURRENT_USER_NEW = typeof IS_NEW_PLAYER !== 'undefined' ? IS_NEW_PLAYER : false;

// Update zoom and pan limits based on pyramid size
function updateZoomAndPanLimits(totalRectangles) {
  const rectW = 30;
  const rectH = 20;
  const gap = 10;
  const startY = 48;
  const maxRows = Math.ceil((-1 + Math.sqrt(1 + 8 * totalRectangles)) / 2);
  const maxRowWidth = maxRows * rectW + (maxRows - 1) * gap;
  const pyramidHeight = startY + (maxRows - 1) * (rectH + gap) + rectH;
  const padding = 100;
  const fullWidth = maxRowWidth + padding * 2;
  const fullHeight = pyramidHeight + padding * 2;
  const scaleX = width / fullWidth;
  const scaleY = height / fullHeight;
  const minScale = Math.min(scaleX, scaleY) * 0.8;

  zoom.scaleExtent([minScale, 8]);

  const margin = 400;
  const minX = (width - maxRowWidth) / 2 - margin;
  const maxX = (width + maxRowWidth) / 2 + margin;
  const minY = startY - margin;
  const maxY = pyramidHeight + margin;
  
  zoom.translateExtent([[minX, minY], [maxX, maxY]]);
  svg.call(zoom);
}

// Display challengeable players
function getParentPositions(position) {
  const parents = [];
  
  // If in top 6 positions (rows 1-3), can challenge all positions ahead
  if (position <= 6) {
    for (let i = 1; i < position; i++) {
      parents.push(i);
    }
    return parents;
  }
  
  // For positions beyond top 6, use the original logic
  let currentRow = 1;
  let positionStart = 1;
  
  while (positionStart + currentRow - 1 < position) {
    positionStart += currentRow;
    currentRow++;
  }
  
  const positionInRow = position - positionStart;
  
  for (let i = 0; i < positionInRow; i++) {
    parents.push(positionStart + i);
  }
  
  if (currentRow > 1) {
    const prevRowStart = positionStart - (currentRow - 1);
    const prevRowLength = currentRow - 1;
    
    for (let i = positionInRow; i < prevRowLength; i++) {
      parents.push(prevRowStart + i);
    }
  }
  
  return parents;
}

// Challangeable?
function isChallengeable(targetPosition) {
  // Top 6 rule - use normal pyramid logic (all ahead)
  if (SPECIAL_POSITION <= 6) {
    const challengeablePositions = getParentPositions(SPECIAL_POSITION);
    return challengeablePositions.includes(targetPosition);
  }
  
  // Get normal challengeable positions (pyramid logic)
  const challengeablePositions = getParentPositions(SPECIAL_POSITION);
  
  // If current user is new (0 games) and not in top 6, can ALSO challenge positions 7 to own position - 1
  if (IS_CURRENT_USER_NEW) {
    return challengeablePositions.includes(targetPosition) || 
           (targetPosition > 6 && targetPosition < SPECIAL_POSITION);
  }
  
  // Otherwise use normal logic only
  return challengeablePositions.includes(targetPosition);
}

function drawPyramid(totalRectangles) {
  container.selectAll("*").remove();
  
  const rectW = 30;
  const rectH = 20;
  const gap = 10;
  const centerX = width / 2;
  const startY = 48;
  
  updateZoomAndPanLimits(totalRectangles);
  
  let globalCounter = 1;
  let currentRow = 1;
  
  while (globalCounter <= totalRectangles) {
    const rowWidth = currentRow * rectW + (currentRow - 1) * gap;
    const xStart = centerX - rowWidth / 2;
    const y = startY + (currentRow - 1) * (rectH + gap);
    
    const rectanglesInThisRow = Math.min(currentRow, totalRectangles - globalCounter + 1);
    
    for (let i = 0; i < rectanglesInThisRow; i++) {
      const x = xStart + i * (rectW + gap);
      const cellId = `cell-${globalCounter}`; 
      const currentPosition = globalCounter;
      
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
          selectCell(cellId, this, currentPosition);
        });
      
      cellGroup.append("rect")
        .attr("x", x + rectW/2 - 10)
        .attr("y", y + rectH/2 - 5) 
        .attr("width", 20)
        .attr("height", 10)
        .attr("class", "selected-indicator");
      
      // Create special position indicator (red)
      cellGroup.append("rect")
        .attr("x", x + rectW/2 - 10) 
        .attr("y", y + rectH/2 - 5) 
        .attr("width", 20)
        .attr("height", 10)
        .attr("class", "special-indicator");
      
      // Create parent indicator (orange)
      cellGroup.append("rect")
        .attr("x", x + rectW/2 - 10) 
        .attr("y", y + rectH/2 - 5)
        .attr("width", 20)
        .attr("height", 10)
        .attr("class", "parent-indicator");
      
      // Create hover indicator
      cellGroup.append("rect")
        .attr("x", x + rectW/2 - 10)
        .attr("y", y + rectH/2 - 5) 
        .attr("width", 20)
        .attr("height", 10)
        .attr("class", "hover-indicator");
      
      globalCounter++;
    }
    
    currentRow++;
  }
  applySpecialIndicators();
}

function applySpecialIndicators() {
  container.selectAll(".special-indicator").classed("active", false);
  container.selectAll(".parent-indicator").classed("active", false);
  
  if (SPECIAL_POSITION <= TOTAL_RECTANGLES) {
    // Always show red indicator for own position
    container.select(`[data-id="cell-${SPECIAL_POSITION}"] .special-indicator`)
      .classed("active", true);
    
    // Get normal pyramid challengeable positions
    const parentPositions = getParentPositions(SPECIAL_POSITION);
    
    // Highlight normal pyramid positions
    parentPositions.forEach(parentPos => {
      if (parentPos >= 1 && parentPos <= TOTAL_RECTANGLES) {
        container.select(`[data-id="cell-${parentPos}"] .parent-indicator`)
          .classed("active", true);
      }
    });
    
    // If current user is new and not in top 6, ALSO highlight positions 7 to own position - 1
    if (IS_CURRENT_USER_NEW && SPECIAL_POSITION > 6) {
      for (let i = 7; i < SPECIAL_POSITION; i++) {
        container.select(`[data-id="cell-${i}"] .parent-indicator`)
          .classed("active", true);
      }
    }
  }
}

function selectCell(id, rectElement, globalPosition) {
  if (selectedId) {
    container.select(`[data-id="${selectedId}"] .selected-indicator`)
      .classed("active", false);
  }
  
  selectedId = id;
  d3.select(rectElement.parentNode).select(".selected-indicator")
    .classed("active", true);
  
  // Show/hide challenge button
  const challengeButton = document.querySelector(".ball");
  if (challengeButton) {
    if (isChallengeable(globalPosition)) {
      challengeButton.style.display = "flex";
      challengeButton.style.animation = "none";
      setTimeout(() => {
        challengeButton.style.animation = "shake 0.5s";
      }, 10);
    } else {
      challengeButton.style.display = "none";
    }
  }
  
  // Fetch player data and update side menu
  fetch("/selected_player", { 
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ position: globalPosition })
  })
  .then(response => response.json())
  .then(data => {
    if (data.error) {
      console.error("Player not found");
      return;
    }
    // Update side menu with player data
    const playerName = document.getElementById("player-name");
    const playerClass = document.getElementById("player-class");
    const playerEmail = document.getElementById("player-email");
    const totalWins = document.getElementById("total-wins");
    const totalLosses = document.getElementById("total-losses");
    const winRate = document.getElementById("win-rate");
    const highestRank = document.getElementById("highest-rank");
    const currentRank = document.getElementById("current-rank");

    if (playerName) playerName.textContent = `${data.firstname} ${data.lastname}`;
    if (playerClass) playerClass.textContent = data.class || "-";
    if (playerEmail) playerEmail.textContent = data.email || "-";
    if (totalWins) totalWins.textContent = data.total_wins;
    if (totalLosses) totalLosses.textContent = data.total_losses;
    if (winRate) winRate.textContent = `${data.win_rate}%`;
    if (highestRank) highestRank.textContent = `#${data.highest_rank}`;
    if (currentRank) currentRank.textContent = `#${data.current_rank}`;

    getMenu("player");
  })
  .catch(error => {
    console.error("Error fetching player data:", error);
  });
  
  centerOnSelected();
}

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
  
  const transform = d3.zoomIdentity
    .translate(width/2 - centerX, height/2 - centerY);
  
  // Animate to center
  svg.transition()
    .duration(750)
    .call(zoom.transform, transform);
}

function fitPyramidToView() {
  const contentBBox = container.node().getBBox();
  
  if (contentBBox.width === 0 || contentBBox.height === 0) return;
  
  const padding = 50;
  const fullWidth = contentBBox.width + padding * 2;
  const fullHeight = contentBBox.height + padding * 2;
  const scaleX = width / fullWidth;
  const scaleY = height / fullHeight;
  const scale = Math.min(scaleX, scaleY);
  const centerX = contentBBox.x + contentBBox.width / 2;
  const centerY = contentBBox.y + contentBBox.height / 2;
  const transform = d3.zoomIdentity
    .translate(width / 2, height / 2)
    .scale(scale)
    .translate(-centerX, -centerY);
  
  svg.call(zoom.transform, transform);
}

// Initial draw
drawPyramid(TOTAL_RECTANGLES);

setTimeout(() => {
  fitPyramidToView();
}, 100);

});