import axios, {AxiosError, AxiosResponse} from 'axios';
import {MediaType} from "digitraffic-common/aws/types/mediatypes";
import {ApiContractData, ApiOperationData, ApiRouteData} from "../model/autori-api-data";
import {DbDomainContract} from "../model/db-data";

export const URL_CONTRACTS = '/api/contracts';
export const URL_ROUTE = '/api/route';
export const URL_OPERATIONS = '/api/route/types/operation\n';

export class AutoriApi {
    readonly username: string;
    readonly password: string;
    readonly endpointUrl: string;

    /**
     * @param username Basic auth username
     * @param password Basic auth password
     * @param endpointUrl Enpoint url ie https://mydomain.com
     */
    constructor(username: string, password: string, endpointUrl: string) {
        this.username = username;
        this.password = password;
        this.endpointUrl = endpointUrl;
        console.info(`AutoriApi using endpointUrl ${endpointUrl}`);
    }

    /**
     *
     * @param method to log
     * @param url url after domain. Ie. /api/contracts
     */
    private async getFromServer<T>(method: string, url: string): Promise<T> {
        const start = Date.now();
        const serverUrl = `${this.endpointUrl}${url}`;

        // console.info(`method=${method} Sending to url ${serverUrl}`);

        try {
            const resp : AxiosResponse = await axios.get(serverUrl, {
                headers: {
                    'accept': MediaType.APPLICATION_JSON,
                },
                // Axios looks for the `auth` option, and, if it is set, formats a
                // basic auth header for you automatically.
                auth: {
                    username: this.username,
                    password: this.password,
                },
            });
            if (resp.status !== 200) {
                console.error(`method=getFromServer.${method} returned status=${resp.status} data=${resp.data} for ${serverUrl}`);
                return Promise.reject();
            }
            return resp.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError;
                if (axiosError.response) {
                    console.error(`method=getFromServer.${method} GET failed for ${serverUrl}. Error response code: ${axiosError.response.status} and message: ${axiosError.response.data}`);
                } else if (axiosError.request) {
                    console.error(`method=getFromServer.${method} GET failed for ${serverUrl} with no response. Error message: ${axiosError.message}`);
                } else {
                    // Something happened in setting up the request that triggered an Error
                    console.error(`method=getFromServer.${method} GET failed for ${serverUrl} while setting up the request. Error message: ${axiosError.message}`);
                }
            } else {
                console.error(`method=getFromServer.${method} GET failed for ${serverUrl} outside axios. Error message: ${error}`);
            }
            return Promise.reject();
        } finally {
            console.debug(`method=getFromServer.${method} tookMs=${Date.now() - start} for ${serverUrl}`);
        }
    }

    public getContracts(): Promise<ApiContractData[]> {
        return this.getFromServer<ApiContractData[]>('getContracts', URL_CONTRACTS);
    }

    public getOperations(): Promise<ApiOperationData[]> {
        return this.getFromServer<ApiOperationData[]>('getOperations', URL_OPERATIONS);
    }

    /**
     * Gets next data after given time and period
     * @param contract id of the contract
     * @param from data that has been modified after (exclusive) this
     * @param to data that has been modified before (exclusive) this
     */
    public getNextRouteDataForContract( contract: DbDomainContract, from: Date, to: Date): Promise<ApiRouteData[]> {
        return this.getRouteDataForContract(contract, from, to)
            .catch(error => {
                console.error(`method=getNextRouteDataForContract domain=${contract.domain} contract=${contract.contract} startTime=${from.toISOString()} endTime=${to.toISOString()} error: ${error}`);
                throw error;
            });
    }

    /**
     *
     * @param contract id of the contract
     * @param from data that has been modified after (exclusive) this
     * @param to data that has been modified before (exclusive) this
     */
    private getRouteDataForContract(contract: DbDomainContract, from: Date, to: Date): Promise<ApiRouteData[]> {
        const fromString = from.toISOString(); // With milliseconds Z-time
        const toString = to.toISOString();
        const start = Date.now();

        return this.getFromServer<ApiRouteData[]>(`getRouteDataForContract`, `${URL_ROUTE}?contract=${contract.contract}&changedStart=${fromString}&changedEnd=${toString}`)
            .then(routeData => {
                const end = Date.now();
                console.debug(`DEBUG method=getRouteDataForContract domain=${contract.domain} contract=${contract.contract} startTime=${fromString} endTime=${toString} data count=${routeData.length} tookMs=${end-start}`);
                return routeData;
            }).catch(error => {
                console.error(`method=getRouteDataForContract domain=${contract.domain} contract=${contract.contract} startTime=${fromString} endTime=${toString} error: ${error}`);
                throw error;
            });
    }
}