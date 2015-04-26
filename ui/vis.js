window.vis = function (el, channels, events) {

  var format,
      color,
      bubble,
      svg;

  function init() {
    console.log('init');

    var diameter = 400;

    format = d3.format(",d");
    color = d3.scale.category20c();

    bubble = d3.layout.pack()
      .sort(null)
      .size([diameter, diameter])
      .padding(2);

    // Clickable title
    d3.select(el).append('div')
      .text(channels[0].id)
      .style('font-size', '3em')
      .on('click', function () {
        console.log('Channel name clicked');
        channels[0].socket.send('broadcast');
      });

    // Visualisation itself
    svg = d3.select(el).append("svg")
      .attr("width", diameter)
      .attr("height", diameter)
      .attr("class", "bubble");
  }

  function render() {
    var node = svg.selectAll(".node")
        .data(bubble.nodes(classes(channels))
        .filter(function(d) { return !d.children; }));

    // Peers arriving
    var enter = node.enter().append("g");

    enter
      .attr("class", "node")
      .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; })
      .on('click', function (d) {
        d.socket.send('direct');
      });

    enter.append("title")
        .text(function(d) { return d.id; });

    enter.append("circle")
        .style("fill", function(d) { return d.ping ? '#333' : hashStringToColor(d.id); })
        .attr("r", 0)
        .transition()
          .attr("r", function(d) { return d.r; });

    enter.append("text")
        .attr("dy", ".3em")
        .text(function(d) { return d.id.substring(0, 6) + '…'; })
        .style("text-anchor", "middle")
        .style('opacity', 0)
        .transition()
          .style('opacity', 1);

    // Peers leaving
    var exit = node.exit();

    exit
      .on('click', null)
      .transition()
        .remove();

    exit.selectAll('circle')
      .transition()
        .attr("r", 0);

    exit.selectAll('text')
      .style("opacity", 1)
      .transition()
        .style("opacity", 0);

    // Update
    var pings = node.filter(function (d) { return d.ping; });

    pings.selectAll('circle')
      .transition()
        .ease('bounce')
        .attr("r", function (d) { return d.r * 1.3; })
        .transition()
          .attr("r", function (d) { return d.r; });
  }

  // Returns a flattened hierarchy containing all leaf nodes under the root.
  function classes(channels) {
    var items = channels[0].peers.map(function (p) {
      return {
        id: p.id,
        channel: 'channel-placeholder',
        socket: p.socket,
        value: 100,
        ping: p.ping
      };
    });
    return { children: items };
  }

  return {
    init: init,
    render: render
  };
}


function djb2(str){
  var hash = 5381;
  for (var i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i); /* hash * 33 + c */
  }
  return hash;
}

function hashStringToColor(str) {
  var hash = djb2(str);
  var r = (hash & 0xFF0000) >> 16;
  var g = (hash & 0x00FF00) >> 8;
  var b = hash & 0x0000FF;
  return "#" + ("0" + r.toString(16)).substr(-2) + ("0" + g.toString(16)).substr(-2) + ("0" + b.toString(16)).substr(-2);
}