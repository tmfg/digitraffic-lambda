import { dbTestBase, insertOcpiCpo, setTestEnv, withServer } from "../../db-testutil";
setTestEnv();
import { SecretHolder } from "@digitraffic/common/dist/aws/runtime/secrets/secret-holder";
import { TestHttpServer } from "@digitraffic/common/dist/test/httpserver";
import * as sinon from "sinon";
import { CredentialsObject } from "../../../lib/api/ocpi/2_1_1/ocpi-api-responses_2_1_1";
import {
    StatusCode,
    VersionDetailsResponse,
    VersionString,
    VersionsResponse
} from "../../../lib/api/ocpi/ocpi-api-responses";
import * as OcpiDao from "../../../lib/dao/ocpi-dao";
import { handler } from "../../../lib/lambda/ocpi-registration/ocpi-registration";
import { ChargingNetworkSecret } from "../../../lib/model/charging-network-secret";
import { DbOcpiCpo, DbOcpiCpoBusinessDetails } from "../../../lib/model/dao-models";
import {
    OCPI_MODULE_CREDENTIALS,
    OCPI_MODULE_LOCATIONS,
    VERSION_2_1_1,
    VERSION_2_2
} from "../../../lib/model/ocpi-constants";
import {
    CPO_2_1_1_CREDENTIALS_ENPOINT,
    CPO_2_1_1_ENPOINT,
    CPO_2_1_1_LOCATIONS_ENPOINT,
    CPO_COUNTRY_CODE,
    CPO_NAME,
    CPO_PARTY_ID,
    CPO_TOKEN_A,
    CPO_TOKEN_C,
    CPO_VERSIONS_ENPOINT,
    CPO_WEBSITE,
    DT_CPO_ID
} from "../../test-constants";

const SECRET_VALUE = {} as ChargingNetworkSecret;

