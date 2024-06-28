import { dbTestBase, insertOcpiCpo, setTestEnv } from "../../db-testutil.js";
import { SecretHolder } from "@digitraffic/common/dist/aws/runtime/secrets/secret-holder";
import nock from "nock";
import * as sinon from "sinon";
import type { CredentialsObject } from "../../../api/ocpi/2_1_1/ocpi-api-responses_2_1_1.js";
import {
    StatusCode,
    type VersionDetailsResponse,
    type VersionString,
    type VersionsResponse
} from "../../../api/ocpi/ocpi-api-responses.js";
import * as OcpiDao from "../../../dao/ocpi-dao.js";
import { handler } from "../../../lambda/ocpi-registration/ocpi-registration.js";
import type { ChargingNetworkSecret } from "../../../model/charging-network-secret.js";
import type { DbOcpiCpo, DbOcpiCpoBusinessDetails } from "../../../model/dao-models.js";
import {
    OCPI_MODULE_CREDENTIALS,
    OCPI_MODULE_LOCATIONS,
    VERSION_2_1_1,
    VERSION_2_2
} from "../../../model/ocpi-constants.js";
import {
    CPO_2_1_1_CREDENTIALS_ENPOINT,
    CPO_2_1_1_CREDENTIALS_PATH,
    CPO_2_1_1_ENPOINT,
    CPO_2_1_1_LOCATIONS_ENPOINT,
    CPO_2_1_1_PATH,
    CPO_COUNTRY_CODE,
    CPO_NAME,
    CPO_PARTY_ID,
    CPO_TOKEN_A,
    CPO_TOKEN_C,
    CPO_VERSIONS_ENPOINT,
    CPO_VERSIONS_PATH,
    CPO_WEBSITE,
    DT_CPO_ID
} from "../../test-constants.js";
import { ChargingNetworkKeys } from "../../../keys.js";

setTestEnv();

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
            try {
                const scope = nock(ChargingNetworkKeys.OCPI_DOMAIN_URL)
                    .get(CPO_VERSIONS_PATH)
                    .reply(200, cpoVersionsResponse)
                    .get(CPO_2_1_1_PATH)
                    .reply(200, cpoVersion_2_1_1_Response)
                    .post(CPO_2_1_1_CREDENTIALS_PATH)
                    .reply(200, cpoCredentialsResponse);
                await handler();
                expect(scope.isDone()).toBeTruthy();
            } catch (e) {
                fail("More than one request was made");
            }

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

            const cpoDetails: DbOcpiCpoBusinessDetails | undefined = await OcpiDao.findCpoBusinessDetails(
                db,
                DT_CPO_ID
            );
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
                console.log(`findCpoModuleEndpoint credentials: ${JSON.stringify(credentialsEndpoint)}`);
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

            try {
                const scope = nock(ChargingNetworkKeys.OCPI_DOMAIN_URL)
                    .get(CPO_VERSIONS_PATH)
                    .times(2)
                    .reply(200, cpoVersionsResponse)
                    .get(CPO_2_1_1_PATH)
                    .times(2)
                    .reply(200, cpoVersion_2_1_1_Response)
                    .post(CPO_2_1_1_CREDENTIALS_PATH)
                    .times(2)
                    .reply(200, cpoCredentialsResponse);
                await handler();
                expect(scope.isDone()).toBeTruthy();
            } catch (e) {
                fail("More than one request was made");
            }
            const cpo1: DbOcpiCpo | undefined = await OcpiDao.findCpo(db, DT_CPO_ID);
            const cpo2: DbOcpiCpo | undefined = await OcpiDao.findCpo(db, DT_CPO_ID_2);
            expect(cpo1).toBeDefined();
            expect(cpo2).toBeDefined();
            if (cpo1 && cpo2) {
                expect(cpo1.dt_cpo_name).not.toEqual(cpo2.dt_cpo_name);
            }
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

            try {
                const scope = nock(ChargingNetworkKeys.OCPI_DOMAIN_URL)
                    .get(CPO_VERSIONS_PATH)
                    .reply(200, cpoVersionsResponse);
                await handler();
                expect(scope.isDone()).toBeTruthy();
            } catch (e) {
                fail("More than one request was made");
            }

            const cpo1: DbOcpiCpo | undefined = await OcpiDao.findCpo(db, DT_CPO_ID);

            expect(cpo1).toBeDefined();
            if (cpo1) {
                expect(cpo1.dt_cpo_name).toEqual(CPO_NAME);
                expect(cpo1.token_c).toBe(null);
            }
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
