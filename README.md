# namespace-bundler

[![Master Build Status](https://travis-ci.org/dstuessy/namespace-bundler.svg?branch=master)](https://travis-ci.org/dstuessy/namespace-bundler)

A JavaScript bundler based on [namespaces](http://adamsilver.io/articles/javascript-namespacing/).
The goal is to have a simple, easy to use bundler that honors namespace patterns without 
the need of `import` or `require` at the top of JavaScript files. Another way of putting it
is to have a bundler that doesn't touch your source code unless it has to -- as with `'use strict';`
statements -- and just puts them together into one file. One major benefit with this is having
legible JavaScript in browser dev tools, including legacy ones like IE8; yes, I know, 
but [people still use it](http://caniuse.com/usage_table.php).


## NPM

A NPM package is still in the making. 
For now it is necessary to include the `namespace-bundler.js` file in a project 
and require the file directly with node's `require` function; see "How to use" for an example.



## How to use

Simply include namespace-bundler as a node module or require the file directly, then call its `bundle` method:

``` javascript
const Bundler = require('./path/to/libs/namespace-bundler.js');

let bundledFileContent = Bundler.bundle('path/to/source/directory').value;
```

The `bundle` method returns a plain object with two properties, `value` and `writeToFile`:

- `value` is a string consisting of all the file contents in the target directly, bundled in order of dependency.
- `writeToFile` simply writes the `value` synchronously to a target file path; see "Write to file" for more details.

### Write to file

If writing the bundled file contents to a file is desired, 
just use the synchronous `writeToFile` method of the returned 
object by the `bundle` method; see "How to use" if you haven't read about the `bundle` method.

``` javascript
const Bundler = require('./path/to/libs/namespace-bundler.js');

Bundler.bundle('path/to/source/directory').writeToFile('path/to/destination/file');
```

Momentarily this method is synchronous. However, this will change in the future to be asynchronous, with an optional synchronous method.



## Development

Feel free to contribute source code and ideas to this project. For testing and development purposes, 
a directory called `dev` is available with its contents ignored -- except `dev-readme.md`. 
This is for convenience whilst not bloating the project with dead source code.

### Visual Studio Code

A debug configuration for development purposes has been set up under `.vscode/launch.json`. This way the `run-me` file can be executed in debug mode.

### Other Dev Tools

If other development tools are being used, `run-me` can be executed on any terminal. See nodejs's [page on debugging](https://nodejs.org/api/debugger.html) using a terminal.