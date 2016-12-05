const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const Graph = require('./graph.js');

module.exports = (function () {
    'use strict';

    const Bundler = {};

    function cloneObj(obj) {
        let proto = Object.getPrototypeOf(obj);
        let clone = Object.create(proto);
        let isArray = Array.isArray(obj);

        return Object.keys(obj).reduce((clone, key) => {
            let val = obj[key];

            if (isArray)
                clone.push(val);
            else
                clone[key] = val;

            return clone;
        }, clone);
    }

    function objectSet(obj, key, val) {
        let clone = cloneObj(obj);
        clone[key] = val;
        return clone;
    }

    function isUnique(filePath, i, list) {
        return list.indexOf(filePath) === i;
    }

    function isImmediateDependency(varName, dependencies) {
        let combinedDependencies = dependencies.reduce((combined, varName) => combined + varName, "");
        let match = combinedDependencies.match(RegExp(varName, "g"));
        let len = (match || []).length;
        return len === 1;
    }

    function fileModuleEqual(fileModuleA, fileModuleB) {
        return fileModuleA.varName === fileModuleB.varName;
    }

    function includesFileModule(fileModules, fileModule) {
        return fileModules.some(fileModuleB => fileModuleEqual(fileModule, fileModuleB));
    }

    function getFileModuleIndex(fileModule, fileModules) {
        return fileModules.findIndex(fileModuleB => fileModuleEqual(fileModuleB, fileModule));
    }

    function isDependent(fileModuleA, fileModuleB) {
        return fileModuleA.dependencies.indexOf(fileModuleB.varName) >= 0;
    }

    function isBefore(fileModules, fileModuleA, fileModuleB) {
        let indexA = getFileModuleIndex(fileModuleA, fileModules);
        let indexB = getFileModuleIndex(fileModuleB, fileModules);
        return indexA < indexB;
    }

    function validateDependencyOrder(fileModules) {
        return fileModules.every(fileModule => {
            let fileModuleIndex = getFileModuleIndex(fileModule, fileModules);
            let everyDependencyIsBefore = fileModule.dependencies.every(dependencyVarName => {
                let dependencyModule = {
                    varName: dependencyVarName
                };
                return isBefore(fileModules, dependencyModule, fileModule);
            });

            console.log(everyDependencyIsBefore, fileModule.varName, fileModule.dependencies);

            return everyDependencyIsBefore;
        });
    }

    function getHighestDependency(moduleGraph) {
        let rtrnVal = moduleGraph.findVertex((vertex, lastVertex) => {
            lastVertex = lastVertex || { dependencies: [] };
            return vertex.dependencies.length >= lastVertex.dependencies.length;
        });
        return rtrnVal;
    }

    function dep_res(moduleGraph) {
        let highestDependency = getHighestDependency(moduleGraph);
        let lowerDependencies = moduleGraph.remove(highestDependency.varName);

        return [highestDependency].concat(dep_res(lowerDependencies));
    }

    function quickSort(predicate, items) {
        if (items.length === 0)
            return [];

        let pivot = items[0];
        let tail = items.slice(1);
        let lessThanPivot = tail.filter(item => predicate(item, pivot));
        let greaterThanPivot = tail.filter(item => !predicate(item, pivot));

        return quickSort(predicate, lessThanPivot).concat([pivot]).concat(quickSort(predicate, greaterThanPivot));
    }

    function getVarName(filePath) {
        let fileContent = fs.readFileSync(filePath).toString();
        let fileName = path.basename(filePath, '.js');
        let regexEscapedFileName = fileName.replace(/\./g, '\\.');
        let varRegEx = RegExp(`(${regexEscapedFileName})\ ?=`, 'i');
        let matches = fileContent.match(varRegEx) || [];

        return matches[1] || "";
    }

    function getDependencies(fileModule, varNames) {
        let fileContent = fs.readFileSync(fileModule.filePath).toString();

        return varNames.reduce((dependencies, varName) => {
            let dependencyRegex = RegExp(`[^\w\.]?(${varName})`);
            let matches = fileContent.match(dependencyRegex) || [];
            let dependency = matches[1] || null;

            if (dependency && dependency !== fileModule.varName) {
                return dependencies
                    .concat([dependency])
                    .filter(isUnique)
                    .filter((varName, i, dependencies) => isImmediateDependency(varName, dependencies));
            }

            return dependencies;
        }, []);
    }

    function getFilePaths(dirPath) {
        let entryNames = fs.readdirSync(dirPath);
        let entryPaths = entryNames.map(entryName => `${dirPath}/${entryName}`);
        let filePaths = entryPaths.filter(entryPath => /\.js$/.test(entryPath));
        let dirPaths = entryPaths.filter(entryPath => fs.lstatSync(entryPath).isDirectory());
        let leftoverFilePaths = dirPaths.reduce(
            (filePaths, dirPath) => filePaths.concat(getFilePaths(dirPath)),
            filePaths
        );

        return filePaths
            .concat(leftoverFilePaths)
            .filter(isUnique);
    }

    Bundler.bundle = function bundle(dirPath, callback) {
        let filePaths = getFilePaths(dirPath, callback);
        let fileModules = filePaths.map(filePath => {
            return {
                filePath: filePath,
                varName: "",
                dependencies: []
            };
        }).map(fileModule => objectSet(
            fileModule, "varName", getVarName(fileModule.filePath)
        )).map((fileModule, i, modules) => objectSet(
            fileModule, "dependencies", getDependencies(fileModule, modules.map(fileModule => fileModule.varName))
        ));
        let fileModuleVertices = fileModules.reduce((vertices, fileModule) => {
            let key = fileModule.varName;
            vertices[key] = fileModule;
            return vertices;
        }, {});
        let fileModuleEdges = fileModules.reduce((edges, fileModule) => {
            return fileModule.dependencies.reduce((edges, dependencyVarName) => {
                let edgeString = fileModule.varName + '->' + dependencyVarName;
                edges[edgeString] = true;
                return edges;
            }, edges);
        }, {});
        let fileModuleGraph = Graph(fileModuleVertices, fileModuleEdges);
        let sortedFileModules = dep_res(fileModuleGraph);
        // let sortedFileModules = dep_res(fileModules);
        console.log();
        console.log(validateDependencyOrder(sortedFileModules));
        let sortedFileContents = sortedFileModules.map(fileModule => fs.readFileSync(fileModule.filePath).toString());
        let bundledFileContents = sortedFileContents.reduce((bundle, fileContents) => `${bundle}\n\n\n${fileContents}`, '');

        mkdirp('dist', err => {
            if (err)
                throw new Error(err);
            else {
                fs.writeFileSync('dist/bundle.js', bundledFileContents);
            }
        });
    };

    return Bundler;
} ());