/**
 * Implementing a U.S. Map using d3 library.
 * 
 * Author: Taft Harrell & Frank Howden - adapted from sandbox
 */

let geoMap1;

// Load geo data
d3.json('data/states-10m.json')
  .then(mapData => {
    geoMap1 = new map({ 
      parentElement: '#map',
      projection: d3.geoMercator()
    }, mapData);

    // Now load hurricanes only after geoMap1 is ready
    d3.json("data/hurricanes.json").then(hurricaneData => {
      // hurricaneData is an array!
      geoMap1.updateHurricaneFrequency(hurricaneData);
      // After geoMap1.updateHurricaneFrequency(hurricaneData);
      document.getElementById('playPauseBtn').addEventListener('click', () => {
        geoMap1.toggleAnimation();
      });

      document.getElementById('backwardBtn').addEventListener('click', () => {
        let newIndex = geoMap1.currentGroupIndex - 1;
        if (newIndex < 0) newIndex = geoMap1.hurricaneGroups.length - 1;
        geoMap1.goToGroup(newIndex);
      });
      
      document.getElementById('forwardBtn').addEventListener('click', () => {
        let newIndex = geoMap1.currentGroupIndex + 1;
        if (newIndex >= geoMap1.hurricaneGroups.length) newIndex = 0;
        geoMap1.goToGroup(newIndex);
      });
      hurricaneNames=geoMap1.hurricaneNameFinder(hurricaneData);
      geoMap1.loadHurricaneSearchBar(hurricaneNames);

      document.getElementById("HurricaneCount").
        textContent="Total hurricanes from 1851 - 2024: 1991 hurricanes";
      document.getElementById("groupLabel").
        textContent = "1851 - 2024";
      
    })
    .catch(error => console.error(error));
  })
  .catch(error => console.error(error));

// Add event listener for time range updates
document.getElementById('updateTimeRange').addEventListener('click', () => {
  const startYear = parseInt(document.getElementById('startYear').value);
  const endYear = parseInt(document.getElementById('endYear').value);
  
  if (startYear > endYear) {
    alert('Start year must be less than or equal to end year');
    return;
  }

  if (endYear - startYear < 10) {
    alert('Year difference between two years must be greater than or equal to 10');
    return
  }

  if (startYear > 2014) {
    alert('Start Year must be no greater than 2014')
    return
  }

  if (startYear < 1851) {
    alert('Start Year must be no less than 1851')
    return
  }

  if (endYear > 2024) {
    alert('End Year must be no greater than 2024')
    return
  }

  if (endYear < 1861) {
    alert('End Year must be no less than 1861')
    return
  }
  //getting hurricane that are filtered by years
  let hurricanes=geoMap1.filterHurricanesByTimeRange(startYear, endYear);
  let hurricaneCount = geoMap1.hurricaneCounter(startYear,endYear,hurricanes);
  document.getElementById("HurricaneCount").
            textContent="Total hurricanes from " + startYear + " - " + endYear + ": " + hurricaneCount + " hurricanes";
  document.getElementById("groupLabel").
            textContent = `${startYear} - ${endYear}`;
  
});

document.getElementById('hurricane_button').addEventListener('click', () => {
  var hurricane = document.getElementById("hurricaneSelector").value;
  if(!hurricane.includes('-')){
    alert("Hurricane must have -");
    return;
  }
  
  const hurricaneParsed = hurricane.split("-")
  const name = hurricaneParsed[0].trim();
  const year = hurricaneParsed[1].trim();
  const hurricaneArray = geoMap1.findHurricane(name, year);

  if (hurricaneArray.length == 0) {
    alert('Hurricane not found; Please try again.');
    return
  }

  geoMap1.displayHurricane(hurricaneArray);
});

document.getElementById("Previous").addEventListener("click", () => {
  geoMap1.prevStep(geoMap1);
});

document.getElementById("Next").addEventListener("click", () => {
  geoMap1.nextStep(geoMap1);
});

document.getElementById("playPause").addEventListener("click", () => {
  geoMap1.togglePlay(geoMap1);
});

