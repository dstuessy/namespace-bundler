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
        return !!fileModules.find(fileModuleB => fileModuleEqual(fileModule, fileModuleB));
    }

    function includesAllDependencies(fileModules, fileModule) {
        return fileModule.dependencies.every(dependencyFilePath =>
            includesFileModule(fileModules, { filePath: dependencyFilePath })
        );
    }

    function includesSomeDependencies(fileModules, fileModule) {
        return fileModule.dependencies.some(dependencyFilePath =>
            includesFileModule(fileModules, { filePath: dependencyFilePath })
        );
    }

    function includesDependents(fileModules, fileModule) {
        return fileModule.dependents.every(dependentFilePath =>
            includesFileModule(fileModules, { filePath: dependentFilePath })
        );
    }

    function getFileModuleIndex(fileModule, fileModules) {
        return fileModules.findIndex(fileModuleB => fileModuleEqual(fileModuleB, fileModule));
    }

    function isDependent(fileModuleA, fileModuleB) {
        return fileModuleA.dependencies.indexOf(fileModuleB.filePath) >= 0;
    }

    function isBefore(fileModules, fileModuleA, fileModuleB) {
        let indexA = getFileModuleIndex(fileModuleA, fileModules);
        let indexB = getFileModuleIndex(fileModuleB, fileModules);
        return indexA < indexB;
    }

    function isRootModule(fileModule, fileModules) {
        return fileModule.dependencies.length === 0 || !includesAllDependencies(fileModules, fileModule);
    }

    function trimDependencies(fileModule) {
        let dependencyFileNames = fileModule.dependencies.map(dependencyFilePath =>
            path.posix.basename(dependencyFilePath, '.js')
        );
        let combinedDependencies = dependencyFileNames.reduce((combined, dependencyFileName) => combined + dependencyFileName, "");
        let uniqueDependencies = fileModule.dependencies.filter(dependencyFilePath => {
            let fileName = path.posix.basename(dependencyFilePath, '.js');
            let match = combinedDependencies.match(RegExp(fileName, "g"));
            let len = (match || []).length;
            return len === 1;
        });
        fileModule.dependencies = uniqueDependencies;

        return fileModule;
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

    function getRootFileModules(fileModules) {
        return fileModules.filter(fileModule => isRootModule(fileModule, fileModules));
    }

    function dep_res(fileModules) {
        if (fileModules.length === 0)
            return [];

        let rootFileModules = getRootFileModules(fileModules);
        let nonRootFileModules = fileModules.filter(fileModule => !includesFileModule(rootFileModules, fileModule));
        let result = rootFileModules.concat(dep_res(nonRootFileModules)).filter(isUniqueFileModule);

        console.log(rootFileModules.map(fileModule => fileModule.filePath));
        console.log(result.length, rootFileModules.length, nonRootFileModules.length);

        return result;
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
        )).map((fileModule, i, modules) =>
            trimDependencies(fileModule)
            ).map((fileModule, i, fileModules) => objectSet(
                fileModule,
                "dependents",
                getDependents(fileModule, fileModules)
            ));
        let fileModuleVertices = fileModules.reduce((vertices, fileModule) => {
            let key = fileModule.filePath;
            vertices[key] = fileModule;
            return vertices;
        }, {});
        let sortedFileModules = dep_res(fileModules);
        let fileModulesValidate = validateDependencyOrder(sortedFileModules);

        console.log();
        console.log(fileModulesValidate);

        if (!fileModulesValidate) {
            throw new Error('File module dependency resolve doesn\'t validate');
        }

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