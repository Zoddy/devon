'use strict';

var fs = require('fs'),
    http = require('http'),
    mimeTypes = require('./mimetypes.json'),
    mimeCheck = new RegExp('\\.(' + Object.keys(mimeTypes).join('|') + ')$'),
    proxy = new (require('http-proxy').RoutingProxy)();

var devserver = exports = module.exports = {};


/**
 * initialize the http server
 *
 * @param {object} args key-value-object of the command line arguments
 */
devserver.init = function(config) {
  // some extra configuration
  this._config = config;
  this._config.path = process.env.PWD;
  this._config.proxy = {};
  this._config.errorMessage = JSON.stringify(
    {'error': 'resource does not exist'}
  );

  // is there a proxy file?
  fs.readFile(
    this._config.path + '/' + '.proxy',
    'utf8',
    (function(error, data) {
      if (data) {
        this._config.proxy = JSON.parse(data);
      }

      // start the server
      http.createServer(this._handleRequest.bind(this)).listen(
        this._config.port,
        this._afterStart.bind(this)
      );
    }).bind(this)
  );
};


/**
 * only a handler to make some things after the devserver was started
 *
 * @private
 */
devserver._afterStart = function() {
  console.log('devserver started on port', this._config.port);
};


/**
 * handles a response to the devserver
 *
 * @private
 * @param {object} request nodejs http request object
 * @param {object} respone nodejs http response object
 */
devserver._handleRequest = function(request, response) {
  var mimeType,
      stream;

  // show log message?
  if (this._config.silent === false) {
    console.log(request.url);
  }

  // check for proxy
  if (!Object.keys(this._config.proxy).some((function(
    request,
    response,
    regex
  ) {
    var urlMatch = request.url.match(new RegExp(regex));

    if (urlMatch !== null) {
      request.url = urlMatch[1];

      proxy.proxyRequest(request, response, {
        'host': '127.0.0.1',
        'port': 5984
      });
    }

    return (urlMatch !== null);
  }).bind(this, request, response))) {
    // normal file

    // getting mimetype
    mimeType = request.url.match(mimeCheck);

    if (mimeType !== null) {
      // found mime type
      mimeType = mimeTypes[mimeType[1]]
    } else {
      // default mime type
      mimeType = 'text/plain';
    }

    // write default header
    response.writeHead(200, {'Content-Type': mimeType});

    // streaming to the response
    stream = fs.createReadStream(this._config.path + request.url);
    stream.on('error', (function(response) {
      // ok there was an error, at reading the file, so send this to the client
      response.writeHead(404, {
        'Content-Type': 'application/json',
        'Content-Length': this._config.errorMessage.length
      });
      response.end(this._config.errorMessage, 'utf8');
    }).bind(this, response));
    stream.pipe(response);
  }
};
