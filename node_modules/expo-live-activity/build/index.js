import { Platform } from 'react-native';
import ExpoLiveActivityModule from './ExpoLiveActivityModule';
function assertIOS(name) {
    const isIOS = Platform.OS === 'ios';
    if (!isIOS)
        console.error(`${name} is only available on iOS`);
    return isIOS;
}
function normalizeConfig(config) {
    if (config === undefined)
        return config;
    const { padding, imageSize, ...base } = config;
    const normalized = { ...base };
    // Normalize padding: keep number in padding, object in paddingDetails
    if (typeof padding === 'number') {
        normalized.padding = padding;
    }
    else if (typeof padding === 'object') {
        normalized.paddingDetails = padding;
    }
    // Normalize imageSize: object with width/height each a number (points) or percent string like '50%'
    if (imageSize) {
        const regExp = /^(100(?:\.0+)?|\d{1,2}(?:\.\d+)?)%$/; // Matches 0.0% to 100.0%
        const { width, height } = imageSize;
        if (typeof width === 'number') {
            normalized.imageWidth = width;
        }
        else if (typeof width === 'string') {
            const match = width.trim().match(regExp);
            if (match) {
                normalized.imageWidthPercent = Number(match[1]);
            }
            else {
                throw new Error('imageSize.width percent string must be in format "0%" to "100%"');
            }
        }
        if (typeof height === 'number') {
            normalized.imageHeight = height;
        }
        else if (typeof height === 'string') {
            const match = height.trim().match(regExp);
            if (match) {
                normalized.imageHeightPercent = Number(match[1]);
            }
            else {
                throw new Error('imageSize.height percent string must be in format "0%" to "100%"');
            }
        }
    }
    return normalized;
}
/**
 * @param {LiveActivityState} state The state for the live activity.
 * @param {LiveActivityConfig} config Live activity config object.
 * @returns {string} The identifier of the started activity or undefined if creating live activity failed.
 */
export function startActivity(state, config) {
    if (assertIOS('startActivity'))
        return ExpoLiveActivityModule.startActivity(state, normalizeConfig(config));
}
/**
 * @param {string} id The identifier of the activity to stop.
 * @param {LiveActivityState} state The updated state for the live activity.
 */
export function stopActivity(id, state) {
    if (assertIOS('stopActivity'))
        return ExpoLiveActivityModule.stopActivity(id, state);
}
/**
 * @param {string} id The identifier of the activity to update.
 * @param {LiveActivityState} state The updated state for the live activity.
 */
export function updateActivity(id, state) {
    if (assertIOS('updateActivity'))
        return ExpoLiveActivityModule.updateActivity(id, state);
}
export function addActivityTokenListener(listener) {
    if (assertIOS('addActivityTokenListener'))
        return ExpoLiveActivityModule.addListener('onTokenReceived', listener);
}
export function addActivityPushToStartTokenListener(listener) {
    if (assertIOS('addActivityPushToStartTokenListener'))
        return ExpoLiveActivityModule.addListener('onPushToStartTokenReceived', listener);
}
export function addActivityUpdatesListener(listener) {
    if (assertIOS('addActivityUpdatesListener'))
        return ExpoLiveActivityModule.addListener('onStateChange', listener);
}
//# sourceMappingURL=index.js.map