import axios from 'axios';
import {Port, PortAreaCoordinates} from "../service/portareas";
import {DbETAShip} from "../db/db-estimates";

async function createEtaOAuthToken(
    endpointClientId: string,
    endpointClientSecret: string,
    endpointApiAudience: string,
    endpointAuthUrl: string
): Promise<OAuthTokenResponse> {

    const start = Date.now();

    // Try-catch because axios logs credentials
    try {
        const resp = await axios.post(endpointAuthUrl, {
            client_id: endpointClientId,
            client_secret: endpointClientSecret,
            audience: endpointApiAudience,
            grant_type: 'client_credentials'
        });
        if (resp.status != 200) {
            console.error(`method=createEtaOAuthToken returned status=${resp.status}`);
            return Promise.reject();
        }
        return Promise.resolve(resp.data);
    } catch (error) {
        console.error('method=createEtaOAuthToken login failed');
        return Promise.reject();
    } finally {
        console.log(`method=createEtaOAuthToken tookMs=${Date.now() - start}`)
    }
}

export async function getETAs(
    endpointClientId: string,
    endpointClientSecret: string,
    endpointClientAudience: string,
    endpointAuthUrl: string,
    endpointUrl: string,
    ships: DbETAShip[],
    portAreaGeometries: Port[]): Promise<Array<ShipETA | null>> {

    const start = Date.now();

    const token = await createEtaOAuthToken(
        endpointClientId,
        endpointClientSecret,
        endpointClientAudience,
        endpointAuthUrl);

    if (!token) {
        throw new Error('Authentication to ETA API failed!');
    }

    return Promise.all(await ships.map( ship =>
        getETA(endpointUrl,
            token.access_token,
            ship,
            getPortAreaGeometryForShip(portAreaGeometries, ship))))
        .then(a => {
            console.log(`method=getEtas tookMs=${Date.now() - start}`);
            return a;
        });
}

async function getETA(
    endpointUrl: string,
    token: string,
    ship: DbETAShip,
    portAreaGeometry: ETADestination | null): Promise<ShipETA | null> {

    if (!portAreaGeometry) {
        console.error(`method=getETA port area geometry for ship ${ship.imo} locode ${ship.locode} not found!`);
        return Promise.reject();
    }

    const url = `${endpointUrl}?imo=${ship.imo}&destination_lat=${portAreaGeometry.latitude}&destination_lon=${portAreaGeometry.longitude}&filter=faster(0.2)`
    const resp = await axios.get(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
        },
        validateStatus: (status) => status == 200 || status == 204 || status == 404
    });
    if (resp.status == 204) {
        console.log(`method=getETAs status=${resp.status} ship ${ship.imo} had speed lower than 0,2 knots`);
        return Promise.resolve(null);
    } else if (resp.status == 404) {
        console.log(`method=getETAs status=${resp.status} ship ${ship.imo} has not reported a position for more than 2 hours`);
        return Promise.resolve(null);
    } else if (resp.status != 200) {
        console.error(`method=getETAs status=${resp.status}`);
        return Promise.reject();
    }
    return Promise.resolve(resp.data as ETAResponse[])
        .then(etaResponse => {
            // always an array with a single ETA
            const e = etaResponse[0];
            return {
                locode: portAreaGeometry!!.locode,
                imo: ship.imo,
                mmsi: e.vessel.mmsi,
                eta: e.destination.eta,
                portcall_id: ship.portcall_id
            };
        });
}

export function getPortAreaGeometryForShip(
    portAreaGeometries: Port[],
    ship: DbETAShip): ETADestination | null {

    const portByLocode = portAreaGeometries.find(g => g.locode == ship.locode);
    if (!portByLocode) {
        return null;
    }

    const area = portByLocode.areas.find(a => a.portAreaCode == ship.port_area_code)
    if (area) {
        console.log(`
            method=getETA
            Using port by area: 
            port-locode: ${portByLocode.locode},
            port-areacode: ${area.portAreaCode},
            ship-imo: ${ship.imo},
            ship.locode: ${ship.locode}`);
        return {
            locode: portByLocode.locode,
            latitude: area.latitude,
            longitude: area.longitude
        }
    } else if (portByLocode.default) {
        console.log(`
            method=getETA
            Using port default: 
            port-locode: ${portByLocode.locode},
            ship-imo: ${ship.imo},
            ship.locode: ${ship.locode}`);
        return {
            locode: portByLocode.locode,
            latitude: portByLocode.default.latitude,
            longitude: portByLocode.default.longitude
        }
    }
    return null;
}

interface ETADestination {
    readonly locode: string
    readonly latitude: number
    readonly longitude: number
}

interface OAuthTokenResponse {
    readonly access_token: string
    readonly token_type: string
    readonly expires_in: number
}

export interface ShipETA {
    readonly locode: string
    readonly mmsi: number
    readonly imo: number
    readonly eta: string
    readonly portcall_id: number
}

interface ETAResponse {
    readonly vessel: {
        readonly mmsi: number
        readonly time: string
        readonly speed: number
        readonly heading: number
        readonly position: {
            readonly latitude: number
            readonly longitude: number
        }
    }
    readonly destination: {
        readonly eta: string
        readonly total_duration: string
        readonly historical_duration: string
        readonly synthetic_duration: string
        readonly straight_duration: string
    }
}
