import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import fetch from "node-fetch";
import { v4 as uuidv4 } from "uuid";

const certsPath = process.env.QLIK_CERTS_PATH
    ? path.resolve(process.cwd(), process.env.QLIK_CERTS_PATH)
    : path.resolve(process.cwd(), process.env.NODE_ENV === "production" ? "/data/certs" : "certs");

const xrfKey = process.env.QLIK_XRFKEY || "abcdefghijklmnop";

const agent = new https.Agent({
    rejectUnauthorized: false,
    ca: fs.readFileSync(path.resolve(certsPath, "root.pem")),
    key: fs.readFileSync(path.resolve(certsPath, "client_key.pem")),
    cert: fs.readFileSync(path.resolve(certsPath, "client.pem")),
});

/**
 * Get ticket
 *
 * url: string - qlik sense server url
 *  e.g.: https://parana.rbcgrp.com:4243/qps/qauth/
 * userdir: string - User directory
 * user: string - User login
 * TargetId: string - Target ID
 */
export async function getTicket(url, userdir, user, attributes, targetId) {
    let data;
    try {
        const payload = {
            UserDirectory: userdir,
            UserId: user,
            Attributes: attributes,
        };
        if (targetId) payload.TargetId = targetId;

        const response = await fetch(`${url}ticket?xrfkey=${xrfKey}`, {
            agent,
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Qlik-Xrfkey": xrfKey },
            body: JSON.stringify(payload),
        });

        data = await response.json();
        // Expected data structure:
        // {
        //   UserDirectory: "INTERNAL",
        //   UserId: "sa_repository",
        //   Attributes: [ ],
        //   Ticket: "mH-8E7tqt5ZLq-LF",
        //   TargetUri: null
        // }
    } catch (err) {
        data = { Ticket: null, error: err };
    }
    return data;
}

/**
 * Make an HTTP request to the Qlik proxy service
 * @param {string} url - Base URL of the Qlik proxy service
 * @param {string} userdir - User directory
 * @param {string} user - User
 * @param {string} method - HTTP method (e.g., "GET", "DELETE")
 * @returns JSON data payload
 */
async function makeUserRequest(url, userdir, user, method) {
    let data;
    try {
        const response = await fetch(`${url}user/${userdir}/${user}?xrfkey=${xrfKey}`, {
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

export async function getUserSessions(url, userdir, user) {
    return await makeUserRequest(url, userdir, user, "GET");
}

export async function deleteUserAndSessions(url, userdir, user) {
    return await makeUserRequest(url, userdir, user, "DELETE");
}
