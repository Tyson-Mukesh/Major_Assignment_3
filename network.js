function simulate(data, svg) {
    const width = parseInt(svg.attr("viewBox").split(' ')[2]);
    const height = parseInt(svg.attr("viewBox").split(' ')[3]);
    
    const zoomable_group = svg.append("g");
    const main_group = zoomable_group.append("g").attr("transform", "translate(0, 50)");

    let node_degree = {};
    data.links.forEach(d => {
        node_degree[d.source] = (node_degree[d.source] || 0) + 1;
        node_degree[d.target] = (node_degree[d.target] || 0) + 1;
    });

    const scale_radius = d3.scaleSqrt()
        .domain(d3.extent(Object.values(node_degree)))
        .range([3, 12]);

    const countryCounts = {};
    data.nodes.forEach(node => {
        const country = node.country;
        if (country) {
            countryCounts[country] = (countryCounts[country] || 0) + 1;
        }
    });

    const topCountries = Object.entries(countryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(entry => entry[0]);

    const customColors = [
        "#e41a1c", "#377eb8", "#4daf4a", "#984ea3",
        "#ff7f00", "#ffbf00", "#a65628", "#f781bf",
        "#000000", "#66c2a5"
    ];

    const colorScale = d3.scaleOrdinal(customColors).domain(topCountries);

    const getColorByCountry = (country) => {
        const index = topCountries.indexOf(country);
        return index !== -1 ? colorScale(index) : "#cccccc"; 
    };

    const link_elements = main_group.append("g")
        .attr('transform', `translate(${width / 2},${height / 2})`)
        .selectAll(".line")
        .data(data.links)
        .enter()
        .append("line")
        .attr("stroke", "grey");

    const node_elements = main_group.append("g")
        .attr('transform', `translate(${width / 2},${height / 2})`)
        .selectAll(".circle")
        .data(data.nodes)
        .enter()
        .append('g')
        .on("mouseover", function (event, d) {
            const affiliation = d.affiliation;
            node_elements.selectAll("circle")
                .style("opacity", n => n.affiliation === affiliation ? 1 : 0.2);
        })
        .on("mouseout", function () {
            node_elements.selectAll("circle").style("opacity", 1);
        })
        .on("click", function (event, d) {
            const tooltip = d3.select("body").append("div")
                .attr("class", "tooltip")
                .style("opacity", 0);

            tooltip.transition().duration(200).style("opacity", .9);
            tooltip.html(`
                Author: ${d.id}<br>
                Affiliation: ${d.affiliation}<br>
                Country: ${d.country}<br>
                Publications: ${d.publications}<br>
                Titles: ${d.titles ? d.titles.join("<br>") : "No titles available"}
            `)
                .style("left", (event.pageX + 5) + "px")
                .style("top", (event.pageY - 28) + "px");

            setTimeout(() => {
                tooltip.transition().duration(500).style("opacity", 0).remove();
            }, 3000);
        });

    node_elements.append("circle")
        .attr("r", d => scale_radius(node_degree[d.id] || 0))
        .attr("fill", d => getColorByCountry(d.country));

    const drag = d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);

    node_elements.call(drag);

    let ForceSimulation = d3.forceSimulation(data.nodes)
        .force("collide", d3.forceCollide(d => scale_radius(node_degree[d.id]) * 2))
        .force("x", d3.forceX().strength(0.1))
        .force("y", d3.forceY().strength(0.1))
        .force("charge", d3.forceManyBody().strength(-100).distanceMax(300))
        .force("link", d3.forceLink(data.links).id(d => d.id).distance(50).strength(0.3))
        .on("tick", ticked);

    function updateForces() {
        const chargeStrength = parseInt(document.getElementById("chargeStrength").value);
        const collisionRadius = parseInt(document.getElementById("collisionRadius").value);
        const linkStrength = parseFloat(document.getElementById("linkStrength").value);

        ForceSimulation
            .force("charge", d3.forceManyBody().strength(chargeStrength))
            .force("collide", d3.forceCollide().radius(d => scale_radius(node_degree[d.id]) * collisionRadius / 12))
            .force("link", d3.forceLink(data.links).id(d => d.id).strength(linkStrength))
            .alpha(1)
            .restart();

        if (forceTimeout) {
            clearTimeout(forceTimeout);
        }

        forceTimeout = setTimeout(() => {
            ForceSimulation.alphaTarget(0);
        }, 3000);
    }

    document.getElementById("chargeStrength").addEventListener("input", updateForces);
    document.getElementById("collisionRadius").addEventListener("input", updateForces);
    document.getElementById("linkStrength").addEventListener("input", updateForces);

    function ticked() {
        node_elements.attr('transform', function (d) { return `translate(${d.x},${d.y})`; });
        link_elements
            .attr("x1", d => d.source.x)
            .attr("x2", d => d.target.x)
            .attr("y1", d => d.source.y)
            .attr("y2", d => d.target.y);
    }

    function dragstarted(event, d) {
        if (!event.active) ForceSimulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        if (!event.active) ForceSimulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    const zoom = d3.zoom()
        .scaleExtent([0.5, 5]) 
        .on('zoom', (event) => {
            zoomable_group.attr('transform', event.transform);
        });

    svg.call(zoom);
}

d3.json("author_network.json").then(data => {
    const svg = d3.select("svg");
    simulate(data, svg);
});
