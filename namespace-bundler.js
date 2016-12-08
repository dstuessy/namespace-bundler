const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const loop = require('./tail.js');
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

    function objectReduce(fn, start, obj) {
        return Object.keys(obj).reduce((acc, key) => fn(acc, obj[key], key), start);
    }

    function isUnique(filePath, i, list) {
        return list.indexOf(filePath) === i;
    }

    function isUniqueFileModule(fileModule, i, fileModules) {
        return fileModules.findIndex(fileModuleB => fileModuleB.filePath === fileModule.filePath) === i;
    }

    function mergeFileModules(fileModulesA, fileModulesB) {
        return fileModulesA.concat(fileModulesB).filter(isUniqueFileModule);
    }

    function isImmediateDependency(varName, dependencies) {
        let combinedDependencies = dependencies.reduce((combined, varName) => combined + varName, "");
        let match = combinedDependencies.match(RegExp(varName, "g"));
        let len = (match || []).length;
        return len === 1;
    }

    function fileModuleEqual(fileModuleA, fileModuleB) {
        return fileModuleA.filePath === fileModuleB.filePath;
    }

    function includesFileModule(fileModules, fileModule) {
        return fileModules.some(fileModuleB => fileModuleEqual(fileModule, fileModuleB));
    }

    function includesDependencies(fileModules, fileModule) {
        return fileModule.dependencies.some(dependencyFilePath => 
            includesFileModule(fileModules, { filePath: dependencyFilePath })
        );
    }

    function getFileModuleIndex(fileModule, fileModules) {
        return fileModules.findIndex(fileModuleB => fileModuleEqual(fileModuleB, fileModule));
    }

    function filePathToModule(filePath, fileModuleVerteces) {
        return fileModuleVerteces[filePath];
    }

    function isDependent(fileModuleA, fileModuleB) {
        return fileModuleA.dependencies.indexOf(fileModuleB.filePath) >= 0;
    }

    function isBefore(fileModules, fileModuleA, fileModuleB) {
        let indexA = getFileModuleIndex(fileModuleA, fileModules);
        let indexB = getFileModuleIndex(fileModuleB, fileModules);
        return indexA < indexB;
    }

    function validateDependencyOrder(fileModules) {
        return fileModules.every(fileModule => {
            let fileModuleIndex = getFileModuleIndex(fileModule, fileModules);
            let everyDependencyIsBefore = fileModule.dependencies.every(dependencyfilePath => {
                let dependencyModule = {
                    filePath: dependencyfilePath
                };
                return isBefore(fileModules, dependencyModule, fileModule);
            });

            if (!everyDependencyIsBefore)
                console.log(everyDependencyIsBefore, fileModule.filePath, fileModule.dependencies);

            return everyDependencyIsBefore;
        });
    }

    function getDeepestFileModules(fileModules, fileModuleVerteces) {
        return fileModules.filter(fileModule => {
            return fileModule.dependencies.length === 0 || fileModule.dependencies.every(dependencyFilePath => !fileModuleVerteces[dependencyFilePath]);
        });
    }

    function dep_res(fileModules, fileModuleVerteces) {
        if (fileModules.length === 0)
            return [];

        let deepestFileModules = getDeepestFileModules(fileModules, fileModuleVerteces);
        let dependents = deepestFileModules.map(fileModule => {
            let dependentModules = fileModule.dependents.map(dependentPath => filePathToModule(dependentPath, fileModuleVerteces));
            let resolvedDeps = dep_res(dependentModules, fileModuleVerteces);
            return resolvedDeps;
        });

        console.log(dependents.length, deepestFileModules.length);

        return mergeFileModules(dependents, deepestFileModules);
    }

    function getVarName(filePath) {
        let fileContent = fs.readFileSync(filePath).toString();
        let fileName = path.basename(filePath, '.js');
        let regexEscapedFileName = fileName.replace(/\./g, '\\.');
        let varRegEx = RegExp(`(${regexEscapedFileName})\ ?=`, 'i');
        let matches = fileContent.match(varRegEx) || [];

        return matches[1] || "";
    }

    function getDependents(fileModuleA, fileModules) {
        return fileModules.filter(fileModuleB => {
            return isDependent(fileModuleB, fileModuleA);
        }).map(fileModule => fileModule.filePath);
    }

    function getDependencies(fileModule, varNames) {
        let fileContent = fs.readFileSync(fileModule.filePath).toString();

        return varNames.reduce((dependencies, varName) => {
            let dependencyRegex = RegExp(`[^\w\.]?(${varName})`);
            let matches = fileContent.match(dependencyRegex) || [];
            let dependency = matches[1] || null;

            if (dependency && dependency !== fileModule.varName && !dependencies.includes(dependency)) {
                dependencies.push(dependency);
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
            fileModule,
            "dependencies",
            getDependencies(fileModule, modules.map(fileModule => fileModule.varName))
        )).map((fileModule, i, modules) => objectSet(
            fileModule,
            "dependencies",
            fileModule.dependencies.map(varName =>
                modules.find(fileModule => fileModule.varName === varName).filePath
            )
        )).map((fileModule, i, fileModules) => objectSet(
            fileModule,
            "dependents",
            getDependents(fileModule, fileModules)
        ));
        let fileModuleVertices = fileModules.reduce((vertices, fileModule) => {
            let key = fileModule.filePath;
            vertices[key] = fileModule;
            return vertices;
        }, {});
        console.log(getDeepestFileModules(fileModules, fileModuleVertices));
        let sortedFileModules = dep_res(fileModules, fileModuleVertices);
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