import {IDatabase} from "pg-promise";
import {dbTestBase, insertAreaTraffic, insertVessel, insertVesselLocation} from "../db-testutil";
import {getAreaTraffic} from "../../lib/db/areatraffic";

describe('db-areatraffic', dbTestBase((db: IDatabase<any, any>) => {
    test('getAreaTraffic - empty', async () => {
        const traffic = await getAreaTraffic(db);

        expect(traffic).toHaveLength(0);
    });

    test('getAreaTraffic - one-hit', async () => {
        await insertAreaTraffic(db, 1, 'testi1', 10, "POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))");
        await insertVessel(db, 1, 70); // 70 will trigger
        await insertVesselLocation(db, 1, Date.now(), 1);

        const traffic = await getAreaTraffic(db);

        expect(traffic).toHaveLength(1);
    });

    test('getAreaTraffic - wrong ship-type', async () => {
        await insertAreaTraffic(db, 1, 'testi1', 10, "POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))");
        await insertVessel(db, 1, 1); // ship_type 1 will not trigger
        await insertVesselLocation(db, 1, Date.now(), 1);

        const traffic = await getAreaTraffic(db);

        expect(traffic).toHaveLength(0);
    });

    test('getAreaTraffic - not in the area', async () => {
        await insertAreaTraffic(db, 1, 'testi1', 10, "POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))");
        await insertVessel(db, 1, 70); // 70 will trigger
        await insertVesselLocation(db, 1, Date.now(), -1);

        const traffic = await getAreaTraffic(db);

        expect(traffic).toHaveLength(0);
    });


}));
