import fs from 'fs';
import path from 'path';

export const CERTS_PATH = process.env.CERTS_PATH ? path.resolve(process.cwd(), process.env.CERTS_PATH) : path.resolve(process.cwd(), "certs");
export const caFile = fs.readFileSync(path.resolve(CERTS_PATH, "root.pem"));
export const keyFile = fs.readFileSync(path.resolve(CERTS_PATH, "client_key.pem"));
export const certFile = fs.readFileSync(path.resolve(CERTS_PATH, "client.pem"));
