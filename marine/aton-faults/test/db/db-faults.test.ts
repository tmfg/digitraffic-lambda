import * as pgPromise from "pg-promise";
import {dbTestBase, insert} from "../db-testutil";
import {newFault} from "../testdata";
import {findFaultIdsByRoute, getFaultById} from "../../lib/db/db-faults";
import {LineString, Point} from "wkx";
import {FaultState} from "../../lib/model/fault";

describe('db-voyageplan-faults', dbTestBase((db: pgPromise.IDatabase<any, any>) => {

    test('findFaultsByArea - within 15 nautical miles', async () => {
        const fault = newFault({
            geometry: {
                lat: 60.285807,
                lon: 27.321659
            }
        });
        const route = new LineString([
            new Point(27.029835, 60.474496,),
            new Point(27.224842, 60.400138)
        ]);

        await insert(db, [fault]);

        const faults = await findFaultIdsByRoute(db, route);
        expect(faults.length).toBe(1);
    });

    test('findFaultsByArea - outside range', async () => {
        const fault = newFault({
            geometry: {
                lat: 60.177569,
                lon: 27.502246
            }
        });
        const route = new LineString([
            new Point(27.029835, 60.474496),
            new Point(27.224842, 60.400138)
        ]);

        await insert(db, [fault]);

        const faults = await findFaultIdsByRoute(db, route);
        expect(faults.length).toBe(0);
    });

    test('findFaultsByArea - only avoin & kirjattu', async () => {
        const faultAvoin = newFault({
            geometry: {
                lat: 60.474497,
                lon: 27.029836
            },
            state: FaultState.Avoin
        });
        const faultKirjattu = newFault({
            geometry: {
                lat: 60.474498,
                lon: 27.029837
            },
            state: FaultState.Kirjattu
        });
        const faultAiheeton = newFault({
            geometry: {
                lat: 60.474499,
                lon: 27.029838
            },
            state: FaultState.Aiheeton
        });
        const route = new LineString([
            new Point(27.029835, 60.474496),
            new Point(27.224842, 60.400138)
        ]);

        await insert(db, [faultAvoin, faultKirjattu, faultAiheeton]);

        const faultIds = await findFaultIdsByRoute(db, route);
        expect(faultIds.length).toBe(2);
        expect(faultIds.find(id => id == faultAvoin.id)).not.toBeNull();
        expect(faultIds.find(id => id == faultKirjattu.id)).not.toBeNull();
    });

    test('getFaultById - found', async () => {
        const fault = newFault();
        await insert(db, [fault]);

        const foundFault = await getFaultById(db, fault.id);

        expect(Number(foundFault?.id)).toBe(fault.id);
    });

    test('getFaultById - not found', async () => {
        const fault = newFault();
        await insert(db, [fault]);

        const foundFault = await getFaultById(db, fault.id + 1);

        await expect(foundFault).toBeNull()
    });

}));
