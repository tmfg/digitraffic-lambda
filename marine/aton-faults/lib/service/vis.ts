import * as VisApi from '../api/vis';

export class VisService {
    private readonly ca: string;
    private readonly clientCertificate: string;
    private readonly privateKey: string;
    private readonly serviceRegistryUrl: string;

    constructor(ca: string, clientCertificate: string, privateKey: string, serviceRegistryUrl = '') {
        this.ca = ca;
        this.clientCertificate = clientCertificate;
        this.privateKey = privateKey;
        this.serviceRegistryUrl = serviceRegistryUrl;
    }

    async sendFault(faultS124: string, url: string): Promise<any> {
        const start = Date.now();

        try {
            await VisApi.postDocument(faultS124, url, this.ca, this.clientCertificate, this.privateKey);
        } finally {
            console.info(`method=sendFault tookMs=%d`, Date.now() - start);
        }
    }

    async sendWarning(warningS124: string, url: string): Promise<any> {
        const start = Date.now();

        try {
            await VisApi.postDocument(warningS124, url, this.ca, this.clientCertificate, this.privateKey);
        } finally {
            console.info(`method=sendWarning tookMs=%d`, Date.now() - start);
        }
    }

    async queryMrsForImo(imo: string): Promise<any> {
        const start = Date.now();

        try {
            return VisApi.query(imo, this.serviceRegistryUrl, this.ca, this.clientCertificate, this.privateKey);
        } finally {
            console.info(`method=queryMrsForImo tookMs=%d`, Date.now() - start);
        }
    }
}
