var fs = require('fs'),
    http = require('http'),
    proxy = new (require('http-proxy').RoutingProxy)(),
    port = process.argv[2] || 8080,
    path = process.env.PWD,
    errorMessage = JSON.stringify({'error': 'resource does not exist'}),
    stylus = require('stylus'),
    mimeTypes = {
      'css': 'text/css',
      'js': 'text/javascript',
      'json': 'application/json',
      'html': 'text/html',
      'woff': 'application/font-woff'
    };

http.createServer(function(request, response) {
  var proxyCouch = request.url.match(/^\/couchdb(.*)$/),
      proxyMeetrics = request.url.match(/^\/meetrics\/rest(.*)/),
      mimeType;

  console.log(request.url);

  if (proxyCouch !== null) {
    // couchdb proxy
    request.url = proxyCouch[1];

    proxy.proxyRequest(request, response, {
      'host': '127.0.0.1',
      'port': 5984
    });
  } else if (proxyMeetrics !== null) {
    // meetrics proxy
    request.url = '/backend/rest' + proxyMeetrics[1];

    proxy.proxyRequest(request, response, {
      'host': '127.0.0.1',
      'port': 8091
    });
  } else {
    // normal file
    mimeType = mimeTypes[request.url.match('[a-z]{1,}$')[0]] || 'text/plain';

    if (request.url.match(/css|js|json|html/) !== null) {
      mimeType += '; charset=utf-8';
    }

    fs.readFile(path + request.url, 'utf8', function(error, data) {
      if (error) {
        response.writeHead(404, {
          'Content-Length': errorMessage.length,
          'Content-Type': 'application/json; charset=utf-8'
        });
        response.end(errorMessage);
      } else {
        response.writeHead(200, {
          'Content-Length': data.length,
          'Content-Type': mimeType
        });
        response.end(data, 'utf8');
      }
    });
  }
}).listen(port);

console.log('devserver started on port ' + port);
