const { session } = require("electron");
const path = require("path");
const http = require("http");
const fs = require("fs");

const { CDN_URL } = require("./consts"); // Ensure CDN_URL matches the correct domain
const { availableHacks, currentConfig } = require("./config");

const setupRequestListener = () => {
    const hacksByUrl = {};

    console.log("Setting up request listener. Mapping hacks to URLs:");
    for (const key in availableHacks) {
        const hack = availableHacks[key];
        hacksByUrl[hack.url] = hack;
        console.log(`Hack: ${hack.title} - URL: ${hack.url}`);
    }

    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
        const hack = hacksByUrl[details.url];
        if (!hack || !currentConfig[hack.id]) {
            console.log(`No hack or hack disabled for URL: ${details.url}`);
            callback({});
            return;
        }

        // Replace CDN URL with the local server URL for the SWF files
        const redirectUrl = details.url.replace(CDN_URL, "http://127.0.0.1:8420");
        if (details.url !== redirectUrl) {
            console.log(`Redirecting request for ${details.url} to ${redirectUrl}`);
            callback({
                redirectURL: redirectUrl,
            });
        } else {
            console.log(`No redirection applied for URL: ${details.url}`);
            callback({});
        }
    });
};

exports.setupLocalServer = () => {
    http
        .createServer((req, res) => {
            const filePath = path.join(__dirname, "server", req.url);

            console.log(`Received request for: ${req.url}`);
            console.log(`Resolved file path: ${filePath}`);

            // Read and serve the requested SWF file
            fs.readFile(filePath, "binary", (err, file) => {
                if (err) {
                    console.error(`Error reading file ${filePath}:`, err.message);
                    res.writeHead(404, { "Content-Type": "text/plain" });
                    res.end(`File not found: ${req.url}\n`);
                    return;
                }

                console.log(`Serving file: ${filePath}`);

                res.setHeader("Content-Type", "application/x-shockwave-flash");
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.writeHead(200);
                res.write(file, "binary");
                res.end();

                console.log(`File served successfully: ${filePath}`);
            });
        })
        .listen(8420, "127.0.0.1", () => {
            console.log("Local server started at http://127.0.0.1:8420");
        });

    setupRequestListener();
};
