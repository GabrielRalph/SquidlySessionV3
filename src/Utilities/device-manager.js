import { delay } from "./usefull-funcs.js";

const REFRESH_RATE = 10000; // 10 seconds

let oldDevices = [];
let isUpdating = false;
let deviceChangeCallbacks = [];

const selectedDevice = {
    audioinput: null,
    audiooutput: null,
    videoinput: null,
}

function filterDevices(devices) {
    // Get devices with default as their deviceId
    let defaults = devices.filter(d => d.deviceId === "default");

    // Get devices that are not default
    let normal = devices.filter(d => d.deviceId !== "default").map(d => {
        const {groupId, deviceId, label, kind} = d;
        let isDefault = defaults.some(d2 => d2.kind === kind && d2.groupId === groupId);
        let active = (kind in selectedDevice) ? (selectedDevice[kind] === deviceId) : (false);
        

        return {
            groupId,
            deviceId,
            label,
            kind,
            isDefault,
            active,
        }
    })


    // If any devices are default but do not have a mathcing device
    // for which has a unique deviceId, then add them to the normal devices
    // hopefully their will be none.
    let uniqueDefaults = defaults.filter(d => {
        return !normal.some(n => n.kind === d.kind && n.groupId === d.groupId);
    }).map(d => {
        const {groupId, deviceId, label, kind} = d;
        let isDefault = true;
        let active = kind in selectedDevice ? selectedDevice[kind] === deviceId : false;
        
        return {
            groupId,
            deviceId,
            label,
            kind,
            isDefault,
            active,
        }
    });

    return [...uniqueDefaults, ...normal];
}

async function updateDevices() {
    // Get the current filtered devices
    const devices = filterDevices([...await navigator.mediaDevices.enumerateDevices()]);


    // If the numbeer of devices has changed, or if any of the devices have changed
    // then call the devices changed callback
    if (devices.length !== oldDevices.length) {
        oldDevices = devices;
        onDevicesChanged();
    } else {
        // Check if any of the devices have changed
        let oldids = new Set(oldDevices.map(device => device.deviceId));
        for (let newDevice of devices) {
            let deviceId = newDevice.deviceId;
            if (!oldids.has(deviceId)) {
                oldDevices = devices;
                onDevicesChanged();
                break;
            } else {
                let oldDevice = oldDevices.find(d => d.deviceId === deviceId);
                if (oldDevice.active !== newDevice.active ||
                    oldDevice.label !== newDevice.label ||
                    oldDevice.isDefault !== newDevice.isDefault) {
                    oldDevices = devices;
                    onDevicesChanged();
                    break;
                }
            }
        }
    }
}

async function onDevicesChanged() {
    for (let kind in selectedDevice) {
        let selectedDeviceId = selectedDevice[kind];
        let devices = await getDevices(false);
        if (selectedDeviceId) {
            if (!(kind in devices)) {
                selectedDevice[kind] = null;
            } else {
                if (!(selectedDeviceId in devices[kind])) {
                    await getSelectedDevice(kind, false);
                }
            }
        }
    }
    for (let callback of deviceChangeCallbacks) {
        callback(await getDevices(false));
    }
}

async function startUpdatingDevices() {
    if (isUpdating) return;
    isUpdating = true;
    while (isUpdating) {
        await updateDevices();
        await delay(REFRESH_RATE)
    }
}

export async function getSelectedDevice(type, force = true) {
    let deviceId = null;
    let devices = await getDevices(force);
    // Check if the type is in the selectedDevice and available devices
    if (type in selectedDevice && type in devices) {
        deviceId = selectedDevice[type];

        // If the deviceId is not in the devices, then choose a new one
        if (!(deviceId in devices[type])) {
            let deviceType = Object.values(devices[type]);
            if (deviceType.length > 0) {
                let defaultDevices  = deviceType.filter(d => d.isDefault);
                let device = defaultDevices.length > 0 ? defaultDevices[0] : deviceType[0];
                device.active = true;
                deviceId = device.deviceId;
                selectedDevice[type] = deviceId;
            } else {
                deviceId = null;
            }
        }
    }
    return deviceId;
}

export async function setSelectedDevice(type, deviceId) { 
    let update = false;
    if (type in selectedDevice) {
        let devices = await getDevices(false);
        
        if (type in devices && deviceId in devices[type]) {
            
            if (deviceId !== selectedDevice[type]) {
                update = true;
            }
            selectedDevice[type] = deviceId;
            let device = devices[type][deviceId];
            device.active = true;
            for (let d of Object.values(devices[type])) {
                if (d.deviceId !== deviceId) {
                    d.active = false;
                }
            }
            onDevicesChanged();
        }
    }
    return update;
}

export function addDeviceChangeCallback(callback) {
    if (callback instanceof Function) {
        deviceChangeCallbacks.push(callback);
    }
}

export async function getDevices(forceUpdate = false) {
    if (forceUpdate) {
        await updateDevices();
    }
    
    
    let devicesByType = {};
    for (let device of oldDevices) {
        if (!devicesByType[device.kind]) {
            devicesByType[device.kind] = {}
        }
        devicesByType[device.kind][device.deviceId] = device;
    }
    
    return devicesByType;
}

startUpdatingDevices();