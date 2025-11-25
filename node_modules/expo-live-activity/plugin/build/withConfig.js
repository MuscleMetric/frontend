"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withConfig = void 0;
const getWidgetExtensionEntitlements_1 = require("./lib/getWidgetExtensionEntitlements");
const withConfig = (config, { bundleIdentifier, targetName, groupIdentifier }) => {
    let configIndex = null;
    config.extra?.eas?.build?.experimental?.ios?.appExtensions?.forEach((ext, index) => {
        if (ext.targetName === targetName) {
            configIndex = index;
        }
    });
    if (!configIndex) {
        config.extra = {
            ...config.extra,
            eas: {
                ...config.extra?.eas,
                build: {
                    ...config.extra?.eas?.build,
                    experimental: {
                        ...config.extra?.eas?.build?.experimental,
                        ios: {
                            ...config.extra?.eas?.build?.experimental?.ios,
                            appExtensions: [
                                ...(config.extra?.eas?.build?.experimental?.ios?.appExtensions ?? []),
                                {
                                    targetName,
                                    bundleIdentifier,
                                },
                            ],
                        },
                    },
                },
            },
        };
        configIndex = 0;
    }
    if (configIndex != null && config.extra) {
        const widgetsExtensionConfig = config.extra.eas.build.experimental.ios.appExtensions[configIndex];
        widgetsExtensionConfig.entitlements = {
            ...widgetsExtensionConfig.entitlements,
            ...(0, getWidgetExtensionEntitlements_1.getWidgetExtensionEntitlements)(config.ios, {
                groupIdentifier,
            }),
        };
        config.ios = {
            ...config.ios,
            entitlements: {
                ...(0, getWidgetExtensionEntitlements_1.addApplicationGroupsEntitlement)(config.ios?.entitlements ?? {}, groupIdentifier),
            },
        };
    }
    return config;
};
exports.withConfig = withConfig;
