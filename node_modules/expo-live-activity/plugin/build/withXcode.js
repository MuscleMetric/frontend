"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.withXcode = void 0;
const config_plugins_1 = require("@expo/config-plugins");
const path = __importStar(require("path"));
const getWidgetFiles_1 = require("./lib/getWidgetFiles");
const addBuildPhases_1 = require("./xcode/addBuildPhases");
const addPbxGroup_1 = require("./xcode/addPbxGroup");
const addProductFile_1 = require("./xcode/addProductFile");
const addTargetDependency_1 = require("./xcode/addTargetDependency");
const addToPbxNativeTargetSection_1 = require("./xcode/addToPbxNativeTargetSection");
const addToPbxProjectSection_1 = require("./xcode/addToPbxProjectSection");
const addXCConfigurationList_1 = require("./xcode/addXCConfigurationList");
const withXcode = (config, { targetName, bundleIdentifier, deploymentTarget }) => {
    return (0, config_plugins_1.withXcodeProject)(config, (config) => {
        const xcodeProject = config.modResults;
        const targetUuid = xcodeProject.generateUuid();
        const groupName = 'Embed Foundation Extensions';
        const { platformProjectRoot } = config.modRequest;
        const marketingVersion = config.version;
        const targetPath = path.join(platformProjectRoot, targetName);
        const widgetFiles = (0, getWidgetFiles_1.getWidgetFiles)(targetPath);
        const xCConfigurationList = (0, addXCConfigurationList_1.addXCConfigurationList)(xcodeProject, {
            targetName,
            currentProjectVersion: config.ios.buildNumber || '1',
            bundleIdentifier,
            deploymentTarget,
            marketingVersion,
        });
        const productFile = (0, addProductFile_1.addProductFile)(xcodeProject, {
            targetName,
            groupName,
        });
        const target = (0, addToPbxNativeTargetSection_1.addToPbxNativeTargetSection)(xcodeProject, {
            targetName,
            targetUuid,
            productFile,
            xCConfigurationList,
        });
        (0, addToPbxProjectSection_1.addToPbxProjectSection)(xcodeProject, target);
        (0, addTargetDependency_1.addTargetDependency)(xcodeProject, target);
        (0, addBuildPhases_1.addBuildPhases)(xcodeProject, {
            targetUuid,
            groupName,
            productFile,
            widgetFiles,
        });
        (0, addPbxGroup_1.addPbxGroup)(xcodeProject, {
            targetName,
            widgetFiles,
        });
        return config;
    });
};
exports.withXcode = withXcode;
