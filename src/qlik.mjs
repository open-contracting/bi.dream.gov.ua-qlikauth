import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import fetch from "node-fetch";

const baseUrl = process.env.QLIK_PROXY_SERVICE;

const certsPath = process.env.QLIK_CERTS_PATH
    ? path.resolve(process.cwd(), process.env.QLIK_CERTS_PATH)
    : path.resolve(process.cwd(), process.env.NODE_ENV === "production" ? "/data/certs" : "certs");

const xrfKey = process.env.QLIK_XRFKEY || "abcdefghijklmnop";

const agent = new https.Agent({
    rejectUnauthorized: false, // allow self-signed certificates
    ca: fs.readFileSync(path.resolve(certsPath, "root.pem")),
    key: fs.readFileSync(path.resolve(certsPath, "client_key.pem")),
    cert: fs.readFileSync(path.resolve(certsPath, "client.pem")),
});

/**
 * Get ticket
 *
 * @param {string} userdir - User directory
 * @param {string} user - User ID
 * @param {string} targetId - Target ID
 * @returns JSON data payload
 */
export async function addTicket(userdir, user, attributes, targetId) {
    let data;
    try {
        const payload = {
            UserDirectory: userdir,
            UserId: user,
            Attributes: attributes,
        };
        if (targetId) payload.TargetId = targetId;

        // https://help.qlik.com/en-US/sense-developer/May2024/Subsystems/ProxyServiceAPI/Content/Sense_ProxyServiceAPI/ProxyServiceAPI-ProxyServiceAPI-Authentication-Ticket-Add.htm
        const url = `${baseUrl}ticket?xrfkey=${xrfKey}`;
        console.log(`POST ${url} UserDirectory=${userdir} UserId=${user} userName=${attributes[1].userName}`);
        const response = await fetch(url, {
            agent,
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Qlik-Xrfkey": xrfKey },
            body: JSON.stringify(payload),
        });

        data = await response.json();
    } catch (err) {
        data = { Ticket: null, error: err };
    }
    return data;
}

/**
 * Make an HTTP request to the Qlik proxy service
 *
 * @param {string} userdir - User directory
 * @param {string} user - User ID
 * @param {string} method - HTTP method (e.g., "GET", "DELETE")
 * @returns JSON data payload
 */
async function makeUserRequest(userdir, user, method) {
    let data;
    try {
        const url = `${baseUrl}user/${userdir}/${user}?xrfkey=${xrfKey}`;
        console.log(`${method} ${url}`);
        const response = await fetch(url, {
            agent,
            method,
            headers: { "Content-Type": "application/json", "X-Qlik-Xrfkey": xrfKey },
        });

        data = await response.json();
    } catch (err) {
        console.error(err);
    }
    return data;
}

export async function getUserSessions(userdir, user) {
    // https://help.qlik.com/en-US/sense-developer/May2024/Subsystems/ProxyServiceAPI/Content/Sense_ProxyServiceAPI/ProxyServiceAPI-ProxyServiceAPI-Authentication-User-Get.htm
    return await makeUserRequest(userdir, user, "GET");
}

export async function deleteUserAndSessions(userdir, user) {
    // https://help.qlik.com/en-US/sense-developer/May2024/Subsystems/ProxyServiceAPI/Content/Sense_ProxyServiceAPI/ProxyServiceAPI-ProxyServiceAPI-Authentication-User-Delete.htm
    return await makeUserRequest(userdir, user, "DELETE");
}
