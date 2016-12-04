const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');

module.exports = (function () {
    'use strict';

    const Bundler = {};

    function cloneObj(obj) {
        let proto = Object.getPrototypeOf(obj);
        let clone = Object.create(proto);

        return Object.keys(obj).reduce((clone, key) => {
            let val = obj[key];
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

    function fileModuleEqual(fileModuleA, fileModuleB) {
        return fileModuleA.varName === fileModuleB.varName;
    }

    function includesFileModule(fileModules, fileModule) {
        return fileModules.some(fileModuleB => fileModuleEqual(fileModule));
    }

    function getFileModuleIndex(fileModule, fileModules) {
        return fileModules.findIndex(fileModuleB => fileModuleEqual(fileModule, fileModuleB));
    }

    function isDependent(fileModuleA, fileModuleB) {
        return fileModuleA.dependencies.indexOf(fileModuleB.varName) >= 0;
    }

    function quickSort(fileModules) {
        if (fileModules.length === 0) {
            return [];
        }

        let pivot = fileModules[0];
        let tail = fileModules.slice(1);
        let dependentOnPivot = tail.filter(fileModule => isDependent(fileModule, pivot));
        let pivotIsDependentOn = tail.filter(fileModule => isDependent(pivot, fileModule));

        return quickSort(pivotIsDependentOn).concat([pivot]).concat(quickSort(dependentOnPivot));
    }

    function dep_res(fileModules) {
        if (fileModules.length < 1)
            return [];

        let first = fileModules[0];
        let deps = first.dependencies;
        let tail = fileModules.slice(1)
        .filter(fileModule => !includesFileModule(deps, fileModule));

        return dep_res(tail).concat(dep_res(deps)).concat(deps).concat([first]);
    }

    function validateDependencies(fileModules) {
        return fileModules.every((fileModule) => {
            let fileModuleIndex = getFileModuleIndex(fileModule, fileModules);
            return fileModule.dependencies.every(dependency => {
                return getFileModuleIndex(dependency, fileModules) < fileModuleIndex;
            });
        });
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
                    .filter(isUnique);
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
        let sortedFileModules = quickSort(fileModules);
        let fileModulesMissed = fileModules.length - sortedFileModules.length;
        global.includesFileModule = includesFileModule;
        // let sortedFileModules = dep_res(fileModules);
        console.log(validateDependencies(sortedFileModules));
        console.log(fileModulesMissed);
        console.log(sortedFileModules);
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