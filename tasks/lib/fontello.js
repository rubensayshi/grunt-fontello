// TODO: Clean up comments

var fs      = require('fs');
var path    = require('path');
var async   = require('async');
var needle  = require('needle');
var unzip   = require('unzip');
var mkdirp  = require('mkdirp');
var grunt   = require('grunt');

/*
* Initial Checks
* @callback: options
* */
var init = function(options, callback){

  grunt.log.write('Verify paths...');
  async.parallel([
    processPath.bind(null, options, options.fonts),
    processPath.bind(null, options, options.styles)
  ], function(err, results){
    if(err) { 
      grunt.log.error(err);
      callback(err);
    }
    else {
      grunt.log.ok();
      results.forEach(function(result){
        grunt.log.debug(result);
      });
      callback(null, options);
    }
  });

};

/* Verify or build paths */
var processPath = function(options, dir, callback){
  fs.exists(dir, function(exists){
    if(!exists) {
      if(!options.force) {
        callback(dir + ' missing! use `force:true` to create');
      } else {
        // Force create path
        mkdirp(dir, function(err){
          if (err) { callback(err); }
          else {
            callback(null, dir + ' created!');
          }
        });
      }
    } else {
      callback(null, dir + ' verified!');
    }
  });
};

/*
* Create Session
* URL: http://fontello.com
* POST: config.json
* @callback: session id
* */
var createSession = function(options, callback){

  // TODO: save session somewhere else?

  var data = {
    config: {
      file: options.config,
      content_type: 'application/json'
    }
  };

  grunt.log.write('Creating session...');
  needle.post( options.host, data, { multipart: true }, function(err, res, body){
       if (err) {
         grunt.log.error();
         callback(err);
       }
       else {
         grunt.log.ok();
         grunt.log.debug('sid: ' + body);
         callback(null, options, body);
       }
     }
  );

};

/*
* Download Archive
* URL: http://fontello.com
* GET: http://fontello.com/SESSIONID/get
* callback: fetch/download result
**/
var fetchStream = function(options, session, callback){

  grunt.log.write('Fetching archive...');
  var request = needle.get(options.host + '/' + session + '/get', function(err){
    if(err){
      grunt.log.err();
      callback(err);
    }
  });

  /* Extract Files */
  if(options.fonts || options.styles) {
    return request.pipe(unzip.Parse())
      // TODO: fix inconsistent return point
      .on('entry', function(entry){

        var ext = path.extname(entry.path);

        if(entry.type === 'File'){
          switch(ext){
            // Extract CSS
            case '.css':
              // SCSS:
              var cssPath = (options.scss)
                  ? path.join(options.styles, path.basename(entry.path))
                  : path.join(options.styles, '_' + path.basename(entry.path).replace(ext, '.scss'));
              return entry.pipe(fs.createWriteStream(cssPath));
            // Extract Fonts
            case '.woff':case '.svg': case '.ttf': case '.eot':
              var fontPath = path.join(options.fonts, path.basename(entry.path));
              return entry.pipe(fs.createWriteStream(fontPath));
            // Drain everything else
            default:
              entry.autodrain();
          }
        }
      })
      .on('finish', function(){
        grunt.log.ok();
        callback(null, 'extract complete');
      });
  }

  /* Extract full archive */
  return request.pipe(unzip.Extract({ path: options.zip }))
    .on('finish', function(){
      grunt.log.ok();
      callback(null, 'Fontello extracted to '+options.zip);
    });

};

module.exports = {
  init    : init,
  post    : createSession,
  fetch   : fetchStream
 };