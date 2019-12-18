///<reference path="../lib/app-props.d.ts"/>

const props: Props = {
    vpcId: 'some-vpc-id',
    privateSubnetIds: ['some-subnet-id',],
    availabilityZones: ['some-az1'],
    lambdaDbSgId: 'sg-xxxxxxxxx',
    dbProps: {
        username: 'someuser',
        password: 'somepass',
        uri: 'someurl:5432/someschema'
    },
    defaultLambdaDurationSeconds: 10,
    logsDestinationArn: 'arn:aws:logs:some-region:123123123123:destination:some-destination',
    integration: {
        username: 'username',
        password: 'password',
        url: 'http://some.url'
    }
};
export default props;
