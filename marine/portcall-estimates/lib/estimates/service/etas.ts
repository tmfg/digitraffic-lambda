import {DbETAShip} from '../db/db-estimates';
import {getETAs, ShipETA} from '../api/api-etas';
import {ApiEstimate, EventType} from '../model/estimate';
import {saveEstimates} from './estimates';
import {PortareaGeometry} from './portareas';

export async function updateETAEstimates(
    endpointClientId: string,
    endpointClientSecret: string,
    endpointClientAudience: string,
    endpointAuthUrl: string,
    endpointUrl: string,
    endpointSource: string,
    ships: DbETAShip[],
    portAreaGeometries: PortareaGeometry[]): Promise<ShipETA[]> {
    
    const etas: ShipETA[] = (await getETAs(endpointClientId,
        endpointClientSecret,
        endpointClientAudience,
        endpointAuthUrl,
        endpointUrl,
        ships,
        portAreaGeometries)).filter(eta => eta != null) as ShipETA[];

    const etaToEstimateWithSource = etaToEstimate(endpointSource);
    const estimates: ApiEstimate[] = etas.map(etaToEstimateWithSource);

    await saveEstimates(estimates);
    
    return etas;
}

export function etaToEstimate(endpointSource: string): (eta: ShipETA) => ApiEstimate {
    return (eta: ShipETA): ApiEstimate => ({
        eventType: EventType.ETA,
        eventTime: eta.eta,
        eventTimeConfidenceLower: null,
        eventTimeConfidenceUpper: null,
        recordTime: new Date().toISOString(),
        source: endpointSource,
        ship: {
            mmsi: eta.mmsi,
            imo: eta.imo
        },
        location: {
            port: eta.locode
        },
        portcallId: eta.portcall_id
    });
}
