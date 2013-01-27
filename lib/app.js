'use strict';

var fs = require('fs'),
    http = require('http'),
    mimeTypes = require('./mimetypes.json'),
    mimeCheck = new RegExp('\\.(' + Object.keys(mimeTypes).join('|') + ')$'),
    proxy = new (require('http-proxy').RoutingProxy)();

var devon = exports = module.exports = {};


/**
 * initialize the http server
 *
 * @param {object} args key-value-object of the command line arguments
 */
devon.init = function(config) {
  // some extra configuration
  this._config = config;
  this._config.path = process.env.PWD;
  this._config.proxy = {};
  this._config.message404 = JSON.stringify(
    {'error': 'resource does not exist'
  });
  this._config.message500 = JSON.stringify({'error': 'server error'});
  this._config.requestPath = [
    'checkProxy',
    'checkFS',
    'handleDirectory',
    'handleFile'
  ];

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
 * only a handler to make some things after the devon was started
 *
 * @private
 */
devon._afterStart = function() {
  console.log('devon started on port', this._config.port);
};


/**
 * checks if requested url exists
 *
 * @private
 * @param {object} request nodejs http request object
 * @param {object} response nodejs http response object
 * @param {function(request, response, payload)} next calling the next handler,
 *     if this cannot response correctly
 */
devon._checkFS = function(request, response, errorResponse, next) {
  fs.stat(this._config.path + request.url, function(error, stats) {
    if (error) {
      errorResponse();
    } else {
      next(stats);
    }
  });
};


/**
 * checks for proxy
 *
 * @private
 * @param {object} request nodejs http request object
 * @param {object} response nodejs http response object
 * @param {function(request, response, payload)} next calling the next handler,
 *     if this cannot response correctly
 */
devon._checkProxy = function(request, response, errorResponse, next) {
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
    next();
  }
};


/**
 * responses a server error
 *
 * @private
 * @param {object} respone nodejs http response object
 */
devon._errorResponse = function(response) {
  response.writeHead(500, {
    'Content-Type': 'application/json',
    'Content-Length': this._config.message500.length
  });
  response.end(this._config.message500, 'utf8');
};


/**
 * handles a response from a directory
 *
 * @private
 * @param {object} request nodejs http request object
 * @param {object} respone nodejs http response object
 * @param {function(request, response, payload)} next calling the next handler,
 *     if this cannot response correctly
 * @param {fs.Stats} stats additional information from the FS handler
 */
devon._handleDirectory = function(
  request,
  response,
  errorResponse,
  next,
  stats
) {
  if (stats.isDirectory() === true) {
    fs.readdir(this._config.path + request.url, function(error, files) {
      var html,
          requestUrl = request.url +
            ((request.url[request.url.length - 1] === '/') ? '' : '/');

      if (error) {
        errorResponse();
      } else {
        html = '<!DOCTYPE html>' +
          '<html>' +
            '<head>' +
              '<title>' + request.url + '</title>' +
            '</head>' +
            '<body>' +
              '<ul>' +
                '<li><a href="' + requestUrl + '.">.</a></li>' +
                '<li><a href="' + requestUrl + '..">..</a></li>' +
                files.map(function(file) {
                  return '<li>' +
                    '<a href="' + requestUrl + file + '">' + file + '</a>' +
                    '</li>';
                }).join('') +
              '</ul>' +
            '</body>' +
          '</html>';

        response.writeHead(200, {
          'Content-Type': 'text/html',
          'Content-Length': html.length
        });
        response.end(html, 'utf8');
      }
    });
  } else {
    // not a directory
    next(stats);
  }
};


/**
 * handles a response from a file
 *
 * @private
 * @param {object} request nodejs http request object
 * @param {object} respone nodejs http response object
 * @param {function(request, response, payload)} next calling the next handler,
 *     if this cannot response correctly
 * @param {fs.Stats} stats additional information from the FS handler
 */
devon._handleFile = function(
  request,
  response,
  errorResponse,
  next,
  stats
) {
  var mimeType,
      stream;

  if (stats.isFile() === true) {
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
    stream.on('error', errorResponse);
    stream.pipe(response);
  } else {
    next();
  }
};


/**
 * handles a response to the devon
 *
 * @private
 * @param {object} request nodejs http request object
 * @param {object} respone nodejs http response object
 */
devon._handleRequest = function(request, response, payload) {
  var next = null;
  request._path = (isNaN(request._path) === true) ? 0 : request._path + 1;
  next = this['_' + this._config.requestPath[request._path]];

  // show log message?
  if (request._path === 0 && this._config.silent === false) {
    console.log(request.url);
  }

  if (next) {
    // ok, we have a handler
    next.bind(this)(
      request,
      response,
      this._errorResponse.bind(this, response),
      this._handleRequest.bind(this, request, response),
      payload
    );
  } else {
    // ok, we are on the end of the chain and no one could make a response
    response.writeHead(404, {
      'Content-Type': 'application/json',
      'Content-Length': this._config.message404.length
    });
    response.end(this._config.message404, 'utf8');
  }
};
