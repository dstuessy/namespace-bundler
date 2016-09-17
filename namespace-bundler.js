const fs = require('fs');

module.exports = (function() {
    'use strict';

    const Bundler = {};

    function getFilePaths(dirPath, callback) {
        fs.readdir(filePath, (err, files) => {
            if (err) {
                console.log(err);
                return;
            }
            
        });
    }

    Bundler.bundle = function bundle(filePath, callback) {
    };

    return Bundler;
}());