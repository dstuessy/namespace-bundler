const chai = require('chai');
const Bundler = require('../namespace-bundler.js');

describe('Bundler.bundle', function () {

    it('resolves simple dependencies with no trouble', function () {
        let testFn = function () {
            return Bundler.bundle(`${__dirname}/files/simple`); // this file is executed by the mocha executable under node_modules
        };
        chai.expect(testFn).to.not.throw(Error);
    });
});