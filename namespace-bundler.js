const fs = require('fs');
const path = require('path');
const tail = require('./tail.js');
const tree = require('./tree.js');

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

    function isDependent(fileModuleA, fileModuleB) {
        return fileModuleA.dependencies.indexOf(fileModuleB.varName) >= 0;
    }

    function quickSort(fileModules) {
        let pivot = fileModules[0];
        let tail = fileModules.slice(1);
        let dependentOnPivot = tail.filter(fileModule => isDependent(fileModule, pivot));
        let independentOfPivot = tail.filter(fileModule => !isDependent(fileModule, pivot));

        if (fileModules.length === 0) {
            return [];
        }

        return quickSort(independentOfPivot).concat([pivot]).concat(quickSort(dependentOnPivot));
    }

    function treeInsert(insertNode, treeNode) {
        let insertModule = insertNode.value;
        let treeModule = treeNode.value;

        if (insertModule.varName === treeModule.varName) {
            return {
                insertNode: null,
                treeNode: treeNode
            };
        }

        return isDependent(insertModule, treeModule) || treeModule.varName === ""
        ? {
            insertNode: insertNode,
            treeNode: treeNode
        }
        : {
            insertNode: treeNode,
            treeNode: insertNode
        };
    }

    function trimDependencies(fileModule) {
        let combinedDependencies = fileModule.dependencies.reduce((combined, dependency) => combined + dependency, "");
        let uniqueDependencies = fileModule.dependencies.filter(dependency => {
            let match = combinedDependencies.match(RegExp(dependency, "g"));
            let len = (match || []).length;
            return len === 1;
        });
        fileModule.dependencies = uniqueDependencies;

        return fileModule;
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

            if (fileModule.filePath === "src/kidly/utilities/list/kidly.utilities.list.js")
                console.log(matches);

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
        ));//.map(fileModule => trimDependencies(fileModule));
        // let aModule = fileModules.find(fileModule => fileModule.varName === "P.Collision");
        // let vectorModule = fileModules.find(fileModule => fileModule.varName === "P.Vector");
        // let sortedFileModules = fileModules.sort((fileModuleA, fileModuleB) => {
        //     let dependent = isDependent(fileModuleB, fileModuleA);

        //     return dependent ? 1 : -1;
        // });
        let sortedFileModules = quickSort(fileModules);
        // let sortedFileModules = sortFileModules(fileModules);
        // let sortedFileModules = fileModules.reduce((modules, fileModule, i) => {
        //     let sortedVarNames = modules.sorted.map(m => m.varName);
        //     let foundDependencies = modules.unsorted.filter(m => fileModule.dependencies.includes(m.varName));
        //     let foundDependenciesVarNames = foundDependencies.concat([fileModule]).map(m => m.varName);

        //     return {
        //         sorted: modules.sorted.concat(foundDependencies).concat([fileModule]),
        //         unsorted: modules.unsorted.filter(m => !foundDependenciesVarNames.includes(m.varName))
        //     };
        // }, {
        //     sorted: [],
        //     unsorted: fileModules.slice(0)
        // });
        // let sortedFileVarNames = sortedFileModules.sorted.map(fileModule => fileModule.varName);

        // let moduleTree = fileModules.reduce((moduleTree, fileModule) => {
        //     let moduleLeaf = tree({
        //         value: fileModule
        //     });

        //     return moduleTree.insert(treeInsert, moduleLeaf);
        // }, tree({
        //     value: {
        //         filePath: "",
        //         varName: "",
        //         dependencies: []
        //     }
        // }));

        // let moduleTree = tree({
        //     value: {
        //         filePath: "",
        //         varName: "",
        //         dependencies: []
        //     }
        // }).insert(treeInsert, tree({
        //     value: fileModules.find(fileModule => fileModule.varName === "P")
        // }));
        console.log(sortedFileModules);
    };

    return Bundler;
} ());