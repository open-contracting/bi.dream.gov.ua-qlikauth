import https from 'https';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

import { caFile, keyFile, certFile } from'./certs.mjs';

const xrfKey = "abcdefghijklmnop";

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  ca: caFile,
  key: keyFile,
  cert: certFile,
});

/**
 * Get ticket
 * 
 * url: string - qlik sense server url
 *  e.g.: https://parana.rbcgrp.com:4243/qps/qauth/
 * dir: string - User directory
 * user: string - User login
 * TargetId: string - Target ID
 */
export async function getTicket(url, dir, user, attributes, targetId) {
  let data;
  try {
    const payload = {
      UserDirectory: dir,
      UserId: user,
      Attributes: attributes,
    };
    if(targetId) payload.TargetId = targetId;

    const response = await fetch(
      `${url}ticket?xrfkey=${xrfKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Qlik-Xrfkey": xrfKey,
        },
        body: JSON.stringify(payload),
        agent: httpsAgent,
      }
    );
    data = await response.json();
  } catch(err) {
    data = {
      Ticket: null,
      error: err
    }
  }
  /*
  Expected data structure:
  {
    UserDirectory: "INTERNAL",
    UserId: "sa_repository",
    Attributes: [ ],
    Ticket: "mH-8E7tqt5ZLq-LF",
    TargetUri: null
  }
  */
  return data;
}

/**
 * Delete user and related sessions
 * @param {string} url - Qlik proxy service url
 * @param {string} dir - user directory
 * @param {string} user - user
 * @returns 
 */
export async function deleteUserAndSessions(url, dir, user) {
  let data;
  try {
    const response = await fetch(
      `${url}/user/${dir}/${user}?xrfkey=${xrfKey}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "X-Qlik-Xrfkey": xrfKey,
        },
        agent: httpsAgent,
      }
    );
    data = await response.json();
  } catch(err) {
    console.error(err);
  }
  return data;
}

/**
 * Add new session for a user
 * @param {string} url - Qlik proxy service url
 * @param {string} dir - user directory
 * @param {string} user - user
 * @returns JSON
 */
export async function addSession(url, dir, user) {
  let data;
  try {
    const payload = {
      UserDirectory: dir,
      UserId: user,
      Attributes: [],
      SessionId: uuidv4()
    };

    const response = await fetch(
      `${url}session?xrfkey=${xrfKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Qlik-Xrfkey": xrfKey,
        },
        body: JSON.stringify(payload),
        agent: httpsAgent,
      }
    );
    data = await response.json();
  } catch(err) {
    data = {
      error: err
    }
  }
  /*
  {
  "UserDirectory": "<user directory>",
  "UserId": "<unique user id>",
  "Attributes":
    [ { "<Attribute1>": "<value1a>" },
        { "<Attribute1>": "<value1b>" }, [attributes are not unique]
        { "<Attribute2>": "" }, [value can be empty]
        { "<Attribute3>": "<value3>" },
        ...
    ] [optional],
  "SessionId": "<session id>"
  }
  */
  return data;
}

/**
 * Get user sessions
 * @param {string} url 
 * @param {string} userdir 
 * @param {string} user 
 * @returns JSON data payload
 */
export async function getUserSessions(url, userdir, user) {
  let data;
  try {
    const response = await fetch(
      `${url}user/${userdir}/${user}?xrfkey=${xrfKey}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Qlik-Xrfkey": xrfKey,
        },
        agent: httpsAgent,
      }
    );
    data = await response.json();
  } catch(err) {
    console.error(err);
  }
  return data;
}