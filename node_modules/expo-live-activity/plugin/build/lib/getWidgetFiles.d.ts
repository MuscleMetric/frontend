export type WidgetFiles = {
    swiftFiles: string[];
    entitlementFiles: string[];
    plistFiles: string[];
    assetDirectories: string[];
    intentFiles: string[];
    otherFiles: string[];
};
export declare function getWidgetFiles(targetPath: string): WidgetFiles;
export declare function copyFileSync(source: string, target: string): void;