describe(
    "lambda-ocpi-registration-test",
    dbTestBase((db) => {
        sinon.stub(SecretHolder.prototype, "get").returns(Promise.resolve(SECRET_VALUE));

        test("one cpo", async () => {
            await insertOcpiCpo(
                db,
                DT_CPO_ID,
                CPO_NAME,
                CPO_TOKEN_A,
                undefined,
                undefined,
                CPO_VERSIONS_ENPOINT
            );

            const cpoVersionsResponse: VersionsResponse = createVersionsResponse(
                VERSION_2_1_1,
                CPO_2_1_1_ENPOINT
            );
            const cpoVersion_2_1_1_Response: VersionDetailsResponse = createVersionResponse(
                VERSION_2_1_1,
                CPO_2_1_1_CREDENTIALS_ENPOINT,
                CPO_2_1_1_LOCATIONS_ENPOINT
            );
            const cpoCredentialsResponse: CredentialsObject = createCredentials(
                VERSION_2_1_1,
                CPO_TOKEN_C,
                CPO_COUNTRY_CODE,
                CPO_PARTY_ID,
                CPO_VERSIONS_ENPOINT,
                CPO_NAME,
                CPO_WEBSITE
            );

            await withServer(
                [
                    [CPO_VERSIONS_ENPOINT, cpoVersionsResponse],
                    [CPO_2_1_1_ENPOINT, cpoVersion_2_1_1_Response],
                    [CPO_2_1_1_CREDENTIALS_ENPOINT, cpoCredentialsResponse]
                ],
                async (server: TestHttpServer) => {
                    await handler(); // do registration
                    expect(server.getCallCount()).toEqual(3); // Expect calls to: versions + version + credentials

                    const cpo: DbOcpiCpo | undefined = await OcpiDao.findCpo(db, DT_CPO_ID);
                    expect(cpo).toBeDefined();
                    if (cpo) {
                        expect(cpo.party_id).toEqual(CPO_PARTY_ID);
                        expect(cpo.dt_cpo_name).toEqual(CPO_NAME);
                        expect(cpo.country_code).toEqual(CPO_COUNTRY_CODE);
                        expect(cpo.token_a).toEqual(CPO_TOKEN_A);
                        expect(cpo.token_b).toBeDefined();
                        expect(cpo.token_c).toEqual(CPO_TOKEN_C);
                        expect(cpo.token_a).not.toEqual(cpo.token_b);
                        expect(cpo.token_a).not.toEqual(cpo.token_c);
                        expect(cpo.token_c).not.toEqual(cpo.token_b);
                        console.log(`findCpo cpo: ${JSON.stringify(cpo)}`);
                    }

                    const cpoDetails: DbOcpiCpoBusinessDetails | undefined =
                        await OcpiDao.findCpoBusinessDetails(db, DT_CPO_ID);
                    expect(cpo).toBeDefined();
                    if (cpoDetails) {
                        expect(cpoDetails.name).toEqual(CPO_NAME);
                        expect(cpoDetails.logo_url).toEqual("http://logo.jpg");
                        expect(cpoDetails.logo_thumbnail).toEqual("http://logo_tn.jpg");
                        expect(cpoDetails.logo_category).toEqual("OPERATOR");
                        expect(cpoDetails.logo_type).toEqual("jpg");
                        expect(cpoDetails.logo_width).toEqual(800);
                        expect(cpoDetails.logo_height).toEqual(600);
                        expect(cpoDetails.website).toEqual(CPO_WEBSITE);
                        console.log(`findCpoBusinessDetails: ${JSON.stringify(cpoDetails)}`);
                    }

                    const credentialsEndpoint = await OcpiDao.findCpoModuleEndpoint(
                        db,
                        DT_CPO_ID,
                        "2.1.1",
                        OCPI_MODULE_CREDENTIALS
                    );
                    expect(credentialsEndpoint).toBeDefined();
                    if (credentialsEndpoint) {
                        expect(credentialsEndpoint.dt_cpo_id).toEqual(DT_CPO_ID);
                        expect(credentialsEndpoint.module).toEqual(OCPI_MODULE_CREDENTIALS);
                        expect(credentialsEndpoint.ocpi_version).toEqual(VERSION_2_1_1);
                        expect(credentialsEndpoint.endpoint).toEqual(CPO_2_1_1_CREDENTIALS_ENPOINT);
                        console.log(
                            `findCpoModuleEndpoint credentials: ${JSON.stringify(credentialsEndpoint)}`
                        );
                    }

                    const locationsEndpoint = await OcpiDao.findCpoModuleEndpoint(
                        db,
                        DT_CPO_ID,
                        "2.1.1",
                        OCPI_MODULE_LOCATIONS
                    );
                    expect(locationsEndpoint).toBeDefined();
                    if (locationsEndpoint) {
                        expect(locationsEndpoint.dt_cpo_id).toEqual(DT_CPO_ID);
                        expect(locationsEndpoint.module).toEqual(OCPI_MODULE_LOCATIONS);
                        expect(locationsEndpoint.ocpi_version).toEqual(VERSION_2_1_1);
                        expect(locationsEndpoint.endpoint).toEqual(CPO_2_1_1_LOCATIONS_ENPOINT);
                        console.log(`findCpoModuleEndpoint locations: ${JSON.stringify(locationsEndpoint)}`);
                    }
                }
            );
        });

        test("two cpo", async () => {
            const DT_CPO_ID_2 = DT_CPO_ID + "_2";
            await insertOcpiCpo(
                db,
                DT_CPO_ID,
                CPO_NAME,
                CPO_TOKEN_A,
                undefined,
                undefined,
                CPO_VERSIONS_ENPOINT
            );
            await insertOcpiCpo(
                db,
                DT_CPO_ID_2,
                CPO_NAME + "_2",
                CPO_TOKEN_A,
                undefined,
                undefined,
                CPO_VERSIONS_ENPOINT
            );

            const cpoVersionsResponse: VersionsResponse = createVersionsResponse(
                VERSION_2_1_1,
                CPO_2_1_1_ENPOINT
            );
            const cpoVersion_2_1_1_Response: VersionDetailsResponse = createVersionResponse(
                VERSION_2_1_1,
                CPO_2_1_1_CREDENTIALS_ENPOINT,
                CPO_2_1_1_LOCATIONS_ENPOINT
            );
            const cpoCredentialsResponse: CredentialsObject = createCredentials(
                VERSION_2_1_1,
                CPO_TOKEN_C,
                CPO_COUNTRY_CODE,
                CPO_PARTY_ID,
                CPO_VERSIONS_ENPOINT,
                CPO_NAME,
                CPO_WEBSITE
            );

            await withServer(
                [
                    [CPO_VERSIONS_ENPOINT, cpoVersionsResponse],
                    [CPO_2_1_1_ENPOINT, cpoVersion_2_1_1_Response],
                    [CPO_2_1_1_CREDENTIALS_ENPOINT, cpoCredentialsResponse]
                ],
                async (server: TestHttpServer) => {
                    await handler(); // do registration
                    expect(server.getCallCount()).toEqual(6); // Expect calls to: versions + version + credentials

                    const cpo1: DbOcpiCpo | undefined = await OcpiDao.findCpo(db, DT_CPO_ID);
                    const cpo2: DbOcpiCpo | undefined = await OcpiDao.findCpo(db, DT_CPO_ID_2);
                    expect(cpo1).toBeDefined();
                    expect(cpo2).toBeDefined();
                    if (cpo1 && cpo2) {
                        expect(cpo1.dt_cpo_name).not.toEqual(cpo2.dt_cpo_name);
                    }
                }
            );
        });

        test("Unsupported cpo version", async () => {
            await insertOcpiCpo(
                db,
                DT_CPO_ID,
                CPO_NAME,
                CPO_TOKEN_A,
                undefined,
                undefined,
                CPO_VERSIONS_ENPOINT
            );

            const cpoVersionsResponse: VersionsResponse = createVersionsResponse(
                VERSION_2_2,
                CPO_2_1_1_ENPOINT
            );
            const cpoVersion_2_1_1_Response: VersionDetailsResponse = createVersionResponse(
                VERSION_2_1_1,
                CPO_2_1_1_CREDENTIALS_ENPOINT,
                CPO_2_1_1_LOCATIONS_ENPOINT
            );
            const cpoCredentialsResponse: CredentialsObject = createCredentials(
                VERSION_2_1_1,
                CPO_TOKEN_C,
                CPO_COUNTRY_CODE,
                CPO_PARTY_ID,
                CPO_VERSIONS_ENPOINT,
                CPO_NAME,
                CPO_WEBSITE
            );

            await withServer(
                [
                    [CPO_VERSIONS_ENPOINT, cpoVersionsResponse],
                    [CPO_2_1_1_ENPOINT, cpoVersion_2_1_1_Response],
                    [CPO_2_1_1_CREDENTIALS_ENPOINT, cpoCredentialsResponse]
                ],
                async (server: TestHttpServer) => {
                    await handler(); // do registration
                    expect(server.getCallCount()).toEqual(1); // Expect calls to: versions + version + credentials

                    const cpo1: DbOcpiCpo | undefined = await OcpiDao.findCpo(db, DT_CPO_ID);

                    expect(cpo1).toBeDefined();
                    if (cpo1) {
                        expect(cpo1.dt_cpo_name).toEqual(CPO_NAME);
                        expect(cpo1.token_c).toBe(null);
                    }
                }
            );
        });
    })
);

