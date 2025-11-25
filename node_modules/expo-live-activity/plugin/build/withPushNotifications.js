"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withPushNotifications = void 0;
const config_plugins_1 = require("@expo/config-plugins");
const withPushNotifications = (config) => (0, config_plugins_1.withInfoPlist)((0, config_plugins_1.withEntitlementsPlist)(config, (mod) => {
    mod.modResults['aps-environment'] = 'development';
    return mod;
}), (mod) => {
    mod.modResults['ExpoLiveActivity_EnablePushNotifications'] = true;
    return mod;
});
exports.withPushNotifications = withPushNotifications;
