import {Client} from 'paho-mqtt';
import {ProxyLambdaResponse} from "digitraffic-common/aws/types/proxytypes";

export const KEY_APP = 'KEY_APP';

const APP = process.env[KEY_APP] as string;

/**
 * Paho MQTT requires a browser environment to run. Fake the required parts.
 */
function fakeBrowserHack() {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    global.WebSocket = require('ws');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).localStorage = {
        store: {},
        getItem: function (key: string) {
            return this.store[key];
        },
        setItem: function (key: string, value: string) {
            this.store[key] = value;
        },
        removeItem: function (key: string) {
            delete this.store[key];
        },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).window = global;
}

export async function handler(): Promise<ProxyLambdaResponse> {
    fakeBrowserHack();

    const client = new Client(`${APP}.digitraffic.fi`, 61619, 'hc-proxy');

    const promise = new Promise((resolve, reject) => {
        client.connect({
            onSuccess: resolve,
            onFailure: reject,
            useSSL: true,
            userName: 'digitraffic',
            password: 'digitrafficPassword',
        });
    });
    await promise;

    const resp = {
        statusCode: client.isConnected() ? 200 : 500,
        body: '',
    };

    client.disconnect();

    return resp;
}
