"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_plugins_1 = require("expo/config-plugins");
const withConfig_1 = require("./withConfig");
const withPlist_1 = __importDefault(require("./withPlist"));
const withPushNotifications_1 = require("./withPushNotifications");
const withWidgetExtensionEntitlements_1 = require("./withWidgetExtensionEntitlements");
const withXcode_1 = require("./withXcode");
const withWidgetsAndLiveActivities = (config, props) => {
    const deploymentTarget = '16.2';
    const targetName = 'LiveActivity';
    const bundleIdentifier = `${config.ios?.bundleIdentifier}.${targetName}`;
    config.ios = {
        ...config.ios,
        infoPlist: {
            ...config.ios?.infoPlist,
            NSSupportsLiveActivities: true,
            NSSupportsLiveActivitiesFrequentUpdates: false,
        },
    };
    config = (0, config_plugins_1.withPlugins)(config, [
        withPlist_1.default,
        [
            withXcode_1.withXcode,
            {
                targetName,
                bundleIdentifier,
                deploymentTarget,
            },
        ],
        [withWidgetExtensionEntitlements_1.withWidgetExtensionEntitlements, { targetName }],
        [withConfig_1.withConfig, { targetName, bundleIdentifier }],
    ]);
    if (props?.enablePushNotifications) {
        config = (0, withPushNotifications_1.withPushNotifications)(config);
    }
    return config;
};
exports.default = withWidgetsAndLiveActivities;
