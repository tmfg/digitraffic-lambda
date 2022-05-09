import {SecretFunction, withDbSecret} from "digitraffic-common/aws/runtime/secrets/dbsecret";
import {AutoriApi} from "../../api/autori";
import {MaintenanceTrackingMunicipalityEnvKeys} from "../../keys";
import {MaintenanceTrackingAutoriSecret} from "../../model/maintenance-tracking-municipality-secret";
import {TrackingSaveResult} from "../../model/tracking-save-result";
import {AutoriUpdate} from "../../service/autori-update";
import * as CommonUpdate from "../../service/common-update";

const secretId = process.env.SECRET_ID as string;
const domainName = process.env[MaintenanceTrackingMunicipalityEnvKeys.DOMAIN_NAME] as string;
const domainPrefix = process.env[MaintenanceTrackingMunicipalityEnvKeys.DOMAIN_PREFIX] as string;

let autoriUpdateService : AutoriUpdate;

export function handlerFn(doWithSecret: SecretFunction<MaintenanceTrackingAutoriSecret>) {
    return async () : Promise<TrackingSaveResult> => {
        const start = Date.now();

        if (!autoriUpdateService) {
            console.info(`method=MaintenanceTrackingMunicipality.autoriUpdateData domain=${domainName} lambda was cold`);
            await doWithSecret(secretId, (secret: MaintenanceTrackingAutoriSecret) => {
                const autoriApi = new AutoriApi(secret.username, secret.password, secret.url);
                autoriUpdateService = new AutoriUpdate(autoriApi);
            }, {
                prefix: domainPrefix,
            });
        }

        try {
            await CommonUpdate.upsertDomain(domainName);
            await autoriUpdateService.updateContractsForDomain(domainName);
            await autoriUpdateService.updateTaskMappingsForDomain(domainName);

            return autoriUpdateService.updateTrackingsForDomain(domainName)
                .then(savedResult => {
                    console.info(`method=MaintenanceTrackingMunicipality.updateTrackingsForDomain domain=${domainName} count=${savedResult.saved} errors=${savedResult.errors} sizeBytes=${savedResult.sizeBytes} tookMs=${(Date.now() - start)}`);
                    return savedResult;
                });
        } catch (error) {
            console.error(`method=MaintenanceTrackingMunicipality.updateTrackingsForDomain domain=${domainName} failed after ${(Date.now() - start)} ms`, error);
            throw error;
        }
    };
}

export const handler = handlerFn(withDbSecret);