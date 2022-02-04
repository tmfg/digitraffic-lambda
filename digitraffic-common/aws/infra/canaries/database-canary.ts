import {Role} from "aws-cdk-lib/aws-iam";
import {ISecret} from "aws-cdk-lib/aws-secretsmanager";
import {CfnCanary} from "aws-cdk-lib/aws-synthetics";
import {Schedule} from "aws-cdk-lib/aws-events";
import {Duration} from "aws-cdk-lib";

import {CanaryParameters} from "./canary-parameters";
import {DigitrafficCanary} from "./canary";
import {DigitrafficStack} from "../stack/stack";

export class DatabaseCanary extends DigitrafficCanary {
    constructor(stack: DigitrafficStack,
        role: Role,
        secret: ISecret,
        params: CanaryParameters) {
        const canaryName = `${params.name}-db`;
        const environmentVariables = stack.createDefaultLambdaEnvironment(`Synthetics-${canaryName}`);

        // the handler code is defined at the actual project using this
        super(
            stack, canaryName, role,
            params, environmentVariables,
        );

        this.artifactsBucket.grantWrite(this.role);
        secret.grantRead(this.role);

        // need to override vpc and security group, can't do this with cdk
        const cfnCanary = this.node.defaultChild as CfnCanary;

        const subnetIds = stack.vpc.privateSubnets.map(subnet => subnet.subnetId);

        cfnCanary.vpcConfig = {
            vpcId: stack.vpc.vpcId,
            securityGroupIds: [stack.lambdaDbSg.securityGroupId],
            subnetIds: subnetIds,
        };
    }

    static create(stack: DigitrafficStack,
        role: Role,
        params: CanaryParameters): DatabaseCanary {
        return new DatabaseCanary(stack, role, stack.secret,
            {...{
                secret: stack.configuration.secretId,
                schedule: Schedule.rate(Duration.hours(1)),
                handler: `${params.name}.handler`,
            }, ...params});
    }

    /**
     *
     * @param stack
     * @param role
     * @param name max len is 10 char. name + -db.handler -> max 21 char
     * @param params
     */
    static createV2(stack: DigitrafficStack,
        role: Role,
        name: string,
        params: Partial<CanaryParameters> = {}): DatabaseCanary {
        return new DatabaseCanary(stack, role, stack.secret,
            {...{
                secret: stack.configuration.secretId,
                schedule: Schedule.rate(Duration.hours(1)),
                handler: `${name}-db.handler`,
                name,
                alarm: {
                    alarmName: `${stack.configuration.shortName}-DB-Alarm`,
                    topicArn: stack.configuration.alarmTopicArn,
                },
            }, ...params});
    }
}