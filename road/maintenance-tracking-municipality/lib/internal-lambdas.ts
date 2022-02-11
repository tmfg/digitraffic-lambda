import {DigitrafficLogSubscriptions} from "digitraffic-common/aws/infra/stack/subscription";
import {MaintenanceTrackingMunicipalityEnvKeys} from "./keys";
import {MonitoredFunction} from "digitraffic-common/aws/infra/stack/monitoredfunction";
import {DigitrafficStack} from "digitraffic-common/aws/infra/stack/stack";
import {Scheduler} from "digitraffic-common/aws/infra/scheduler";

export class InternalLambdas {
    constructor(stack: DigitrafficStack) {

        const updateDataForAutoriOuluLambda = InternalLambdas.createUpdateDataLambdaForAutori(stack, 'autori-oulu', 5);
        const updateDataForAutoriKuopioLambda = InternalLambdas.createUpdateDataLambdaForAutori(stack, 'autori-kuopio', 5);

        new DigitrafficLogSubscriptions(stack, updateDataForAutoriOuluLambda);
        new DigitrafficLogSubscriptions(stack, updateDataForAutoriKuopioLambda);
        stack.grantSecret(updateDataForAutoriOuluLambda);
        stack.grantSecret(updateDataForAutoriKuopioLambda);
    }

    private static createUpdateDataLambdaForAutori(stack: DigitrafficStack, domain: string, runEveryMinutes : number): MonitoredFunction {

        const environment = stack.createLambdaEnvironment();
        environment[MaintenanceTrackingMunicipalityEnvKeys.DOMAIN_NAME] = domain;
        environment[MaintenanceTrackingMunicipalityEnvKeys.DOMAIN_PREFIX] = `mt.municipality.${domain}`;
        // Run every 5 minutes and timeout before it
        const lambdaFunction = MonitoredFunction.createV2(stack, 'autori-update-data', environment, {
            functionName: stack.configuration.shortName + '-' + domain,
            memorySize: 512,
            singleLambda: true,
            timeout: (4*60)+30,
            reservedConcurrentExecutions: 1,
        });

        Scheduler.everyMinutes(stack, `MaintenanceTrackingMunicipalityDataUpdate-${domain}`, runEveryMinutes, lambdaFunction);
        return lambdaFunction;
    }
}