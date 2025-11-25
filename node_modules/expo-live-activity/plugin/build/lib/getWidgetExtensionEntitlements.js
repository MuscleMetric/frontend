"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWidgetExtensionEntitlements = getWidgetExtensionEntitlements;
exports.addApplicationGroupsEntitlement = addApplicationGroupsEntitlement;
function getWidgetExtensionEntitlements(_iosConfig, _options = {}) {
    const entitlements = {};
    addApplicationGroupsEntitlement(entitlements);
    return entitlements;
}
function addApplicationGroupsEntitlement(entitlements, groupIdentifier) {
    // if (groupIdentifier) {
    //   const existingApplicationGroups = (entitlements["com.apple.security.application-groups"] as string[]) ?? [];
    //   entitlements["com.apple.security.application-groups"] = [groupIdentifier, ...existingApplicationGroups];
    // }
    return entitlements;
}
