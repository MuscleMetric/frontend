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
exports.getWidgetFiles = getWidgetFiles;
exports.copyFileSync = copyFileSync;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function getWidgetFiles(targetPath) {
    let packagePath;
    try {
        packagePath = path.dirname(require.resolve('expo-live-activity/package.json'));
    }
    catch {
        console.log('Building for example app');
    }
    const liveActivityFilesPath = path.join(packagePath ? packagePath : '..', '/ios-files');
    const imageAssetsPath = './assets/liveActivity';
    const widgetFiles = {
        swiftFiles: [],
        entitlementFiles: [],
        plistFiles: [],
        assetDirectories: [],
        intentFiles: [],
        otherFiles: [],
    };
    if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
    }
    if (fs.lstatSync(liveActivityFilesPath).isDirectory()) {
        const files = fs.readdirSync(liveActivityFilesPath);
        files.forEach((file) => {
            const fileExtension = file.split('.').pop();
            if (fileExtension === 'swift') {
                widgetFiles.swiftFiles.push(file);
            }
            else if (fileExtension === 'entitlements') {
                widgetFiles.entitlementFiles.push(file);
            }
            else if (fileExtension === 'plist') {
                widgetFiles.plistFiles.push(file);
            }
            else if (fileExtension === 'xcassets') {
                widgetFiles.assetDirectories.push(file);
            }
            else if (fileExtension === 'intentdefinition') {
                widgetFiles.intentFiles.push(file);
            }
            else {
                widgetFiles.otherFiles.push(file);
            }
        });
    }
    // Copy files
    ;
    [
        ...widgetFiles.swiftFiles,
        ...widgetFiles.entitlementFiles,
        ...widgetFiles.plistFiles,
        ...widgetFiles.intentFiles,
        ...widgetFiles.otherFiles,
    ].forEach((file) => {
        const source = path.join(liveActivityFilesPath, file);
        copyFileSync(source, targetPath);
    });
    // Copy assets directory
    const imagesXcassetsSource = path.join(liveActivityFilesPath, 'Assets.xcassets');
    copyFolderRecursiveSync(imagesXcassetsSource, targetPath);
    // Move images to assets directory
    if (fs.existsSync(imageAssetsPath) && fs.lstatSync(imageAssetsPath).isDirectory()) {
        const imagesXcassetsTarget = path.join(targetPath, 'Assets.xcassets');
        const files = fs.readdirSync(imageAssetsPath);
        files.forEach((file) => {
            if (path.extname(file).match(/\.(png|jpg|jpeg)$/)) {
                const source = path.join(imageAssetsPath, file);
                const imageSetDir = path.join(imagesXcassetsTarget, `${path.basename(file, path.extname(file))}.imageset`);
                // Create the .imageset directory if it doesn't exist
                if (!fs.existsSync(imageSetDir)) {
                    fs.mkdirSync(imageSetDir, { recursive: true });
                }
                // Copy image file to the .imageset directory
                const destPath = path.join(imageSetDir, file);
                fs.copyFileSync(source, destPath);
                // Create Contents.json file
                const contentsJson = {
                    images: [
                        {
                            filename: file,
                            idiom: 'universal',
                        },
                    ],
                    info: {
                        author: 'xcode',
                        version: 1,
                    },
                };
                fs.writeFileSync(path.join(imageSetDir, 'Contents.json'), JSON.stringify(contentsJson, null, 2));
            }
        });
    }
    else {
        console.warn(`Warning: Skipping adding images to live activity because directory does not exist at path: ${imageAssetsPath}`);
    }
    return widgetFiles;
}
function copyFileSync(source, target) {
    let targetFile = target;
    if (fs.existsSync(target) && fs.lstatSync(target).isDirectory()) {
        targetFile = path.join(target, path.basename(source));
    }
    fs.writeFileSync(targetFile, fs.readFileSync(source));
}
function copyFolderRecursiveSync(source, target) {
    const targetPath = path.join(target, path.basename(source));
    if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
    }
    if (fs.lstatSync(source).isDirectory()) {
        const files = fs.readdirSync(source);
        files.forEach((file) => {
            const currentPath = path.join(source, file);
            if (fs.lstatSync(currentPath).isDirectory()) {
                copyFolderRecursiveSync(currentPath, targetPath);
            }
            else {
                copyFileSync(currentPath, targetPath);
            }
        });
    }
}
