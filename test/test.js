const chai = require('chai');
const Bundler = require('../namespace-bundler.js');

describe('Bundler.bundle', function () {

    it('resolves simple dependencies with no trouble', function () {
        let testFn = function () {
            return Bundler.bundle('test/files/simple');
        };
        chai.expect(testFn).to.not.throw(Error);
    });
});