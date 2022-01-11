import {DigitrafficStack} from "digitraffic-common/stack/stack";
import {DigitrafficCanaryRole} from "digitraffic-common/aws/canaries/canary-role";
import {DatabaseCanary} from "digitraffic-common/aws/canaries/database-canary";
import {UrlCanary} from "digitraffic-common/aws/canaries/url-canary";
import {PublicApi} from "./public-api";

export class Canaries {
    constructor(stack: DigitrafficStack, publicApi: PublicApi) {
        if (stack.configuration.enableCanaries) {
            const urlRole = new DigitrafficCanaryRole(stack, 'nw-url');
            const dbRole = new DigitrafficCanaryRole(stack, 'nw-db').withDatabaseAccess();

            new UrlCanary(stack, urlRole, {
                name: 'nw-public-api',
                hostname: publicApi.publicApi.hostname(),
                handler: 'public-api.handler',
                alarm: {
                    alarmName: 'NW-PublicAPI-Alarm',
                    topicArn: stack.configuration.warningTopicArn,
                },
                apiKeyId: publicApi.apiKeyId,
            });

            new DatabaseCanary(stack, dbRole, stack.secret, {
                name: 'nw-db',
                secret: stack.configuration.secretId,
                handler: 'db.handler',
                alarm: {
                    alarmName: 'NW-Db-Alarm',
                    topicArn: stack.configuration.warningTopicArn,
                },
            });

        }
    }
}