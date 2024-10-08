const path = require("path");
const crypto = require("crypto");
const fs = require("fs");

const { downloadFile } = require("./download");
const { disassemble, assemble, setupFlasm } = require("./flasm");
const { availableHacks, currentConfig } = require("./config");

const deployHack = async (hack) => {
  console.log("Deploying " + hack.title + "...");

  const serverFilePath = path.join("server", new URL(hack.url).pathname);

  // Force redeployment if the SWF file already exists
  if (fs.existsSync(serverFilePath)) {
    console.log("SWF file exists, forcing redeployment...");
    fs.unlinkSync(serverFilePath);  // Remove the old SWF file
  }

  const tmpDir = crypto.randomUUID();  // Create a temporary directory for processing
  fs.mkdirSync(tmpDir);

  const swfFileName = /[^/]*$/.exec(hack.url)[0];  // Extract the SWF file name
  const swfFilePath = path.join(tmpDir, swfFileName);
  fs.mkdirSync(serverFilePath.slice(0, -swfFileName.length), {
    recursive: true,
  });

  console.log(`Downloading original SWF file from URL: ${hack.url}`);
  await downloadFile(hack.url, swfFilePath);

  const flmFile = swfFilePath.slice(0, -4) + ".flm";
  const lines = (await disassemble(swfFilePath)).split(/\r?\n/);
  let lineNumber = 1;
  for (let i = 0; i < hack.substitutions.length; i++) {
    const { replaceLines, withLines } = hack.substitutions[i];
    while (lineNumber < replaceLines[0]) {
      fs.appendFileSync(flmFile, lines[lineNumber++ - 1] + "\n");
    }
    for (let j = 0; j < withLines.length; j++) {
      fs.appendFileSync(flmFile, withLines[j] + "\n");
    }
    lineNumber = replaceLines[1] + 1;
  }
  while (lineNumber <= lines.length) {
    fs.appendFileSync(flmFile, lines[lineNumber++ - 1] + "\n");
  }

  console.log(`Reassembling FLM back into SWF for ${hack.title}...`);
  await assemble(flmFile);

  fs.copyFileSync(swfFilePath, serverFilePath);  // Deploy patched SWF to server folder
  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log(`Patched SWF file deployed to: ${serverFilePath}`);
};

const undeployHack = (hack) => {
  console.log("Undeploying " + hack.title + "...");

  const serverFilePath = path.join("server", new URL(hack.url).pathname);

  if (!fs.existsSync(serverFilePath)) {
    console.log("SWF file not found. Skipping undeployment...");
    return;
  }

  fs.unlinkSync(serverFilePath);
  console.log("SWF file successfully removed.");
};

exports.syncHacksOnLocalServer = async () => {
  console.log("Setting up Flasm...");
  await setupFlasm();

  for (const key in availableHacks) {
    const hack = availableHacks[key];
    console.log(`Checking hack: ${hack.title}`);
    if (currentConfig[key]) {
      console.log(`Hack enabled. Forcing redeployment...`);
      await deployHack(hack);
    } else {
      console.log(`Hack disabled. Undeploying...`);
      undeployHack(hack);
    }
  }

  console.log("All hacks synchronized.");
};
