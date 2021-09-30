import {Construct, StackProps} from '@aws-cdk/core';
import {ISecurityGroup, IVpc} from '@aws-cdk/aws-ec2';
import * as InternalLambdas from './internal-lambdas';
import * as IntegrationApi from './integration-api';
import * as Sqs from './sqs';
import {PublicApi} from "./public-api";
import {Props} from './app-props';
import {Bucket} from "@aws-cdk/aws-s3";
import {DatabaseCluster, DatabaseClusterEngine, DatabaseProxy, ProxyTarget} from "@aws-cdk/aws-rds";
import {ISecret, Secret} from "@aws-cdk/aws-secretsmanager";
import {Canaries} from "./canaries";
import {Topic} from "@aws-cdk/aws-sns";
import {DigitrafficStack} from "../../../digitraffic-common/stack/stack";

export class PortActivityStack extends DigitrafficStack {
    constructor(scope: Construct, id: string, appProps: Props, props?: StackProps) {
        super(scope, id, props);

        const secret = Secret.fromSecretNameV2(this, 'PortActivitySecret', appProps.secretId);

        const alarmTopic = Topic.fromTopicArn(this, 'AlarmTopic', appProps.alarmTopicArn);
        const warningTopic = Topic.fromTopicArn(this, 'WarningTopic', appProps.warningTopicArn);

        this.createRdsProxy(secret, lambdaDbSg, vpc, appProps);

        const queueAndDLQ = Sqs.createQueue(this);
        const dlqBucket = new Bucket(this, 'DLQBucket', {
            bucketName: appProps.dlqBucketName
        });

        InternalLambdas.create(queueAndDLQ, dlqBucket, secret, this.vpc, this.lambdaDbSg, alarmTopic, warningTopic, appProps, this);
        IntegrationApi.create(queueAndDLQ.queue, this.vpc, this.lambdaDbSg, appProps, this);

        const publicApi = new PublicApi(secret, this.vpc, this.lambdaDbSg, appProps, this);

        new Canaries(this, secret, queueAndDLQ.dlq, publicApi.apiKeyId, appProps);

        new Bucket(this, 'DocumentationBucket', {
            bucketName: appProps.documentationBucketName
        });
    }

    createRdsProxy(
        secret: ISecret,
        sg: ISecurityGroup,
        vpc: IVpc,
        appProps: Props) {
        const cluster = DatabaseCluster.fromDatabaseClusterAttributes(this, 'DbCluster', {
            clusterIdentifier: appProps.dbClusterIdentifier,
            engine: DatabaseClusterEngine.AURORA_POSTGRESQL
        });

        // CDK tries to allow connections between proxy and cluster
        // this does not work on cluster references
        // @ts-ignore
        cluster.connections.allowDefaultPortFrom = () => {};

        const dbProxyName = 'PortActivityRDSProxy';
        new DatabaseProxy(this, dbProxyName, {
            dbProxyName,
            vpc,
            secrets: [secret],
            proxyTarget: ProxyTarget.fromCluster(cluster),
            securityGroups: [sg],
            requireTLS: false
        });
    }

}
