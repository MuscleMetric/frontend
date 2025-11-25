import { ExportedConfig, InfoPlist } from '@expo/config-plugins';
interface Options {
    groupIdentifier?: string;
}
export declare function getWidgetExtensionEntitlements(_iosConfig: ExportedConfig['ios'], _options?: Options | undefined): InfoPlist;
export declare function addApplicationGroupsEntitlement(entitlements: InfoPlist, groupIdentifier?: string): InfoPlist;
export {};
