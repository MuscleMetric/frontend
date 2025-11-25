import { ConfigPlugin } from '@expo/config-plugins';
export declare const withXcode: ConfigPlugin<{
    targetName: string;
    bundleIdentifier: string;
    deploymentTarget: string;
}>;
