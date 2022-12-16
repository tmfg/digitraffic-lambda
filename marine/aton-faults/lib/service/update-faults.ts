import { FaultsApi } from "../api/faults";
import {
    DTDatabase,
    inDatabase,
} from "@digitraffic/common/dist/database/database";
import * as FaultsDB from "../db/faults";
import * as LastUpdatedDB from "@digitraffic/common/dist/database/last-updated";
import { ATON_FAULTS_CHECK } from "./faults";
import { FaultFeature } from "../model/fault";

export async function updateFaults(url: string, domain: string) {
    const start = Date.now();

    const newFaults = await new FaultsApi(url).getFaults();
    const validated = newFaults.filter(validate);

    return inDatabase((db: DTDatabase) => {
        return db.tx((t) => {
            return t.batch([
                ...FaultsDB.updateFaults(db, domain, validated),
                LastUpdatedDB.updateUpdatedTimestamp(
                    db,
                    ATON_FAULTS_CHECK,
                    new Date(start)
                ),
            ]);
        });
    }).finally(() => {
        const end = Date.now();
        console.info(
            "method=updateFaults updatedCount=%d tookMs=%d",
            newFaults.length,
            end - start
        );
    });
}

function validate(fault: FaultFeature): boolean {
    if (fault.properties.FAULT_TYPE === "Aiheeton") {
        console.info("Aiheeton id %s", fault.properties.ID);
    }

    return fault.properties.FAULT_TYPE !== "Kirjattu";
}
