import axios from 'axios';
import {Agent} from 'https';

export async function postDocument(
    faultS124: string,
    url: string,
    ca: string,
    clientCertificate: string,
    privateKey: string): Promise<void> {
    console.info(`method=postDocument url=${url}`);

    // try-catch so axios won't log keys/certs
    try {
        const resp = await axios.post(url, faultS124, {
            httpsAgent: new Agent({
                ca,
                cert: clientCertificate,
                key: privateKey
            }),
            headers: {
                'Content-Type': 'text/xml;charset=utf-8'
            }
        });
        if (resp.status != 200) {
            console.error(`method=postDocument returned status=${resp.status}, status text: ${resp.statusText}`);
            return Promise.reject();
        }
    } catch (error: any) {
        // can't log error without exposing keys/certs
        console.error('method=postDocument unexpected error');
        console.error(error.response.data);
        return Promise.reject();
    }
}

export async function query(imo: string,
                            url: string,
                            ca: string,
                            clientCertificate: string,
                            privateKey: string): Promise<any> {
    const queryUrl = `${url}/api/_search/serviceInstance?query=imo:${imo}`;
    console.info(`method=query url=${queryUrl}`);

    // try-catch so axios won't log keys/certs
    try {
        const resp = await axios.get(queryUrl, {
            /*httpsAgent: new Agent({
                ca,
                cert: clientCertificate,
                key: privateKey
            })*/
        });
        if (resp.status != 200) {
            console.error(`method=query returned status=${resp.status}, status text: ${resp.statusText}`);
            return Promise.reject();
        }

        console.info("DEBUG " + JSON.stringify(resp.data, null, 2));

        const instanceList = resp.data;

        if(instanceList && instanceList.length == 1) {
            return instanceList[0].endpointUri;
        }

        return null;
    } catch (error: any) {
        // can't log error without exposing keys/certs
        console.error('method=query unexpected error');
        console.error(error);
        return Promise.reject();
    }

}
