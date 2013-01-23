var fs = require('fs'),
    http = require('http'),
    mimeTypes = require('./mimetypes.json'),
    mimeCheck = new RegExp('\\.(' + Object.keys(mimeTypes).join('|') + ')$');

var devserver = exports = module.exports = {};


/**
 * initialize the http server
 *
 * @param {object} args key-value-object of the command line arguments
 */
devserver.init = function(config) {
  this._config = config;
  this._config.path = process.env.PWD;
  this._config.errorMessage = JSON.stringify(
    {'error': 'resource does not exist'}
  );

  http.createServer(this._handleRequest.bind(this)).listen(
    this._config.port,
    this._afterStart.bind(this)
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
  stream.on('error', (function(response, error) {
    // ok there was an error, at reading the file, so send this to the client
    response.writeHead(404, {
      'Content-Type': 'application/json',
      'Content-Length': this._config.errorMessage.length
    });
    response.end(this._config.errorMessage, 'utf8');
  }).bind(this, response));
  stream.pipe(response);
};
