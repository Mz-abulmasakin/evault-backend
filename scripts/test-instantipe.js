import instantIpe from "../src/modules/identity/providers/instantipe/instantipe.client.js";

async function main() {
  console.log(
    "\n=============================="
  );

  console.log(
    "INSTANTIPE CONNECTION TEST"
  );

  console.log(
    "==============================\n"
  );

  /**
   * 1. Ping
   */
  console.log(
    "1. Testing connectivity..."
  );

  const ping =
    await instantIpe.ping();

  console.dir(
    ping,
    {
      depth: null,
    }
  );

  /**
   * 2. Account
   */
  console.log(
    "\n2. Testing API key..."
  );

  const account =
    await instantIpe.getAccount();

  console.dir(
    account,
    {
      depth: null,
    }
  );

  /**
   * 3. Services
   */
  console.log(
    "\n3. Getting validation services..."
  );

  const services =
    await instantIpe.getServices(
      "validation"
    );

  console.dir(
    services,
    {
      depth: null,
    }
  );

  console.log(
    "\nInstantIPE connection successful."
  );
}

main().catch((error) => {
  console.error(
    "\nInstantIPE test failed."
  );

  console.error(
    "Status:",
    error.status
  );

  console.error(
    "Code:",
    error.code
  );

  console.error(
    "Message:",
    error.message
  );

  console.error(
    "Provider response:",
    error.providerResponse
  );

  process.exit(1);
});