function createCredentials(
    version: VersionString,
    token: string,
    countryCode: "FI",
    partyId: string,
    versionsEndpoint: string,
    name: string,
    website: string
): CredentialsObject {
    return {
        type: "Success",
        status_code: StatusCode.success,
        status_message: "Success",
        timestamp: new Date(),
        data: {
            token: token,
            country_code: countryCode,
            party_id: partyId,
            url: versionsEndpoint,
            business_details: {
                name: name,
                website: website,
                logo: {
                    url: "http://logo.jpg",
                    thumbnail: "http://logo_tn.jpg",
                    category: "OPERATOR",
                    type: "jpg",
                    width: 800,
                    height: 600
                }
            }
        }
    };
}

function createVersionResponse(
    version: VersionString,
    credentialsEndpoint: string,
    locationsEndpoint: string
): VersionDetailsResponse {
    return {
        type: "Success",
        status_code: StatusCode.success,
        status_message: "Success",
        timestamp: new Date(),
        data: {
            version,
            endpoints: [
                {
                    identifier: "credentials",
                    url: credentialsEndpoint
                },
                {
                    identifier: "locations",
                    url: locationsEndpoint
                }
            ]
        }
    };
}

function createVersionsResponse(version: VersionString, versionUrl: string): VersionsResponse {
    return {
        type: "Success",
        status_code: StatusCode.success,
        status_message: "Success",
        timestamp: new Date(),
        data: [
            {
                version,
                url: versionUrl
            }
        ]
    };
}
