
// Global objects go here (outside of any functions)

let data, scatterplot, barchart;
let difficultyFilter = [];

const dispatcher = d3.dispatch('filterCategories');


/**
 * Load data from CSV file asynchronously and render charts
 */

d3.csv('data/vancouver_trails.csv')
    .then(_data => {
        data = _data;

        data.forEach(function(d) {
            d.time = +d.time;
            d.distance = +d.distance;
        });

        console.log(data);

        const colorScale = d3.scaleOrdinal()
        .domain(['Easy', 'Intermediate', 'Difficult']) //Is there an alternate way to do this with the .map function?
        .range(['rgb(159, 230, 159)', 'rgb(44, 193, 44)', 'rgb(18, 126, 18)']);

        scatterplot = new Scatterplot({parentElement: '#scatterplot', colorScale: colorScale}, data);
        scatterplot.updateVis();

        barchart = new Barchart({parentElement: '#barchart', colorScale: colorScale}, data, dispatcher);
        barchart.updateVis();
    })

    .catch(error => console.error(error));



/**
 * Use bar chart as filter and update scatter plot accordingly
 */

function filterData() {
    if (difficultyFilter.length == 0) {
          scatterplot.data = data;
     } else {
           scatterplot.data = data.filter(d =>
difficultyFilter.includes(d.difficulty));
     }
     scatterplot.updateVis();
}




