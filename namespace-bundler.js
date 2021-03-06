const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const esprima = require('esprima');
const escodegen = require('escodegen');
const estraverse = require('estraverse');

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

    function isUniqueFileModule(fileModule, i, fileModules) {
        return fileModules.findIndex(fileModuleB => fileModuleB.filePath === fileModule.filePath) === i;
    }

    function fileModuleEqual(fileModuleA, fileModuleB) {
        return fileModuleA.filePath === fileModuleB.filePath;
    }

    function includesFileModule(fileModules, fileModule) {
        return !!fileModules.find(fileModuleB => fileModuleEqual(fileModule, fileModuleB));
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
        let hasNoDependencies = fileModule.dependencies.length === 0;
        let allDependenciesMissing = fileModule.dependencies.every(dependency => !includesFileModule(fileModules, {
            filePath: dependency
        })); // returns true if fileModule.dependencies is empty
        return hasNoDependencies || allDependenciesMissing;
    }

    function trimDependencies(dependencies) {
        let dependencyFileNames = dependencies.map(dependencyFilePath =>
            path.posix.basename(dependencyFilePath, '.js')
        );
        let combinedDependencies = dependencyFileNames.reduce((combined, dependencyFileName) => combined + dependencyFileName, "");
        return dependencies.filter(dependencyFilePath => {
            let fileName = path.posix.basename(dependencyFilePath, '.js');
            let match = combinedDependencies.match(RegExp(fileName, "g"));
            let len = (match || []).length;
            return len === 1;
        });
    }

    function hasCircularDependency(fileModules) {
        if (fileModules.length === 0)
            return [];

        let firstHalf = fileModules.slice(0, fileModules.length / 2);
        let secondHalf = fileModules.slice(filemodules.length / 2);

        return hasCircularDependency(firstHalf) || hasCircularDependency(secondHalf);
    }

    function getRootFileModules(fileModules) {
        return fileModules.filter(fileModule => isRootModule(fileModule, fileModules));
    }

    function resolveDependencies(fileModules) {
        if (fileModules.length === 0)
            return [];

        let rootFileModules = getRootFileModules(fileModules);
        let nonRootFileModules = fileModules.filter(fileModule => !includesFileModule(rootFileModules, fileModule));
        let result = rootFileModules.concat(resolveDependencies(nonRootFileModules)).filter(isUniqueFileModule);

        return result;
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

            return everyDependencyIsBefore;
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

    function getDependents(fileModuleA, fileModules) {
        return fileModules.filter(fileModuleB => {
            return isDependent(fileModuleB, fileModuleA);
        }).map(fileModule => fileModule.filePath);
    }

    function getDependencies(fileModule, varNames) {
        let fileContent = fs.readFileSync(fileModule.filePath).toString();
        let contentNodes = esprima.parse(fileContent);
        let foundVarNames = [];
        let filteredContentNodes = estraverse.replace(contentNodes, {
            enter: node => {
                if (node.type === "AssignmentExpression" && node.right.type === "FunctionExpression") {
                    node.right.body.body = [];
                    node.right.params = [];
                }
                return node;
            }
        });
        let filteredContent = escodegen.generate(filteredContentNodes);

        return varNames.reduce((dependencies, varName) => {
            let dependencyRegex = RegExp(`[^\w\.]?(${varName})`);
            let matches = filteredContent.match(dependencyRegex) || [];
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

    function writeBundleToFile(filePath, bundleContent) {
        let dirPath = path.dirname(filePath);

        mkdirp.sync(dirPath);
        fs.writeFileSync(filePath, bundleContent);
    }

    Bundler.bundle = function bundle(dirPath) {
        let filePaths = getFilePaths(dirPath);
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
        )).map((fileModule, i, modules) => objectSet(
            fileModule,
            "dependencies",
            trimDependencies(fileModule.dependencies)
        )).map((fileModule, i, fileModules) => objectSet(
            fileModule,
            "dependents",
            getDependents(fileModule, fileModules)
        ));
        let sortedFileModules = resolveDependencies(fileModules);
        let fileModulesValidate = validateDependencyOrder(sortedFileModules);

        if (!fileModulesValidate) {
            throw new Error('namespace-bundler: Could not resolve namespace dependency\n');
        }

        let sortedFileContents = sortedFileModules.map(fileModule => fs.readFileSync(fileModule.filePath).toString());
        let bundledFileContents = sortedFileContents.reduce((bundle, fileContents) => `${bundle}\n\n\n${fileContents}`, '');

        // Take all strict mode notes and put them at the beginning of the bundle content
        if (bundledFileContents.match(/['"]use strict['"];/g)) {
            bundledFileContents = bundledFileContents.replace(/['"]use strict['"];/g, '');
            bundledFileContents = "'use strict';" + bundledFileContents;
        }

        return {
            value: bundledFileContents,
            writeToFile: filePath => {
                writeBundleToFile(filePath, bundledFileContents);
            }
        };
    };

    return Bundler;
} ());
